/***********************************************************************
 * NODE 17 — DST EVIDENCE FUSION (VENUS VARIANT)
 * VERSION 1.1 -- fixed a floating-point boundary bug where the
 * divergence flag compared the raw unrounded float difference against
 * the threshold instead of the same rounded value that gets displayed,
 * causing exactly-at-threshold cases (e.g. 1 - 0.85) to flag as
 * exceeding it due to IEEE754 representation noise, not a real
 * divergence. See the flag computation below for the fix and rationale.
 *
 * Venus counterpart to 17_dst_evidence_fusion.js (the Aave version),
 * in the same relationship as 13_deterministic_evidence_specification_
 * venus.js / 16 (Venus) are to their Aave originals. Pure mathematical
 * fusion node. No LLM calls, no randomness. The Dempster's-rule
 * arithmetic itself (combine/belief/plausibility/pignistic, and the
 * 7 self-tests) is UNCHANGED from the Aave version -- that math is
 * protocol-agnostic. What changes is entirely about FINDING IDENTITY.
 *
 * WHY THE AAVE VERSION CANNOT RUN AS-IS ON VENUS
 * ----------------------------------------------------------------------
 * The Aave version hardcodes EXPECTED_FINDING_IDS = [F01..F11] and
 * extracts IDs with an /F(\d{2})/ regex. Venus's finding taxonomy is
 * open (UPGRADEABILITY_01, ASSET_CUSTODY_01, ...), so there is no fixed
 * list and no "F\d{2}" shape to extract.
 *
 * A second, sharper problem specific to fusion: Node 17 needs Node 07's
 * raw `confidence` (for the LLM mass) and Node 16's resolved finding_id
 * (for the deterministic mass) correlated to the SAME finding. In Aave
 * both sides already share the fixed F01-F11 IDs, so correlation is
 * trivial. In Venus, Node 07's raw finding_id and Node 16's resolved
 * finding_id (a VENUS_SPEC key) are NOT guaranteed to be the same
 * string -- that is exactly why Node 13 (Venus) needed anchor-token
 * overlap matching instead of ID matching in the first place. Re-
 * deriving that correspondence independently here (e.g. normalizing
 * both IDs and hoping they line up) would duplicate Node 13's matching
 * logic in a weaker form and risk silently diverging from it.
 *
 * FIX: read the Node 07 side from NODE 13 (VENUS)'S OWN OUTPUT --
 * specifically source_findings.node07_architecture.confidence, which
 * Node 13 already resolved to the correct spec_key via anchor-token
 * matching. Node 13's sourceEntry() (v1.2) was extended with one
 * additive field, `confidence`, verbatim from the raw Node 07 finding,
 * specifically to support this. Node 16 is still read for the
 * deterministic mass and is still never modified, re-scored, or
 * treated as ground truth. Node 13 is likewise READ ONLY here -- this
 * node computes nothing from it beyond looking up a confidence number.
 *
 * FINDING IDENTITY (OPEN TAXONOMY, LIKE NODE 13/16)
 * ----------------------------------------------------------------------
 * The set of findings fused is whatever Node 16 (Venus) actually
 * output this run -- no fixed list, no fixed count, same open-taxonomy
 * posture as Node 13/16. A finding with NO Node 07 confidence (an
 * audit-only finding that never resolved a Node 07 counterpart, or an
 * UNMAPPED-* entry with no propositions at all) is still fused, not
 * silently dropped -- its LLM mass is total ignorance (Theta=1, same
 * as Aave's "no usable confidence" case), which is mathematically
 * well-defined (see self-test cases 4/5: fusing with total ignorance
 * returns the other operand unchanged). Each such finding is explicitly
 * labelled fusion_applicable=false so nobody mistakes "fused with
 * nothing" for "fused two independent sources."
 *
 * Node 16 is NEVER modified, re-scored, or treated as ground truth.
 * Node 13 is NEVER modified. No new propositions or findings invented.
 *
 * FRAME OF DISCERNMENT: Theta = { R, notR } -- unchanged from Aave.
 ***********************************************************************/


// ======================================================================
// CONFIGURATION
// ======================================================================

// Engineering/evaluation threshold only -- explicitly NOT a validated
// scientific constant, unchanged from the Aave version.
const DIVERGENCE_THRESHOLD = 0.15;

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

