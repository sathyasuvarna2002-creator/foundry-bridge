/***********************************************************************
 * NODE 19 — DISMISSED-FINDING / CONTINUOUS-MONITORING TRACKER
 * VERSION 1.0
 *
 * (Number is a suggestion, not fixed by any upstream contract -- 17/18
 * are taken by DST fusion/calibration, which this node does not touch,
 * read from, or feed into.)
 *
 * PURPOSE
 * -------
 * For each audit/incident-sourced finding (Node 08), determine whether
 * today's Node 16 (Venus) run independently re-establishes the same
 * underlying claim -- i.e. "is this old, possibly-dismissed finding
 * still true today, according to real current evidence."
 *
 * THIS NODE DOES NOT:
 *   - re-derive or override Node 16's status in any way
 *   - infer a match from risk_category, finding_name, or finding_id
 *     (finding_id is explicitly documented, by Node 07's own schema, as
 *     UNSTABLE across runs -- using it to match would silently produce
 *     wrong joins)
 *   - guess a match when claim_id is missing, ambiguous, or absent from
 *     today's Node 16 output
 *   - compute is_still_open, currently_supported, or
 *     status_changed_since_disposition without a real, exact-matched
 *     current_verification behind it
 *
 * MATCHING RULE (exact only, per spec)
 * -------------------------------------
 * Every audit-sourced claim produces EXACTLY ONE of two outcomes:
 *   EXACT_CLAIM_ID               -- audit.claim_id is a non-empty string,
 *                                    and it matches exactly one finding's
 *                                    claim_id in today's Node 16 output.
 *   NO_CURRENT_VERIFICATION_AVAILABLE -- anything else: missing claim_id,
 *                                    no exact match, or a collision (more
 *                                    than one Node 16 finding sharing the
 *                                    same claim_id -- see self-verification
 *                                    below; this is treated as "cannot
 *                                    safely match," not as a third
 *                                    category, per spec).
 * No finding-name matching, no fuzzy matching, no partial token overlap.
 * If it isn't an exact claim_id match, it is
 * NO_CURRENT_VERIFICATION_AVAILABLE, full stop.
 *
 * PHASE 2 (explicitly out of scope here)
 * ----------------------------------------
 * Historical block-height replay (re-running Node 10/13/16 against
 * forked state at multiple points between date_flagged and today, to
 * build a genuine time series rather than a single today-snapshot) is a
 * separate, later experiment. This node only ever produces a single
 * as-of-today verification per claim.
 ***********************************************************************/

// ======================================================================
// CONFIGURATION
// ======================================================================
const TODAY_ISO = (new Date()).toISOString().slice(0, 10); // as-of date for this run

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

// Node 08's finding list (audit/incident-sourced findings, Node 07 schema
// + provenance block). Falls back to $input for standalone testing.
const node08 =
    getNodeJSON("08_Audit_Incident_Ingestion") ||
    $input.first().json;

// Node 16 (Venus)'s output, v1.1+ (must carry claim_id -- see
// NODE16_CLAIM_ID_BEFORE_AFTER.md).
const node16 =
    getNodeJSON("16_Deterministic_Evidence_Anchor_Venus") || {};

// ======================================================================
// HELPERS
// ======================================================================
function str(value) {
    return value == null ? "" : String(value);
}
function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
}
function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

// ======================================================================
// EXTRACT AUDIT-SOURCED FINDINGS (Node 08 output, or Node07+08 unioned --
// only items carrying a provenance block are in scope for this tracker)
// ======================================================================
function extractAuditFindings(root) {
    const candidates = [
        root?.architectural_risks,
        root?.output?.architectural_risks,
        root?.findings
    ];
    let raw = null;
    for (const candidate of candidates) {
        if (Array.isArray(candidate)) {
            raw = candidate;
            break;
        }
    }
    if (!raw) {
        return [];
    }
    // Only audit/incident-sourced findings carry a provenance block. A
    // plain Node 07 finding (no provenance) is out of scope for this
    // tracker -- it has no historical disposition to track against.
    return raw.filter(f => isObject(f?.provenance));
}
const auditFindings = extractAuditFindings(node08);

