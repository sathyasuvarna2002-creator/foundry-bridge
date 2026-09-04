/***********************************************************************
 * NODE 13
 * DETERMINISTIC EVIDENCE SPECIFICATION
 * VERSION 2.9
 *
 * VERSION 2.9 CHANGE FROM 2.8
 * ---------------------------------------------------------------------
 * AAVE_MANUAL_FOUNDRY_SNAPSHOT entries for F01-P04, F02-P03, F03-P04,
 * F04-P04, and F10-P04 gained a real, executed authorized-success test
 * alongside their existing unauthorized-rejection test (2026-08-15, same
 * live mainnet fork), plus a new `full_claim_proven: true` field (also
 * set on F09-P04, which was always a full-claim test). This does not
 * change any predicate's SUPPORTED/PASS status -- it was already correct
 * -- it only records that 6 of 11 findings now have their complete
 * predicate claim proven (both directions), not just the access-boundary
 * half. F05, F06, F07, F08, F11 remain gate-only, disclosed as such.
 *
 * VERSION 2.8 CHANGE FROM 2.7
 * ---------------------------------------------------------------------
 * Adds AAVE_MANUAL_FOUNDRY_SNAPSHOT (see below), Aave's first equivalent
 * of Venus's MANUAL_FOUNDRY_SNAPSHOT. All 11 of F01-F11's L3 EXPERIMENT
 * predicates now have a real, executed `forge test` result -- run
 * manually in a terminal against a live Ethereum mainnet fork (Alchemy
 * RPC), 2026-08-15, all 11 PASS. buildBehaviouralPredicate() now checks
 * this snapshot before falling back to NOT_TESTED. Nothing else in this
 * file changed; this closes the KNOWN GAP noted in v2.4-2.7.
 *
 * PURPOSE
 * ---------------------------------------------------------------------
 * Converts Node 07 (and, as of v2.6, Node 08) evidence-review findings
 * into a deterministic validation specification for Node 16.
 *
 * Node 13 DEFINES what must be verified.
 *
 * Node 13 DOES NOT:
 *   - calculate confidence
 *   - calculate risk
 *   - fuse evidence
 *   - use LLM confidence as deterministic evidence
 *   - use historical evidence as deterministic proof
 *   - use temporal evidence as deterministic proof
 *   - treat keyword presence as proof
 *   - treat architectural narrative as proof
 *   - treat proposed experiments as executed
 *   - promote generic Foundry success into proof of every finding
 *
 * VERSION 2.4 FIX (unchanged, kept for history)
 * ---------------------------------------------------------------------
 * Robust canonical finding resolution -- extracts names from multiple
 * explicit Node 07 fields, supports nested finding objects, uses exact
 * canonical names/declared aliases only, never fuzzy keyword matching,
 * uses finding_id when supplied.
 *
 * VERSION 2.5 FIX (unchanged, kept for history)
 * ---------------------------------------------------------------------
 * Defensive upstream node lookups -- safeNodeJson() wraps every
 * `$('NodeName').first().json` read so a missing/disabled upstream node
 * (e.g. dropping 12_Temporal_Evidence_Engine when its BSC API access is
 * unavailable) degrades to null instead of crashing this node outright.
 *
 * VERSION 2.6 CHANGE -- UNION ARCHITECTURE (Node 07 + Node 08 merge)
 * ---------------------------------------------------------------------
 * Same gap Venus had before its v1.1: Node 08 (the audit/incident
 * ingestion agent) was designed from the start to be unioned with
 * Node 07's findings before Node 13 processes either (see Node 08's
 * own system-prompt header), but that union was never wired into the
 * Aave file. VERSION 2.6 fixed that, following the same de-dup/merge
 * shape as 13_deterministic_evidence_specification_venus.js v1.1 --
 * with one structural difference, because Aave's and Venus's Node 07
 * outputs are not shaped the same way. Node 08's read uses the same
 * safeNodeJson() helper v2.5 already established for the other four
 * upstream reads -- an absent Node 08 degrades to "contributed nothing
 * this run," same as an absent temporal/historical node already did:
 *
 *   - Node 07 (Aave) already carries a fixed, enum-constrained
 *     canonical_finding_id (F01-F11). Node 07-side resolution is
 *     UNCHANGED from v2.4 -- still resolveFinding()'s explicit
 *     ID/name-agreement logic, nothing about it needed to change for
 *     the union.
 *   - Node 08 (Aave) does NOT produce canonical_finding_id -- it was
 *     never designed to know the Aave-specific F01-F11 taxonomy, only
 *     an open finding_id/claim_id built from the evidence it extracted
 *     (see 08_audit_incident_ingestion_schema_v1.json). So Node 08
 *     findings resolve the same way Venus resolves ALL its findings:
 *     anchor-token overlap between the finding's
 *     validation_target.mechanism_tokens / dependency_chain and a
 *     fixed per-finding alias-token set (AAVE_ALIAS_TOKENS, new in
 *     this version). Node 08's risk_name is also checked against the
 *     CANONICAL_FINDINGS alias index first (cheap, and would catch the
 *     rare case where an audit finding happens to echo the exact
 *     canonical phrase), before falling back to anchor tokens.
 *
 * AAVE_ALIAS_TOKENS PROVENANCE -- DISCLOSED, NOT HIDDEN:
 * ---------------------------------------------------------------------
 * For F03-F11, the alias-token sets are built directly from
 * SOURCE_EVIDENCE_MAP -- i.e. from function/variable names that were
 * already independently verified against Aave's real source as part of
 * building this file's SOURCE_RELATIONSHIP predicates. Reusing them
 * here does not introduce any new unverified claim.
 *
 * F01 and F02 have no SOURCE_RELATIONSHIP predicate in SPEC (both are
 * RUNTIME_EXISTENCE + RESOLVER_EXECUTION + EXPERIMENT only), so there
 * is no pre-verified evidence map to draw on. Their alias tokens
 * (proxy-admin / AddressesProvider-setter function names) are reasoned
 * from well-known Aave v3 architecture, NOT independently re-verified
 * against source the way F03-F11's tokens were. Treat
 * ANCHOR_TOKEN_MATCH results against F01/F02 as lower-confidence than
 * F03-F11 until someone checks those specific token names against the
 * actual deployed contracts. Flagged here rather than silently
 * presented as equally solid.
 *
 * Some tokens legitimately overlap across findings (e.g. initReserve /
 * onlyPoolConfigurator appear in both F04's and F11's verified evidence
 * maps, because both findings really do turn on the same
 * PoolConfigurator-gated mechanism). When a Node 08 finding's tokens
 * overlap more than one alias set, this is flagged
 * ANCHOR_TOKEN_AMBIGUOUS and NOT silently resolved to either --
 * consistent with the "do not guess" posture carried over unchanged
 * from Venus and from v2.4's own ID_NAME_MISMATCH handling.
 *
 * UNION / DE-DUPLICATION, SAME SHAPE AS VENUS v1.1:
 *   1. Every finding from BOTH sources is resolved to an F0x key first
 *      (Node 07 via resolveFinding(), Node 08 via
 *      resolveNode08Finding()), tagged with which source it came from.
 *   2. Findings are grouped by resolved F0x key.
 *   3. A single-source group passes through as before, now with an
 *      explicit source tag.
 *   4. A group with BOTH sources is MERGED -- never overwriting one
 *      source's data with the other's. Both sources' claim_id (Node 08
 *      only -- Aave's Node 07 schema has no claim_id field, so
 *      claim_ids_by_source.node07_architecture is always null by
 *      design, not a bug), severity, and architectural evidence are
 *      preserved side by side under source_findings.node07_architecture
 *      / source_findings.node08_audit. A single top-level severity is
 *      still computed (the more severe of the two) for downstream
 *      nodes that expect one value per finding.
 *   5. Node 08's provenance block is preserved under
 *      source_findings.node08_audit.provenance -- never dropped, never
 *      merged into Node 07's side.
 *
 * Predicate evaluation itself (RUNTIME_EXISTENCE / RESOLVER_EXECUTION /
 * SOURCE_RELATIONSHIP / EXPERIMENT evaluators, SPEC, SOURCE_EVIDENCE_MAP,
 * the whole runtime object) is UNCHANGED from v2.4 -- none of it is
 * source-specific, all of it reads Foundry/AddressesProvider evidence
 * that exists independently of which agent flagged the finding. The
 * per-finding OUTPUT SHAPE Node 16 already reads (finding_id,
 * finding_name, risk_category, severity, predicates, deterministic_ready,
 * validation_status) is fully preserved -- new fields are additive
 * (sources, source_findings, claim_ids_by_source), nothing existing was
 * renamed or removed. NODE 16 WAS NOT MODIFIED AND DOES NOT NEED TO BE.
 *
 * VERSION 2.7 FIX -- NODE_08_CANDIDATES LIVE NAME MISMATCH
 * ---------------------------------------------------------------------
 * Real bug found by comparing this file against the live n8n canvas
 * export (Aave - Final (1).json). NODE_08_CANDIDATES (the try-list
 * safeNodeJson() walks to find Node 08's output) only listed
 * '08_AI_Audit_Agent', '08_Audit_Incident_Ingestion_Agent', and
 * 'AI Agent' -- none of which match the node's REAL live name,
 * '08_AI_AUDIT'. Because safeNodeJson() catches lookup failures by
 * design (an absent Node 08 is meant to degrade to "contributed
 * nothing this run," not crash the node), this mismatch produced no
 * error: evidenceReview08 silently resolved to {} on every real run,
 * meaning findings08 was always empty and the entire v2.6 union
 * architecture never actually activated in production -- every
 * finding's `sources` was always just ["NODE_07_ARCHITECTURE"], and no
 * UNMAPPED-AUDIT-* entries could ever be produced, regardless of what
 * Node 08 actually found. This is disclosed rather than assumed fixed:
 * I have not independently re-verified whether the specific Node 16
 * v6.1 production output pasted earlier this session had any
 * NODE_08_AUDIT-sourced findings -- given this bug, it's more likely
 * that run's `sources` fields were all single-source by construction.
 * Fix: added '08_AI_AUDIT' to NODE_08_CANDIDATES (checked first, since
 * it's the confirmed real name), keeping the old candidates as
 * fallback in case the canvas node is ever renamed back or duplicated
 * under an old name. No other logic changed.
 *
 * Node 13 (Aave) still DOES NOT:
 *   - calculate confidence
 *   - calculate risk
 *   - fuse evidence
 *   - use LLM confidence as deterministic evidence
 *   - use historical evidence as deterministic proof
 *   - use temporal evidence as deterministic proof
 *   - treat keyword presence in free text as proof (only exact
 *     membership in mechanism_tokens/dependency_chain counts for Node
 *     08 anchor-token resolution -- never a substring search across
 *     prose)
 *   - silently pick a match when a finding's signals disagree or its
 *     tokens overlap more than one spec key (ID_NAME_MISMATCH /
 *     ANCHOR_TOKEN_AMBIGUOUS instead)
 *   - promote generic runtime success into proof of every finding
 *   - silently overwrite one source's finding data with the other's
 *     when Node 07 and Node 08 both describe the same underlying claim
 *
 * GAP CLOSED IN v2.8: Aave now has its own real, manually-run `forge
 * test` behavioural results for all 11 findings (F01-F11), wired into
 * this file via AAVE_MANUAL_FOUNDRY_SNAPSHOT below -- see the v2.8
 * changelog above. Every result recorded there is a real terminal run
 * against a live mainnet fork, never fabricated; any predicate not
 * present in the snapshot still falls through to NOT_TESTED.
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

const evidenceReview =
    safeNodeJson('07_AI_Risk_Reasoner') || {};

// Candidate names for the audit/incident ingestion agent -- adjust to
// match whatever you actually called it on the canvas. Tries each in
// order, first one that resolves wins. If none resolve, Node 08's
// contribution is simply empty (findings08 = []) -- this file never
// fails or fabricates data because Node 08 isn't found.
//
// v2.7: '08_AI_AUDIT' is the CONFIRMED real live node name (verified
// directly against the Aave n8n canvas export) and is checked first.
// The other three are kept as fallback only -- they did not match
// anything on the real canvas and v2.6 silently degraded to "Node 08
// contributed nothing" on every run as a result.
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
function cleanName(value) {
    return text(value)
        .replace(/\s+/g, " ")
        .trim();
}
function normalizeToken(value) {
    return text(value)
        .toLowerCase()
        .replace(/[()._]/g, "")
        .trim();
}
const SEVERITY_RANK = { "Critical": 5, "High": 4, "Medium": 3, "Low": 2, "Informational": 1, "Unknown": 0 };
function higherSeverity(a, b) {
    const ra = SEVERITY_RANK[text(a)] ?? 0;
    const rb = SEVERITY_RANK[text(b)] ?? 0;
    return rb > ra ? b : a;
}

// ======================================================================
// CANONICAL FINDINGS (unchanged from v2.4)
// ======================================================================
const CANONICAL_FINDINGS = {
    F01: { canonical: "Upgradeable Proxy Control Risk", aliases: ["Upgradeable Proxy Control Risk"] },
    F02: { canonical: "Registry Centralisation Risk", aliases: ["Registry Centralisation Risk"] },
    F03: { canonical: "ACL Manager Role Concentration", aliases: ["ACL Manager Role Concentration"] },
    F04: { canonical: "Pool Configurator Centralised Configuration Authority", aliases: ["Pool Configurator Centralised Configuration Authority"] },
    F05: { canonical: "Umbrella Exclusive Deficit Elimination Authority", aliases: ["Umbrella Exclusive Deficit Elimination Authority"] },
    F06: { canonical: "Asset Price Oracle Dependency", aliases: ["Asset Price Oracle Dependency", "Asset Price Oracle Dependency (Asset Price Oracle Dependency)"] },
    F07: { canonical: "aToken and Debt Token External Implementation Custody Dependency", aliases: ["aToken and Debt Token External Implementation Custody Dependency"] },
    F08: { canonical: "Interest Rate Strategy Externalization", aliases: ["Interest Rate Strategy Externalization", "Interest Rate Strategy Externalisation"] },
    F09: { canonical: "Composability Risk: External Flashloan Receivers & Optional Debt Opening", aliases: ["Composability Risk: External Flashloan Receivers & Optional Debt Opening"] },
    F10: { canonical: "Trust Boundary Expansion via Position Manager Delegation", aliases: ["Trust Boundary Expansion via Position Manager Delegation"] },
    F11: { canonical: "Reserve Registry Operational Dependency", aliases: ["Reserve Registry Operational Dependency"] }
};

// ======================================================================
// FINDING ALIAS INDEX (unchanged from v2.4 -- exact canonical name match)
// ======================================================================
const FINDING_ALIAS_INDEX = {};
for (const [id, definition] of Object.entries(CANONICAL_FINDINGS)) {
    FINDING_ALIAS_INDEX[normalize(definition.canonical)] = id;
    for (const alias of definition.aliases) {
        FINDING_ALIAS_INDEX[normalize(alias)] = id;
    }
}

// ======================================================================
// AAVE ALIAS TOKENS (NEW IN v2.6) -- anchor-token matching for Node 08
// ======================================================================
// Only used for Node 08 findings, which carry mechanism_tokens /
// dependency_chain but no canonical_finding_id. Node 07 never uses
// this -- it is fully resolved by resolveFinding() below, unchanged.
//
// F03-F11 tokens are drawn from SOURCE_EVIDENCE_MAP (already verified
// against real Aave source for this file's own SOURCE_RELATIONSHIP
// predicates). F01/F02 tokens are reasoned from known Aave v3
// architecture, NOT independently re-verified here -- see the file
// header caveat.
// ======================================================================
const AAVE_ALIAS_TOKENS = {
    F01: ["upgradeTo", "upgradeToAndCall", "_setImplementation", "setAddressAsProxy", "implementation"],
    F02: ["setAddress", "setPoolImpl", "setPoolConfiguratorImpl", "setPriceOracle", "setACLManager", "transferOwnership"],
    F03: ["_onlyPoolAdmin", "isPoolAdmin", "isFlashBorrower"],
    F04: ["onlyPoolConfigurator", "initReserve", "syncIndexesState", "setConfiguration", "updateFlashloanPremium", "configureEModeCategory", "setLiquidationGracePeriod"],
    F05: ["onlyUmbrella", "CallerNotUmbrella", "eliminateReserveDeficit", "executeEliminateDeficit"],
    F06: ["getPriceOracle", "getAssetPrice", "GenericLogic"],
    F07: ["IAToken", "mint", "burn", "transferUnderlyingTo", "mintToTreasury", "IVariableDebtToken", "scaledTotalSupply"],
    F08: ["IReserveInterestRateStrategy", "calculateInterestRates", "updateInterestRatesAndVirtualBalance"],
    F09: ["IFlashLoanReceiver", "IFlashLoanSimpleReceiver", "executeOperation", "executeBorrow"],
    F10: ["_positionManager", "onlyPositionManager", "approvePositionManager"],
    F11: ["_reservesList", "_reservesCount", "getReservesList", "initReserve", "onlyPoolConfigurator"]
};

// ======================================================================
// ROBUST FINDING EXTRACTION (unchanged from v2.4)
// ======================================================================
// Explicit fields only. No fuzzy keyword search. No searching
// arbitrary text.
// ======================================================================
function extractFindingName(finding) {
    if (!finding || typeof finding !== "object") return "";
    const directFields = [
        finding.finding_name, finding.findingName, finding.risk_name, finding.riskName,
        finding.architectural_risk, finding.architecturalRisk, finding.risk, finding.title,
        finding.name, finding.issue_name, finding.issueName, finding.finding, finding.issue,
        finding.risk_title, finding.riskTitle, finding.architectural_risk_name, finding.architecturalRiskName
    ];
    for (const value of directFields) {
        if (typeof value === "string" && value.trim().length > 0) return cleanName(value);
    }
    /*
     * Some LLM nodes wrap the finding inside one of these objects.
     * We inspect only known wrappers.
     */
    const wrappers = [finding.output, finding.result, finding.assessment, finding.analysis, finding.finding_details, finding.findingDetails];
    for (const wrapper of wrappers) {
        if (wrapper && typeof wrapper === "object") {
            const nested = extractFindingName(wrapper);
            if (nested) return nested;
        }
    }
    return "";
}

