# ERA (Venus) — User Message / Input template

Paste into the AI Agent's "User Message" (or "Text") field, not the
system message. Node names below must match whatever you actually
named these nodes on your canvas — adjust if yours differ. Replaces
the Aave version's hardcoded `Independent Audit Intelligence: {{ $json.text }}`
line entirely: Node 13 (Venus)'s own output already carries Node 08's
audit findings, both mapped and unmapped, with clear per-source
provenance, so there is no separate audit-text input to assemble here.

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
Foundry Runtime Validation (Node 10)
{{ JSON.stringify($node["10_Foundry_Validation"].json, null, 2) }}
---
Deterministic Evidence Specification (Node 13, Venus -- includes the
union of Node 07 and Node 08 audit findings, anchor-token-resolved,
with per-source provenance under source_findings.node07_architecture
and source_findings.node08_audit. UNMAPPED-* entries here are Node 08
audit findings that could not be matched to a canonical finding -- see
UNMAPPED AUDIT CONTEXT in the system prompt.)
{{ JSON.stringify($node["13_Deterministic_Evidence_Specification_Venus"].json, null, 2) }}
---
Deterministic Validation (Node 16, Venus)
{{ JSON.stringify($node["16_Deterministic_Evidence_Anchor_Venus"].json, null, 2) }}
---
DST Evidence Fusion (Node 17, Venus)
{{ JSON.stringify($node["17_DST_Evidence_Fusion_Venus"].json, null, 2) }}
```

Notes:
- No "Temporal Evidence (Node 12)" block, deliberately -- the temporal
  analysis node was deleted from this canvas early on (Phase-2 scope,
  same deferral as the dismissed-finding history log). Referencing a
  node name n8n can't find at all (not "didn't run," genuinely absent
  from the canvas) throws an expression error and would break this
  entire user message, not just leave one section blank -- so it's
  omitted here rather than left in and broken. Node 13 (Venus) already
  handles Node 12's absence gracefully on its own side (falls back to
  an empty object, no crash) if you ever re-add it later.
- Node name strings inside `$node["..."]` must exactly match your
  canvas node names -- if Node 16/17's Venus nodes are named differently
  than shown here, update these expressions accordingly (same caveat
  that applied to Node 17's own `NODE_16_CANDIDATES` fallback list).
- All seven references use `$node["NodeName"]`, which resolves
  regardless of how many nodes sit between ERA and each source in the
  execution graph -- consistent with how Node 09's user message handles
  the same pattern.
- Deliberately no separate "Independent Audit Intelligence" block: Node
  13's own output is the audit-evidence input now, already correctly
  split into matched (per-finding, under `source_findings.node08_audit`)
  and unmapped (`UNMAPPED-AUDIT-*` finding_ids) — ERA is instructed in
  the system prompt to read both from this one input, not to expect a
  separate raw-text audit blob.
