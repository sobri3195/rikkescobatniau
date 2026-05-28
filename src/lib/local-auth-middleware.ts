export async function requireSupabaseAuth() {
  return { userId: "local_user", role: "admin" };
}
