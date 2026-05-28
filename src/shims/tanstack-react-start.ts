import { useCallback } from "react";

type AnyFn = (...args: any[]) => any;

export function createServerFn(_opts?: any) {
  return {
    validator() {
      return this;
    },
    handler(fn: AnyFn) {
      return fn;
    },
  };
}

export function useServerFn<T extends AnyFn>(fn: T): T {
  return useCallback(((...args: any[]) => fn(...args)) as T, [fn]);
}

export function createMiddleware(_opts?: any) {
  return {
    client(fn: AnyFn) {
      return fn;
    },
    server(fn: AnyFn) {
      return fn;
    },
  };
}

export function createStart(factory: AnyFn) {
  return factory();
}
