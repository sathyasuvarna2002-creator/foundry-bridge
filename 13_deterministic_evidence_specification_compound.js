/***********************************************************************
 * NODE 13 -- COMPOUND VARIANT
 * DETERMINISTIC EVIDENCE SPECIFICATION (ANCHOR-TOKEN MATCHING)
 * VERSION 1.0
 *
 * PURPOSE
 * ---------------------------------------------------------------------
 * Compound counterpart to 13_deterministic_evidence_specification.js
 * (Aave, fixed-ID matching) and _venus.js (open-taxonomy, anchor-token
 * matching). Compound uses the Venus shape, not Aave's: two independent
 * live Node07 runs against the real corrected v6 prompt produced
 * different finding_id/risk_category placements for the same underlying
 * claims (confirmed this session), so fixed-ID matching would silently
 * break the way it originally did for Venus. Anchor-token overlap
 * against validation_target.mechanism_tokens/dependency_chain is used
 * instead, exactly as it is for Venus.
 *
 * IMPORTANT -- ONE FINDING IN THIS FILE WORKS BACKWARDS FROM THE OTHERS.
 * ---------------------------------------------------------------------
 * UPGRADEABILITY-01 is a NEGATIVE CONTROL, not an ordinary risk finding.
 * Confirmed three independent ways this session that the real deployed
 * cUSDC contract (0x39AA39c021dfbAe8faC545936693aC917d5E7563) has NO
 * CErc20Delegator/delegatecall-proxy mechanism at all:
 *   1. Its real Etherscan-verified ABI has zero _setImplementation /
 *      _becomeImplementation / _resignImplementation entries.
 *   2. A live `cast call ... "implementation()(address)"` reverts.
 *   3. CompoundValidator.sol's own source comment documents the same
 *      conclusion, independently, from before this session's audit.
 * A real, executed `forge test` (CompoundUpgradeableProxyControlTest.
 * test_ImplementationGetterDoesNotExist, PASS, 2026-08-19) formalises
 * this as a re-checkable claim. Because the claim itself is written as
 * an ABSENCE ("this mechanism does not exist here"), a PASS on its L3
 * predicate means the SAME thing PASS means everywhere else in this
 * file -- "the predicate's claim is supported by evidence" -- so no
 * inverted logic is needed in the evaluators. What IS different: this
 * finding's `finding_polarity` is explicitly "NEGATIVE_CONTROL", and
 * PASS here should be read by downstream nodes (16/17/18/ERA) as "risk
 * ruled out", never as "risk confirmed" the way it would for every
 * other finding_id. Anchor tokens are still kept broad on purpose
 * (_setImplementation, _becomeImplementation, delegator, implementation)
 * so that IF a future Node07/Node06 run ever claims a delegator pattern
 * exists for this target (hallucination, or a genuine future migration
 * to a different market), it resolves to this same spec key and gets
 * checked against the same real evidence -- which would then correctly
 * flag CONTRADICTED rather than silently going unmatched. This finding
 * is ALWAYS emitted in this file's output regardless of whether either
 * Node07 run this session actually produced it (neither did -- correctly,
 * since it doesn't apply) -- see buildNegativeControlFinding() below.
 *
 * SCOPE NOTE -- TWO REAL, PASSING TESTS EXIST WITH NO CANONICAL FINDING
 * ---------------------------------------------------------------------
 * CompoundGovernanceModelCheckTest and CompoundSeizeAuthorizationTest
 * both exist in the repo and both PASS against live mainnet (2026-08-19,
 * block 25788996) but do not correspond to any of the 5 audited entries
 * in Compound_Node07_Risk_Findings.json. The seize test's mechanism
 * (seize/seizeAllowed) matches a "Composability" finding that appeared
 * only in an EXAMPLE payload accidentally pasted into Node07's
 * structured-output-parser schema field (found and fixed this session,
 * see Compound_workflow_FIXED.json) -- never a properly audited
 * canonical finding. Rather than silently inventing a 6th/7th canonical
 * finding on my own inference, or silently dropping two real passing
 * tests, both are disclosed in evidence_boundaries.untested_canonical_
 * gap_note / real_tests_with_no_canonical_finding below and left for a
 * deliberate decision, not auto-added here.
 *
 * Node 13 (Compound), same as Aave/Venus, DOES NOT:
 *   - calculate confidence
 *   - calculate risk
 *   - fuse evidence
 *   - use LLM confidence as deterministic evidence
 *   - use historical evidence as deterministic proof
 *   - use temporal evidence as deterministic proof
 *   - treat keyword presence in free text as proof (only exact
 *     membership in mechanism_tokens/dependency_chain counts -- never
 *     a substring search across prose)
 *   - silently pick a match when a finding's tokens overlap more than
 *     one anchor set (flagged ANCHOR_TOKEN_AMBIGUOUS instead)
 *   - promote generic runtime success into proof of every finding
 *   - silently overwrite one source's finding data with the other's
 *     when Node 07 and Node 08 both describe the same underlying claim
 *   - treat an executed-but-inconclusive experiment as either a pass or
 *     a contradiction (see EXECUTED_PRECONDITION_UNMET below)
 *
 * REAL FOUNDRY EVIDENCE, THIS SESSION (2026-08-19, mainnet fork,
 * block 25788996, forge 1.7.1):
 *   CompoundUpgradeableProxyControlTest        PASS  (negative control)
 *   CompoundReserveFactorAccessControlTest     PASS
 *   CompoundDonationAttackTest                 PASS
 *   CompoundPauseGuardianDeprecationTest       PASS (3/3 sub-tests)
 *   CompoundInterestAccrualTest                EXECUTED, PRECONDITION
 *                                               UNMET -- see below
 *   CompoundGovernanceModelCheckTest           PASS  (no canonical
 *                                               finding -- see scope
 *                                               note above)
 *   CompoundSeizeAuthorizationTest              PASS  (no canonical
 *                                               finding -- see scope
 *                                               note above)
 *
 * CompoundInterestAccrualTest reverted with a deliberate, named
 * precondition-check message ("InterestRateModel returned a 0 borrow
 * rate at this block -- no interest would accrue regardless of blocks
 * passed, cannot test this claim meaningfully here"), not a claim
 * contradiction. Real trace: interestRateModel.getBorrowRate() returned
 * 0 at this exact block. This is architecturally consistent with, not
 * contradictory to, OPERATIONAL-RESILIENCE-01's own confirmed evidence
 * that this market is currently paused/deprecated (mintGuardianPaused
 * == true, reserveFactorMantissa == 100%) -- a deprecated market
 * plausibly has near-zero utilization driving its rate model's output
 * to zero. Recorded as EXECUTED_PRECONDITION_UNMET, a third L3 outcome
 * alongside PASS/FAIL/NOT_TESTED, so it is never silently folded into
 * either "confirmed" or "contradicted".
 ***********************************************************************/

