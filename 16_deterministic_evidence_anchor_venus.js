/***********************************************************************
 * NODE 16 — DETERMINISTIC EVIDENCE ANCHOR (VENUS VARIANT)
 * VERSION 1.2
 *
 * CHANGELOG v1.1 -> v1.2 (two correctness fixes found on review):
 *   1. historicalAssessment()/temporalAssessment() previously returned a
 *      hardcoded observation_state: "FOUND" on every single call,
 *      regardless of whether the historical (09_AI_Historical_Exploit_
 *      Reasoner) or temporal (12_Temporal_Evidence_Engine) node actually
 *      returned any data -- those two variables were extracted at the
 *      top of the file but never read again. Both sources remain
 *      CONTEXTUAL (they never establish SUPPORTED/CONTRADICTED and never
 *      will), but asserting "FOUND" when nothing was actually observed
 *      contradicted the file's own design ethos (never assert evidence
 *      that wasn't actually observed). Now observation_state reflects
 *      whether the upstream payload genuinely had content.
 *   2. emptyFindingBlockCount (in qa.empty_or_unparseable_finding_blocks)
 *      previously recomputed "how many raw finding blocks got dropped
 *      during parsing" by re-checking ONE hardcoded candidate path
 *      (node13.deterministic_evidence.findings) directly, even though
 *      extractNode13Findings() itself tries six different candidate
 *      paths and uses whichever matches first. On any of the other five
 *      shapes (root.findings, root.specification.findings, etc.), the
 *      fallback branch compared rawFindingIds.length to itself --
 *      tautologically always 0, silently hiding real parse-drop counts.
 *      extractNode13Findings() now returns the true raw block count of
 *      whichever path it actually used, so this metric is correct
 *      regardless of which shape Venus's Node 13 sends.
 *
 * CHANGELOG v1.0 -> v1.1 (metadata-only, no evaluation-logic change):
 *   Added claim_id passthrough. Node 13 (Venus)'s finding objects already
 *   carry a stable claim_id (built by Node 07/08 from literal function/
 *   variable names in the finding's own evidence -- see
 *   08_audit_incident_ingestion_schema_v1.json for the algorithm). v1.0
 *   read finding_id but dropped claim_id on the floor. v1.1 reads it
 *   through unchanged and adds it to each finding in the final output.
 *   It is NOT read, matched, compared, or branched on anywhere in this
 *   file -- it does not participate in proposition assessment, K3
 *   aggregation, finding-status classification, or self-verification.
 *   It exists purely so a downstream node (the claim-level tracker) has
 *   a stable key to join today's Node 16 output against a historical
 *   audit/incident finding, without Node 16 itself knowing or caring
 *   that such a node exists. See NODE16_CLAIM_ID_BEFORE_AFTER.md for the
 *   diff proof that no other output changed.
 *
 * Companion to 13_deterministic_evidence_specification_venus.js, in the
 * same way v6.0 of this node is the companion to the Aave
 * 13_deterministic_evidence_specification.js. See that file's changelog
 * for why Venus needs its own matching logic: Venus's finding taxonomy
 * is open (finding names/IDs are not fixed strings like Aave's F01-F11),
 * so nothing here may assume or require the Aave "F\d{2}" ID shape.
 *
 * PURPOSE (unchanged from the Aave version)
 * ------------------------------------------
 *     "What does the available evidence actually establish?"
 *
 * Node 16 (Venus) DOES NOT create propositions, assign probability or
 * confidence, perform belief fusion, combine with LLM output, infer
 * missing evidence, treat missing evidence as contradiction, or infer
 * runtime truth from architectural narrative. Same truth space (K3:
 * SUPPORTED / CONTRADICTED / UNRESOLVED), same open-world assumption,
 * same evidence-locality rule (I5): a proposition is only established
 * by evidence mapped to THAT proposition, never by finding-level
 * fallback evidence.
 *
 * WHAT IS DIFFERENT FROM THE AAVE VERSION (v6.0), AND WHY
 * ----------------------------------------------------------------------
 *
 * (1) FINDING IDENTITY IS OPEN, NOT A FIXED 11-ID BIJECTION.
 *     The Aave version requires Node 13 to supply exactly {F01..F11},
 *     each once, verified with an "F\d{2}" regex. Venus's Node 13 emits
 *     whatever findings its anchor-token matching actually surfaces
 *     (UPGRADEABILITY_01, DEPENDENCY_01, ...), and that set can grow or
 *     shrink as the Venus finding taxonomy evolves. Coverage validation
 *     here is therefore a WEAKER, still-enforced invariant: every
 *     finding_id must be a non-empty string, and no finding_id may
 *     appear twice. There is no fixed expected list and no fixed count.
 *
 * (2) EXPERIMENT EVIDENCE HAS TWO POSSIBLE PROVENANCES, AND THEY ARE
 *     NEVER CONFLATED.
 *       a) LIVE FOUNDRY RESULT (source: "Foundry-live") — looked up
 *          from a separate Foundry node exactly as the Aave version
 *          does. Preferred whenever present.
 *       b) MANUAL SNAPSHOT FALLBACK (source: "Foundry-manual-snapshot")
 *          — Node 13 (Venus)'s own embedded validation_result /
 *          validation_evidence, used ONLY when (a) is absent. Every
 *          resulting observation is stamped with an explicit
 *          "provenance" field so nothing downstream can mistake a
 *          manually-recorded snapshot for a live re-execution.
 *     If NEITHER source has anything, the proposition is UNRESOLVED.
 *
 * (3) THE MANUAL SNAPSHOT FALLBACK IS GATED, NOT TRUSTED VERBATIM.
 *     Node 16 (Venus) independently requires ALL of:
 *       - validation_evidence.requires_execution === false
 *       - validation_evidence.executed_test is a non-empty string
 *       - an explicit pass or fail signal, with a simultaneous
 *         pass+fail signal treated as an unresolved conflict (ERROR).
 *     A record missing any of these — including a NOT_TESTED entry —
 *     falls through to UNRESOLVED.
 *
 * (4) RUNTIME EXISTENCE CHECKS AGAINST A WIDER, VENUS-SHAPED SET OF
 *     CONTAINERS: the independent Foundry node is always tried first;
 *     Node 13 (Venus)'s own mirrored objective_runtime_evidence
 *     .observations is used only as a last resort.
 *
 * (5) PROPOSITION IDS ARE NOT REFORMATTED to Aave's F01-P01 shape —
 *     Venus predicate IDs are used verbatim.
 *
 * Everything else — the K3 truth space and combinator, PRIMARY/
 * CONTEXTUAL source roles, SOURCE_RELATIONSHIP evidence locality (I5),
 * the finding-status classification function, and self-verification —
 * is unchanged in substance from v6.0.
 ***********************************************************************/
