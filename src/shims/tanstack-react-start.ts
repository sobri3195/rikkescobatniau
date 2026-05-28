import { useCallback } from "react";

type AnyFn = (...args: any[]) => any;

type ServerFnBuilder<TInput = unknown> = {
  middleware: (_middleware: unknown[]) => ServerFnBuilder<TInput>;
  validator: (validator: (value: unknown) => TInput) => ServerFnBuilder<TInput>;
  inputValidator: (validator: (value: unknown) => TInput) => ServerFnBuilder<TInput>;
  handler: <TReturn>(fn: (payload: { data: TInput; context: Record<string, never> }) => TReturn) => AnyFn;
};

export function createServerFn(_opts?: any): ServerFnBuilder {
  let validate: ((value: unknown) => unknown) | undefined;

  return {
    middleware() {
      return this;
    },
    validator(validator) {
      validate = validator;
      return this;
    },
    inputValidator(validator) {
      validate = validator;
      return this;
    },
    handler(fn) {
      return (input: unknown) => {
        const data = validate ? validate(input) : input;
        return fn({ data, context: {} });
      };
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
