// Derive local API hosts from the Metro connection, not a saved Wi-Fi address.
export function serverHost(
  hostUri: string | undefined,
  platform: string,
): string {
  if (!hostUri) return platform === "android" ? "10.0.2.2" : "localhost";
  try {
    const host = new URL(
      hostUri.includes("://") ? hostUri : `http://${hostUri}`,
    ).hostname;
    if (
      platform === "android" &&
      (host === "localhost" || host === "127.0.0.1")
    )
      return "10.0.2.2";
    return host;
  } catch {
    return platform === "android" ? "10.0.2.2" : "localhost";
  }
}
