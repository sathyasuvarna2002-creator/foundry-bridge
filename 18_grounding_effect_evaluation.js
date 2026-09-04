/***********************************************************************
 * NODE 18 — DETERMINISTIC GROUNDING EFFECT EVALUATION
 * VERSION 2.2 -- added a `sources` passthrough field to each per_finding
 * entry, copied verbatim from Node 17 v1.2's own new `sources`
 * passthrough (itself forwarded unmodified from Node 16 / Node 13).
 * Purely additive -- not read by any categorization, aggregate, or
 * interpretation logic below, all of which is unchanged. Brings this
 * node's per_finding shape into parity with
 * 18_grounding_effect_evaluation_venus.js, whose Node 18 already
 * includes `sources` (Venus's Node 17 already forwarded it). Requires
 * Node 17 (Aave) v1.2 or later -- on v1.1 and earlier this will read as
 * `sources: null` for every finding via the same `?? null` fallback
 * already used throughout this file for optional fields, not a crash.
 *
 * VERSION 2.1 (full rebuild per finalized spec -- replaces the earlier
 * "calibration_evaluation" node, which conflated grounding-effect
 * measurement with formal calibration claims this project cannot make)
 *
 * v2.1 CHANGE: added a CONFLICT category that takes priority over
 * AGREEMENT/INCREASE/DECREASE whenever K > 0. v2.0 categorized purely
 * on D (|confidence - BetP|), which meant a finding with real conflict
 * (K > 0, deterministic_status = CONTRADICTED / PARTIALLY_CONTRADICTED /
 * MIXED_SUPPORT_AND_CONTRADICTION) could still be labeled AGREEMENT if
 * D happened to be small -- misleading, since the two fields would then
 * directly contradict each other in the same row. See the category
 * logic comment below for the full rationale.
 *
 * ARCHITECTURE (frozen -- this node does not modify or second-guess any
 * of it):
 *   Node 07  -- probabilistic/LLM baseline (raw confidence per finding)
 *   Node 14/16 -- deterministic evidence anchor, frozen, read-only, NOT
 *                 ground truth
 *   Node 17  -- Dempster-Shafer fusion of Node 07 + Node 16. Produces
 *               belief_R, plausibility_R, pignistic_R (BetP), m_R,
 *               m_notR, m_Theta, K (conflict), and divergence
 *               (D = |confidence - BetP|, already computed by Node 17,
 *               not recomputed differently here)
 *   ERA      -- explanatory/narrative only. NOT an evidence source. NOT
 *               fed back into this evaluation.
 *
 * THE ONE QUESTION THIS NODE ANSWERS:
 *   How much does deterministic evidence change the probabilistic LLM
 *   assessment?
 *
 * WHAT THIS NODE DELIBERATELY DOES NOT DO:
 *   - Does not invent a formal calibration score.
 *   - Does not treat Node 16 as ground truth.
 *   - Does not claim a higher DST value means the system became more
 *     accurate -- "change" is measured, not "improvement."
 *   - Does not compute Brier score, ECE, accuracy, or any metric that
 *     requires an independent ground-truth outcome (none exists for
 *     these 11 findings -- see formal_calibration section).
 *   - Does not invent a new threshold for "high" conflict/uncertainty.
 *     It reuses Node 17's own divergence.threshold (already disclosed
 *     as an engineering parameter) for all three "is this notable"
 *     checks below, rather than fabricating additional constants.
 *   - Does not silently fill in missing or undefined values. Findings
 *     Node 17 reported as mathematically undefined (total conflict,
 *     K approx 1) are reported separately, excluded from the numeric
 *     aggregates, and counted explicitly -- never defaulted to zero or
 *     dropped without a trace.
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

const node17 =
    getNodeJSON("17_DST_Evidence_Fusion") ||
    getNodeJSON("Node 17");

if (!node17 || !Array.isArray(node17.findings) || node17.findings.length === 0) {
    throw new Error(
        "Node 18: no valid Node 17 output found. This node evaluates Node 17's fused output " +
        "and cannot run without it. Expected a node named 17_DST_Evidence_Fusion."
    );
}

if (!node17.self_tests || node17.self_tests.all_passed !== true) {
    throw new Error(
        "Node 18: Node 17's self-tests did not report all_passed = true. Refusing to evaluate " +
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
// category (its defined role). It is pulled from Node 17's actual output rather
// than hardcoded here, so if that engineering parameter ever changes, this node
// follows it rather than silently drifting out of sync. It is deliberately NOT
// applied to K (conflict) or m_Theta (uncertainty) -- those are reported as raw
// values only, since 0.15 has no justified meaning for either.
const THRESHOLD = node17.findings
    .map(f => f.dst && f.dst.primary && f.dst.primary.divergence && f.dst.primary.divergence.threshold)
    .find(t => typeof t === "number");

if (typeof THRESHOLD !== "number") {
    throw new Error(
        "Node 18: could not find Node 17's divergence.threshold in any finding. This node reuses " +
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

    if (!dst || dst.undefined) {
        excluded.push({
            finding_id: f.finding_id,
            risk_name: f.llm_evidence ? f.llm_evidence.risk_name : null,
            reason: dst && dst.reason
                ? dst.reason
                : "Node 17 reported this finding's primary DST view as undefined (total conflict, K approx 1)."
        });
        continue;
    }

    const llmConfidence = f.llm_evidence ? f.llm_evidence.confidence : null;
    const divergence = dst.divergence; // { absolute_difference, threshold, flag, ... }

    if (llmConfidence === null || llmConfidence === undefined || !divergence) {
        excluded.push({
            finding_id: f.finding_id,
            risk_name: f.llm_evidence ? f.llm_evidence.risk_name : null,
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
    // Rationale: K > 0 means the two sources actually disagreed (real contradiction in
    // the mass functions), which is an orthogonal fact to D = |confidence - BetP|. A
    // finding can have real conflict (K > 0) and still land at low D, because Dempster's
    // combination rule absorbs disagreement into K rather than necessarily lowering the
    // fused belief (see F05/F10, and the docstring at the top of this file). Labeling
    // such a finding "AGREEMENT" because D happened to be small is misleading, since the
    // deterministic_status shown alongside it already says CONTRADICTED / PARTIALLY_
    // CONTRADICTED / MIXED_SUPPORT_AND_CONTRADICTION. The K > 0 cutoff used here is not
    // an invented threshold like the 0.15 divergence cutoff -- zero vs. non-zero conflict
    // is the mathematically meaningful boundary (whether m1(R)*m2(notR) + m1(notR)*m2(R)
    // is exactly zero, i.e. whether the two sources contradicted each other at all).
    // When K = 0, category falls back to the existing D-based AGREEMENT / grounding-
    // increase / grounding-decrease classification, using Node 17's own divergence.flag
    // (the only threshold this node uses anywhere).
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
        risk_name: f.llm_evidence ? f.llm_evidence.risk_name : null,
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

        category
    });
}


// ======================================================================
// AGGREGATE STATISTICS (raw numbers -- the 14 items specified)
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

const maxDivergenceFinding = findExtreme(
    perFinding,
    f => f.divergence.absolute_difference,
    (a, b) => a > b
);

const maxIncreaseFinding = findExtreme(
    increased,
    f => f.change,
    (a, b) => a > b
);

const maxDecreaseFinding = findExtreme(
    decreased,
    f => f.change,
    (a, b) => a < b
);

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
// GROUNDING EFFECT (interpretive summary -- references the aggregate
// numbers above, does not recompute them differently)
// ======================================================================

const conflictCount = perFinding.filter(f => f.category === "CONFLICT").length;
const agreementCount = perFinding.filter(f => f.category === "AGREEMENT").length;
const groundingIncreaseCount = perFinding.filter(f => f.category === "DETERMINISTIC_GROUNDING_INCREASE").length;
const groundingDecreaseCount = perFinding.filter(f => f.category === "DETERMINISTIC_GROUNDING_DECREASE").length;

const conflictFindingIds = perFinding.filter(f => f.category === "CONFLICT").map(f => f.finding_id);

const grounding_effect = {
    label: "Deterministic Grounding Effect",
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
    interpretation:
        `Across ${n} valid findings, deterministic grounding changed the LLM's stated confidence by an ` +
        `average of ${aggregate_evaluation.mean_absolute_change} (mean absolute change), with ` +
        `${aggregate_evaluation.increased_count} findings increasing, ${aggregate_evaluation.decreased_count} ` +
        `decreasing, and ${aggregate_evaluation.unchanged_count} unchanged. ${conflictCount} finding(s) ` +
        `carry genuine deterministic conflict (K > 0)${conflictFindingIds.length ? ": " + conflictFindingIds.join(", ") : ""} ` +
        `and are categorized CONFLICT regardless of D. ${diverged.length} finding(s) exceeded Node 17's ` +
        `divergence threshold (${THRESHOLD}). Mean conflict (K) across all findings was ` +
        `${aggregate_evaluation.mean_conflict_K}, mean uncertainty (m_Theta) was ` +
        `${aggregate_evaluation.mean_uncertainty} -- both reported as raw values in per_finding without an ` +
        "applied threshold for the AGREEMENT/INCREASE/DECREASE split, since 0.15 has a defined role for " +
        "divergence specifically and not for conflict or uncertainty. Conflict is reported as-is, not hidden " +
        "behind the fused belief value -- see per_finding for each finding's K alongside its dst_betp."
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
        node_14_16: "Deterministic evidence anchor. Frozen, read-only. NOT treated as ground truth here or anywhere in this pipeline.",
        node_17: "Dempster-Shafer fusion of Node 07 + Node 16. Produces belief_R, plausibility_R, pignistic_R (BetP), m_R, m_notR, m_Theta, K, and divergence (D = |confidence - BetP|). Not modified by this node.",
        era: "Explanatory/narrative only. Not an evidence source. Not fed back into this evaluation or into Node 17."
    },
    change_definition: "change = dst_betp - llm_confidence. Positive = deterministic grounding raised the assessment; negative = lowered it. This is a measured change, not a claim of improved accuracy.",
    threshold_usage:
        `The only numeric threshold used anywhere in this node is Node 17's own divergence.threshold (${THRESHOLD}), ` +
        "applied only to its defined purpose (D = |confidence - BetP|, used for divergence_count and to " +
        "distinguish AGREEMENT from DETERMINISTIC_GROUNDING_INCREASE/DECREASE among findings with K = 0). " +
        "m_Theta (uncertainty) is reported as a raw value only, with no threshold applied, since 0.15 has no " +
        "justified meaning for it. The CONFLICT category is NOT threshold-based -- it fires whenever K > 0, " +
        "i.e. whenever the two sources mathematically contradicted each other at all (m1(R)*m2(notR) + " +
        "m1(notR)*m2(R) != 0). Zero vs. non-zero is a structural boundary, not an invented cutoff, and " +
        "CONFLICT takes priority over the D-based category since real source disagreement is a more " +
        "fundamental fact than how close confidence happened to land to BetP.",
    excluded_findings:
        excluded.length > 0
            ? `${excluded.length} finding(s) were excluded from all statistics because Node 17 reported them as ` +
              "mathematically undefined or incomplete -- see `excluded` below. They are not silently dropped or " +
              "defaulted to zero."
            : "All findings from Node 17 were valid and included in the statistics below."
};

const limitations = {
    statement:
        "This analysis measures the change/grounding effect between the LLM (Node 07) and the deterministic/DST " +
        "layers (Node 16, Node 17). It cannot establish predictive accuracy or empirical calibration without " +
        "independent outcomes, which do not exist for these 11 findings. A higher or lower dst_betp relative to " +
        "llm_confidence indicates that deterministic evidence moved the assessment in that direction -- it does " +
        "not indicate that the result is more or less correct.",
    scope: "Uses Node 17's PRIMARY DST view only (not the EXPERIMENT-excluded sensitivity view). See Node 17's own output for the sensitivity comparison.",
    ground_truth: "UNAVAILABLE for these findings -- see formal_calibration.",
    reproducibility: "This node evaluates a single Node 17 run. It does not itself assess whether Node 07's confidence (and therefore the fused output) is stable across repeated runs on identical input -- that is a separate, not-yet-executed experiment."
};


// ======================================================================
// FINAL OUTPUT
// ======================================================================

return [
    {
        json: {
            node: "Node 18 - Deterministic Grounding Effect Evaluation",
            version: "2.2",

            methodology,
            per_finding: perFinding,
            excluded,
            aggregate_evaluation,
            grounding_effect,
            formal_calibration,
            limitations
        }
    }
];
