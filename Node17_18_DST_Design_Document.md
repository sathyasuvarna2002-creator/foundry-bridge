# Node 17 (DST Evidence Fusion) & Node 18 (Calibration Evaluation)
## Design Document — A through G

Research question this design serves:

> When probabilistic LLM reasoning is compared with deterministic smart-contract evidence, where do they agree, where do they diverge, and does DST-based grounding improve the calibration and uncertainty representation of the LLM assessment?

Node 16 is frozen. Nothing below modifies it, adds propositions to it, or treats its status as ground truth.

---

## A. ARCHITECTURE

**Renaming for clarity, since this document repositions a node built earlier in this project:**

- **Node 07** — AI Risk Reasoner. Unchanged. Its raw `risk_category`/`severity`/`confidence` per finding is now formally the **Experiment 1 (LLM-only) baseline** — produced before the model has seen any deterministic evidence.
- **Node 16** — Deterministic Evidence Anchor. Frozen. Supplies per-finding proposition-level counts (supported / contradicted / unresolved).
- **Evidence Review Agent** — the LLM synthesis node built and verified two stages ago (previously informally called "Node 17" in conversation). Unchanged. It reads Node 07, Node 16, Node 09 (historical), Node 12 (temporal), and the Sigma Prime audit, and produces `review_assessment` + `review_confidence` + `deterministic_status` per finding. This node's output is **not** a valid LLM-only baseline (it has already seen Node 16), so it is *not* used for Experiment 1. It is used as one of the two inputs to the new Node 17 below.
- **Node 17 (NEW, this document)** — DST Evidence Fusion. A pure mathematical node. No LLM calls. Takes the Evidence Review Agent's output and Node 16's output as two independent bodies of evidence over the same frame of discernment, and combines them using Dempster's rule of combination. Outputs, per finding: both sources' individual mass assignments (untouched, still separately visible), the combined mass, belief, plausibility, conflict, and an optional pignistic probability. This is the **Experiment 2 (grounded)** output.
- **Node 18 (NEW, this document)** — Calibration Evaluation. Compares Experiment 1 against Experiment 2, runs the reproducibility experiment on the LLM-containing stages, and computes calibration metrics only where independent ground truth exists (expected: rarely or never, for the reasons in Section E).

```
Node 07 (LLM-only, Experiment 1 baseline)        Node 16 (frozen, deterministic)
     |                                                   |
     |            (fusion inputs -- independent)         |
     v                                                   v
              Node 17: DST Evidence Fusion  (Experiment 2)
                            |
                            v
              Node 18: Calibration Evaluation
        (Experiment 1 vs Experiment 2, reproducibility, calibration-where-possible)

Evidence Review Agent (already saw Node 16 -- NOT a fusion input)
     |
     v
reported alongside Node 18's output as a secondary, non-core comparison only
```

**CORRECTION (post-review):** Node 17 fuses **Node 07 raw** with Node 16 — not the Evidence Review Agent. Dempster's rule requires the two combined bodies of evidence to be independent. The Evidence Review Agent already reads Node 16's `deterministic_status` as one of its five evidence inputs, so its mass is not independent of Node 16's — combining them would double-count the deterministic signal (once directly, once smuggled inside the LLM mass) and artificially inflate belief. Node 07 has never seen Node 16, so it is the correct, genuinely independent LLM-side input to the fusion. This also collapses what were two subtly different "LLM-alone" reference points (Node 07 raw for Experiment 1, the Evidence Review Agent for Node 17's internal divergence) into one consistent object used everywhere. The Evidence Review Agent is not discarded — it becomes a secondary, fully-informed narrative signal, reportable alongside the DST fusion result as an optional "does the holistic LLM converge with the mathematical fusion" comparison, but it is not a fusion input.

---

## B. MATHEMATICAL MODEL

**Frame of discernment.** Θ = {R, ¬R}, where R = "this architectural finding is a substantiated risk" and ¬R = "this finding is not substantiated." This is a binary frame, the standard and simplest DST setup, and matches the R/¬R/Θ notation already specified.

**Power set and mass function.** The focal elements we assign mass to are {R}, {¬R}, and Θ itself (= {R,¬R}, meaning "could be either — total ignorance between the two"). A mass function m: 2^Θ → [0,1] must satisfy m(∅) = 0 and Σ m(A) = 1 over all A ⊆ Θ. For our binary frame this reduces to three numbers that must sum to 1:

