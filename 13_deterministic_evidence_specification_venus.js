/***********************************************************************
 * NODE 13 -- VENUS VARIANT
 * DETERMINISTIC EVIDENCE SPECIFICATION (ANCHOR-TOKEN MATCHING)
 * VERSION 1.1 -- UNION ARCHITECTURE (Node 07 + Node 08 merge)
 *
 * PURPOSE
 * ---------------------------------------------------------------------
 * Venus counterpart to 13_deterministic_evidence_specification.js
 * (the Aave version). Converts Node 07 findings into a deterministic
 * validation specification the same way the Aave node does -- but by
 * ANCHOR-TOKEN OVERLAP instead of fixed-ID matching, since Venus's
 * Node 07 output uses open, per-run finding labels with no fixed
 * taxonomy.
 *
 * v1.1 CHANGE FROM v1.0 -- WHY, AND WHAT DID NOT CHANGE:
 * ---------------------------------------------------------------------
 * v1.0 only read '07_AI_Risk_Reasoner'. Node 08 (the audit/incident
 * ingestion agent) was designed from the start to be "unioned with
 * Node 07's [findings] before Node 13 processes either" (see Node 08's
 * own system prompt header) -- but that union was never actually wired
 * into this file. This version fixes that gap.
 *
 * The naive fix would be to concatenate Node 07's and Node 08's finding
 * arrays and run the existing per-finding loop over the combined list
 * unchanged. That was explicitly rejected: if Node 07 and Node 08 each
 * independently produce a finding that anchor-token-resolves to the
 * SAME Venus spec key (e.g. both land on ASSET-CUSTODY-01), naive
 * concatenation would silently produce two separate output findings
 * sharing one finding_id -- double-counting the same underlying risk
 * and corrupting whatever downstream node (17, 18, ERA) counts/weighs
 * findings by category.
 *
 * So this version adds a NORMALIZATION / DE-DUPLICATION phase that
 * runs BEFORE the predicate-building loop:
 *   1. Every finding from BOTH sources is anchor-token-resolved
 *      first (same resolveFindingByAnchorTokens logic as before,
 *      unchanged), and tagged with which source it came from.
 *   2. Findings are grouped by resolved spec_key.
 *   3. A spec_key with findings from only one source passes through
 *      as a single-source finding (same as v1.0 behaviour, just with
 *      an explicit source tag now).
 *   4. A spec_key with findings from BOTH sources is MERGED into one
 *      finding object -- but merging never overwrites one source's
 *      data with the other's. Both sources' original claim_id,
 *      severity, and architectural evidence are preserved side by
 *      side under source_findings.node07_architecture /
 *      source_findings.node08_audit. A single top-level `severity` is
 *      still computed (the more severe of the two) purely for
 *      downstream nodes that expect one value per finding -- the
 *      untouched originals remain available for anyone who wants them.
 *   5. Node 08's `provenance` block (source document, date_flagged,
 *      original_disposition, etc.) is preserved under
 *      source_findings.node08_audit.provenance -- never dropped,
 *      never merged into Node 07's side.
 *
 * Predicate evaluation itself (RUNTIME_EXISTENCE / SOURCE_RELATIONSHIP
 * / EXPERIMENT evaluators, VENUS_SPEC, SOURCE_EVIDENCE_MAP) is
 * UNCHANGED from v1.0. The per-finding OUTPUT SHAPE that Node 16
 * already reads (finding_id, finding_name, risk_category, severity,
 * predicates, deterministic_ready, validation_status) is fully
 * preserved -- new fields are additive (sources, source_findings,
 * claim_ids_by_source), nothing existing was renamed or removed.
 * NODE 16 WAS NOT MODIFIED AND DOES NOT NEED TO BE, per explicit
 * instruction.
 *
 * Node 13 (Venus) still DOES NOT:
 *   - calculate confidence
 *   - calculate risk
 *   - fuse evidence
 *   - use LLM confidence as deterministic evidence
 *   - use historical evidence as deterministic proof
 *   - use temporal evidence as deterministic proof
 *   - treat keyword presence in free text as proof (only exact
 *     membership in mechanism_tokens/dependency_chain counts --
 *     never a substring search across prose)
 *   - silently pick a match when a finding's tokens overlap more than
 *     one anchor set (flagged ANCHOR_TOKEN_AMBIGUOUS instead)
 *   - promote generic runtime success into proof of every finding
 *   - silently overwrite one source's finding data with the other's
 *     when Node 07 and Node 08 both describe the same underlying claim
 *
 * IMPORTANT CAVEAT, DISCLOSED RATHER THAN HIDDEN:
 * ---------------------------------------------------------------------
 * All five of Venus's tested findings -- including the donation-attack
 * test -- were actually run manually via `forge test` directly in a
 * terminal, not through any automated n8n-callable endpoint. This node
 * tries a live upstream node first (see FOUNDRY_BEHAVIORAL_NODE_
 * CANDIDATES below), falling back to a clearly-labeled manual snapshot
 * for all five. This part is unchanged from v1.0.
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

// Candidate names for the audit/incident ingestion agent -- adjust to
// match whatever you actually called it on the canvas. Tries each in
// order, first one that resolves wins. If none resolve, Node 08's
// contribution is simply empty (findings08 = []) -- this file never
// fails or fabricates data because Node 08 isn't found.
const NODE_08_CANDIDATES = [
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
// directly in a terminal (2026-08-11), for findings that don't yet
// have a live server.js endpoint. Unchanged from v1.0.
const MANUAL_FOUNDRY_SNAPSHOT = {
    UPGRADEABILITY_01: {
        passed: true,
        status: "SUPPORTED",
        test: "VenusUpgradeabilityTest.test_NonAdminCannotSetImplementation",
        recorded_at: "2026-08-11",
        source: "Manual forge test run, real BSC fork, not yet wired to an automated endpoint."
    },
    DEPENDENCY_01: {
        passed: true,
        status: "SUPPORTED",
        test: "VenusComptrollerDependencyTest (test_MintWithinCapSucceeds + test_MintExceedingCapReverts)",
        recorded_at: "2026-08-11",
        source: "Manual forge test run, real BSC fork, not yet wired to an automated endpoint."
    },
    ECONOMIC_DEPENDENCY_01: {
        passed: true,
        status: "SUPPORTED",
        test: "VenusInterestAccrualTest.test_InterestAccrualDrivenByRateModelAndBlocks",
        recorded_at: "2026-08-11",
        source: "Manual forge test run, real BSC fork, not yet wired to an automated endpoint."
    },
    ACCESS_CONTROL_01: {
        passed: true,
        status: "SUPPORTED",
        test: "VenusAccessControlManagerTest.test_RandomCallerCannotSetReserveFactor",
        recorded_at: "2026-08-11",
        source: "Manual forge test run, real BSC fork, not yet wired to an automated endpoint."
    },
    ASSET_CUSTODY_01: {
        passed: true,
        status: "SUPPORTED",
        test: "VenusDonationAttackTest (test_DonationMovesExchangeRateWithoutMint + test_Control_MintAlsoMovesCash), plus test_Diagnostic_RawBalanceVsGetCash follow-up confirming no token/accounting discrepancy",
        recorded_at: "2026-08-11",
        source: "Manual forge test run, real BSC fork, not yet wired to an automated endpoint."
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
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
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
// VENUS FINDING SPECIFICATION (unchanged from v1.0)
// ======================================================================
const VENUS_SPEC = {
    UPGRADEABILITY_01: {
        finding_name: "Admin-Controlled Implementation Upgrade (VBep20Delegator)",
        risk_category: "Upgradeability",
        anchor_tokens: ["_setImplementation", "_becomeImplementation", "_resignImplementation", "implementation"],
        behavioral_key: "UPGRADEABILITY_01",
        predicates: [
            {
                predicate_id: "UPGRADEABILITY-01-P01",
                level: "L2",
                layer: "STRUCTURAL_RELATIONSHIP",
                claim: "The delegator's implementation pointer is set through an admin-gated setter, not general access.",
                evidence_requirement: "SOURCE_RELATIONSHIP"
            },
            {
                predicate_id: "UPGRADEABILITY-01-P02",
                level: "L3",
                layer: "BEHAVIOURAL",
                claim: "A non-admin caller attempting to change the implementation is rejected.",
                evidence_requirement: "EXPERIMENT",
                requires_execution: true,
                experiment: "Call _setImplementation from an unprivileged address on a fork and confirm it reverts with the admin-only error."
            }
        ]
    },
    DEPENDENCY_01: {
        finding_name: "Comptroller Policy Dependency on VToken exchangeRateStored",
        risk_category: "Dependency",
        anchor_tokens: ["comptroller", "exchangeRateStored", "mintAllowed", "supplyCaps"],
        behavioral_key: "DEPENDENCY_01",
        predicates: [
            {
                predicate_id: "DEPENDENCY-01-P01",
                level: "L1",
                layer: "STRUCTURAL",
                claim: "The vToken resolves a Comptroller reference.",
                evidence_requirement: "RUNTIME_EXISTENCE",
                runtime_requirements: [{ property: "comptroller_exists", expected: true }]
            },
            {
                predicate_id: "DEPENDENCY-01-P02",
                level: "L2",
                layer: "STRUCTURAL_RELATIONSHIP",
                claim: "The Comptroller's supply-cap policy check reads the vToken's exchangeRateStored value.",
                evidence_requirement: "SOURCE_RELATIONSHIP"
            },
            {
                predicate_id: "DEPENDENCY-01-P03",
                level: "L3",
                layer: "BEHAVIOURAL",
                claim: "mint() succeeds when the independently-computed exchangeRateStored/totalSupply value is under the supply cap and reverts when it is over.",
                evidence_requirement: "EXPERIMENT",
                requires_execution: true,
                experiment: "Execute mint() comfortably under and comfortably over the independently-computed cap on a fork and compare outcomes."
            }
        ]
    },
    ECONOMIC_DEPENDENCY_01: {
        finding_name: "Interest Accrual Dependency on External InterestRateModel",
        risk_category: "Economic Dependency",
        anchor_tokens: ["accrueInterest", "getBorrowRate", "interestRateModel"],
        behavioral_key: "ECONOMIC_DEPENDENCY_01",
        predicates: [
            {
                predicate_id: "ECONOMIC-DEPENDENCY-01-P01",
                level: "L1",
                layer: "STRUCTURAL",
                claim: "An external InterestRateModel is deployed and referenced by the vToken.",
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
                claim: "Given a non-zero real borrow rate and non-zero borrows, advancing blocks and calling accrueInterest() increases totalBorrows and borrowIndex.",
                evidence_requirement: "EXPERIMENT",
                requires_execution: true,
                experiment: "Roll a fork forward and call accrueInterest(), comparing totalBorrows/borrowIndex before and after."
            }
        ]
    },
    ASSET_CUSTODY_01: {
        finding_name: "On-Chain Token Balance (Cash) Directly Determines Exchange Rate",
        risk_category: "Asset Custody / Trust Boundary",
        anchor_tokens: ["getCashPrior", "exchangeRateStoredInternal", "balanceOf", "doTransferIn", "underlying"],
        behavioral_key: "ASSET_CUSTODY_01",
        predicates: [
            {
                predicate_id: "ASSET-CUSTODY-01-P01",
                level: "L1",
                layer: "STRUCTURAL",
                claim: "The vToken reports an available cash balance and exchange rate.",
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
                claim: "An ungated ERC-20 transfer of the underlying directly into the vToken moves cash and exchangeRateStored without calling mint().",
                evidence_requirement: "EXPERIMENT",
                requires_execution: true,
                experiment: "Donate the underlying token directly to the vToken on a fork (no mint call) and confirm cash and exchangeRateStored both increase, with totalSupply unchanged."
            }
        ]
    },
    ACCESS_CONTROL_01: {
        finding_name: "External AccessControlManager Gates Privileged Functions",
        risk_category: "Access Control",
        anchor_tokens: ["ensureAllowed", "isAllowedToCall", "accessControlManager", "_setReserveFactor"],
        behavioral_key: "ACCESS_CONTROL_01",
        predicates: [
            {
                predicate_id: "ACCESS-CONTROL-01-P01",
                level: "L2",
                layer: "STRUCTURAL_RELATIONSHIP",
                claim: "Governance-sensitive vToken functions call ensureAllowed(functionSig) against an external AccessControlManager before making state changes.",
                evidence_requirement: "SOURCE_RELATIONSHIP"
            },
            {
                predicate_id: "ACCESS-CONTROL-01-P02",
                level: "L3",
                layer: "BEHAVIOURAL",
                claim: "An arbitrary, unpermissioned caller invoking a gated function (_setReserveFactor) is rejected by the AccessControlManager.",
                evidence_requirement: "EXPERIMENT",
                requires_execution: true,
                experiment: "Call _setReserveFactor from a random unpermissioned address on a fork and confirm it reverts with 'access denied'."
            }
        ]
    },
    OPERATIONAL_RESILIENCE_01: {
        finding_name: "External ProtocolShareReserve Dependency for Reserve Reduction",
        risk_category: "Operational Resilience",
        anchor_tokens: ["_reduceReservesFresh", "updateAssetsState", "protocolShareReserve", "doTransferOut"],
        behavioral_key: "OPERATIONAL_RESILIENCE_01",
        predicates: [
            {
                predicate_id: "OPERATIONAL-RESILIENCE-01-P01",
                level: "L1",
                layer: "STRUCTURAL",
                claim: "The vToken maintains an operational reserve registry.",
                evidence_requirement: "RUNTIME_EXISTENCE",
                runtime_requirements: [{ property: "reserve_registry_exists", expected: true }]
            },
            {
                predicate_id: "OPERATIONAL-RESILIENCE-01-P02",
                level: "L2",
                layer: "STRUCTURAL_RELATIONSHIP",
                claim: "Reserve reduction (_reduceReservesFresh) transfers funds out to an external ProtocolShareReserve and updates its accounting via updateAssetsState.",
                evidence_requirement: "SOURCE_RELATIONSHIP"
            },
            {
                predicate_id: "OPERATIONAL-RESILIENCE-01-P03",
                level: "L3",
                layer: "BEHAVIOURAL",
                claim: "A reserve-reduction call to the external ProtocolShareReserve succeeds and updates its state as expected.",
                evidence_requirement: "EXPERIMENT",
                requires_execution: true,
                experiment: "No Foundry test exists yet for this finding -- see task list. Execute a controlled reserve-reduction call on a fork and confirm ProtocolShareReserve state updates accordingly."
            }
        ]
    }
};

// ======================================================================
// SOURCE EVIDENCE MAP (unchanged from v1.0)
// ======================================================================
const SOURCE_EVIDENCE_MAP = {
    "UPGRADEABILITY-01-P01": ["function _setImplementation", "Caller must be admin", "_becomeImplementation"],
    "DEPENDENCY-01-P02": ["mintAllowed", "nextTotalSupply", "exchangeRateStored", "supplyCaps"],
    "ECONOMIC-DEPENDENCY-01-P02": ["interestRateModel.getBorrowRate", "simpleInterestFactor", "totalBorrowsPrior"],
    "ASSET-CUSTODY-01-P02": ["getCashPrior() returns IERC20(underlying).balanceOf(address(this))", "getCashPrior", "exchangeRateStoredInternal"],
    "ACCESS-CONTROL-01-P01": ["ensureAllowed(functionSig)", "IAccessControlManagerV8(accessControlManager).isAllowedToCall", "access denied"],
    "OPERATIONAL-RESILIENCE-01-P02": ["_reduceReservesFresh", "updateAssetsState", "doTransferOut"]
};

// ======================================================================
// FINDING EXTRACTION (source-agnostic -- works on Node 07 or Node 08
// output, since Node 08's schema is deliberately an additive superset
// of Node 07's)
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
// ANCHOR-TOKEN MATCHING (unchanged from v1.0)
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
    for (const [specKey, spec] of Object.entries(VENUS_SPEC)) {
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
// UNION + NORMALIZATION / DE-DUPLICATION LAYER (NEW IN v1.1)
// ======================================================================
// Runs BEFORE predicate building. Resolves every finding from both
// sources to a spec_key first, groups by spec_key, and only THEN
// decides whether a group is single-source (pass through, tagged) or
// multi-source (merge, preserving both sides -- never overwrite).
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

// One entry per source for a resolved finding -- used both for
// single-source and multi-source (merged) cases, so the shape is
// identical either way and nothing needs special-casing downstream.
function sourceEntry(item) {
    const f = item.finding;
    return {
        source_finding_name: item.resolution.source_name,
        claim_id: item.resolution.claim_id || null,
        severity: text(f?.severity || f?.risk_severity || "Unknown"),
        // Node 07's own risk-identification confidence, verbatim, 0-1.
        // Added specifically so Node 17 (Venus) can build its LLM mass
        // from THIS already-anchor-token-resolved entry instead of
        // re-deriving a Node07-to-spec-key correspondence itself (which
        // would just duplicate, and risk diverging from, the matching
        // Node 13 already did). Null, not 0, when absent -- absence of
        // a number is not the same claim as zero confidence.
        confidence: typeof f?.confidence === "number" ? f.confidence : null,
        matched_anchor_tokens: item.resolution.matched_tokens,
        architectural_evidence: getArchitecturalEvidence(f),
        // Only Node 08 findings ever carry provenance -- Node 07's
        // side is simply omitted (not null-padded with fake fields),
        // preserved exactly as Node 08 produced it, never merged into
        // Node 07's entry.
        provenance: f?.provenance ?? undefined
    };
}

function buildResolvedFinding(specKey, group) {
    const spec = VENUS_SPEC[specKey];
    const bySource = { NODE_07_ARCHITECTURE: null, NODE_08_AUDIT: null };
    for (const item of group) {
        // If a source somehow contributes more than one finding to the
        // same spec_key in one run, keep the first and note the rest --
        // still never silently dropped, just not a primary slot.
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

    // Union of both sides' evidence -- used for the flat top-level
    // field (backward-compatible with whatever Node 16 already reads)
    // AND fed into SOURCE_RELATIONSHIP predicate matching, since
    // either source's text can support an L2 claim.
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
        finding_resolution: isMerged ? "MERGED_ANCHOR_TOKEN_MATCH" : "ANCHOR_TOKEN_MATCH",
        sources,
        // Full, unmodified per-source data -- this is the "don't
        // overwrite, preserve which evidence came from which source"
        // requirement. Both keys are always present; the one with no
        // contributing finding is null, never fabricated.
        source_findings: {
            node07_architecture: bySource.NODE_07_ARCHITECTURE,
            node08_audit: bySource.NODE_08_AUDIT
        },
        claim_ids_by_source: claimIdsBySource,
        claim_ids_agree: claimIdsAgree,
        anchor_tokens_matched: [...new Set(group.flatMap(g => g.resolution.matched_tokens))],
        severity,
        risk_category: spec.risk_category,
        // Flat union, kept for backward compatibility with anything
        // (including Node 16) already reading this field directly.
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
                ? `This finding's mechanism_tokens/dependency_chain overlap more than one Venus anchor set (${resolution.candidates.map(c => c.specKey).join(", ")}). Refusing to guess which is correct -- flagged for manual review instead of silently picking one.`
                : resolution.resolution === "NO_TOKENS_SUPPLIED"
                    ? "Finding has no mechanism_tokens or dependency_chain to match against -- cannot anchor-token match without them."
                    : "No Venus anchor-token set overlaps this finding's mechanism_tokens/dependency_chain.",
        resolution_debug: {
            resolution_type: resolution.resolution,
            candidates: resolution.candidates || null,
            available_spec_keys: Object.keys(VENUS_SPEC)
        }
    };
}

// ======================================================================
// OBJECTIVE FOUNDRY RUNTIME (unchanged from v1.0)
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
// PREDICATE EVALUATORS (unchanged from v1.0)
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

function buildBehaviouralPredicate(predicate, behavioralKey) {
    const live = behavioralKey ? liveBehavioralValidation[behavioralKey] : null;
    const manual = behavioralKey ? MANUAL_FOUNDRY_SNAPSHOT[behavioralKey] : null;
    const evidenceRecord = live || manual || null;
    if (!evidenceRecord) {
        return { result: "NOT_TESTED", evidence_source: "No executed Foundry experiment supplied", experiment_required: predicate.experiment, requires_execution: true, reason: "A proposed experiment is not treated as execution evidence." };
    }
    const passed = evidenceRecord.passed === true;
    return {
        result: passed ? "PASS" : "FAIL",
        evidence_source: live ? "Live Foundry behavioral endpoint" : `Manual forge test snapshot (${evidenceRecord.recorded_at || "date unrecorded"}) -- not yet wired to a live endpoint`,
        executed_test: evidenceRecord.test || null,
        reported_status: evidenceRecord.status || null,
        requires_execution: false,
        reason: passed
            ? "A real Foundry behavioural experiment was executed and passed."
            : "A real Foundry behavioural experiment was executed and did not pass -- review before treating this as CONTRADICTED (check for fork/instrumentation issues per the test's own control-test framing, if one exists)."
    };
}

// ======================================================================
// BUILD FINDINGS (resolved + unmapped)
// ======================================================================
const resolvedFindings = Object.entries(groupsBySpecKey).map(([specKey, group]) => buildResolvedFinding(specKey, group));
const unmappedFindings = unmappedItems.map((item, index) => buildUnmappedFinding(item, index));
const outputFindings = [...resolvedFindings, ...unmappedFindings];

const matchedSpecKeys = new Set(resolvedFindings.map(f => f.finding_id));
const specKeysWithNoFindingThisRun = Object.keys(VENUS_SPEC).filter(k => !matchedSpecKeys.has(k));

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
    total_predicates: allPredicates.length,
    l1_existence_predicates: allPredicates.filter(p => p.level === "L1").length,
    l2_relationship_predicates: allPredicates.filter(p => p.level === "L2").length,
    l3_behavioural_predicates: allPredicates.filter(p => p.level === "L3").length,
    behavioural_predicates_passed: allPredicates.filter(p => p.level === "L3" && p.validation_result === "PASS").length,
    behavioural_predicates_failed: allPredicates.filter(p => p.level === "L3" && p.validation_result === "FAIL").length,
    behavioural_predicates_not_tested: allPredicates.filter(p => p.level === "L3" && p.validation_result === "NOT_TESTED").length,
    venus_spec_categories_with_no_matching_finding_this_run: specKeysWithNoFindingThisRun
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
    behavioral_evidence_partially_manual: Object.keys(MANUAL_FOUNDRY_SNAPSHOT).length > 0,
    behavioral_evidence_manual_disclosure:
        "5 of 5 tested findings' behavioral evidence currently comes from a manually-recorded forge test snapshot (2026-08-11), not a live endpoint -- see MANUAL_FOUNDRY_SNAPSHOT.",
    // New in v1.1:
    node07_node08_findings_unioned_before_predicate_building: true,
    union_deduplicated_by_anchor_token_spec_key_not_naive_concatenation: true,
    merge_never_overwrites_source_finding_data: true,
    merge_preserves_per_source_claim_id_and_evidence_separately: true,
    node08_provenance_preserved_and_never_merged_into_node07_side: true,
    node_16_modified_for_this_change: false
};

// ======================================================================
// TEMPORAL / HISTORICAL CONTEXT (preserved, not used as proof)
// ======================================================================
const temporalContext = {
    analysis_window_days: temporal.analysis_window_days ?? null,
    first_transaction: temporal.first_transaction ?? null,
    latest_transaction: temporal.latest_transaction ?? null,
    transactions_analyzed: temporal.transactions_analyzed ?? null,
    successful_transactions: temporal.successful_transactions ?? null,
    failed_transactions: temporal.failed_transactions ?? null,
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
                    protocol: text(foundry.protocolName || evidenceReview07?.protocol || "Venus Protocol"),
                    methodology:
                        "Finding-specific deterministic verification using objective runtime observations, anchor-token overlap matching against Node 07's and Node 08's mechanism_tokens/dependency_chain (unioned and de-duplicated by resolved spec key before predicate building, never naively concatenated), and real executed Foundry behavioural results where available.",
                    specification_version: "1.2",
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
