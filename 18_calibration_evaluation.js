/***********************************************************************
 * NODE 18 — CALIBRATION EVALUATION
 * VERSION 1.0
 *
 * Compares:
 *   Experiment 1 = Node 07 raw (LLM-only baseline)
 *   Experiment 2 = Node 17's fused DST output (Node 07 ⊕ Node 16)
 *
 * This node does FOUR separate things, and keeps them explicitly
 * separate so no claim category gets silently upgraded into another:
 *
 *   (1) MATHEMATICAL-CORRECTNESS CLAIMS
 *       Pulled straight from Node 17's self-tests + per-finding
 *       invariant checks (mass sums to 1, Bel <= Pl). These are
 *       PROVEN, not estimated -- they hold by construction of the math,
 *       checked here as a second independent pass over Node 17's output.
 *
 *   (2) REPRODUCIBILITY CLAIMS (empirically testable, no ground truth needed)
 *       If the input includes N >= 2 repeated Node 07 runs on identical
 *       input, computes mean/stddev/min/max/range of confidence and
 *       downstream fused values per finding. This tests whether the
 *       LLM stage is stable -- it does NOT test whether it is correct.
 *
 *   (3) DIVERGENCE CLAIMS (empirically testable, no ground truth needed)
 *       Summarizes Node 17's per-finding divergence between Node 07's
 *       raw confidence and the fused BetP(R), and whether deterministic
 *       grounding narrowed the LLM's implied uncertainty. This tests
 *       whether grounding changes the answer -- it does NOT test
 *       whether the change is toward truth.
 *
 *   (4) CALIBRATION CLAIMS (require independent ground truth)
 *       Brier score, calibration error, reliability diagrams. These
 *       are ONLY computed if a real, externally-sourced ground_truth
 *       array is supplied for this run. If it is not supplied, this
 *       node explicitly reports ground_truth = "UNAVAILABLE" and
 *       refuses to compute or fabricate these metrics -- it does NOT
 *       default to using Node 16 as ground truth, because Node 16 is
 *       one of the two things being fused/compared, not an independent
 *       reference (that would be circular).
 *
 * No claim in category (2) or (3) is ever reported as if it were
 * category (4). No statistical-significance language is used anywhere
 * given n=11 findings.
 ***********************************************************************/


// ======================================================================
// INPUTS
// ======================================================================

function getNodeJSON(name) {
    try {
        return $(name).first().json;
    } catch (e) {
        return null;
    }
}

// Node 17's fused output (required)
const node17 =
    getNodeJSON("17_DST_Evidence_Fusion") ||
    getNodeJSON("Node 17") ||
    $input.first().json;

// Optional: array of repeated Node 07 runs on identical input, supplied
// externally by the reproducibility experiment harness. Each item is a
// raw Node 07 output object (same shape Node 17 consumes).
// Expected shape: { runs: [ node07Output_1, node07Output_2, ... ] }
const reproducibilityInput = getNodeJSON("Reproducibility_Runs");

// Optional: real, independently-sourced ground truth. Expected shape:
//   { source: "<description of where this came from>",
//     labels: { F01: "R" | "notR", F02: ..., ... } }
// Must NOT be derived from Node 16 or Node 17 -- see calibration section.
const groundTruthInput = getNodeJSON("Ground_Truth");


// ======================================================================
// HELPERS
// ======================================================================

function round(x, dp) {
    if (x === null || x === undefined || Number.isNaN(x)) return null;
    const f = Math.pow(10, dp);
    return Math.round((x + Number.EPSILON) * f) / f;
}

function mean(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr) {
    if (arr.length < 2) return null; // undefined for n<2, do not report 0
    const m = mean(arr);
    const variance = arr.reduce((a, b) => a + (b - m) * (b - m), 0) / (arr.length - 1); // sample stddev
    return Math.sqrt(variance);
}

function summaryStats(arr) {
    const clean = arr.filter(v => typeof v === "number" && !Number.isNaN(v));
    if (clean.length === 0) {
        return { n: 0, mean: null, stddev: null, min: null, max: null, range: null };
    }
    return {
        n: clean.length,
        mean: round(mean(clean), 6),
        stddev: clean.length >= 2 ? round(stddev(clean), 6) : null,
        min: round(Math.min(...clean), 6),
        max: round(Math.max(...clean), 6),
        range: round(Math.max(...clean) - Math.min(...clean), 6)
    };
}


// ======================================================================
// VALIDATE NODE 17 INPUT
// ======================================================================

if (!node17 || !Array.isArray(node17.findings) || node17.findings.length === 0) {
    throw new Error(
        "Node 18: no valid Node 17 output found. Node 18 evaluates Node 17's fused output " +
        "and cannot run without it."
    );
}