```
m(R) + m(¬R) + m(Θ) = 1
```

**Belief and plausibility.** For a binary frame:

```
Bel(R) = m(R)
Pl(R)  = m(R) + m(Θ) = 1 - m(¬R)
```

Bel(R) is the minimum defensible probability of R given the evidence (only mass directly committed to R). Pl(R) is the maximum defensible probability (everything not directly committed against R). The interval [Bel(R), Pl(R)] is the honest range; its width equals m(Θ) exactly. This interval — not a single number — is what DST offers that a plain probability doesn't: a first-class representation of "we don't know," rather than forcing ignorance to be smeared arbitrarily across a point estimate.

**Dempster's rule of combination.** For two independent mass functions m1, m2 over the same Θ, the combined mass is:

```
m12(A) = (1 / (1-K)) * sum over all (B,C) with B∩C=A of  m1(B)*m2(C)      for A ≠ ∅
m12(∅) = 0
K = sum over all (B,C) with B∩C=∅ of  m1(B)*m2(C)
```

K is the **conflict mass** — the total probability mass assigned to pairs of statements that flatly disagree (one source says R, the other says ¬R). Expanded for our three focal elements (R, ¬R, Θ):

```
K            = m1(R)*m2(¬R) + m1(¬R)*m2(R)

m12(R)  = [ m1(R)*m2(R) + m1(R)*m2(Θ) + m1(Θ)*m2(R) ] / (1-K)
m12(¬R) = [ m1(¬R)*m2(¬R) + m1(¬R)*m2(Θ) + m1(Θ)*m2(¬R) ] / (1-K)
m12(Θ)  = [ m1(Θ)*m2(Θ) ] / (1-K)
```

**Known limitation, stated explicitly (relevant to test case 6 below):** when K = 1 (total conflict — one source certain of R, the other certain of ¬R), the (1-K) denominator is zero and the combination is mathematically undefined. This is a well-documented weakness of Dempster's rule (Zadeh's counterexample), not an implementation bug. The Node 17 implementation must detect this case and report it explicitly rather than dividing by zero or silently producing a number.

**Pignistic transformation (BetP).** A single decision-oriented number, for reporting only:

```
BetP(R) = m(R) + m(Θ)/2
```

This is required by the spec to be labeled explicitly as a decision transform, not evidence, and never described as proof of calibration.

---

## C. EVIDENCE MAPPING

Two independent mass assignments are built per finding — one from Node 16, one from the Evidence Review Agent. Neither is invented; both are direct, stated transformations of data those nodes already produce.

### C.1 — Node 16 → mass assignment (deterministic side)

Using Node 16's own per-*proposition* counts for the finding (not the coarser 6-value finding-level label):

```
N_total       = total propositions for this finding
N_supported   = count with status SUPPORTED
N_contradicted = count with status CONTRADICTED
N_unresolved  = count with status UNRESOLVED

m_det(R)  = N_supported / N_total
m_det(¬R) = N_contradicted / N_total
m_det(Θ)  = N_unresolved / N_total
```

This is a direct read of existing counts, not an invented weighting scheme — but it is honest to note that treating every proposition as an equally-weighted "vote" *is itself* a modeling choice (uniform weighting), just the simplest and most transparent one available, not the absence of a choice.

**Required sensitivity view.** Every one of the 11 findings currently has exactly one EXPERIMENT-type proposition, and every one of those is UNRESOLVED (no Foundry behavioural experiments have been executed yet — this is a known, already-documented gap, not new). That means the primary mass assignment above has an identical, artificial uncertainty floor baked into every single finding, which could mask genuine differences in relative uncertainty between findings. Per the resolution given, Node 17 computes and reports **both**:

```
Primary view    — includes the EXPERIMENT proposition (as above)
Sensitivity view — excludes it:
  N_total'        = N_total - N_experiment_propositions
  N_unresolved'   = N_unresolved - N_experiment_propositions (currently always -1)
  m_det'(R)  = N_supported / N_total'
  m_det'(¬R) = N_contradicted / N_total'
  m_det'(Θ)  = N_unresolved' / N_total'
```

**Methodological consequence to state plainly:** the primary view treats "we haven't behaviourally tested this yet" as real, first-class evidential uncertainty — arguably correct, since an untested code path genuinely is less certain than a tested one. The sensitivity view asks a narrower question — "given only the evidence types we currently have full coverage for, how confident are we" — and removes a uniform floor that is currently identical across all 11 findings and therefore cannot, by itself, explain any *difference* between findings. Neither view is objectively more correct; they answer different questions, and both are reported so the choice is visible rather than silently made.