// ======================================================================
// INDEX TODAY'S NODE 16 OUTPUT BY claim_id
// ======================================================================
const node16Findings = Array.isArray(node16?.findings) ? node16.findings : [];

const node16ByClaimId = new Map();
const claimIdCollisions = new Set();
for (const f of node16Findings) {
    const cid = isNonEmptyString(f?.claim_id) ? f.claim_id.trim() : null;
    if (!cid) {
        continue; // Node 16 finding has no claim_id -- cannot be a match target
    }
    if (node16ByClaimId.has(cid)) {
        // Collision: more than one Node 16 finding shares this claim_id.
        // Per spec, this is NOT treated as an exact match -- remove it as
        // a valid target rather than picking one arbitrarily.
        claimIdCollisions.add(cid);
        continue;
    }
    node16ByClaimId.set(cid, f);
}
// Ensure a collided claim_id is never left resolvable via a partial
// insert from before the second occurrence was seen.
for (const cid of claimIdCollisions) {
    node16ByClaimId.delete(cid);
}

// ======================================================================
// DAYS OPEN (never negative; explicit null + reason if unparseable)
// ======================================================================
function computeDaysOpen(dateFlaggedRaw) {
    if (!isNonEmptyString(dateFlaggedRaw)) {
        return { days_open: null, reason: "date_flagged missing or not a string." };
    }
    const flagged = new Date(dateFlaggedRaw + "T00:00:00Z");
    if (isNaN(flagged.getTime())) {
        return { days_open: null, reason: `date_flagged "${dateFlaggedRaw}" is not a parseable ISO date.` };
    }
    const today = new Date(TODAY_ISO + "T00:00:00Z");
    const diffMs = today.getTime() - flagged.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days < 0) {
        return { days_open: null, reason: `date_flagged "${dateFlaggedRaw}" is in the future relative to run date ${TODAY_ISO} -- refusing to report a negative days_open.` };
    }
    return { days_open: days, reason: null };
}

// ======================================================================
// CURRENTLY-SUPPORTED (pure function of today's Node 16 status --
// independent of what the original audit disposition said)
// ======================================================================
const STATUSES_WITH_REAL_SUPPORT = new Set([
    "FULLY_SUPPORTED",
    "PARTIALLY_SUPPORTED",
    "MIXED_SUPPORT_AND_CONTRADICTION"
]);
function isCurrentlySupported(node16Status) {
    return STATUSES_WITH_REAL_SUPPORT.has(node16Status);
}

// Dispositions that mean "known and not remediated" as of the audit.
const DISPOSITIONS_NOT_REMEDIATED = new Set([
    "DISMISSED_AS_INTENDED",
    "ACKNOWLEDGED_NO_FIX",
    "UNKNOWN" // unknown disposition cannot be treated as "was fixed" either
]);
const DISPOSITIONS_CLAIMED_FIXED = new Set(["FIXED", "PARTIALLY_FIXED"]);