// ======================================================================
// INPUTS
// ======================================================================
function safeNodeJson(nodeName) {
    try {
        const item = $(nodeName).first();
        return item ? item.json : null;
    } catch (e) {
        return null;
    }
}

const evidenceReview07 =
    safeNodeJson('07_AI_Risk_Reasoner') || {};

// '08_AI_AUDIT' is the CONFIRMED real live node name on Compound's
// canvas (verified directly against the uploaded Compound (6).json
// export this session -- same lesson as Aave's v2.7 NODE_08_CANDIDATES
// fix: a wrong guess here degrades silently to "Node 08 contributed
// nothing", so the confirmed real name is checked first).
const NODE_08_CANDIDATES = [
    '08_AI_AUDIT',
    '08_AI_Audit_Agent',
    '08_Audit_Incident_Ingestion_Agent',
    'AI Agent'
];
let evidenceReview08 = {};
for (const nodeName of NODE_08_CANDIDATES) {
    const data = safeNodeJson(nodeName);
    if (data) { evidenceReview08 = data; break; }
}

const foundry =
    safeNodeJson('10_Foundry_Validation') || {};
const historicalRaw =
    safeNodeJson('09_AI_Historical_Exploit_Reasoner');
const temporalRaw =
    safeNodeJson('12_Temporal_Evidence_Engine');
const temporal =
    temporalRaw?.temporal_evidence ||
    temporalRaw?.output?.temporal_evidence ||
    {};

// Live behavioural-test node(s), if wired. Tries each candidate name in
// order and merges whatever `behavioral_validation` objects it finds.
const FOUNDRY_BEHAVIORAL_NODE_CANDIDATES = [
    '11_Foundry_Behavioral_Validation',
    'Foundry_Behavioral_Validation',
    '10_Foundry_Validation'
];
const liveBehavioralValidation = {};
for (const nodeName of FOUNDRY_BEHAVIORAL_NODE_CANDIDATES) {
    const data = safeNodeJson(nodeName);
    if (data && data.behavioral_validation && typeof data.behavioral_validation === "object") {
        Object.assign(liveBehavioralValidation, data.behavioral_validation);
    }
}

// Manually-recorded snapshot of real `forge test` runs executed
// directly in a terminal by the user, 2026-08-19, live Ethereum
// mainnet fork (block 25788996, forge 1.7.1). Nothing here is
// fabricated or assumed -- every entry below is copied directly from
// real terminal output pasted this session.
const MANUAL_FOUNDRY_SNAPSHOT = {
    UPGRADEABILITY_01: {
        passed: true,
        status: "PASS",
        test: "CompoundUpgradeableProxyControlTest.test_ImplementationGetterDoesNotExist",
        recorded_at: "2026-08-19",
        block: 25788996,
        source: "Real forge test run, live Ethereum mainnet fork.",
        note: "NEGATIVE CONTROL -- PASS means the claimed absence is confirmed, i.e. the risk is ruled out, not confirmed. See header comment."
    },
    ACCESS_CONTROL_01: {
        passed: true,
        status: "PASS",
        test: "CompoundReserveFactorAccessControlTest.test_NonAdminCannotSetReserveFactor",
        recorded_at: "2026-08-19",
        block: 25788996,
        source: "Real forge test run, live Ethereum mainnet fork."
    },
    ASSET_CUSTODY_01: {
        passed: true,
        status: "PASS",
        test: "CompoundDonationAttackTest.test_DonationMovesExchangeRateWithoutMint",
        recorded_at: "2026-08-19",
        block: 25788996,
        source: "Real forge test run, live Ethereum mainnet fork.",
        observed: { rateBefore: "253233129687722", rateAfter: "254858707556316", delta: "1625577868594" }
    },
    OPERATIONAL_RESILIENCE_01: {
        passed: true,
        status: "PASS",
        test: "CompoundPauseGuardianDeprecationTest (test_MintGuardianPausedIsTrue + test_ReserveFactorAt100Percent + test_MintPermanentlyPausedForEveryone, 3/3)",
        recorded_at: "2026-08-19",
        block: 25788996,
        source: "Real forge test run, live Ethereum mainnet fork."
    },
    ECONOMIC_DEPENDENCY_01: {
        passed: false,
        status: "EXECUTED_PRECONDITION_UNMET",
        test: "CompoundInterestAccrualTest.test_InterestAccrualDrivenByRateModelAndBlocks",
        recorded_at: "2026-08-19",
        block: 25788996,
        source: "Real forge test run, live Ethereum mainnet fork.",
        note: "Reverted on a deliberate, named precondition check (InterestRateModel.getBorrowRate() returned 0 at this block), not a claim contradiction. Consistent with the market's confirmed paused/deprecated state (see OPERATIONAL_RESILIENCE_01)."
    }
};

// ======================================================================
// BASIC HELPERS
// ======================================================================
function text(value) {
    return value == null ? "" : String(value);
}
function bool(value) {
    return value === true;
}
function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}
function normalize(value) {
    return text(value)
        .toLowerCase()
        .replace(/[–—]/g, "-")
        .replace(/[""]/g, '"')
        .replace(/['']/g, "'")
        .replace(/\s+/g, " ")
        .trim();
}
function normalizeToken(value) {
    return text(value)
        .toLowerCase()
        .replace(/[()]/g, "")
        .trim();
}
const SEVERITY_RANK = { "Critical": 5, "High": 4, "Medium": 3, "Low": 2, "Informational": 1, "Unknown": 0 };
function higherSeverity(a, b) {
    const ra = SEVERITY_RANK[text(a)] ?? 0;
    const rb = SEVERITY_RANK[text(b)] ?? 0;
    return rb > ra ? b : a;
}

