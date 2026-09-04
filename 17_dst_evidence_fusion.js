/***********************************************************************
 * NODE 17 — DST EVIDENCE FUSION
 * VERSION 1.2 -- added a `sources` passthrough field to each finding's
 * top-level output, copied verbatim from Node 16 (which itself passes
 * it through unmodified from Node 13 v2.6+). Node 17 (Aave) previously
 * dropped this field entirely -- it read n16.status but never touched
 * n16.sources -- so Node 18 (and any other consumer of Node 17's output
 * alone) had no way to see which findings had real, matched Node 08
 * audit evidence versus architecture-only support, even though that
 * data existed one node upstream. Found by comparing against
 * 17_dst_evidence_fusion_venus.js, whose Node 17 already forwards
 * `sources` from Node 13 (Venus) at the finding level. Pure additive
 * passthrough -- not read or used in any DST computation below, exactly
 * like the claim_id/sources fields added to Node 16 earlier this
 * project. See NODE17_AAVE_sources_passthrough_v1.1_to_v1.2.md.
 *
 * VERSION 1.1 -- fixed a floating-point boundary bug where the
 * divergence flag compared the raw unrounded float difference against
 * the threshold instead of the same rounded value that gets displayed,
 * causing exactly-at-threshold cases (e.g. 1 - 0.85) to flag as
 * exceeding it due to IEEE754 representation noise, not a real
 * divergence. See the flag computation below for the fix and rationale.
 * Ported from 17_dst_evidence_fusion_venus.js (Venus) v1.1, where this
 * was first found and fixed -- the Dempster's-rule arithmetic itself is
 * protocol-agnostic, so the same bug existed here unchanged.
 *
 * Pure mathematical fusion node. No LLM calls, no randomness.
 *
 * Fuses two INDEPENDENT bodies of evidence per finding using Dempster's
 * rule of combination:
 *
 *     Node 07  (LLM-only, has never seen Node 16)   -- m_07
 *     Node 16  (deterministic, frozen)                -- m_det
 *
 * IMPORTANT -- WHY NODE 07, NOT THE EVIDENCE REVIEW AGENT:
 * Dempster's rule requires the two combined mass functions to be based
 * on independent evidence. The Evidence Review Agent already reads
 * Node 16's deterministic_status as one of its own five inputs, so its
 * mass is NOT independent of Node 16's -- combining them would
 * double-count the deterministic signal (once directly, once smuggled
 * inside the LLM mass) and artificially inflate belief. Node 07 has
 * never seen Node 16, so it is the correct fusion input. See the
 * design document (Node17_18_DST_Design_Document.md) section C.2 for
 * the full derivation.
 *
 * Node 16 is NEVER modified, re-scored, or treated as ground truth.
 * No new propositions or findings are invented.
 *
 * FRAME OF DISCERNMENT:  Theta = { R, notR }
 *   R    = "this finding is a substantiated risk"
 *   notR = "this finding is not substantiated"
 *   Theta (as a mass target) = total ignorance between the two
 *
 * OUTPUT PER FINDING:
 *   llm_evidence        (Node 07's original value + derived mass, untouched)
 *   deterministic_evidence (Node 16's counts + derived mass -- primary
 *                            and sensitivity views, both reported)
 *   dst                 (combined mass, belief, plausibility, conflict,
 *                         pignistic probability, for both primary and
 *                         sensitivity views)
 *   divergence           (Node 07's raw confidence vs the fused BetP,
 *                          plus the interval-containment overconfidence
 *                          check)
 *
 * Also runs the 7 synthetic self-tests (Section F of the design doc) on
 * every execution, so the DST implementation's correctness is checked
 * mathematically on every run, not just in a separate test harness.
 ***********************************************************************/


// ======================================================================
// CONFIGURATION
// ======================================================================

// Engineering/evaluation threshold only -- explicitly NOT a validated
// scientific constant. Exists so a "meaningfully diverged" flag can be
// reported without pretending 0.15 has any special statistical status.
const DIVERGENCE_THRESHOLD = 0.15;

const EXPECTED_FINDING_IDS = [
    "F01", "F02", "F03", "F04", "F05", "F06",
    "F07", "F08", "F09", "F10", "F11"
];

const EPS = 1e-9; // numerical tolerance for K -> 1 (total conflict) detection


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