if (!node17.self_tests || node17.self_tests.all_passed !== true) {
    throw new Error(
        "Node 18: Node 17's self-tests did not report all_passed = true. Refusing to evaluate " +
        "calibration on top of a fusion stage whose own mathematical correctness is not confirmed."
    );
}


// ======================================================================
// (1) MATHEMATICAL-CORRECTNESS CLAIMS
// ======================================================================
//
// Independent second-pass check over Node 17's own numbers: mass sums
// to 1, Bel <= Pl, for both the primary and sensitivity views of every
// finding. This does not re-derive the DST math -- it re-checks the
// invariants that the math guarantees, as a defense against a
// transcription or wiring error between Node 17 and Node 18.
// ======================================================================

function checkInvariants(dstView, findingId, viewName) {
    const issues = [];

    if (dstView.undefined) {
        return { finding_id: findingId, view: viewName, applicable: false, reason: dstView.reason, issues: [] };
    }

    const sumOk = Math.abs(dstView.sum_check - 1) < 1e-6;
    if (!sumOk) {
        issues.push(`mass does not sum to 1 (got ${dstView.sum_check})`);
    }

    const belPlOk = dstView.belief_R <= dstView.plausibility_R + 1e-9;
    if (!belPlOk) {
        issues.push(`Belief(R)=${dstView.belief_R} exceeds Plausibility(R)=${dstView.plausibility_R}`);
    }

    return {
        finding_id: findingId,
        view: viewName,
        applicable: true,
        mass_sums_to_one: sumOk,
        belief_leq_plausibility: belPlOk,
        issues
    };
}

const invariantChecks = [];
for (const f of node17.findings) {
    invariantChecks.push(checkInvariants(f.dst.primary, f.finding_id, "primary"));
    invariantChecks.push(checkInvariants(f.dst.sensitivity_excluding_experiment_propositions, f.finding_id, "sensitivity"));
}

const allInvariantsHold = invariantChecks.every(c => !c.applicable || c.issues.length === 0);

const mathematicalCorrectness = {
    claim_type: "PROVEN (holds by construction, independently re-checked here)",
    node17_self_tests_all_passed: node17.self_tests.all_passed,
    per_finding_invariants_hold: allInvariantsHold,
    invariant_checks: invariantChecks,
    interpretation: allInvariantsHold
        ? "All mass functions in Node 17's output satisfy the required DST invariants (mass sums to 1, Belief <= Plausibility) for every finding and every view. This confirms Node 17's arithmetic, it does NOT confirm anything about the protocol being audited."
        : "One or more invariant violations were found -- this indicates a bug in Node 17 or a data-wiring error, and the fused output should not be trusted until resolved."
};


// ======================================================================
// (2) REPRODUCIBILITY CLAIMS
// ======================================================================
//
// Only computed if repeated Node 07 runs were supplied. Node 16 and the
// DST combination math are provably deterministic (same input -> same
// output, by inspection of the code -- no randomness anywhere in either).
// The only source of run-to-run variation in this whole pipeline is the
// LLM stage (Node 07), so reproducibility is measured there and its
// effect is traced through to the fused output.
// ======================================================================

let reproducibility;

if (!reproducibilityInput || !Array.isArray(reproducibilityInput.runs) || reproducibilityInput.runs.length < 2) {

    reproducibility = {
        claim_type: "NOT EVALUATED THIS RUN",
        reason: "Fewer than 2 repeated Node 07 runs were supplied. Reproducibility requires N >= 2 " +
                "(design target N >= 5, ideally 10) runs of Node 07 on identical input, supplied via " +
                "a 'Reproducibility_Runs' input containing { runs: [ node07Output_1, node07Output_2, ... ] }.",
        deterministic_components_note:
            "Node 16 (deterministic evidence) and the DST combination arithmetic in Node 17 contain no " +
            "randomness and are deterministic by inspection -- same input always produces same output. " +
            "This does not need repeated-run testing to establish; it follows from the code containing no " +
            "random number generation, no external state, and no time-dependent branching. Only Node 07 " +
            "(the LLM stage) is a plausible source of run-to-run variation, hence it is the sole target of " +
            "this reproducibility experiment."
    };

} else {

    const runs = reproducibilityInput.runs;
    const n = runs.length;

    // For each finding, gather confidence and derived mass across all N runs.
    const findingIds = node17.findings.map(f => f.finding_id);

    const perFinding = findingIds.map(fid => {

        const confidences = [];
        const massR = [];
        const massTheta = [];

        for (const run of runs) {
            const list = run.architectural_risks || run.findings || [];
            const match = list.find(x => (x.canonical_finding_id || x.finding_id || "").toUpperCase().startsWith(fid));
            if (match && typeof match.confidence === "number") {
                confidences.push(match.confidence);
                massR.push(match.confidence);
                massTheta.push(1 - match.confidence);
            }
        }

        return {
            finding_id: fid,
            n_runs_with_data: confidences.length,
            confidence: summaryStats(confidences),
            m_07_R: summaryStats(massR),
            m_07_Theta: summaryStats(massTheta)
        };
    });

    reproducibility = {
        claim_type: "EMPIRICALLY TESTABLE (no ground truth required)",
        n_runs: n,
        design_target_met: n >= 5,
        design_target_ideal_met: n >= 10,
        methodology:
            "Node 07 was run N times on identical input. Confidence and derived m_07(R) are summarized " +
            "per finding with mean, sample standard deviation, min, max, and range. Low stddev/range " +
            "indicates the LLM stage is stable on this input; it says nothing about whether the LLM's " +
            "answer is correct.",
        per_finding: perFinding,
        interpretation:
            n >= 5
                ? "Sufficient repeated runs to characterize LLM output variability on this input under the " +
                  "design's minimum target (N>=5)."
                : "Below the design's minimum target of N>=5 repeated runs -- treat variability estimates " +
                  "as preliminary/indicative only, not a settled characterization."
    };
}