// ======================================================================
// COMPOUND FINDING SPECIFICATION
// Anchor tokens drawn from Compound_Node07_Risk_Findings.json's
// validation_target.mechanism_tokens, cross-checked against the real
// Etherscan-verified source/ABI for 0x39AA39c021dfbAe8faC545936693aC917
// d5E7563 during this session's audit (see that file's per-finding
// "evidence" fields for the exact confirmation for each).
// ======================================================================
const COMPOUND_SPEC = {
    UPGRADEABILITY_01: {
        finding_name: "Delegatecall-Proxy Implementation Control (NOT PRESENT on this deployment -- negative control)",
        risk_category: "Upgradeability",
        finding_polarity: "NEGATIVE_CONTROL",
        anchor_tokens: ["_setimplementation", "_becomeimplementation", "_resignimplementation", "implementation", "cerc20delegator", "delegator"],
        behavioral_key: "UPGRADEABILITY_01",
        predicates: [
            {
                predicate_id: "UPGRADEABILITY-01-P01",
                level: "L3",
                layer: "BEHAVIOURAL",
                claim: "The deployed cUSDC contract has no delegatecall-proxy / implementation-swap mechanism -- calling implementation() reverts.",
                evidence_requirement: "EXPERIMENT",
                requires_execution: true,
                experiment: "Call implementation()(address) on the live contract via a forked test and confirm it reverts (function does not exist)."
            }
        ]
    },
    ACCESS_CONTROL_01: {
        finding_name: "Single-Admin Economic Parameter Control (_setReserveFactor)",
        risk_category: "Access Control",
        finding_polarity: "STANDARD",
        anchor_tokens: ["_setreservefactor", "reservefactormantissa", "admin"],
        behavioral_key: "ACCESS_CONTROL_01",
        predicates: [
            {
                predicate_id: "ACCESS-CONTROL-01-P01",
                level: "L1",
                layer: "STRUCTURAL",
                claim: "The market reports a reserve factor.",
                evidence_requirement: "RUNTIME_EXISTENCE",
                runtime_requirements: [{ property: "reserve_factor_available", expected: true }]
            },
            {
                predicate_id: "ACCESS-CONTROL-01-P02",
                level: "L2",
                layer: "STRUCTURAL_RELATIONSHIP",
                claim: "_setReserveFactor is gated by a single admin check that returns an error code (does not revert) for an unauthorized caller.",
                evidence_requirement: "SOURCE_RELATIONSHIP"
            },
            {
                predicate_id: "ACCESS-CONTROL-01-P03",
                level: "L3",
                layer: "BEHAVIOURAL",
                claim: "An unauthorized caller invoking _setReserveFactor receives Error.UNAUTHORIZED (1) and reserveFactorMantissa is unchanged.",
                evidence_requirement: "EXPERIMENT",
                requires_execution: true,
                experiment: "Call _setReserveFactor from a random unprivileged address on a fork; assert return value == 1 and reserveFactorMantissa unchanged. NOT vm.expectRevert() -- this call completes normally."
            }
        ]
    },
    ASSET_CUSTODY_01: {
        finding_name: "Exchange Rate Manipulation via Unmediated Token Transfer",
        risk_category: "Asset Custody",
        finding_polarity: "STANDARD",
        // "getcashprior" deliberately excluded from this anchor set even
        // though it's the mechanism's own entry-point function -- tested
        // against real live Node07 output and confirmed it also appears
        // in a genuinely DIFFERENT finding (Trust Boundary /
        // non-standard-ERC20-semantics), which shares getCashPrior only
        // incidentally (both findings' evidence happens to mention it,
        // but the underlying claims differ). Anchoring on it caused a
        // real false-positive merge (TRUST-BOUNDARY-01's claim_id
        // COMPOUND-DOTRANSFERIN-GETCASHPRIOR-UNDERLYING resolving into
        // this spec key) in this file's own test harness before this
        // token was removed. exchangeRateStoredInternal/exchangeRateStored/
        // balanceOf remain unique to the audited donation-attack claim.
        anchor_tokens: ["exchangeratestoredinternal", "balanceof", "exchangeratestored"],
        behavioral_key: "ASSET_CUSTODY_01",
        predicates: [
            {
                predicate_id: "ASSET-CUSTODY-01-P01",
                level: "L1",
                layer: "STRUCTURAL",
                claim: "The market reports an available cash balance and exchange rate.",
                evidence_requirement: "RUNTIME_EXISTENCE",
                runtime_requirements: [
                    { property: "cash_available", expected: true },
                    { property: "exchange_rate_available", expected: true }
                ]
            },
            {
                predicate_id: "ASSET-CUSTODY-01-P02",
                level: "L2",
                layer: "STRUCTURAL_RELATIONSHIP",
                claim: "getCashPrior() reads the underlying token's raw balanceOf(this), with no independent accounting variable.",
                evidence_requirement: "SOURCE_RELATIONSHIP"
            },
            {
                predicate_id: "ASSET-CUSTODY-01-P03",
                level: "L3",
                layer: "BEHAVIOURAL",
                claim: "A direct ERC-20 transfer of the underlying into the market, with no mint() call, moves exchangeRateStored.",
                evidence_requirement: "EXPERIMENT",
                requires_execution: true,
                experiment: "Fund a test address with real USDC (deal()), transfer directly to cUSDC with no mint() call, confirm exchangeRateStored() increases."
            }
        ]
    },
    OPERATIONAL_RESILIENCE_01: {
        finding_name: "Unilateral Protocol-Wide Pause Authority",
        risk_category: "Operational Resilience",
        finding_polarity: "STANDARD",
        anchor_tokens: ["mintguardianpaused", "borrowguardianpaused"],
        behavioral_key: "OPERATIONAL_RESILIENCE_01",
        predicates: [
            {
                predicate_id: "OPERATIONAL-RESILIENCE-01-P01",
                level: "L2",
                layer: "STRUCTURAL_RELATIONSHIP",
                claim: "mint() and borrow() both check a Comptroller-level pause flag (mintGuardianPaused / borrowGuardianPaused) before proceeding.",
                evidence_requirement: "SOURCE_RELATIONSHIP"
            },
            {
                predicate_id: "OPERATIONAL-RESILIENCE-01-P02",
                level: "L3",
                layer: "BEHAVIOURAL",
                claim: "mintGuardianPaused(cUSDC) is currently true, reserveFactorMantissa is 100%, and an arbitrary caller's mint() reverts with 'mint is paused'.",
                evidence_requirement: "EXPERIMENT",
                requires_execution: true,
                experiment: "Read mintGuardianPaused(cUSDC) and reserveFactorMantissa() live; call mint() from an arbitrary address and confirm it reverts with 'mint is paused'."
            }
        ]
    },
    ECONOMIC_DEPENDENCY_01: {
        finding_name: "Interest Accrual Dependency on External Rate Model",
        risk_category: "Economic Dependency",
        finding_polarity: "STANDARD",
        anchor_tokens: ["accrueinterest", "interestratemodel", "getborrowrate"],
        behavioral_key: "ECONOMIC_DEPENDENCY_01",
        predicates: [
            {
                predicate_id: "ECONOMIC-DEPENDENCY-01-P01",
                level: "L1",
                layer: "STRUCTURAL",
                claim: "An external InterestRateModel is deployed and referenced by the market.",
                evidence_requirement: "RUNTIME_EXISTENCE",
                runtime_requirements: [{ property: "interest_rate_model_exists", expected: true }]
            },
            {
                predicate_id: "ECONOMIC-DEPENDENCY-01-P02",
                level: "L2",
                layer: "STRUCTURAL_RELATIONSHIP",
                claim: "accrueInterest() computes its rate from the external InterestRateModel's getBorrowRate() output.",
                evidence_requirement: "SOURCE_RELATIONSHIP"
            },
            {
                predicate_id: "ECONOMIC-DEPENDENCY-01-P03",
                level: "L3",
                layer: "BEHAVIOURAL",
                claim: "Given a non-zero real borrow rate, advancing blocks and calling accrueInterest() increases totalBorrows and borrowIndex.",
                evidence_requirement: "EXPERIMENT",
                requires_execution: true,
                experiment: "Roll a fork forward and call accrueInterest(), comparing totalBorrows/borrowIndex before and after -- requires a non-zero live borrow rate as a precondition."
            }
        ]
    }
};

