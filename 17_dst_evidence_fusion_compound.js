/***********************************************************************
 * NODE 17 — DST EVIDENCE FUSION (COMPOUND VARIANT)
 * VERSION 1.0
 *
 * Compound counterpart to 17_dst_evidence_fusion_venus.js, in the same
 * relationship 13/16 (Compound) are to their Venus originals. Pure
 * mathematical fusion node. No LLM calls, no randomness. The Dempster's-
 * rule arithmetic itself (combine/belief/plausibility/pignistic, and the
 * 7 self-tests) is UNCHANGED from the Aave/Venus versions -- that math
 * is protocol-agnostic. What changes is FINDING IDENTITY and, uniquely
 * for Compound, an extra disclosure requirement around its negative
 * control.
 *
 * FINDING IDENTITY (OPEN TAXONOMY, LIKE VENUS)
 * ----------------------------------------------------------------------
 * Whatever finding_ids Node 16 (Compound) / 14_Deterministic_Validation
 * actually output this run are fused -- no fixed list, no fixed count,
 * same open-taxonomy posture as Node 13/16 (Compound). A finding with no
 * Node 07 confidence (an audit-only finding, an UNMAPPED-* entry with no
 * propositions at all, or the always-emitted negative control when
 * Node07/08 didn't independently claim it this run) is still fused, not
 * dropped -- its LLM mass is total ignorance (Theta=1), which is
 * mathematically well-defined (self-test cases 4/5: fusing with total
 * ignorance returns the other operand unchanged). Each such finding is
 * explicitly labelled fusion_applicable=false.
 *
 * NODE 07 CORRELATION (SAME FIX AS VENUS)
 * ----------------------------------------------------------------------
 * Node 07's raw finding_id and Node 16 (Compound)'s resolved finding_id
 * (a COMPOUND_SPEC key) are not guaranteed to be the same string --
 * that's why Node 13 (Compound) needed anchor-token overlap matching in
 * the first place, exactly as Venus did. So Node 07's confidence is read
 * from Node 13 (Compound)'s own output --
 * source_findings.node07_architecture.confidence -- which Node 13 has
 * already anchor-token-resolved to the correct COMPOUND_SPEC key. This
 * field only exists on RESOLVED findings (buildResolvedFinding); it does
 * not exist on UNMAPPED-* findings (buildUnmappedFinding) or on the
 * negative control when it's emitted via its always-on fallback path
 * (buildNegativeControlFinding sets source_findings.node07_architecture
 * to null explicitly) -- all three cases fall through to total ignorance
 * below, which is correct: there is genuinely no independent LLM
 * confidence to fuse in those cases, not a bug to work around.
 *
 * WHY THE NEGATIVE CONTROL (UPGRADEABILITY_01) NEEDS EXTRA DISCLOSURE
 * HERE, NOT JUST AT NODE 16
 * ----------------------------------------------------------------------
 * The frame of discernment below is Theta = { R, notR }, where R means
 * "the stated claim is true." For every STANDARD finding, the stated
 * claim IS the risk ("admin can do X unilaterally"), so a high fused
 * pignistic_R correctly reads as "high confidence this risk is real."
 * UPGRADEABILITY_01's stated claim is the OPPOSITE of the risk it names
 * ("the deployed contract has NO delegatecall-proxy mechanism") -- Node
 * 13/16 (Compound) already handle this at the finding-status level via
 * finding_polarity/status_interpretation, but that handling lives on
 * Node 16's `status` field, not on this node's independently-computed
 * DST mass. Without an equivalent disclosure here, a reader could see
 * this finding's real pignistic_R = 1.0 (100% confidence the deployment
 * has no delegatecall proxy) and misread it, out of context, as "100%
 * confidence an upgradeability risk was confirmed." finding_polarity and
 * Node 16's status_interpretation are passed through unchanged onto
 * every finding's `dst` block, and a NEGATIVE_CONTROL finding additionally
 * gets an explicit polarity_warning string directly next to its own
 * numbers -- the DST mass computation itself is NOT altered or flipped
 * for negative controls, since doing so would silently redefine what R
 * means per-finding depending on polarity, which is worse than leaving
 * the math uniform and disclosing the reading direction in words.
 *
 * Node 16 (Compound) is NEVER modified, re-scored, or treated as ground
 * truth. Node 13 (Compound) is NEVER modified. No new findings invented.
 *
 * FRAME OF DISCERNMENT: Theta = { R, notR } -- unchanged from Aave/Venus.
 ***********************************************************************/


