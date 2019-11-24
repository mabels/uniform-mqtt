export interface DeconzMsg {
  uhu: string;
}

export interface DeconzConfig {
  readonly id: string;
  readonly host: string;
  readonly port?: number;
  readonly reconnectBackoff?: number;
  readonly connTimeout?: number;
}