### C.2 — Node 07 (raw) → mass assignment (LLM side, CORRECTED)

**Superseded by the independence fix above.** The fusion's LLM-side mass now comes from Node 07's raw output, not the Evidence Review Agent, because Node 07 is the only LLM-touching node in this pipeline that has never seen Node 16.

Node 07 gives one number per finding — `confidence` (0–1) — and structurally never asserts ¬R: it is a risk-*identification* agent, every finding it emits is a proposed R, it has no mechanism for proposing "this is definitely not a risk." That makes its mass mapping simpler than a categorical-assessment source would need:

```
m_07(R)  = confidence
m_07(¬R) = 0
m_07(Θ)  = 1 - confidence
```

This is used only as an input to Dempster combination. For comparison/divergence purposes (Section D), Node 07's original `confidence` number is compared directly — not a pignistic-transformed round-trip of `m_07`, since transforming mass back to a point value via BetP would artificially move the number (BetP of `m_07` is `confidence + (1-confidence)/2`, not `confidence` itself) purely as an artifact of the mass conversion, not because the LLM's original statement changed. Comparisons always use Node 07's original number directly.

*(The Evidence Review Agent's `review_assessment` / `review_confidence` mapping described in the original draft of this section — categorical branching over Supported / Contradicted / Partially Supported / Outside Scope — remains valid and useful, just repurposed: it is used only for the optional secondary "holistic LLM vs. mathematical fusion" comparison in Node 18, never as a Dempster-combination input.)

---

## D. COMPARISON METHODOLOGY

Two distinct comparisons happen in this design, at two different stages. They are kept separate and separately named, because the original brief uses "divergence" for both and conflating them would make the eventual code ambiguous.

**CORRECTED — D.1 and D.2 now collapse into one comparison**, because Node 07 raw is both the fusion's LLM-side input *and* the Experiment 1 baseline (see the independence fix above). There is now exactly one "LLM view" per finding to compare against the fused result, not two subtly different ones.

```
Experiment 1 (LLM-only)  = Node 07's original confidence for this finding, used directly
                            (not a pignistic round-trip of m_07 — see C.2 for why)
Experiment 2 (grounded)  = Node 17's BetP(R), plus the full [Bel(R), Pl(R)] interval

divergence.absolute_difference = | Experiment_2.BetP - Experiment_1.confidence |     <- PRIMARY metric
divergence.threshold           = <configurable parameter, e.g. 0.15 — explicitly labeled
                                   an engineering/evaluation threshold, not a validated constant>
divergence.flag                = absolute_difference > threshold
divergence.interval_position   = "below_belief" | "within_interval" | "above_plausibility"
                                   (descriptive only — see correction below)
```

**CORRECTION (post-review):** an earlier version of this section treated `Bel(R) <= Experiment_1.confidence <= Pl(R)` as "the concrete, operational test for overconfidence." That framing is wrong, not just loosely worded, and has been removed. `[Bel(R), Pl(R)]` is the range of probabilities consistent with the *combined* evidence — it was never a confidence interval that Node 07's raw, single-source number was supposed to fall inside, and falling outside it is not by itself evidence that Node 07 was overconfident.

**Proof this framing was broken.** Because Node 07 never asserts ¬R (Section C.2), whenever Node 16 shows no contradiction (t=0), the combined belief simplifies to `combined_R = s + c(1-s)` (Section G), so:

```
combined_R - c = s(1-c)   ≥ 0  for any c ∈ [0,1], s ≥ 0
```

This is non-negative *unconditionally* — so "Node 07's confidence falls below Bel(R)" is structurally guaranteed whenever Node 16 shows any support and no contradiction, regardless of whether Node 07's number was itself well-calibrated. It is not evidence about the specific finding; it is a mechanical consequence of the mass structure. Checked against the general case (t possibly > 0): `combined_R - c = (1-c)(s-ct)/(1-ct)`, which is still non-negative whenever `s > ct` — true for every real finding observed in this project so far, including the contradiction cases F05 and F10, since deterministic support has consistently outweighed conflict. The only direction that is *not* structurally guaranteed, and therefore actually informative, is `interval_position = "above_plausibility"` — a case where Node 07's raw confidence exceeds what even the combined evidence supports. `"below_belief"` should be reported as a descriptive fact, never narrated as a finding-specific overconfidence result.

The **primary, headline comparison metric is `divergence.absolute_difference = |confidence - BetP(R)|`**, exactly as specified in the original brief. `interval_position` is retained as supplementary descriptive information about where the raw number sits relative to the combined range, not as a pass/fail diagnostic.

**Secondary, non-core comparison (optional):** the Evidence Review Agent's `review_assessment`/`review_confidence` (fully informed, including having seen Node 16) can still be reported alongside the DST fusion result, to see whether a holistic LLM judgment and the mathematically-fused result land in the same place. This is interesting supporting context, not part of the core hypothesis test, and must not be described as a second independent fusion input.

**Interval width comparison** (addresses research question 1 — does DST reveal uncertainty the LLM misses):

```
uncertainty_revealed = m12(Θ)  compared against  0   (Node 07 has no uncertainty term to compare against —
                                                        this comparison itself IS the finding: the LLM-only
                                                        output structurally cannot express "I don't know",
                                                        the grounded output can)
```

---

## E. CALIBRATION METHODOLOGY — what can and cannot be claimed

Split explicitly into three tiers, per the requirement not to confuse these claims.

**E.1 — Mathematically proven (no data required, established by the math itself + verified by Section F tests).**

- m(R) + m(¬R) + m(Θ) = 1 always holds, for any valid input, by construction of the mass functions above.
- Bel(R) ≤ Pl(R) always holds — a direct consequence of the belief/plausibility definitions.
- Dempster's combination rule is implemented correctly — verified, not assumed, by the seven synthetic test cases in Section F.
- Node 16 is deterministic: identical input always produces an identical categorical output. This is a property of the code (no LLM calls, no randomness in that path), verifiable by static inspection and by the self-verification block already built into Node 16, and does not require repeated empirical runs to establish.
- The DST math functions in Node 17 are themselves pure and deterministic: identical mass inputs always produce identical combined output. Also verifiable directly, not by repeated sampling.

**E.2 — Empirically testable with the current 11 findings (real measurement, no ground truth needed).**

- Whether the Evidence Review Agent's output varies across repeated runs on identical input (Section E.3 below) — this requires actually executing it multiple times and measuring real variance; it cannot be asserted from the architecture alone, because an LLM call is not provably deterministic the way Node 16 is.
- Whether divergence exists between the LLM's own view and the grounded/fused view across the 11 real findings — already observed directly in this project's own data (F05 and F10 diverge; the other 9 largely agree). This is real, not fabricated, and can be reported as-is.
- Whether fusion narrows the uncertainty interval relative to what the ungrounded LLM implicitly claimed, across the 11 findings — directly computable from real outputs, since this compares two representations of belief against each other, not against an external truth.

**E.3 — Reproducibility experiment (resolution 3, required before any reproducibility claim is made).**

Node 16 and the DST math are deterministic by construction (E.1) and do not need a repeated-run experiment to establish that — that would be redundant with proving it mathematically. **Corrected target:** because Node 17's fusion now takes Node 07 (not the Evidence Review Agent) as its LLM-side input, Node 07 is the LLM-touching node that actually determines Node 17/18's reproducibility — whatever variance exists in Node 07's raw confidence propagates 1:1 into the fused output, since the DST math itself adds no additional variance (it's a pure function). The Evidence Review Agent's own run-to-run stability remains a legitimate, separate question worth measuring (it feeds the secondary comparison in D.1), but it is no longer on the critical path for testing the core hypothesis. Design:

