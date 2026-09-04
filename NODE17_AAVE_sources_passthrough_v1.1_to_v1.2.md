# Node 17 (Aave) v1.1 → v1.2, Node 18 (Aave) v2.1 → v2.2 — sources passthrough

## What triggered this

You pasted the real, live Node 18 (Aave) v2.1 code as the last node to review. It had no bugs
on its own -- every field it reads was checked against Node 17's real output and matched
exactly (`llm_evidence.risk_name`, `deterministic_evidence.finding_status`,
`dst.primary.divergence.threshold`, `self_tests.all_passed` all verified present at the exact
paths Node 18 expects). But diffing it against `18_grounding_effect_evaluation_venus.js` turned
up one real, verified asymmetry: Venus's Node 18 includes a `sources` field per finding;
Aave's doesn't.

## The actual gap

It's one level upstream of Node 18. Node 16 (Aave) v6.1 -- fixed earlier this session -- passes
through `sources` (which of Node 07 / Node 08 contributed to a finding) as pure metadata. But
Node 17 (Aave) never reads or forwards it: grepping the file for `sources`, `source_findings`,
`finding_resolution`, or `claim_ids` before this fix returned nothing. Node 16 has the data;
Node 17 silently drops it before it can reach Node 18 or any other downstream consumer of
Node 17's output alone.

Confirmed this is a real, precedent-backed gap and not just a stylistic difference: Venus's
Node 17 (`17_dst_evidence_fusion_venus.js`, line 481) already does
`sources: n13?.sources ?? null` on every finding it emits, and Venus's Node 18 reads it
straight through.

## Why this is low-severity, disclosed as such

None of Node 18's actual computations (category, change, aggregate statistics) use `sources`
anywhere -- the ERA already reads `sources`/`source_findings` directly from Node 13, so nothing
downstream was silently wrong. This is a completeness/parity gap, not a correctness bug like
the Node 13 candidate-name issue or the Node 17 divergence-flag boundary bug found earlier.

## The fix

Two pure additive one-line passthroughs, nothing else touched:

- `17_dst_evidence_fusion.js`: added `sources: n16?.sources ?? null,` to each finding's
  top-level output object (v1.1 → v1.2).
- `18_grounding_effect_evaluation.js`: added `sources: f.sources ?? null,` to each
  `per_finding` entry (v2.1 → v2.2).

Both use the same `?? null` fallback already used throughout both files for optional fields --
running Node 18 v2.2 against a Node 17 v1.1 output (pre-fix) reads `sources: null` for every
finding rather than throwing.

## Verification

- `node --check` -- syntax OK on both files.
- Grepped both files for `sources` -- exactly one write site in each (plus the version-header
  comments), confirming no other logic was touched.
- Isolated reproduction (`/tmp/verify_sources_passthrough.js`) running the exact two expressions
  copied verbatim from the real files against six cases: a merged F05-style finding
  (`["NODE_07_ARCHITECTURE","NODE_08_AUDIT"]`), a single-source finding, an old-style Node 16
  finding with no `sources` field, an undefined `n16`, a Node 17 v1.2 finding with `sources`
  forwarded, and an old Node 17 v1.1 finding with no `sources` field at all. All 6 assertions
  passed -- correct passthrough in both directions, safe `null` fallback in every absent case.