// ======================================================================
// BUILD ONE TRACKED RECORD PER AUDIT FINDING
// ======================================================================
function buildRecord(audit) {
    const claimId = isNonEmptyString(audit?.claim_id) ? audit.claim_id.trim() : null;
    const provenance = audit.provenance || {};
    const disposition = provenance.original_disposition || {};

    const matched = claimId ? node16ByClaimId.get(claimId) : undefined;
    const matchMethod = matched ? "EXACT_CLAIM_ID" : "NO_CURRENT_VERIFICATION_AVAILABLE";

    const { days_open, reason: daysOpenReason } = computeDaysOpen(provenance.date_flagged);

    let currentVerification = null;
    let currentlySupported = null;
    let isStillOpen = null;
    let statusChanged = null;
    let statusChangedReason = null;

    if (matchMethod === "EXACT_CLAIM_ID") {
        currentVerification = {
            run_date: TODAY_ISO,
            node16_finding_id: matched.finding_id,
            node16_finding_name: matched.finding_name,
            node16_status: matched.status,
            proposition_statuses: (matched.propositions || []).map(p => ({
                proposition_id: p.proposition_id,
                evidence_requirement: p.evidence_requirement,
                status: p.status
            }))
        };
        currentlySupported = isCurrentlySupported(matched.status);

        const dispositionCategory = disposition.category || "UNKNOWN";
        if (DISPOSITIONS_NOT_REMEDIATED.has(dispositionCategory)) {
            isStillOpen = currentlySupported === true;
            if (DISPOSITIONS_CLAIMED_FIXED.has(dispositionCategory)) {
                // unreachable given the set split above, kept for clarity
            }
        } else if (DISPOSITIONS_CLAIMED_FIXED.has(dispositionCategory)) {
            // Team said fixed. If today's independent evidence still shows
            // real support, that is a disagreement worth surfacing loudly
            // -- but is_still_open is still answered from real evidence,
            // never from trusting the "fixed" label.
            isStillOpen = currentlySupported === true;
        }

        statusChanged =
            (DISPOSITIONS_CLAIMED_FIXED.has(dispositionCategory) && currentlySupported === true) ||
            (DISPOSITIONS_NOT_REMEDIATED.has(dispositionCategory) && dispositionCategory !== "UNKNOWN" && currentlySupported === false);
        statusChangedReason = statusChanged
            ? (DISPOSITIONS_CLAIMED_FIXED.has(dispositionCategory)
                ? `Original disposition claims "${dispositionCategory}" but today's independent Node 16 evidence still shows ${matched.status} -- disagreement, needs human review.`
                : `Original disposition was "${dispositionCategory}" (not remediated) but today's independent Node 16 evidence shows ${matched.status}, no current support -- may have been fixed without an updated disposition record.`)
            : null;
    }

    return {
        claim_id: claimId,
        match_method: matchMethod,
        audit_source: {
            source_type: provenance.source_type ?? null,
            source_firm: provenance.source_firm ?? null,
            source_document_title: provenance.source_document_title ?? null,
            source_url: provenance.source_url ?? null,
            date_flagged: provenance.date_flagged ?? null,
            original_severity_label: provenance.original_severity_label ?? null,
            original_disposition: {
                category: disposition.category ?? "UNKNOWN",
                verbatim_quote: disposition.verbatim_quote ?? null,
                quote_location: disposition.quote_location ?? null,
                extraction_confidence: disposition.extraction_confidence ?? null
            }
        },
        current_verification: currentVerification,
        days_open,
        days_open_unavailable_reason: daysOpenReason,
        currently_supported: currentlySupported,
        is_still_open: isStillOpen,
        status_changed_since_disposition: statusChanged,
        status_changed_reason: statusChangedReason,
        unmatched_reason:
            matchMethod === "NO_CURRENT_VERIFICATION_AVAILABLE"
                ? (!claimId
                    ? "Audit finding has no claim_id -- cannot be matched to any Node 16 output by construction."
                    : claimIdCollisions.has(claimId)
                        ? `claim_id "${claimId}" matches more than one finding in today's Node 16 output -- ambiguous, not treated as a match.`
                        : `claim_id "${claimId}" does not exactly match any finding in today's Node 16 output. This run's Node 13/06 may not have independently regenerated a check for this specific historical claim.`)
                : null
    };
}

const trackedClaims = auditFindings.map(buildRecord);

