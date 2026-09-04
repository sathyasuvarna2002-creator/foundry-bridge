/***********************************************************************
 * NODE 18 — DETERMINISTIC GROUNDING EFFECT EVALUATION (COMPOUND VARIANT)
 * VERSION 2.2-COMPOUND
 *
 * v2.1 -> v2.2: added `disclosure_funnel` to the final output. Purely
 * additive -- re-aggregates fields this node already computes
 * (fusion_applicable, deterministic_status, UNMAPPED-* finding_ids) into
 * an "Identified -> Matched to a canonical claim -> Cross-validated ->
 * Fully supported" breakdown. Does not change per_finding, excluded,
 * aggregate_evaluation, or any existing field's value. Added because a
 * bare post-fusion finding count (e.g. "2") looks weaker than the run
 * actually was -- most of the difference between "candidate findings
 * surfaced" and "findings cross-validated" is the matcher correctly
 * declining to force weak matches, not evidence going missing. See
 * DISCLOSURE FUNNEL section below for the full derivation and disclosure
 * language.
 *
 * Compound counterpart to 18_grounding_effect_evaluation_venus.js
 * (v2.1-venus). Like Venus, this node's core logic never assumed a
 * fixed F01-F11 taxonomy -- it iterates whatever finding_ids Node 17
 * actually output, so the Compound adaptation is small: real changes
 * below, not a rebuild.
 *
 * CHANGES FROM THE VENUS VERSION:
 *
 * 1. Node name candidates for the Node 17 lookup now include Compound's
 *    real canvas name (`15_DST_Evidence_Fusion`, confirmed this
 *    session), not just the Aave/Venus names.
 *
 * 2. `finding_polarity` / `status_interpretation` are now passed
 *    through onto every `per_finding` entry, copied verbatim from Node
 *    17 (Compound). Additive only -- does not change the CONFLICT /
 *    AGREEMENT / DETERMINISTIC_GROUNDING_INCREASE / DECREASE
 *    categorization logic below, which is unchanged from Venus.
 *
 * 3. A NEGATIVE_CONTROL-polarity finding (`UPGRADEABILITY_01` under the
 *    current Compound spec) needs an explicit reading-direction caveat
 *    that neither Aave nor Venus needed, because neither has a negative
 *    control. See NEGATIVE CONTROL READING NOTE below -- read it before
 *    interpreting `direction`/`change`/category on any finding whose
 *    finding_polarity is NEGATIVE_CONTROL, if one is ever
 *    fusion_applicable=true in a future run (this run it is not, and is
 *    excluded the same way any fusion_applicable=false finding is).
 *
 * 4. `excluded_findings` in methodology now separately calls out how
 *    many exclusions are `fusion_applicable=false` (Compound's
 *    UNMAPPED-* and UNMAPPED-AUDIT-* findings plus the negative
 *    control's typical no-Node07-counterpart case) versus other reasons
 *    -- Compound runs are expected to have a much larger excluded count
 *    than Aave/Venus by design, since its spec is smaller (5 canonical
 *    keys) and its unmapped pool draws from BOTH Node 07 and Node 08,
 *    not just Node 08. A large `excluded` array here is not evidence of
 *    a grounding-effect failure; see UNMAPPED VOLUME NOTE below.
 *
 * Everything else -- the CONFLICT-takes-priority-over-AGREEMENT category
 * logic, the K>0 structural (not invented) boundary, the reuse of Node
 * 17's own divergence.threshold rather than a new constant, the
 * explicit exclusion (never silent-drop) of undefined findings, and the
 * hard refusal to compute formal calibration without ground truth -- is
 * unchanged, because none of it depended on a fixed taxonomy or on the
 * absence of a negative control in the first place.
 *
 * ARCHITECTURE (frozen -- this node does not modify or second-guess any
 * of it):
 *   Node 07     -- probabilistic/LLM baseline (raw confidence per finding)
 *   Node 13/16  -- deterministic evidence specification + anchor
 *                  (Compound). Unlike Aave/Venus, Node 13 (Compound)
 *                  both declares AND evaluates every predicate inline;
 *                  Node 16 re-expresses that in the shared K3 shape.
 *                  Frozen, read-only, NOT ground truth.
 *   Node 17     -- Dempster-Shafer fusion of Node 07 (via Node 13's
 *                  already-resolved confidence) + Node 16 (Compound).
 *                  Produces belief_R, plausibility_R, pignistic_R
 *                  (BetP), m_R, m_notR, m_Theta, K (conflict), and
 *                  divergence (D = |confidence - BetP|, already
 *                  computed by Node 17, not recomputed differently
 *                  here). Also carries finding_polarity,
 *                  status_interpretation, and (only for the negative
 *                  control) dst.primary.polarity_warning.
 *   ERA         -- explanatory/narrative only. NOT an evidence source.
 *                  NOT fed back into this evaluation.
 *
 * THE ONE QUESTION THIS NODE ANSWERS:
 *   How much does deterministic evidence change the probabilistic LLM
 *   assessment?
 *
 * NEGATIVE CONTROL READING NOTE
 * ----------------------------------------------------------------------
 * `change = dst_betp - llm_confidence` and `direction` (INCREASED /
 * DECREASED / UNCHANGED) are computed identically for every finding
 * regardless of polarity -- this node does not invent a different
 * formula for NEGATIVE_CONTROL findings, the same discipline Node 17
 * uses for its own DST mass. What changes is only how a human should
 * INTERPRET the result: for a NEGATIVE_CONTROL finding, "R" means the
 * STATED ABSENCE claim, so a positive `change` (deterministic evidence
 * raised confidence) means deterministic evidence raised confidence
 * that the risk is RULED OUT, not that it is more likely present. Any
 * consumer of `per_finding` must check `finding_polarity` before
 * describing a NEGATIVE_CONTROL finding's `direction`/`category` in
 * risk language. This run, `UPGRADEABILITY_01` is fusion_applicable =
 * false (no Node 07 counterpart claimed it), so it is excluded from
 * per_finding/aggregate_evaluation entirely and this caveat is
 * currently moot in practice -- it is documented here so it is not
 * missed the first time a future run does produce a real Node 07
 * counterpart for it.
 *
 * UNMAPPED VOLUME NOTE
 * ----------------------------------------------------------------------
 * Compound's COMPOUND_SPEC has 5 canonical keys (smaller than Aave's 11
 * and Venus's 6, deliberately -- see 13_deterministic_evidence_
 * specification_compound.js's own build notes on why canonical status
 * requires real backing evidence rather than being padded), and its
 * anchor-token matcher draws candidate findings from BOTH Node 07 and
 * Node 08, unlike Venus which only ever saw audit-sourced unmapped
 * findings. A Compound run can therefore legitimately have most of its
 * findings land in `excluded` as fusion_applicable=false -- that is the
 * matcher correctly declining to force matches, not this node or Node
 * 17 failing to ground anything. See `grounding_effect.
 * unmapped_volume_note` below for the actual counts this run.
 *
 * WHAT THIS NODE DELIBERATELY DOES NOT DO (unchanged from Aave/Venus):
 *   - Does not invent a formal calibration score.
 *   - Does not treat Node 16 as ground truth.
 *   - Does not claim a higher DST value means the system became more
 *     accurate -- "change" is measured, not "improvement."
 *   - Does not compute Brier score, ECE, accuracy, or any metric that
 *     requires an independent ground-truth outcome (none exists for
 *     Compound's findings either -- see formal_calibration section).
 *   - Does not invent a new threshold for "high" conflict/uncertainty.
 *     It reuses Node 17's own divergence.threshold (already disclosed
 *     as an engineering parameter) for all "is this notable" checks,
 *     rather than fabricating additional constants.
 *   - Does not silently fill in missing or undefined values. Findings
 *     Node 17 reported as mathematically undefined (total conflict,
 *     K approx 1), or with no real Node 07 counterpart at all
 *     (fusion_applicable: false), are reported separately, excluded
 *     from the numeric aggregates, and counted explicitly -- never
 *     defaulted to zero or dropped without a trace.
 *   - Does not re-interpret a NEGATIVE_CONTROL finding's direction as
 *     risk language on this node's own initiative -- it passes through
 *     finding_polarity/status_interpretation and documents the caveat
 *     above rather than silently flipping the sign of `change`.
 ***********************************************************************/

