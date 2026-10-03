export function integrationPort(applicationPort: number): number {
  const configured = process.env.TAVRYN_INTEGRATION_PORT?.trim();
  const port = configured ? Number(configured) : applicationPort + 1;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("TAVRYN_INTEGRATION_PORT must be a valid TCP port");
  }
  return port;
}