const NODE_13_CANDIDATES = [
    "13_Deterministic_Evidence_Specification_Venus",
    "13_Deterministic_Evidence_Specification",
    "Node 13"
];
let node13 = null;
for (const name of NODE_13_CANDIDATES) {
    const data = getNodeJSON(name);
    if (data) { node13 = data; break; }
}

const NODE_16_CANDIDATES = [
    "16_Deterministic_Evidence_Anchor_Venus",
    "14_Deterministic_Validation",
    "16_Deterministic_Evidence_Anchor",
    "Node 16"
];
let node16 = null;
for (const name of NODE_16_CANDIDATES) {
    const data = getNodeJSON(name);
    if (data) { node16 = data; break; }
}

if (!node16 || !Object.keys(node16).length) {
    throw new Error(
        "Node 17 (Venus): Deterministic validation input (Node 16) could not be found. " +
        "Tried: " + NODE_16_CANDIDATES.join(", ") + "."
    );
}
if (!node13 || !Object.keys(node13).length) {
    throw new Error(
        "Node 17 (Venus): Node 13's output could not be found -- needed to read Node 07's " +
        "already-resolved confidence per finding. Tried: " + NODE_13_CANDIDATES.join(", ") + "."
    );
}


// ======================================================================
// GENERIC HELPERS
// ======================================================================

function str(v) { return v == null ? "" : String(v); }

function round(x, dp) {
    const f = Math.pow(10, dp);
    return Math.round((x + Number.EPSILON) * f) / f;
}


// ======================================================================
// EXTRACT NODE 13 (VENUS) FINDINGS -- read only, for confidence lookup
// ======================================================================

function extractNode13Findings(root) {
    const candidates = [
        root?.deterministic_evidence?.findings,
        root?.findings
    ];
    for (const candidate of candidates) {
        if (Array.isArray(candidate) && candidate.length) return candidate;
    }
    return [];
}

const node13Findings = extractNode13Findings(node13);
const node13ById = {};
for (const f of node13Findings) {
    const fid = str(f.finding_id).trim();
    if (fid) node13ById[fid] = f;
}


// ======================================================================
// EXTRACT NODE 16 (VENUS) FINDINGS -- deterministic, frozen, read only
// ======================================================================

function extractNode16Findings(root) {
    const candidates = [root?.findings, root?.output?.findings];
    for (const candidate of candidates) {
        if (Array.isArray(candidate) && candidate.length) return candidate;
    }
    return [];
}

const node16Findings = extractNode16Findings(node16);

if (!node16Findings.length) {
    throw new Error(
        "Node 17 (Venus): Node 16 supplied no findings. Node 17 does not invent findings -- fix upstream."
    );
}


// ======================================================================
// COVERAGE CHECK (read-only visibility -- open taxonomy, no fixed list)
// ======================================================================
// Node 16's finding_id is mirrored verbatim from Node 13 (confirmed:
// Node 16 never reformats or reassigns finding_id -- invariant I4).
// So every finding_id in Node 16 should also exist in Node 13's own
// output. If one doesn't, that's a real upstream inconsistency worth
// surfacing, but Node 17 still runs -- it just fuses that finding with
// no Node 07 confidence available (same as an audit-only finding).
// ======================================================================

const node16FindingIds = node16Findings.map(f => str(f.finding_id).trim()).filter(Boolean);
const presentInNode16NotNode13 = node16FindingIds.filter(id => !node13ById[id]);


// ======================================================================
// MASS ASSIGNMENT -- LLM SIDE (Node 07's confidence, via Node 13)
// ======================================================================
// Node 07 is a risk-IDENTIFICATION agent: every finding it emits is a
// proposed R. It has no mechanism for asserting notR. Its `confidence`
// is mapped directly, unchanged from the Aave version:
//
//     m_07(R)    = confidence
//     m_07(notR) = 0
//     m_07(Theta) = 1 - confidence
//
// The confidence value itself comes from Node 13's
// source_findings.node07_architecture.confidence -- i.e. Node 07's
// finding AFTER it has already been correctly anchor-token-resolved to
// this specific Venus spec_key by Node 13, not from an independent
// re-match here.
// ======================================================================

