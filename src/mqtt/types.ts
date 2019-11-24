import { IClientOptions, IClientSubscribeOptions } from 'mqtt';
import { CONNECTING } from 'ws';
export interface MqttMsg {
  readonly topic: string;
  readonly message: string;
}

export interface MqttConfig {
  readonly clientId: string;
  readonly host: string;

  readonly port: number;
  readonly mqtt: IClientOptions,
  readonly sendTimeout: number;
  readonly connectTimeout: number;
  readonly reconnect: boolean;
}

export interface DefaultMqttConfig extends MqttConfig {
  readonly port: number | undefined;
  readonly mqtt: IClientOptions | undefined,
  readonly sendTimeout: number | undefined;
  readonly connectTimeout: number | undefined;
  readonly reconnect: boolean | undefined;
}

export function mqttConfig(config: DefaultMqttConfig): MqttConfig {
  return {
    ...config,
    port: config.port || 1883,
    mqtt: {
      clientId: config.clientId,
      ...config.mqtt
    },
    sendTimeout: config.sendTimeout || 1000,
    connectTimeout: config.connectTimeout || 1000,
    reconnect: (typeof config.reconnect === 'boolean' ? config.reconnect : true)
  };
}


export interface MqttSubscription {
  readonly topic: string;
  readonly option?: IClientSubscribeOptions
}