/***********************************************************************
 * NODE 16 — DETERMINISTIC EVIDENCE ANCHOR
 * VERSION 6.1
 *
 * CHANGELOG v6.0 -> v6.1 (metadata-only, no evaluation-logic change):
 *   Added passthrough of five fields Node 13 (Aave) v2.6 started
 *   emitting per finding: finding_resolution, sources, source_findings,
 *   claim_ids_by_source, claim_ids_agree. v2.6 unions Node 07
 *   (architecture) and Node 08 (audit/incident) findings before handing
 *   them to Node 16, and these fields are how a finding's provenance
 *   (which source(s) contributed it, whether their claim_ids agree) is
 *   recorded. v6.0 read finding_id, finding_name and risk_pattern/
 *   risk_category off the same Node 13 finding object but dropped
 *   these five newer fields on the floor. v6.1 reads them through
 *   unchanged and adds them to each finding in the final output. None
 *   of them are read, matched, compared, or branched on anywhere in
 *   this file -- they do not participate in proposition assessment, K3
 *   aggregation, finding-status classification, or self-verification.
 *   They exist purely so a downstream node (e.g. a claim-level tracker,
 *   the same role Venus's claim_id passthrough serves) has provenance
 *   to join against, without Node 16 itself knowing or caring that such
 *   a node exists. This is the same fix, for the same reason, that
 *   Node 16 (Venus) v1.0 -> v1.1 already made for claim_id -- see
 *   16_deterministic_evidence_anchor_venus.js and
 *   NODE16_CLAIM_ID_BEFORE_AFTER.md for that precedent.
 *
 * PURPOSE
 * -------
 * Map the FIXED propositions supplied by Node 13 against the ACTUAL
 * evidence produced by the upstream evidence branches (Foundry runtime
 * validation, Architecture reconstruction). Node 16 answers exactly one
 * question, and only that question:
 *
 *     "What does the available evidence actually establish?"
 *
 * Node 16 DOES NOT:
 *   - create new predicates or propositions
 *   - assign probability, confidence, or a risk score
 *   - perform Dempster-Shafer / belief fusion
 *   - combine with LLM output
 *   - infer missing evidence
 *   - treat missing evidence as contradiction (open-world assumption)
 *   - infer behavioural (runtime) truth from architectural narrative
 *
 * ----------------------------------------------------------------------
 * FORMAL MODEL
 * ----------------------------------------------------------------------
 *
 * Truth space.
 *   Every observation, proposition and finding is classified into the
 *   three-valued space
 *
 *       Sigma = { SUPPORTED, CONTRADICTED, UNRESOLVED }
 *
 *   which is Kleene's strong three-valued logic K3, with SUPPORTED = T,
 *   CONTRADICTED = F, UNRESOLVED = the third ("unknown") value. This is
 *   the standard formal model for reasoning under incomplete
 *   information: it is exactly the logic obtained by requiring that (a)
 *   absence of evidence is never treated as evidence of absence, and
 *   (b) a single explicit contradiction is never allowed to be masked
 *   by unrelated supporting facts.
 *
 * Observation-level aggregation (the AND-combinator).
 *   A proposition may be backed by more than one atomic observation
 *   (multiple runtime properties, multiple resolver checks). These are
 *   combined with the Kleene K3 conjunction, implemented once as
 *   combineObservations() and reused by every evidence branch instead
 *   of being re-implemented per branch:
 *
 *       CONTRADICTED  if any observation is CONTRADICTED   (F dominates)
 *       SUPPORTED     if every observation is SUPPORTED    (unanimity)
 *       UNRESOLVED    otherwise                            (unknown)
 *
 *   This combinator is commutative and associative, and its result is
 *   independent of observation order -- it is defined purely from the
 *   multiset of per-observation statuses, not from the sequence in
 *   which they were produced. A single CONTRADICTED observation can
 *   never be out-voted by any number of SUPPORTED observations.
 *
 * Proposition-level status.
 *   Exactly one evidence source is PRIMARY per proposition, determined
 *   solely by proposition.evidence_requirement (fixed by Node 13, never
 *   by Node 16):
 *
 *       SOURCE_RELATIONSHIP  -> Architecture is PRIMARY
 *       RUNTIME_EXISTENCE    -> Foundry (runtime properties) is PRIMARY
 *       RESOLVER_EXECUTION   -> Foundry (resolver checks) is PRIMARY
 *       EXPERIMENT           -> Foundry (behavioural experiment) is PRIMARY
 *
 *   All other sources (Historical, Temporal, and Architecture whenever
 *   it is not the primary source) are CONTEXTUAL: retained verbatim in
 *   source_assessments for downstream fusion, but structurally
 *   incapable of influencing proposition.status or entering the
 *   deterministic observation ledger. This is enforced by a single
 *   filter (role === "CONTEXTUAL") rather than by per-branch judgment
 *   calls, so it cannot silently regress per source.
 *
 * Finding-level status.
 *   A finding's status is a pure function of the multiset of its
 *   propositions' statuses -- specifically of the triple
 *   (supported_count, contradicted_count, total_count) -- and is
 *   therefore also order-independent:
 *
 *       CONTRADICTED                    contradicted == total
 *       FULLY_SUPPORTED                 supported == total
 *       MIXED_SUPPORT_AND_CONTRADICTION supported > 0 AND contradicted > 0
 *       PARTIALLY_SUPPORTED             supported > 0, contradicted == 0
 *       PARTIALLY_CONTRADICTED          contradicted > 0, supported == 0
 *       UNRESOLVED                      otherwise (supported == contradicted == 0)
 *
 *   These six outcomes are mutually exclusive and jointly exhaustive
 *   over all possible (supported, contradicted, total) triples with
 *   0 <= supported + contradicted <= total -- i.e. classifyFindingStatus
 *   is a total function, not a partial one with a silent fallthrough.
 *
 * Invariants Node 16 enforces on itself at runtime (not merely
 * documented, but checked -- see "SELF-VERIFICATION" below):
 *
 *   I1  Determinism.       Pure function of its inputs. No randomness,
 *                          no LLM calls, no wall-clock-dependent branch.
 *   I2  Monotonicity.      Adding a CONTRADICTED observation to a
 *                          proposition can never change its status to
 *                          SUPPORTED; adding a SUPPORTED observation can
 *                          never change a CONTRADICTED status.
 *   I3  Open-world.        NOT_OBSERVED / no-record states resolve to
 *                          UNRESOLVED, never CONTRADICTED. Silence is
 *                          not falsification.
 *   I4  Non-fabrication.   The finding set Node 16 evaluates is exactly
 *                          Node 13's finding set -- a strict bijection
 *                          against the canonical 11 IDs, not merely a
 *                          covering. Both a missing ID and a duplicated
 *                          ID are hard failures (see COVERAGE
 *                          VALIDATION); Node 16 never invents or drops
 *                          a finding to make the count come out right.
 *   I5  Evidence locality. A proposition can only be established by
 *                          evidence that was mapped to THAT proposition
 *                          specifically. Finding-level evidence that
 *                          was not mapped to a given proposition cannot
 *                          rescue that proposition (see "ARCHITECTURE
 *                          EVIDENCE", v6.0 fix D below).
 *
 * ----------------------------------------------------------------------
 * CHANGELOG: v5.3 -> v6.0
 * ----------------------------------------------------------------------
 *
 * (A) Extracted the duplicated SUPPORTED/CONTRADICTED/UNRESOLVED
 *     aggregation logic out of assessResolver() and
 *     assessRuntimeExistence() into one shared combineObservations()
 *     function. In v5.3 the same three-line rule was hand-copied into
 *     both places; if one copy were ever edited without the other, the
 *     two evidence branches would silently start using two different
 *     definitions of "supported". There is now exactly one
 *     implementation of the aggregation rule.
 *
 * (B) FIXED: duplicate_finding_ids was structurally incapable of ever
 *     detecting a duplicate. It filtered `receivedFindingIds`, but
 *     that array is itself already the output of `[...new Set(...)]`
 *     a few lines above -- by construction every element of a
 *     deduplicated array is unique, so
 *     `receivedFindingIds.indexOf(id) !== index` can never be true for
 *     any element. The check always returned []. It is now computed
 *     from the raw (pre-dedup) finding-id list, where duplicates are
 *     actually observable.
 *
 * (C) FIXED (consequence of B): because duplicate detection was dead,
 *     a Node 13 payload containing, say, two "F01" blocks and no "F11"
 *     block (11 raw entries, but only 10 distinct IDs, one of them
 *     doubled) was NOT guaranteed to hard-fail in every code path --
 *     depending on exact counts it could reach `qa.all_11_findings_present:
 *     false` as a soft flag rather than a thrown error, and worse, a
 *     12-raw-entry payload with one legitimate duplicate (all 11 IDs
 *     present, one of them twice) would silently produce a 12-finding
 *     output. REQUIRE_ALL_FINDINGS now enforces a strict bijection: the
 *     raw finding count, the unique finding count, and 11 must all be
 *     equal, or Node 16 throws. Missing findings and duplicated
 *     findings are now symmetric hard failures, not one hard and one
 *     soft.
 *
 * (D) FIXED (the most consequential logic change): architectureEvidence()
 *     used to fall back to the FINDING-level architectural_evidence list
 *     whenever the PROPOSITION-level list was empty. Node 13 v2.4
 *     performs explicit, precise, per-predicate term-matching to build
 *     each SOURCE_RELATIONSHIP proposition's architectural_evidence, and
 *     when that matching finds nothing it deliberately leaves the array
 *     empty and reports the predicate as UNVERIFIABLE. The v5.3 fallback
 *     then reached past that honest "no match" signal, grabbed the
 *     finding's broad, un-matched evidence list instead, and reported
 *     the proposition SUPPORTED anyway -- silently overturning Node 13's
 *     own explicit UNVERIFIABLE determination. That is precisely the
 *     "silently trust a weak signal" failure mode the rest of this
 *     pipeline was built to avoid. The fallback is removed: a
 *     proposition is only ever established by evidence that was mapped
 *     to it specifically (Invariant I5). (See getArchitectureFinding():
 *     it is retained, but only for the CONTEXTUAL/no-evidence
 *     explanatory path, never as a substitute source of PRIMARY
 *     evidence.)
 *
 * (E) ADDED: conflicting-signal detection in assessResolver(). v5.3
 *     checked `matched` before `explicitFailure`, so a Foundry record
 *     that (due to an upstream bug) reported both matched: true and
 *     passed: false simultaneously would silently resolve to SUPPORTED
 *     with the contradiction signal discarded, no matter how
 *     confidently that failure field said otherwise. Such a record is
 *     now detected explicitly and returned as ERROR / UNRESOLVED with
 *     the conflict named in `reason`, rather than picking a winner.
 *
 * (F) ADDED: boolean-like value normalisation in assessRuntimeExistence().
 *     A boolean `expected` compared against "true"/"false" (string) or
 *     1/0 (number) previously fell through strict `===` and the
 *     boolean-typeof guard alike, landing on UNRESOLVED even though the
 *     value is unambiguous. Coercion is applied ONLY when `expected` is
 *     a genuine boolean, so it cannot mask a real type mismatch on
 *     non-boolean properties.
 *
 * (G) ADDED: a lightweight self-verification pass (SELF-VERIFICATION,
 *     near the bottom) that checks I2-I5 against the actual computed
 *     output before Node 16 returns, and throws if any invariant is
 *     violated. This turns the invariants above from documentation
 *     into an executable proof obligation that runs on every real
 *     execution, not just in a test harness.
 *
 ***********************************************************************/