// ======================================================================
// (3) DIVERGENCE CLAIMS
// ======================================================================
//
// Summarizes, across all 11 findings, how much (and in what direction)
// deterministic grounding moved the fused belief away from Node 07's
// raw confidence. This is purely a description of what the fusion did --
// it makes no claim that the direction of movement was toward the truth.
//
// PRIMARY metric: absolute_difference = |confidence - BetP(R)|.
//
// interval_position is reported for completeness but is NOT used to count
// "overconfident" findings. Proof (see design doc Section D correction):
// whenever Node 16 shows no contradiction (t=0), combined_R - c = s*(1-c)
// >= 0 always, so interval_position = "below_belief" is structurally
// guaranteed regardless of Node 07's calibration -- it is not a per-finding
// signal. Only "above_plausibility" is a direction that isn't mechanically
// forced, so only that direction is counted below.
// ======================================================================

const divergenceRows = node17.findings.map(f => {
    const d = f.dst.primary.divergence;
    if (!d) {
        return { finding_id: f.finding_id, applicable: false };
    }
    return {
        finding_id: f.finding_id,
        llm_confidence: f.llm_evidence.confidence,
        fused_pignistic_R: f.dst.primary.pignistic_R,
        absolute_difference: d.absolute_difference,
        flagged_meaningful_divergence: d.flag,
        interval_position: d.interval_position,
        deterministic_status: f.deterministic_evidence.finding_status
    };
});

const applicableDivergence = divergenceRows.filter(r => r.applicable !== false);
const flaggedCount = applicableDivergence.filter(r => r.flagged_meaningful_divergence).length;
const aboveePlausibilityCount = applicableDivergence.filter(r => r.interval_position === "above_plausibility").length;
const belowBeliefCount = applicableDivergence.filter(r => r.interval_position === "below_belief").length;

const divergence = {
    claim_type: "EMPIRICALLY TESTABLE (no ground truth required)",
    threshold_used: node17.methodology ? node17.methodology.divergence_threshold_disclaimer : null,
    n_findings: applicableDivergence.length,
    n_flagged_meaningful_divergence: flaggedCount,
    n_above_plausibility: aboveePlausibilityCount,
    n_below_belief: belowBeliefCount,
    below_belief_disclaimer:
        "n_below_belief is reported for completeness but is NOT evidence of overconfidence -- it is " +
        "structurally guaranteed whenever Node 16 shows support and no contradiction (see design doc " +
        "Section D correction). n_above_plausibility is the direction that is actually informative, " +
        "since it is not mechanically forced by the mass structure.",
    per_finding: divergenceRows,
    interpretation:
        `${flaggedCount} of ${applicableDivergence.length} findings show a divergence (|confidence - BetP(R)|) ` +
        `between Node 07's raw confidence and Node 17's fused belief above the ${DIVERGENCE_THRESHOLD_LABEL()} ` +
        "engineering threshold. This describes WHERE the LLM-only and grounded-fused assessments disagree; it " +
        "is not, by itself, evidence about which one is more accurate -- that requires ground truth (see below)."
};

function DIVERGENCE_THRESHOLD_LABEL() {
    const t = node17.findings[0]?.dst?.primary?.divergence?.threshold;
    return t !== undefined && t !== null ? t : "configured";
}


// ======================================================================
// (4) CALIBRATION CLAIMS -- ONLY WITH REAL GROUND TRUTH
// ======================================================================
//
// Brier score for a binary event with predicted probability p and
// outcome o in {0,1}:  BS = (p - o)^2, averaged over items.
// Lower is better; 0 is perfect, 0.25 is the score of a coin-flip
// prediction (p=0.5) against any outcome.
//
// This is ONLY computed if `groundTruthInput` is supplied and its
// labels are NOT derived from Node 16 or Node 17 (that would be
// circular -- Node 16/17 are the things being evaluated, not an
// independent reference). Since no such independent ground truth exists
// for this project (the real Sigma Prime audit covers only 2 findings
// unrelated to these 11 architectural findings), this will report
// UNAVAILABLE in the current pipeline state -- and that is the honest,
// correct answer, not a gap to be papered over.
// ======================================================================