// ======================================================================
// CONFIGURATION
// ======================================================================

// Engineering/evaluation threshold only -- explicitly NOT a validated
// scientific constant, unchanged from the Aave/Venus versions.
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
    "13_Deterministic_Evidence_Specification_Compound",
    "13_Deterministic_Evidence_Specification",
    "Deterministic Evidence Specification (Compound)",
    "Node 13"
];
let node13Root = null;
for (const name of NODE_13_CANDIDATES) {
    const data = getNodeJSON(name);
    if (data) { node13Root = data; break; }
}

// Real Compound canvas name for Node 16's equivalent step is
// 14_Deterministic_Validation (see 16_deterministic_evidence_anchor_
// compound.js header for why the pipeline-step number and the canvas
// node name diverge). Checked first; other names kept as fallbacks in
// case the canvas is renamed later.
const NODE_16_CANDIDATES = [
    "14_Deterministic_Validation",
    "16_Deterministic_Evidence_Anchor_Compound",
    "16_Deterministic_Evidence_Anchor",
    "Node 16"
];
let node16Root = null;
for (const name of NODE_16_CANDIDATES) {
    const data = getNodeJSON(name);
    if (data) { node16Root = data; break; }
}

if (!node16Root || !Object.keys(node16Root).length) {
    throw new Error(
        "Node 17 (Compound): Deterministic validation input (Node 16 / 14_Deterministic_Validation) " +
        "could not be found. Tried: " + NODE_16_CANDIDATES.join(", ") + "."
    );
}
if (!node13Root || !Object.keys(node13Root).length) {
    throw new Error(
        "Node 17 (Compound): Node 13 (Compound)'s output could not be found -- needed to read Node 07's " +
        "already-resolved confidence per finding. Tried: " + NODE_13_CANDIDATES.join(", ") + "."
    );
}

// Node 13 (Compound) wraps its real output in a `deterministic_evidence`
// key, same as Node 16 (Compound) had to account for -- tolerate both.
const node13 =
    node13Root && typeof node13Root === "object" && node13Root.deterministic_evidence
        ? node13Root.deterministic_evidence
        : node13Root;
const node16 = node16Root;


// ======================================================================
// GENERIC HELPERS
// ======================================================================

function str(v) { return v == null ? "" : String(v); }

function round(x, dp) {
    const f = Math.pow(10, dp);
    return Math.round((x + Number.EPSILON) * f) / f;
}


// ======================================================================
// EXTRACT NODE 13 (COMPOUND) FINDINGS -- read only, for confidence lookup
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

const node13Findings = extractNode13Findings(node13Root);
const node13ById = {};
for (const f of node13Findings) {
    const fid = str(f.finding_id).trim();
    if (fid) node13ById[fid] = f;
}


// ======================================================================
// EXTRACT NODE 16 (COMPOUND) FINDINGS -- deterministic, frozen, read only
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
        "Node 17 (Compound): Node 16 supplied no findings. Node 17 does not invent findings -- fix upstream."
    );
}


// ======================================================================
// COVERAGE CHECK (read-only visibility -- open taxonomy, no fixed list)
// ======================================================================
// Node 16's finding_id is mirrored verbatim from Node 13 (Compound)
// (confirmed: Node 16 never reformats or reassigns finding_id --
// invariant I4). So every finding_id in Node 16 should also exist in
// Node 13's own output. If one doesn't, that's a real upstream
// inconsistency worth surfacing, but Node 17 still runs -- it just
// fuses that finding with no Node 07 confidence available (same as an
// audit-only finding).
// ======================================================================

