export async function requireLocalAuth() {
  return { userId: "local_user", role: "admin" };
}