// ======================================================================
// CONFIGURATION
// ======================================================================
//
// FINAL THESIS PIPELINE:  true   -- Node 13 must supply exactly F01-F11.
// TEMPORARY SINGLE-FINDING TEST: false
//
// Node 16 never creates missing findings itself, in either mode.
// ======================================================================
const REQUIRE_ALL_FINDINGS = true;
const EXPECTED_FINDING_IDS = [
    "F01", "F02", "F03", "F04", "F05", "F06",
    "F07", "F08", "F09", "F10", "F11"
];
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
const node13 =
    getNodeJSON("13_Deterministic_Evidence_Specification") ||
    $input.first().json;
const foundry =
    getNodeJSON("10_Foundry_Validation") || {};
const architecture =
    getNodeJSON("07_AI_Risk_Reasoner") || {};
const historical =
    getNodeJSON("09_AI_Historical_Exploit_Reasoner") || {};
const temporal =
    getNodeJSON("12_Temporal_Evidence_Engine") || {};
// ======================================================================
// GENERIC HELPERS
// ======================================================================
function str(value) {
    return value == null ? "" : String(value);
}
function norm(value) {
    return str(value)
        .toLowerCase()
        .replace(/[–—]/g, "-")
        .replace(/\s+/g, " ")
        .trim();
}
function normFunction(value) {
    return str(value)
        .toLowerCase()
        .trim()
        .replace(/\(\)\([^)]*\)$/, "()")
        .replace(/\s+/g, "");
}
function isObject(value) {
    return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
    );
}
function clone(value) {
    return JSON.parse(JSON.stringify(value));
}
function findingId(value) {
    const match = str(value).match(/F(\d{2})/i);
    return match ? `F${match[1]}` : "";
}
// ======================================================================
// FINDING NAMES (fallback labels only; never used for identity)
// ======================================================================
const FINDING_NAMES = {
    F01: "Upgradeable Proxy Control Risk",
    F02: "Registry Centralisation Risk",
    F03: "ACL Manager Role Concentration",
    F04: "Pool Configurator Centralised Configuration Authority",
    F05: "Umbrella / Backstop Authority Concentration",
    F06: "Asset Price Oracle Dependency",
    F07: "Token Implementation Dependency Risk",
    F08: "Interest Rate Strategy Dependency Risk",
    F09: "Flashloan Composability Risk",
    F10: "Position Manager Trust Boundary",
    F11: "Reserve Registry Dependency Risk"
};
// ======================================================================
// NORMALISE PROPOSITION ID
// ======================================================================
function normalisePropositionId(value, fid) {
    const raw = str(value).trim();
    if (/^F\d{2}-P\d+$/i.test(raw)) {
        return raw.toUpperCase();
    }
    const match = raw.match(/^P(\d+)$/i);
    if (match) {
        return `${fid}-P` + String(Number(match[1])).padStart(2, "0");
    }
    return raw || `${fid}-PUNKNOWN`;
}
// ======================================================================
// NODE 13 — EXTRACT FIXED FINDINGS
// ======================================================================
//
// Node 13 is the ONLY source of propositions. Node 16 does not
// manufacture missing propositions or findings.
// ======================================================================
function extractNode13Findings(root) {
    const candidates = [
        root?.deterministic_evidence?.findings,
        root?.findings,
        root?.specification?.findings,
        root?.deterministic_specification?.findings,
        root?.output?.findings,
        root?.output?.specification?.findings
    ];
    let raw = null;
    for (const candidate of candidates) {
        if (Array.isArray(candidate) && candidate.length) {
            raw = candidate;
            break;
        }
        if (isObject(candidate) && Object.keys(candidate).length) {
            raw = Object.entries(candidate).map(([id, value]) => ({
                finding_id: id,
                ...value
            }));
            break;
        }
    }
    if (!raw) {
        return [];
    }
    return raw
        .map(finding => {
            const fid = findingId(
                finding.finding_id ||
                finding.findingId ||
                finding.id
            );
            if (!fid) {
                return null;
            }
            const records =
                Array.isArray(finding.propositions)
                    ? finding.propositions
                    : Array.isArray(finding.predicates)
                        ? finding.predicates
                        : [];
            return {
                finding_id: fid,
                finding_name:
                    finding.finding_name ||
                    finding.name ||
                    FINDING_NAMES[fid] ||
                    fid,
                risk_pattern:
                    finding.risk_pattern ||
                    finding.risk_category ||
                    null,
                // v6.1: metadata-only passthrough of Node 13 (Aave)
                // v2.6's union/provenance fields. Not read anywhere
                // else in this file -- see header changelog.
                finding_resolution:
                    finding.finding_resolution ?? null,
                sources:
                    Array.isArray(finding.sources)
                        ? finding.sources
                        : [],
                source_findings:
                    isObject(finding.source_findings)
                        ? finding.source_findings
                        : null,
                claim_ids_by_source:
                    isObject(finding.claim_ids_by_source)
                        ? finding.claim_ids_by_source
                        : null,
                claim_ids_agree:
                    typeof finding.claim_ids_agree === "boolean"
                        ? finding.claim_ids_agree
                        : null,
                propositions: records.map((p, index) => ({
                    proposition_id: normalisePropositionId(
                        p.proposition_id ||
                        p.predicate_id ||
                        p.id ||
                        `${fid}-P${String(index + 1).padStart(2, "0")}`,
                        fid
                    ),
                    proposition:
                        p.proposition || p.claim || p.text || "",
                    evidence_requirement: norm(
                        p.evidence_requirement ||
                        p.required_evidence ||
                        p.evidence_type
                    ).toUpperCase(),
                    runtime_requirements:
                        Array.isArray(p.runtime_requirements)
                            ? p.runtime_requirements
                            : p.runtime_property
                                ? [{ property: p.runtime_property, expected: true }]
                                : [],
                    resolver_checks:
                        Array.isArray(p.resolver_checks)
                            ? p.resolver_checks
                            : [],
                    experiment:
                        p.experiment || null,
                    // v6.0: this array is the ONLY architecture evidence
                    // that may establish a SOURCE_RELATIONSHIP
                    // proposition. See architectureEvidence() (fix D).
                    architectural_evidence:
                        Array.isArray(p.architectural_evidence)
                            ? p.architectural_evidence
                            : []
                }))
            };
        })
        .filter(Boolean);
}
const fixedFindings = extractNode13Findings(node13);
// ======================================================================
// FINDING COVERAGE VALIDATION  (Invariant I4 — strict bijection)
// ======================================================================
//
// Node 16 requires the multiset of finding IDs supplied by Node 13 to
// be exactly {F01, ..., F11}, each occurring exactly once -- i.e. a
// bijection against EXPECTED_FINDING_IDS, not merely a covering.
//
// v6.0 fix (B, C): duplicate detection is computed from the RAW,
// pre-dedup id list (rawFindingIds), because a Set-deduplicated array
// can never exhibit an internal duplicate by construction. v5.3 ran
// this same check against the already-deduplicated array, so it always
// returned an empty result -- a duplicated finding block could reach
// the final output uncaught in some cases. Missing IDs and duplicated
// IDs are now symmetric hard failures under REQUIRE_ALL_FINDINGS.
// ======================================================================
const rawFindingIds =
    fixedFindings
        .map(f => String(f.finding_id || "").trim().toUpperCase())
        .filter(Boolean);
