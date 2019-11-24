import { DeconzConnector } from './deconz/deconz-connector';
import { Subject } from 'rxjs';
import { Config, DeconzConfigs } from './config';
import * as winston from 'winston';
import * as fs from 'fs';
import { filter, map } from 'rxjs/operators';
import { MqttConnector } from './mqtt/mqtt-connector';
import uuid = require('uuid');

const log = winston.createLogger();
log.add(new winston.transports.Console({
  format: winston.format.simple()
}));

const config = new Subject<Config>();

const dzc = new DeconzConnector();

const mqtt = new MqttConnector();

const cfg: Config = JSON.parse(fs.readFileSync('./config.json').toString());
const my = `main.${uuid.v4()}`;
for (let deconzCfgKey in (cfg.deconzs || {})) {
  dzc.recv.next({
    src: my,
    dst: dzc.addr,
    txid: my,
    type: 'deconz.config.add',
    payload: cfg.deconzs[deconzCfgKey]
  });
}
for (let mqttCfgKey in (cfg.mqtts || {})) {
  mqtt.recv.next({
    src: my,
    dst: mqtt.addr,
    txid: my,
    type: 'mqtt.connector.add',
    payload: cfg.mqtts[mqttCfgKey]
  });
}

dzc.emit.subscribe(msg => {
  mqtt.recv.next({
    src: msg.src,
    dst: mqtt.addr,
    txid: my,
    type: 'mqtt.connector.msg',
    payload: {
      topic: ``,
      message: '' 
    }
  });
});

mqtt.emit.subscribe(msg => {
  dzc.recv.next({
    src: msg.src,
    dst: dzc.addr,
    txid: my,
    type: 'deconz.connector.msg',
    payload: {
      uhu: 'xx'
    }
  });
});