// ======================================================================
// CONFIGURATION
// ======================================================================
const REQUIRE_UNIQUE_FINDING_IDS = true; // open taxonomy: no fixed list, no fixed count
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
    getNodeJSON("13_Deterministic_Evidence_Specification_Venus") ||
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
function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
}
// ======================================================================
// NODE 13 (VENUS) — EXTRACT FIXED FINDINGS
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
        // FIX (v1.2): return the actual raw block count (0 here) alongside
        // the findings array -- see call site for why this replaced a
        // hardcoded single-path length check.
        return { findings: [], rawBlockCount: 0 };
    }
    const findings = raw
        .map((finding, findingIndex) => {
            const fidRaw = str(
                finding.finding_id || finding.findingId || finding.id
            ).trim();
            if (!fidRaw) {
                return null;
            }
            const records =
                Array.isArray(finding.propositions)
                    ? finding.propositions
                    : Array.isArray(finding.predicates)
                        ? finding.predicates
                        : [];
            return {
                finding_id: fidRaw,
                finding_name:
                    finding.finding_name ||
                    finding.name ||
                    fidRaw,
                risk_pattern:
                    finding.risk_pattern ||
                    finding.risk_category ||
                    null,
                // v1.1: metadata-only passthrough, not used anywhere below.
                claim_id:
                    finding.claim_id != null ? String(finding.claim_id) : null,
                propositions: records.map((p, index) => {
                    const propId = str(
                        p.proposition_id || p.predicate_id || p.id
                    ).trim();
                    return {
                        proposition_id:
                            propId || `${fidRaw}-P${String(index + 1).padStart(2, "0")}-UNKNOWN`,
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
                        architectural_evidence:
                            Array.isArray(p.architectural_evidence)
                                ? p.architectural_evidence
                                : [],
                        manual_validation_result:
                            p.validation_result != null ? p.validation_result : null,
                        manual_validation_evidence:
                            isObject(p.validation_evidence)
                                ? clone(p.validation_evidence)
                                : null
                    };
                })
            };
        })
        .filter(Boolean);
    return { findings, rawBlockCount: raw.length };
}
// FIX (v1.2): extractNode13Findings previously returned only the parsed
// findings array. emptyFindingBlockCount then tried to recover "how many
// raw blocks were dropped during parsing" by re-checking ONE specific
// candidate path (node13.deterministic_evidence.findings) directly at the
// call site -- but extractNode13Findings itself tries SIX candidate
// paths and uses the first one that matches. Whenever a real Venus
// Node 13 payload used any path other than that first one (root.findings,
// root.specification.findings, root.output.findings, etc.), the QA
// fallback silently compared rawFindingIds.length against itself
// (they're derived from the same array), making emptyFindingBlockCount
// tautologically 0 forever -- hiding genuine parse-drop counts on 5 of
// the 6 possible input shapes. extractNode13Findings now reports the
// true raw block count of whichever candidate path it actually used, so
// this metric is correct regardless of which shape Node 13 (Venus) sends.
const { findings: fixedFindings, rawBlockCount } = extractNode13Findings(node13);
// ======================================================================
// FINDING COVERAGE VALIDATION (open taxonomy — uniqueness only)
// ======================================================================
const rawFindingIds =
    fixedFindings.map(f => String(f.finding_id || "").trim()).filter(Boolean);
