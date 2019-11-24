export interface EPNext<T> {
  readonly addr: string;
  next(msg: T): void;
}