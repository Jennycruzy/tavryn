import { loadConfig } from "./config.js";
import { startTavrynServer } from "./server.js";
import { TavrynService } from "./tavryn-service.js";

interface JsonResponse {
  status: number;
  body: Record<string, any>;
}

const config = loadConfig();
const integrationPort = integrationServerPort(config.httpPort);
const server = await startTavrynServer(new TavrynService(config), integrationPort);
const baseUrl = `http://127.0.0.1:${integrationPort}`;

try {
  const rules = await post("/api/v1/setup/rules", { maxAdvanceRate: "0.95" });
  const committee = await post("/api/v1/governance/committee", {
    networkRulesCid: contractId(rules, "NetworkRules"),
    threshold: String(config.governance.threshold ?? 2),
  });
  const committeeCid = contractId(committee, "GovernanceCommittee");
  const proposal = await post(
    `/api/v1/governance/committees/${encodeURIComponent(committeeCid)}/admissions`,
    { operatorIndex: "1" },
  );
  const proposalCid = contractId(proposal, "FinancierAdmissionProposal");
  const voteOne = await post(
    `/api/v1/governance/admissions/${encodeURIComponent(proposalCid)}/confirm`,
    { operatorIndex: "1" },
  );
  const belowThreshold = await post(
    `/api/v1/governance/admissions/${encodeURIComponent(proposalCid)}/execute`,
    { voteContractIds: [contractId(voteOne, "GovernanceVote")] },
  );

  const voteTwo = await post(
    `/api/v1/governance/admissions/${encodeURIComponent(proposalCid)}/confirm`,
    { operatorIndex: "2" },
  );
  const admitted = await post(
    `/api/v1/governance/admissions/${encodeURIComponent(proposalCid)}/execute`,
    {
      voteContractIds: [
        contractId(voteOne, "GovernanceVote"),
        contractId(voteTwo, "GovernanceVote"),
      ],
    },
  );
  const newRules = created(admitted, "NetworkRules");

  assert(
    belowThreshold.status === 409 &&
      belowThreshold.body.code === "GOVERNANCE_THRESHOLD_NOT_MET",
    "One vote did not produce the expected governance threshold rejection",
  );
  assert(admitted.status === 200, "The configured governance threshold did not execute");
  assert(
    newRules?.createArgument?.members?.includes(config.governance.candidatePartyId),
    "The admitted candidate is missing from the replacement NetworkRules contract",
  );

  console.log(
    JSON.stringify(
      {
        threshold: config.governance.threshold ?? 2,
        candidatePartyId: config.governance.candidatePartyId,
        belowThreshold: {
          status: belowThreshold.status,
          code: belowThreshold.body.code,
          submissionReference: belowThreshold.body.submissionReference,
        },
        admitted: {
          status: admitted.status,
          updateId: admitted.body.updateId,
          offset: admitted.body.offset,
          replacementRulesContractId: newRules?.contractId,
          members: newRules?.createArgument?.members,
        },
      },
      null,
      2,
    ),
  );
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

async function post(path: string, body: Record<string, unknown>): Promise<JsonResponse> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    body: (await response.json()) as Record<string, any>,
  };
}

function created(response: JsonResponse, templateName: string): any | undefined {
  return response.body.createdContracts?.find((event: any) =>
    String(event.templateId).includes(templateName),
  );
}

function contractId(response: JsonResponse, templateName: string): string {
  const event = created(response, templateName);
  if (!event?.contractId) {
    throw new Error(`No ${templateName} was created: ${JSON.stringify(response.body)}`);
  }
  return event.contractId;
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function integrationServerPort(applicationPort: number): number {
  const configured = process.env.TAVRYN_GOVERNANCE_INTEGRATION_PORT?.trim();
  const port = configured ? Number(configured) : applicationPort + 1;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("TAVRYN_GOVERNANCE_INTEGRATION_PORT must be a valid TCP port");
  }
  return port;
}