// ======================================================================
// SOURCE EVIDENCE MAP
// Terms confirmed directly against the real Etherscan-verified deployed
// source for 0x39AA39c021dfbAe8faC545936693aC917d5E7563 this session
// (pragma ^0.5.8 -- note NO "virtual"/"override"/custom-error syntax
// anywhere in the real source; matching terms below reflect that, not
// the newer compound-protocol GitHub HEAD).
// ======================================================================
const SOURCE_EVIDENCE_MAP = {
    "ACCESS-CONTROL-01-P02": ["_setReserveFactorFresh", "msg.sender != admin", "Error.UNAUTHORIZED", "SET_RESERVE_FACTOR_ADMIN_CHECK", "fail("],
    "ASSET-CUSTODY-01-P02": ["getCashPrior", "EIP20Interface(underlying).balanceOf(address(this))", "exchangeRateStoredInternal"],
    "OPERATIONAL-RESILIENCE-01-P01": ["mintGuardianPaused", "borrowGuardianPaused", "mint is paused", "borrow is paused"],
    "ECONOMIC-DEPENDENCY-01-P02": ["interestRateModel.getBorrowRate", "getCashPrior(), totalBorrows, totalReserves", "accrueInterest"]
};

// ======================================================================
// FINDING EXTRACTION (source-agnostic -- works on Node 07 or Node 08
// output; Node 08's schema is an additive superset of Node 07's, same
// as Aave/Venus)
// ======================================================================
function extractFindings(root) {
    if (Array.isArray(root)) return root;
    if (!root || typeof root !== "object") return [];
    const directArrays = [root.architectural_risks, root.architectural_findings, root.findings, root.risks, root.results];
    for (const candidate of directArrays) {
        if (Array.isArray(candidate)) return candidate;
    }
    const wrappers = [root.output, root.result, root.analysis, root.assessment, root.response];
    for (const wrapper of wrappers) {
        if (wrapper && typeof wrapper === "object") {
            const result = extractFindings(wrapper);
            if (result.length > 0) return result;
        }
        if (Array.isArray(wrapper)) return wrapper;
    }
    return [];
}

function extractFindingName(finding) {
    if (!finding || typeof finding !== "object") return "";
    const directFields = [finding.finding_name, finding.findingName, finding.risk_name, finding.riskName, finding.architectural_risk, finding.title, finding.name];
    for (const value of directFields) {
        if (typeof value === "string" && value.trim().length > 0) return value.trim();
    }
    return "";
}
function extractTokenArray(finding, fields) {
    for (const field of fields) {
        const value = finding?.[field] ?? finding?.validation_target?.[field];
        if (Array.isArray(value)) return value.filter(v => typeof v === "string").map(normalizeToken);
    }
    return [];
}
function extractMechanismTokens(finding) {
    return extractTokenArray(finding, ["mechanism_tokens", "mechanismTokens"]);
}
function extractDependencyChain(finding) {
    return extractTokenArray(finding, ["dependency_chain", "dependencyChain"]);
}
function extractClaimId(finding) {
    return text(finding?.claim_id || finding?.claimId || finding?.validation_target?.claim_id || "");
}
function getArchitecturalEvidence(finding) {
    if (!finding || typeof finding !== "object") return [];
    const candidates = [finding.finding_level_architectural_evidence, finding.architectural_evidence, finding.supporting_evidence, finding.evidence];
    for (const candidate of candidates) {
        if (Array.isArray(candidate)) return candidate.filter(Boolean).map(text);
    }
    return [];
}