```
For a fixed set of real findings (recommend: all 11, or at minimum F05 and F10 since they already
show contradiction, plus 2-3 stable ones for contrast):

  Run Node 07 N times (recommend N >= 5, ideally 10) on byte-identical input (same architecture
  reconstruction). Optionally also run the Evidence Review Agent N times for the secondary comparison.

  For each Node 07 run, record:
    confidence per finding, m_07(R)/(¬R)/(Θ),
    and (after re-running the fusion math against the same fixed Node 16 output) m12, conflict K,
    Bel(R), Pl(R), BetP(R), and the divergence values from Section D.

  Report, per finding, across the N runs:
    - confidence: mean, standard deviation, min, max, range
    - m_07(R)/(¬R)/(Θ): mean and standard deviation per component
    - downstream DST outputs (m12, Bel, Pl, BetP, conflict): mean and standard deviation
    - divergence: mean and standard deviation

  This directly answers research question 4 ("how reproducible are the deterministic/DST outputs")
  by contrast: Node 16 and the DST math are shown reproducible by proof, not measurement; Node 07's
  reproducibility (or lack of it) — and by direct propagation, the fused output's reproducibility —
  is shown by this measurement, not assumed.
```

The pipeline as a whole must **not** be described as deterministic — only its non-LLM components are. This experiment is what makes that distinction defensible with actual numbers rather than an assertion.

