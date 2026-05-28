const chain: any = {
  select: () => chain,
  insert: async () => ({ data: null, error: null }),
  update: async () => ({ data: null, error: null }),
  delete: async () => ({ data: null, error: null }),
  eq: () => chain,
  in: () => chain,
  is: () => chain,
  order: () => chain,
  limit: () => chain,
  maybeSingle: async () => ({ data: null, error: null }),
  single: async () => ({ data: null, error: null }),
};
export const supabaseAdmin: any = { from: () => chain, auth: { admin: {} }, storage: { from: () => ({}) }, rpc: async () => ({ data: null, error: null }) };