const node07 =
    getNodeJSON("07_AI_Risk_Reasoner") || {};

const node16 =
    getNodeJSON("14_Deterministic_Validation") ||
    getNodeJSON("16_Deterministic_Evidence_Anchor") ||
    getNodeJSON("Node 16");

if (!node16 || !Object.keys(node16).length) {
    throw new Error(
        "Node 17: Deterministic validation input could not be found. " +
        "Expected 14_Deterministic_Validation or 16_Deterministic_Evidence_Anchor."
    );
}


// ======================================================================
// GENERIC HELPERS
// ======================================================================

function str(v) { return v == null ? "" : String(v); }

function findingId(value) {
    const match = str(value).match(/F(\d{2})/i);
    return match ? `F${match[1]}` : "";
}

function round(x, dp) {
    const f = Math.pow(10, dp);
    return Math.round((x + Number.EPSILON) * f) / f;
}


// ======================================================================
// EXTRACT NODE 07 FINDINGS (LLM-only, uncontaminated)
// ======================================================================

function extractNode07Findings(root) {

    const candidates = [
        root?.architectural_risks,
        root?.output?.architectural_risks,
        root?.findings,
        root?.output?.findings
    ];

    for (const candidate of candidates) {
        if (Array.isArray(candidate) && candidate.length) {
            return candidate;
        }
    }

    return [];
}

const node07Findings = extractNode07Findings(node07);

const node07ById = {};
for (const f of node07Findings) {
    const fid = findingId(f.canonical_finding_id || f.finding_id || f.id);
    if (fid) {
        node07ById[fid] = f;
    }
}


// ======================================================================
// EXTRACT NODE 16 FINDINGS (deterministic, frozen -- read only)
// ======================================================================

function extractNode16Findings(root) {

    const candidates = [
        root?.findings,
        root?.output?.findings
    ];

    for (const candidate of candidates) {
        if (Array.isArray(candidate) && candidate.length) {
            return candidate;
        }
    }

    return [];
}

const node16Findings = extractNode16Findings(node16);

const node16ById = {};
for (const f of node16Findings) {
    const fid = findingId(f.finding_id);
    if (fid) {
        node16ById[fid] = f;
    }
}


// ======================================================================
// COVERAGE CHECK (read-only visibility, does not modify either source)
// ======================================================================

const missingFromNode07 = EXPECTED_FINDING_IDS.filter(id => !node07ById[id]);
const missingFromNode16 = EXPECTED_FINDING_IDS.filter(id => !node16ById[id]);

if (missingFromNode16.length) {
    throw new Error(
        `Node 17: Node 16 is missing findings [${missingFromNode16.join(", ")}]. ` +
        `Node 17 does not invent findings or propositions -- fix upstream.`
    );
}

if (missingFromNode07.length) {
    throw new Error(
        `Node 17: Node 07 is missing findings [${missingFromNode07.join(", ")}]. ` +
        `Node 17 does not invent findings -- fix upstream.`
    );
}


// ======================================================================
// MASS ASSIGNMENT -- NODE 07 SIDE (LLM, independent of Node 16)
// ======================================================================
//
// Node 07 is a risk-IDENTIFICATION agent: every finding it emits is a
// proposed R. It has no mechanism for asserting notR. Its `confidence`
// is therefore mapped directly:
//
//     m_07(R)    = confidence
//     m_07(notR) = 0
//     m_07(Theta) = 1 - confidence
// ======================================================================

function buildLLMMass(node07Finding) {

    const confidence =
        typeof node07Finding?.confidence === "number"
            ? Math.max(0, Math.min(1, node07Finding.confidence))
            : null;

    if (confidence === null) {
        // No usable confidence -- total ignorance, not zero risk.
        return { R: 0, notR: 0, Theta: 1, source_confidence: null };
    }

    return {
        R: confidence,
        notR: 0,
        Theta: 1 - confidence,
        source_confidence: confidence
    };
}


// ======================================================================
// MASS ASSIGNMENT -- NODE 16 SIDE (deterministic, proposition counts)
// ======================================================================
//
// Primary view: counts every proposition, including the always-
// unresolved EXPERIMENT-type proposition every finding currently has
// (no Foundry behavioural tests exist yet).
//
// Sensitivity view: excludes EXPERIMENT-type propositions entirely,
// removing the uniform artificial uncertainty floor that is currently
// identical across all 11 findings. BOTH are always computed and
// reported -- never silently substituted for each other.
// ======================================================================