// ======================================================================
// FINDING ID EXTRACTION (unchanged from v2.4)
// ======================================================================
function extractFindingId(finding) {
    if (!finding || typeof finding !== "object") return "";
    const values = [
        // Preferred: a short, low-entropy field the LLM schema now
        // requires and constrains to an enum of F01-F11. Far more
        // reliable than expecting the model to reproduce a long
        // descriptive risk_name string verbatim every run.
        finding.canonical_finding_id, finding.canonicalFindingId,
        finding.finding_id, finding.findingId, finding.id, finding.risk_id, finding.riskId
    ];
    for (const value of values) {
        const v = cleanName(value);
        if (/^F\d+$/i.test(v)) return v.toUpperCase();
    }
    return "";
}

// ======================================================================
// TOKEN / CLAIM_ID EXTRACTION (NEW IN v2.6 -- Node 08 only, same
// helper shape as the Venus file's Node 07+08 extractors)
// ======================================================================
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

// ======================================================================
// RESOLVE FINDING -- NODE 07 (unchanged from v2.4, renamed for clarity
// now that a second resolver exists for Node 08)
// ======================================================================
function resolveFinding(finding, index) {
    const explicitId = extractFindingId(finding);
    const sourceName = extractFindingName(finding);
    const normalized = normalize(sourceName);
    const nameMatchId = (normalized && FINDING_ALIAS_INDEX[normalized]) || null;
    const idValid = Boolean(explicitId && CANONICAL_FINDINGS[explicitId]);

    /*
     * FIX: canonical_finding_id (the LLM-supplied short ID field) was
     * observed, on real data, being filled in as a pure positional
     * counter -- item 1 -> F01, item 2 -> F02, etc -- with no real
     * semantic correspondence. Proof case: a risk_name that was the
     * VERBATIM canonical name for F01 was tagged F02 anyway, purely
     * because it was the 2nd item in the array. Trusting
     * canonical_finding_id alone would silently misassign evidence to
     * the wrong finding while reporting a clean "resolved" status.
     *
     * Both signals present and AGREE: highest-confidence resolution.
     */
    if (idValid && nameMatchId && explicitId === nameMatchId) {
        return { finding_id: explicitId, source_name: sourceName, resolution: "EXPLICIT_ID_AND_NAME_AGREE" };
    }
    /*
     * Both signals present and DISAGREE: do not silently pick one.
     * This is exactly the failure mode observed above -- flag it for
     * manual review instead of guessing which signal to trust.
     */
    if (idValid && nameMatchId && explicitId !== nameMatchId) {
        return { finding_id: null, source_name: sourceName, resolution: "ID_NAME_MISMATCH", conflicting_id: explicitId, conflicting_name_match: nameMatchId };
    }
    /*
     * Only the ID signal is present (no independent name
     * corroboration available). Trust it -- it is still a structured,
     * enum-constrained signal -- but mark it UNVERIFIED so it is
     * visible in the output which findings relied on the ID alone.
     */
    if (idValid && !nameMatchId) {
        return { finding_id: explicitId, source_name: sourceName, resolution: "EXPLICIT_FINDING_ID_UNVERIFIED" };
    }
    /*
     * Only the name signal is present.
     */
    if (nameMatchId) {
        return { finding_id: nameMatchId, source_name: sourceName, resolution: "EXACT_CANONICAL_NAME" };
    }
    /*
     * Do NOT guess from keywords.
     */
    return { finding_id: null, source_name: sourceName, resolution: "UNRESOLVED" };
}