**E.4 — Cannot be established with the current 11 findings and no independent ground truth.**

- Brier score, calibration error, reliability diagrams, or any formal "overconfidence/underconfidence" statistic in the calibration-literature sense. All of these require, for each finding, an independently determined true/false outcome — obtained from something other than Node 16, since Node 16 is part of the system being evaluated and using it as ground truth would be circular. The only independent evidence in this pipeline is the real Sigma Prime audit, and it covers exactly 2 implementation-level informational issues, neither of which maps to an independent true/false verdict on any of the 11 architectural findings. Consequence: Node 18 must set `ground_truth = UNAVAILABLE` for essentially all 11 findings and must **not** compute Brier/calibration-error metrics against a substitute. If the code path for these metrics is reached with `ground_truth = UNAVAILABLE`, it must report that explicitly rather than skip silently or fall back to a proxy.
- Any claim of statistical significance across findings (p-values, confidence intervals over the 11-finding population). n=11 is far too small for population-level inference. Individual findings can and should be discussed qualitatively and specifically (e.g., "F05 and F10 show conflict values of X and Y, here is why"), but the results must not be generalized into a claim like "grounded assessments are calibrated to within Z% in general."

---

## F. VALIDATION TESTS

Seven synthetic cases, computed by hand below so the expected values in the code are independently checked, not just asserted. Tolerance for `passed`: |expected − actual| < 1e-6 on each mass/belief/plausibility component, except case 6 (see below).

**1. Support + Support** — `m1=(R:0.90, ¬R:0.00, Θ:0.10)`, `m2=(R:0.85, ¬R:0.00, Θ:0.15)`
Expected: K=0, `m12=(R:0.985, ¬R:0.000, Θ:0.015)`, Bel(R)=0.985, Pl(R)=1.000. Two agreeing sources should reinforce each other and leave almost no uncertainty.

**2. Contradiction + Contradiction** — `m1=(R:0.00, ¬R:0.90, Θ:0.10)`, `m2=(R:0.00, ¬R:0.85, Θ:0.15)`
Expected (by symmetry with case 1): K=0, `m12=(R:0.000, ¬R:0.985, Θ:0.015)`, Bel(¬R)=0.985.

**3. Support + Contradiction** — `m1=(R:0.90, ¬R:0.00, Θ:0.10)`, `m2=(R:0.00, ¬R:0.85, Θ:0.15)`
Expected: K = 0.90×0.85 = 0.765 (high conflict). Raw R = 0.135, raw ¬R = 0.085, raw Θ = 0.015 (sums to 0.235 = 1−K, confirming the algebra). Normalized: `m12 = (R:0.5745, ¬R:0.3617, Θ:0.0638)` (verified numerically, not just by hand). This is the F05/F10 pattern: even though a combined answer is produced, K=0.765 is the signal that the two sources genuinely disagree — the test asserts K is high, not just that the masses sum to 1.

**4. Support + Uncertainty** — `m1=(R:0.90, ¬R:0.00, Θ:0.10)`, `m2=(R:0.00, ¬R:0.00, Θ:1.00)`
Expected: K=0, `m12 = m1` unchanged: `(R:0.90, ¬R:0.00, Θ:0.10)`. Proves Θ acts as the identity element under combination — pure ignorance from one source should not alter an informed second source.

**5. Contradiction + Uncertainty** — symmetric to case 4: `m1=(R:0.00, ¬R:0.90, Θ:0.10)`, `m2=(R:0.00, ¬R:0.00, Θ:1.00)` → `m12 = m1` unchanged.

**6. Complete Conflict** — `m1=(R:1.00, ¬R:0.00, Θ:0.00)`, `m2=(R:0.00, ¬R:1.00, Θ:0.00)`
Expected: K = 1.0 exactly → (1−K) = 0 → combination is **undefined**. The test asserts the implementation detects K ≥ 1 − ε and returns an explicit "undefined, total conflict" result rather than NaN or a divide-by-zero exception. `passed` here means "correctly refused to produce a number," not "produced the expected numeric masses."

