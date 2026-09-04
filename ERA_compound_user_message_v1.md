# ERA (Compound) — User Message / Input template

Paste into the AI Agent's "User Message" (or "Text") field, not the
system message. Node names below must match whatever you actually
named these nodes on your canvas — the same caveat that applied to
Node 17 (Compound)'s own `NODE_13_CANDIDATES`/`NODE_16_CANDIDATES`
fallback lists. Confirmed real canvas names this session for the
Compound-specific nodes: `13_Deterministic_Evidence_Specification_
Compound`, `14_Deterministic_Validation` (Node 16's equivalent step),
and `15_DST_Evidence_Fusion` (Node 17's equivalent step).

Unlike the Venus version, this one INCLUDES a Temporal Evidence block —
Compound's `12_Temporal_Evidence_Engine` is a real, working node, not a
deleted one.

```
Architecture Assessment
{{ JSON.stringify($node["06_AI_Architecture_Reasoner"].json, null, 2) }}
---
Security Risk Assessment (Node 07)
{{ JSON.stringify($node["07_AI_Risk_Reasoner"].json, null, 2) }}
---
Historical Exploit Assessment (Node 09)
{{ JSON.stringify($node["09_AI_Historical_Exploit_Reasoner"].json, null, 2) }}
---
Temporal Evidence (Node 12)
{{ JSON.stringify($node["12_Temporal_Evidence_Engine"].json, null, 2) }}
---
Foundry Runtime Validation (Node 10)
{{ JSON.stringify($node["10_Foundry_Validation"].json, null, 2) }}
---
Deterministic Evidence Specification (Node 13, Compound -- declares AND
evaluates every predicate inline against real Foundry/architecture/
manual-forge-snapshot evidence, unlike Aave/Venus's declare-only Node
13. Includes the union of Node 07 and Node 08 audit findings,
anchor-token-resolved, with per-source provenance under
source_findings.node07_architecture and source_findings.node08_audit.
UNMAPPED-* and UNMAPPED-AUDIT-* entries here could not be matched to a
canonical finding -- see UNMAPPED SOURCE CONTEXT in the system prompt.)
{{ JSON.stringify($node["13_Deterministic_Evidence_Specification_Compound"].json, null, 2) }}
---
Deterministic Validation (Node 16, Compound -- real canvas node name
14_Deterministic_Validation. Carries finding_polarity and
status_interpretation -- read NEGATIVE CONTROL FINDING in the system
prompt before writing about UPGRADEABILITY_01.)
{{ JSON.stringify($node["14_Deterministic_Validation"].json, null, 2) }}
---
DST Evidence Fusion (Node 17, Compound -- real canvas node name
15_DST_Evidence_Fusion)
{{ JSON.stringify($node["15_DST_Evidence_Fusion"].json, null, 2) }}
```

Notes:
- Node name strings inside `$node["..."]` must exactly match your
  canvas node names — if any of these are named differently than shown
  here, update these expressions accordingly. `13_Deterministic_
  Evidence_Specification_Compound`, `14_Deterministic_Validation`, and
  `15_DST_Evidence_Fusion` are confirmed against the real live canvas as
  of this session; `06_AI_Architecture_Reasoner`, `07_AI_Risk_Reasoner`,
  `09_AI_Historical_Exploit_Reasoner`, `10_Foundry_Validation`, and
  `12_Temporal_Evidence_Engine` follow the same naming convention used
  elsewhere in this pipeline but were not individually re-confirmed
  against the Compound canvas in this session — check them before first
  run.
- All seven references use `$node["NodeName"]`, which resolves
  regardless of how many nodes sit between ERA and each source in the
  execution graph.
- Deliberately no separate "Independent Audit Intelligence" block: Node
  13 (Compound)'s own output is the audit-evidence input now, already
  correctly split into matched (per-finding, under `source_findings.
  node08_audit`) and unmapped (`UNMAPPED-AUDIT-*` finding_ids) — ERA is
  instructed in the system prompt to read both from this one input, not
  to expect a separate raw-text audit blob.
- Unlike Venus, do NOT omit the Temporal Evidence block — Compound's
  Node 12 is real and present, and Node 16 (Compound) already treats it
  as a genuine contextual source (with the same "only claim FOUND if the
  payload genuinely has content" discipline fixed in Venus v1.2). Leave
  `evidence_sources_present.temporal` for the model to set truthfully
  per finding rather than hardcoding it.