function buildLLMMass(node13Finding) {

    const confidence = node13Finding?.source_findings?.node07_architecture?.confidence;
    const usable = typeof confidence === "number" ? Math.max(0, Math.min(1, confidence)) : null;

    if (usable === null) {
        // No Node 07 counterpart resolved for this finding (audit-only,
        // or an UNMAPPED-* entry with no source at all) -- total
        // ignorance, not zero risk.
        return { R: 0, notR: 0, Theta: 1, source_confidence: null };
    }

    return {
        R: usable,
        notR: 0,
        Theta: 1 - usable,
        source_confidence: usable
    };
}


// ======================================================================
// MASS ASSIGNMENT -- DETERMINISTIC SIDE (Node 16 proposition counts)
// ======================================================================
// Unchanged in substance from the Aave version. Primary view counts
// every proposition including EXPERIMENT-type ones (some of which are
// still genuinely NOT_TESTED for Venus -- e.g. OPERATIONAL_RESILIENCE_01
// -P03 -- unlike Aave where none had live tests yet at all). Sensitivity
// view excludes EXPERIMENT-type propositions entirely. Both always
// computed and reported, never silently substituted.
// ======================================================================

function buildDeterministicMass(node16Finding) {

    const propositions = Array.isArray(node16Finding?.propositions) ? node16Finding.propositions : [];

    const countBy = (list) => ({
        supported: list.filter(p => p.status === "SUPPORTED").length,
        contradicted: list.filter(p => p.status === "CONTRADICTED").length,
        unresolved: list.filter(p => p.status === "UNRESOLVED").length,
        total: list.length
    });

    const primaryCounts = countBy(propositions);
    const nonExperimental = propositions.filter(p => p.evidence_requirement !== "EXPERIMENT");
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
// DEMPSTER'S RULE OF COMBINATION -- unchanged from the Aave version
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

    return { K, undefined: false, R, notR, Theta, sum_check: R + notR + Theta };
}

function belief(mass) { return mass.R; }
function plausibility(mass) { return mass.R + mass.Theta; }
function pignistic(mass) { return mass.R + mass.Theta / 2; }


// ======================================================================
// SELF-TESTS -- unchanged from the Aave version (pure math, protocol-
// agnostic; proves the arithmetic, says nothing about real findings)
// ======================================================================

function runSelfTests() {

    const tolerance = 1e-6;
    function approxEqual(a, b) { return Math.abs(a - b) < tolerance; }
    function checkMass(actual, expected) {
        return !actual.undefined &&
            approxEqual(actual.R, expected.R) &&
            approxEqual(actual.notR, expected.notR) &&
            approxEqual(actual.Theta, expected.Theta);
    }

    const cases = [
        { id: 1, name: "support + support",
          m1: { R: 0.90, notR: 0.00, Theta: 0.10 }, m2: { R: 0.85, notR: 0.00, Theta: 0.15 },
          expected: { K: 0, R: 0.985, notR: 0.000, Theta: 0.015 }, expectUndefined: false },
        { id: 2, name: "contradiction + contradiction",
          m1: { R: 0.00, notR: 0.90, Theta: 0.10 }, m2: { R: 0.00, notR: 0.85, Theta: 0.15 },
          expected: { K: 0, R: 0.000, notR: 0.985, Theta: 0.015 }, expectUndefined: false },
        { id: 3, name: "support + contradiction",
          m1: { R: 0.90, notR: 0.00, Theta: 0.10 }, m2: { R: 0.00, notR: 0.85, Theta: 0.15 },
          expected: { K: 0.765, R: 27 / 47, notR: 17 / 47, Theta: 3 / 47 }, expectUndefined: false },
        { id: 4, name: "support + uncertainty",
          m1: { R: 0.90, notR: 0.00, Theta: 0.10 }, m2: { R: 0.00, notR: 0.00, Theta: 1.00 },
          expected: { K: 0, R: 0.90, notR: 0.00, Theta: 0.10 }, expectUndefined: false },
        { id: 5, name: "contradiction + uncertainty",
          m1: { R: 0.00, notR: 0.90, Theta: 0.10 }, m2: { R: 0.00, notR: 0.00, Theta: 1.00 },
          expected: { K: 0, R: 0.00, notR: 0.90, Theta: 0.10 }, expectUndefined: false },
        { id: 6, name: "complete conflict",
          m1: { R: 1.00, notR: 0.00, Theta: 0.00 }, m2: { R: 0.00, notR: 1.00, Theta: 0.00 },
          expected: { K: 1.0 }, expectUndefined: true },
        { id: 7, name: "no conflict, one certain source dominates",
          m1: { R: 1.00, notR: 0.00, Theta: 0.00 }, m2: { R: 0.70, notR: 0.00, Theta: 0.30 },
          expected: { K: 0, R: 1.00, notR: 0.00, Theta: 0.00 }, expectUndefined: false }
    ];

    const results = cases.map(c => {
        const actual = combine(c.m1, c.m2);
        let passed, error;
        if (c.expectUndefined) {
            passed = actual.undefined === true && approxEqual(actual.K, c.expected.K);
            error = actual.undefined ? 0 : Math.abs(actual.K - c.expected.K);
        } else {
            passed = !actual.undefined && approxEqual(actual.K, c.expected.K) && checkMass(actual, c.expected);
            error = actual.undefined ? null : Math.max(
                Math.abs(actual.K - c.expected.K),
                Math.abs(actual.R - c.expected.R),
                Math.abs(actual.notR - c.expected.notR),
                Math.abs(actual.Theta - c.expected.Theta)
            );
        }
        return {
            case_id: c.id, name: c.name, m1: c.m1, m2: c.m2, expected: c.expected,
            actual: actual.undefined
                ? { K: round(actual.K, 6), undefined: true, reason: actual.reason }
                : { K: round(actual.K, 6), R: round(actual.R, 6), notR: round(actual.notR, 6),
                    Theta: round(actual.Theta, 6), sum_check: round(actual.sum_check, 6) },
            error, passed
        };
    });

    return {
        preamble: "These tests prove the Dempster combination arithmetic is implemented correctly. " +
            "They are synthetic and say NOTHING about the real findings below -- they must not " +
            "be cited as empirical evidence of anything about this protocol.",
        all_passed: results.every(r => r.passed),
        results
    };
}