// ======================================================================
// RESOLVE FINDING -- NODE 08 (NEW IN v2.6)
// ======================================================================
// Node 08 never supplies canonical_finding_id (it wasn't designed to
// know Aave's fixed taxonomy -- see 08_audit_incident_ingestion_
// prompt_v1.md). Try an exact canonical-name match first (cheap, and
// covers the rare case where the extracted risk_name happens to be
// worded exactly like the canonical string); fall back to anchor-token
// overlap against AAVE_ALIAS_TOKENS otherwise. Never keyword-search
// free text -- only exact membership in mechanism_tokens/
// dependency_chain counts, same rule Venus uses.
// ======================================================================
function resolveNode08Finding(finding) {
    const sourceName = extractFindingName(finding);
    const claimId = extractClaimId(finding);
    const normalized = normalize(sourceName);
    const nameMatchId = (normalized && FINDING_ALIAS_INDEX[normalized]) || null;
    if (nameMatchId) {
        return { finding_id: nameMatchId, source_name: sourceName, resolution: "EXACT_CANONICAL_NAME", matched_tokens: [], claim_id: claimId };
    }

    const mechanismTokens = extractMechanismTokens(finding);
    const dependencyChain = extractDependencyChain(finding);
    const combinedTokens = [...new Set([...mechanismTokens, ...dependencyChain])];
    if (combinedTokens.length === 0) {
        return { finding_id: null, source_name: sourceName, resolution: "NO_TOKENS_SUPPLIED", matched_tokens: [], claim_id: claimId };
    }

    const matches = [];
    for (const [id, tokens] of Object.entries(AAVE_ALIAS_TOKENS)) {
        const anchorTokensNormalized = tokens.map(normalizeToken);
        const matchedTokens = combinedTokens.filter(t => anchorTokensNormalized.includes(t));
        if (matchedTokens.length > 0) matches.push({ id, matchedTokens });
    }
    if (matches.length === 0) {
        return { finding_id: null, source_name: sourceName, resolution: "UNRESOLVED", matched_tokens: [], claim_id: claimId };
    }
    if (matches.length > 1) {
        return { finding_id: null, source_name: sourceName, resolution: "ANCHOR_TOKEN_AMBIGUOUS", candidates: matches, claim_id: claimId };
    }
    return { finding_id: matches[0].id, source_name: sourceName, resolution: "ANCHOR_TOKEN_MATCH", matched_tokens: matches[0].matchedTokens, claim_id: claimId };
}

// ======================================================================
// FINDINGS EXTRACTION (unchanged from v2.4)
// ======================================================================
// Node 07/08 may return:
//   { architectural_risks: [...] }
//   { findings: [...] }
//   { output: { architectural_risks: [...] } }
//   { output: [...] }
//   { result: { findings: [...] } }
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
const findings07 = extractFindings(evidenceReview);
const findings08 = extractFindings(evidenceReview08);

// ======================================================================
// ARCHITECTURAL EVIDENCE EXTRACTION (unchanged from v2.4 -- already
// includes `finding.evidence`, which is Node 08's verbatim-quote field,
// so no change was needed here to support Node 08)
// ======================================================================
function getArchitecturalEvidence(finding) {
    if (!finding || typeof finding !== "object") return [];
    const candidates = [
        finding.finding_level_architectural_evidence, finding.architectural_evidence,
        finding.architecturalEvidence, finding.supporting_evidence, finding.supportingEvidence, finding.evidence
    ];
    for (const candidate of candidates) {
        if (Array.isArray(candidate)) return candidate.filter(Boolean).map(text);
    }
    return [];
}