**7. No Conflict (one certain source dominates)** — `m1=(R:1.00, ¬R:0.00, Θ:0.00)`, `m2=(R:0.70, ¬R:0.00, Θ:0.30)`
Expected: K=0, `m12=(R:1.00, ¬R:0.00, Θ:0.00)`. A fully certain source is unaffected by a second, merely-uncertain source pointing the same direction — there is nothing for it to conflict with.

Every test row reports `{expected, actual, error, passed}` exactly as specified. These tests establish that the DST arithmetic is implemented correctly. They say nothing about the real-world findings and must not be cited as evidence of empirical validity — that distinction is stated directly in the test report's own preamble in the code.

---

## G. STRUCTURAL SENSITIVITY ANALYSIS — proof of the belief-compression bound

**Why this section exists.** After the Node 07 confidence-calibration fix (Section on Node 07 elsewhere — the prompt's CONFIDENCE tier no longer being trivially satisfied by "evidence exists"), a live 11-finding run was inspected and looked suspiciously flat: Node 07's raw confidence spans 0.60–0.95 (range 0.35) across the 11 findings, and Node 16's status spans `FULLY_SUPPORTED` through `MIXED_SUPPORT_AND_CONTRADICTION` and `UNRESOLVED` — yet the fused `belief_R` only spans 0.900–0.9875 (range 0.0875), and the pignistic `BetP(R)` spans only 0.95–0.99375 (range 0.044). This section proves, algebraically, that this compression is a structural property of the current fusion setup — not an implementation bug, not noise, and not evidence the fusion "isn't working."

**Proposition.** Let Node 07's mass be `m1 = (R: c, ¬R: 0, Θ: 1−c)`, where `c` is Node 07's raw confidence. (This form is exact, not approximate — established in Section C.2: Node 07 is a risk-*identification* agent and structurally never asserts ¬R.) Let Node 16's mass (primary view, Section C.1) be `m2 = (R: s, ¬R: t, Θ: 1−s−t)`, where `s` is the finding's supported-proposition fraction and `t` its contradicted-proposition fraction. Substituting into Dempster's rule (Section B):

```
K = m1(R)·m2(¬R) + m1(¬R)·m2(R) = c·t

combined_R(c, s, t) = [ c·(1−t) + s·(1−c) ] / (1 − c·t)
```

When there is no deterministic contradiction (`t = 0` — true for 9 of the 11 real findings in the run under discussion), this reduces **exactly** to:

```
combined_R(c) = s + c·(1 − s)
```

an affine function of `c` with slope `(1 − s)`, independent of `c`. Consequently:

> **The fused belief's sensitivity to the LLM's own confidence is capped at (1 − s), where s is the deterministic support fraction — by algebra, not by chance or implementation choice.**

**Numerical verification against the real pipeline (not a synthetic example).** The closed form above was checked against all 11 findings from a live run of the actual pipeline:

| id | c (Node 07 conf.) | s (det. support) | t (det. contradiction) | formula prediction | actual Node 17 output | match |
|---|---|---|---|---|---|---|
| F01 | 0.95 | 0.750000 | 0 | 0.987500 | 0.9875 | ✓ |
| F02 | 0.95 | 0.666667 | 0 | 0.983333 | 0.983333 | ✓ |
| F03 | 0.95 | 0.750000 | 0 | 0.987500 | 0.9875 | ✓ |
| F04 | 0.95 | 0.750000 | 0 | 0.987500 | 0.9875 | ✓ |
| F05 | 0.95 | 0.500000 | 0.25 | 0.967213 | 0.967213 | ✓ |
| F06 | 0.95 | 0.750000 | 0 | 0.987500 | 0.9875 | ✓ |
| F07 | 0.95 | 0.750000 | 0 | 0.987500 | 0.9875 | ✓ |
| F08 | 0.95 | 0.500000 | 0 | 0.975000 | 0.975 | ✓ |
| F09 | 0.95 | 0.750000 | 0 | 0.987500 | 0.9875 | ✓ |
| F10 | 0.90 | 0.500000 | 0.25 | 0.935484 | 0.935484 | ✓ |
| F11 | 0.60 | 0.750000 | 0 | 0.900000 | 0.9 | ✓ |

All 11 match to within 1e-5. This is a verified closed form, not a fitted approximation.

**Why the compression happens, quantified.** Seven of the 11 findings have `s = 0.75` (3 of 4 propositions supported), giving slope `(1 − 0.75) = 0.25`. Over the observed confidence range of 0.35 (0.60 to 0.95), that predicts a fused-belief range of `0.25 × 0.35 = 0.0875` — matching the ~0.09 range actually observed. Where `s` is smaller (F02: s=0.667, F08: s=0.5), the slope is correspondingly larger (0.333, 0.5), giving those findings more sensitivity to `c` — consistent with the mechanism, not an exception to it. Where `t > 0` (F05, F10 — genuine deterministic contradiction), the numeric derivative of the full (non-simplified) formula is steeper still (≈0.62–0.65 at the observed points), because conflict mass K partially offsets the flattening effect of high `s` — though as established in Section D, that conflict is absorbed into K rather than lowering `combined_R` directly, which is the separate, already-documented Dempster limitation.

**Root causes, in order of contribution:**

1. **Node 16's proposition-count granularity.** Each finding currently has only 3–4 total propositions, so `s` and `t` can only take a small set of values (multiples of 1/4 or 1/3). This is the dominant structural constraint: it fixes the slope `(1−s)` to one of a handful of discrete values regardless of how much genuine evidentiary difference exists between findings.
2. **Node 07's own confidence clustering.** Even after the CONFIDENCE-section fix, 9 of 11 findings still land on exactly 0.95 — a real but only partially resolved source of additional flatness in `c` itself (see the Node 07 fix discussion). Because `combined_R` is affine in `c`, any residual clustering in `c` propagates directly (scaled by slope) into `combined_R`.
3. **Dempster's conflict-absorption behavior** (Section B's stated limitation): where `t > 0`, disagreement is expressed through `K`, not through a proportional reduction in `combined_R`. This is why F05/F10 do not show markedly *lower* belief despite real contradiction — it is the same limitation already flagged, now shown to interact with the compression above rather than counteract it.

