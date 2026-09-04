# Neuro-Symbolic Smart Contract Security Pipeline

A security assessment pipeline for DeFi lending protocols (currently Aave and Venus Protocol). For a given protocol and contract address, it produces a list of findings, each backed by two independent evidence sources: an LLM that reasons about the protocol's architecture and produces a confidence score, and a deterministic layer that executes real Foundry tests against a forked copy of the live blockchain and returns a hard pass/fail result.

The two sources are combined using Dempster-Shafer evidence theory rather than a simple average. A simple average would hide disagreement — if the LLM flags a high-confidence risk but the deterministic test shows the access control actually holds, an average just reports a misleading "medium" score. Dempster-Shafer fusion instead reports whether the two sources agreed, contradicted each other, or were both uncertain, so the output can say "AI and code disagree here" instead of quietly splitting the difference.

Output is a per-finding report: the risk in plain language, what each evidence source concluded, and the fused result.

## Architecture

The system has three independent parts that communicate over HTTP.

### The n8n workflow

The pipeline itself — a sequence of nodes running inside n8n. Each stage's prompt, schema, or code is a separate file in this repository, numbered by pipeline position (`06_...` through `19_...`). A few stage numbers (10, 11, 12, 14) have no file here because they're plain n8n nodes (HTTP Request, Merge, Set) with no custom code — those exist only on the n8n canvas. For the full node-by-node map, see `Node_Reference_and_Flowchart.docx` and `Workflow_Flowchart.png`.

Pipeline order:

1. Architecture reconstruction (06) — reconstructs how the protocol is wired together
2. LLM risk reasoning (07) — produces candidate findings and confidence scores
3. Audit/incident ingestion (08) — pulls in prior audit reports and known incidents
4. Historical exploit reasoning (09) — cross-references findings against past exploits
5. Deterministic evidence specification (13) — defines the fixed, falsifiable claims to check; this is where the finding taxonomy lives (Aave's F01-F11, Venus's six)
6. Foundry/Slither execution (10-12) — native HTTP nodes calling the FoundryBridge server
7. Evidence review (15) — checks the gathered evidence for consistency
8. Deterministic evidence anchoring (16) — classifies what the evidence establishes: SUPPORTED / CONTRADICTED / UNRESOLVED
9. Dempster-Shafer fusion (17) — combines the LLM and deterministic evidence
10. Calibration/grounding evaluation (18) — sanity-checks the fusion output
11. Report generation (19) — produces the final output

### FoundryBridge (this repository)

n8n can't run local binaries directly — it can only make HTTP calls. `server.js` is a small Express server that bridges that gap: n8n calls it, and it shells out to real Foundry/Slither binaries on whatever machine it's running on, then returns structured JSON. This repository is intentionally minimal — just the server and what it needs to run:

```
foundry-bridge/
├── server.js          the Express server — everything below is config for it
├── package.json        one dependency: express
├── package-lock.json
├── .env.example         copy to .env and fill in local paths (see Setup)
└── .gitignore
```

`server.js` exposes three endpoints:

| Endpoint | Body | Behavior |
|---|---|---|
| `POST /validate` | `{ protocol, contract_address, rpc_url }` | Runs a Foundry script (`ValidateProtocol.s.sol`, lives in the `foundry-validation` repo) to pull a protocol's core addresses, then independently re-queries several via `cast call` — e.g. confirming the address provider's `getACLManager()` actually returns the ACL Manager address found elsewhere. Returns architecture/wiring evidence. |
| `POST /validate-donation-attack` | `{ rpc_url }` | Runs a live `forge test` against `test/VenusDonationAttack.t.sol` (in `foundry-validation`) and classifies the result automatically. Currently the only finding with fully automated, re-executed-every-run behavioral evidence — see Known Limitations below. |
| `POST /slither` | `{ filePath }` | Runs Slither static analysis on a contract file. |

### foundry-validation (separate repository)

The actual Foundry project — every validator contract and behavioral test the pipeline relies on. `server.js` above calls into this project; it doesn't contain any logic of its own.

