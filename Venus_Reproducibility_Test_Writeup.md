# Venus Reproducibility Test (N=5)

Five Node06 -> Node07 runs on identical input (the crossref-instructed source
bundle, dereferenced schemas, citation-fix prompt), no changes between runs.
Goal: measure how much a single run's output can be trusted on its own,
rather than assuming any one run's findings are the framework's "real"
answer.

## Method

Each run: execute Node 06 fresh (not replayed), execute Node 07 on that
output, verify both against the dereferenced schemas programmatically
(required fields, enum membership, `finding_id`/`risk_category`/slug
consistency, array types, dangling `related_risks` references, duplicate
IDs), grep the evidence-citation strings for the known `VTokens`/`Vokens`
typo pattern and for exploit/implementation-bug language drift
(`exploit`, `vulnerab`, `attack`, `hack`, `overflow`, `underflow`).

## Results

| Run | Findings | Donation-attack finding | Category | Confidence | Schema |
|---|---|---|---|---|---|
| Reference (crossref) | 7 | TRUST-BOUNDARY-01 | Trust Boundary | 0.85 | clean |
| Run 1 | 8 | OPERATIONAL-RESILIENCE-01 | Operational Resilience | 0.82 | clean |
| Run 2 | 6 | TRUST-BOUNDARY-01 | Trust Boundary | 0.90 | clean |
| Run 3 | 9 | TRUST-BOUNDARY-01 (+ overlap: COMPOSABILITY-01, ASSET-CUSTODY-01 partially re-describe the same fact) | Trust Boundary | 0.96 | clean |
| Run 4 | 8 | ASSET-CUSTODY-01 (TRUST-BOUNDARY-01 present but describes a *different* fact — ProtocolShareReserve custody, not the donation attack) | Asset Custody | 0.90 | clean |

## What held up across all 5 runs

Schema validity: 5/5. Every run produced valid JSON against both
dereferenced schemas — every required field present, every enum value
legal, every `finding_id` correctly slugged from its own `risk_category`,
no dangling `related_risks` references, no duplicate IDs within a run.

Citation-format fix (`VTokens` -> `Vokens`): held 5/5. Zero recurrences of
the specific typo the v4 prompt fix targeted.

Language discipline: 5/5. No run used exploit, vulnerability, attack, or
implementation-bug language (overflow, underflow) anywhere in a finding —
confirmed by grep, not eyeballed. Even under much more implementation-detailed
input than earlier in the project, Node 07 stayed at the architectural level
("expands the trust boundary," "relies on external ERC-20 semantics") rather
than describing an exploit.

Detection: the donation-attack precursor fact — Comptroller's supply-cap
check trusting a VToken-reported exchange rate that is itself derived from
an unguarded raw ERC-20 balance read — was present in some form in 5/5 runs.
It was never missed entirely.

## What did not hold up

**Category placement.** The same underlying fact was classified as Trust
Boundary in 3 runs, Operational Resilience in 1, and Asset Custody in 1 (with
a 6th, partial instance where it got split across three overlapping findings
in different categories in the same run). Three of Node 07's ten closed
categories are all defensible readings of the same evidence, and which one
gets picked is not stable run to run. This was flagged as a risk earlier in
the project (before this test existed) and this result confirms it's real,
not hypothetical.

**Confidence for that specific finding**, while not wildly unstable, ranged
0.82-0.96 across the 5 runs — a 0.14 spread on what is nominally "the same"
claim. Not evidence of the anti-saturation rule failing (no run defaulted to
0.95 without justification), but a real amount of noise in the number itself.

**Finding count**: 6, 7, 8, 8, 9 — total findings varied by up to 3 between
runs on identical input, with categories like `GOVERNANCE-01`,
`ACCESS-CONTROL-01`, and `ECONOMIC-DEPENDENCY-02` appearing in some runs and
not others.

**A second, different citation bug.** Run 3's Node06 output cited the
pre-patch source file as `VBep20_prepatch.sol` (dropping `_excerpt`) in all
7 places it referenced that file, never once getting it right. Runs 1, 2, and
4 all cited it correctly. This is the same underlying failure mode as the
`Vokens` typo (reconstructing an identifier from memory instead of copying
it) but on a different string, and it didn't recur in the very next run —
so the existing citation-format fix is real but has not fully generalized
to every filename in the bundle. Not yet fixed; flagged for a follow-up
prompt revision rather than fixed reactively mid-test.

**`contract_profile.source_files` completeness.** Ranged from 1 file (run 3)
to 11 (run 1) despite the same source bundle being provided every time.

## Interpretation

The mechanical/structural layer of the framework — schema conformance,
citation format (mostly), confidence-band discipline, staying at the
architectural level rather than drifting into implementation-bug language —
is holding up well under repeated runs. That was the thing most recently and
heavily patched, and the patching worked.

The semantic/organizational layer — which category a finding lands in, how
many findings get generated, whether related sub-observations get merged
into one finding or split into several — is genuinely non-deterministic
across runs on identical input. This means a single run's output should not
be treated as *the* answer for a protocol; it should be treated as one
sample from a distribution of similar-but-not-identical answers. For
reporting purposes, the safer claim is category-agnostic: "the framework
detects the donation-attack-precursor architectural fact in 5/5 runs, with
confidence in the 0.82-0.96 range" rather than "the framework classifies
this as a Trust Boundary risk at 0.85 confidence."

## Follow-up items generated by this test

- Extend the citation-format fix beyond the specific `VTokens`/`Vokens`
  pattern to a general "verify every cited filename against the exact
  filenames given in `source_files`" instruction.
- Consider whether Node 07's RISK CATEGORIES section needs tie-breaking
  guidance for facts that plausibly span two categories (e.g. an explicit
  precedence order, or permission to note a secondary category in
  `description` when a finding is a defensible fit for more than one).
- The Aave side of the project has never had this test run (task #14) —
  this result is a strong argument for prioritizing it, since it's
  plausible the same category-drift and count-variance exists there too
  and has simply never been measured.
