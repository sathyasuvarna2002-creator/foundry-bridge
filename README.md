# Neuro-Symbolic Smart Contract Security Pipeline

A security assessment pipeline for DeFi lending protocols (Aave, Compound V2 and Venus Protocol). For a given protocol and contract address, it produces a list of findings, each backed by two independent evidence sources: an LLM that reasons about the protocol's architecture and produces a confidence score, and a deterministic layer that executes real Foundry tests against a forked copy of the live blockchain and returns a hard pass/fail result.

The two sources are combined using Dempster-Shafer evidence theory rather than a simple average. A simple average would hide disagreement — if the LLM flags a high-confidence risk but the deterministic test shows the access control actually holds, an average just reports a misleading "medium" score. Dempster-Shafer fusion instead reports whether the two sources agreed, contradicted each other, or were both uncertain, so the output can say "AI and code disagree here" instead of quietly splitting the difference.

Output is a per-finding report: the risk in plain language, what each evidence source concluded, and the fused result.

This repository is the artefact underlying the MSc AI in Business Independent Research Project *"Combining AI-Generated Probabilistic Reasoning with Deterministic Evidence for Smart-Contract Risk Assessment"* (Sathya Suvarna, ChainMill / KOVA Dimension 1, 2026).

## Repository contents

```
foundry-bridge/
├── server.js                        the Express bridge server (see below)
├── package.json, package-lock.json
├── .env.example                     copy to .env and fill in local paths
├── 06_..._19_...                    one file per n8n pipeline stage: prompts (.md),
│                                     JSON schemas (.json), and Code-node logic (.js),
│                                     numbered by pipeline position -- versioned as they
│                                     evolved (v2, v3, _claimid, _FIXED, etc.)
├── ERA_*, historical_intelligence_*  earlier-named variants of the same stage files,
│                                     kept for the version history
├── n8n_workflows/                   full workflow exports (Aave, Compound, Venus) --
│                                     import directly into n8n
├── reports/                         example generated investor-facing reports (HTML)
│                                     and the assessment report used in the dissertation
├── Pipeline_Diagram*.png,
│   Workflow_Flowchart.png,
│   Research_Workflow_Diagram.png    architecture diagrams
├── DS_vs_Average_Baseline_Comparison.xlsx
│                                     naive-averaging vs Dempster-Shafer baseline comparison
├── Top10_Smart_Contract_Attacks.xlsx
├── Deterministic_Evidence_Fusion_Engine*.js
│                                     the actual D-S fusion implementation
└── AuditRepository/                 third-party audit PDFs -- gitignored, not pushed
                                      (see Known Limitations / audit repository below)
```

The companion repository, `foundry-validation`, holds the actual Solidity validators and Foundry tests this server calls into: **https://github.com/sathyasuvarna2002-creator/foundry-validation**

## Architecture

The system has three independent parts that communicate over HTTP.

### The n8n workflow

The pipeline itself — a sequence of nodes running inside n8n. Each stage's prompt, schema, or code is a separate file in this repository, numbered by pipeline position (`06_...` through `19_...`). A few stage numbers (10, 11, 12, 14) have no file here because they're plain n8n nodes (HTTP Request, Merge, Set) with no custom code — those exist only on the n8n canvas. Full workflow exports are in `n8n_workflows/`; for the node-by-node map, see `Node_Reference_and_Flowchart.docx` and `Workflow_Flowchart.png`.

Pipeline order:

1. Architecture reconstruction (06) — reconstructs how the protocol is wired together
2. LLM risk reasoning (07) — produces candidate findings and confidence scores
3. Audit/incident ingestion (08) — pulls in prior audit reports and known incidents
4. Historical exploit reasoning (09) — cross-references findings against past exploits
5. Deterministic evidence specification (13) — defines the fixed, falsifiable claims to check; this is where the finding taxonomy lives (Aave's F01-F11, Venus's six, Compound's three)
6. Foundry/Slither execution (10-12) — native HTTP nodes calling the FoundryBridge server
7. Evidence review (15) — checks the gathered evidence for consistency
8. Deterministic evidence anchoring (16) — classifies what the evidence establishes: SUPPORTED / CONTRADICTED / UNRESOLVED
9. Dempster-Shafer fusion (17) — combines the LLM and deterministic evidence
10. Calibration/grounding evaluation (18) — sanity-checks the fusion output
11. Report generation (19) — produces the final output

### FoundryBridge (this repository)

n8n can't run local binaries directly — it can only make HTTP calls. `server.js` is a small Express server that bridges that gap: n8n calls it, and it shells out to real Foundry/Slither binaries on whatever machine it's running on, then returns structured JSON.

`server.js` exposes three endpoints:

| Endpoint | Body | Behavior |
|---|---|---|
| `POST /validate` | `{ protocol, contract_address, rpc_url }` | Runs a Foundry script (`ValidateProtocol.s.sol`, lives in `foundry-validation`) to pull a protocol's core addresses, then independently re-queries several via `cast call` — e.g. confirming the address provider's `getACLManager()` actually returns the ACL Manager address found elsewhere. Returns architecture/wiring evidence. |
| `POST /validate-donation-attack` | `{ rpc_url }` | Runs a live `forge test` against `test/VenusDonationAttack.t.sol` (in `foundry-validation`) and classifies the result automatically. Currently the only finding with fully automated, re-executed-every-run behavioral evidence — see Known Limitations below. |
| `POST /slither` | `{ filePath }` | Runs Slither static analysis on a contract file. |

### foundry-validation (separate repository)

The actual Foundry project — every validator contract and behavioral test the pipeline relies on. `server.js` above calls into this project; it doesn't contain any logic of its own.

```
foundry-validation/
├── foundry.toml, foundry.lock      Foundry project config
├── script/ValidateProtocol.s.sol   the recon script /validate runs
├── src/
│   ├── validators/                 AaveValidator.sol, VenusValidator.sol, CompoundValidator.sol, BaseValidator.sol
│   ├── interfaces/                 IAavePool, IAddressesProvider, IComptroller, IPoolValidator, IVToken
│   └── models/ValidationResult.sol
├── test/                           one .t.sol file per finding
└── lib/forge-std/                  dependency, committed as plain files
```

`test/` is where the actual evidence gets generated — each file is a self-contained Foundry test encoding one specific, falsifiable claim, executed against a forked copy of the real chain. Each maps to one finding in the pipeline's taxonomy — `AaveOracleDependency.t.sol` tests exactly the finding Node 13 calls F06, for example.

## Audit repository (referenced by the workflow, not committed to either repo)

Four nodes in the audit branch read PDFs from a local folder that is **not** in either repository and is not created by any setup step: `11_Audit_Repository_Resolver` → `11.1_Discover_Audits` → `12_Audit_Selection_Policy` → `13_Read_Selected_Audit` → `14_Extract_Audit_Text`. If you import the workflow and run it as-is, those nodes fail until the folder exists.

- Subfolder names must match the `protocol` value (`Aave`, `Venus`, `Compound`); filenames must start with `DD-MM-YYYY` so `12_Audit_Selection_Policy` can pick the newest report by prefix.
- `11_Audit_Repository_Resolver` currently hardcodes an absolute Windows path tied to one machine — this should move to an environment variable before running elsewhere.
- The PDFs are third-party audit reports and are **not committed to this repository** (see `.gitignore`) — redistribution wasn't cleared, so they stay local only.

**There are two independent audit sources feeding different agents** — worth knowing before assuming the local PDF corpus is the audit path:

| Source | How it's obtained | Where it goes |
|---|---|---|
| Local PDF corpus | The five-node chain above | Aave: `15_Evidence_Review_Agent` → `18_Deterministic_Ground_Truth`. Compound: a side chain that terminates before the main spine. |
| Remote fetch | A single HTTP Request node, no local files | `08_AI_AUDIT` — this is what actually produces the audit findings the pipeline fuses. |

Remote URLs already in the workflow, no setup needed:
- Aave — `https://raw.githubusercontent.com/aave-dao/aave-v3-origin/main/audits/2024-10-22_StErMi_Aave-v3.3.md`
- Venus — `https://api.github.com/repos/code-423n4/2023-05-venus-findings/issues/220`
- Compound — `https://www.openzeppelin.com/news/compound-audit`

So audit ingestion is not a single path, and the local corpus is not what feeds `08_AI_AUDIT`. For Aave the local corpus does reach the main spine; for Compound its branch terminates without rejoining.

## Known limitations

Most current Foundry behavioral results are not re-executed on every pipeline run. They were run once, by hand, and the result was recorded in a lookup table in Node 13's code (`AAVE_MANUAL_FOUNDRY_SNAPSHOT` / `MANUAL_FOUNDRY_SNAPSHOT`), keyed by finding ID. Node 13 checks that table first and only reports "not tested" if a finding isn't in it.

The exception is the Venus donation-attack test, which genuinely re-runs and re-verdicts on every call to `/validate-donation-attack`.

This matters for anything built on top of the pipeline: "run" currently means a live test only for the architecture/wiring checks and the donation-attack finding. The rest of the behavioral evidence reflects a snapshot recorded in mid-August 2026. Closing this gap means wiring the remaining tests into live endpoints, following the same pattern already used for the donation-attack one.

The Historical Exploit Reasoning node (09) is designed to propagate `finding_id`/`canonical_finding_id` so a future node could join historical precedent to a specific finding by ID. Nothing does this today: Node 13 preserves the Historical node's output wholesale for context only, and the Fusion Engine averages its confidence scores across the whole array without regard to which finding each one belongs to. This is currently harmless — for Compound, the upstream node never emits a `finding_id` in the first place, so the Historical node falls back to using the risk name; Aave's equivalent output does carry `canonical_finding_id`. If a future node needs to join historical evidence to a specific finding by ID, both halves need fixing together.

## Integration: what's missing

There's currently no single HTTP entry point for "run a full assessment on protocol X, contract Y" — the n8n workflow starts manually inside n8n. To expose it: add a Webhook trigger node (`POST /run-assessment`, response mode "Last Node" or a "Respond to Webhook" node after the report generator), add a shared-secret header check if reachable outside localhost, decide on the runtime model (a full run takes tens of seconds — synchronous wait or execution-ID polling), make sure the FoundryBridge server is running and reachable from n8n, and configure n8n credentials (RPC URLs for Ethereum mainnet and BNB Chain, plus LLM provider credentials).

## Response shape

The exact output is defined by the report generator nodes — `19_report_generator.js` and its protocol-specific variants (`19_report_generator_aave_investor.js`, `19_report_generator_compound_investor.js`, `19_report_generator_venus_investor.js`). In general, expect a list of findings, each with a plain-language description, the LLM's independent assessment, the deterministic assessment (pass / fail / not tested), and the fused result (supported / contradicted / unresolved, plus a confidence figure). Example outputs are in `reports/`.

## Setup

1. Install Foundry: `curl -L https://foundry.paradigm.xyz | bash && foundryup`
2. Clone both repositories — `foundry-validation` and `foundry-bridge`. `foundry-validation`'s dependencies are committed as regular files, so no `forge install` step is needed.
3. From inside `foundry-validation`: `forge build`
4. From inside `foundry-bridge`: `npm install`
5. Copy `.env.example` to `.env` and fill in local values: the path to `foundry-validation`, the paths to the `forge`/`cast` binaries, and RPC URLs for Ethereum mainnet and BNB Chain.
6. Start the server: `node server.js`, then confirm it end to end:
   ```
   curl -X POST http://localhost:3000/validate \
     -H "Content-Type: application/json" \
     -d '{"protocol":"Aave","contract_address":"0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2","rpc_url":"<your Ethereum RPC URL>"}'
   ```
7. Import the relevant file from `n8n_workflows/` into a local n8n instance. Point its HTTP Request nodes at the local FoundryBridge server.
8. Add credentials in n8n: the LLM provider API key for the AI Agent nodes, and the RPC URLs from step 5.
9. Create the audit repository folder and edit the hardcoded path (see "Audit repository" above). The rest of the pipeline, including the `08_AI_AUDIT` agent that produces the audit findings actually used in fusion, does not depend on this folder.

Steps 1-6 are fully self-contained. Steps 7-9 connect the execution layer to the reasoning/fusion side of the pipeline.
