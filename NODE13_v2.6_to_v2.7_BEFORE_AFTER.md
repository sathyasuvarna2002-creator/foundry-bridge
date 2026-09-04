# Node 13 (Aave) v2.6 → v2.7 — NODE_08_CANDIDATES live-name fix

## What triggered this

You asked whether the AI Audit Agent (Node 08) was actually wired in. It should have been —
Node 13 v2.6 (built earlier this session) was specifically designed to union Node 07 +
Node 08 findings. But I hadn't re-checked that union against the real canvas node name since
building it, and it turned out not to be working.

## The bug

Node 13's `NODE_08_CANDIDATES` array (the list of names it tries, in order, to find the audit
agent's output under) was:

```js
const NODE_08_CANDIDATES = [
    '08_AI_Audit_Agent',
    '08_Audit_Incident_Ingestion_Agent',
    'AI Agent'
];
```

The real live node, confirmed directly from `Aave - Final (1).json`, is named `08_AI_AUDIT`.
None of the three candidates match it.

Because `safeNodeJson()` is deliberately built to treat a missing upstream node as a soft
"contributed nothing this run" (not a crash — the same defensive pattern used for temporal/
historical), this mismatch produced **no error at all**. `evidenceReview08` silently resolved
to `{}` on every real run. Practically: `findings08` was always empty, every finding's
`sources` was always just `["NODE_07_ARCHITECTURE"]`, and no `UNMAPPED-AUDIT-*` entry could
ever be produced — regardless of what Node 08 actually found. The entire v2.6 union
architecture has, as far as I can tell, never actually activated in production.

**Disclosed, not glossed over:** I have not gone back to re-check whether the real Node 16
v6.1 pipeline output pasted earlier this session had any `NODE_08_AUDIT`-sourced findings —
that JSON isn't in front of me anymore. Given this bug, the more likely explanation is that
run's `sources` fields were all single-source (`NODE_07_ARCHITECTURE` only) by construction,
not because Node 08 genuinely found nothing that run. Worth re-running the pipeline and
checking.

## The fix

Added `'08_AI_AUDIT'` to the front of `NODE_08_CANDIDATES`, kept the old three as fallback:

```js
const NODE_08_CANDIDATES = [
    '08_AI_AUDIT',
    '08_AI_Audit_Agent',
    '08_Audit_Incident_Ingestion_Agent',
    'AI Agent'
];
```

Version bumped 2.6 → 2.7. No other logic touched.

## Verification

- `node --check` — syntax OK.
- Isolated reproduction (`/tmp/verify_candidates.js`): mocked `$()` to behave like n8n's real
  accessor (throws for any node name not on the canvas, resolves only `'08_AI_AUDIT'` with a
  fake finding). Ran both the old and new candidate lists through the exact same resolution
  loop used in the real file:
  - Old list → `evidenceReview08 = {}` (confirms the bug: real data exists, never found).
  - New list → `evidenceReview08 = {"findings": [...]}` (confirms the fix: real data found).

## What this means for downstream nodes

Node 16, Node 17, and the Node 15 (ERA) prompt/schema I just updated all already expect and
correctly handle `sources` / `source_findings.node08_audit` / `UNMAPPED-AUDIT-*` — none of
that logic needs to change. This fix just means those fields will now actually get populated
with real Node 08 data on the next run, instead of only ever containing the shape without the
substance.

## Recommended next step

Re-run the pipeline once and check a finding's `sources` array in the Node 13 output — if
Node 08 genuinely found something matchable to a canonical finding, it should now show
`["NODE_07_ARCHITECTURE", "NODE_08_AUDIT"]` instead of always `["NODE_07_ARCHITECTURE"]`.
