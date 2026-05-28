// Local-only Supabase compatibility shim (no network requests).

type QueryResult<T = any> = Promise<{ data: T; error: any }>;

function ok<T = any>(data: T = [] as any): QueryResult<T> {
  return Promise.resolve({ data, error: null });
}

function makeBuilder(): any {
  const chain: any = {
    select: () => chain,
    insert: () => chain,
    update: () => chain,
    upsert: () => chain,
    delete: () => chain,
    eq: () => chain,
    neq: () => chain,
    in: () => chain,
    is: () => chain,
    ilike: () => chain,
    like: () => chain,
    gte: () => chain,
    lte: () => chain,
    gt: () => chain,
    lt: () => chain,
    or: () => chain,
    not: () => chain,
    order: () => chain,
    limit: () => chain,
    range: () => chain,
    maybeSingle: () => ok(null),
    single: () => ok(null),
    then: (resolve: any) => ok([]).then(resolve),
    catch: (reject: any) => ok([]).catch(reject),
    finally: (handler: any) => ok([]).finally(handler),
  };
  return chain;
}

export const supabase: any = {
  from: () => makeBuilder(),
  rpc: () => ok(null),
  channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
  removeChannel: () => undefined,
  auth: {
    getUser: async () => ({ data: { user: null }, error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
    signInWithPassword: async () => ({ data: { session: null, user: null }, error: new Error("Local auth only") }),
    signOut: async () => ({ error: null }),
    onAuthStateChange: (callback: any) => {
      callback?.("SIGNED_OUT", null);
      return { data: { subscription: { unsubscribe: () => undefined } } };
    },
  },
  storage: {
    from: () => ({
      upload: async () => ({ data: null, error: new Error("Storage disabled in local mode") }),
      download: async () => ({ data: null, error: new Error("Storage disabled in local mode") }),
      getPublicUrl: () => ({ data: { publicUrl: "" } }),
      remove: async () => ({ data: null, error: null }),
      list: async () => ({ data: [], error: null }),
    }),
  },
};
