/***********************************************************************
 * NODE 18 — DETERMINISTIC GROUNDING EFFECT EVALUATION (VENUS VARIANT)
 * VERSION 2.1-VENUS
 *
 * Venus counterpart to 18_grounding_effect_evaluation.js (v2.1). Unlike
 * Node 13/16/17, this node's core logic already had NO hardcoded
 * F01-F11 assumption -- it iterates whatever finding_ids Node 17
 * actually output, with no fixed list or count anywhere. So this
 * adaptation is small: three real changes, not a rebuild.
 *
 * CHANGES FROM THE AAVE VERSION:
 *
 * 1. Node name candidates for the Node 17 lookup now include the
 *    Venus node names, not just "17_DST_Evidence_Fusion"/"Node 17".
 *
 * 2. `f.llm_evidence.risk_name` -> `f.finding_name`. Aave's Node 17
 *    nests the finding's display name inside llm_evidence. Venus's
 *    Node 17 (17_dst_evidence_fusion_venus.js) puts finding_name at
 *    the top level of each finding object instead (alongside
 *    finding_id and sources), since it isn't specifically an "LLM"
 *    fact -- Node 16 supplies it too. Reading the wrong path would
 *    have silently produced risk_name: null for every Venus finding.
 *
 * 3. Findings with `fusion_applicable: false` (Venus's UNMAPPED-* or
 *    audit-only entries -- a concept that doesn't exist in the fixed-
 *    taxonomy Aave pipeline) now get a specific, correct exclusion
 *    reason instead of falling through to the generic "missing
 *    confidence" message. The OUTCOME was already correct in the Aave
 *    logic as-is (llm_evidence.confidence is null for these, so they
 *    were already excluded, not silently included) -- this only makes
 *    the recorded reason precise instead of generic.
 *
 * Everything else -- the CONFLICT-takes-priority-over-AGREEMENT
 * category logic, the K>0 structural (not invented) boundary, the
 * reuse of Node 17's own divergence.threshold rather than a new
 * constant, the explicit exclusion (never silent-drop) of undefined
 * findings, and the hard refusal to compute formal calibration without
 * ground truth -- is unchanged, because none of it depended on a fixed
 * taxonomy in the first place.
 *
 * ARCHITECTURE (frozen -- this node does not modify or second-guess any
 * of it):
 *   Node 07     -- probabilistic/LLM baseline (raw confidence per finding)
 *   Node 13/16  -- deterministic evidence anchor (Venus), frozen,
 *                  read-only, NOT ground truth
 *   Node 17     -- Dempster-Shafer fusion of Node 07 (via Node 13's
 *                  resolved confidence) + Node 16 (Venus). Produces
 *                  belief_R, plausibility_R, pignistic_R (BetP), m_R,
 *                  m_notR, m_Theta, K (conflict), and divergence
 *                  (D = |confidence - BetP|, already computed by Node
 *                  17, not recomputed differently here)
 *   ERA         -- explanatory/narrative only. NOT an evidence source.
 *                  NOT fed back into this evaluation.
 *
 * THE ONE QUESTION THIS NODE ANSWERS:
 *   How much does deterministic evidence change the probabilistic LLM
 *   assessment?
 *
 * WHAT THIS NODE DELIBERATELY DOES NOT DO (unchanged from Aave):
 *   - Does not invent a formal calibration score.
 *   - Does not treat Node 16 as ground truth.
 *   - Does not claim a higher DST value means the system became more
 *     accurate -- "change" is measured, not "improvement."
 *   - Does not compute Brier score, ECE, accuracy, or any metric that
 *     requires an independent ground-truth outcome (none exists for
 *     Venus's findings either -- see formal_calibration section).
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
    "17_DST_Evidence_Fusion_Venus",
    "17_dst_evidence_fusion_venus",
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
        "Node 18 (Venus): no valid Node 17 output found. This node evaluates Node 17's fused output " +
        "and cannot run without it. Tried: " + NODE_17_CANDIDATES.join(", ") + "."
    );
}

if (!node17.self_tests || node17.self_tests.all_passed !== true) {
    throw new Error(
        "Node 18 (Venus): Node 17's self-tests did not report all_passed = true. Refusing to evaluate " +
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
        "Node 18 (Venus): could not find Node 17's divergence.threshold in any finding. This node reuses " +
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
            finding_name: f.finding_name ?? null,
            reason: dst && dst.reason
                ? dst.reason
                : "Node 17 reported this finding's primary DST view as undefined (total conflict, K approx 1)."
        });
        continue;
    }

    // Venus-specific: a finding with no real Node 07 counterpart (audit-only,
    // or an UNMAPPED-* entry) has fusion_applicable: false -- there is no
    // independent LLM confidence for it, so no grounding-effect change can be
    // measured. This did not exist as a concept in the fixed-taxonomy Aave
    // pipeline. The exclusion outcome is unchanged from before (these would
    // already have failed the confidence/divergence check below), but the
    // reason recorded is now specific rather than generic.
    if (f.fusion_applicable === false) {
        excluded.push({
            finding_id: f.finding_id,
            finding_name: f.finding_name ?? null,
            reason: f.fusion_note ||
                "fusion_applicable=false: no real Node 07 counterpart exists for this finding (audit-only " +
                "or UNMAPPED-* entry), so there is no independent LLM confidence to measure a grounding " +
                "effect against."
        });
        continue;
    }

    const llmConfidence = f.llm_evidence ? f.llm_evidence.confidence : null;
    const divergence = dst.divergence; // { absolute_difference, threshold, flag, ... }

    if (llmConfidence === null || llmConfidence === undefined || !divergence) {
        excluded.push({
            finding_id: f.finding_id,
            finding_name: f.finding_name ?? null,
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
    // Unchanged from the Aave version -- see that file's docstring for the full
    // derivation. K > 0 is a structural (not invented) boundary: whether
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
// AGGREGATE STATISTICS (unchanged shape from the Aave version)
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
// GROUNDING EFFECT (interpretive summary)
// ======================================================================

const conflictCount = perFinding.filter(f => f.category === "CONFLICT").length;
const agreementCount = perFinding.filter(f => f.category === "AGREEMENT").length;
const groundingIncreaseCount = perFinding.filter(f => f.category === "DETERMINISTIC_GROUNDING_INCREASE").length;
const groundingDecreaseCount = perFinding.filter(f => f.category === "DETERMINISTIC_GROUNDING_DECREASE").length;
const conflictFindingIds = perFinding.filter(f => f.category === "CONFLICT").map(f => f.finding_id);
const fusionInapplicableCount = excluded.filter(e => /fusion_applicable=false/.test(e.reason)).length;

const grounding_effect = {
    label: "Deterministic Grounding Effect (Venus)",
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
              "(audit-only or unmapped, no independent Node 07 confidence to compare) -- see `excluded` below. "
            : "") +
        "Conflict is reported as-is, not hidden behind the fused belief value -- see per_finding for each " +
        "finding's K alongside its dst_betp."
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
        node_13_16: "Deterministic evidence specification + anchor (Venus). Frozen, read-only. NOT treated as ground truth here or anywhere in this pipeline.",
        node_17: "Dempster-Shafer fusion of Node 07 (via Node 13's already-resolved confidence) + Node 16 (Venus). Produces belief_R, plausibility_R, pignistic_R (BetP), m_R, m_notR, m_Theta, K, and divergence (D = |confidence - BetP|). Not modified by this node.",
        era: "Explanatory/narrative only. Not an evidence source. Not fed back into this evaluation or into Node 17."
    },
    change_definition: "change = dst_betp - llm_confidence. Positive = deterministic grounding raised the assessment; negative = lowered it. This is a measured change, not a claim of improved accuracy.",
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
        "Unlike the Aave version, this node has never assumed a fixed finding count or fixed finding_id set -- " +
        "it evaluates whatever finding_ids Node 17 (Venus) actually output this run, including findings with " +
        "fusion_applicable=false (audit-only/unmapped), which are excluded from the numeric aggregates with an " +
        "explicit, specific reason rather than silently included or dropped without a trace.",
    excluded_findings:
        excluded.length > 0
            ? `${excluded.length} finding(s) were excluded from all statistics -- see \`excluded\` below for the ` +
              "specific reason per finding (mathematically undefined, fusion_applicable=false, or missing data). " +
              "None are silently dropped or defaulted to zero."
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
    audit_only_findings: "Findings with fusion_applicable=false are not evidence of a grounding-effect failure -- they simply have no independent LLM assessment to compare against, by construction (audit-only or unmapped). See excluded for the specific list this run."
};

// ======================================================================
// FINAL OUTPUT
// ======================================================================

return [
    {
        json: {
            node: "Node 18 (Venus) - Deterministic Grounding Effect Evaluation",
            version: "2.1-venus",
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