// ======================================================================
// ANCHOR-TOKEN MATCHING
// ======================================================================
function resolveFindingByAnchorTokens(finding) {
    const mechanismTokens = extractMechanismTokens(finding);
    const dependencyChain = extractDependencyChain(finding);
    const combinedTokens = [...new Set([...mechanismTokens, ...dependencyChain])];
    const sourceName = extractFindingName(finding);
    const claimId = extractClaimId(finding);

    if (combinedTokens.length === 0) {
        return { spec_key: null, source_name: sourceName, resolution: "NO_TOKENS_SUPPLIED", matched_tokens: [], claim_id: claimId };
    }
    const matches = [];
    for (const [specKey, spec] of Object.entries(COMPOUND_SPEC)) {
        const anchorTokensNormalized = spec.anchor_tokens.map(normalizeToken);
        const matchedTokens = combinedTokens.filter(t => anchorTokensNormalized.includes(t));
        if (matchedTokens.length > 0) matches.push({ specKey, matchedTokens });
    }
    if (matches.length === 0) {
        return { spec_key: null, source_name: sourceName, resolution: "UNRESOLVED", matched_tokens: [], claim_id: claimId };
    }
    if (matches.length > 1) {
        return { spec_key: null, source_name: sourceName, resolution: "ANCHOR_TOKEN_AMBIGUOUS", candidates: matches, claim_id: claimId };
    }
    return { spec_key: matches[0].specKey, source_name: sourceName, resolution: "ANCHOR_TOKEN_MATCH", matched_tokens: matches[0].matchedTokens, claim_id: claimId };
}

// ======================================================================
// UNION + NORMALIZATION / DE-DUPLICATION LAYER
// Same shape as Venus v1.1 -- resolves every finding from both sources
// to a spec_key first, groups by spec_key, then decides single-source
// pass-through vs multi-source merge (never overwrite).
// ======================================================================
const findings07 = extractFindings(evidenceReview07);
const findings08 = extractFindings(evidenceReview08);

function tagAndResolve(finding, sourceLabel) {
    return { finding, sourceLabel, resolution: resolveFindingByAnchorTokens(finding) };
}

const tagged07 = findings07.map(f => tagAndResolve(f, "NODE_07_ARCHITECTURE"));
const tagged08 = findings08.map(f => tagAndResolve(f, "NODE_08_AUDIT"));
const allTagged = [...tagged07, ...tagged08];

const groupsBySpecKey = {};
const unmappedItems = [];
for (const item of allTagged) {
    if (item.resolution.spec_key) {
        (groupsBySpecKey[item.resolution.spec_key] ||= []).push(item);
    } else {
        unmappedItems.push(item);
    }
}

function sourceEntry(item) {
    const f = item.finding;
    return {
        source_finding_name: item.resolution.source_name,
        claim_id: item.resolution.claim_id || null,
        severity: text(f?.severity || f?.risk_severity || "Unknown"),
        confidence: typeof f?.confidence === "number" ? f.confidence : null,
        matched_anchor_tokens: item.resolution.matched_tokens,
        architectural_evidence: getArchitecturalEvidence(f),
        provenance: f?.provenance ?? undefined
    };
}

function buildResolvedFinding(specKey, group) {
    const spec = COMPOUND_SPEC[specKey];
    const bySource = { NODE_07_ARCHITECTURE: null, NODE_08_AUDIT: null };
    for (const item of group) {
        if (!bySource[item.sourceLabel]) {
            bySource[item.sourceLabel] = sourceEntry(item);
        }
    }
    const sources = group.map(g => g.sourceLabel).filter((v, i, arr) => arr.indexOf(v) === i);
    const isMerged = sources.length > 1;

    const claimIdsBySource = {
        node07_architecture: bySource.NODE_07_ARCHITECTURE?.claim_id ?? null,
        node08_audit: bySource.NODE_08_AUDIT?.claim_id ?? null
    };
    const claimIdsAgree =
        claimIdsBySource.node07_architecture != null &&
        claimIdsBySource.node08_audit != null &&
        claimIdsBySource.node07_architecture === claimIdsBySource.node08_audit;

    const severity = isMerged
        ? higherSeverity(bySource.NODE_07_ARCHITECTURE?.severity, bySource.NODE_08_AUDIT?.severity)
        : (bySource.NODE_07_ARCHITECTURE || bySource.NODE_08_AUDIT).severity;

    const architecturalEvidenceUnion = [
        ...(bySource.NODE_07_ARCHITECTURE?.architectural_evidence || []),
        ...(bySource.NODE_08_AUDIT?.architectural_evidence || [])
    ];

    const predicates = spec.predicates.map(predicate => {
        let evaluation;
        switch (predicate.evidence_requirement) {
            case "RUNTIME_EXISTENCE":
                evaluation = evaluateRuntimePredicate(predicate);
                break;
            case "SOURCE_RELATIONSHIP":
                evaluation = evaluateSourcePredicate(predicate, architecturalEvidenceUnion);
                break;
            case "EXPERIMENT":
                evaluation = buildBehaviouralPredicate(predicate, spec.behavioral_key);
                break;
            default:
                evaluation = { result: "UNVERIFIABLE", reason: "Unsupported evidence requirement." };
        }
        return {
            ...predicate,
            architectural_evidence: architecturalEvidenceUnion,
            architectural_evidence_mapping: SOURCE_EVIDENCE_MAP[predicate.predicate_id] ? "EXPLICIT_PREDICATE_MAPPING" : "NO_EXPLICIT_PREDICATE_MAPPING",
            validation_result: evaluation.result,
            validation_evidence: evaluation
        };
    });

    return {
        finding_id: specKey,
        finding_name: spec.finding_name,
        finding_polarity: spec.finding_polarity,
        finding_resolution: isMerged ? "MERGED_ANCHOR_TOKEN_MATCH" : "ANCHOR_TOKEN_MATCH",
        sources,
        source_findings: {
            node07_architecture: bySource.NODE_07_ARCHITECTURE,
            node08_audit: bySource.NODE_08_AUDIT
        },
        claim_ids_by_source: claimIdsBySource,
        claim_ids_agree: claimIdsAgree,
        anchor_tokens_matched: [...new Set(group.flatMap(g => g.resolution.matched_tokens))],
        severity,
        risk_category: spec.risk_category,
        finding_level_architectural_evidence: architecturalEvidenceUnion,
        predicates,
        deterministic_ready: true,
        validation_status: "READY_FOR_FUSION"
    };
}