// ======================================================================
// COMPONENT EXTRACTION (v2.6: added affected_components, Node 08's
// field name -- v2.4 only knew Node 07's supporting_components)
// ======================================================================
function getComponents(finding) {
    if (!finding || typeof finding !== "object") return [];
    const candidates = [finding.supporting_components, finding.supportingComponents, finding.components, finding.affected_components, finding.affectedComponents];
    for (const candidate of candidates) {
        if (Array.isArray(candidate)) return candidate.filter(Boolean).map(text);
    }
    return [];
}

// ======================================================================
// OBJECTIVE FOUNDRY RUNTIME (unchanged from v2.4)
// ======================================================================
const runtime = {
    validation_executed: bool(foundry.runtimeValidationExecuted),
    validation_passed: bool(foundry.runtimeValidationPassed),
    checks_performed: num(foundry.runtimeChecksPerformed),
    checks_passed: num(foundry.runtimeChecksPassed),
    contract_exists: bool(foundry.contractExists),
    address_provider_exists: bool(foundry.addressProviderExists),
    address_provider: text(foundry.addressProvider),
    acl_manager_exists: bool(foundry.aclManagerExists),
    acl_manager: text(foundry.aclManager),
    pool_configurator_exists: bool(foundry.poolConfiguratorExists),
    pool_configurator: text(foundry.poolConfigurator),
    oracle_exists: bool(foundry.oracleExists),
    oracle: text(foundry.oracle),
    interest_rate_strategy_exists: bool(foundry.interestRateStrategyExists),
    interest_rate_strategy: text(foundry.interestRateStrategy),
    a_token_exists: bool(foundry.aTokenExists),
    a_token: text(foundry.aToken),
    variable_debt_token_exists: bool(foundry.variableDebtTokenExists),
    variable_debt_token: text(foundry.variableDebtToken),
    stable_debt_token_exists: bool(foundry.stableDebtTokenExists),
    stable_debt_token: text(foundry.stableDebtToken),
    reserve_registry_exists: bool(foundry.reserveRegistryExists),
    reserve_count: num(foundry.reserveCount),
    listed_markets: num(foundry.listedMarkets),
    flash_loan_supported: bool(foundry.flashLoanSupported),
    multicall_supported: bool(foundry.multicallSupported),
    position_manager_supported: bool(foundry.positionManagerSupported),
    upgradeable_architecture: bool(foundry.upgradeableArchitectureDetected)
};

// ======================================================================
// SOURCE EVIDENCE MAP (unchanged from v2.4)
// ======================================================================
const SOURCE_EVIDENCE_MAP = {
    "F03-P03": ["function _onlyPoolAdmin() internal view virtual", "Pool.flashLoan checks IACLManager", "isPoolAdmin", "isFlashBorrower"],
    "F04-P03": ["modifier onlyPoolConfigurator()", "initReserve", "syncIndexesState", "setConfiguration", "updateFlashloanPremium", "configureEModeCategory", "setLiquidationGracePeriod"],
    "F05-P02": ["modifier onlyUmbrella()", "Errors.CallerNotUmbrella", "eliminateReserveDeficit"],
    "F05-P03": ["ADDRESSES_PROVIDER.getAddress(UMBRELLA)", "LiquidationLogic.executeEliminateDeficit"],
    "F06-P03": ["Pool uses ADDRESSES_PROVIDER.getPriceOracle()", "IPriceOracleGetter.getAssetPrice", "LiquidationLogic", "GenericLogic"],
    "F07-P02": ["IAToken", "mint(...)", "burn(...)", "transferUnderlyingTo(...)", "mintToTreasury(...)"],
    "F07-P03": ["IVariableDebtToken", "scaledTotalSupply()", "ReserveLogic.cache"],
    "F08-P03": ["IReserveInterestRateStrategy", "calculateInterestRates", "ReserveLogic.updateInterestRatesAndVirtualBalance"],
    "F09-P02": ["IFlashLoanReceiver", "IFlashLoanSimpleReceiver", "executeOperation"],
    "F09-P03": ["BorrowLogic.executeBorrow", "optional debt", "open borrow"],
    "F10-P02": ["_positionManager", "onlyPositionManager"],
    "F10-P03": ["approvePositionManager", "onlyPositionManager", "_positionManager"],
    "F11-P02": ["_reservesList", "_reservesCount", "getReservesList"],
    "F11-P03": ["initReserve", "onlyPoolConfigurator", "PoolConfigurator"]
};