const receivedFindingIds = [...new Set(rawFindingIds)];
const receivedSet = new Set(receivedFindingIds);
const missingFindingIds =
    EXPECTED_FINDING_IDS.filter(id => !receivedSet.has(id));
const unexpectedFindingIds =
    receivedFindingIds.filter(id => !EXPECTED_FINDING_IDS.includes(id));
// v6.0 fix (B): computed against rawFindingIds, not receivedFindingIds.
const duplicateFindingIds = [
    ...new Set(
        rawFindingIds.filter(
            (id, index) => rawFindingIds.indexOf(id) !== index
        )
    )
];
if (REQUIRE_ALL_FINDINGS) {
    // v6.0 fix (C): the raw count must equal 11 (rejects duplicates)
    // AND the unique count must equal 11 (rejects both duplicates and
    // shortfalls) AND the two must be equal to each other (rejects the
    // case where a duplicate exactly offsets a missing id in the raw
    // count, e.g. 11 raw entries = F01 twice + F02..F10 once + no F11).
    const bijectionHolds =
        rawFindingIds.length === 11 &&
        receivedFindingIds.length === 11 &&
        missingFindingIds.length === 0 &&
        duplicateFindingIds.length === 0;
    if (!bijectionHolds) {
        throw new Error(
            [
                "Node 16: Node 13 must supply exactly the 11 canonical findings, each exactly once.",
                `Raw finding blocks received: ${rawFindingIds.length}.`,
                `Distinct finding IDs received: ${receivedFindingIds.join(", ") || "NONE"} (${receivedFindingIds.length}).`,
                `Missing: ${missingFindingIds.join(", ") || "NONE"}.`,
                `Duplicated: ${duplicateFindingIds.join(", ") || "NONE"}.`,
                `Unexpected: ${unexpectedFindingIds.join(", ") || "NONE"}.`,
                "Node 16 will not invent missing findings and will not silently absorb duplicated ones."
            ].join(" ")
        );
    }
}
if (!fixedFindings.length) {
    throw new Error(
        "Node 16: Node 13 supplied no usable findings after normalisation."
    );
}
// ----------------------------------------------------------------------
// Nothing above this point inspects proposition-level status. An
// UNRESOLVED proposition (e.g. one whose required evidence is an
// unexecuted experiment) is a legitimate, expected outcome and can
// never trigger a coverage failure -- coverage is a finding-identity
// question, not an evidence-sufficiency question.
// ----------------------------------------------------------------------
// ======================================================================
// ARCHITECTURE FINDING (context only — see fix D)
// ======================================================================
function getArchitectureFinding(fid) {
    const candidates = [
        architecture?.findings,
        architecture?.architectural_findings,
        architecture?.architectural_risks,
        architecture?.output?.findings,
        architecture?.output?.architectural_findings,
        architecture?.output?.architectural_risks,
        architecture?.assessment?.findings
    ];
    for (const candidate of candidates) {
        if (!Array.isArray(candidate)) {
            continue;
        }
        const match = candidate.find(
            item =>
                findingId(item?.finding_id || item?.findingId || item?.id) === fid
        );
        if (match) {
            return match;
        }
    }
    return null;
}
// ======================================================================
// ARCHITECTURE EVIDENCE  (v6.0 fix D — Invariant I5, evidence locality)
// ======================================================================
//
// A SOURCE_RELATIONSHIP proposition may ONLY be established by evidence
// that Node 13 mapped to THAT proposition specifically
// (proposition.architectural_evidence). There is deliberately no
// fallback to the finding-level architectural_evidence list.
//
// v5.3 fell back to the finding-level list whenever the proposition
// list was empty. Node 13 v2.4 performs explicit per-predicate term
// matching and leaves the proposition-level array empty precisely when
// that matching found nothing -- it reports such predicates
// UNVERIFIABLE. Falling back to the finding's broad, unmatched evidence
// list in that situation does not recover a missed match; it discards
// Node 13's own negative result and reports SUPPORTED anyway. That is
// the exact "silently trust a weaker signal" failure this pipeline is
// designed to refuse. An empty proposition-level array is therefore
// left as NOT_OBSERVED.
// ======================================================================
function architectureEvidence(proposition) {
    if (
        Array.isArray(proposition.architectural_evidence) &&
        proposition.architectural_evidence.length
    ) {
        return proposition.architectural_evidence;
    }
    return [];
}
// ======================================================================
// ARCHITECTURE ASSESSMENT
// ======================================================================
//
// Architecture is PRIMARY only for SOURCE_RELATIONSHIP. For runtime /
// resolver / experiment propositions, architecture is CONTEXTUAL and
// cannot establish the proposition (role: "CONTEXTUAL" is what the
// proposition-assessment filter checks to exclude it from the
// deterministic ledger — see assessProposition()).
// ======================================================================
function assessArchitecture(finding, proposition) {
    const evidence = architectureEvidence(proposition);
    const requirement = proposition.evidence_requirement;
    if (requirement === "SOURCE_RELATIONSHIP") {
        if (!evidence.length) {
            return {
                source: "Architecture",
                role: "PRIMARY",
                observation_state: "NOT_OBSERVED",
                status: "UNRESOLVED",
                evidence: null,
                reason:
                    "No proposition-specific architectural evidence was mapped to this proposition by Node 13. " +
                    "Finding-level architectural evidence exists but is not used to establish an individual " +
                    "proposition (evidence locality, invariant I5)."
            };
        }
        return {
            source: "Architecture",
            role: "PRIMARY",
            observation_state: "FOUND",
            status: "SUPPORTED",
            evidence: clone(evidence),
            reason: "The proposition is a source-relationship claim and proposition-specific architecture evidence exists."
        };
    }
    if (!evidence.length) {
        return {
            source: "Architecture",
            role: "CONTEXTUAL",
            observation_state: "NOT_OBSERVED",
            status: "UNRESOLVED",
            evidence: null,
            reason: "Architecture is not the required evidence type for this proposition."
        };
    }
    return {
        source: "Architecture",
        role: "CONTEXTUAL",
        observation_state: "FOUND",
        status: "UNRESOLVED",
        evidence: clone(evidence),
        reason: `Architecture evidence is contextual only because the required evidence type is ${requirement || "UNSPECIFIED"}.`
    };
}
// ======================================================================
// FOUNDRY RUNTIME PROPERTY
// ======================================================================
function getRuntimeProperty(property) {
    if (!property) {
        return { exists: false };
    }
    // Foundry emits camelCase keys ("addressProviderExists"); Node 13
    // predicates specify snake_case property names
    // ("address_provider_exists"). Matching happens on a normalised
    // (lowercase, non-alphanumeric stripped) key so both resolve to the
    // same property.
    const normalizeKey = (k) =>
        str(k).toLowerCase().replace(/[^a-z0-9]/g, "");
    const PROPERTY_ALIASES = {
        upgradeable_architecture: [
            "upgradeableArchitectureDetected",
            "upgradeable_architecture_detected"
        ]
    };
    const wanted = normalizeKey(property);
    const aliasWanted =
        (PROPERTY_ALIASES[property] || []).map(normalizeKey);
    const containers = [
        foundry,
        foundry.runtime_properties,
        foundry.runtimeProperties,
        foundry.runtime,
        foundry.validation,
        foundry.output
    ];
    for (const container of containers) {
        if (!isObject(container)) {
            continue;
        }
        for (const key of Object.keys(container)) {
            const normalizedKey = normalizeKey(key);
            if (
                normalizedKey === wanted ||
                aliasWanted.includes(normalizedKey)
            ) {
                return { exists: true, value: container[key] };
            }
        }
    }
    return { exists: false };
}
// ======================================================================
// FOUNDRY RESOLVER INDEX
// ======================================================================
const resolverChecks =
    Array.isArray(foundry?.resolver_validation?.checks)
        ? foundry.resolver_validation.checks
        : [];
