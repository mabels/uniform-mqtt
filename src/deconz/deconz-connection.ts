import { Subject, Subscription } from 'rxjs';
import * as _ from 'lodash';
import * as WebSocket from 'ws';
import { EmitRecv, EnsureIsForMe } from '../events/emit-recv';
import uuid = require('uuid');
import { Msg } from '../events/msg';
import { DeconzMsg, DeconzConfig } from './types';
import { LogEmitMsg } from '../events';

export type DeconzConnectionEmitMsg = 
    Msg<undefined, 'deconz.connection.start'> 
  | Msg<undefined, 'deconz.connection.opened'> 
  | Msg<undefined, 'deconz.connection.closed'> 
  | Msg<undefined, 'deconz.connection.timeout'> 
  | Msg<DeconzMsg, 'deconz.connection.sended'> 
  | Msg<DeconzMsg, 'deconz.connection.message'> 
  | Msg<Error, 'deconz.connection.error'>
  | LogEmitMsg;

export type DeconzConnectionRecvMsg = 
    Msg<unknown, 'deconz.connection.close'>
  | Msg<DeconzMsg, 'deconz.connection.send'>;

export class DeconzConnection implements 
  EmitRecv<DeconzConnectionEmitMsg, DeconzConnectionRecvMsg> {
  public readonly addr: string = `deconz.connection.${uuid.v4()}`;  
  public readonly emit = new Subject<DeconzConnectionEmitMsg>();
  public readonly recv = new Subject<DeconzConnectionRecvMsg>();
  private readonly socket: WebSocket;
  private readonly unsub: Subscription;
  private timeout?: any;

  constructor(
    public readonly config: DeconzConfig,
    private readonly txid: string = uuid.v4()
    ) {
    this.unsub = this.recv.subscribe(EnsureIsForMe(this, (msg) => {
      switch (msg.type) {
        case 'deconz.connection.close': 
          this.stop();
          this.unsub.unsubscribe();
          this.clearTimeout();
          break;
        case 'deconz.connection.send':
          this.emit.next({
            src: this.addr,
            dst: msg.src,
            txid: msg.txid,
            type: 'deconz.connection.sended',
            payload: msg.payload
          });
          break;
      }
    }));
    this.socket = this.start();
  }

  private clearTimeout() {
    this.timeout && clearTimeout(this.timeout);
    this.timeout = undefined;
  }

  private start(): WebSocket {
    this.emit.next({
      src: this.addr,
      dst: '*',
      txid: this.txid,
      type: 'deconz.connection.start',
      payload: undefined
    });
    this.timeout = setTimeout(() => {
      this.emit.next({
        src: this.addr,
        dst: '*',
        txid: this.txid,
        type: 'deconz.connection.timeout',
        payload: undefined
      });
    }, this.config.connTimeout || 15000);
    const socket = new WebSocket(`ws://${this.config.host}:${this.config.port}`);
    socket.on('open', () => {
      this.clearTimeout();
      this.emit.next({
        src: this.addr,
        dst: '*',
        txid: this.txid,
        type: 'deconz.connection.opened',
        payload: undefined
      })
    });
    socket.on('message', (data) => {
      this.clearTimeout();
      try {
        const dzData = JSON.parse(data.toString());
        this.emit.next({
          src: this.addr,
          dst: '*',
          txid: this.txid,
          type: 'deconz.connection.message',
          payload: dzData
        })
      } catch (e) {
        this.emit.next({
          src: this.addr,
          dst: '*',
          txid: this.txid,
          type: 'deconz.connection.error',
          payload: e
        })
      }
    });
    socket.on('close', () => {
      this.clearTimeout();
      this.emit.next({
        src: this.addr,
        dst: '*',
        txid: this.txid,
        type: 'deconz.connection.closed',
        payload: undefined
      })
      this.unsub.unsubscribe();
    })
    socket.on('error', error => {
      this.clearTimeout();
      this.emit.next({
        src: this.addr,
        dst: '*',
        txid: this.txid,
        type: 'deconz.connection.error',
        payload: error
      })
      this.stop();
    });
    return;
  }

  private stop() {
    this.socket.close();
  }

}