function buildDeterministicMass(node16Finding) {

    const propositions =
        Array.isArray(node16Finding?.propositions)
            ? node16Finding.propositions
            : [];

    const countBy = (list) => ({
        supported: list.filter(p => p.status === "SUPPORTED").length,
        contradicted: list.filter(p => p.status === "CONTRADICTED").length,
        unresolved: list.filter(p => p.status === "UNRESOLVED").length,
        total: list.length
    });

    const primaryCounts = countBy(propositions);

    const nonExperimental =
        propositions.filter(p => p.evidence_requirement !== "EXPERIMENT");

    const sensitivityCounts = countBy(nonExperimental);

    function toMass(counts) {
        if (counts.total === 0) {
            // No propositions at all -- total ignorance, not evidence.
            return { R: 0, notR: 0, Theta: 1, counts };
        }
        return {
            R: counts.supported / counts.total,
            notR: counts.contradicted / counts.total,
            Theta: counts.unresolved / counts.total,
            counts
        };
    }

    return {
        primary: toMass(primaryCounts),
        sensitivity: toMass(sensitivityCounts)
    };
}


// ======================================================================
// DEMPSTER'S RULE OF COMBINATION
// ======================================================================
//
//   K = m1(R)*m2(notR) + m1(notR)*m2(R)
//
//   m12(R)     = [ m1(R)*m2(R)   + m1(R)*m2(Theta)   + m1(Theta)*m2(R)   ] / (1-K)
//   m12(notR)  = [ m1(notR)*m2(notR) + m1(notR)*m2(Theta) + m1(Theta)*m2(notR) ] / (1-K)
//   m12(Theta) = [ m1(Theta)*m2(Theta) ] / (1-K)
//
// K -> 1 (total conflict) makes (1-K) -> 0. This is a well-documented
// limitation of Dempster's rule (Zadeh's counterexample), not an
// implementation bug -- it is detected explicitly and reported as
// undefined rather than silently producing NaN or dividing by zero.
// ======================================================================

function combine(m1, m2) {

    const K = m1.R * m2.notR + m1.notR * m2.R;

    if (1 - K < EPS) {
        return {
            K,
            undefined: true,
            reason: "Total conflict (K approx 1): Dempster's rule is mathematically undefined at this point. " +
                     "This is a known limitation of the combination rule, not a computation error."
        };
    }

    const denom = 1 - K;

    const rawR = m1.R * m2.R + m1.R * m2.Theta + m1.Theta * m2.R;
    const rawNotR = m1.notR * m2.notR + m1.notR * m2.Theta + m1.Theta * m2.notR;
    const rawTheta = m1.Theta * m2.Theta;

    const R = rawR / denom;
    const notR = rawNotR / denom;
    const Theta = rawTheta / denom;

    return {
        K,
        undefined: false,
        R,
        notR,
        Theta,
        sum_check: R + notR + Theta // must be ~1.0
    };
}

function belief(mass) {
    return mass.R;
}

function plausibility(mass) {
    return mass.R + mass.Theta;
}

function pignistic(mass) {
    return mass.R + mass.Theta / 2;
}


// ======================================================================
// SELF-TESTS (Section F of the design document)
// ======================================================================
//
// Seven synthetic cases with independently hand-and-code-verified
// expected values. These prove the DST arithmetic is implemented
// correctly. They say NOTHING about the real findings below and must
// never be cited as empirical evidence -- only as proof the math works.
// ======================================================================

