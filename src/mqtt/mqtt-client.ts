import { Msg } from "../events/msg";
import { MqttMsg, MqttConfig, MqttSubscription } from "./types";
import { EmitRecv, EnsureIsForMe, LogEmitMsg } from "../events";
import * as uuid from "uuid";
import * as mqtt from "mqtt";
import { Subject } from "rxjs";
import { timingSafeEqual } from 'crypto';
import { ISubscriptionGrant } from 'mqtt';

export type MqttClientEmitMsg =
  | Msg<Error, "mqtt.client.error">
  | Msg<undefined, "mqtt.client.end">
  | Msg<undefined, "mqtt.client.offline">
  | Msg<MqttMsg, "mqtt.client.message">
  | Msg<{
    readonly error?: Error, 
    readonly packet?: mqtt.Packet
  }, "mqtt.client.msg.sended">
  | Msg<undefined, "mqtt.client.connected">
  | Msg<{
    readonly err?: Error, 
    readonly granted: ISubscriptionGrant[]
  }, "mqtt.client.subscribed">
  | LogEmitMsg;

export type MqttClientRecvMsg = 
    Msg<MqttMsg, 'mqtt.client.msg.send'>
  | Msg<MqttSubscription, 'mqtt.client.subscribe'>
  | Msg<undefined, "mqtt.client.stop">;


export class MqttClient
  implements EmitRecv<MqttClientEmitMsg, MqttClientRecvMsg> {

  private client?: mqtt.Client;

  public readonly addr = `mqtt.client.${uuid.v4()}`;
  public readonly emit = new Subject<MqttClientEmitMsg>();
  public readonly recv = new Subject<MqttClientRecvMsg>();

  constructor(public readonly config: MqttConfig) {
    const unsub = this.recv.subscribe(
      EnsureIsForMe(this, msg => {
        switch (msg.type) {
          case "mqtt.client.stop":
            this.client && this.client.end(true);
            unsub.unsubscribe();
            break;
          case 'mqtt.client.subscribe': 
            this.client.subscribe(msg.payload.topic, msg.payload.option, (err, granted) => {
              this.emit.next({
                src: this.addr,
                dst: msg.src,
                txid: msg.txid,
                type: 'mqtt.client.subscribed',
                payload: { err, granted }
              })
            })
            break;
          case 'mqtt.client.msg.send':
            this.client && this.client.publish(
                msg.payload.topic,
                msg.payload.message
            , (error, packet) => {
              this.emit.next({
                src: this.addr,
                dst: msg.src,
                txid: msg.txid,
                type: 'mqtt.client.msg.sended',
                payload: { error, packet }
              });
            });
            break;
        }
      })
    );
  }

  // public stop() {
  // }



  public start() {
    this.client = mqtt.connect(
      `mqtt://${this.config.host}:${this.config.port}`, this.config.mqtt);

    this.client.on("error", e => {
      this.emit.next({
        src: this.addr,
        dst: "*",
        type: "mqtt.client.error",
        txid: this.addr,
        payload: e
      });
    });

    this.client.on("offline", () => {
      this.emit.next({
        src: this.addr,
        dst: "*",
        type: "mqtt.client.offline",
        txid: this.addr,
        payload: undefined
      });
    });

    this.client.on("connect", () => {
      this.emit.next({
        src: this.addr,
        dst: "*",
        type: "mqtt.client.connected",
        txid: this.addr,
        payload: undefined
      });
    });

    this.client.on("end", () => {
      this.emit.next({
        src: this.addr,
        dst: "*",
        type: "mqtt.client.end",
        txid: this.addr,
        payload: undefined
      });
    });

    this.client.on("message", (topic, message) => {
      this.emit.next({
        src: this.addr,
        dst: "*",
        type: "mqtt.client.message",
        txid: this.addr,
        payload: { topic, message: message.toString() }
      });
    });
    return this;
  }
}