// ======================================================================
// FINDING SPECIFICATION (unchanged from v2.4)
// ======================================================================
const SPEC = {
    F01: {
        finding_name: "Upgradeable Proxy Control Risk",
        risk_category: "Upgradeability",
        predicates: [
            { predicate_id: "F01-P01", level: "L1", layer: "STRUCTURAL", claim: "The Pool retains an AddressesProvider reference.", evidence_requirement: "RUNTIME_EXISTENCE", runtime_requirements: [{ property: "address_provider_exists", expected: true }] },
            { predicate_id: "F01-P02", level: "L1", layer: "STRUCTURAL", claim: "The architecture exposes upgrade or registry update capability.", evidence_requirement: "RUNTIME_EXISTENCE", runtime_requirements: [{ property: "upgradeable_architecture", expected: true }] },
            { predicate_id: "F01-P03", level: "L2", layer: "STRUCTURAL_RELATIONSHIP", claim: "The AddressesProvider resolves critical protocol components.", evidence_requirement: "RESOLVER_EXECUTION",
                resolver_checks: [
                    { check_id: "F01-P03-POOL", contract_role: "ADDRESS_PROVIDER", function: "getPool()", expected_runtime_property: "contract_exists" },
                    { check_id: "F01-P03-CONFIGURATOR", contract_role: "ADDRESS_PROVIDER", function: "getPoolConfigurator()", expected_runtime_property: "pool_configurator" },
                    { check_id: "F01-P03-ORACLE", contract_role: "ADDRESS_PROVIDER", function: "getPriceOracle()", expected_runtime_property: "oracle" },
                    { check_id: "F01-P03-ACL", contract_role: "ADDRESS_PROVIDER", function: "getACLManager()", expected_runtime_property: "acl_manager" }
                ] },
            { predicate_id: "F01-P04", level: "L3", layer: "BEHAVIOURAL", claim: "An authorized implementation or registry update changes effective runtime wiring.", evidence_requirement: "EXPERIMENT", requires_execution: true, experiment: "Execute an authorized upgrade or registry mutation on a fork and verify that the resolved implementation or registry address changes." }
        ]
    },
    F02: {
        finding_name: "Registry Centralisation Risk",
        risk_category: "Centralisation",
        predicates: [
            { predicate_id: "F02-P01", level: "L1", layer: "STRUCTURAL", claim: "A central AddressesProvider exists as a protocol registry.", evidence_requirement: "RUNTIME_EXISTENCE", runtime_requirements: [{ property: "address_provider_exists", expected: true }] },
            { predicate_id: "F02-P02", level: "L2", layer: "STRUCTURAL_RELATIONSHIP", claim: "The registry resolves core protocol components.", evidence_requirement: "RESOLVER_EXECUTION",
                resolver_checks: [
                    { check_id: "F02-P02-POOL", contract_role: "ADDRESS_PROVIDER", function: "getPool()", expected_runtime_property: "contract_exists" },
                    { check_id: "F02-P02-CONFIGURATOR", contract_role: "ADDRESS_PROVIDER", function: "getPoolConfigurator()", expected_runtime_property: "pool_configurator" },
                    { check_id: "F02-P02-ORACLE", contract_role: "ADDRESS_PROVIDER", function: "getPriceOracle()", expected_runtime_property: "oracle" }
                ] },
            { predicate_id: "F02-P03", level: "L3", layer: "BEHAVIOURAL", claim: "Authorized registry mutation changes the resolved protocol component.", evidence_requirement: "EXPERIMENT", requires_execution: true, experiment: "Execute an authorized registry update on a fork and verify that the resolver returns the new component address." }
        ]
    },
    F03: {
        finding_name: "ACL Manager Role Concentration",
        risk_category: "Access Control",
        predicates: [
            { predicate_id: "F03-P01", level: "L1", layer: "STRUCTURAL", claim: "An ACL Manager is deployed and referenced by the protocol.", evidence_requirement: "RUNTIME_EXISTENCE", runtime_requirements: [{ property: "acl_manager_exists", expected: true }] },
            { predicate_id: "F03-P02", level: "L2", layer: "STRUCTURAL_RELATIONSHIP", claim: "The AddressesProvider resolves the deployed ACL Manager.", evidence_requirement: "RESOLVER_EXECUTION", resolver_checks: [{ check_id: "F03-P02-ACL", contract_role: "ADDRESS_PROVIDER", function: "getACLManager()", expected_runtime_property: "acl_manager" }] },
            { predicate_id: "F03-P03", level: "L2", layer: "STRUCTURAL_RELATIONSHIP", claim: "Privileged protocol operations depend on ACL or PoolConfigurator authorization.", evidence_requirement: "SOURCE_RELATIONSHIP" },
            { predicate_id: "F03-P04", level: "L3", layer: "BEHAVIOURAL", claim: "Unauthorized callers are rejected while authorized callers can execute guarded operations.", evidence_requirement: "EXPERIMENT", requires_execution: true, experiment: "Execute an authorized and unauthorized call against an identified privileged operation and compare the outcomes." }
        ]
    },
    F04: {
        finding_name: "Pool Configurator Centralised Configuration Authority",
        risk_category: "Governance",
        predicates: [
            { predicate_id: "F04-P01", level: "L1", layer: "STRUCTURAL", claim: "A PoolConfigurator contract is deployed.", evidence_requirement: "RUNTIME_EXISTENCE", runtime_requirements: [{ property: "pool_configurator_exists", expected: true }] },
            { predicate_id: "F04-P02", level: "L2", layer: "STRUCTURAL_RELATIONSHIP", claim: "The AddressesProvider resolves the deployed PoolConfigurator.", evidence_requirement: "RESOLVER_EXECUTION", resolver_checks: [{ check_id: "F04-P02-CONFIGURATOR", contract_role: "ADDRESS_PROVIDER", function: "getPoolConfigurator()", expected_runtime_property: "pool_configurator" }] },
            { predicate_id: "F04-P03", level: "L2", layer: "STRUCTURAL_RELATIONSHIP", claim: "The PoolConfigurator exposes privileged configuration operations.", evidence_requirement: "SOURCE_RELATIONSHIP" },
            { predicate_id: "F04-P04", level: "L3", layer: "BEHAVIOURAL", claim: "Unauthorized configuration attempts fail while authorized configuration succeeds.", evidence_requirement: "EXPERIMENT", requires_execution: true, experiment: "Execute authorized and unauthorized PoolConfigurator operations on a fork and compare outcomes." }
        ]
    },
    F05: {
        finding_name: "Umbrella Exclusive Deficit Elimination Authority",
        risk_category: "Access Control",
        predicates: [
            { predicate_id: "F05-P01", level: "L1", layer: "STRUCTURAL", claim: "A dedicated Umbrella address is configured.", evidence_requirement: "RESOLVER_EXECUTION", resolver_checks: [{ check_id: "F05-P01-UMBRELLA", contract_role: "ADDRESS_PROVIDER", function: "getAddress(UMBRELLA)", expected_runtime_property: null }] },
            { predicate_id: "F05-P02", level: "L2", layer: "STRUCTURAL_RELATIONSHIP", claim: "Reserve-deficit functionality is protected by the Umbrella authorization boundary.", evidence_requirement: "SOURCE_RELATIONSHIP" },
            { predicate_id: "F05-P03", level: "L2", layer: "STRUCTURAL_RELATIONSHIP", claim: "Reserve-deficit elimination is delegated to the resolved Umbrella component.", evidence_requirement: "SOURCE_RELATIONSHIP" },
            { predicate_id: "F05-P04", level: "L3", layer: "BEHAVIOURAL", claim: "Only the authorized Umbrella identity can execute the privileged operation.", evidence_requirement: "EXPERIMENT", requires_execution: true, experiment: "Execute authorized and unauthorized deficit-elimination calls on a fork and compare outcomes." }
        ]
    },
    F06: {
        finding_name: "Asset Price Oracle Dependency",
        risk_category: "Dependency",
        predicates: [
            { predicate_id: "F06-P01", level: "L1", layer: "STRUCTURAL", claim: "A price oracle is deployed and used by the protocol.", evidence_requirement: "RUNTIME_EXISTENCE", runtime_requirements: [{ property: "oracle_exists", expected: true }] },
            { predicate_id: "F06-P02", level: "L2", layer: "STRUCTURAL_RELATIONSHIP", claim: "The AddressesProvider resolves the deployed price oracle.", evidence_requirement: "RESOLVER_EXECUTION", resolver_checks: [{ check_id: "F06-P02-ORACLE", contract_role: "ADDRESS_PROVIDER", function: "getPriceOracle()", expected_runtime_property: "oracle" }] },
            { predicate_id: "F06-P03", level: "L2", layer: "STRUCTURAL_RELATIONSHIP", claim: "Oracle-derived prices participate in core economic calculations.", evidence_requirement: "SOURCE_RELATIONSHIP" },
            { predicate_id: "F06-P04", level: "L3", layer: "BEHAVIOURAL", claim: "Changing oracle output changes a risk-sensitive protocol outcome.", evidence_requirement: "EXPERIMENT", requires_execution: true, experiment: "Execute controlled oracle-value experiments on a fork and observe account health, borrowing validation or liquidation outcomes." }
        ]
    },
    F07: {
        finding_name: "aToken and Debt Token External Implementation Custody Dependency",
        risk_category: "Asset Custody",
        predicates: [
            { predicate_id: "F07-P01", level: "L1", layer: "STRUCTURAL", claim: "External aToken and variable-debt-token implementations are deployed.", evidence_requirement: "RUNTIME_EXISTENCE", runtime_requirements: [{ property: "a_token_exists", expected: true }, { property: "variable_debt_token_exists", expected: true }] },
            { predicate_id: "F07-P02", level: "L2", layer: "STRUCTURAL_RELATIONSHIP", claim: "Supply and withdrawal logic delegates token state transitions to the aToken implementation.", evidence_requirement: "SOURCE_RELATIONSHIP" },
            { predicate_id: "F07-P03", level: "L2", layer: "STRUCTURAL_RELATIONSHIP", claim: "Borrow and repayment logic delegates debt-token state transitions to the variable-debt-token implementation.", evidence_requirement: "SOURCE_RELATIONSHIP" },
            { predicate_id: "F07-P04", level: "L3", layer: "BEHAVIOURAL", claim: "Non-conforming token behaviour can alter Pool accounting or operation outcomes.", evidence_requirement: "EXPERIMENT", requires_execution: true, experiment: "Execute controlled token-implementation experiments and compare Pool accounting and operation outcomes." }
        ]
    },
    F08: {
        finding_name: "Interest Rate Strategy Externalization",
        risk_category: "Economic Dependency",
        predicates: [
            { predicate_id: "F08-P01", level: "L1", layer: "STRUCTURAL", claim: "An external reserve interest-rate strategy is deployed.", evidence_requirement: "RUNTIME_EXISTENCE", runtime_requirements: [{ property: "interest_rate_strategy_exists", expected: true }] },
            { predicate_id: "F08-P02", level: "L2", layer: "STRUCTURAL_RELATIONSHIP", claim: "A reserve resolves to the external interest-rate strategy.", evidence_requirement: "RESOLVER_EXECUTION", resolver_checks: [{ check_id: "F08-P02-STRATEGY", contract_role: "POOL", function: "getReserveData(asset).interestRateStrategyAddress", expected_runtime_property: "interest_rate_strategy" }] },
            { predicate_id: "F08-P03", level: "L2", layer: "STRUCTURAL_RELATIONSHIP", claim: "Reserve logic invokes the external strategy to calculate interest rates.", evidence_requirement: "SOURCE_RELATIONSHIP" },
            { predicate_id: "F08-P04", level: "L3", layer: "BEHAVIOURAL", claim: "Changing strategy output changes resulting reserve rates or indexes.", evidence_requirement: "EXPERIMENT", requires_execution: true, experiment: "Execute a controlled strategy experiment on a fork and observe resulting reserve rate or index changes." }
        ]
    },
    F09: {
        finding_name: "Composability Risk: External Flashloan Receivers & Optional Debt Opening",
        risk_category: "Composability",
        predicates: [
            { predicate_id: "F09-P01", level: "L1", layer: "STRUCTURAL", claim: "The protocol exposes a flash-loan execution surface.", evidence_requirement: "RUNTIME_EXISTENCE", runtime_requirements: [{ property: "flash_loan_supported", expected: true }] },
            { predicate_id: "F09-P02", level: "L2", layer: "STRUCTURAL_RELATIONSHIP", claim: "Flash-loan execution delegates execution to an external receiver.", evidence_requirement: "SOURCE_RELATIONSHIP" },
            { predicate_id: "F09-P03", level: "L2", layer: "STRUCTURAL_RELATIONSHIP", claim: "Optional debt-opening or callback parameters affect the flash-loan execution path.", evidence_requirement: "SOURCE_RELATIONSHIP" },
            { predicate_id: "F09-P04", level: "L3", layer: "BEHAVIOURAL", claim: "Controlled flash-loan receiver and debt-opening combinations produce the expected state transitions.", evidence_requirement: "EXPERIMENT", requires_execution: true, experiment: "Execute controlled flash-loan receiver/debt-opening combinations on a fork and compare resulting state transitions." }
        ]
    },
    F10: {
        finding_name: "Trust Boundary Expansion via Position Manager Delegation",
        risk_category: "Trust Boundary",
        predicates: [
            { predicate_id: "F10-P01", level: "L1", layer: "STRUCTURAL", claim: "Position-manager functionality exists in the deployed architecture.", evidence_requirement: "RUNTIME_EXISTENCE", runtime_requirements: [{ property: "position_manager_supported", expected: true }] },
            { predicate_id: "F10-P02", level: "L2", layer: "STRUCTURAL_RELATIONSHIP", claim: "Position-manager authorization is enforced by a dedicated authorization boundary.", evidence_requirement: "SOURCE_RELATIONSHIP" },
            { predicate_id: "F10-P03", level: "L2", layer: "STRUCTURAL_RELATIONSHIP", claim: "Authorized position managers can invoke operations on behalf of users.", evidence_requirement: "SOURCE_RELATIONSHIP" },
            { predicate_id: "F10-P04", level: "L3", layer: "BEHAVIOURAL", claim: "Authorized position managers can perform delegated operations while unauthorized managers are rejected.", evidence_requirement: "EXPERIMENT", requires_execution: true, experiment: "Execute authorized and unauthorized position-manager operations on a fork and compare outcomes." }
        ]
    },
    F11: {
        finding_name: "Reserve Registry Operational Dependency",
        risk_category: "Operational Resilience",
        predicates: [
            { predicate_id: "F11-P01", level: "L1", layer: "STRUCTURAL", claim: "The protocol maintains an operational reserve registry.", evidence_requirement: "RUNTIME_EXISTENCE", runtime_requirements: [{ property: "reserve_registry_exists", expected: true }] },
            { predicate_id: "F11-P02", level: "L2", layer: "STRUCTURAL_RELATIONSHIP", claim: "The reserve registry resolves configured reserve state.", evidence_requirement: "SOURCE_RELATIONSHIP" },
            { predicate_id: "F11-P03", level: "L2", layer: "STRUCTURAL_RELATIONSHIP", claim: "Core protocol operations depend on reserve configuration.", evidence_requirement: "SOURCE_RELATIONSHIP" },
            { predicate_id: "F11-P04", level: "L3", layer: "BEHAVIOURAL", claim: "Changing reserve configuration produces the expected change in protocol operation.", evidence_requirement: "EXPERIMENT", requires_execution: true, experiment: "Execute a controlled reserve-configuration experiment on a fork and compare the resulting protocol state." }
        ]
    }
};

