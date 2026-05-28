import { getDb, getLocalSession } from "@/lib/localDb";

const noop = async () => ({ data: null, error: null });

function queryBuilder() {
  const chain: any = {
    select: () => chain,
    insert: async () => ({ data: null, error: null }),
    update: async () => ({ data: null, error: null }),
    delete: async () => ({ data: null, error: null }),
    upsert: async () => ({ data: null, error: null }),
    eq: () => chain,
    in: () => chain,
    is: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: async () => ({ data: null, error: null }),
    single: async () => ({ data: null, error: null }),
    then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
  };
  return chain;
}

export const supabase: any = {
  auth: {
    getSession: async () => ({ data: { session: getLocalSession() }, error: null }),
    getUser: async () => ({ data: { user: getDb().users.find((u: any) => u.id === getLocalSession()?.user_id) ?? null }, error: null }),
  },
  from: () => queryBuilder(),
  rpc: noop,
  channel: () => ({ on() { return this; }, subscribe() { return this; } }),
  removeChannel: () => {},
  storage: {
    from: () => ({
      createSignedUrl: async () => ({ data: null, error: null }),
      upload: async () => ({ data: null, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: "" } }),
      download: async () => ({ data: null, error: null }),
    }),
  },
};
