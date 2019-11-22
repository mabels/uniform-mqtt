import { DeconzConfig } from './deconz-connector';
import { MqttConfig } from './mqtt-connector';

export type MqttConfigs = { [id: string]: MqttConfig };
export interface Config {
  readonly deconz?: DeconzConfig;
  readonly mqtts?: MqttConfigs;
}
