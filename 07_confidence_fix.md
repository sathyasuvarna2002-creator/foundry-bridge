# Node 07 (07_AI_Risk_Reasoner) — Confidence Field Fix

## Root cause

The current CONFIDENCE section defines its top tier as:

> **1.00 — Directly supported by multiple architectural observations.**

Every reported finding is *already required* to cite multiple architectural
observations to be included at all (see CANONICAL FINDING TAXONOMY and
REASONING REQUIREMENTS). So "1.00" is trivially satisfied by anything the
model decides to report — it measures whether evidence exists, not how
certain the model is about the specific claim it's making. That's why all
11 findings came back at exactly 1.00: the scale's own top bucket doesn't
distinguish between findings once they've cleared the inclusion bar.

Compounding factor: the schema's `confidence` property has no
`description` at all (every other field does), so there's no anchoring at
the structured-output layer either.

## What to change

Nothing else in the prompt or schema needs to change — the canonical ID
mapping, evidence citation, and taxonomy logic are all working correctly
(verified against the real output). This is a surgical fix to one section
and one schema field.

---

### 1. In `07_AI_Risk_Reasoner`'s system message, find this block:

```
────────────────────────────────────────
CONFIDENCE
────────────────────────────────────────
Assign a confidence score between 0.00 and 1.00.
Confidence reflects certainty that the supplied architectural evidence supports the inferred exposure.
Guidance:
1.00
Directly supported by multiple architectural observations.
0.90–0.99
Strong architectural inference.
0.75–0.89
Moderate architectural inference.
Below 0.75
Only use when architectural evidence is limited.
Confidence is NOT severity.
────────────────────────────────────────
```

### Replace it with:

```
────────────────────────────────────────
CONFIDENCE
────────────────────────────────────────
Assign a confidence score between 0.00 and 1.00 for every risk you report.

Confidence does NOT measure whether evidence exists for this finding.
Every finding you report has already passed the inclusion bar in the
CANONICAL FINDING TAXONOMY and REASONING REQUIREMENTS sections above --
by definition, every reported finding already cites architectural
evidence. Citing evidence is a precondition for inclusion, not a
justification for maximum confidence. If you find yourself assigning
1.00 to every finding "because each one has supporting evidence," you
are using the wrong criterion -- go back and re-score using the
criterion below.

Confidence measures your remaining uncertainty about the SPECIFIC
CAUSAL CLAIM you are making: that this particular architectural pattern,
as evidenced, actually produces this particular security exposure, at
the severity and scope you have described. Ask yourself, for each risk
independently:

- Does the cited evidence establish the FULL scope of the claim, or
  only part of it? (e.g. evidence shows a function is gated by a role
  check, but you are also asserting something about who can hold that
  role -- do you have evidence for that part too, or are you assuming
  it?)
- Is there only one interpretation of the cited evidence consistent
  with your claim, or could the same code patterns plausibly support a
  narrower or different reading?
- Is the inference direct (the code does X, therefore Y follows
  immediately) or does it require an intermediate inferential step (the
  code does X, which typically implies Y in similar systems, so Y
  probably applies here too)?
- Is the evidence for this finding corroborated by multiple independent
  architectural observations, or does it rest on a single citation?

Use the following anchors. These are illustrative, not mechanical
thresholds -- use your judgment about where a given finding truly sits,
and expect your 11 confidence scores to differ from each other based on
genuine differences in evidentiary strength between findings. Producing
the same confidence value for all 11 findings should be treated as a
signal you have not actually applied this criterion per finding.

0.95–1.00
Reserved for claims where the cited evidence directly and completely
establishes every part of the specific claim, with no inferential gap,
corroborated by multiple independent architectural observations, and no
plausible alternative reading of the same evidence.

0.85–0.94
The core claim is directly evidenced, but some secondary part of the
claim (e.g. the real-world identity or governance form of a privileged
actor, an edge-case code path, an assumption about how a dependency
behaves) is inferred rather than directly evidenced.

0.70–0.84
The general architectural pattern is evidenced, but the specific
security claim requires a meaningful inferential step beyond what the
evidence directly shows, or the evidence is corroborated by only one
observation rather than several.

Below 0.70
Evidence for this canonical finding is limited, indirect, or mostly
inferred from general architectural patterns rather than
finding-specific observations. Still include the finding (per the
CANONICAL FINDING TAXONOMY rules above), but be explicit in
risk_rationale about what is missing.

Worked example (do not copy verbatim -- reason independently each
time): "The Pool stores an immutable ADDRESSES_PROVIDER and calls
getPoolConfigurator() to gate configuration functions" directly and
completely evidences that configuration authority is delegated to a
single resolved address (supports 0.95-1.00 for THAT specific claim).
But if you are additionally asserting that this address is controlled
by "a small multisig" or "likely a single EOA" without evidence
identifying the actual controller, that additional, unevidenced part of
the claim should pull your confidence for the finding down into the
0.85-0.94 range or lower, even though the core delegation claim is
solid.

Confidence is NOT severity. A Critical-severity finding can have
moderate confidence, and a Low-severity finding can have very high
confidence -- these two fields are independent.
────────────────────────────────────────
```

---

### 2. In `Structured Output Parser1`'s schema, find the `confidence` property:

```json
"confidence": {
  "type": "number",
  "minimum": 0,
  "maximum": 1
}
```

### Replace it with:

```json
"confidence": {
  "type": "number",
  "minimum": 0,
  "maximum": 1,
  "description": "Your remaining uncertainty about the SPECIFIC causal claim being made -- NOT whether evidence exists (every reported finding already has evidence by construction, per the inclusion rules). Must reflect genuine per-finding variation across the 11 findings; do not default to 1.0 for every finding. See the CONFIDENCE section of the system prompt for the full anchored scale (0.95-1.00 / 0.85-0.94 / 0.70-0.84 / below 0.70) and worked example."
}
```

---

## After you make this change

Rerun `07_AI_Risk_Reasoner` in n8n and paste me its fresh output. I'll run
it back through Node 17 (Dempster combination unchanged, no discounting)
and check whether confidence now varies across the 11 findings.

If it still comes back uniform after this fix, that becomes a legitimate,
documented empirical characteristic of the LLM stage on this input --
not something to force-correct with more prompt engineering. Shafer
discounting stays parked as a separate, clearly-labeled sensitivity
experiment, not folded into the primary experiment.