const node16FindingIds = node16Findings.map(f => str(f.finding_id).trim()).filter(Boolean);
const presentInNode16NotNode13 = node16FindingIds.filter(id => !node13ById[id]);


// ======================================================================
// MASS ASSIGNMENT -- LLM SIDE (Node 07's confidence, via Node 13)
// ======================================================================
// Node 07 is a risk-IDENTIFICATION agent: every finding it emits is a
// proposed R. It has no mechanism for asserting notR. Its `confidence`
// is mapped directly, unchanged from the Aave/Venus versions:
//
//     m_07(R)    = confidence
//     m_07(notR) = 0
//     m_07(Theta) = 1 - confidence
//
// The confidence value itself comes from Node 13 (Compound)'s
// source_findings.node07_architecture.confidence -- i.e. Node 07's
// finding AFTER it has already been correctly anchor-token-resolved to
// this specific Compound spec_key by Node 13, not from an independent
// re-match here.
// ======================================================================

function buildLLMMass(node13Finding) {

    const confidence = node13Finding?.source_findings?.node07_architecture?.confidence;
    const usable = typeof confidence === "number" ? Math.max(0, Math.min(1, confidence)) : null;

    if (usable === null) {
        // No Node 07 counterpart resolved for this finding (audit-only,
        // an UNMAPPED-* entry with no source at all, or the negative
        // control's always-on fallback path) -- total ignorance, not
        // zero risk.
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
// Unchanged in substance from the Aave/Venus versions. Primary view
// counts every proposition including EXPERIMENT-type ones (one of which,
// ECONOMIC_DEPENDENCY_01-P03, is EXECUTED_PRECONDITION_UNMET for
// Compound -- Node 16 already maps that to status UNRESOLVED, so it
// counts as Theta mass here like any other unresolved proposition; this
// node does not need to know about EXECUTED_PRECONDITION_UNMET
// specifically). Sensitivity view excludes EXPERIMENT-type propositions
// entirely. Both always computed and reported, never silently
// substituted.
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
// DEMPSTER'S RULE OF COMBINATION -- unchanged from the Aave/Venus versions
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
// SELF-TESTS -- unchanged from the Aave/Venus versions (pure math,
// protocol-agnostic; proves the arithmetic, says nothing about real
// findings)
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
        "Node 17 (Compound): DST self-tests failed. Refusing to run fusion on real findings until the " +
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

    const findingPolarity = n16.finding_polarity || "STANDARD";
    const isNegativeControl = findingPolarity === "NEGATIVE_CONTROL";

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
        // not the raw float difference -- same fix as Venus v1.1: e.g.
        // BetP=1, llmConfidence=0.85 -> raw JS float diff is
        // 0.15000000000000002 (IEEE754 representation noise), which is
        // "> 0.15" even though the true value is exactly the threshold.
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
            divergence,
            // See header comment: R always means "the finding's STATED
            // claim is true," never re-mapped by polarity. For a
            // NEGATIVE_CONTROL finding the stated claim is the absence
            // of the risk, so a high pignistic_R here means the risk is
            // RULED OUT, not confirmed -- read it together with
            // finding_polarity / status_interpretation on this finding,
            // not in isolation.
            polarity_warning: isNegativeControl
                ? "NEGATIVE_CONTROL: R above = confidence in the STATED CLAIM (\"no delegatecall-proxy " +
                  "mechanism exists\"), not confidence in the named risk. High pignistic_R here means the " +
                  "upgradeability risk is ruled out, not confirmed. Cross-check against finding_polarity and " +
                  "status_interpretation on this same finding before reporting this number standalone."
                : null
        };
    }

    findings.push({

        finding_id: fid,
        finding_name: n16.finding_name ?? n13?.finding_name ?? null,
        finding_polarity: findingPolarity,
        status_interpretation: n16.status_interpretation ?? null,
        sources: n13?.sources ?? null,
        fusion_applicable: fusionApplicable,
        fusion_note: fusionApplicable
            ? null
            : "No independent Node 07 confidence and/or no Node 16 propositions exist for this finding " +
              "(e.g. an audit-only, UNMAPPED-* entry, or the negative control's always-on fallback path). " +
              "The fused mass below equals whichever single operand carried real evidence, unchanged -- this " +
              "is mathematically correct (see self-test cases 4/5), not a fusion of two independent sources. " +
              "Do not read it as such.",

        llm_evidence: {
            source: "Node 13 (Compound) source_findings.node07_architecture.confidence -- Node 07's raw " +
                     "confidence, after Node 13's anchor-token resolution, never independently re-matched here.",
            confidence: m07.source_confidence,
            mass: { R: round(m07.R, 6), notR: round(m07.notR, 6), Theta: round(m07.Theta, 6) }
        },

        deterministic_evidence: {
            source: "Node 16 (Compound) / 14_Deterministic_Validation (frozen, unmodified)",
            finding_status: n16?.status ?? null,
            primary: {
                counts: detMass.primary.counts,
                mass: { R: round(detMass.primary.R, 6), notR: round(detMass.primary.notR, 6), Theta: round(detMass.primary.Theta, 6) }
            },
            sensitivity_excluding_experiment_propositions: {
                counts: detMass.sensitivity.counts,
                mass: { R: round(detMass.sensitivity.R, 6), notR: round(detMass.sensitivity.notR, 6), Theta: round(detMass.sensitivity.Theta, 6) },
                methodological_note:
                    "Excludes EXPERIMENT-type propositions. Compound has real executed behavioural tests for " +
                    "every spec finding (including one EXECUTED_PRECONDITION_UNMET result on " +
                    "ECONOMIC_DEPENDENCY_01, which Node 16 already maps to UNRESOLVED/Theta mass) -- so this " +
                    "view removes real, not placeholder, behavioural evidence. Both views are reported; " +
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

            node: "Node 17 (Compound) - DST Evidence Fusion",
            version: "1.0",

            methodology: {
                purpose: "Fuse Node 07 (LLM-only, independent, via Node 13's already-resolved confidence) " +
                         "with Node 16 (deterministic, frozen) using Dempster's rule of combination.",
                frame_of_discernment: ["R", "notR", "Theta"],
                combination_rule: "Classical normalized Dempster's rule of combination",
                finding_identity:
                    "Open taxonomy (unlike Aave's fixed F01-F11): whatever finding_ids Node 16 (Compound) " +
                    "actually output this run are fused, no fixed list, no fixed count.",
                node07_correlation_note:
                    "Node 07's confidence is read from Node 13 (Compound)'s source_findings.node07_architecture, " +
                    "which Node 13 already anchor-token-resolved to the correct spec_key. Node 17 does not " +
                    "independently re-match Node 07 to Node 16 by finding_id string comparison, since those " +
                    "strings are not guaranteed to coincide for Compound's open taxonomy.",
                negative_control_disclosure:
                    "UPGRADEABILITY_01's stated claim is the ABSENCE of the risk it names. R in the frame of " +
                    "discernment always means \"the stated claim is true,\" never re-mapped by polarity -- so " +
                    "this finding's high pignistic_R correctly means the risk is ruled out, not confirmed. " +
                    "finding_polarity and Node 16's status_interpretation are passed through on every finding, " +
                    "and this finding additionally carries an explicit polarity_warning next to its own dst " +
                    "numbers. See per-finding dst.primary.polarity_warning.",
                node_13_status: "Read-only, used solely to look up Node 07's already-resolved confidence per finding. Never modified.",
                node_16_status: "Read-only. Never modified, never treated as ground truth.",
                fusion_applicable_disclaimer:
                    "Some findings (audit-only, UNMAPPED-* entries, or the negative control's fallback path) " +
                    "have no Node 07 confidence and/or no Node 16 propositions. These are still included, not " +
                    "dropped, but marked fusion_applicable=false -- their reported mass is a pass-through of " +
                    "whichever single operand carried real evidence, not an actual fusion of two independent " +
                    "sources.",
                pignistic_disclaimer:
                    "pignistic_R (BetP) is a decision-oriented reporting transform, not evidence and not " +
                    "proof of calibration. Calibration must be evaluated empirically and only where " +
                    "independent ground truth exists.",
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
