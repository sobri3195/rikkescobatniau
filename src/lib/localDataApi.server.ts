const chain: any = {
  select: () => chain,
  insert: () => chain,
  update: () => chain,
  delete: () => chain,
  eq: () => chain,
  in: () => chain,
  is: () => chain,
  order: () => chain,
  limit: () => chain,
  maybeSingle: async () => ({ data: null, error: null }),
  single: async () => ({ data: null, error: null }),
  then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
};
export const localAdminApi: any = {
  from: () => chain,
  auth: { admin: {} },
  storage: { from: () => ({}) },
  rpc: async () => ({ data: null, error: null }),
};
