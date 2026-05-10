export function buildSessionUrl(currentUrl: string, sessionId: string) {
  const base = "http://localhost";
  const resolved = new URL(currentUrl || "/", base);
  resolved.searchParams.set("session", sessionId);

  const pathname = resolved.pathname || "/";
  const search = resolved.searchParams.toString();
  const hash = resolved.hash || "";

  return `${pathname}${search ? `?${search}` : ""}${hash}`;
}
