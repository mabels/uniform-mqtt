import { Config } from './config';
import { Subject, BehaviorSubject, Observable } from 'rxjs';
import { map, filter } from 'rxjs/operators';
import * as _ from 'lodash';
import * as winston from 'winston';
import * as WebSocket from 'ws';

export interface MqttMsg {
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

export class MqttConnector {
  private config?: MqttConfig;
  public readonly connected = new BehaviorSubject(false); 
  public readonly receiver = new Subject<MqttMsg>();

  constructor(config: Observable<MqttConfig>, log: winston.Logger) {
    config
      .subscribe((mqttConfig: MqttConfig) => {
        if (_.isEqual(mqttConfig, this.config)) {
          log.info('Config Resend but no change required');
          return; 
        }
      });
  }


const client = mqtt.connect(`mqtt://${config.mqtt.host}:${config.mqtt.port}`, {
  keepalive: 10000,
  clientId: "deconz-to-mqtt",
  username: config.mqtt.username,
  password: config.mqtt.password
});

client.on('error', () => {
  console.log('MQTT connection failure or parsing error');
  mqttConnected = false;
});

client.on('offline', () => {
  console.log('MQTT going offline');
  mqttConnected = false;
});

client.on('connect', () => {
  console.log('MQTT Server connected');
  mqttConnected = true;
});

client.on('end', () => {
  console.log('MQTT shutdown');
  mqttConnected = false;
});

client.on('message', (topic,message) => {
  console.log('onMessageArrived:' + message.payloadString);
});

socket.on('open', () => {
  socket.on('message', data => {
    const sensorData = JSON.parse(data)
    const sensorId = sensorData.id;
    const sensor = config.sensors[sensorId];
    if (sensor === undefined) {
	    console.log(data);
      client.publish(`deconz/${sensorData.r}/${sensorData.id}/state`, JSON.stringify({
	      ...sensorData.state,
	      type: `${sensorData.event}-${sensorData.e}`,
	      id: sensorData.uniqueid
      }));
      return
    }

    const topic = `${sensor.topic}`
    const dataType = `${sensor.data}`
    const value = sensorData.state[dataType] / sensor.divisor;

    console.log(`topic: ${topic} data: ${value}`)

    if (mqttConnected) {
      client.publish(topic, `${value}`)
      console.log("data published");
    }
    else {
      console.log("mqtt not connected.");
    }
  });
});

socket.on('error', () => {
  console.log('something has gone wrong');
});

console.log('started');
}