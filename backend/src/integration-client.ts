import { loadConfig } from "./config.js";
import { createDemoSession, sessionHeaders } from "./integration-auth.js";
import { integrationPort } from "./integration-port.js";
import { startTavrynServer, stopTavrynServer } from "./server.js";
import { TavrynService } from "./tavryn-service.js";

export interface JsonResponse {
  status: number;
  body: Record<string, any>;
}

// Runs a Tavryn server in-process on the integration port and talks to it over HTTP,
// exactly as the UI does. Nothing here replaces the ledger or the wallet.
export async function startIntegration() {
  // The harnesses check the contract rules with typed references as well as real coins.
  process.env.TAVRYN_ALLOW_PAYMENT_REFERENCES ??= "true";
  const config = loadConfig();
  let service = new TavrynService(config);
  const port = integrationPort(config.httpPort);
  let server = await startTavrynServer(service, port);
  const baseUrl = `http://127.0.0.1:${port}`;
  const cookie = await createDemoSession(baseUrl, config);

  async function request(method: string, path: string, body?: unknown): Promise<JsonResponse> {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...sessionHeaders(cookie) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: (await response.json()) as Record<string, any> };
  }

  return {
    config,
    get service() {
      return service;
    },
    post: (path: string, body: Record<string, unknown> = {}) => request("POST", path, body),
    get: (path: string) => request("GET", path),
    // Simulates a process restart: a fresh service and server with no in-memory state.
    async restart() {
      await stopTavrynServer(server);
      service = new TavrynService(config);
      server = await startTavrynServer(service, port);
    },
    stop: () => stopTavrynServer(server),
  };
}

export function created(response: JsonResponse, entity: string): any | undefined {
  return response.body.createdContracts?.find((event: any) =>
    String(event.templateId).endsWith(`:${entity}`),
  );
}

export function contractId(response: JsonResponse, entity: string): string {
  const event = created(response, entity);
  if (!event?.contractId) {
    throw new Error(`No ${entity} was created: ${JSON.stringify(response.body)}`);
  }
  return event.contractId;
}

export function templates(response: JsonResponse): string[] {
  return (response.body.contracts ?? []).map((contract: any) =>
    String(contract.templateId).split(":").slice(1).join(":"),
  );
}

export function hasTemplate(response: JsonResponse, entity: string): boolean {
  return templates(response).some((template) => template.endsWith(`:${entity}`));
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function uniqueInvoiceNumber(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}