const resolverById = {};
const resolverByFunction = {};
for (const record of resolverChecks) {
    const id = str(record?.checkId || record?.check_id).trim();
    const fn = normFunction(
        record?.function || record?.function_name || record?.functionName
    );
    if (id) {
        resolverById[id] = record;
    }
    if (fn) {
        if (!resolverByFunction[fn]) {
            resolverByFunction[fn] = [];
        }
        resolverByFunction[fn].push(record);
    }
}
// ======================================================================
// FIND RESOLVER
// ======================================================================
function findResolver(check) {
    const checkId = str(check?.check_id || check?.checkId).trim();
    const fn = normFunction(check?.function);
    if (checkId && resolverById[checkId]) {
        return { record: resolverById[checkId], match_method: "EXACT_CHECK_ID" };
    }
    const candidates = resolverByFunction[fn] || [];
    if (candidates.length === 1) {
        return { record: candidates[0], match_method: "NORMALIZED_FUNCTION" };
    }
    const executed = candidates.filter(r => r?.executed === true);
    if (executed.length === 1) {
        return { record: executed[0], match_method: "NORMALIZED_FUNCTION_EXECUTED" };
    }
    return {
        record: null,
        match_method: candidates.length > 1 ? "AMBIGUOUS_UNRESOLVED" : "NO_MATCH"
    };
}
// ======================================================================
// OBSERVATION AGGREGATION  (v6.0 fix A — single shared K3 AND-combinator)
// ======================================================================
//
// Combines a list of already-classified per-observation statuses into
// one status for the owning proposition:
//
//     CONTRADICTED  if any observation is CONTRADICTED
//     SUPPORTED     if every observation is SUPPORTED (and >= 1 exists)
//     UNRESOLVED    otherwise
//
// This is Kleene K3 conjunction. It is the single implementation used
// by both assessResolver() and assessRuntimeExistence(); previously
// each hand-rolled its own copy of this same three-line rule.
// ======================================================================
function combineObservations(observations) {
    if (!observations.length) {
        return "UNRESOLVED";
    }
    const total = observations.length;
    const supported =
        observations.filter(o => o.status === "SUPPORTED").length;
    const contradicted =
        observations.filter(o => o.status === "CONTRADICTED").length;
    if (contradicted > 0) {
        return "CONTRADICTED";
    }
    if (supported === total) {
        return "SUPPORTED";
    }
    return "UNRESOLVED";
}
// ======================================================================
// RESOLVER ASSESSMENT
// ======================================================================
function assessResolver(proposition) {
    const checks = proposition.resolver_checks || [];
    if (!checks.length) {
        return null;
    }
    const observations = [];
    for (const check of checks) {
        const result = findResolver(check);
        if (!result.record) {
            observations.push({
                check_id: check.check_id,
                function: check.function,
                observation_state: "NOT_OBSERVED",
                status: "UNRESOLVED",
                evidence: null,
                match_method: result.match_method,
                reason:
                    result.match_method === "AMBIGUOUS_UNRESOLVED"
                        ? "Multiple Foundry resolver records match this function and none is uniquely identifiable as executed."
                        : "No matching Foundry resolver observation exists."
            });
            continue;
        }
        const record = result.record;
        const executed = record.executed === true;
        const matched =
            record.matched === true || record.value_matches === true;
        const explicitFailure =
            record.matched === false ||
            record.value_matches === false ||
            record.passed === false ||
            norm(record.status) === "fail" ||
            norm(record.result) === "fail";
        const hasError =
            Boolean(record.error || record.error_message || record.exception);
        if (hasError) {
            observations.push({
                check_id: check.check_id,
                function: record.function || record.function_name,
                observation_state: "ERROR",
                status: "UNRESOLVED",
                evidence: clone(record),
                match_method: result.match_method,
                reason: "Resolver execution produced an explicit error."
            });
            continue;
        }
        // v6.0 fix (E): a record that simultaneously claims both
        // "matched" and "explicit failure" carries an internal
        // contradiction in the Foundry data itself. v5.3 checked
        // `matched` first and silently discarded the failure signal
        // whenever both were present. That is exactly the kind of
        // single-signal trust this pipeline exists to avoid, so it is
        // now surfaced explicitly instead of arbitrated silently.
        if (matched && explicitFailure) {
            observations.push({
                check_id: check.check_id,
                function: record.function || record.function_name,
                observation_state: "ERROR",
                status: "UNRESOLVED",
                evidence: clone(record),
                match_method: result.match_method,
                reason:
                    "Foundry record reports conflicting signals: a positive match indicator " +
                    "(matched/value_matches) and a negative outcome indicator (passed/status/result) " +
                    "simultaneously. Treated as an unresolved data-integrity conflict rather than " +
                    "resolved in either direction."
            });
            continue;
        }
        if (!executed) {
            observations.push({
                check_id: check.check_id,
                function: record.function || record.function_name,
                observation_state: "FOUND",
                status: "UNRESOLVED",
                evidence: clone(record),
                match_method: result.match_method,
                reason: "Resolver record exists but is not marked as executed."
            });
            continue;
        }
        if (matched) {
            observations.push({
                check_id: check.check_id,
                function: record.function || record.function_name,
                observation_state: "FOUND",
                status: "SUPPORTED",
                evidence: {
                    returned: record.returned ?? record.returned_value ?? null,
                    expected: record.expected ?? record.expected_value ?? null,
                    matched: true
                },
                match_method: result.match_method
            });
            continue;
        }
        if (explicitFailure) {
            observations.push({
                check_id: check.check_id,
                function: record.function || record.function_name,
                observation_state: "FOUND",
                status: "CONTRADICTED",
                evidence: {
                    returned: record.returned ?? record.returned_value ?? null,
                    expected: record.expected ?? record.expected_value ?? null,
                    matched: false
                },
                match_method: result.match_method,
                reason: "Foundry explicitly reports a resolver mismatch or failure."
            });
            continue;
        }
        observations.push({
            check_id: check.check_id,
            function: record.function || record.function_name,
            observation_state: "FOUND",
            status: "UNRESOLVED",
            evidence: clone(record),
            match_method: result.match_method,
            reason: "Resolver execution exists but no explicit deterministic match or contradiction was reported."
        });
    }
    return {
        source: "Foundry",
        role: "PRIMARY",
        observation_state:
            observations.some(o => o.observation_state === "FOUND")
                ? "FOUND"
                : "NOT_OBSERVED",
        status: combineObservations(observations),
        observations
    };
}
// ======================================================================
// RUNTIME EXISTENCE
// ======================================================================
// v6.0 fix (F): boolean-like normalisation. Only applied when `expected`
// is a genuine boolean, so it can never mask a real mismatch on a
// non-boolean property (e.g. a numeric reserve count or an address
// string are left completely untouched).
function coerceToBooleanIfApplicable(actualValue, expected) {
    if (typeof expected !== "boolean") {
        return actualValue;
    }
    if (typeof actualValue === "boolean") {
        return actualValue;
    }
    if (typeof actualValue === "string") {
        const normalized = actualValue.trim().toLowerCase();
        if (normalized === "true") return true;
        if (normalized === "false") return false;
        return actualValue;
    }
    if (actualValue === 1) return true;
    if (actualValue === 0) return false;
    return actualValue;
}
function assessRuntimeExistence(proposition) {
    const requirements = proposition.runtime_requirements || [];
    if (!requirements.length) {
        return null;
    }
    const observations = [];
    for (const requirement of requirements) {
        const property = requirement.property;
        const expected = requirement.expected;
        const actual = getRuntimeProperty(property);
        if (!actual.exists) {
            observations.push({
                property,
                expected,
                observation_state: "NOT_OBSERVED",
                status: "UNRESOLVED",
                evidence: null,
                reason: `No runtime observation exists for "${property}".`
            });
            continue;
        }
        const comparableValue =
            coerceToBooleanIfApplicable(actual.value, expected);
        if (comparableValue === expected) {
            observations.push({
                property,
                expected,
                observed: actual.value,
                observation_state: "FOUND",
                status: "SUPPORTED",
                evidence: { property, expected, observed: actual.value }
            });
            continue;
        }
        if (
            typeof comparableValue === "boolean" &&
            typeof expected === "boolean"
        ) {
            observations.push({
                property,
                expected,
                observed: actual.value,
                observation_state: "FOUND",
                status: "CONTRADICTED",
                evidence: { property, expected, observed: actual.value }
            });
            continue;
        }
        observations.push({
            property,
            expected,
            observed: actual.value,
            observation_state: "FOUND",
            status: "UNRESOLVED",
            evidence: { property, expected, observed: actual.value },
            reason: "Runtime value exists but does not provide a deterministic comparison."
        });
    }
    return {
        source: "Foundry",
        role: "PRIMARY",
        observation_state:
            observations.some(o => o.observation_state === "FOUND")
                ? "FOUND"
                : "NOT_OBSERVED",
        status: combineObservations(observations),
        observations
    };
}
// ======================================================================
// EXPERIMENT
// ======================================================================
function findExperiment(propositionId) {
    const containers = [
        foundry?.experiments,
        foundry?.experiment_results,
        foundry?.behavioural_validation,
        foundry?.behavioral_validation,
        foundry?.validation_results
    ];
    for (const container of containers) {
        if (!isObject(container)) {
            continue;
        }
        if (container[propositionId]) {
            return container[propositionId];
        }
    }
    return null;
}
function assessExperiment(proposition) {
    const experiment = findExperiment(proposition.proposition_id);
    if (!experiment) {
        return {
            source: "Foundry",
            role: "PRIMARY",
            observation_state: "NOT_OBSERVED",
            status: "UNRESOLVED",
            evidence: null,
            reason: "No executed behavioural experiment result exists for this proposition."
        };
    }
    const passed =
        experiment.passed === true ||
        experiment.success === true ||
        norm(experiment.status) === "pass" ||
        norm(experiment.result) === "pass";
    const failed =
        experiment.passed === false ||
        experiment.success === false ||
        norm(experiment.status) === "fail" ||
        norm(experiment.result) === "fail";
    if (passed && failed) {
        return {
            source: "Foundry",
            role: "PRIMARY",
            observation_state: "ERROR",
            status: "UNRESOLVED",
            evidence: clone(experiment),
            reason: "Experiment record reports conflicting pass and fail signals simultaneously."
        };
    }
    if (passed) {
        return {
            source: "Foundry",
            role: "PRIMARY",
            observation_state: "FOUND",
            status: "SUPPORTED",
            evidence: clone(experiment)
        };
    }
    if (failed) {
        return {
            source: "Foundry",
            role: "PRIMARY",
            observation_state: "FOUND",
            status: "CONTRADICTED",
            evidence: clone(experiment)
        };
    }
    return {
        source: "Foundry",
        role: "PRIMARY",
        observation_state: "FOUND",
        status: "UNRESOLVED",
        evidence: clone(experiment),
        reason: "Experiment record exists but contains no explicit pass/fail result."
    };
}
// ======================================================================
// HISTORICAL / TEMPORAL — always contextual, never deterministic proof
// ======================================================================
function historicalAssessment() {
    return {
        source: "Historical",
        role: "CONTEXTUAL",
        observation_state: "FOUND",
        status: "UNRESOLVED",
        evidence: null,
        reason: "Historical evidence is retained for downstream fusion and is not treated as deterministic current-state proof."
    };
}
function temporalAssessment() {
    return {
        source: "Temporal",
        role: "CONTEXTUAL",
        observation_state: "FOUND",
        status: "UNRESOLVED",
        evidence: null,
        reason: "Temporal evidence is retained for downstream fusion and is not treated as deterministic current-state proof."
    };
}
// ======================================================================
// PROPOSITION ASSESSMENT
// ======================================================================
function assessProposition(finding, proposition) {
    const requirement = proposition.evidence_requirement;
    const architectureResult = assessArchitecture(finding, proposition);
    let foundryResult;
    switch (requirement) {
        case "RUNTIME_EXISTENCE":
            foundryResult = assessRuntimeExistence(proposition);
            break;
        case "RESOLVER_EXECUTION":
            foundryResult = assessResolver(proposition);
            break;
        case "EXPERIMENT":
            foundryResult = assessExperiment(proposition);
            break;
        case "SOURCE_RELATIONSHIP":
            foundryResult = {
                source: "Foundry",
                role: "CONTEXTUAL",
                observation_state: "NOT_APPLICABLE",
                status: "UNRESOLVED",
                evidence: null,
                reason: "Foundry is not the required evidence source for this proposition."
            };
            break;
        default:
            foundryResult = {
                source: "Foundry",
                role: "CONTEXTUAL",
                observation_state: "NOT_APPLICABLE",
                status: "UNRESOLVED",
                evidence: null,
                reason: "No recognised deterministic evidence requirement exists."
            };
    }
    if (!foundryResult) {
        foundryResult = {
            source: "Foundry",
            role: "PRIMARY",
            observation_state: "NOT_OBSERVED",
            status: "UNRESOLVED",
            evidence: null,
            reason: `Proposition declares ${requirement || "an evidence requirement"} but supplies no checks to evaluate.`
        };
    }
    const historicalResult = historicalAssessment();
    const temporalResult = temporalAssessment();
    // --------------------------------------------------------------
    // ONLY THE PRIMARY SOURCE DETERMINES STATUS.
    // --------------------------------------------------------------
    const status =
        requirement === "SOURCE_RELATIONSHIP"
            ? architectureResult.status
            : foundryResult.status;
    const sourceAssessments = {
        architecture: architectureResult,
        foundry: foundryResult,
        historical: historicalResult,
        temporal: temporalResult
    };
    const supporting = [];
    const contradicting = [];
    const unresolved = [];
    for (const assessment of Object.values(sourceAssessments)) {
        if (!assessment) {
            continue;
        }
        // CONTEXTUAL evidence is preserved in source_assessments but
        // never enters the deterministic observation ledger.
        if (assessment.role === "CONTEXTUAL") {
            continue;
        }
        const observations =
            Array.isArray(assessment.observations)
                ? assessment.observations
                : [assessment];
        for (const observation of observations) {
            const item = {
                proposition_id: proposition.proposition_id,
                proposition: proposition.proposition,
                source: assessment.source,
                role: assessment.role,
                status: observation.status,
                observation_state: observation.observation_state,
                evidence: observation.evidence ?? assessment.evidence ?? null,
                reason: observation.reason ?? assessment.reason ?? null,
                check_id: observation.check_id ?? null
            };
            if (observation.status === "SUPPORTED") {
                supporting.push(item);
            } else if (observation.status === "CONTRADICTED") {
                contradicting.push(item);
            } else {
                unresolved.push(item);
            }
        }
    }
    return {
        proposition_id: proposition.proposition_id,
        proposition: proposition.proposition,
        evidence_requirement: requirement,
        status,
        source_assessments: sourceAssessments,
        supporting_observations: supporting,
        contradicting_observations: contradicting,
        unresolved_observations: unresolved
    };
}
// ======================================================================
// FINDING STATUS
// ======================================================================
//
// classifyFindingStatus is a total function over all reachable
// (supported, contradicted, total) triples with
// 0 <= supported + contradicted <= total. The six branches below are
// mutually exclusive and jointly exhaustive; there is no implicit
// fallthrough case left undocumented.
// ======================================================================
function classifyFindingStatus(propositions) {
    if (!propositions.length) {
        return "UNRESOLVED";
    }
    const total = propositions.length;
    const supported =
        propositions.filter(p => p.status === "SUPPORTED").length;
    const contradicted =
        propositions.filter(p => p.status === "CONTRADICTED").length;
    if (contradicted === total) {
        return "CONTRADICTED";
    }
    if (supported === total) {
        return "FULLY_SUPPORTED";
    }
    if (supported > 0 && contradicted > 0) {
        return "MIXED_SUPPORT_AND_CONTRADICTION";
    }
    if (supported > 0) {
        return "PARTIALLY_SUPPORTED";
    }
    if (contradicted > 0) {
        return "PARTIALLY_CONTRADICTED";
    }
    return "UNRESOLVED";
}
// ======================================================================
// PROCESS FINDINGS
// ======================================================================
const findings = [];
for (const finding of fixedFindings) {
    const propositions = finding.propositions.map(
        proposition => assessProposition(finding, proposition)
    );
    findings.push({
        finding_id: finding.finding_id,
        finding_name: finding.finding_name,
        risk_pattern: finding.risk_pattern,
        // v6.1: passthrough only -- see header changelog and the
        // extractNode13Findings() comment above.
        finding_resolution: finding.finding_resolution,
        sources: finding.sources,
        source_findings: finding.source_findings,
        claim_ids_by_source: finding.claim_ids_by_source,
        claim_ids_agree: finding.claim_ids_agree,
        status: classifyFindingStatus(propositions),
        propositions,
        deterministic_evidence: {
            supporting_observations:
                propositions.flatMap(p => p.supporting_observations),
            contradicting_observations:
                propositions.flatMap(p => p.contradicting_observations),
            unresolved_observations:
                propositions.flatMap(p => p.unresolved_observations)
        }
    });
}
// ======================================================================
// SELF-VERIFICATION  (v6.0 fix G — invariants as executable checks)
// ======================================================================
//
// Re-derives, from the OUTPUT actually produced above, the facts that
// the formal model at the top of this file claims must hold, and
// throws if any of them do not. This is intentionally redundant with
// the logic that produced `findings` -- the point of a proof
// obligation is that it is checked independently of the code path that
// is supposed to guarantee it, so a future edit that breaks an
// invariant is caught here even if the bug is elsewhere in the file.
// ======================================================================
(function selfVerify() {
    // I4 — non-fabrication / bijection: exactly the 11 canonical
    // finding IDs, each exactly once, in the final output.
    const outputFindingIds = findings.map(f => f.finding_id);
    const outputUnique = new Set(outputFindingIds);
    if (outputFindingIds.length !== 11 || outputUnique.size !== 11) {
        throw new Error(
            `Node 16 self-verification failed (I4): expected exactly 11 unique findings in the output, ` +
            `found ${outputFindingIds.length} entries / ${outputUnique.size} unique IDs.`
        );
    }
    for (const id of EXPECTED_FINDING_IDS) {
        if (!outputUnique.has(id)) {
            throw new Error(
                `Node 16 self-verification failed (I4): canonical finding ${id} is missing from the output.`
            );
        }
    }
    // I3 — open-world: no proposition may be CONTRADICTED on the sole
    // basis of a NOT_OBSERVED / no-record primary observation. Every
    // CONTRADICTED proposition must have at least one observation whose
    // observation_state is FOUND or ERROR (i.e. an explicit signal, not
    // silence).
    for (const finding of findings) {
        for (const proposition of finding.propositions) {
            if (proposition.status !== "CONTRADICTED") {
                continue;
            }
            const hasExplicitSignal =
                proposition.contradicting_observations.some(
                    o => o.observation_state === "FOUND" || o.observation_state === "ERROR"
                );
            if (!hasExplicitSignal) {
                throw new Error(
                    `Node 16 self-verification failed (I3): proposition ${proposition.proposition_id} ` +
                    `is CONTRADICTED without any explicit (FOUND/ERROR) supporting observation.`
                );
            }
        }
    }
    // I2 — monotonicity, re-checked directly against combineObservations:
    // a proposition's PRIMARY-source observation set can never contain
    // both a CONTRADICTED observation and an overall SUPPORTED status,
    // and can never contain only-SUPPORTED observations with an overall
    // CONTRADICTED status.
    for (const finding of findings) {
        for (const proposition of finding.propositions) {
            const primaryObservations = [
                ...proposition.supporting_observations,
                ...proposition.contradicting_observations,
                ...proposition.unresolved_observations
            ].filter(o => o.role === "PRIMARY");
            const anyContradicted =
                primaryObservations.some(o => o.status === "CONTRADICTED");
            const allSupported =
                primaryObservations.length > 0 &&
                primaryObservations.every(o => o.status === "SUPPORTED");
            if (anyContradicted && proposition.status === "SUPPORTED") {
                throw new Error(
                    `Node 16 self-verification failed (I2): proposition ${proposition.proposition_id} ` +
                    `has a CONTRADICTED primary observation but an overall SUPPORTED status.`
                );
            }
            if (allSupported && proposition.status === "CONTRADICTED") {
                throw new Error(
                    `Node 16 self-verification failed (I2): proposition ${proposition.proposition_id} ` +
                    `has only SUPPORTED primary observations but an overall CONTRADICTED status.`
                );
            }
        }
    }
    // I5 — evidence locality: a SUPPORTED SOURCE_RELATIONSHIP
    // proposition's supporting evidence must trace back to that
    // proposition's own architectural_evidence array, never to a
    // finding-level fallback (which no longer exists in this file, but
    // is checked here so a future re-introduction of a fallback would
    // fail loudly instead of silently).
    for (const finding of fixedFindings) {
        for (const proposition of finding.propositions) {
            if (proposition.evidence_requirement !== "SOURCE_RELATIONSHIP") {
                continue;
            }
            const assessed = findings
                .find(f => f.finding_id === finding.finding_id)
                ?.propositions.find(p => p.proposition_id === proposition.proposition_id);
            if (!assessed) {
                continue;
            }
            if (assessed.status === "SUPPORTED" && !proposition.architectural_evidence.length) {
                throw new Error(
                    `Node 16 self-verification failed (I5): proposition ${proposition.proposition_id} ` +
                    `is SUPPORTED but its own architectural_evidence array is empty.`
                );
            }
        }
    }
})();
// ======================================================================
// QA
// ======================================================================
const qa = {
    finding_count: findings.length,
    expected_finding_count: EXPECTED_FINDING_IDS.length,
    all_11_findings_present:
        missingFindingIds.length === 0 &&
        unexpectedFindingIds.length === 0 &&
        duplicateFindingIds.length === 0 &&
        findings.length === EXPECTED_FINDING_IDS.length,
    finding_ids_received: receivedFindingIds,
    expected_finding_ids: EXPECTED_FINDING_IDS,
    missing_finding_ids: missingFindingIds,
    unexpected_finding_ids: unexpectedFindingIds,
    duplicate_finding_ids: duplicateFindingIds,
    proposition_count:
        findings.reduce((sum, finding) => sum + finding.propositions.length, 0),
    resolver_records_found: resolverChecks.length,
    resolver_check_ids: Object.keys(resolverById),
    resolver_functions: Object.keys(resolverByFunction),
    contradiction_count:
        findings.reduce(
            (sum, finding) =>
                sum + finding.deterministic_evidence.contradicting_observations.length,
            0
        ),
    conflicting_signal_count:
        findings.reduce(
            (sum, finding) =>
                sum +
                finding.propositions.reduce(
                    (s, p) =>
                        s +
                        [...p.supporting_observations, ...p.contradicting_observations, ...p.unresolved_observations]
                            .filter(o => o.observation_state === "ERROR" && /conflicting/i.test(o.reason || "")).length,
                    0
                ),
            0
        ),
    behavioural_supported_count:
        findings.reduce(
            (sum, finding) =>
                sum +
                finding.propositions.filter(
                    p => p.evidence_requirement === "EXPERIMENT" && p.status === "SUPPORTED"
                ).length,
            0
        ),
    behavioural_unresolved_count:
        findings.reduce(
            (sum, finding) =>
                sum +
                finding.propositions.filter(
                    p => p.evidence_requirement === "EXPERIMENT" && p.status === "UNRESOLVED"
                ).length,
            0
        ),
    probability_assigned: false,
    confidence_assigned: false,
    dst_performed: false,
    llm_fused: false,
    self_verification_passed: true
};
// ======================================================================
// FINAL OUTPUT
// ======================================================================
return [
    {
        json: {
            node: "Node 16 - Deterministic Evidence Anchor",
            version: "6.1",
            methodology: {
                purpose:
                    "Map fixed Node 13 propositions to the evidence capable of establishing them.",
                proposition_source: "Node 13 only.",
                truth_space: ["SUPPORTED", "CONTRADICTED", "UNRESOLVED"],
                truth_space_model:
                    "Kleene strong three-valued logic (K3): SUPPORTED = true, CONTRADICTED = false, " +
                    "UNRESOLVED = unknown/indeterminate.",
                observation_aggregation:
                    "K3 conjunction: CONTRADICTED if any observation contradicts; SUPPORTED only if " +
                    "every observation supports; UNRESOLVED otherwise. Order-independent.",
                finding_aggregation:
                    "Total classification over (supported_count, contradicted_count, total_count).",
                deterministic_sources: ["Architecture", "Foundry"],
                contextual_sources: ["Historical", "Temporal"],
                source_relationship: "Architecture is primary.",
                runtime_existence: "Foundry is primary.",
                resolver_execution: "Foundry resolver execution is primary.",
                experiment: "Only an executed Foundry experiment may establish the proposition.",
                missing_evidence: "UNRESOLVED",
                explicit_failure: "CONTRADICTED",
                inferred_failure: false,
                architectural_inference_of_behaviour: false,
                missing_findings_are_invented: false,
                evidence_locality:
                    "A proposition may only be established by evidence mapped to that proposition " +
                    "specifically; finding-level evidence cannot substitute (invariant I5).",
                finding_identity_is_bijective:
                    "Node 13's finding set must match the canonical 11 IDs exactly, with no duplicates " +
                    "and no omissions (invariant I4).",
                probability_assigned: false,
                confidence_assigned: false,
                risk_score_assigned: false,
                dst_performed: false,
                llm_fused: false
            },
            qa,
            resolver_index: {
                check_ids: Object.keys(resolverById),
                normalized_functions: Object.keys(resolverByFunction)
            },
            findings
        }
    }
];
