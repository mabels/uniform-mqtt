import { Config, MqttConfigs } from './config';
import { Subject, BehaviorSubject, Observable } from 'rxjs';
import { map, filter } from 'rxjs/operators';
import * as _ from 'lodash';
import * as winston from 'winston';
import * as mqtt from 'mqtt';
import * as uuid from 'uuid';

import { runInThisContext } from 'vm';
import { connectableObservableDescriptor } from 'rxjs/internal/observable/ConnectableObservable';
import { Msg } from './msg';
import { EPNext } from './ep-next';
import { EnsureIsForMe, EmitRecv } from './emit-recv';

export interface MqttMsg {
  readonly topic: string;
  readonly message: string;
}

export interface MqttConfig {
  readonly host?: string;
  readonly port?: number;
  readonly username?: string;
  readonly password?: string;
  readonly keepAlive?: number;
  readonly clientId?: string;
  readonly reconnectBackoff?: number;
}

type MqttClientEmitMsg = Msg<Error, 'mqtt.client.error'>
  | Msg<undefined, 'mqtt.client.end'>
  | Msg<undefined, 'mqtt.client.offline'>
  | Msg<MqttMsg, 'mqtt.client.message'>
  | Msg<undefined, 'mqtt.client.connected'>;

type MqttClientRecvMsg = Msg<undefined, 'mqtt.client.stop'>;

class MqttClient implements EmitRecv<MqttClientEmitMsg, MqttClientRecvMsg> {
  public addr = `mqttClient.${uuid.v4()}`;
  private config?: MqttConfig;
  private client?: mqtt.Client;

  public readonly emit = new Subject<MqttClientEmitMsg>();
  public readonly recv = new Subject<MqttClientRecvMsg>();

  constructor(private log: winston.Logger) {
    this.recv.subscribe(EnsureIsForMe(this, msg  => {
      switch (msg.type) {
        case 'mqtt.client.stop':
          // tslint:disable-next-line:no-unused-expression
          this.client && this.client.end(true);
      }
    }));
  }

  private defaultConfig(config: MqttConfig) {
    return {
      ...config,
      keepalive: config.keepAlive || 10000,
      clientId: config.clientId || this.addr
    };
  }

  private start() {
    this.client = mqtt.connect(`mqtt://${this.config.host}:${this.config.port}`,
      this.defaultConfig(this.config));

    this.client.on('error', (e) => {
      this.emit.next({
        src: this.addr,
        dst: '*',
        type: 'mqtt.client.error',
        transaction: this.addr,
        payload: e
      });
    });

    this.client.on('offline', () => {
      this.log.error(`Mqtt:${this.addr}:OffLine`);
      this.emit.next({
        src: this.addr,
        dst: '*',
        type: 'mqtt.client.offline',
        transaction: this.addr,
        payload: undefined
      });
    });

    this.client.on('connect', () => {
      this.log.error(`Mqtt:${this.addr}:Connected`);
      this.emit.next({
        src: this.addr,
        dst: '*',
        type: 'mqtt.client.connected',
        transaction: this.addr,
        payload: undefined
      });
    });

    this.client.on('end', () => {
      this.log.error(`Mqtt:${this.addr}:end`);
      this.emit.next({
        src: this.addr,
        dst: '*',
        type: 'mqtt.client.end',
        transaction: this.addr,
        payload: undefined
      });
    });

    this.client.on('message', (topic, message) => {
      this.emit.next({
        src: this.addr,
        dst: '*',
        type: 'mqtt.client.message',
        transaction: this.addr,
        payload: { topic, message: message.toString() }
      });
    });
  }
}

export class MqttConnector {
  public clients: MqttClient[] = [];

  public readonly receiver = new Subject<MqttMsg>();

  private config: MqttConfigs = {};

  public restart(config: MqttConfig): MqttConfig {
    return config;
  }

  constructor(mqttConfigsObs: Observable<MqttConfigs>,
      private log: winston.Logger) {
    mqttConfigsObs
      .subscribe((mqttConfigs: MqttConfigs) => {
        const toRemove = new Set<string>(Object.keys(this.config));
        for (let key in mqttConfigs) {
          const config = mqttConfigs[key];
          if (config) {
            if (_.isEqual(config, this.config)) {
              log.info('Config Resend but no change required');
              continue;
            }
            this.config[key] = this.restart(config);
          } else {
            this.config[key] = this.restart(config);
          }
        }
        Object.e(mqttConfig).

      }, () => {}, () => {
        this.stop();
      });
  }

}