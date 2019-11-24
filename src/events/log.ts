import { DstTransaction, SrcTransaction } from './msg';
import { Msg } from './msg';
import uuid = require('uuid');
import { EmitRecv } from './emit-recv';


export interface LogOptionsOptional {
  readonly dst?: string;
  readonly transaction?: string;
}

export interface LogOptions {
  readonly dst?: string;
  readonly transaction?: string;
}

function buildDstAndTransaction(msg?: SrcTransaction): LogOptions {
  return {
    dst: (msg && msg.src) || '*',
    transaction: (msg && msg.txid) || uuid.v4()
  };
}

export type LogEmitMsg = 
    Msg<string, 'log.warn'> 
  | Msg<string, 'log.info'>
  | Msg<string, 'log.error'>;

export function LogWarn<E extends LogEmitMsg, R>(e: EmitRecv<E, R>, msg: string, srcMsg?: SrcTransaction) {
  e.emit.next({
    src: e.addr,
    ...buildDstAndTransaction(srcMsg),
    type: 'log.warn',
    payload: msg
  } as unknown as E);
}

export function LogInfo<E extends LogEmitMsg, R>(e: EmitRecv<E, R>, msg: string, srcMsg?: SrcTransaction) {
  e.emit.next({
    src: e.addr,
    ...buildDstAndTransaction(srcMsg),
    type: 'log.info',
    payload: msg
  } as unknown as E);
}

export function LogError<E extends LogEmitMsg, R>(e: EmitRecv<E, R>, msg: string, srcMsg?: SrcTransaction) {
  e.emit.next({
    src: e.addr,
    ...buildDstAndTransaction(srcMsg),
    type: 'log.error',
    payload: msg
  } as unknown as E);
}