const selfTests = runSelfTests();

if (!selfTests.all_passed) {
    throw new Error(
        "Node 17 (Venus): DST self-tests failed. Refusing to run fusion on real findings until the " +
        "combination implementation is fixed. Failing cases: " +
        selfTests.results.filter(r => !r.passed).map(r => r.case_id).join(", ")
    );
}


// ======================================================================
// PROCESS EACH FINDING (open taxonomy -- whatever Node 16 output)
// ======================================================================

const findings = [];

for (const n16 of node16Findings) {

    const fid = str(n16.finding_id).trim();
    const n13 = node13ById[fid] || null;

    const m07 = buildLLMMass(n13);
    const detMass = buildDeterministicMass(n16);

    const fusedPrimary = combine(m07, detMass.primary);
    const fusedSensitivity = combine(m07, detMass.sensitivity);

    const fusionApplicable = m07.source_confidence !== null && detMass.primary.counts.total > 0;

    function summarize(fused) {

        if (fused.undefined) {
            return { undefined: true, reason: fused.reason, K: round(fused.K, 6) };
        }

        const Bel = belief(fused);
        const Pl = plausibility(fused);
        const BetP = pignistic(fused);
        const llmConfidence = m07.source_confidence;

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
                    ? "Descriptive only -- NOT an overconfidence signal. See methodology.interval_position_disclaimer."
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
        finding_name: n16.finding_name ?? n13?.finding_name ?? null,
        sources: n13?.sources ?? null,
        fusion_applicable: fusionApplicable,
        fusion_note: fusionApplicable
            ? null
            : "No independent Node 07 confidence and/or no Node 16 propositions exist for this finding " +
              "(e.g. an audit-only or UNMAPPED-* entry). The fused mass below equals whichever single " +
              "operand carried real evidence, unchanged -- this is mathematically correct (see self-test " +
              "cases 4/5), not a fusion of two independent sources. Do not read it as such.",

        llm_evidence: {
            source: "Node 13 (Venus) source_findings.node07_architecture.confidence -- Node 07's raw " +
                     "confidence, after Node 13's anchor-token resolution, never independently re-matched here.",
            confidence: m07.source_confidence,
            mass: { R: round(m07.R, 6), notR: round(m07.notR, 6), Theta: round(m07.Theta, 6) }
        },

        deterministic_evidence: {
            source: "Node 16 (Venus) (frozen, unmodified)",
            finding_status: n16?.status ?? null,
            primary: {
                counts: detMass.primary.counts,
                mass: { R: round(detMass.primary.R, 6), notR: round(detMass.primary.notR, 6), Theta: round(detMass.primary.Theta, 6) }
            },
            sensitivity_excluding_experiment_propositions: {
                counts: detMass.sensitivity.counts,
                mass: { R: round(detMass.sensitivity.R, 6), notR: round(detMass.sensitivity.notR, 6), Theta: round(detMass.sensitivity.Theta, 6) },
                methodological_note:
                    "Excludes EXPERIMENT-type propositions. Unlike Aave (where none had live tests yet), " +
                    "Venus has real executed behavioural tests for 5 of 6 spec findings -- so this view " +
                    "removes real, not just placeholder, behavioural evidence. Both views are reported; " +
                    "neither is objectively correct."
            }
        },

        dst: {
            primary: summarize(fusedPrimary),
            sensitivity_excluding_experiment_propositions: summarize(fusedSensitivity)
        }
    });
}