function buildUnmappedFinding(item, index) {
    const resolution = item.resolution;
    return {
        finding_id: `UNMAPPED-${item.sourceLabel === "NODE_08_AUDIT" ? "AUDIT-" : ""}${index + 1}`,
        source: item.sourceLabel,
        source_finding_name: resolution.source_name,
        claim_id: resolution.claim_id || null,
        severity: text(item.finding?.severity || item.finding?.risk_severity || "Unknown"),
        deterministic_ready: false,
        validation_status: "NO_SPECIFICATION",
        predicates: [],
        reason:
            resolution.resolution === "ANCHOR_TOKEN_AMBIGUOUS"
                ? `This finding's mechanism_tokens/dependency_chain overlap more than one Compound anchor set (${resolution.candidates.map(c => c.specKey).join(", ")}). Refusing to guess which is correct -- flagged for manual review instead of silently picking one.`
                : resolution.resolution === "NO_TOKENS_SUPPLIED"
                    ? "Finding has no mechanism_tokens or dependency_chain to match against -- cannot anchor-token match without them."
                    : "No Compound anchor-token set overlaps this finding's mechanism_tokens/dependency_chain -- this may be one of the 2 real-but-uncanonicalised findings (Centralisation / Composability), see header SCOPE NOTE.",
        resolution_debug: {
            resolution_type: resolution.resolution,
            candidates: resolution.candidates || null,
            available_spec_keys: Object.keys(COMPOUND_SPEC)
        }
    };
}

// ======================================================================
// NEGATIVE CONTROL -- ALWAYS EMITTED, INDEPENDENT OF NODE07/08 OUTPUT
// UPGRADEABILITY-01 is real, executed, disclosable evidence about this
// deployment regardless of whether any agent claims a delegator pattern
// exists this run. If Node07/08 DID happen to anchor-token-match into
// UPGRADEABILITY_01 this run (i.e. a future run hallucinates a
// delegator claim), that resolved finding is used instead of this
// fallback -- see the merge check below -- so the same real evidence
// still applies, now checked against an explicit claim rather than
// injected standalone.
// ======================================================================
function buildNegativeControlFinding() {
    const spec = COMPOUND_SPEC.UPGRADEABILITY_01;
    const predicates = spec.predicates.map(predicate => {
        const evaluation = buildBehaviouralPredicate(predicate, spec.behavioral_key);
        return {
            ...predicate,
            architectural_evidence: [],
            architectural_evidence_mapping: "NO_EXPLICIT_PREDICATE_MAPPING",
            validation_result: evaluation.result,
            validation_evidence: evaluation
        };
    });
    return {
        finding_id: "UPGRADEABILITY_01",
        finding_name: spec.finding_name,
        finding_polarity: spec.finding_polarity,
        finding_resolution: "NEGATIVE_CONTROL_ALWAYS_EMITTED",
        sources: [],
        source_findings: { node07_architecture: null, node08_audit: null },
        claim_ids_by_source: { node07_architecture: null, node08_audit: null },
        claim_ids_agree: false,
        anchor_tokens_matched: [],
        severity: "Informational",
        risk_category: spec.risk_category,
        finding_level_architectural_evidence: [],
        predicates,
        deterministic_ready: true,
        validation_status: "READY_FOR_FUSION",
        note: "Emitted independent of Node07/08 this run -- see header comment. Read PASS here as 'risk ruled out', not 'risk confirmed'."
    };
}

// ======================================================================
// OBJECTIVE FOUNDRY RUNTIME
// Field names match CompoundValidator.sol / ValidationResult.sol exactly
// (confirmed against real Solidity source this session).
// ======================================================================
const runtime = {
    validation_executed: bool(foundry.runtimeValidationExecuted),
    validation_passed: bool(foundry.runtimeValidationPassed),
    checks_performed: num(foundry.runtimeChecksPerformed),
    checks_passed: num(foundry.runtimeChecksPassed),
    contract_exists: bool(foundry.contractExists),
    comptroller_exists: bool(foundry.comptrollerExists),
    comptroller: text(foundry.comptroller),
    underlying_asset_exists: bool(foundry.underlyingAssetExists),
    underlying_asset: text(foundry.underlyingAsset),
    interest_rate_model_exists: bool(foundry.interestRateModelExists),
    interest_rate_model: text(foundry.interestRateModel),
    exchange_rate_available: bool(foundry.exchangeRateAvailable),
    exchange_rate: text(foundry.exchangeRate),
    cash_available: bool(foundry.cashAvailable),
    cash: text(foundry.cash),
    borrow_index_available: bool(foundry.borrowIndexAvailable),
    total_borrows_available: bool(foundry.totalBorrowsAvailable),
    total_reserves_available: bool(foundry.totalReservesAvailable),
    reserve_factor_available: bool(foundry.reserveFactorAvailable),
    reserve_registry_exists: bool(foundry.reserveRegistryExists),
    reserve_count: num(foundry.reserveCount),
    listed_markets: num(foundry.listedMarkets)
};

// ======================================================================
// PREDICATE EVALUATORS
// ======================================================================
function evaluateRuntimePredicate(predicate) {
    const requirements = Array.isArray(predicate.runtime_requirements) ? predicate.runtime_requirements : [];
    if (requirements.length === 0) return { result: "UNVERIFIABLE", reason: "No runtime requirements defined." };
    const observations = [];
    let allPassed = true;
    for (const requirement of requirements) {
        const observed = runtime[requirement.property];
        const expected = requirement.expected;
        const passed = observed === expected;
        if (!passed) allPassed = false;
        observations.push({ property: requirement.property, expected, observed, passed });
    }
    return { result: allPassed ? "PASS" : "FAIL", evidence_source: "Foundry runtime evidence (10_Foundry_Validation)", evidence: { observations } };
}

