/***********************************************************************
 * NODE 16 — DETERMINISTIC EVIDENCE ANCHOR (COMPOUND VARIANT)
 * VERSION 1.1
 *
 * v1.1 changelog (post-delivery corrections, confirmed via real n8n runs):
 *   1. NODE_13_CANDIDATES originally included "13_Deterministic Evidence
 *      Fusion" as a guess -- that name actually belongs to the Deterministic
 *      Evidence Fusion Engine, a different upstream node. Removed, and the
 *      correct node name ("13_Deterministic_Evidence_Specification_Compound")
 *      moved to the front of the candidate list.
 *   2. The findings-mapping block only read the resolved-finding field
 *      shape (finding_name/sources[]/claim_ids_by_source/...) and silently
 *      dropped identifying/explanatory data for all UNMAPPED-* findings,
 *      which use a different shape (source/claim_id/source_finding_name/
 *      reason/resolution_debug). Both shapes are now read with fallbacks;
 *      see the FIX comment above the `findings` mapping below.
 * See 16_Deterministic_Evidence_Anchor_CHANGELOG.md for full details.
 *
 * Companion to 13_deterministic_evidence_specification_compound.js, in
 * the same relationship the Venus Node 16 (16_deterministic_evidence_
 * anchor_venus.js) has to its own Node 13.
 *
 * ARCHITECTURAL NOTE -- WHY THIS FILE LOOKS DIFFERENT FROM THE AAVE/VENUS
 * NODE 16s, AND WHY THAT IS CORRECT, NOT A REGRESSION OR A SHORTCUT
 * ----------------------------------------------------------------------
 * Aave's and Venus's Node 13 files only DECLARE propositions/predicates
 * (a claim, plus which evidence type would establish it) and leave ALL
 * evaluation against live Foundry/architecture/behavioural evidence to
 * Node 16 -- Node 16 independently fetches 10_Foundry_Validation, the
 * architecture reasoner, and behavioural results, and decides
 * SUPPORTED/CONTRADICTED/UNRESOLVED itself.
 *
 * Compound's Node 13 does not follow that split. It evaluates every
 * predicate itself, inline, against the same live sources (real
 * 10_Foundry_Validation runtime data via its own `runtime` object,
 * unioned Node 07/08 architectural evidence via SOURCE_EVIDENCE_MAP, and
 * a disclosed real forge-test snapshot -- MANUAL_FOUNDRY_SNAPSHOT -- for
 * behavioural claims) and already emits a `validation_result` per
 * predicate: PASS / FAIL / UNVERIFIABLE / MAPPED_PENDING_INDEPENDENT_
 * VERIFICATION / NOT_TESTED / EXECUTED_PRECONDITION_UNMET. That was a
 * deliberate, disclosed design choice in that file (see its own header
 * and evaluateRuntimePredicate/evaluateSourcePredicate/
 * buildBehaviouralPredicate), not an oversight this file needs to work
 * around.
 *
 * Re-implementing Aave/Venus's independent-evaluation logic on top of
 * Compound's Node 13 here would either (a) silently duplicate real
 * evaluation logic that could drift out of sync with Node 13's own, or
 * (b) require re-fetching and re-deriving the exact same Foundry/
 * architecture/behavioural evidence Node 13 already processed, for no
 * independent-verification benefit -- Node 13's evaluation is fully
 * inspectable deterministic code, not an LLM guess standing in for
 * evidence.
 *
 * So Node 16 (Compound)'s actual job is: take Node 13's already-real,
 * already-evaluated validation_result per predicate and re-express it in
 * the SAME K3 (SUPPORTED/CONTRADICTED/UNRESOLVED) truth space, output
 * shape, and self-verification discipline as the Aave/Venus Node 16s --
 * so downstream nodes (17/18, ERA) can consume all three protocols
 * uniformly -- without silently upgrading Compound's own more
 * conservative epistemic labels into something stronger than Compound's
 * own Node 13 actually claims. metadata.independent_re_evaluation_
 * performed is explicitly set to false below to disclose this difference
 * rather than let it be inferred silently from output shape alone.
 *
 * VALIDATION_RESULT -> K3 STATUS MAPPING
 * ----------------------------------------------------------------------
 *   PASS                                     -> SUPPORTED
 *   FAIL                                     -> CONTRADICTED
 *   NOT_TESTED                               -> UNRESOLVED
 *   UNVERIFIABLE                             -> UNRESOLVED
 *   EXECUTED_PRECONDITION_UNMET              -> UNRESOLVED
 *   MAPPED_PENDING_INDEPENDENT_VERIFICATION  -> UNRESOLVED
 *
 * The last one is deliberately NOT mapped to SUPPORTED, even though
 * Aave/Venus's Node 16 treats an equivalent "proposition-specific
 * architecture evidence exists" state as SUPPORTED for SOURCE_
 * RELATIONSHIP claims. Compound's own Node 13 evaluator explicitly
 * labels this state "mapped to the predicate but ... not independently
 * treated as deterministic proof" (see its evaluateSourcePredicate
 * limitation text) -- that is Compound's Node 13 being MORE conservative
 * than Aave/Venus's Node 16 is for the structurally same evidence type.
 * This file preserves that conservatism rather than silently overriding
 * it for cross-protocol consistency. It is a genuine, disclosed
 * methodological asymmetry across the three protocol pipelines, flagged
 * here and in the output's methodology block so it is a deliberate
 * discussion point in the dissertation, not a silent inconsistency
 * someone finds later.
 *
 * NEGATIVE CONTROL HANDLING (UPGRADEABILITY_01)
 * ----------------------------------------------------------------------
 * Node 13 (Compound) marks this finding's finding_polarity as
 * "NEGATIVE_CONTROL" and its own header warns: "PASS here should be read
 * by downstream nodes ... as 'risk ruled out', never as 'risk
 * confirmed'." finding_polarity is passed through unchanged, and this
 * file additionally derives an explicit status_interpretation per
 * finding (RISK_RULED_OUT / RISK_CONFIRMED / RISK_CONTRADICTED /
 * INDETERMINATE) from (status, finding_polarity), so a downstream reader
 * never has to re-derive polarity semantics from status plus a separate
 * flag by hand.
 *
 * WHAT IS UNCHANGED FROM THE AAVE/VENUS NODE 16s
 * ----------------------------------------------------------------------
 * K3 truth space; CONTEXTUAL (never status-deciding) treatment of
 * Historical/Temporal evidence, with the same "only claim FOUND if the
 * payload genuinely has content" discipline fixed in Venus v1.2 (not
 * reintroduced here as a bug to fix later); claim/source passthrough
 * (Compound's Node 13 already carries claim_ids_by_source, claim_ids_
 * agree, sources, anchor_tokens_matched -- passed through unchanged, the
 * same intent as Aave/Venus's claim_id passthrough); open finding-ID
 * taxonomy with a no-duplicates invariant (I4); a self-verification pass
 * before returning.
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
// Defensive candidate list, same reasoning as Node 13 (Compound)'s own
// NODE_08_CANDIDATES: a wrong single guess here degrades silently to
// "Node 16 saw nothing", so several plausible live-canvas names are
// tried before falling back to whatever fed this node directly.
const NODE_13_CANDIDATES = [
    "13_Deterministic_Evidence_Specification_Compound", // the node you'll create for this -- see setup note below
    "13_Deterministic_Evidence_Specification",
    "Deterministic Evidence Specification (Compound)",
    "13_Deterministic_Evidence_Anchor_Compound"
    // NOTE: "13_Deterministic Evidence Fusion" was tried here in an earlier
    // revision and removed after checking the real Compound canvas export
    // (2026-08-19): that name belongs to the Deterministic Evidence Fusion
    // Engine (Deterministic_Evidence_Fusion_Engine.js) -- a different node
    // entirely, upstream of this one, that fuses runtime/architecture/
    // historical/temporal confidence and has nothing to do with Node 13's
    // predicate specification. It was never the right candidate; keeping it
    // in this list would just silently match the wrong node's output again.
    // As of this revision, NO node on the real Compound canvas actually runs
    // 13_deterministic_evidence_specification_compound.js -- it needs to be
    // pasted into a new Code node named to match the first candidate above.
];
let node13Root = null;
for (const name of NODE_13_CANDIDATES) {
    const data = getNodeJSON(name);
    if (data) {
        node13Root = data;
        break;
    }
}
if (!node13Root) {
    node13Root = $input.first().json;
}
// Node 13 (Compound) wraps its real output in a `deterministic_evidence`
// key; unwrap it here so the rest of this file can read `node13.findings`
// directly, but tolerate being handed the unwrapped object too.
const node13 =
    node13Root && typeof node13Root === "object" && node13Root.deterministic_evidence
        ? node13Root.deterministic_evidence
        : node13Root;
const historical = getNodeJSON("09_AI_Historical_Exploit_Reasoner") || {};
const temporal = getNodeJSON("12_Temporal_Evidence_Engine") || {};
// ======================================================================
// GENERIC HELPERS
// ======================================================================
function str(value) {
    return value == null ? "" : String(value);
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
function hasUsablePayload(payload) {
    return isObject(payload) && Object.keys(payload).length > 0;
}
// ======================================================================
// VALIDATION_RESULT -> K3 STATUS MAPPING
// ======================================================================
const RESULT_TO_STATUS = {
    PASS: "SUPPORTED",
    FAIL: "CONTRADICTED",
    NOT_TESTED: "UNRESOLVED",
    UNVERIFIABLE: "UNRESOLVED",
    EXECUTED_PRECONDITION_UNMET: "UNRESOLVED",
    MAPPED_PENDING_INDEPENDENT_VERIFICATION: "UNRESOLVED"
};
function mapResultToStatus(result) {
    return Object.prototype.hasOwnProperty.call(RESULT_TO_STATUS, result)
        ? RESULT_TO_STATUS[result]
        : "UNRESOLVED";
}
// ======================================================================
// SOURCE / PROVENANCE CLASSIFICATION PER PREDICATE
// ======================================================================
function classifySource(predicate) {
    const requirement = predicate.evidence_requirement;
    const ve = predicate.validation_evidence || {};
    if (requirement === "RUNTIME_EXISTENCE") {
        return { source: "Foundry", provenance: "Foundry-live" };
    }
    if (requirement === "SOURCE_RELATIONSHIP") {
        return { source: "Architecture", provenance: null };
    }
    if (requirement === "EXPERIMENT") {
        const evidenceSourceText = str(ve.evidence_source);
        if (/live foundry behavioral endpoint/i.test(evidenceSourceText)) {
            return { source: "Foundry-live", provenance: "Foundry-live" };
        }
        if (/manual forge test snapshot/i.test(evidenceSourceText)) {
            return { source: "Foundry-manual-snapshot", provenance: "Foundry-manual-snapshot" };
        }
        // NOT_TESTED -- no executed evidence at all yet.
        return { source: "Foundry-manual-snapshot", provenance: "none" };
    }
    return { source: "Unknown", provenance: null };
}
// ======================================================================
// HISTORICAL / TEMPORAL (contextual only)
// Same discipline as Venus v1.2: only claim FOUND if the upstream node
// actually returned usable content, never unconditionally.
// ======================================================================
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
// PREDICATE -> PROPOSITION ASSESSMENT
// Compound's Node 13 already produced exactly one decisive evaluation
// per predicate (validation_result), unlike Aave/Venus's multi-
// observation-then-K3-AND-combine pattern -- there is nothing to combine
// here, only to translate.
// ======================================================================
function assessPredicate(predicate) {
    const requirement = predicate.evidence_requirement;
    const result = predicate.validation_result;
    const status = mapResultToStatus(result);
    const { source, provenance } = classifySource(predicate);
    const evidence = predicate.validation_evidence ? clone(predicate.validation_evidence) : null;
    const primaryObservation = {
        proposition_id: predicate.predicate_id,
        proposition: predicate.claim,
        source,
        role: "PRIMARY",
        status,
        observation_state: evidence ? "FOUND" : "NOT_OBSERVED",
        evidence,
        reason: (evidence && (evidence.reason || evidence.limitation)) || null,
        check_id: null,
        provenance
    };
    const historicalResult = historicalAssessment();
    const temporalResult = temporalAssessment();
    const supporting = [];
    const contradicting = [];
    const unresolved = [];
    if (status === "SUPPORTED") {
        supporting.push(primaryObservation);
    } else if (status === "CONTRADICTED") {
        contradicting.push(primaryObservation);
    } else {
        unresolved.push(primaryObservation);
    }
    return {
        proposition_id: predicate.predicate_id,
        proposition: predicate.claim,
        evidence_requirement: requirement,
        level: predicate.level || null,
        layer: predicate.layer || null,
        validation_result: result,
        status,
        source_assessments: {
            primary: primaryObservation,
            historical: historicalResult,
            temporal: temporalResult
        },
        supporting_observations: supporting,
        contradicting_observations: contradicting,
        unresolved_observations: unresolved
    };
}
// ======================================================================
// FINDING STATUS (identical logic to Aave/Venus Node 16 -- reused
// unchanged since the aggregation rule itself doesn't depend on how
// each proposition's status was derived)
// ======================================================================
function classifyFindingStatus(propositions) {
    if (!propositions.length) {
        return "UNRESOLVED";
    }
    const total = propositions.length;
    const supported = propositions.filter(p => p.status === "SUPPORTED").length;
    const contradicted = propositions.filter(p => p.status === "CONTRADICTED").length;
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
// STATUS INTERPRETATION (polarity-aware, so a negative control's PASS is
// never misread downstream as "risk confirmed")
// ======================================================================
function deriveStatusInterpretation(findingStatus, polarity) {
    const isNegativeControl = polarity === "NEGATIVE_CONTROL";
    if (findingStatus === "FULLY_SUPPORTED") {
        return isNegativeControl ? "RISK_RULED_OUT" : "RISK_CONFIRMED";
    }
    if (findingStatus === "CONTRADICTED") {
        return isNegativeControl ? "RISK_CONFIRMED" : "RISK_CONTRADICTED";
    }
    return "INDETERMINATE";
}
// ======================================================================
// PROCESS FINDINGS
// ======================================================================
const rawFindings = Array.isArray(node13?.findings) ? node13.findings : [];
const rawFindingIds = rawFindings.map(f => String(f?.finding_id || "").trim()).filter(Boolean);
const duplicateFindingIds = [
    ...new Set(
        rawFindingIds
            .map(id => id.toUpperCase())
            .filter((id, index, arr) => arr.indexOf(id) !== index)
    )
];
if (REQUIRE_UNIQUE_FINDING_IDS && duplicateFindingIds.length > 0) {
    throw new Error(
        [
            "Node 16 (Compound): Node 13 (Compound) supplied the same finding_id more than once in a single run.",
            `Duplicated: ${duplicateFindingIds.join(", ")}.`,
            `All finding IDs received: ${rawFindingIds.join(", ") || "NONE"}.`,
            "Node 16 (Compound) will not silently absorb duplicated findings, even though Compound's finding taxonomy is open."
        ].join(" ")
    );
}
if (!rawFindings.length) {
    throw new Error(
        "Node 16 (Compound): Node 13 (Compound) supplied no findings. Check the NODE_13_CANDIDATES list against the real live node name if this node was actually wired and ran."
    );
}
// FIX: Node 13 (Compound) uses two different field shapes -- resolved
// findings carry finding_name/sources[]/claim_ids_by_source/risk_category/
// finding_resolution/anchor_tokens_matched, but the 21 UNMAPPED-* findings
// (buildUnmappedFinding in Node 13) carry a DIFFERENT shape entirely:
// source (singular string, not sources[]), claim_id (singular, not
// claim_ids_by_source), source_finding_name, reason, and resolution_debug
// -- none of which existed on the resolved-finding field names this code
// originally read. The first version of this mapping only knew the
// resolved-finding names, so every UNMAPPED finding silently lost its
// source finding name, its reason for being unmapped, its claim_id, and
// which source (Node07/Node08) it came from -- exactly the transparency
// data Node 13's own design exists to disclose. Both shapes are now read,
// with fallbacks, and the unmapped-specific fields are carried through
// under their own names rather than force-fit into the resolved shape.
const findings = rawFindings.map(finding => {
    const predicates = Array.isArray(finding.predicates) ? finding.predicates : [];
    const propositions = predicates.map(assessPredicate);
    const status = classifyFindingStatus(propositions);
    return {
        finding_id: finding.finding_id,
        finding_name: finding.finding_name || finding.source_finding_name || finding.finding_id,
        finding_polarity: finding.finding_polarity || "STANDARD",
        risk_category: finding.risk_category ?? null,
        severity: finding.severity ?? null,
        finding_resolution: finding.finding_resolution ?? null,
        // Node 13's "validation_status" (READY_FOR_FUSION / NO_SPECIFICATION)
        // is a useful passthrough distinct from this file's own K3 `status`.
        node13_validation_status: finding.validation_status ?? null,
        sources: Array.isArray(finding.sources)
            ? finding.sources
            : (finding.source ? [finding.source] : []),
        claim_ids_by_source: finding.claim_ids_by_source ?? null,
        // UNMAPPED findings carry a single claim_id instead of a
        // per-source breakdown -- preserved here rather than dropped.
        claim_id: finding.claim_id ?? null,
        claim_ids_agree: finding.claim_ids_agree ?? null,
        anchor_tokens_matched: Array.isArray(finding.anchor_tokens_matched) ? finding.anchor_tokens_matched : [],
        // Why an UNMAPPED finding didn't resolve to a spec key, and the
        // full anchor-token resolution debug trail Node 13 already built --
        // both previously discarded entirely.
        unmapped_reason: finding.reason ?? null,
        resolution_debug: finding.resolution_debug ?? null,
        deterministic_ready: finding.deterministic_ready ?? (predicates.length > 0),
        status,
        status_interpretation: deriveStatusInterpretation(status, finding.finding_polarity),
        propositions,
        deterministic_evidence: {
            supporting_observations: propositions.flatMap(p => p.supporting_observations),
            contradicting_observations: propositions.flatMap(p => p.contradicting_observations),
            unresolved_observations: propositions.flatMap(p => p.unresolved_observations)
        }
    };
});
// ======================================================================
// SELF-VERIFICATION
// ======================================================================
(function selfVerify() {
    // I4: no duplicates, no empty IDs, re-checked on the actual output.
    const outputFindingIds = findings.map(f => f.finding_id);
    const outputUnique = new Set(outputFindingIds.map(id => String(id).toUpperCase()));
    if (outputUnique.size !== outputFindingIds.length) {
        throw new Error(
            `Node 16 (Compound) self-verification failed (I4): duplicate finding IDs present in the output ` +
            `(${outputFindingIds.length} entries / ${outputUnique.size} unique).`
        );
    }
    if (outputFindingIds.some(id => !id)) {
        throw new Error(
            "Node 16 (Compound) self-verification failed (I4): an empty finding_id reached the output."
        );
    }
    // I2-equivalent: the validation_result -> status mapping was applied
    // consistently everywhere, not just in the common case.
    for (const finding of findings) {
        for (const proposition of finding.propositions) {
            const expected = mapResultToStatus(proposition.validation_result);
            if (proposition.status !== expected) {
                throw new Error(
                    `Node 16 (Compound) self-verification failed (I2): proposition ${proposition.proposition_id} ` +
                    `has validation_result "${proposition.validation_result}" but status "${proposition.status}" ` +
                    `(expected "${expected}").`
                );
            }
        }
    }
    // I5-equivalent: SOURCE_RELATIONSHIP predicates must never reach
    // SUPPORTED, because Compound's own Node 13 evaluator
    // (evaluateSourcePredicate) never emits a result strong enough to
    // justify it -- only UNVERIFIABLE or MAPPED_PENDING_INDEPENDENT_
    // VERIFICATION are possible for this evidence_requirement. If this
    // ever fires, either Node 13 (Compound) started emitting a new result
    // value for this requirement, or this file's RESULT_TO_STATUS mapping
    // needs review -- either way, it should be looked at, not silently
    // accepted.
    for (const finding of findings) {
        for (const proposition of finding.propositions) {
            if (proposition.evidence_requirement === "SOURCE_RELATIONSHIP" && proposition.status === "SUPPORTED") {
                throw new Error(
                    `Node 16 (Compound) self-verification failed (I5): proposition ${proposition.proposition_id} ` +
                    `is SOURCE_RELATIONSHIP and SUPPORTED -- Node 13 (Compound) was not expected to ever emit a ` +
                    `result this strong for this evidence type. Check whether Node 13's evaluateSourcePredicate ` +
                    `changed, or this file's RESULT_TO_STATUS mapping needs review.`
                );
            }
        }
    }
    // I6-equivalent: manual-vs-live labeling here must never contradict
    // the evidence_source text Node 13 itself wrote.
    for (const finding of findings) {
        for (const proposition of finding.propositions) {
            if (proposition.evidence_requirement !== "EXPERIMENT") {
                continue;
            }
            const obs = proposition.source_assessments.primary;
            const evidenceSourceText = str(obs.evidence && obs.evidence.evidence_source);
            if (obs.provenance === "Foundry-manual-snapshot" && /live foundry behavioral endpoint/i.test(evidenceSourceText)) {
                throw new Error(
                    `Node 16 (Compound) self-verification failed (I6): proposition ${proposition.proposition_id} ` +
                    `was labeled Foundry-manual-snapshot but Node 13's own evidence_source text claims a live endpoint.`
                );
            }
            if (obs.provenance === "Foundry-live" && /manual forge test snapshot/i.test(evidenceSourceText)) {
                throw new Error(
                    `Node 16 (Compound) self-verification failed (I6): proposition ${proposition.proposition_id} ` +
                    `was labeled Foundry-live but Node 13's own evidence_source text claims a manual snapshot.`
                );
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
const qa = {
    finding_count: findings.length,
    finding_ids_received: rawFindingIds,
    duplicate_finding_ids: duplicateFindingIds,
    deterministic_ready_findings: findings.filter(f => f.deterministic_ready).length,
    non_deterministic_findings: findings.filter(f => !f.deterministic_ready).length,
    negative_control_findings: findings.filter(f => f.finding_polarity === "NEGATIVE_CONTROL").length,
    proposition_count: findings.reduce((sum, finding) => sum + finding.propositions.length, 0),
    contradiction_count: findings.reduce(
        (sum, finding) => sum + finding.deterministic_evidence.contradicting_observations.length,
        0
    ),
    behavioural_predicate_count: experimentPropositions.length,
    behavioural_supported_count: experimentPropositions.filter(p => p.status === "SUPPORTED").length,
    behavioural_contradicted_count: experimentPropositions.filter(p => p.status === "CONTRADICTED").length,
    behavioural_unresolved_count: experimentPropositions.filter(p => p.status === "UNRESOLVED").length,
    behavioural_predicates_executed_precondition_unmet:
        experimentPropositions.filter(p => p.validation_result === "EXECUTED_PRECONDITION_UNMET").length,
    behavioural_predicates_not_tested:
        experimentPropositions.filter(p => p.validation_result === "NOT_TESTED").length,
    behavioural_evidence_source_breakdown: {
        foundry_live: experimentPropositions.filter(p => p.source_assessments.primary.provenance === "Foundry-live").length,
        foundry_manual_snapshot: experimentPropositions.filter(p => p.source_assessments.primary.provenance === "Foundry-manual-snapshot").length,
        none: experimentPropositions.filter(p => p.source_assessments.primary.provenance === "none").length
    },
    probability_assigned: false,
    confidence_assigned: false,
    dst_performed: false,
    llm_fused: false,
    // Explicit disclosure: unlike the Aave/Venus Node 16 files, this file
    // does not independently re-derive evidence from Foundry/architecture
    // -- it classifies Node 13 (Compound)'s own already-real evaluation.
    // See header comment for why.
    independent_re_evaluation_performed: false,
    self_verification_passed: true
};
// ======================================================================
// FINAL OUTPUT
// ======================================================================
return [
    {
        json: {
            node: "Node 16 (Compound) - Deterministic Evidence Anchor",
            version: "1.1",
            methodology: {
                purpose:
                    "Re-express Node 13 (Compound)'s already-evaluated predicate results in the same K3 truth " +
                    "space, output shape, and self-verification discipline used by the Aave and Venus Node 16 " +
                    "files, without independently re-deriving evidence Node 13 (Compound) has already evaluated inline.",
                proposition_source: "Node 13 (Compound) only.",
                truth_space: ["SUPPORTED", "CONTRADICTED", "UNRESOLVED"],
                truth_space_model:
                    "Kleene strong three-valued logic (K3): SUPPORTED = true, CONTRADICTED = false, " +
                    "UNRESOLVED = unknown/indeterminate.",
                evaluation_performed_by:
                    "Node 13 (Compound). This file classifies Node 13's validation_result into K3 status; it " +
                    "does not re-run evaluation against Foundry/architecture/behavioural evidence itself " +
                    "(unlike the Aave/Venus Node 16 files -- see independent_re_evaluation_performed in qa).",
                validation_result_to_status_mapping: RESULT_TO_STATUS,
                mapped_pending_independent_verification_note:
                    "Deliberately mapped to UNRESOLVED, not SUPPORTED, preserving Node 13 (Compound)'s own " +
                    "more conservative label for SOURCE_RELATIONSHIP evidence -- see header comment for why " +
                    "this differs from Aave/Venus's SOURCE_RELATIONSHIP handling (a disclosed, deliberate " +
                    "cross-protocol asymmetry, not a bug).",
                negative_control_handling:
                    "finding_polarity is passed through unchanged from Node 13 (Compound); status_interpretation " +
                    "(RISK_RULED_OUT / RISK_CONFIRMED / RISK_CONTRADICTED / INDETERMINATE) is derived from " +
                    "(status, finding_polarity) so PASS on a negative control is never misread as risk " +
                    "confirmation downstream.",
                deterministic_sources: ["Architecture", "Foundry", "Foundry-live", "Foundry-manual-snapshot"],
                contextual_sources: ["Historical", "Temporal"],
                finding_identity:
                    "Open taxonomy (like Venus, unlike Aave's fixed F01-F11): any non-empty finding_id is " +
                    "accepted; the only enforced invariant is no duplicates within a run (invariant I4).",
                missing_evidence: "UNRESOLVED",
                explicit_failure: "CONTRADICTED",
                inferred_failure: false,
                architectural_inference_of_behaviour: false,
                missing_findings_are_invented: false,
                evidence_locality:
                    "A proposition may only be established by evidence Node 13 (Compound) itself mapped to " +
                    "that proposition; finding-level evidence cannot substitute (invariant I5).",
                probability_assigned: false,
                confidence_assigned: false,
                risk_score_assigned: false,
                dst_performed: false,
                llm_fused: false,
                independent_re_evaluation_performed: false
            },
            qa,
            findings
        }
    }
];
