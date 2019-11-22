import { Config } from './config';
import { Subject, BehaviorSubject, Observable } from 'rxjs';
import { map, filter } from 'rxjs/operators';
import * as _ from 'lodash';
import * as winston from 'winston';
import * as WebSocket from 'ws';

export interface DeconzMsg {
}

export interface DeconzConfig {
  readonly host?: string; 
  readonly port?: number; 
  readonly reconnectBackoff?: number; 
}

export class DeconzConnector {
  private config?: DeconzConfig;
  private socket?: WebSocket;
  public readonly connected = new BehaviorSubject(false); 
  public readonly receiver = new Subject<DeconzMsg>();

  private stop() {
    this.connected.next(false);
    this.socket.close();
    setTimeout(() => this.start(), this.config.reconnectBackoff || 1000);
  }

  private msgProcessor() {
    this.socket.on('message', (data) => {
      try {
        const dzData = JSON.parse(data.toString());
        this.log.info("WebSocket:Msg:", data.toString());
        this.receiver.next(dzData);
      } catch (e) {
        this.log.error("msgProcessor:", e);
      }
    });
  }

  private start() {
    this.socket = new WebSocket(`ws://${this.config.host}:${this.config.port}`);
    this.socket.on('open', () => {
      this.log.info("WebSocket:Opened:");
      this.connected.next(true);
      this.msgProcessor();
    });
    this.socket.on('error', (msg) => {
      this.log.error('WebSocket:Error:', msg);
      this.stop();
    });
  }

  constructor(config: Observable<DeconzConfig>, 
              private readonly log: winston.Logger) {
    config
      .subscribe((dzConfig: DeconzConfig) => {
        if (_.isEqual(dzConfig, this.config)) {
          log.info('Config Resend but no change required');
          return; 
        }
        if (this.config) {
          this.stop();
        }
        this.config = dzConfig;
        this.start();  
      });
  }
}