function evaluateSourcePredicate(predicate, architecturalEvidence) {
    const mappings = SOURCE_EVIDENCE_MAP[predicate.predicate_id];
    if (!Array.isArray(mappings) || mappings.length === 0) {
        return { result: "UNVERIFIABLE", evidence_source: "No explicit predicate mapping", evidence: null, limitation: "No controlled architectural-evidence mapping exists." };
    }
    const matchedEvidence = [];
    for (const evidenceItem of architecturalEvidence) {
        const source = normalize(evidenceItem);
        const matchedTerms = mappings.filter(term => source.includes(normalize(term)));
        if (matchedTerms.length > 0) matchedEvidence.push({ evidence: evidenceItem, matched_mapping_terms: matchedTerms });
    }
    if (matchedEvidence.length === 0) {
        return { result: "UNVERIFIABLE", evidence_source: "Controlled predicate mapping", evidence: { mapped_candidates: mappings, matched_evidence: [] }, limitation: "The predicate has an explicit mapping, but no matching upstream architectural evidence was supplied." };
    }
    return { result: "MAPPED_PENDING_INDEPENDENT_VERIFICATION", evidence_source: "Predicate-scoped architectural evidence", evidence: { mapped_candidates: mappings, matched_evidence: matchedEvidence }, limitation: "The architectural evidence is mapped to the predicate but is not independently treated as deterministic proof." };
}

// Three possible executed outcomes now, not two: PASS, FAIL, and
// EXECUTED_PRECONDITION_UNMET (ran for real, but the live market state
// didn't meet the precondition needed to observe the claim -- neither a
// pass nor a contradiction). NOT_TESTED remains reserved for "never
// actually run".
function buildBehaviouralPredicate(predicate, behavioralKey) {
    const live = behavioralKey ? liveBehavioralValidation[behavioralKey] : null;
    const manual = behavioralKey ? MANUAL_FOUNDRY_SNAPSHOT[behavioralKey] : null;
    const evidenceRecord = live || manual || null;
    if (!evidenceRecord) {
        return { result: "NOT_TESTED", evidence_source: "No executed Foundry experiment supplied", experiment_required: predicate.experiment, requires_execution: true, reason: "A proposed experiment is not treated as execution evidence." };
    }
    const reportedStatus = evidenceRecord.status || (evidenceRecord.passed ? "PASS" : "FAIL");
    if (reportedStatus === "EXECUTED_PRECONDITION_UNMET") {
        return {
            result: "EXECUTED_PRECONDITION_UNMET",
            evidence_source: live ? "Live Foundry behavioral endpoint" : `Manual forge test snapshot (${evidenceRecord.recorded_at || "date unrecorded"}, block ${evidenceRecord.block ?? "unrecorded"})`,
            executed_test: evidenceRecord.test || null,
            reported_status: reportedStatus,
            requires_execution: false,
            note: evidenceRecord.note || null,
            reason: "The experiment executed for real against live state, but a real-world precondition (not an instrumentation failure) was not met at this block -- treat as neither confirmed nor contradicted. Re-run at a block where the precondition holds before concluding either way."
        };
    }
    const passed = evidenceRecord.passed === true;
    return {
        result: passed ? "PASS" : "FAIL",
        evidence_source: live ? "Live Foundry behavioral endpoint" : `Manual forge test snapshot (${evidenceRecord.recorded_at || "date unrecorded"}, block ${evidenceRecord.block ?? "unrecorded"})`,
        executed_test: evidenceRecord.test || null,
        reported_status: reportedStatus,
        requires_execution: false,
        note: evidenceRecord.note || null,
        reason: passed
            ? "A real Foundry behavioural experiment was executed and passed."
            : "A real Foundry behavioural experiment was executed and did not pass -- review before treating this as CONTRADICTED (check for fork/instrumentation issues per the test's own control-test framing, if one exists)."
    };
}

// ======================================================================
// BUILD FINDINGS (resolved + negative control + unmapped)
// If a live run's Node07/08 output happens to anchor-token-resolve its
// own finding into UPGRADEABILITY_01 (hallucinated delegator claim),
// that resolved entry is used in place of the standalone negative
// control -- never both, to avoid a duplicate finding_id in the output.
// ======================================================================
const resolvedFindings = Object.entries(groupsBySpecKey).map(([specKey, group]) => buildResolvedFinding(specKey, group));
const hasLiveUpgradeabilityFinding = Object.prototype.hasOwnProperty.call(groupsBySpecKey, "UPGRADEABILITY_01");
const unmappedFindings = unmappedItems.map((item, index) => buildUnmappedFinding(item, index));

const outputFindings = hasLiveUpgradeabilityFinding
    ? [...resolvedFindings, ...unmappedFindings]
    : [...resolvedFindings, buildNegativeControlFinding(), ...unmappedFindings];

const matchedSpecKeys = new Set(resolvedFindings.map(f => f.finding_id).concat(hasLiveUpgradeabilityFinding ? [] : ["UPGRADEABILITY_01"]));
const specKeysWithNoFindingThisRun = Object.keys(COMPOUND_SPEC).filter(k => !matchedSpecKeys.has(k));

// ======================================================================
// SUMMARY
// ======================================================================
const allPredicates = outputFindings.flatMap(f => f.predicates || []);
const summary = {
    total_findings: outputFindings.length,
    unmapped_findings: unmappedFindings.length,
    findings_node07_only: resolvedFindings.filter(f => f.sources.length === 1 && f.sources[0] === "NODE_07_ARCHITECTURE").length,
    findings_node08_audit_only: resolvedFindings.filter(f => f.sources.length === 1 && f.sources[0] === "NODE_08_AUDIT").length,
    findings_merged_across_sources: resolvedFindings.filter(f => f.sources.length > 1).length,
    negative_control_findings: outputFindings.filter(f => f.finding_polarity === "NEGATIVE_CONTROL").length,
    total_predicates: allPredicates.length,
    l1_existence_predicates: allPredicates.filter(p => p.level === "L1").length,
    l2_relationship_predicates: allPredicates.filter(p => p.level === "L2").length,
    l3_behavioural_predicates: allPredicates.filter(p => p.level === "L3").length,
    behavioural_predicates_passed: allPredicates.filter(p => p.level === "L3" && p.validation_result === "PASS").length,
    behavioural_predicates_failed: allPredicates.filter(p => p.level === "L3" && p.validation_result === "FAIL").length,
    behavioural_predicates_executed_precondition_unmet: allPredicates.filter(p => p.level === "L3" && p.validation_result === "EXECUTED_PRECONDITION_UNMET").length,
    behavioural_predicates_not_tested: allPredicates.filter(p => p.level === "L3" && p.validation_result === "NOT_TESTED").length,
    compound_spec_categories_with_no_matching_finding_this_run: specKeysWithNoFindingThisRun
};