const receivedFindingIds = [...new Set(rawFindingIds.map(id => id.toUpperCase()))];
const duplicateFindingIds = [
    ...new Set(
        rawFindingIds
            .map(id => id.toUpperCase())
            .filter((id, index, arr) => arr.indexOf(id) !== index)
    )
];
const emptyFindingBlockCount = rawBlockCount - fixedFindings.length;
if (REQUIRE_UNIQUE_FINDING_IDS && duplicateFindingIds.length > 0) {
    throw new Error(
        [
            "Node 16 (Venus): Node 13 supplied the same finding_id more than once in a single run.",
            `Duplicated: ${duplicateFindingIds.join(", ")}.`,
            `All finding IDs received: ${rawFindingIds.join(", ") || "NONE"}.`,
            "Node 16 (Venus) will not silently absorb duplicated findings, even though Venus's finding taxonomy is open."
        ].join(" ")
    );
}
if (!fixedFindings.length) {
    throw new Error(
        "Node 16 (Venus): Node 13 (Venus) supplied no usable findings after normalisation."
    );
}
// ======================================================================
// ARCHITECTURE FINDING (context only)
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
                str(item?.finding_id || item?.findingId || item?.id).trim().toUpperCase() ===
                fid.toUpperCase()
        );
        if (match) {
            return match;
        }
    }
    return null;
}
// ======================================================================
// ARCHITECTURE EVIDENCE (evidence locality, invariant I5)
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
                    "No proposition-specific architectural evidence was mapped to this proposition by Node 13 (Venus). " +
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
    const independentContainers = [
        foundry,
        foundry.runtime_properties,
        foundry.runtimeProperties,
        foundry.runtime,
        foundry.validation,
        foundry.output,
        foundry.observations
    ];
    const search = (containers) => {
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
        return null;
    };
    const fromIndependentNode = search(independentContainers);
    if (fromIndependentNode) {
        return { ...fromIndependentNode, provenance: "Foundry-live" };
    }
    const mirrorContainers = [
        node13?.deterministic_evidence?.objective_runtime_evidence?.observations
    ];
    const fromMirror = search(mirrorContainers);
    if (fromMirror) {
        return { ...fromMirror, provenance: "Foundry-mirrored-via-Node13" };
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
// OBSERVATION AGGREGATION (K3 AND-combinator)
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
                evidence: { property, expected, observed: actual.value, provenance: actual.provenance }
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
                evidence: { property, expected, observed: actual.value, provenance: actual.provenance }
            });
            continue;
        }
        observations.push({
            property,
            expected,
            observed: actual.value,
            observation_state: "FOUND",
            status: "UNRESOLVED",
            evidence: { property, expected, observed: actual.value, provenance: actual.provenance },
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
// EXPERIMENT — live Foundry result, else gated manual snapshot fallback
// ======================================================================
function findLiveExperiment(propositionId) {
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
function assessLiveExperiment(experiment) {
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
            source: "Foundry-live",
            role: "PRIMARY",
            observation_state: "ERROR",
            status: "UNRESOLVED",
            evidence: clone(experiment),
            provenance: "Foundry-live",
            reason: "Experiment record reports conflicting pass and fail signals simultaneously."
        };
    }
    if (passed) {
        return {
            source: "Foundry-live",
            role: "PRIMARY",
            observation_state: "FOUND",
            status: "SUPPORTED",
            evidence: clone(experiment),
            provenance: "Foundry-live"
        };
    }
    if (failed) {
        return {
            source: "Foundry-live",
            role: "PRIMARY",
            observation_state: "FOUND",
            status: "CONTRADICTED",
            evidence: clone(experiment),
            provenance: "Foundry-live"
        };
    }
    return {
        source: "Foundry-live",
        role: "PRIMARY",
        observation_state: "FOUND",
        status: "UNRESOLVED",
        evidence: clone(experiment),
        provenance: "Foundry-live",
        reason: "Experiment record exists but contains no explicit pass/fail result."
    };
}
function assessManualSnapshot(proposition) {
    const evidence = proposition.manual_validation_evidence;
    const resultLabel = norm(proposition.manual_validation_result);
    if (!evidence) {
        return {
            source: "Foundry-manual-snapshot",
            role: "PRIMARY",
            observation_state: "NOT_OBSERVED",
            status: "UNRESOLVED",
            evidence: null,
            provenance: "none",
            reason: "No live Foundry experiment result and no manually-recorded validation_evidence exists for this proposition."
        };
    }
    const requiresExecution = evidence.requires_execution;
    const executedTest = evidence.executed_test;
    const genuinelyExecuted =
        requiresExecution === false && isNonEmptyString(executedTest);
    if (!genuinelyExecuted) {
        return {
            source: "Foundry-manual-snapshot",
            role: "PRIMARY",
            observation_state: evidence ? "FOUND" : "NOT_OBSERVED",
            status: "UNRESOLVED",
            evidence: clone(evidence),
            provenance: "Foundry-manual-snapshot (unexecuted or unnamed test)",
            reason:
                "The recorded evidence does not establish that a real Foundry experiment was executed " +
                `(requires_execution=${JSON.stringify(requiresExecution)}, executed_test=${JSON.stringify(executedTest)}). ` +
                "A proposed or pending experiment is not treated as execution evidence."
        };
    }
    const reportedStatus = norm(evidence.reported_status);
    const resultText = norm(evidence.result) || resultLabel;
    const passed = resultText === "pass" || reportedStatus === "supported";
    const failed = resultText === "fail" || reportedStatus === "contradicted";
    if (passed && failed) {
        return {
            source: "Foundry-manual-snapshot",
            role: "PRIMARY",
            observation_state: "ERROR",
            status: "UNRESOLVED",
            evidence: clone(evidence),
            provenance: "Foundry-manual-snapshot",
            reason: "Manually-recorded snapshot reports conflicting pass and fail signals simultaneously."
        };
    }
    if (passed) {
        return {
            source: "Foundry-manual-snapshot",
            role: "PRIMARY",
            observation_state: "FOUND",
            status: "SUPPORTED",
            evidence: clone(evidence),
            provenance: "Foundry-manual-snapshot",
            reason:
                `Executed test "${executedTest}" passed. Evidence is a manually-recorded Foundry snapshot ` +
                "(forge test run outside a live endpoint), not an independent re-execution by Node 16."
        };
    }
    if (failed) {
        return {
            source: "Foundry-manual-snapshot",
            role: "PRIMARY",
            observation_state: "FOUND",
            status: "CONTRADICTED",
            evidence: clone(evidence),
            provenance: "Foundry-manual-snapshot",
            reason:
                `Executed test "${executedTest}" failed. Evidence is a manually-recorded Foundry snapshot, ` +
                "not an independent re-execution by Node 16."
        };
    }
    return {
        source: "Foundry-manual-snapshot",
        role: "PRIMARY",
        observation_state: "FOUND",
        status: "UNRESOLVED",
        evidence: clone(evidence),
        provenance: "Foundry-manual-snapshot",
        reason: `Executed test "${executedTest}" recorded, but no explicit pass/fail signal was present.`
    };
}
function assessExperiment(proposition) {
    const live = findLiveExperiment(proposition.proposition_id);
    if (live) {
        return assessLiveExperiment(live);
    }
    return assessManualSnapshot(proposition);
}
// ======================================================================
// HISTORICAL / TEMPORAL
// ======================================================================
// FIX (v1.2): both functions previously returned a hardcoded
// observation_state: "FOUND" unconditionally, regardless of whether the
// historical/temporal node actually returned any usable data -- the
// `historical` and `temporal` variables extracted at the top of this file
// were never read anywhere else. Both sources are CONTEXTUAL (never
// establish proposition status either way), but claiming "FOUND" when the
// upstream node returned nothing is still a false claim in a file whose
// entire design is "never assert evidence that wasn't actually observed."
// Now genuinely checks whether the corresponding payload has content.
function hasUsablePayload(payload) {
    return isObject(payload) && Object.keys(payload).length > 0;
}
function historicalAssessment() {
    const found = hasUsablePayload(historical);
    return {
        source: "Historical",
        role: "CONTEXTUAL",
        observation_state: found ? "FOUND" : "NOT_OBSERVED",
        status: "UNRESOLVED",
        evidence: null,
        reason: found
            ? "Historical evidence is retained for downstream fusion and is not treated as deterministic current-state proof."
            : "No historical evidence payload was available from 09_AI_Historical_Exploit_Reasoner for this run. Had it been available it would still only be retained for downstream fusion, never treated as deterministic current-state proof."
    };
}
function temporalAssessment() {
    const found = hasUsablePayload(temporal);
    return {
        source: "Temporal",
        role: "CONTEXTUAL",
        observation_state: found ? "FOUND" : "NOT_OBSERVED",
        status: "UNRESOLVED",
        evidence: null,
        reason: found
            ? "Temporal evidence is retained for downstream fusion and is not treated as deterministic current-state proof."
            : "No temporal evidence payload was available from 12_Temporal_Evidence_Engine for this run. Had it been available it would still only be retained for downstream fusion, never treated as deterministic current-state proof."
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
                check_id: observation.check_id ?? null,
                provenance: observation.provenance ?? assessment.provenance ?? null
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
        // v1.1: metadata-only passthrough (see header changelog). Not read
        // anywhere in this file; exists for a downstream tracker node only.
        claim_id: finding.claim_id,
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
// SELF-VERIFICATION
// ======================================================================
(function selfVerify() {
    const outputFindingIds = findings.map(f => f.finding_id);
    const outputUnique = new Set(outputFindingIds.map(id => id.toUpperCase()));
    if (outputUnique.size !== outputFindingIds.length) {
        throw new Error(
            `Node 16 (Venus) self-verification failed (I4): duplicate finding IDs present in the output ` +
            `(${outputFindingIds.length} entries / ${outputUnique.size} unique).`
        );
    }
    if (outputFindingIds.some(id => !id)) {
        throw new Error(
            "Node 16 (Venus) self-verification failed (I4): an empty finding_id reached the output."
        );
    }
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
                    `Node 16 (Venus) self-verification failed (I3): proposition ${proposition.proposition_id} ` +
                    `is CONTRADICTED without any explicit (FOUND/ERROR) supporting observation.`
                );
            }
        }
    }
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
                    `Node 16 (Venus) self-verification failed (I2): proposition ${proposition.proposition_id} ` +
                    `has a CONTRADICTED primary observation but an overall SUPPORTED status.`
                );
            }
            if (allSupported && proposition.status === "CONTRADICTED") {
                throw new Error(
                    `Node 16 (Venus) self-verification failed (I2): proposition ${proposition.proposition_id} ` +
                    `has only SUPPORTED primary observations but an overall CONTRADICTED status.`
                );
            }
        }
    }
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
                    `Node 16 (Venus) self-verification failed (I5): proposition ${proposition.proposition_id} ` +
                    `is SUPPORTED but its own architectural_evidence array is empty.`
                );
            }
        }
    }
    for (const finding of findings) {
        for (const proposition of finding.propositions) {
            if (proposition.evidence_requirement !== "EXPERIMENT") {
                continue;
            }
            const decisive = [
                ...proposition.supporting_observations,
                ...proposition.contradicting_observations
            ].filter(o => o.role === "PRIMARY");
            for (const obs of decisive) {
                if (obs.source === "Foundry-manual-snapshot" &&
                    !isNonEmptyString(obs.provenance)) {
                    throw new Error(
                        `Node 16 (Venus) self-verification failed (I6): proposition ${proposition.proposition_id} ` +
                        `was resolved from a manual Foundry snapshot without an explicit provenance label.`
                    );
                }
                if (obs.source === "Foundry-manual-snapshot" &&
                    /live/i.test(obs.provenance) &&
                    !/manual/i.test(obs.provenance)) {
                    throw new Error(
                        `Node 16 (Venus) self-verification failed (I6): proposition ${proposition.proposition_id} ` +
                        `was resolved from a manual snapshot but its provenance label claims a live source.`
                    );
                }
            }
        }
    }
})();
// ======================================================================
// QA
// ======================================================================
const experimentPropositions = findings.flatMap(f =>
    f.propositions.filter(p => p.evidence_requirement === "EXPERIMENT")
);
function primaryDecisiveObs(p) {
    return [...p.supporting_observations, ...p.contradicting_observations]
        .filter(o => o.role === "PRIMARY");
}
const qa = {
    finding_count: findings.length,
    finding_ids_received: rawFindingIds,
    duplicate_finding_ids: duplicateFindingIds,
    empty_or_unparseable_finding_blocks: emptyFindingBlockCount,
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
    behavioural_predicate_count: experimentPropositions.length,
    behavioural_supported_count:
        experimentPropositions.filter(p => p.status === "SUPPORTED").length,
    behavioural_contradicted_count:
        experimentPropositions.filter(p => p.status === "CONTRADICTED").length,
    behavioural_unresolved_count:
        experimentPropositions.filter(p => p.status === "UNRESOLVED").length,
    behavioural_evidence_source_breakdown: {
        foundry_live:
            experimentPropositions.filter(p =>
                primaryDecisiveObs(p).some(o => o.source === "Foundry-live")
            ).length,
        foundry_manual_snapshot:
            experimentPropositions.filter(p =>
                primaryDecisiveObs(p).some(o => o.source === "Foundry-manual-snapshot")
            ).length,
        none:
            experimentPropositions.filter(p => primaryDecisiveObs(p).length === 0).length
    },
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
            node: "Node 16 (Venus) - Deterministic Evidence Anchor",
            version: "1.2",
            methodology: {
                purpose:
                    "Map fixed Node 13 (Venus) propositions to the evidence capable of establishing them.",
                proposition_source: "Node 13 (Venus) only.",
                truth_space: ["SUPPORTED", "CONTRADICTED", "UNRESOLVED"],
                truth_space_model:
                    "Kleene strong three-valued logic (K3): SUPPORTED = true, CONTRADICTED = false, " +
                    "UNRESOLVED = unknown/indeterminate.",
                observation_aggregation:
                    "K3 conjunction: CONTRADICTED if any observation contradicts; SUPPORTED only if " +
                    "every observation supports; UNRESOLVED otherwise. Order-independent.",
                finding_aggregation:
                    "Total classification over (supported_count, contradicted_count, total_count).",
                deterministic_sources: ["Architecture", "Foundry-live", "Foundry-manual-snapshot"],
                contextual_sources: ["Historical", "Temporal"],
                finding_identity:
                    "Open taxonomy (unlike Aave's fixed F01-F11): any non-empty finding_id is accepted; " +
                    "the only enforced invariant is no duplicates within a run (invariant I4).",
                source_relationship: "Architecture is primary.",
                runtime_existence: "Foundry is primary (independent node preferred; Node 13's own mirrored " +
                    "runtime observations used only as a last resort).",
                resolver_execution: "Foundry resolver execution is primary (unused by current Venus findings).",
                experiment:
                    "A live Foundry experiment result is preferred when available. When none exists, Node 13 " +
                    "(Venus)'s own manually-recorded validation_result/validation_evidence is used as a gated " +
                    "fallback: only accepted as SUPPORTED/CONTRADICTED when it names a real executed test " +
                    "(requires_execution === false and a non-empty executed_test), and every such result is " +
                    "explicitly labelled Foundry-manual-snapshot so it is never presented as a live execution " +
                    "(invariant I6). A proposed-but-unexecuted experiment stays UNRESOLVED regardless of source.",
                missing_evidence: "UNRESOLVED",
                explicit_failure: "CONTRADICTED",
                inferred_failure: false,
                architectural_inference_of_behaviour: false,
                missing_findings_are_invented: false,
                evidence_locality:
                    "A proposition may only be established by evidence mapped to that proposition " +
                    "specifically; finding-level evidence cannot substitute (invariant I5).",
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
