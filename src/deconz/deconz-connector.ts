import { Subject } from 'rxjs';
import * as _ from 'lodash';
import * as WebSocket from 'ws';
import { EmitRecv, EnsureIsForMe } from '../events/emit-recv';
import uuid = require('uuid');
import { Msg } from '../events/msg';
import { DeconzMsg, DeconzConfig } from './types';
import { DeconzConnectionEmitMsg, DeconzConnection } from './deconz-connection';


type DeconzConnectorRecvMsg = 
    Msg<DeconzConfig, 'deconz.config.add'>
  | Msg<DeconzMsg, 'deconz.connector.msg'>
  | Msg<DeconzConfig, 'deconz.config.del'>;
type DeconzConnectorEmitMsg = DeconzConnectionEmitMsg; 

export class DeconzConnector implements EmitRecv {
  public readonly addr: string = `deconz.connector.${uuid.v4()}`;
  public readonly recv = new Subject<DeconzConnectorRecvMsg>();
  public readonly emit = new Subject<DeconzConnectorEmitMsg>();

  public readonly clients = new Map<string, DeconzConnection>();

  private connection(cfg: DeconzConfig): DeconzConnection {
    const ct = new DeconzConnection(cfg);
    const sub = ct.emit.subscribe(msg => {
      if (msg.src !== ct.addr) {
        return;
      }
      switch (msg.type) {
        case 'deconz.connection.error':
        case 'deconz.connection.timeout':
        case 'deconz.connection.closed':
          sub.unsubscribe();
          this.clients.get(ct.config.id).recv.next({
            src: this.addr,
            dst: ct.addr,
            txid: ct.addr,
            type: 'deconz.connection.close',
            payload: undefined
          });
          setTimeout(() => this.connection(cfg), 0);
          break;
      }
    });
    ct.emit.pipe(this.emit.asObservable);
    return ct;
  }

  constructor(private txid: string = uuid.v4()) {
    this.recv
      .subscribe(EnsureIsForMe(this, (msg) => {
        switch (msg.type) {
          case 'deconz.config.add':
            const ct = this.clients.get(msg.payload.id);
            if (_.isEqual(ct, msg.payload)) {
              return;
            }
            this.clients.set(msg.payload.id, 
              this.connection(msg.payload));
            break;
          case 'deconz.config.del':
            const ctt = this.clients.get(msg.payload.id);
            if (ctt) {
              ctt.recv.next({
                src: this.addr,
                dst: ctt.addr,
                txid: this.txid,
                type: 'deconz.connection.close',
                payload: undefined
              });
              this.clients.delete(ctt.addr);
            }
            break;
        }
      }));
  }
}