let calibration;

if (!groundTruthInput || !groundTruthInput.labels || Object.keys(groundTruthInput.labels).length === 0) {

    calibration = {
        claim_type: "NOT ESTABLISHABLE -- ground truth unavailable",
        ground_truth: "UNAVAILABLE",
        reason:
            "No independent ground truth was supplied for this run. Node 16 and Node 17 are the systems " +
            "being evaluated and must not be used as their own ground truth (circular). The real Sigma " +
            "Prime audit available to this project covers only 2 informational findings unrelated to these " +
            "11 architectural findings, and does not constitute ground truth for them either. " +
            "Brier score, calibration error, and reliability-diagram statistics require a real, independent " +
            "R/notR label per finding sourced from outside this pipeline (e.g. a separate expert panel, a " +
            "second independent audit covering these specific findings, or a ground-truth dataset agreed " +
            "with the thesis advisor). None currently exists.",
        what_would_be_needed:
            "A labels object of the form { F01: 'R'|'notR', F02: ..., ... } sourced independently of Node 16 " +
            "and Node 17, supplied via a 'Ground_Truth' input, with its provenance documented in `source`.",
        metrics_withheld: ["brier_score", "calibration_error", "reliability_diagram"]
    };

} else {

    const labels = groundTruthInput.labels;
    const labeledIds = Object.keys(labels).filter(id => labels[id] === "R" || labels[id] === "notR");

    if (labeledIds.length === 0) {
        calibration = {
            claim_type: "NOT ESTABLISHABLE -- ground truth malformed",
            ground_truth: "PROVIDED_BUT_INVALID",
            reason: "Ground_Truth.labels was supplied but contained no valid 'R'/'notR' entries."
        };
    } else {

        function brierFor(getP) {
            const items = labeledIds.map(fid => {
                const f = node17.findings.find(x => x.finding_id === fid);
                if (!f) return null;
                const p = getP(f);
                const o = labels[fid] === "R" ? 1 : 0;
                return { finding_id: fid, p, o, sq_error: p === null ? null : (p - o) * (p - o) };
            }).filter(x => x && x.p !== null);

            const brier = items.length ? mean(items.map(x => x.sq_error)) : null;

            return { n: items.length, items, brier_score: round(brier, 6) };
        }

        const exp1 = brierFor(f => f.llm_evidence.confidence);
        const exp2 = brierFor(f => f.dst.primary.pignistic_R);

        calibration = {
            claim_type: "EMPIRICALLY MEASURED against supplied ground truth",
            ground_truth: "PROVIDED",
            ground_truth_source: groundTruthInput.source || "(no source description provided -- treat with caution)",
            n_labeled_findings: labeledIds.length,
            sample_size_warning:
                `n=${labeledIds.length}. No claim of statistical significance is made or should be inferred ` +
                "from a sample this small -- these are descriptive point estimates only.",
            experiment_1_llm_only: {
                description: "Node 07 raw confidence vs ground truth",
                ...exp1
            },
            experiment_2_dst_fused: {
                description: "Node 17 fused pignistic_R vs ground truth",
                ...exp2
            },
            comparison: exp1.brier_score !== null && exp2.brier_score !== null ? {
                brier_score_difference: round(exp2.brier_score - exp1.brier_score, 6),
                interpretation: exp2.brier_score < exp1.brier_score
                    ? "Fused (Experiment 2) scored lower (better) than LLM-only (Experiment 1) on this sample."
                    : exp2.brier_score > exp1.brier_score
                        ? "LLM-only (Experiment 1) scored lower (better) than fused (Experiment 2) on this sample."
                        : "Both experiments scored identically on this sample."
            } : null
        };
    }
}


// ======================================================================
// FINAL OUTPUT
// ======================================================================

return [
    {
        json: {

            node: "Node 18 - Calibration Evaluation",
            version: "1.0",

            methodology_note:
                "This node keeps four claim categories strictly separate: (1) mathematical correctness " +
                "(proven), (2) reproducibility (empirically testable, no ground truth needed), " +
                "(3) divergence between LLM-only and fused assessments (empirically testable, no ground " +
                "truth needed), and (4) calibration against real-world outcomes (requires independent " +
                "ground truth, currently UNAVAILABLE for this project). No claim from one category is " +
                "reported as if it belonged to another.",

            mathematical_correctness: mathematicalCorrectness,
            reproducibility,
            divergence,
            calibration
        }
    }
];