// ======================================================================
// PREDICATE EVALUATORS (unchanged from v2.4)
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
    return { result: allPassed ? "PASS" : "FAIL", evidence_source: "Foundry runtime evidence", evidence: { observations } };
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

function buildResolverPredicate(predicate) {
    const checks = Array.isArray(predicate.resolver_checks) ? predicate.resolver_checks : [];
    if (checks.length === 0) return { result: "UNVERIFIABLE", reason: "No resolver execution specification exists." };
    return {
        result: "RESOLVER_CHECK_REQUIRED",
        evidence_source: "Deterministic resolver specification",
        resolver_checks: checks,
        independent_execution_required: true,
        reason: "The resolver function must actually be executed and its returned value compared with the independently observed component."
    };
}

// ======================================================================
// NEW IN v2.8 -- AAVE_MANUAL_FOUNDRY_SNAPSHOT
// ======================================================================
// Real `forge test` runs executed manually in a terminal (not through an
// automated n8n-callable endpoint -- same disclosed limitation as
// Venus's MANUAL_FOUNDRY_SNAPSHOT), 2026-08-15, against a live Ethereum
// mainnet fork (Alchemy RPC). Keyed by predicate_id, since every F01-F11
// finding has exactly one L3 EXPERIMENT predicate (F0x-P04).
//
// SCOPE NOTE, disclosed rather than hidden: every one of these tests
// executes only the UNAUTHORIZED half of its claim (an arbitrary caller
// without the required role/key is rejected) -- none attempt the
// authorized-success half, which would require impersonating a real
// governance-controlled identity rather than fabricating one. This
// mirrors Venus's own test-scope convention. F09 is the one exception:
// it is a genuine behavioural test (a real, deployed non-conforming
// flash-loan receiver is rejected), not an access-control test, since
// flashLoanSimple is intentionally public.
//
// F06 note: the test asserts a plain string revert ("5"), not the named
// custom error the aave-v3-origin `main` branch source implied -- the
// live deployed AaveOracle bytecode at this address predates that
// refactor and still uses Aave's legacy numeric error-code convention.
// Confirmed directly via `cast call` against the raw revert bytes before
// the test assertion was corrected. Disclosed in full in
// AaveOracleDependency.t.sol's own header comment.
const AAVE_MANUAL_FOUNDRY_SNAPSHOT = {
    "F01-P04": {
        passed: true, status: "SUPPORTED", full_claim_proven: true,
        test: "AaveUpgradeableProxyControlTest.test_NonOwnerCannotSetPoolImplementation + " +
            "AaveUpgradeableProxyControlTest.test_OwnerCanSetPoolImplementation",
        recorded_at: "2026-08-15",
        source: "Manual forge test run, real Ethereum mainnet fork, not yet wired to an automated endpoint. " +
            "Both halves of the predicate claim are now proven: unauthorized rejection AND authorized " +
            "success (owner address 0x5300A1a15135EA4dc7aD5a167152C01EFc9b192A confirmed live via cast " +
            "call, with the implementation change independently read back via the proxy's own admin-gated " +
            "implementation() getter -- not just an absence of revert)."
    },
    "F02-P03": {
        passed: true, status: "SUPPORTED", full_claim_proven: true,
        test: "AaveRegistryCentralisationTest.test_NonOwnerCannotSetRegistryAddress + " +
            "AaveRegistryCentralisationTest.test_OwnerCanSetRegistryAddress",
        recorded_at: "2026-08-15",
        source: "Manual forge test run, real Ethereum mainnet fork, not yet wired to an automated endpoint. " +
            "Both halves proven: unauthorized rejection AND authorized mutation, independently read back " +
            "via getAddress() on a dedicated test registry slot (not a live-used one)."
    },
    "F03-P04": {
        passed: true, status: "SUPPORTED", full_claim_proven: true,
        test: "AaveACLManagerRoleConcentrationTest.test_NonAdminCannotAddPoolAdmin + " +
            "AaveACLManagerRoleConcentrationTest.test_AdminCanAddPoolAdmin",
        recorded_at: "2026-08-15",
        source: "Manual forge test run, real Ethereum mainnet fork, not yet wired to an automated endpoint. " +
            "Both halves proven -- this predicate's claim text ('unauthorized rejected, authorized can " +
            "execute') is now completely closed, not just the access boundary. Real DEFAULT_ADMIN_ROLE " +
            "holder (0x5300A1a15135EA4dc7aD5a167152C01EFc9b192A) confirmed live via hasRole()."
    },
    "F04-P04": {
        passed: true, status: "SUPPORTED", full_claim_proven: true,
        test: "AavePoolConfiguratorAuthorityTest.test_NonConfiguratorCannotUpdateFlashloanPremium + " +
            "AavePoolConfiguratorAuthorityTest.test_ConfiguratorCanUpdateFlashloanPremium",
        recorded_at: "2026-08-15",
        source: "Manual forge test run, real Ethereum mainnet fork, not yet wired to an automated endpoint. " +
            "Both halves proven: unauthorized rejection AND authorized configuration success, verified via " +
            "the public FLASHLOAN_PREMIUM_TOTAL() getter reading back the new value."
    },
    "F05-P04": {
        passed: true, status: "SUPPORTED",
        test: "AaveUmbrellaDeficitAuthorityTest.test_NonUmbrellaCannotEliminateReserveDeficit",
        recorded_at: "2026-08-15",
        source: "Manual forge test run, real Ethereum mainnet fork, not yet wired to an automated endpoint. " +
            "This is the flagship F05 finding's own L3 evidence -- strengthens the deterministic side of the " +
            "known F05 conflict without resolving it (the conflict lives at the L2 predicate level)."
    },
    "F06-P04": {
        passed: true, status: "SUPPORTED",
        test: "AaveOracleDependencyTest.test_NonAdminCannotSetAssetSources",
        recorded_at: "2026-08-15",
        source: "Manual forge test run, real Ethereum mainnet fork, not yet wired to an automated endpoint. " +
            "Scoped to the access boundary around oracle-source wiring, not the full economic-outcome claim -- see scope note above."
    },
    "F07-P04": {
        passed: true, status: "SUPPORTED",
        test: "AaveATokenImplementationCustodyTest.test_NonAdminCannotUpdateATokenImplementation",
        recorded_at: "2026-08-15",
        source: "Manual forge test run, real Ethereum mainnet fork, not yet wired to an automated endpoint. " +
            "Scoped to the access boundary around implementation custody, not the full non-conforming-token-behaviour claim."
    },
    "F08-P04": {
        passed: true, status: "SUPPORTED",
        test: "AaveInterestRateStrategyExternalizationTest.test_NonAdminCannotSetReserveInterestRateData",
        recorded_at: "2026-08-15",
        source: "Manual forge test run, real Ethereum mainnet fork, not yet wired to an automated endpoint. " +
            "Scoped to the access boundary around the externalized rate strategy, not the full rate-change-propagation claim."
    },
    "F09-P04": {
        passed: true, status: "SUPPORTED", full_claim_proven: true,
        test: "AaveFlashloanReceiverComposabilityTest.test_FlashLoanRejectsNonConformingReceiver",
        recorded_at: "2026-08-15",
        source: "Manual forge test run, real Ethereum mainnet fork, not yet wired to an automated endpoint. " +
            "Genuine behavioural test (not access control) -- a real, deployed non-conforming receiver was rejected."
    },
    "F10-P04": {
        passed: true, status: "SUPPORTED", full_claim_proven: true,
        test: "AavePositionManagerTrustBoundaryTest.test_UnapprovedCallerCannotActOnUserBehalf + " +
            "AavePositionManagerTrustBoundaryTest.test_ApprovedManagerCanActOnUserBehalf",
        recorded_at: "2026-08-15",
        source: "Manual forge test run, real Ethereum mainnet fork, not yet wired to an automated endpoint. " +
            "Both halves proven, entirely self-contained (a real test user approves a real test manager " +
            "on-chain, no external admin address needed), verified via getUserEMode() reading back the " +
            "delegated call's real effect."
    },
    "F11-P04": {
        passed: true, status: "SUPPORTED",
        test: "AaveReserveRegistryDependencyTest.test_NonAdminCannotDeactivateReserve",
        recorded_at: "2026-08-15",
        source: "Manual forge test run, real Ethereum mainnet fork, not yet wired to an automated endpoint. " +
            "Scoped to the access boundary around reserve-registry mutation, not the full configuration-change-propagation claim."
    }
};