// ======================================================================
// INPUT
// ======================================================================

function getNodeJSON(name) {
    try {
        return $(name).first().json;
    } catch (e) {
        return null;
    }
}

const NODE_17_CANDIDATES = [
    "15_DST_Evidence_Fusion",
    "17_DST_Evidence_Fusion_Compound",
    "17_dst_evidence_fusion_compound",
    "17_DST_Evidence_Fusion",
    "Node 17"
];
let node17 = null;
for (const name of NODE_17_CANDIDATES) {
    const data = getNodeJSON(name);
    if (data) { node17 = data; break; }
}

if (!node17 || !Array.isArray(node17.findings) || node17.findings.length === 0) {
    throw new Error(
        "Node 18 (Compound): no valid Node 17 output found. This node evaluates Node 17's fused output " +
        "and cannot run without it. Tried: " + NODE_17_CANDIDATES.join(", ") + "."
    );
}

if (!node17.self_tests || node17.self_tests.all_passed !== true) {
    throw new Error(
        "Node 18 (Compound): Node 17's self-tests did not report all_passed = true. Refusing to evaluate " +
        "grounding effect on top of a fusion stage whose own mathematical correctness is not confirmed."
    );
}

// ======================================================================
// HELPERS
// ======================================================================

function round(x, dp) {
    if (x === null || x === undefined || Number.isNaN(x)) return null;
    const f = Math.pow(10, dp);
    return Math.round((x + Number.EPSILON) * f) / f;
}

