export function getRequest() {
  return typeof window === "undefined" ? undefined : null;
}