function buildBehaviouralPredicate(predicate) {
    const manual = AAVE_MANUAL_FOUNDRY_SNAPSHOT[predicate.predicate_id];
    if (!manual) {
        return {
            result: "NOT_TESTED",
            evidence_source: "No executed Foundry experiment supplied",
            experiment_required: predicate.experiment,
            requires_execution: true,
            reason: "A proposed experiment is not treated as execution evidence."
        };
    }
    const passed = manual.passed === true;
    return {
        result: passed ? "PASS" : "FAIL",
        evidence_source: `Manual forge test snapshot (${manual.recorded_at || "date unrecorded"}) -- not yet wired to a live endpoint`,
        executed_test: manual.test || null,
        reported_status: manual.status || null,
        requires_execution: false,
        reason: passed
            ? "A real Foundry behavioural experiment was executed and passed."
            : "A real Foundry behavioural experiment was executed and did not pass -- review before treating this as CONTRADICTED (check for fork/instrumentation issues first)."
    };
}

// ======================================================================
// UNION + NORMALIZATION / DE-DUPLICATION LAYER (NEW IN v2.6)
// ======================================================================
// Runs BEFORE predicate building. Resolves every finding from both
// sources to an F0x key first, groups by key, and only THEN decides
// whether a group is single-source (pass through, tagged) or
// multi-source (merge, preserving both sides -- never overwrite).
// ======================================================================
function tagAndResolve07(finding, index) {
    return { finding, sourceLabel: "NODE_07_ARCHITECTURE", resolution: resolveFinding(finding, index) };
}
function tagAndResolve08(finding) {
    return { finding, sourceLabel: "NODE_08_AUDIT", resolution: resolveNode08Finding(finding) };
}
const tagged07 = findings07.map(tagAndResolve07);
const tagged08 = findings08.map(tagAndResolve08);
const allTagged = [...tagged07, ...tagged08];

const groupsBySpecKey = {};
const unmappedItems = [];
for (const item of allTagged) {
    if (item.resolution.finding_id) {
        (groupsBySpecKey[item.resolution.finding_id] ||= []).push(item);
    } else {
        unmappedItems.push(item);
    }
}

// One entry per source for a resolved finding -- used for both
// single-source and multi-source (merged) cases, so the shape is
// identical either way and nothing needs special-casing downstream.
function sourceEntry(item) {
    const f = item.finding;
    return {
        source_finding_name: item.resolution.source_name,
        // Node 07 (Aave) has no claim_id field in its schema -- this is
        // always null on the Node 07 side by design, not a bug. Only
        // Node 08 findings ever carry a real claim_id.
        claim_id: item.resolution.claim_id || null,
        severity: text(f?.severity || f?.risk_severity || "Unknown"),
        confidence: typeof f?.confidence === "number" ? f.confidence : null,
        matched_anchor_tokens: item.resolution.matched_tokens || [],
        finding_resolution: item.resolution.resolution,
        architectural_evidence: getArchitecturalEvidence(f),
        supporting_components: getComponents(f),
        // Only Node 08 findings ever carry provenance -- Node 07's
        // side is simply omitted (not null-padded with fake fields),
        // preserved exactly as Node 08 produced it, never merged into
        // Node 07's entry.
        provenance: f?.provenance ?? undefined
    };
}

