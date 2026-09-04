# Fixing `15_Evidence_Review_Agent` (ERA) — wiring + prompt/schema update

## 1. Wiring fix

Current chain: `14_Deterministic_Validation` → `11_Audit_Repository_Resolver` → `11.1_Discover_Audits` → `12_Audit_Selection_Policy` → `13_Read_Selected_Audit` → `14_Extract_Audit_Text` → `15_Evidence_Review_Agent`.

Don't add Node 17 as a separate parallel branch off `14_Deterministic_Validation` (that was my earlier suggestion — on reflection it's fragile: n8n doesn't guarantee execution order between sibling branches, so ERA could run before Node 17 has executed, and `$("17_...")` would fail).

Instead, **splice Node 17 directly into the existing chain**:

```
14_Deterministic_Validation → Node 17 (DST Evidence Fusion) → 11_Audit_Repository_Resolver → ... → 14_Extract_Audit_Text → 15_Evidence_Review_Agent
```

Concretely: remove the connection `14_Deterministic_Validation → 11_Audit_Repository_Resolver`, and replace it with `14_Deterministic_Validation → Node 17 → 11_Audit_Repository_Resolver`. Everything downstream of `11_Audit_Repository_Resolver` stays exactly as it is.

This guarantees Node 17 has already run by the time ERA executes, and makes `07_AI_Risk_Reasoner`, `14_Deterministic_Validation`, and Node 17 all safely reachable from ERA via `$("...")` expressions — no new direct connections into ERA are needed at all.

---

## 2. Prompt update — add a new input, a new step, and a new output field

Everything below is additive. Nothing in ERA's existing evidence-review logic (Steps 1-5, the decision tree, `review_assessment`/`review_confidence`) changes — that machinery keeps working exactly as before. This adds a sixth input, a sixth step, and one new output field.

### 2a. Add to **YOUR INPUTS** (after item 5, Independent Audit):

```
6. **DST Evidence Fusion (Node 17)** — a mathematical (non-LLM) combination of Node 07's raw
   confidence and Node 16's deterministic evidence, computed via Dempster-Shafer combination.
   For each finding you will receive:
   - `llm_evidence.confidence` -- Node 07's original, ungrounded confidence (0-1)
   - `dst.primary.belief_R` / `dst.primary.plausibility_R` -- the range Node 17 computes as
     defensible given both sources combined
   - `dst.primary.pignistic_R` (BetP) -- a single decision-oriented number derived from that
     range, for reference only
   - `dst.primary.K` -- how much the two sources actually disagreed (0 = no disagreement)
   - `dst.primary.divergence` -- whether Node 07's raw confidence and Node 17's fused BetP
     differ by more than a configured threshold, and whether Node 07's raw confidence falls
     outside the [belief_R, plausibility_R] range Node 17 computed

   This is a fully independent, already-computed mathematical result. You are NOT being asked
   to recompute it, second-guess its arithmetic, or produce your own version of it -- Node 17's
   numbers are final. Your job with this input is explained in Step 6 below.
```

### 2b. Add a new step after **Step 5: Explain Clearly**:

```
### **Step 6: Compare With the Mathematical Fusion (Node 17)**

For each finding, after completing Steps 1-5, write one additional short note --
`fusion_comparison_note` -- comparing three things in plain language for a human reader:

1. What Node 07 originally said (its raw, ungrounded confidence)
2. What Node 16's deterministic evidence showed
3. What Node 17's mathematical fusion computed (belief/plausibility range and the single BetP
   number)

Say whether these three views broadly agree, and if they diverge, say where and why in plain
terms a non-technical reader can follow. You are explaining and contextualizing Node 17's
output, not correcting, adjusting, or replacing it -- its numbers are the final mathematical
result regardless of what you think of them.

Two situations are worth explicitly naming when you see them (do not force these onto every
finding if they don't apply):

- **Node 07 fell outside Node 17's [belief_R, plausibility_R] range**
  (`divergence.interval_contains_baseline: false`). This means the raw LLM confidence was not
  actually consistent with what the combined evidence supports -- say in which direction (too
  confident, or not confident enough) and why that matters for a reader trying to trust the
  LLM's stated number on its own.
- **Node 16 showed real contradiction (K > 0) but Node 17's fused belief barely moved, or even
  rose slightly.** This is a known mathematical property of Dempster's combination rule
  (disagreement is absorbed into the conflict value K rather than lowering the final belief) --
  if you observe this, say so plainly rather than implying the contradiction was resolved or
  dismissed.

Example (based on a real run of this pipeline, F11 -- Reserve Registry Operational Dependency):
```json
{
  "fusion_comparison_note": "Node 07 originally rated this finding at only 0.60 confidence, reflecting that the evidence for operational/governance correctness is inherently harder to verify from code alone. Node 16's deterministic check found strong support (3 of 4 propositions confirmed, none contradicted). Node 17's mathematical fusion combined these into a belief range of [0.90, 1.00] with a single BetP value of 0.95 -- meaningfully higher than Node 07's original number, and outside the range Node 07 alone would have implied. This is a case where deterministic grounding meaningfully increased confidence rather than just confirming it: Node 07's original caution was not matched by the actual evidence available."
}
```
```