**What this does and does not license claiming.** This proves the *mechanism* of the flatness precisely and reproducibly — it is not an argument that the fusion is "broken," nor that it should be tuned to look more spread out. Artificially increasing the spread (e.g., via an arbitrary rescaling of `combined_R`, or discounting chosen specifically to make outputs "look less extreme") would be exactly the kind of unjustified precision this project's methodology has consistently avoided elsewhere. The correct methodological response is to report the bound as a genuine, proven property of the current evidence-granularity and combination-rule choice: **any future increase in Node 16's proposition granularity would mechanically raise this sensitivity bound**, which is itself a testable, falsifiable prediction of this proposition, not just a description of the current run.

---

## Summary table — what this design lets you claim

| Claim | Status |
|---|---|
| Node 16 is deterministic | Mathematically/structurally proven |
| Node 17's DST math is implemented correctly | Proven by Section F self-tests |
| m(R)+m(¬R)+m(Θ)=1, Bel≤Pl | Proven by construction, checked at runtime |
| Fused belief's sensitivity to Node 07's confidence is bounded by (1−s), where s = Node 16's supported-proposition fraction | Proven algebraically (Section G), verified against all 11 real findings to <1e-5 |
| The Evidence Review Agent's outputs are reproducible | Unknown until E.3 experiment is run — must not be assumed |
| Divergence exists between LLM-only and grounded views on real findings | Empirically observed (already true for F05, F10) |
| Grounding narrows the LLM's implicit uncertainty | Empirically testable per finding, no ground truth needed |
| Divergence between Node 07 and the fused result (\|confidence − BetP(R)\|) | Empirically testable per finding, no ground truth needed — this is the primary comparison metric |
| Grounding reduces overconfidence (via interval containment) | **Retracted as originally framed** — proven structurally guaranteed in the "below Bel" direction whenever t=0, so not diagnostic on its own (Section D correction). Only `interval_position = "above_plausibility"` is a genuinely informative direction. |
| The grounded system is better *calibrated* (Brier score etc.) | **Not establishable** with 11 findings and no independent ground truth — must be reported as `UNAVAILABLE`, not estimated |
| Results generalize statistically beyond these 11 findings | **Not establishable** — n=11 is not a sample size that supports population-level inference |

Ready to move to code for Node 17 and Node 18 on this basis, unless you want changes to any section first.
