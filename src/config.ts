import { DeconzConfig } from './deconz';
import { MqttConfig } from './mqtt';

export type MqttConfigs = { [id: string]: MqttConfig };
export type DeconzConfigs = { [id: string]: DeconzConfig };
export interface Config {
  readonly deconzs: DeconzConfigs;
  readonly mqtts: MqttConfigs;
}
