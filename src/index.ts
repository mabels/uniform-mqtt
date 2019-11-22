import * as mqtt from 'mqtt';
import { DeconzConnector } from './deconz-connector';
import { Subject } from 'rxjs';
import { Config } from './config';
import * as winston from 'winston';
import * as fs from 'fs';
import { filter, map } from 'rxjs/operators';

const log = winston.createLogger();
log.add(new winston.transports.Console({
  format: winston.format.simple()
}));

const config = new Subject<Config>();

const dzc = new DeconzConnector(config
    .pipe(filter(c => !!c.deconz))
    .pipe(map(c => c.deconz)), log);

const mqtt = new MqttConnector(config
    .pipe(filter(c => !!c.mqtt))
    .pipe(map(c => c.mqtt)), log);

config.next(JSON.parse(fs.readFileSync('./config.json').toString()));

// const config = require('./config.json');
var mqttConnected = false;

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