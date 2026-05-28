import { createMiddleware } from '@/shims/tanstack-react-start'

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  return next({
    context: {
      supabase: null,
      userId: 'local_user',
      claims: {},
    },
  });
});
