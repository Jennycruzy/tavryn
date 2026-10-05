import type { TavrynConfig } from "./config.js";

export async function createDemoSession(
  baseUrl: string,
  config: TavrynConfig,
): Promise<string | undefined> {
  if (!config.demoAccessToken) return undefined;
  const response = await fetch(`${baseUrl}/api/v1/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passphrase: config.demoPassphrase ?? config.demoAccessToken }),
  });
  if (!response.ok) {
    throw new Error(`Could not start the Tavryn demo session (HTTP ${response.status})`);
  }
  const setCookie = response.headers.get("set-cookie");
  const cookie = setCookie?.split(";", 1)[0];
  if (!cookie) throw new Error("Tavryn did not return a demo session cookie");
  return cookie;
}

export function sessionHeaders(cookie: string | undefined): Record<string, string> {
  return cookie ? { Cookie: cookie } : {};
}