function runSelfTests() {

    const tolerance = 1e-6;

    function approxEqual(a, b) {
        return Math.abs(a - b) < tolerance;
    }

    function checkMass(actual, expected) {
        return (
            !actual.undefined &&
            approxEqual(actual.R, expected.R) &&
            approxEqual(actual.notR, expected.notR) &&
            approxEqual(actual.Theta, expected.Theta)
        );
    }

    const cases = [
        {
            id: 1,
            name: "support + support",
            m1: { R: 0.90, notR: 0.00, Theta: 0.10 },
            m2: { R: 0.85, notR: 0.00, Theta: 0.15 },
            expected: { K: 0, R: 0.985, notR: 0.000, Theta: 0.015 },
            expectUndefined: false
        },
        {
            id: 2,
            name: "contradiction + contradiction",
            m1: { R: 0.00, notR: 0.90, Theta: 0.10 },
            m2: { R: 0.00, notR: 0.85, Theta: 0.15 },
            expected: { K: 0, R: 0.000, notR: 0.985, Theta: 0.015 },
            expectUndefined: false
        },
        {
            id: 3,
            name: "support + contradiction",
            m1: { R: 0.90, notR: 0.00, Theta: 0.10 },
            m2: { R: 0.00, notR: 0.85, Theta: 0.15 },
            // Exact fractions: K=0.765, R=135/235=27/47, notR=85/235=17/47, Theta=15/235=3/47
            expected: { K: 0.765, R: 27 / 47, notR: 17 / 47, Theta: 3 / 47 },
            expectUndefined: false
        },
        {
            id: 4,
            name: "support + uncertainty",
            m1: { R: 0.90, notR: 0.00, Theta: 0.10 },
            m2: { R: 0.00, notR: 0.00, Theta: 1.00 },
            expected: { K: 0, R: 0.90, notR: 0.00, Theta: 0.10 },
            expectUndefined: false
        },
        {
            id: 5,
            name: "contradiction + uncertainty",
            m1: { R: 0.00, notR: 0.90, Theta: 0.10 },
            m2: { R: 0.00, notR: 0.00, Theta: 1.00 },
            expected: { K: 0, R: 0.00, notR: 0.90, Theta: 0.10 },
            expectUndefined: false
        },
        {
            id: 6,
            name: "complete conflict",
            m1: { R: 1.00, notR: 0.00, Theta: 0.00 },
            m2: { R: 0.00, notR: 1.00, Theta: 0.00 },
            expected: { K: 1.0 },
            expectUndefined: true
        },
        {
            id: 7,
            name: "no conflict, one certain source dominates",
            m1: { R: 1.00, notR: 0.00, Theta: 0.00 },
            m2: { R: 0.70, notR: 0.00, Theta: 0.30 },
            expected: { K: 0, R: 1.00, notR: 0.00, Theta: 0.00 },
            expectUndefined: false
        }
    ];

    const results = cases.map(c => {

        const actual = combine(c.m1, c.m2);

        let passed;
        let error;

        if (c.expectUndefined) {
            passed = actual.undefined === true && approxEqual(actual.K, c.expected.K);
            error = actual.undefined ? 0 : Math.abs(actual.K - c.expected.K);
        } else {
            passed =
                !actual.undefined &&
                approxEqual(actual.K, c.expected.K) &&
                checkMass(actual, c.expected);
            error = actual.undefined
                ? null
                : Math.max(
                    Math.abs(actual.K - c.expected.K),
                    Math.abs(actual.R - c.expected.R),
                    Math.abs(actual.notR - c.expected.notR),
                    Math.abs(actual.Theta - c.expected.Theta)
                );
        }

        return {
            case_id: c.id,
            name: c.name,
            m1: c.m1,
            m2: c.m2,
            expected: c.expected,
            actual: actual.undefined
                ? { K: round(actual.K, 6), undefined: true, reason: actual.reason }
                : {
                    K: round(actual.K, 6),
                    R: round(actual.R, 6),
                    notR: round(actual.notR, 6),
                    Theta: round(actual.Theta, 6),
                    sum_check: round(actual.sum_check, 6)
                },
            error,
            passed
        };
    });

    return {
        preamble:
            "These tests prove the Dempster combination arithmetic is implemented correctly. " +
            "They are synthetic and say NOTHING about the real findings below -- they must not " +
            "be cited as empirical evidence of anything about this protocol.",
        all_passed: results.every(r => r.passed),
        results
    };
}

const selfTests = runSelfTests();

if (!selfTests.all_passed) {
    throw new Error(
        "Node 17: DST self-tests failed. Refusing to run fusion on real findings until the " +
        "combination implementation is fixed. Failing cases: " +
        selfTests.results.filter(r => !r.passed).map(r => r.case_id).join(", ")
    );
}


// ======================================================================
// PROCESS EACH FINDING
// ======================================================================

const findings = [];