// ======================================================================
// EVIDENCE BOUNDARIES
// ======================================================================
const evidenceBoundaries = {
    llm_confidence_is_deterministic_evidence: false,
    historical_evidence_is_deterministic_evidence: false,
    temporal_evidence_is_deterministic_evidence: false,
    generic_runtime_success_proves_all_findings: false,
    keyword_presence_in_free_text_proves_relationship: false,
    exact_mechanism_token_membership_used_for_matching: true,
    ambiguous_anchor_token_overlap_flagged_not_guessed: true,
    finding_level_evidence_proves_predicate: false,
    predicate_level_mapping_required: true,
    arbitrary_weights_used: false,
    deterministic_confidence_calculated: false,
    proposed_experiment_treated_as_execution: false,
    behavioural_pass_requires_executed_experiment: true,
    executed_but_inconclusive_result_never_folded_into_pass_or_fail: true,
    negative_control_pass_means_risk_ruled_out_not_confirmed: true,
    behavioral_evidence_partially_manual: Object.keys(MANUAL_FOUNDRY_SNAPSHOT).length > 0,
    behavioral_evidence_manual_disclosure:
        "5 of 5 in-scope findings' behavioral evidence comes from a manually-recorded forge test snapshot (2026-08-19, live Ethereum mainnet fork, block 25788996), not a live n8n-callable endpoint -- see MANUAL_FOUNDRY_SNAPSHOT.",
    node07_node08_findings_unioned_before_predicate_building: true,
    union_deduplicated_by_anchor_token_spec_key_not_naive_concatenation: true,
    merge_never_overwrites_source_finding_data: true,
    merge_preserves_per_source_claim_id_and_evidence_separately: true,
    node08_provenance_preserved_and_never_merged_into_node07_side: true,
    node_16_modified_for_this_change: false,
    untested_canonical_gap_note:
        "UPGRADEABILITY_01 is a confirmed-absent negative control, not an untested gap -- see finding_polarity.",
    real_tests_with_no_canonical_finding:
        "CompoundGovernanceModelCheckTest and CompoundSeizeAuthorizationTest both PASS on live mainnet (2026-08-19, block 25788996) but map to no entry in Compound_Node07_Risk_Findings.json (a Centralisation and a Composability finding respectively, seen only in an accidentally-pasted example payload, never independently audited as canonical). Deliberately not auto-added as spec entries here -- flagged for a real decision, not invented."
};

// ======================================================================
// TEMPORAL / HISTORICAL CONTEXT (preserved, not used as proof)
// ======================================================================
// FIX (v1.1): the fields below previously read flat top-level properties
// (temporal.analysis_window_days, temporal.first_transaction, etc.) that
// don't exist on the real 12_Temporal_Evidence_Engine output -- that node
// nests window/transaction stats under `metrics`, and a couple of the
// guessed field names (first_transaction, latest_transaction,
// successful_transactions, failed_transactions) never existed in its
// schema at all. Confirmed on a real run: every field here came back null
// except temporal_evidence_strength (the one genuinely top-level field).
// Corrected to the real field paths. This context is still never used as
// deterministic proof either way -- only the values it can actually show
// changed, not what it's used for.
const temporalMetrics = (temporal && temporal.metrics) || {};
const temporalDrift = (temporal && temporal.drift) || {};
const temporalContext = {
    analysis_window_start: temporalMetrics.analysis_window_start ?? null,
    analysis_window_end: temporalMetrics.analysis_window_end ?? null,
    analysis_window_days: temporalMetrics.analysis_window_days ?? null,
    transactions_analyzed: temporalMetrics.transactions_analyzed ?? null,
    last_activity: temporalMetrics.last_activity ?? null,
    days_since_last_activity: temporalMetrics.days_since_last_activity ?? null,
    historical_transactions: temporalDrift.historical_transactions ?? null,
    recent_transactions: temporalDrift.recent_transactions ?? null,
    temporal_confidence: temporal.temporal_confidence ?? null,
    temporal_evidence_strength: temporal.temporal_evidence_strength ?? null
};
const historicalContext = {
    available: Boolean(historicalRaw),
    output: historicalRaw?.output ?? historicalRaw ?? null
};

// ======================================================================
// FINAL OUTPUT
// ======================================================================
return [
    {
        json: {
            deterministic_evidence: {
                metadata: {
                    protocol: text(foundry.protocolName || evidenceReview07?.protocol || "Compound"),
                    methodology:
                        "Finding-specific deterministic verification using objective runtime observations, anchor-token overlap matching against Node 07's and Node 08's mechanism_tokens/dependency_chain (unioned and de-duplicated by resolved spec key before predicate building, never naively concatenated), and real executed Foundry behavioural results where available. One finding (UPGRADEABILITY_01) is a negative control, always emitted, where PASS means the risk is ruled out rather than confirmed.",
                    specification_version: "1.0",
                    generated_at: new Date().toISOString()
                },
                objective_runtime_evidence: {
                    validation_executed: runtime.validation_executed,
                    validation_passed: runtime.validation_passed,
                    checks_performed: runtime.checks_performed,
                    checks_passed: runtime.checks_passed,
                    chain_id: foundry.chainId ?? null,
                    protocol: foundry.protocolName ?? null,
                    observations: runtime
                },
                findings: outputFindings,
                summary,
                evidence_boundaries: evidenceBoundaries,
                temporal_context_preserved: temporalContext,
                historical_context_preserved: historicalContext
            }
        }
    }
];