```
foundry-validation/
├── foundry.toml, foundry.lock      Foundry project config
├── script/
│   └── ValidateProtocol.s.sol       the recon script /validate runs
├── src/
│   ├── validators/
│   │   ├── BaseValidator.sol        shared base contract
│   │   ├── AaveValidator.sol
│   │   ├── VenusValidator.sol
│   │   └── CompoundValidator.sol    reads each protocol's core on-chain state
│   ├── interfaces/                  IAavePool, IAddressesProvider, IComptroller, IPoolValidator, IVToken
│   └── models/
│       └── ValidationResult.sol
├── test/                             one .t.sol file per finding -- see below
└── lib/forge-std/                    dependency, committed as plain files (no forge install needed)
```

`test/` is where the actual evidence gets generated — each file is a self-contained Foundry test encoding one specific, falsifiable claim, executed against a forked copy of the real chain:

- **Aave** (11 files, one per finding F01–F11): `AaveUpgradeableProxyControl`, `AaveRegistryCentralisation`, `AaveACLManagerRoleConcentration`, `AavePoolConfiguratorAuthority`, `AaveUmbrellaDeficitAuthority`, `AaveOracleDependency`, `AaveATokenImplementationCustody`, `AaveInterestRateStrategyExternalization`, `AaveFlashloanReceiverComposability`, `AavePositionManagerTrustBoundary`, `AaveReserveRegistryDependency`
- **Venus** (4 files): `VenusAccessControl`, `VenusComptrollerDependency`, `VenusDonationAttack`, `VenusInterestAccrual`
- **Compound** (5 files): `CompoundUpgradeableProxyControl`, `CompoundReserveFactorAccessControl`, `CompoundDonationAttack`, `CompoundPauseGuardianDeprecation`, `CompoundInterestAccrual`

Each of these maps to one finding in the pipeline's taxonomy — the naming is deliberate, `AaveOracleDependency.t.sol` tests exactly the finding Node 13 calls F06, for example. If a new finding is added to the pipeline's taxonomy for any protocol, the corresponding test file is what needs writing next.

## Audit repository (referenced by the workflow, not committed to either repo)

Four nodes in the audit branch read PDFs from a local folder that is **not** in this repository or in `foundry-validation`, and is not created by any setup step. If you import the workflow and run it as-is, those nodes fail — the folder simply won't exist on your machine. This is the gap behind `13_Read_Selected_Audit`.

The branch runs as a five-node chain:

| Node | Type | What it does |
|---|---|---|
| `11_Audit_Repository_Resolver` | Code | Builds the folder path for this protocol's audit corpus: `C:\Users\Sathya\.n8n-files\AuditRepository\<protocol>`. **The path is hardcoded** — see below. |
| `11.1_Discover_Audits` | Read/Write Files | Globs `<repository>/*.pdf` and returns *every* audit PDF in that folder. |
| `12_Audit_Selection_Policy` | Code | Sorts the discovered files by a `DD-MM-YYYY` prefix in the filename, newest first, and selects the newest one. Emits `auditPath` only. |
| `13_Read_Selected_Audit` | Read/Write Files | Re-reads that one selected file from disk. |
| `14_Extract_Audit_Text` | Extract from File (pdf) | Converts the selected PDF to text for the downstream agent. |

**Why `13_Read_Selected_Audit` exists at all** (this is the question that keeps coming up): `12_Audit_Selection_Policy` is a Code node, and n8n Code nodes return JSON only — they drop the binary payloads that `11.1_Discover_Audits` attached to each discovered file. So by the time the policy has decided *which* audit to use, the file's bytes are gone and only a path string remains. Node 13 reads that single file back off disk to restore the binary, which is what the PDF text extractor needs. In short: 11.1 reads all of them, 12 decides which one, 13 fetches that one properly.

It could be collapsed away by doing the newest-first selection with Sort/Limit nodes (which preserve binary) instead of a Code node. It's kept as a Code node because the selection policy is then explicit and readable — "which audit did this run actually use, and why that one" is auditable rather than implied by node settings.

### What you need to create locally