// ======================================================================
// FINAL OUTPUT
// ======================================================================

return [
    {
        json: {

            node: "Node 17 (Venus) - DST Evidence Fusion",
            version: "1.1",

            methodology: {
                purpose: "Fuse Node 07 (LLM-only, independent, via Node 13's already-resolved confidence) " +
                         "with Node 16 (deterministic, frozen) using Dempster's rule of combination.",
                frame_of_discernment: ["R", "notR", "Theta"],
                combination_rule: "Classical normalized Dempster's rule of combination",
                finding_identity:
                    "Open taxonomy (unlike Aave's fixed F01-F11): whatever finding_ids Node 16 (Venus) " +
                    "actually output this run are fused, no fixed list, no fixed count.",
                node07_correlation_note:
                    "Node 07's confidence is read from Node 13 (Venus)'s source_findings.node07_architecture, " +
                    "which Node 13 already anchor-token-resolved to the correct spec_key. Node 17 does not " +
                    "independently re-match Node 07 to Node 16 by finding_id string comparison, since those " +
                    "strings are not guaranteed to coincide for Venus's open taxonomy.",
                node_13_status: "Read-only, used solely to look up Node 07's already-resolved confidence per finding. Never modified.",
                node_16_status: "Read-only. Never modified, never treated as ground truth.",
                fusion_applicable_disclaimer:
                    "Some findings (audit-only, or UNMAPPED-* entries) have no Node 07 confidence and/or no " +
                    "Node 16 propositions. These are still included, not dropped, but marked " +
                    "fusion_applicable=false -- their reported mass is a pass-through of whichever single " +
                    "operand carried real evidence, not an actual fusion of two independent sources.",
                pignistic_disclaimer:
                    "pignistic_R (BetP) is a decision-oriented reporting transform, not evidence and not " +
                    "proof of calibration. Calibration must be evaluated empirically (see Node 18) and only " +
                    "where independent ground truth exists.",
                divergence_threshold_disclaimer:
                    `The divergence_threshold (${DIVERGENCE_THRESHOLD}) is an engineering/evaluation ` +
                    "parameter for flagging purposes only, not a scientifically validated constant.",
                primary_divergence_metric:
                    "The PRIMARY comparison between Node 07 and the fused result is divergence.absolute_difference " +
                    "= |Node 07 confidence - BetP(R)|. Use this number, not interval position, as the headline metric.",
                interval_position_disclaimer:
                    "[Bel(R), Pl(R)] is the range of probabilities consistent with the COMBINED evidence -- " +
                    "it is NOT a confidence interval Node 07's raw number is expected to fall inside."
            },

            coverage: {
                node16_finding_ids: node16FindingIds,
                present_in_node16_not_node13: presentInNode16NotNode13,
                note: presentInNode16NotNode13.length
                    ? "These finding_ids exist in Node 16 but not in Node 13's own output -- unexpected, " +
                      "since Node 16 mirrors Node 13's finding_id verbatim. Fused with no Node 07 confidence."
                    : "Every Node 16 finding_id was found in Node 13's output, as expected."
            },

            self_tests: selfTests,

            findings
        }
    }
];