// ======================================================================
// SELF-VERIFICATION
// ======================================================================
(function selfVerify() {
    // I1: every audit-sourced finding produces exactly one tracked record
    // -- never dropped.
    if (trackedClaims.length !== auditFindings.length) {
        throw new Error(
            `Node 19 self-verification failed: ${auditFindings.length} audit-sourced findings in, ` +
            `${trackedClaims.length} tracked records out. No finding may be silently dropped.`
        );
    }
    // I2: match_method is only ever one of the two allowed values.
    const allowed = new Set(["EXACT_CLAIM_ID", "NO_CURRENT_VERIFICATION_AVAILABLE"]);
    for (const rec of trackedClaims) {
        if (!allowed.has(rec.match_method)) {
            throw new Error(
                `Node 19 self-verification failed: claim_id "${rec.claim_id}" has disallowed ` +
                `match_method "${rec.match_method}". Only EXACT_CLAIM_ID or NO_CURRENT_VERIFICATION_AVAILABLE are permitted.`
            );
        }
    }
    // I3: fields that require a real current_verification are never
    // populated without one.
    for (const rec of trackedClaims) {
        if (rec.match_method !== "EXACT_CLAIM_ID") {
            if (rec.current_verification !== null || rec.currently_supported !== null ||
                rec.is_still_open !== null || rec.status_changed_since_disposition !== null) {
                throw new Error(
                    `Node 19 self-verification failed: claim_id "${rec.claim_id}" has match_method ` +
                    `NO_CURRENT_VERIFICATION_AVAILABLE but a derived field was populated anyway.`
                );
            }
        }
    }
    // I4: days_open is never negative.
    for (const rec of trackedClaims) {
        if (rec.days_open !== null && rec.days_open < 0) {
            throw new Error(
                `Node 19 self-verification failed: claim_id "${rec.claim_id}" has negative days_open (${rec.days_open}).`
            );
        }
    }
    // I5: no exact match was ever drawn from a collided claim_id.
    for (const rec of trackedClaims) {
        if (rec.match_method === "EXACT_CLAIM_ID" && claimIdCollisions.has(rec.claim_id)) {
            throw new Error(
                `Node 19 self-verification failed: claim_id "${rec.claim_id}" was matched despite being a known collision.`
            );
        }
    }
})();

// ======================================================================
// QA
// ======================================================================
const qa = {
    run_date: TODAY_ISO,
    audit_findings_in: auditFindings.length,
    tracked_claims_out: trackedClaims.length,
    node16_findings_available: node16Findings.length,
    node16_findings_with_claim_id: node16Findings.filter(f => isNonEmptyString(f?.claim_id)).length,
    claim_id_collisions_in_node16_output: [...claimIdCollisions],
    exact_matches: trackedClaims.filter(r => r.match_method === "EXACT_CLAIM_ID").length,
    no_current_verification: trackedClaims.filter(r => r.match_method === "NO_CURRENT_VERIFICATION_AVAILABLE").length,
    still_open_count: trackedClaims.filter(r => r.is_still_open === true).length,
    status_changed_count: trackedClaims.filter(r => r.status_changed_since_disposition === true).length,
    fuzzy_or_inferred_matching_used: false,
    finding_name_or_finding_id_used_for_matching: false,
    historical_block_replay_performed: false,
    self_verification_passed: true
};

// ======================================================================
// FINAL OUTPUT
// ======================================================================
return [
    {
        json: {
            node: "Node 19 - Dismissed-Finding / Continuous-Monitoring Tracker",
            version: "1.0",
            methodology: {
                purpose: "For each audit/incident-sourced finding, determine via EXACT claim_id matching whether today's Node 16 run independently re-establishes the same claim.",
                matching_rule: "Exact claim_id string match only. No inference from risk_category, finding_name, or finding_id (finding_id is unstable across runs by Node 07's own schema). Every claim produces EXACT_CLAIM_ID or NO_CURRENT_VERIFICATION_AVAILABLE -- no third category, no guessing.",
                node16_modified: false,
                node16_status_overridden: false,
                phase_2_historical_replay: "Not implemented in this node. See design note -- separate, later experiment."
            },
            qa,
            tracked_claims: trackedClaims
        }
    }
];
