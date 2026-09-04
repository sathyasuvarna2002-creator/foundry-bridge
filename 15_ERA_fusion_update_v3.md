# ERA fix v3 — stop treating [Bel, Pl] as a range Node 07's confidence must fall inside

Node 17's own output field changed (matches the code fix): `interval_contains_baseline`
(boolean) is gone, replaced by `interval_position` (`"below_belief" | "within_interval" |
"above_plausibility"`), because the boolean framing was actively wrong, not just unclear --
see below. This patch updates both the input description (item 6) and Step 6 to match.

## Why the old framing was wrong, not just imprecise

`[Bel(R), Pl(R)]` is the range of probabilities consistent with the *combined* evidence. It
was never a confidence interval that Node 07's raw, single-source number was supposed to fall
inside. Proof: whenever Node 16 shows no contradiction, `combined_R - confidence = s*(1-c) >= 0`
always, for any confidence value -- so "Node 07 falls below Bel(R)" is structurally guaranteed
in that regime regardless of whether Node 07's number was itself well-calibrated. In every real
finding in this project so far, including the contradiction cases (F05, F10), this holds. So
`interval_position = "below_belief"` is not evidence about any specific finding -- it is a
mechanical consequence of the fusion math. Only `"above_plausibility"` (Node 07's confidence
exceeding what even the combined evidence supports) is a direction that isn't mechanically
forced, and is worth real attention.

The PRIMARY comparison metric is, and has always been, `D = |confidence - BetP(R)|` -- this
does not change.

## 1. Replace item 6 in YOUR INPUTS (the field list) with:

```
6. **DST Evidence Fusion (Node 17)** -- a mathematical (non-LLM) combination of Node 07's raw
   confidence and Node 16's deterministic evidence, computed via Dempster-Shafer combination.
   For each finding you will receive:
   - `llm_evidence.confidence` -- Node 07's original, ungrounded confidence (0-1)
   - `dst.primary.belief_R` / `dst.primary.plausibility_R` -- the range of probabilities
     consistent with the COMBINED evidence. This is descriptive information about the fused
     result, NOT a range Node 07's raw confidence is expected or required to fall inside.
   - `dst.primary.pignistic_R` (BetP) -- a single decision-oriented number derived from that
     range, for reference only
   - `dst.primary.K` -- how much the two sources actually disagreed (0 = no disagreement)
   - `dst.primary.divergence.absolute_difference` -- THE primary comparison number:
     |Node 07's confidence - BetP(R)|. This is what you should lead with when describing how
     much the fusion changed the answer.
   - `dst.primary.divergence.interval_position` -- one of "below_belief" / "within_interval" /
     "above_plausibility". This is supplementary and descriptive only. "below_belief" is, given
     the current mass structure, a near-mechanical outcome whenever Node 16 shows any support
     -- do NOT describe it as evidence of overconfidence. Only "above_plausibility" represents
     a direction that isn't structurally guaranteed.

   This is a fully independent, already-computed mathematical result. You are NOT being asked
   to recompute it, second-guess its arithmetic, or produce your own version of it -- Node 17's
   numbers are final. Your job with this input is explained in Step 6 below.
```

## 2. Replace the two original bullets in Step 6 (the ones about "Node 07 fell outside Node
17's range" and the K>0-but-belief-didn't-drop case) with:

```
- **Lead with `divergence.absolute_difference` (D = |confidence - BetP(R)|)** as the headline
  number for how much the fusion moved the answer. This is the metric to cite, not interval
  position.
- **Do not describe `interval_position = "below_belief"` as overconfidence, or as evidence
  about this specific finding at all.** Given how Node 07's mass is structured, the fused
  belief is mechanically pulled to be greater than or equal to Node 07's raw confidence
  whenever Node 16 shows any support -- this happens almost every time, regardless of whether
  Node 07's original number was good or bad. Simply note the direction as a fact if relevant
  (e.g. "the fused belief sits above Node 07's original confidence, consistent with the
  supporting deterministic evidence") without calling it a correction, discrepancy, or
  overconfidence signal.
- **`interval_position = "above_plausibility"` IS worth naming explicitly if you see it** --
  that direction is not mechanically guaranteed, and means Node 07's raw confidence exceeded
  even what the combined evidence supports.
- **Node 16 showed real contradiction (K > 0) but Node 17's fused belief barely moved, or even
  rose slightly.** This is a known mathematical property of Dempster's combination rule
  (disagreement is absorbed into the conflict value K rather than lowering the final belief) --
  if you observe this, say so plainly rather than implying the contradiction was resolved or
  dismissed.
```

Keep the existing third bullet (about small movements at high deterministic support being an
expected "ceiling effect," from the v2 patch) as-is -- it's still correct and now reinforces
the same point from a different angle (the ceiling effect and the below_belief-is-not-
diagnostic point are two views of the same underlying mechanism).

## 3. Update the F01-style example logic

Wherever you (ERA) would previously have written something like "Node 07's raw 0.95 falls
below/outside the fused interval [0.9875, 1.00], indicating divergence," write instead:

```
"Node 07 originally rated this finding 0.95. Node 17's fusion produced BetP(R) = 0.99375, a
divergence of D = |0.95 - 0.99375| = 0.04375 -- below the flagging threshold, so not treated as
meaningfully divergent. The fused belief sits slightly above Node 07's number, which is the
expected direction given the deterministic evidence's support level, not a sign Node 07's
original assessment was wrong."
```

That's the whole change. Paste into the system message (replacing the relevant part of Step 6
and item 6), rerun, and send me the output -- I want to see whether ERA now leads with D
instead of interval language across all 11 findings, not just F01.