for (const fid of EXPECTED_FINDING_IDS) {

    const n07 = node07ById[fid];
    const n16 = node16ById[fid];

    const m07 = buildLLMMass(n07);
    const detMass = buildDeterministicMass(n16);

    const fusedPrimary = combine(m07, detMass.primary);
    const fusedSensitivity = combine(m07, detMass.sensitivity);

    function summarize(fused, detView) {

        if (fused.undefined) {
            return {
                undefined: true,
                reason: fused.reason,
                K: round(fused.K, 6)
            };
        }

        const Bel = belief(fused);
        const Pl = plausibility(fused);
        const BetP = pignistic(fused);

        const llmConfidence = m07.source_confidence;

        // PRIMARY divergence metric: D = |p_LLM - BetP(R)|. This is the number to use
        // for "how much did fusion change the answer" -- always report this first.
        //
        // interval_position (below/within/above) is DESCRIPTIVE ONLY. [Bel(R), Pl(R)]
        // is the range of probabilities consistent with the COMBINED evidence -- it is
        // NOT a confidence interval that Node 07's raw number is "supposed" to fall
        // inside, and falling outside it is NOT by itself evidence of overconfidence.
        // Proof: whenever Node 16 shows no contradiction (t=0), combined_R - c = s*(1-c)
        // >= 0 always, for ANY c -- so "LLM below Bel" is structurally guaranteed in that
        // regime regardless of whether Node 07's number was well-calibrated. In this
        // project's real findings (including the t>0 contradiction cases, F05/F10),
        // support consistently outweighs conflict (s > c*t), so every finding currently
        // shows "below_belief" -- this is a mechanical consequence of the mass-count
        // structure (see design doc Section G/G-addendum), not a per-finding signal.
        // Only report interval_position as informative when it is NOT the mechanically-
        // expected direction, i.e. "above_plausibility" (a genuine case where the
        // combined evidence supports LESS than Node 07 claimed) is the direction worth
        // real attention; "below_belief" should not be narrated as a finding-specific
        // result on its own.
        let intervalPosition = null;
        if (llmConfidence !== null) {
            if (llmConfidence < Bel - 1e-9) intervalPosition = "below_belief";
            else if (llmConfidence > Pl + 1e-9) intervalPosition = "above_plausibility";
            else intervalPosition = "within_interval";
        }

        // Flag is derived from the SAME rounded value that gets displayed,
        // not the raw float difference. Fixes a real boundary bug: e.g.
        // BetP=1, llmConfidence=0.85 -> raw JS float diff is
        // 0.15000000000000002 (IEEE754 representation noise), which is
        // "> 0.15" even though the true value is exactly the threshold --
        // so the flag fired while the displayed number read "0.15",
        // looking self-contradictory to anyone reviewing the output.
        const roundedAbsoluteDifference = round(Math.abs(BetP - llmConfidence), 6);
        const divergence = llmConfidence === null ? null : {
            absolute_difference: roundedAbsoluteDifference,
            threshold: DIVERGENCE_THRESHOLD,
            flag: roundedAbsoluteDifference > DIVERGENCE_THRESHOLD,
            interval_position: intervalPosition,
            interval_position_note:
                intervalPosition === "below_belief"
                    ? "Descriptive only -- NOT an overconfidence signal. Given this finding's mass structure, " +
                      "Node 07's confidence landing below Bel(R) is a structurally expected outcome (see " +
                      "methodology.interval_position_disclaimer), not evidence specific to this finding."
                    : intervalPosition === "above_plausibility"
                        ? "Node 07's raw confidence exceeds what the combined evidence supports (Pl(R)) -- " +
                          "this direction is NOT structurally guaranteed and is worth attention."
                        : "Node 07's raw confidence falls within the combined evidence's defensible range."
        };

        return {
            undefined: false,
            K: round(fused.K, 6),
            m_R: round(fused.R, 6),
            m_notR: round(fused.notR, 6),
            m_Theta: round(fused.Theta, 6),
            sum_check: round(fused.sum_check, 6),
            belief_R: round(Bel, 6),
            plausibility_R: round(Pl, 6),
            pignistic_R: round(BetP, 6),
            divergence
        };
    }

    findings.push({

        finding_id: fid,

        // v1.2: pure passthrough from Node 16 (itself a passthrough from Node
        // 13 v2.6+) -- never read or used in the DST computation below.
        sources: n16?.sources ?? null,

        llm_evidence: {
            source: "Node 07 (raw, independent of Node 16)",
            confidence: m07.source_confidence,
            severity: n07?.severity ?? null,
            risk_name: n07?.risk_name ?? null,
            mass: {
                R: round(m07.R, 6),
                notR: round(m07.notR, 6),
                Theta: round(m07.Theta, 6)
            }
        },

        deterministic_evidence: {
            source: "Node 16 (frozen, unmodified)",
            finding_status: n16?.status ?? null,
            primary: {
                counts: detMass.primary.counts,
                mass: {
                    R: round(detMass.primary.R, 6),
                    notR: round(detMass.primary.notR, 6),
                    Theta: round(detMass.primary.Theta, 6)
                }
            },
            sensitivity_excluding_experiment_propositions: {
                counts: detMass.sensitivity.counts,
                mass: {
                    R: round(detMass.sensitivity.R, 6),
                    notR: round(detMass.sensitivity.notR, 6),
                    Theta: round(detMass.sensitivity.Theta, 6)
                },
                methodological_note:
                    "Excludes the always-unresolved EXPERIMENT-type proposition every finding " +
                    "currently has (no Foundry behavioural tests executed yet). This removes a " +
                    "uniform uncertainty floor identical across all 11 findings, which the primary " +
                    "view cannot distinguish from genuine per-finding uncertainty. Neither view is " +
                    "objectively correct; both are reported."
            }
        },

        dst: {
            primary: summarize(fusedPrimary, "primary"),
            sensitivity_excluding_experiment_propositions: summarize(fusedSensitivity, "sensitivity")
        }
    });
}