```
<your-folder>/
├── Aave/
│   └── DD-MM-YYYY <name>.pdf
├── Venus/
│   └── DD-MM-YYYY <name>.pdf
└── Compound/
    └── DD-MM-YYYY <name>.pdf
```

- The subfolder name must exactly match the `protocol` value set in `02_Contract_Configuration` (`Aave`, `Venus`, `Compound`).
- Filenames **must** start with `DD-MM-YYYY`. `12_Audit_Selection_Policy` parses that prefix to pick the newest report; any file without it is treated as the oldest and effectively never selected.
- The PDFs themselves are third-party audit reports. They are not committed here — decide deliberately whether redistributing them is appropriate before adding them to any public repo, rather than committing them by default.

`11_Audit_Repository_Resolver` currently hardcodes an absolute Windows path tied to one machine. Before this runs anywhere else, that line should read from an environment variable or an n8n variable, the same way `server.js` already takes its paths from `.env`. Until then it must be edited by hand per machine.

### There are two independent audit sources, and they feed different agents

Worth knowing before you assume the local PDF corpus is the audit path:

| Source | How it's obtained | Where it goes |
|---|---|---|
| Local PDF corpus | The five-node chain above | Aave: `15_Evidence_Review_Agent` → `18_Deterministic_Ground_Truth`. Compound: `15_AI_Audit_Intelligence` → a side chain that terminates before the main spine. |
| Remote fetch | A single HTTP Request node, no local files | `08_AI_AUDIT` / `08_AI_Audit_Agent` — this is what actually produces the audit findings the pipeline fuses. |

The remote URLs are already in the workflow and need no setup:

- Aave — `https://raw.githubusercontent.com/aave-dao/aave-v3-origin/main/audits/2024-10-22_StErMi_Aave-v3.3.md`
- Venus — `https://api.github.com/repos/code-423n4/2023-05-venus-findings/issues/220`
- Compound — `https://www.openzeppelin.com/news/compound-audit`

So the audit ingestion is **not** a single path, and the local corpus is not what feeds `08_AI_AUDIT`. If a write-up describes audit ingestion as one pipeline, that should be corrected. For Aave the local corpus does reach the main spine (via the Evidence Review Agent); for Compound its branch terminates without rejoining. Whether that Compound wiring is intended is worth confirming before anything is built on top of it.

## Known limitations

Most current Foundry behavioral results are not re-executed on every pipeline run. They were run once, by hand, and the result was recorded in a lookup table in Node 13's code (`AAVE_MANUAL_FOUNDRY_SNAPSHOT` / `MANUAL_FOUNDRY_SNAPSHOT`), keyed by finding ID. Node 13 checks that table first and only reports "not tested" if a finding isn't in it.

The exception is the Venus donation-attack test, which genuinely re-runs and re-verdicts on every call to `/validate-donation-attack`.

This matters for anything built on top of the pipeline: "run" currently means a live test only for the architecture/wiring checks and the donation-attack finding. The rest of the behavioral evidence reflects a snapshot recorded in mid-August 2026. Closing this gap means wiring the remaining tests into live endpoints, following the same pattern already used for the donation-attack one.

The Historical Exploit Reasoning node (09) is designed to propagate `finding_id`/`canonical_finding_id` from its input findings, so that a future node could join historical precedent to a specific architectural finding by ID — see the comment on `historicalContext` in Node 13's source. Nothing does this today: Node 13 preserves the Historical node's output wholesale for context only, and the Fusion Engine averages its confidence scores across the whole array without regard to which finding each one belongs to. This makes the gap currently harmless where it shows up: for Compound, the upstream Architecture Risk Assessment node never emits a `finding_id` in the first place (only `risk_name`), so the Historical node has nothing to copy and falls back to using the risk name as its identifier — Aave's equivalent output does carry `canonical_finding_id`, since its upstream node emits one. If a future node is ever built that needs to join historical evidence to a specific finding by ID, both halves of this need fixing together — the missing upstream `finding_id` for Compound, and the Historical node's silent name-based fallback — rather than patching either one in isolation now, before anything actually depends on it.

## Integration: what's missing

