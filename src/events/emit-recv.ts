import { SubjectLike } from './subject-like';
import { Msg, MsgCb, TypeCb } from './msg';
import { LogWarn, LogEmitMsg } from './log';

export interface EmitRecv<E = unknown, R = unknown, SE = SubjectLike<E>, SR = SubjectLike<R>> {
  readonly addr: string;
  readonly emit: SE;
  readonly recv: SR;
}

export function EnsureIsForMe<
  E extends Msg<TE, M>,
  R extends Msg<TR, M>,
  TE = unknown,
  TR = unknown,
  M = string>(e: EmitRecv<E, R>, cb: TypeCb<E | R>) {
  return function (msg: E | R) {
    if (msg.dst !== this.addr) {
      LogWarn(this, `Is not for me:${msg.dst}:${this.addr}`, msg);
      return;
    }
    cb(msg);
  };
}