// ======================================================================
// FINAL OUTPUT
// ======================================================================

return [
    {
        json: {

            node: "Node 17 - DST Evidence Fusion",
            version: "1.2",

            methodology: {
                purpose: "Fuse Node 07 (LLM-only, independent) with Node 16 (deterministic, frozen) " +
                         "using Dempster's rule of combination. Produces belief/plausibility intervals " +
                         "and an optional pignistic decision value per finding.",
                frame_of_discernment: ["R", "notR", "Theta"],
                combination_rule: "Classical normalized Dempster's rule of combination",
                independence_note:
                    "Node 07 is used, not the Evidence Review Agent, because Dempster's rule requires " +
                    "independent evidence sources. The Evidence Review Agent has already seen Node 16's " +
                    "output and would double-count the deterministic signal if combined with it directly.",
                node_16_status: "Read-only. Never modified, never treated as ground truth.",
                pignistic_disclaimer:
                    "pignistic_R (BetP) is a decision-oriented reporting transform, not evidence and not " +
                    "proof of calibration. Calibration must be evaluated empirically (see Node 18) and only " +
                    "where independent ground truth exists.",
                divergence_threshold_disclaimer:
                    `The divergence_threshold (${DIVERGENCE_THRESHOLD}) is an engineering/evaluation ` +
                    "parameter for flagging purposes only, not a scientifically validated constant. The raw " +
                    "continuous divergence value is always reported alongside the flag.",
                primary_divergence_metric:
                    "The PRIMARY comparison between Node 07 and the fused result is divergence.absolute_difference " +
                    "= |Node 07 confidence - BetP(R)|. Use this number, not interval position, as the headline metric.",
                interval_position_disclaimer:
                    "[Bel(R), Pl(R)] is the range of probabilities consistent with the COMBINED evidence -- " +
                    "it is NOT a confidence interval Node 07's raw number is expected to fall inside, and " +
                    "falling below it is NOT by itself evidence of overconfidence. Proof: whenever Node 16 " +
                    "shows no contradiction (t=0), combined_R - c = s*(1-c) >= 0 always, for any Node 07 " +
                    "confidence c -- so divergence.interval_position = 'below_belief' is structurally " +
                    "guaranteed in that regime, regardless of whether Node 07's number was well-calibrated. " +
                    "In this project's real findings, this holds even in the t>0 contradiction cases, because " +
                    "support consistently outweighs conflict. Only divergence.interval_position = " +
                    "'above_plausibility' represents a direction that is not structurally guaranteed and is " +
                    "worth treating as informative."
            },

            self_tests: selfTests,

            findings
        }
    }
];
