import { MqttConfigs } from "../config";
import { Subject, Subscription, BehaviorSubject } from "rxjs";
import * as _ from "lodash";
import * as uuid from "uuid";
import { Msg } from "../events";
import { EnsureIsForMe, EmitRecv } from "../events/emit-recv";
import { MqttConfig, MqttMsg, DefaultMqttConfig, mqttConfig } from "./types";
import { MqttClient, MqttClientEmitMsg } from "./mqtt-client";

type MqttConnectorEmitMsg = MqttClientEmitMsg;
type MqttConnectorRecvMsg =
  | Msg<DefaultMqttConfig, "mqtt.connector.add">
  | Msg<MqttMsg, "mqtt.connector.msg">
  | Msg<undefined, "mqtt.connector.del">
  | Msg<undefined, "mqtt.connector.stop">;

interface Queue {
  readonly id: string;
  readonly entry: MqttMsg;

  state: "active" | "waiting";
  timeout?: any;
}

export class MqttConnector
  implements EmitRecv<MqttConnectorEmitMsg, MqttConnectorRecvMsg> {
  public readonly addr = `mqtt.connector.${uuid.v4()}`;
  public readonly emit = new Subject<MqttConnectorEmitMsg>();
  public readonly recv = new Subject<MqttConnectorRecvMsg>();
  public client?: MqttClient;
  public clientSubscription?: Subscription;
  public config?: MqttConfig;

  private queue: Queue[] = [];
  private connected = new BehaviorSubject(false);

  public restart(config: MqttConfig): MqttConfig {
    return config;
  }

  public stop() {
    this.connected.next(false);
    if (this.client) {
      this.client.recv.next({
        src: this.addr,
        dst: this.client.addr,
        txid: this.addr,
        type: "mqtt.client.stop",
        payload: undefined
      });
      this.clientSubscription.unsubscribe();
    }
  }

  // private buildKeyList() {
  //   const toRemove = new Set<string>();
  //   for (let i in this.clients.keys) {
  //     toRemove.add(i);
  //   }
  //   return toRemove;
  // }

  private startQ() {
    this.connected.subscribe(msg => {
      if (msg) {
        this.queue.forEach(qe => {
          if (qe.timeout) {
            clearTimeout(qe.timeout);
          }
          qe.state = "waiting";
        });
        return;
      }
      if (!this.queue.length) {
        return;
      }
      const a = this.queue.find(q => q.state == "active");
      if (!a) {
        const next = this.queue[0];
        next.state = "active";
        next.timeout = setTimeout(() => {
          next.state = "waiting";
          next.timeout = undefined;
        }, this.config.sendTimeout);
        this.client.recv.next({
          src: this.addr,
          dst: this.client.addr,
          txid: next.id,
          type: 'mqtt.client.msg.send',
          payload: next.entry
        });
      }
    });
  }

  private nextQ(qid: string) {
    const idx = this.queue.findIndex(i => i.id === qid);
    if (idx > 0) {
      this.queue.splice(idx, 1);
    }
    this.startQ();
  }

  constructor() {
    const unsub = this.recv.subscribe(
      EnsureIsForMe(this, msg => {
        switch (msg.type) {
          case "mqtt.connector.stop":
            this.stop();
            this.config = undefined;
            unsub.unsubscribe();
            break;
          case "mqtt.connector.msg":
            this.queue.push({
              state: "waiting",
              id: uuid.v4(),
              entry: msg.payload as MqttMsg
            });
            this.startQ();
            break;
          case "mqtt.connector.del":
            this.stop();
            this.config = undefined;
            break;
          case "mqtt.connector.add":
            this.stop();
            this.config = mqttConfig(msg.payload);
            this.client = new MqttClient(msg.payload);
            let connectTimer: any = undefined;
            this.clientSubscription = this.client.emit.subscribe(
              EnsureIsForMe(this, msg => {
                switch (msg.type) {
                  case "mqtt.client.connected":
                    clearTimeout(connectTimer);
                    this.connected.next(true);
                    this.startQ();
                    break;
                  case 'mqtt.client.msg.sended':
                    this.nextQ(msg.txid);
                    break;
                  case "mqtt.client.end":
                  case "mqtt.client.error":
                  case "mqtt.client.offline":
                    clearTimeout(connectTimer);
                    this.connected.next(false);
                    if (this.config.reconnect) {
                      this.recv.next({
                        src: this.addr,
                        dst: this.addr,
                        txid: this.addr,
                        type: "mqtt.connector.add",
                        payload: this.config
                      });
                    }
                    break;
                }
              })
            );
            connectTimer = setTimeout(() => {
              this.stop();
              this.recv.next({
                src: this.addr,
                dst: this.addr,
                txid: this.addr,
                type: "mqtt.connector.add",
                payload: this.config
              });
            }, this.config.connectTimeout | 1000);
            break;
        }
      }),
      () => {
        this.stop();
        this.config = undefined;
        unsub.unsubscribe();
      },
      () => {
        this.stop();
        this.config = undefined;
        unsub.unsubscribe();
      }
    );
  }
}