There's currently no single HTTP entry point for "run a full assessment on protocol X, contract Y" — the n8n workflow starts manually inside n8n.

To expose it:

1. Add a Webhook trigger node as the first node in the workflow, replacing the manual trigger.
   - Method: `POST`
   - Suggested path: `/run-assessment`
   - Input: `{ "protocol": "Aave" | "Venus Protocol", "contract_address": "0x...", "rpc_url": "https://..." }`
2. Set the webhook's response mode to "Last Node" (or add a "Respond to Webhook" node after the report generator) so the caller gets the final report in one round trip.
3. Add a shared-secret header check on the webhook if it will be reachable outside localhost.
4. Decide on the runtime model. A full run involves multiple LLM calls plus real Foundry/Slither execution — expect tens of seconds, not sub-second responses. Either the caller waits synchronously, or the webhook returns an execution ID immediately and a separate endpoint is polled for completion.
5. Make sure the FoundryBridge server is running and reachable from n8n. `server.js` reads its paths and port from environment variables, so it isn't tied to one machine's folder layout — but it still needs to be a running process, reachable over the network if n8n runs elsewhere.
6. Configure credentials in n8n: RPC URLs for Ethereum mainnet and BNB Chain, plus LLM provider credentials for the AI Agent nodes.

## Response shape

The exact output is defined by the report generator nodes — `19_report_generator.js`, `19_report_generator_aave_investor.js`, `19_report_generator_venus_investor.js` — which have protocol-specific variants; read those directly for exact field names.

In general, expect a list of findings, each with a plain-language description, the LLM's independent assessment, the deterministic assessment (pass / fail / not tested), and the fused result (supported / contradicted / unresolved, plus a confidence figure). The disagreement signal between evidence sources is a deliberate part of the output and worth surfacing directly rather than collapsing into one number.

## Setup

1. Install Foundry:
   ```
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```
2. Clone both repositories — `foundry-validation` and `foundry-bridge`. `foundry-validation`'s dependencies are committed as regular files, so no `forge install` or submodule step is needed; it should build immediately.
3. From inside `foundry-validation`, confirm the build:
   ```
   forge build
   ```
4. From inside `foundry-bridge`, install dependencies:
   ```
   npm install
   ```
5. Copy `.env.example` to `.env` and fill in local values: the path to `foundry-validation`, the paths to the `forge`/`cast` binaries (`which forge` / `where forge`), and RPC URLs for Ethereum mainnet and BNB Chain.
6. Start the server:
   ```
   node server.js
   ```
   Confirm it works end to end:
   ```
   curl -X POST http://localhost:3000/validate \
     -H "Content-Type: application/json" \
     -d '{"protocol":"Aave","contract_address":"0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2","rpc_url":"<your Ethereum RPC URL>"}'
   ```
   A JSON response means the server is correctly running Foundry locally.
7. Export the n8n workflow (Workflow menu → Download in the n8n UI) and import it into a local n8n instance. Point its HTTP Request nodes at the local FoundryBridge server.
8. Add credentials in n8n: the LLM provider API key for the AI Agent nodes, and the RPC URLs from step 5.
9. Create the audit repository folder and edit the hardcoded path — see "Audit repository" above. This folder is not in either repo and is not created by any step above, so the audit branch (`11_Audit_Repository_Resolver` through `14_Extract_Audit_Text`) will fail until you create it and update the path in `11_Audit_Repository_Resolver`. The rest of the pipeline, including the `08_AI_AUDIT` agent that produces the audit findings actually used in fusion, does not depend on this folder.

Steps 1-6 are fully self-contained. Steps 7-9 connect the execution layer to the reasoning/fusion side of the pipeline.

## Rollout plan

1. Export and share the n8n workflow JSON.
2. Confirm the `/validate` call in setup step 6 succeeds — this proves the execution layer works independently.
3. Decide whether the manual Foundry snapshot (see Known Limitations) is acceptable for a first integration, or should be closed first.
4. Add the Webhook trigger node and agree the input/output contract before building against it.
5. Run one full end-to-end test — webhook in, report out — before wiring it into a production interface.