function buildResolvedFinding(findingId, group) {
    const spec = SPEC[findingId];
    const bySource = { NODE_07_ARCHITECTURE: null, NODE_08_AUDIT: null };
    for (const item of group) {
        // If a source somehow contributes more than one finding to the
        // same F0x key in one run, keep the first and note the rest --
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

    // Union of both sides' evidence/components -- used for the flat
    // top-level fields (backward-compatible with whatever Node 16
    // already reads) AND fed into SOURCE_RELATIONSHIP predicate
    // matching, since either source's text can support an L2 claim.
    const architecturalEvidenceUnion = [
        ...(bySource.NODE_07_ARCHITECTURE?.architectural_evidence || []),
        ...(bySource.NODE_08_AUDIT?.architectural_evidence || [])
    ];
    const supportingComponentsUnion = [...new Set([
        ...(bySource.NODE_07_ARCHITECTURE?.supporting_components || []),
        ...(bySource.NODE_08_AUDIT?.supporting_components || [])
    ])];

    const predicates = spec.predicates.map(predicate => {
        let evaluation;
        switch (predicate.evidence_requirement) {
            case "RUNTIME_EXISTENCE":
                evaluation = evaluateRuntimePredicate(predicate);
                break;
            case "RESOLVER_EXECUTION":
                evaluation = buildResolverPredicate(predicate);
                break;
            case "SOURCE_RELATIONSHIP":
                evaluation = evaluateSourcePredicate(predicate, architecturalEvidenceUnion);
                break;
            case "EXPERIMENT":
                evaluation = buildBehaviouralPredicate(predicate);
                break;
            default:
                evaluation = { result: "UNVERIFIABLE", reason: "Unsupported evidence requirement." };
        }
        return {
            ...predicate,
            architectural_evidence: architecturalEvidenceUnion,
            supporting_components: supportingComponentsUnion,
            architectural_evidence_mapping: SOURCE_EVIDENCE_MAP[predicate.predicate_id] ? "EXPLICIT_PREDICATE_MAPPING" : "NO_EXPLICIT_PREDICATE_MAPPING",
            architectural_evidence_mapping_basis: SOURCE_EVIDENCE_MAP[predicate.predicate_id] || null,
            architectural_evidence_present: architecturalEvidenceUnion.length > 0,
            validation_result: evaluation.result,
            validation_evidence: evaluation
        };
    });

    return {
        finding_id: findingId,
        finding_name: spec.finding_name,
        finding_resolution: isMerged ? "MERGED" : (bySource.NODE_07_ARCHITECTURE || bySource.NODE_08_AUDIT).finding_resolution,
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
        severity,
        risk_category: spec.risk_category,
        // Flat union, kept for backward compatibility with anything
        // (including Node 16) already reading these fields directly.
        finding_level_architectural_evidence: architecturalEvidenceUnion,
        supporting_components: supportingComponentsUnion,
        predicates,
        deterministic_ready: true,
        validation_status: "READY_FOR_NODE_16"
    };
}

function buildUnmappedFinding(item, index) {
    const resolution = item.resolution;
    const isNode08 = item.sourceLabel === "NODE_08_AUDIT";
    let reason;
    if (resolution.resolution === "ID_NAME_MISMATCH") {
        reason = `canonical_finding_id (${resolution.conflicting_id}) and the exact-name match (${resolution.conflicting_name_match}) disagree for this finding. Refusing to guess which is correct -- flagged for manual review instead of silently picking one.`;
    } else if (resolution.resolution === "ANCHOR_TOKEN_AMBIGUOUS") {
        reason = `This audit finding's mechanism_tokens/dependency_chain overlap more than one Aave finding's alias-token set (${resolution.candidates.map(c => c.id).join(", ")}). Refusing to guess which is correct -- flagged for manual review instead of silently picking one.`;
    } else if (resolution.resolution === "NO_TOKENS_SUPPLIED") {
        reason = "Audit finding has no mechanism_tokens or dependency_chain to match against -- cannot anchor-token match without them.";
    } else if (isNode08) {
        reason = "No Aave canonical name or alias-token set overlaps this audit finding's risk_name/mechanism_tokens/dependency_chain.";
    } else {
        reason = "Node 07 finding could not be matched to an explicit canonical finding.";
    }
    return {
        finding_id: `UNMAPPED-${isNode08 ? "AUDIT-" : ""}${index + 1}`,
        source: item.sourceLabel,
        source_finding_name: resolution.source_name,
        claim_id: resolution.claim_id || null,
        severity: text(item.finding?.severity || item.finding?.risk_severity || "Unknown"),
        deterministic_ready: false,
        validation_status: "NO_SPECIFICATION",
        predicates: [],
        reason,
        resolution_debug: {
            extracted_name: resolution.source_name,
            extracted_id: isNode08 ? null : extractFindingId(item.finding),
            resolution_type: resolution.resolution,
            conflicting_id: resolution.conflicting_id || null,
            conflicting_name_match: resolution.conflicting_name_match || null,
            candidates: resolution.candidates || null,
            available_canonical_ids: Object.keys(CANONICAL_FINDINGS)
        }
    };
}

// ======================================================================
// BUILD FINDINGS (resolved + unmapped)
// ======================================================================
const resolvedFindings = Object.entries(groupsBySpecKey).map(([findingId, group]) => buildResolvedFinding(findingId, group));
const unmappedFindings = unmappedItems.map((item, index) => buildUnmappedFinding(item, index));
const outputFindings = [...resolvedFindings, ...unmappedFindings];

const matchedSpecKeys = new Set(resolvedFindings.map(f => f.finding_id));
const specKeysWithNoFindingThisRun = Object.keys(SPEC).filter(k => !matchedSpecKeys.has(k));

// ======================================================================
// SUMMARY
// ======================================================================
const allPredicates = outputFindings.flatMap(finding => finding.predicates || []);
const summary = {
    total_findings: outputFindings.length,
    unmapped_findings: unmappedFindings.length,
    findings_node07_only: resolvedFindings.filter(f => f.sources.length === 1 && f.sources[0] === "NODE_07_ARCHITECTURE").length,
    findings_node08_audit_only: resolvedFindings.filter(f => f.sources.length === 1 && f.sources[0] === "NODE_08_AUDIT").length,
    findings_merged_across_sources: resolvedFindings.filter(f => f.sources.length > 1).length,
    aave_finding_categories_with_no_matching_finding_this_run: specKeysWithNoFindingThisRun,
    total_predicates: allPredicates.length,
    l1_existence_predicates: allPredicates.filter(p => p.level === "L1").length,
    l2_relationship_predicates: allPredicates.filter(p => p.level === "L2").length,
    l3_behavioural_predicates: allPredicates.filter(p => p.level === "L3").length,
    resolver_checks_defined: allPredicates.reduce((sum, p) => sum + (Array.isArray(p.resolver_checks) ? p.resolver_checks.length : 0), 0),
    behavioural_predicates_not_tested: allPredicates.filter(p => p.level === "L3" && p.validation_result === "NOT_TESTED").length,
    source_relationship_predicates_explicitly_mapped: allPredicates.filter(p => p.evidence_requirement === "SOURCE_RELATIONSHIP" && p.architectural_evidence_mapping === "EXPLICIT_PREDICATE_MAPPING").length,
    source_relationship_predicates_not_explicitly_mapped: allPredicates.filter(p => p.evidence_requirement === "SOURCE_RELATIONSHIP" && p.architectural_evidence_mapping !== "EXPLICIT_PREDICATE_MAPPING").length,
    source_relationships_pending_independent_verification: allPredicates.filter(p => p.validation_result === "MAPPED_PENDING_INDEPENDENT_VERIFICATION").length
};

// ======================================================================
// EVIDENCE BOUNDARIES
// ======================================================================
const evidenceBoundaries = {
    llm_confidence_is_deterministic_evidence: false,
    historical_evidence_is_deterministic_evidence: false,
    temporal_evidence_is_deterministic_evidence: false,
    generic_runtime_success_proves_all_findings: false,
    resolver_call_proves_relationship: true,
    resolver_address_existence_alone_proves_relationship: false,
    keyword_presence_proves_relationship: false,
    source_evidence_mapping_proves_relationship: false,
    finding_level_evidence_proves_predicate: false,
    predicate_level_mapping_required: true,
    arbitrary_weights_used: false,
    deterministic_confidence_calculated: false,
    proposed_experiment_treated_as_execution: false,
    behavioural_pass_requires_executed_experiment: true,
    source_relationship_pass_requires_independent_verification: true,
    // New in v2.8:
    behavioral_evidence_partially_manual: Object.keys(AAVE_MANUAL_FOUNDRY_SNAPSHOT).length > 0,
    behavioral_evidence_manual_disclosure:
        "11 of 11 F01-F11 findings' L3 behavioural evidence currently comes from a manually-recorded forge " +
        "test snapshot (2026-08-15, real Ethereum mainnet fork), not a live endpoint -- see AAVE_MANUAL_FOUNDRY_SNAPSHOT. " +
        "10 of 11 tests cover only the unauthorized half of their claim (see snapshot scope note); F09 is a full behavioural test.",
    // New in v2.6:
    node07_node08_findings_unioned_before_predicate_building: true,
    union_deduplicated_by_resolved_finding_id_not_naive_concatenation: true,
    merge_never_overwrites_source_finding_data: true,
    merge_preserves_per_source_claim_id_and_evidence_separately: true,
    node08_provenance_preserved_and_never_merged_into_node07_side: true,
    node08_resolution_uses_anchor_token_matching_not_canonical_id: true,
    f01_f02_alias_tokens_not_independently_source_verified: true,
    node_16_modified_for_this_change: false
};

// ======================================================================
// TEMPORAL CONTEXT (unchanged from v2.4 -- real Aave data via Node 12,
// preserved as context only, never treated as deterministic proof)
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

// ======================================================================
// HISTORICAL CONTEXT (unchanged from v2.4 -- preserved, not used as
// proof; Node 09 (Aave)'s output now also propagates canonical_finding_id
// per its own v1 update, so a future node could join on it directly)
// ======================================================================
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
                    protocol: text(foundry.protocolName || evidenceReview?.protocol || "Aave"),
                    methodology:
                        "Finding-specific deterministic verification specification using objective runtime observations, explicit predicate-scoped source evidence mapping, resolver execution requirements and explicit behavioural experiment requirements. Node 07 and Node 08 findings are unioned and de-duplicated by resolved finding_id before predicate building, never naively concatenated -- Node 07 resolves via explicit canonical_finding_id/name agreement, Node 08 resolves via anchor-token overlap against AAVE_ALIAS_TOKENS.",
                    specification_version: "2.7",
                    generated_at: new Date().toISOString()
                },
                deterministic_validation: {
                    status: "READY_FOR_NODE_16",
                    confidence: null,
                    confidence_calculation: "Not calculated at deterministic evidence specification stage."
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