function mean(arr) {
    if (arr.length === 0) return null;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// The ONLY threshold anywhere in this node: Node 17's own divergence.threshold,
// used ONLY for divergence_count / the AGREEMENT vs GROUNDING_INCREASE/DECREASE
// category (its defined role). Pulled from Node 17's actual output rather than
// hardcoded here, so if that engineering parameter ever changes, this node
// follows it rather than silently drifting out of sync. Deliberately NOT
// applied to K (conflict) or m_Theta (uncertainty) -- those are reported as raw
// values only, since 0.15 has no justified meaning for either.
const THRESHOLD = node17.findings
    .map(f => f.dst && f.dst.primary && f.dst.primary.divergence && f.dst.primary.divergence.threshold)
    .find(t => typeof t === "number");

if (typeof THRESHOLD !== "number") {
    throw new Error(
        "Node 18 (Compound): could not find Node 17's divergence.threshold in any finding. This node reuses " +
        "that value rather than inventing its own and cannot proceed without it."
    );
}

// ======================================================================
// PER-FINDING EXTRACTION AND EVALUATION
// ======================================================================

const perFinding = [];
const excluded = [];

for (const f of node17.findings) {

    const dst = f.dst && f.dst.primary;
    const findingPolarity = f.finding_polarity || "STANDARD";

    if (!dst || dst.undefined) {
        excluded.push({
            finding_id: f.finding_id,
            finding_name: f.finding_name ?? null,
            finding_polarity: findingPolarity,
            reason: dst && dst.reason
                ? dst.reason
                : "Node 17 reported this finding's primary DST view as undefined (total conflict, K approx 1)."
        });
        continue;
    }

    // Compound-specific: a finding with no real Node 07 counterpart --
    // audit-only, an UNMAPPED-* / UNMAPPED-AUDIT-* entry (from either
    // source), or the negative control's typical no-independent-claim
    // case -- has fusion_applicable: false. There is no independent LLM
    // confidence for it, so no grounding-effect change can be measured.
    if (f.fusion_applicable === false) {
        excluded.push({
            finding_id: f.finding_id,
            finding_name: f.finding_name ?? null,
            finding_polarity: findingPolarity,
            reason: f.fusion_note ||
                "fusion_applicable=false: no real Node 07 counterpart exists for this finding (audit-only, " +
                "UNMAPPED-*/UNMAPPED-AUDIT-* entry, or the negative control's fallback path), so there is no " +
                "independent LLM confidence to measure a grounding effect against."
        });
        continue;
    }

    const llmConfidence = f.llm_evidence ? f.llm_evidence.confidence : null;
    const divergence = dst.divergence; // { absolute_difference, threshold, flag, ... }

    if (llmConfidence === null || llmConfidence === undefined || !divergence) {
        excluded.push({
            finding_id: f.finding_id,
            finding_name: f.finding_name ?? null,
            finding_polarity: findingPolarity,
            reason: "Missing llm_evidence.confidence or dst.primary.divergence -- cannot compute change without both."
        });
        continue;
    }

    const change = dst.pignistic_R - llmConfidence;
    const absoluteChange = Math.abs(change);

    let direction;
    if (Math.abs(change) < 1e-9) direction = "UNCHANGED";
    else if (change > 0) direction = "INCREASED";
    else direction = "DECREASED";

    // CONFLICT takes priority over AGREEMENT / grounding-increase / grounding-decrease.
    // Unchanged from the Aave/Venus versions -- see those files' docstrings for the
    // full derivation. K > 0 is a structural (not invented) boundary: whether
    // m1(R)*m2(notR) + m1(notR)*m2(R) is exactly zero, i.e. whether the two
    // sources contradicted each other at all.
    let category;
    if (dst.K > 0) {
        category = "CONFLICT";
    } else if (!divergence.flag) {
        category = "AGREEMENT";
    } else if (direction === "INCREASED") {
        category = "DETERMINISTIC_GROUNDING_INCREASE";
    } else {
        category = "DETERMINISTIC_GROUNDING_DECREASE";
    }

    perFinding.push({
        finding_id: f.finding_id,
        finding_name: f.finding_name ?? null,
        finding_polarity: findingPolarity,
        status_interpretation: f.status_interpretation ?? null,
        sources: f.sources ?? null,
        llm_confidence: round(llmConfidence, 6),
        deterministic_status: f.deterministic_evidence ? f.deterministic_evidence.finding_status : null,
        dst_belief: round(dst.belief_R, 6),
        dst_plausibility: round(dst.plausibility_R, 6),
        dst_betp: round(dst.pignistic_R, 6),
        conflict_K: round(dst.K, 6),
        uncertainty_m_Theta: round(dst.m_Theta, 6),
        divergence: {
            absolute_difference: divergence.absolute_difference,
            threshold: divergence.threshold,
            flag: divergence.flag
        },
        change: round(change, 6),
        absolute_change: round(absoluteChange, 6),
        direction,
        category,
        // Non-null only for NEGATIVE_CONTROL findings that reach this far
        // (i.e. did have a real Node 07 counterpart this run) -- see
        // NEGATIVE CONTROL READING NOTE in the header comment.
        polarity_reading_note: findingPolarity === "NEGATIVE_CONTROL"
            ? "NEGATIVE_CONTROL: direction/change above describe movement in confidence toward the STATED " +
              "ABSENCE claim, not toward the named risk being present. An INCREASED direction here means " +
              "deterministic evidence raised confidence that the risk is ruled out."
            : null
    });
}

// ======================================================================
// AGGREGATE STATISTICS (unchanged shape from the Aave/Venus versions)
// ======================================================================

const n = perFinding.length;
const llmConfidences = perFinding.map(f => f.llm_confidence);
const betps = perFinding.map(f => f.dst_betp);
const absChanges = perFinding.map(f => f.absolute_change);
const signedChanges = perFinding.map(f => f.change);
const conflicts = perFinding.map(f => f.conflict_K);
const uncertainties = perFinding.map(f => f.uncertainty_m_Theta);

const increased = perFinding.filter(f => f.direction === "INCREASED");
const decreased = perFinding.filter(f => f.direction === "DECREASED");
const unchanged = perFinding.filter(f => f.direction === "UNCHANGED");
const diverged = perFinding.filter(f => f.divergence.flag === true);

function findExtreme(list, keyFn, compareFn) {
    if (list.length === 0) return null;
    return list.reduce((best, cur) => (compareFn(keyFn(cur), keyFn(best)) ? cur : best));
}

const maxDivergenceFinding = findExtreme(perFinding, f => f.divergence.absolute_difference, (a, b) => a > b);
const maxIncreaseFinding = findExtreme(increased, f => f.change, (a, b) => a > b);
const maxDecreaseFinding = findExtreme(decreased, f => f.change, (a, b) => a < b);

const aggregate_evaluation = {
    finding_count: n,
    mean_llm_confidence: round(mean(llmConfidences), 6),
    mean_dst_betp: round(mean(betps), 6),
    mean_absolute_change: round(mean(absChanges), 6),
    mean_signed_change: round(mean(signedChanges), 6),
    increased_count: increased.length,
    decreased_count: decreased.length,
    unchanged_count: unchanged.length,
    divergence_count: diverged.length,
    mean_conflict_K: round(mean(conflicts), 6),
    mean_uncertainty: round(mean(uncertainties), 6),
    max_divergence_finding: maxDivergenceFinding
        ? { finding_id: maxDivergenceFinding.finding_id, absolute_difference: maxDivergenceFinding.divergence.absolute_difference }
        : null,
    max_increase_finding: maxIncreaseFinding
        ? { finding_id: maxIncreaseFinding.finding_id, change: maxIncreaseFinding.change }
        : { finding_id: null, change: null, note: "No finding showed a positive change." },
    max_decrease_finding: maxDecreaseFinding
        ? { finding_id: maxDecreaseFinding.finding_id, change: maxDecreaseFinding.change }
        : { finding_id: null, change: null, note: "No finding showed a negative change." }
};

// ======================================================================
// DISCLOSURE FUNNEL (v2.2 addition) -- "Identified vs Matched vs
// Validated", computed from node17.findings directly (the full,
// unfiltered population Node 17 fused this run -- not a new pipeline
// computation, purely a re-aggregation of numbers Node 16/17 already
// produced). This exists to answer a real, repeated concern: a bare
// "2 findings" headline in the report undersells a run where the
// architecture/audit review actually surfaced many more candidate
// findings than 2 -- most of them didn't fail, they were correctly
// disclosed as not matching Compound's small (5-key), strict
// deterministic taxonomy rather than force-fit into it. This section
// makes that funnel explicit and auditable; it introduces no new
// classification logic and changes no finding's status -- it reuses
// exactly the same fusion_applicable / deterministic_status fields the
// rest of this node already computes from.
// ======================================================================

function isUnmapped(findingId) {
    return /^UNMAPPED-/.test(findingId || "");
}

const allFindings = node17.findings;
const unmappedFindings = allFindings.filter(f => isUnmapped(f.finding_id));
const canonicalFindings = allFindings.filter(f => !isUnmapped(f.finding_id));
const canonicalValidated = canonicalFindings.filter(f => f.fusion_applicable === true);
const canonicalNotIndependentlyValidated = canonicalFindings.filter(f => f.fusion_applicable !== true);
const canonicalFullySupported = canonicalValidated.filter(
    f => f.deterministic_evidence && f.deterministic_evidence.finding_status === "FULLY_SUPPORTED"
);
const canonicalOtherStatus = canonicalValidated.filter(
    f => !(f.deterministic_evidence && f.deterministic_evidence.finding_status === "FULLY_SUPPORTED")
);

const disclosure_funnel = {
    label: "Findings Funnel (Compound) -- Identified vs Matched vs Validated",
    purpose:
        "Answers a specific, legitimate concern: a bare finding count after fusion (e.g. 2) can look weak " +
        "next to how many candidate findings the architecture/audit review actually surfaced this run. This " +
        "section re-aggregates numbers already produced elsewhere in this node and in Node 17 -- it introduces " +
        "no new classification logic and changes no finding's status or count anywhere else in this output.",
    total_findings_this_run: allFindings.length,
    stage_1_identified: {
        count: allFindings.length,
        note:
            "Every finding Node 16/17 (Compound) processed this run: candidate findings from Node 07 " +
            "(architecture) and/or Node 08 (audit) that anchor-token-matched one of Compound's 5 canonical " +
            "deterministic claims, candidate findings that did NOT match any of them (UNMAPPED-*/" +
            "UNMAPPED-AUDIT-*), and the always-on negative control (UPGRADEABILITY_01), which Node 13 checks " +
            "deterministically regardless of whether Node 07/08 independently raised it this run."
    },
    stage_2_matched_to_canonical_claim: {
        count: canonicalFindings.length,
        finding_ids: canonicalFindings.map(f => f.finding_id),
        not_matched_count: unmappedFindings.length,
        not_matched_finding_ids: unmappedFindings.map(f => f.finding_id),
        not_matched_note:
            `${unmappedFindings.length} candidate finding(s) did not anchor-token-match any of Compound's 5 ` +
            "canonical claims this run. This is the matcher correctly declining to force a weak or ambiguous " +
            "match, not a failure and not evidence being dropped -- every one is preserved and disclosed (see " +
            "Node 17's own findings array and ERA's unmapped_context) rather than discarded."
    },
    stage_3_cross_validated: {
        count: canonicalValidated.length,
        finding_ids: canonicalValidated.map(f => f.finding_id),
        no_independent_llm_claim_count: canonicalNotIndependentlyValidated.length,
        no_independent_llm_claim_finding_ids: canonicalNotIndependentlyValidated.map(f => f.finding_id),
        no_independent_llm_claim_note:
            canonicalNotIndependentlyValidated.length
                ? "These matched a canonical claim but had no independent Node 07 confidence and/or no Node 16 " +
                  "propositions to fuse against (typically the negative control's always-on fallback path, or " +
                  "an audit-only match) -- see fusion_note on each in Node 17's output. They are real, " +
                  "disclosed findings, just not eligible for the LLM-vs-evidence comparison this node measures."
                : "Every matched finding this run had an independent Node 07 confidence to cross-validate against."
    },
    stage_4_fully_supported: {
        count: canonicalFullySupported.length,
        finding_ids: canonicalFullySupported.map(f => f.finding_id),
        other_status_count: canonicalOtherStatus.length,
        other_status_detail: canonicalOtherStatus.map(f => ({
            finding_id: f.finding_id,
            status: f.deterministic_evidence ? f.deterministic_evidence.finding_status : null
        }))
    },
    plain_language_summary:
        `This run's analysis surfaced ${allFindings.length} candidate finding(s) across architecture review ` +
        `and audit ingestion. ${canonicalFindings.length} matched one of Compound's canonical, ` +
        `deterministically-checkable claims; of those, ${canonicalValidated.length} had both an independent ` +
        `LLM assessment and deterministic evidence available to cross-validate, and ` +
        `${canonicalFullySupported.length} of those were fully confirmed by that cross-validation. The ` +
        `remaining ${unmappedFindings.length} candidate finding(s) are disclosed as unmapped context rather ` +
        "than force-fit into a canonical category -- see ERA's unmapped_context and this node's `excluded` " +
        "array for the specific list and reasons."
};

// ======================================================================
// GROUNDING EFFECT (interpretive summary)
// ======================================================================

const conflictCount = perFinding.filter(f => f.category === "CONFLICT").length;
const agreementCount = perFinding.filter(f => f.category === "AGREEMENT").length;
const groundingIncreaseCount = perFinding.filter(f => f.category === "DETERMINISTIC_GROUNDING_INCREASE").length;
const groundingDecreaseCount = perFinding.filter(f => f.category === "DETERMINISTIC_GROUNDING_DECREASE").length;
const conflictFindingIds = perFinding.filter(f => f.category === "CONFLICT").map(f => f.finding_id);
const fusionInapplicableCount = excluded.filter(e => /fusion_applicable=false/.test(e.reason)).length;
const unmappedExcludedCount = excluded.filter(e => /^UNMAPPED-/.test(e.finding_id || "")).length;
const negativeControlExcludedCount = excluded.filter(e => e.finding_polarity === "NEGATIVE_CONTROL").length;

const grounding_effect = {
    label: "Deterministic Grounding Effect (Compound)",
    not_a_calibration_score_disclaimer:
        "This section measures how much deterministic evidence moved the LLM's stated confidence. " +
        "It does not measure, and must not be read as, whether the result became more accurate -- " +
        "that requires independent ground truth, which does not exist for these findings (see " +
        "formal_calibration below).",
    statistics: aggregate_evaluation,
    category_counts: {
        CONFLICT: conflictCount,
        AGREEMENT: agreementCount,
        DETERMINISTIC_GROUNDING_INCREASE: groundingIncreaseCount,
        DETERMINISTIC_GROUNDING_DECREASE: groundingDecreaseCount
    },
    category_note:
        "CONFLICT (K > 0) takes priority over AGREEMENT / INCREASE / DECREASE, which are based on D " +
        "(|confidence - BetP|). A finding can have real conflict and still show a small D, because " +
        "Dempster's rule absorbs disagreement into K rather than necessarily lowering the fused belief -- " +
        "labeling that finding AGREEMENT would contradict its own deterministic_status.",
    unmapped_volume_note:
        `${unmappedExcludedCount} of this run's ${excluded.length} excluded findings are UNMAPPED-*/` +
        `UNMAPPED-AUDIT-* entries (Node 07 or Node 08 findings the anchor-token matcher could not connect ` +
        "to any of Compound's 5 canonical spec keys), and " +
        `${negativeControlExcludedCount} is the negative control excluded for having no independent Node 07 ` +
        "confidence this run. See UNMAPPED VOLUME NOTE in the header comment for why a large excluded count " +
        "here reflects Compound's smaller, stricter spec and dual-source unmapped design, not a grounding " +
        "failure.",
    interpretation:
        `Across ${n} valid, fusion-applicable findings, deterministic grounding changed the LLM's stated ` +
        `confidence by an average of ${aggregate_evaluation.mean_absolute_change} (mean absolute change), ` +
        `with ${aggregate_evaluation.increased_count} findings increasing, ${aggregate_evaluation.decreased_count} ` +
        `decreasing, and ${aggregate_evaluation.unchanged_count} unchanged. ${conflictCount} finding(s) ` +
        `carry genuine deterministic conflict (K > 0)${conflictFindingIds.length ? ": " + conflictFindingIds.join(", ") : ""} ` +
        `and are categorized CONFLICT regardless of D. ${diverged.length} finding(s) exceeded Node 17's ` +
        `divergence threshold (${THRESHOLD}). Mean conflict (K) across all findings was ` +
        `${aggregate_evaluation.mean_conflict_K}, mean uncertainty (m_Theta) was ` +
        `${aggregate_evaluation.mean_uncertainty} -- both reported as raw values in per_finding without an ` +
        "applied threshold for the AGREEMENT/INCREASE/DECREASE split, since 0.15 has a defined role for " +
        "divergence specifically and not for conflict or uncertainty. " +
        (fusionInapplicableCount > 0
            ? `${fusionInapplicableCount} additional finding(s) were excluded as fusion_applicable=false ` +
              "(audit-only, unmapped, or the negative control's fallback path -- no independent Node 07 " +
              "confidence to compare) -- see `excluded` below and `unmapped_volume_note` above. "
            : "") +
        "Conflict is reported as-is, not hidden behind the fused belief value -- see per_finding for each " +
        "finding's K alongside its dst_betp. Any NEGATIVE_CONTROL finding present in per_finding carries its " +
        "own polarity_reading_note -- see NEGATIVE CONTROL READING NOTE in the header comment before " +
        "describing its direction/change in risk language."
};

// ======================================================================
// FORMAL CALIBRATION -- explicitly unavailable, not computed, not faked
// ======================================================================

const formal_calibration = {
    status: "UNAVAILABLE",
    reason: "Independent ground-truth outcomes are not available; therefore empirical calibration cannot be established."
};

// ======================================================================
// METHODOLOGY + LIMITATIONS
// ======================================================================

const methodology = {
    question: "How much does deterministic evidence change the probabilistic LLM assessment?",
    architecture: {
        node_07: "Probabilistic/LLM baseline -- provides the original confidence per finding. Not modified by this node.",
        node_13_16: "Deterministic evidence specification + anchor (Compound). Node 13 (Compound) both declares and evaluates every predicate inline (unlike Aave/Venus's declare-only Node 13); Node 16 re-expresses that in the shared K3 shape. Frozen, read-only. NOT treated as ground truth here or anywhere in this pipeline.",
        node_17: "Dempster-Shafer fusion of Node 07 (via Node 13's already-resolved confidence) + Node 16 (Compound). Produces belief_R, plausibility_R, pignistic_R (BetP), m_R, m_notR, m_Theta, K, and divergence (D = |confidence - BetP|), plus finding_polarity/status_interpretation passthrough. Not modified by this node.",
        era: "Explanatory/narrative only. Not an evidence source. Not fed back into this evaluation or into Node 17."
    },
    change_definition: "change = dst_betp - llm_confidence. Positive = deterministic grounding raised the assessment; negative = lowered it. This is a measured change, not a claim of improved accuracy. For NEGATIVE_CONTROL findings, see NEGATIVE CONTROL READING NOTE in the header comment -- the formula is identical, only the risk-language interpretation of the sign differs.",
    threshold_usage:
        `The only numeric threshold used anywhere in this node is Node 17's own divergence.threshold (${THRESHOLD}), ` +
        "applied only to its defined purpose (D = |confidence - BetP|, used for divergence_count and to " +
        "distinguish AGREEMENT from DETERMINISTIC_GROUNDING_INCREASE/DECREASE among findings with K = 0). " +
        "m_Theta (uncertainty) is reported as a raw value only, with no threshold applied, since 0.15 has no " +
        "justified meaning for it. The CONFLICT category is NOT threshold-based -- it fires whenever K > 0, " +
        "i.e. whenever the two sources mathematically contradicted each other at all. Zero vs. non-zero is a " +
        "structural boundary, not an invented cutoff, and CONFLICT takes priority over the D-based category " +
        "since real source disagreement is a more fundamental fact than how close confidence happened to land " +
        "to BetP.",
    open_taxonomy_note:
        "Like Venus (and unlike Aave's fixed F01-F11), this node has never assumed a fixed finding count or " +
        "fixed finding_id set -- it evaluates whatever finding_ids Node 17 (Compound) actually output this " +
        "run, including findings with fusion_applicable=false (audit-only/unmapped/negative-control-fallback), " +
        "which are excluded from the numeric aggregates with an explicit, specific reason rather than silently " +
        "included or dropped without a trace.",
    excluded_findings:
        excluded.length > 0
            ? `${excluded.length} finding(s) were excluded from all statistics -- see \`excluded\` below for the ` +
              "specific reason per finding (mathematically undefined, fusion_applicable=false, or missing data). " +
              `Of these, ${unmappedExcludedCount} are UNMAPPED-*/UNMAPPED-AUDIT-* entries and ` +
              `${negativeControlExcludedCount} is the negative control -- see unmapped_volume_note in ` +
              "grounding_effect. None are silently dropped or defaulted to zero."
            : "All findings from Node 17 were valid and fusion-applicable, and included in the statistics below."
};

const limitations = {
    statement:
        "This analysis measures the change/grounding effect between the LLM (Node 07) and the deterministic/DST " +
        "layers (Node 16, Node 17). It cannot establish predictive accuracy or empirical calibration without " +
        "independent outcomes, which do not exist for these findings. A higher or lower dst_betp relative to " +
        "llm_confidence indicates that deterministic evidence moved the assessment in that direction -- it does " +
        "not indicate that the result is more or less correct.",
    scope: "Uses Node 17's PRIMARY DST view only (not the EXPERIMENT-excluded sensitivity view). See Node 17's own output for the sensitivity comparison.",
    ground_truth: "UNAVAILABLE for these findings -- see formal_calibration.",
    reproducibility: "This node evaluates a single Node 17 run. It does not itself assess whether Node 07's confidence (and therefore the fused output) is stable across repeated runs on identical input -- that is a separate, not-yet-executed experiment.",
    audit_only_findings: "Findings with fusion_applicable=false are not evidence of a grounding-effect failure -- they simply have no independent LLM assessment to compare against, by construction (audit-only, unmapped, or the negative control's typical fallback case). See excluded for the specific list this run.",
    negative_control_caveat: "If a future run produces a NEGATIVE_CONTROL finding with fusion_applicable=true, its direction/category must be read against the STATED ABSENCE claim, not the named risk -- see per_finding's polarity_reading_note and the NEGATIVE CONTROL READING NOTE in the header comment. This node does not do that reinterpretation automatically."
};

// ======================================================================
// FINAL OUTPUT
// ======================================================================

return [
    {
        json: {
            node: "Node 18 (Compound) - Deterministic Grounding Effect Evaluation",
            version: "2.2-compound",
            methodology,
            per_finding: perFinding,
            excluded,
            aggregate_evaluation,
            disclosure_funnel,
            grounding_effect,
            formal_calibration,
            limitations
        }
    }
];