### 2c. Add to **CONSTRAINTS → Do NOT**:

```
- ❌ Recompute, "correct," or contradict Node 17's belief/plausibility/BetP numbers -- they are
  a fixed mathematical result; your role is to explain them, not re-derive or override them.
```

### 2d. Replace the closing framing section (currently titled "THIS IS YOUR EVIDENCE-BASED PROBABILISTIC ASSESSMENT"):

Find:
```
THIS IS YOUR EVIDENCE-BASED PROBABILISTIC ASSESSMENT

Everything up to now has been:
- LLM reasoning (architecture)
- Symbolic verification (runtime + historical + temporal)
- Independent corroboration (audit)

This node brings it together: **What does all this evidence suggest?**

Your answer becomes the probabilistic side of the neuro-symbolic comparison.

The Consistency Assessment compares:
- **Your evidence-based confidence** (probabilistic)
- **Deterministic validation status** (symbolic)

If they agree → finding is well-supported
If they diverge → something warrants review
```

Replace with:
```
THIS IS YOUR EVIDENCE-BASED PROBABILISTIC ASSESSMENT

Everything up to now has been:
- LLM reasoning (architecture, Node 07)
- Symbolic verification (deterministic runtime + historical + temporal, Node 16)
- A mathematical fusion of Node 07 and Node 16 via Dempster-Shafer combination (Node 17) --
  already computed, not something you produce

This node brings it together into something a human reader can follow: what does all this
evidence suggest, and how does it relate to what Node 17 already computed mathematically?

Your review_assessment/review_confidence remain your own independent, evidence-based judgment
-- they are reported as a secondary, holistic comparison point alongside Node 17's fused
output, not folded into it and not a substitute for it. Node 17's belief/plausibility/BetP
numbers are the primary quantitative result; your fusion_comparison_note explains what they
mean and whether your own reading of the evidence agrees.
```

---

## 3. Schema update

In `Structured Output Parser3`'s schema (the parser paired with ERA), find the `review_assessments` item's `properties` object and add:

```json
"fusion_comparison_note": {
  "type": "string",
  "description": "Plain-language comparison of Node 07's raw confidence, Node 16's deterministic evidence, and Node 17's mathematically fused belief/plausibility/BetP for this finding. Explain agreement or divergence; do not recompute, adjust, or contradict Node 17's numbers. See the DST Evidence Fusion section of the system prompt for the two situations to explicitly name when present: Node 07 falling outside Node 17's [belief_R, plausibility_R] range, and real Node 16 contradiction (K > 0) that didn't proportionally lower the fused belief."
}
```

And add `"fusion_comparison_note"` to the item's `required` array (currently: `finding`, `canonical_finding_id`, `severity`, `review_assessment`, `review_confidence`, `audit_relationship`, `consensus_level`, `evidence_sources_present`, `deterministic_status`, `evidence_summary`, `review_reasoning`).

---

## After you make these changes

Rerun `15_Evidence_Review_Agent` and paste me the output — I'll check that `fusion_comparison_note` is populated correctly and that it's actually referencing Node 17's real numbers (not paraphrasing Node 16 alone, which would mean the wiring/expression access isn't working).
