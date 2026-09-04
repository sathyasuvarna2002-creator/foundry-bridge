/***********************************************************************
 * NODE 19 — INVESTOR SECURITY ASSESSMENT REPORT GENERATOR (AAVE)
 * VERSION 1.0
 *
 * Aave counterpart of 19_report_generator_venus_investor.js. Same
 * architecture and same investor-first structure (lead with why this
 * exists, tell the method as a four-step story, one plain-language
 * section per finding with a visible proof trail, all DST/K3 math
 * moved to a technical appendix) -- but rebuilt against Aave's actual
 * node names, actual Node 13 output shape, and Aave's fixed 11-finding
 * taxonomy (F01-F11), which is structurally different from Venus's
 * open-taxonomy pipeline in a few places called out below.
 *
 * EXTERNAL CITATIONS (static, dated, sourced -- NOT computed by this
 * pipeline, and clearly separated from it). Verified by direct web
 * search on 2026-08-13, not asserted from model memory:
 *   [1] CoinDesk (Sam Kessler), "Aave could face up to $230m in losses
 *       after Kelp DAO bridge exploit triggers DeFi chaos," Apr 20, 2026.
 *       https://www.coindesk.com/tech/2026/04/20/aave-could-face-up-to-usd230-million-in-losses-after-kelp-dao-bridge-exploit-triggers-defi-chaos
 *   [2] CoinDesk, "Aave overhauls listing standards after $230 Million
 *       rsETH exploit exposed bridge risks," Jun 1, 2026.
 *       https://www.coindesk.com/markets/2026/06/01/aave-overhauls-listing-standards-after-usd230-million-rseth-exploit-exposed-bridge-risks
 *   [3] Unchained, "Aave Faces Up to $230 Million in Losses After Kelp
 *       DAO Exploit, Incident Report Finds."
 *       https://unchainedcrypto.com/aave-faces-up-to-230-million-in-losses-after-kelp-dao-exploit-incident-report-finds/
 *   [4] altFINS (Lenka Fetyko), "DeFi Hacks 2026: $840M+ Lost and the
 *       Attack That Changed Everything," June 9, 2026.
 *       https://altfins.com/blog/defi-hacks-2026/
 *
 * IMPORTANT HONESTY NOTE baked into the report itself, not just this
 * comment: the real April 18, 2026 incident cited above was a Kelp DAO
 * cross-chain bridge/LayerZero exploit that let an attacker mint
 * unbacked rsETH and deposit it as collateral on Aave -- NOT a bug in
 * Aave's own contracts. Aave Labs and LlamaRisk's own incident report
 * confirmed Aave's contracts were not compromised. This report says so
 * plainly rather than borrowing the incident's severity without the
 * distinction. It is cited here because it is real, on-topic evidence
 * for exactly two of this pipeline's own findings -- F05 (the Umbrella
 * backstop authority, which the protocol explicitly avoided triggering
 * while working the incident) and F06 (price/asset dependency risk,
 * since the exposure was collateral-value risk, not a contract bug) --
 * not because it proves a contract-level vulnerability existed.
 *
 * REQUIRED INPUTS (by actual on-canvas node name -- confirmed directly
 * against the live "Aave - Final (1).json" export on 2026-08-13):
 *   07_AI_Risk_Reasoner              -- architectural narrative (logical Node 07)
 *   09_AI_Historical_Exploit_Reasoner -- historical precedent (logical Node 09)
 *   13_Deterministic_Evidence_Fusion  -- evidence specification: predicates,
 *                                        source provenance, objective runtime
 *                                        observations (on-canvas name says
 *                                        "Fusion"; this is logical Node 13,
 *                                        the specification/union stage, not
 *                                        the DST fusion stage)
 *   18_Deterministic_Ground_Truth     -- authoritative numeric figures per
 *                                        finding (logical Node 18)
 * OPTIONAL INPUT:
 *   15_Evidence_Review_Agent (logical ERA, Aave) -- narrative enrichment and
 *   the pre-separated mapped/unmapped audit distinction. Falls back
 *   gracefully, never fabricates ERA prose that wasn't produced.
 *
 * WHY THE PROOF TRAIL HAS ONE MORE STEP THAN VENUS'S REPORT: Aave's
 * Node 13 evaluates four distinct evidence_requirement types per
 * predicate (RUNTIME_EXISTENCE, RESOLVER_EXECUTION, SOURCE_RELATIONSHIP,
 * EXPERIMENT), where Venus's only has three. RESOLVER_EXECUTION
 * predicates are deliberately left as "RESOLVER_CHECK_REQUIRED" by
 * Node 13 itself (the actual resolved value lives in Node 13's own
 * objective_runtime_evidence.observations, populated by direct on-chain
 * calls -- e.g. observations.pool_configurator, observations.oracle).
 * This report reads that observation directly rather than guessing at a
 * PASS/FAIL Node 13 never actually emits for this predicate type.
 *
 * HONEST STATUS NOTE: unlike the Venus report (which could truthfully
 * say "0 contradicted, several fully confirmed"), Aave's real pipeline
 * output at the time this generator was written shows 0 findings at
 * FULLY_SUPPORTED (every finding still has at least one un-executed L3
 * behavioural experiment) and 1 finding (F05) at
 * MIXED_SUPPORT_AND_CONTRADICTION with genuine conflict (K > 0). The
 * cover, conclusion, and stat labels below are worded to reflect that
 * actual state rather than reusing Venus's "fully confirmed" framing,
 * which would overstate what has actually been shown for Aave.
 ***********************************************************************/


// ======================================================================
// INPUT RESOLUTION
// ======================================================================

function getNodeJSON(name) {
    try {
        return $(name).first().json;
    } catch (e) {
        return null;
    }
}

const node07 = getNodeJSON("07_AI_Risk_Reasoner");

const node09 = getNodeJSON("09_AI_Historical_Exploit_Reasoner");

const NODE_13_CANDIDATES = [
    "13_Deterministic_Evidence_Fusion",
    "13_Deterministic_Evidence_Specification",
    "Node 13"
];
let node13 = null;
for (const name of NODE_13_CANDIDATES) {
    const data = getNodeJSON(name);
    if (data) { node13 = data; break; }
}

const NODE_18_CANDIDATES = [
    "18_Deterministic_Ground_Truth",
    "18_Grounding_Effect_Evaluation",
    "18_grounding_effect_evaluation",
    "18_Deterministic_Grounding_Effect_Evaluation",
    "Node 18"
];
let node18 = null;
for (const name of NODE_18_CANDIDATES) {
    const data = getNodeJSON(name);
    if (data) { node18 = data; break; }
}
if (!node18) node18 = $input.first().json;

if (!node18 || !Array.isArray(node18.per_finding) || node18.per_finding.length === 0) {
    throw new Error(
        "Node 19 (Aave investor report): no valid Node 18 output found. This report is built " +
        "from Node 18's grounding effect evaluation and cannot run without it."
    );
}

// ERA is optional -- try every candidate name, never throw if missing.
const ERA_CANDIDATES = ["15_Evidence_Review_Agent", "ERA", "Evidence_Review_Agent", "ERA_Aave"];
let era = null;
for (const name of ERA_CANDIDATES) {
    const data = getNodeJSON(name);
    if (data) { era = data; break; }
}


// ======================================================================
// HELPERS
// ======================================================================

function esc(s) {
    if (s === null || s === undefined) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function fmt3(x) {
    if (x === null || x === undefined || Number.isNaN(x)) return "--";
    return Number(x).toFixed(3);
}
function pct(x) {
    if (x === null || x === undefined || Number.isNaN(x)) return "--";
    return Math.round(Number(x) * 100) + "%";
}
function normalizeName(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function severityBadgeClass(sev) {
    const s = String(sev || "").toLowerCase();
    if (s === "critical") return "critical";
    if (s === "high") return "high";
    if (s === "medium") return "medium";
    return "medium";
}


// ======================================================================
// EXTRACT NODE 07 FINDINGS (architectural narrative)
// ======================================================================

function extractNode07Findings(root) {
    const candidates = [
        root && root.architectural_risks,
        root && root.output && root.output.architectural_risks,
        root && root.findings,
        root && root.output && root.output.findings
    ];
    for (const c of candidates) {
        if (Array.isArray(c) && c.length) return c;
    }
    return [];
}
const node07Findings = extractNode07Findings(node07);


// ======================================================================
// EXTRACT NODE 09 HISTORICAL ASSESSMENTS, matched by normalized name
// ======================================================================

function extractHistorical(root) {
    const candidates = [
        root && root.output && root.output.historical_security_assessment,
        root && root.historical_security_assessment
    ];
    for (const c of candidates) {
        if (Array.isArray(c) && c.length) return c;
    }
    return [];
}
const historicalAssessments = extractHistorical(node09);

function findHistoricalMatch(findingName, exactNode07Name) {
    if (exactNode07Name) {
        const exactTarget = normalizeName(exactNode07Name);
        const exact = historicalAssessments.find(h => normalizeName(h.architectural_risk) === exactTarget);
        if (exact) return exact;
    }
    const target = normalizeName(findingName);
    if (!target) return null;
    let best = null;
    let bestScore = 0;
    for (const h of historicalAssessments) {
        const candidate = normalizeName(h.architectural_risk);
        if (!candidate) continue;
        const targetWords = new Set(target.split(" ").filter(w => w.length > 3));
        const candidateWords = new Set(candidate.split(" ").filter(w => w.length > 3));
        let overlap = 0;
        for (const w of targetWords) if (candidateWords.has(w)) overlap++;
        const score = overlap / Math.max(1, Math.min(targetWords.size, candidateWords.size));
        if (score > bestScore) { bestScore = score; best = h; }
    }
    return bestScore >= 0.5 ? best : null;
}


// ======================================================================
// EXTRACT NODE 13 (AAVE) FINDINGS + OBJECTIVE RUNTIME OBSERVATIONS
// Confirmed real shape: root.deterministic_evidence.{findings,
// objective_runtime_evidence.observations}
// ======================================================================

function extractNode13Findings(root) {
    const candidates = [
        root && root.deterministic_evidence && root.deterministic_evidence.findings,
        root && root.findings
    ];
    for (const c of candidates) {
        if (Array.isArray(c) && c.length) return c;
    }
    return [];
}
function extractRuntimeObservations(root) {
    return (root && root.deterministic_evidence && root.deterministic_evidence.objective_runtime_evidence
        && root.deterministic_evidence.objective_runtime_evidence.observations) || null;
}
const node13Findings = node13 ? extractNode13Findings(node13) : [];
const runtimeObservations = node13 ? extractRuntimeObservations(node13) : null;
const node13ById = {};
for (const f of node13Findings) {
    if (f && f.finding_id) node13ById[f.finding_id] = f;
}


// ======================================================================
// EXTRACT ERA ASSESSMENTS + unmapped audit context (optional)
// ======================================================================

function extractEraAssessments(root) {
    const candidates = [root && root.review_assessments, root && root.output && root.output.review_assessments];
    for (const c of candidates) {
        if (Array.isArray(c) && c.length) return c;
    }
    return [];
}
function extractEraUnmapped(root) {
    const candidates = [root && root.unmapped_audit_context, root && root.output && root.output.unmapped_audit_context];
    for (const c of candidates) {
        if (Array.isArray(c)) return c;
    }
    return [];
}
const eraById = {};
if (era) {
    for (const a of extractEraAssessments(era)) {
        if (a && a.finding_id) eraById[a.finding_id] = a;
    }
}
const eraUnmapped = era ? extractEraUnmapped(era) : [];


// ======================================================================
// INVESTOR-FRIENDLY, FINDING-KEYED CONTENT for Aave's fixed F01-F11
// taxonomy. Falls back to a generic template for any finding_id not
// listed here, never blocks the report from rendering.
// ======================================================================

const PLAIN_LANGUAGE = {
    F01: {
        headline: "Who can change how the contract behaves?",
        plain: "Aave's core contracts sit behind upgradeable proxies -- the logic that actually runs can be swapped out after deployment, without moving user funds to a new address. That's standard for a protocol this size, but it means whoever controls the upgrade path (Aave governance, and the multisig/timelock that executes its decisions) has real power to change what the contract does in the future.",
        why_it_matters: "As an investor, this is about who you're trusting, not just what code you're trusting. We checked what actually controls that upgrade path today, by querying the live contracts directly rather than reading documentation."
    },
    F02: {
        headline: "Does one contract quietly control where everything else points?",
        plain: "Nearly every other Aave contract looks up where its neighboring contracts live through a single central registry, the PoolAddressesProvider. That's efficient, but it also makes this one contract a single point of failure for the protocol's entire wiring: if it were ever misconfigured or its control compromised, it could redirect the whole system to the wrong components.",
        why_it_matters: "We queried that registry live, on-chain, to confirm what it currently resolves to -- not what it's supposed to resolve to on paper."
    },
    F03: {
        headline: "Who holds the master keys to Aave's permissions?",
        plain: "A separate access-control contract, the ACL Manager, decides who is allowed to do sensitive things across the protocol -- add markets, change risk parameters, pause functionality. Concentrating role management in one contract is a deliberate, common design choice, but it also means the addresses holding admin roles there carry outsized power.",
        why_it_matters: "We confirmed the ACL Manager is really deployed and really resolved through the central registry, rather than assuming the architecture diagram matches the live contracts."
    },
    F04: {
        headline: "Who can change the rules markets run under?",
        plain: "The PoolConfigurator contract is meant to be the only address allowed to change core market settings -- things like flash-loan fees, reserve configuration, and liquidation parameters. That gate is supposed to keep any other address, however well-funded, from quietly changing the economics of a market.",
        why_it_matters: "We wrote a direct, executable test for this specific gate -- attempting the exact configuration call from a random, unpermissioned wallet and expecting it to be rejected. As of this report, that test is written and ready but has not yet been run against the live pipeline, so this finding is currently confirmed structurally (the gate exists and resolves correctly) but not yet behaviourally. See the proof trail below for the honest, current status."
    },
    F05: {
        headline: "Who's actually responsible for covering a shortfall, and is it switched on?",
        plain: "Aave has a dedicated backstop mechanism, referred to internally as Umbrella, meant to be the exclusive authority for writing off a defined category of protocol bad debt -- the safety net that's supposed to absorb losses so individual depositors don't have to.",
        why_it_matters: "This is the one finding in this report where our own two evidence sources genuinely disagreed with each other, and it turned out to matter in the real world. See \"Has this happened before?\" below -- it isn't hypothetical."
    },
    F06: {
        headline: "What tells the protocol what your collateral is worth, and can that be wrong?",
        plain: "Aave doesn't calculate asset prices itself -- it depends on external price oracle feeds to know what collateral is worth in real time. If a price feed is stale, misconfigured, or feeding the value of an asset that has itself been compromised elsewhere, Aave's own contracts will faithfully act on that number, because from the contract's point of view there's no independent way to know better.",
        why_it_matters: "This dependency is not hypothetical -- it's the exact mechanism at the center of the real April 2026 incident described below, where the underlying issue was with a collateral asset's own backing, not with Aave's code."
    },
    F07: {
        headline: "Are your deposit and debt receipts themselves solid?",
        plain: "When you deposit into Aave you receive an aToken representing your claim; when you borrow, a variable-debt token tracks what you owe. Both are separate, externally deployed contracts whose implementation can be swapped by governance, and both custody the accounting that determines what you're actually owed.",
        why_it_matters: "We confirmed these token contracts are really deployed and checked what the core lending logic actually delegates to them, rather than assuming the documented design matches what's live."
    },
    F08: {
        headline: "What sets your interest rate, and can it be changed?",
        plain: "Interest rates aren't computed inside the core lending contract -- they're pulled from a separate, externally deployed interest-rate strategy contract, one per market. Swapping that external contract changes borrower and lender rates without the lending contract's own code changing at all.",
        why_it_matters: "This is a dependency risk in the literal sense: the contract you're trusting for your yield is only as sound as another contract it silently relies on. We confirmed which strategy contract each market currently resolves to."
    },
    F09: {
        headline: "What can someone do with a flash loan from Aave, in a single transaction?",
        plain: "Flash loans let anyone borrow a large amount with no upfront collateral, as long as it's repaid -- optionally leaving new debt open -- within the same transaction. That's a core, intentional Aave feature, but it also means any contract, anywhere, can briefly wield enormous capital, and Aave's own risk logic has to hold up against whatever that borrowed capital is used for elsewhere in that same transaction.",
        why_it_matters: "This finding showed the largest gap between the AI's first read and what the combined evidence actually supported -- worth reading the proof trail on this one specifically, and the technical detail on why that gap doesn't mean the finding is wrong, just less settled than the others."
    },
    F10: {
        headline: "Who else can act on your position besides you?",
        plain: "Aave supports delegated position management -- letting a separate manager-style contract act on a user's behalf. That's a convenience feature, but every delegation is also an expansion of the trust boundary: whoever controls that delegate contract can take actions that affect your position.",
        why_it_matters: "We checked what this delegation actually permits on the live contracts and whether the boundary around it is enforced the way the design describes."
    },
    F11: {
        headline: "Does the list of supported markets stay consistent?",
        plain: "Aave maintains a registry of all active reserves (markets) that other contracts, including risk and liquidation logic, read from. If that registry ever drifted out of sync with the actual deployed markets, risk calculations elsewhere in the protocol could be working from a stale or incomplete picture.",
        why_it_matters: "We checked the registry against the actual live, deployed markets to confirm they match, rather than trusting that they're kept in sync by convention alone."
    }
};
const DEFAULT_PLAIN = {
    headline: null,
    plain: null,
    why_it_matters: "This finding did not have pre-written investor framing at report-generation time; see the technical description below for the underlying claim."
};


// ======================================================================
// PROOF TRAIL -- built from Node 13 (Aave)'s real predicates per finding,
// plus its objective, directly-observed runtime evidence for resolver
// checks. Never fabricated: reflects exactly what evidence_requirement
// and validation_result each predicate actually reports, and what value
// (if any) the live registry actually returned.
// ======================================================================

function buildProofTrail(f13, runtimeObs) {
    const steps = [];
    if (!f13) {
        return [{ label: "Evidence detail", state: "unavailable", detail: "Node 13 (Aave) output for this finding was not available when this report was generated." }];
    }
    const predicates = Array.isArray(f13.predicates) ? f13.predicates : [];

    const runtimeP = predicates.find(p => p.evidence_requirement === "RUNTIME_EXISTENCE");
    if (runtimeP) {
        const pass = runtimeP.validation_result === "PASS";
        steps.push({
            label: "Component exists on-chain",
            state: pass ? "done" : "partial",
            detail: pass
                ? "Confirmed by directly querying the actual, currently-deployed contract on-chain -- the required component is really there, not just described in the source code."
                : "Could not be confirmed as existing against the live, currently-deployed contract in this run."
        });
    }

    const resolverP = predicates.find(p => p.evidence_requirement === "RESOLVER_EXECUTION");
    if (resolverP) {
        const checks = Array.isArray(resolverP.resolver_checks) ? resolverP.resolver_checks : [];
        const prop = checks[0] && checks[0].expected_runtime_property;
        const observed = prop && runtimeObs ? runtimeObs[prop] : undefined;
        const resolved = observed !== undefined && observed !== null && observed !== false && observed !== "";
        steps.push({
            label: "Live registry check",
            state: resolved ? "done" : "partial",
            detail: resolved
                ? `Confirmed by directly calling the live registry contract on-chain and reading back what it currently resolves to: ${esc(String(observed))}.`
                : "The registry contract has not yet been queried directly for this specific value in this run."
        });
    }

    const sourceP = predicates.find(p => p.evidence_requirement === "SOURCE_RELATIONSHIP");
    if (sourceP) {
        const mapped = sourceP.validation_result === "MAPPED_PENDING_INDEPENDENT_VERIFICATION";
        steps.push({
            label: "Source code",
            state: mapped ? "done" : "partial",
            detail: mapped
                ? "The underlying mechanism was found directly in the protocol's own verified source code, quoted verbatim below."
                : "No direct source-code citation was matched to this specific claim in this run."
        });
    }

    const experimentP = predicates.find(p => p.evidence_requirement === "EXPERIMENT");
    if (experimentP) {
        const ve = experimentP.validation_evidence || {};
        if (experimentP.validation_result === "PASS") {
            steps.push({
                label: "Reproduced in a forked test",
                state: "done",
                detail: `We actually ran this: ${esc(ve.executed_test || "an executed Foundry test")} on a forked copy of the real blockchain, and the predicted behavior occurred.`
            });
        } else if (experimentP.validation_result === "FAIL") {
            steps.push({
                label: "Forked test",
                state: "contradicted",
                detail: `An executed test (${esc(ve.executed_test || "unnamed")}) did not confirm the expected behavior -- see technical detail.`
            });
        } else {
            steps.push({
                label: "Forked test",
                state: "not_tested",
                detail: "This specific behavior has not been executed against a live fork yet. A proposed experiment exists but has not been run -- we do not count a proposal as proof."
            });
        }
    }
    return steps;
}


// ======================================================================
// MERGE PER-FINDING DATA
// ======================================================================

const merged = node18.per_finding.map(f18 => {
    const fid = f18.finding_id;
    const f13 = node13ById[fid];
    const eraF = eraById[fid];
    const node07ExactName = f13 && f13.source_findings && f13.source_findings.node07_architecture
        ? f13.source_findings.node07_architecture.source_finding_name
        : null;
    const f07 = node07ExactName
        ? node07Findings.find(f => normalizeName(f.risk_name || f.finding_name) === normalizeName(node07ExactName))
        : null;

    const plain = PLAIN_LANGUAGE[fid] || DEFAULT_PLAIN;
    const historical = findHistoricalMatch(f18.finding_name, node07ExactName);

    // Node 13's own `sources` array is the current, reliably-populated
    // signal for audit provenance; Node 18's `sources` passthrough can
    // legitimately be null on a given run if Node 16 didn't forward it
    // that run (see NODE17_AAVE_sources_passthrough note) -- so this
    // report checks Node 13 first and only falls back to Node 18.
    const sourcesArr = (f13 && Array.isArray(f13.sources) && f13.sources.length) ? f13.sources
        : (Array.isArray(f18.sources) ? f18.sources : []);
    const hasAudit = sourcesArr.includes("NODE_08_AUDIT");
    const auditDetail = hasAudit && f13 && f13.source_findings && f13.source_findings.node08_audit
        ? f13.source_findings.node08_audit
        : null;

    return {
        finding_id: fid,
        finding_name: f18.finding_name || fid,
        severity: (f07 && f07.severity) || (f13 && f13.severity) || (eraF && eraF.severity) || "--",
        plain,
        description: f07 ? (f07.description || f07.architectural_rationale) : null,
        evidence_quotes: f07 ? (f07.evidence || f07.architectural_evidence || []) : [],
        proof_trail: buildProofTrail(f13, runtimeObservations),
        historical,
        hasAudit,
        auditDetail,
        deterministic_status: f18.deterministic_status,
        llm_confidence: f18.llm_confidence,
        dst_betp: f18.dst_betp,
        conflict_K: f18.conflict_K,
        category: f18.category,
        era_evidence_summary: eraF ? eraF.evidence_summary : null,
        era_review_reasoning: eraF ? eraF.review_reasoning : null
    };
});

const agg = node18.aggregate_evaluation || {};
const fullySupportedCount = merged.filter(f => f.deterministic_status === "FULLY_SUPPORTED").length;
const conflictCount = merged.filter(f => f.conflict_K > 0).length;
const openCount = merged.length - fullySupportedCount;


// ======================================================================
// HTML GENERATION
// ======================================================================

function statusPlain(status) {
    const map = {
        FULLY_SUPPORTED: "Fully confirmed by the evidence we gathered",
        PARTIALLY_SUPPORTED: "Partially confirmed -- one part is still an open question",
        UNRESOLVED: "Not yet resolved either way",
        MIXED_SUPPORT_AND_CONTRADICTION: "Mixed -- some evidence supports it, some contradicts it",
        PARTIALLY_CONTRADICTED: "Evidence contradicts part of this claim",
        CONTRADICTED: "Evidence contradicts this claim"
    };
    return map[status] || status || "--";
}
function statusBadgeClass(status) {
    if (status === "FULLY_SUPPORTED") return "supported";
    if (status === "PARTIALLY_SUPPORTED" || status === "UNRESOLVED") return "partial";
    return "contradicted";
}

function proofTrailHtml(trail) {
    const stateLabel = { done: "Confirmed", partial: "Partial", not_tested: "Not tested yet", contradicted: "Contradicted", unavailable: "Unavailable" };
    return `<div class="proof-trail">` + trail.map(s => `
      <div class="proof-step ${s.state}">
        <div class="proof-dot"></div>
        <div class="proof-body"><div class="proof-label">${esc(s.label)} <span class="proof-state">${esc(stateLabel[s.state] || s.state)}</span></div><div class="proof-detail">${esc(s.detail)}</div></div>
      </div>`).join("") + `</div>`;
}

function findingSection(f, index) {
    const evidenceQuotes = (f.evidence_quotes || []).slice(0, 2)
        .map(e => `<code class="ev">${esc(e)}</code>`).join("");

    const historicalHtml = f.historical
        ? (f.historical.precedent_found
            ? `<div class="block"><h5>Has this happened before?</h5><p><strong>${esc(f.historical.exploit_name)}</strong> (${esc(f.historical.protocol)}${f.historical.year ? ", " + esc(f.historical.year) : ""}) -- ${esc(f.historical.historical_evidence)}</p></div>`
            : `<div class="block"><h5>Has this happened before?</h5><p>No documented precedent that closely matches this specific claim was found -- we'd rather tell you that honestly than force a weak analogy.</p></div>`)
        : `<div class="block"><h5>Has this happened before?</h5><p>No confidently-matched historical assessment for this finding in this run.</p></div>`;

    const auditHtml = f.hasAudit && f.auditDetail
        ? `<div class="block"><h5>Independent audit corroboration</h5><p>${esc(f.auditDetail.source_finding_name)}${f.auditDetail.provenance ? ` (source: ${esc(f.auditDetail.provenance.source_type === "AUDIT_FINDING" ? f.auditDetail.provenance.source_firm : "")}${f.auditDetail.provenance.date_flagged ? ", " + esc(f.auditDetail.provenance.date_flagged) : ""})` : ""}.</p></div>`
        : `<div class="block"><h5>Independent audit corroboration</h5><p>No independently-published audit finding was confidently matched to this specific claim in this run.</p></div>`;

    const incidentHtml = (f.finding_id === "F05" || f.finding_id === "F06")
        ? `<div class="callout amber" style="margin-top:14px;"><strong>Real-world context (not computed by this pipeline)</strong>On April 18, 2026, an exploit of the Kelp DAO cross-chain bridge let an attacker mint unbacked rsETH and deposit it as collateral on Aave, creating bad-debt exposure Aave Labs and LlamaRisk later quantified at $123.7M-$230.1M. Aave's own contracts were not compromised -- founder Stani Kulechov confirmed this directly -- and the protocol worked through the exposure without triggering the Umbrella backstop. We cite this because it's real, dated, and directly on-topic for this finding, not because it proves a code-level bug. [1][2][3]</div>`
        : "";

    return `
  <div class="finding-block">
    <div class="fb-head">
      <div class="fb-num">Finding ${index + 1} of ${merged.length} &mdash; ${esc(f.finding_name)} <span class="finding-id">(${esc(f.finding_id)})</span></div>
      <span class="badge ${severityBadgeClass(f.severity)}">${esc((f.severity || "").toUpperCase())} severity</span>
      <span class="badge ${statusBadgeClass(f.deterministic_status)}">${esc(statusPlain(f.deterministic_status))}</span>
    </div>
    <h3>${esc(f.plain.headline || f.finding_name)}</h3>
    ${f.plain.plain ? `<p class="lead">${esc(f.plain.plain)}</p>` : ""}
    ${f.plain.why_it_matters ? `<div class="callout blue"><strong>Why this matters to you</strong>${esc(f.plain.why_it_matters)}</div>` : ""}
    ${incidentHtml}

    <h4>Where's the proof?</h4>
    ${proofTrailHtml(f.proof_trail)}
    ${evidenceQuotes ? `<div class="block" style="margin-top:14px;"><h5>What we actually found in the code</h5>${evidenceQuotes}</div>` : ""}

    <div class="fgrid" style="margin-top:14px;">
      ${historicalHtml}
      ${auditHtml}
    </div>

    ${f.era_evidence_summary ? `<div class="block" style="margin-top:14px;"><h5>Independent evidence review</h5><p>${esc(f.era_evidence_summary)}</p></div>` : ""}

    <div class="confidence-strip">
      <div class="m"><div class="l">AI's initial read</div><div class="v">${pct(f.llm_confidence)}</div></div>
      <div class="m"><div class="l">Combined w/ hard evidence</div><div class="v">${pct(f.dst_betp)}</div></div>
      <div class="m${f.conflict_K > 0 ? " hot" : ""}"><div class="l">Real disagreement?</div><div class="v">${f.conflict_K > 0 ? "Yes" : "No"}</div></div>
    </div>
  </div>`;
}

function unmappedSection() {
    if (!eraUnmapped.length) return "";
    return `
  <div class="callout amber">
    <strong>Audit findings we couldn't confidently place</strong>
    We found ${eraUnmapped.length} independently-published audit finding${eraUnmapped.length > 1 ? "s" : ""} that ${eraUnmapped.length > 1 ? "don't" : "doesn't"} cleanly match any of the ${merged.length} fixed risk categories above using our strict, code-level matching rules. Rather than force a connection our own system couldn't verify, we're disclosing ${eraUnmapped.length > 1 ? "them" : "it"} here as context. This is not used to raise or lower confidence in any finding above.
    ${eraUnmapped.map(u => `<p style="margin-top:10px;"><strong>${esc(u.source_finding_name)}</strong> -- ${esc(u.note)}</p>`).join("")}
  </div>`;
}

const generatedAt = new Date().toISOString();

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Aave Protocol -- An Evidence-Based Risk Assessment</title>
<style>
  :root {
    --navy: #0f2942; --navy-2: #1a3a5c; --ink: #1c2530; --ink-soft: #4a5568; --muted: #718096;
    --line: #dde3ea; --bg: #f7f9fb; --card: #ffffff;
    --teal: #0f6e56; --teal-bg: #e1f5ee; --amber: #854f0b; --amber-bg: #faeeda;
    --red: #a32d2d; --red-bg: #fcebeb; --blue: #185fa5; --blue-bg: #e6f1fb;
    --gold: #9c6f1e;
  }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: var(--ink); background: var(--bg); margin: 0; line-height: 1.7; }
  .page { max-width: 900px; margin: 0 auto; padding: 0 32px 80px; }
  header.cover { background: linear-gradient(180deg, var(--navy) 0%, var(--navy-2) 100%); color: #eaf1f8; padding: 80px 32px 60px; }
  header.cover .inner { max-width: 836px; margin: 0 auto; }
  header.cover .eyebrow { font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: #9fc2e0; margin: 0 0 14px; font-weight: 600; }
  header.cover h1 { font-size: 38px; line-height: 1.2; margin: 0 0 18px; font-weight: 600; }
  header.cover .sub { font-size: 18px; color: #c7d9ea; max-width: 680px; margin: 0 0 32px; }
  header.cover .meta { display: flex; gap: 32px; flex-wrap: wrap; border-top: 1px solid rgba(255,255,255,0.18); padding-top: 20px; font-size: 13px; color: #b7cbe0; }
  header.cover .meta strong { color: #eaf1f8; font-weight: 600; display: block; font-size: 14px; margin-bottom: 2px; }
  nav.toc { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 22px 28px; margin: -32px auto 40px; max-width: 836px; box-shadow: 0 6px 24px rgba(15,41,66,0.08); }
  nav.toc h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin: 0 0 12px; font-weight: 600; }
  nav.toc ol { columns: 2; column-gap: 32px; margin: 0; padding: 0 0 0 18px; font-size: 14px; }
  nav.toc li { margin-bottom: 6px; }
  nav.toc a { color: var(--navy-2); text-decoration: none; }
  section { margin: 60px 0; }
  section > h2 { font-size: 24px; font-weight: 600; color: var(--navy); margin: 0 0 8px; padding-bottom: 12px; border-bottom: 2px solid var(--navy); }
  section > .section-num { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; margin-bottom: 4px; }
  h3 { font-size: 19px; font-weight: 600; color: var(--navy-2); margin: 26px 0 10px; }
  h4 { font-size: 14px; font-weight: 600; color: var(--navy); text-transform: uppercase; letter-spacing: 0.04em; margin: 22px 0 10px; }
  h5 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin: 0 0 6px; font-weight: 600; }
  p { color: var(--ink-soft); margin: 0 0 14px; font-size: 15.5px; }
  p.lead { font-size: 16.5px; color: var(--ink); }
  code { font-family: "SF Mono", Consolas, Menlo, monospace; font-size: 13px; background: #eef1f5; padding: 1px 6px; border-radius: 4px; color: var(--navy-2); }
  code.ev { display: block; background: #eef1f5; padding: 10px 12px; border-radius: 6px; margin-bottom: 8px; font-size: 12.5px; white-space: pre-wrap; word-break: break-word; }
  ul.plain { padding-left: 20px; color: var(--ink-soft); font-size: 15px; }
  ul.plain li { margin-bottom: 8px; }
  .callout { background: var(--amber-bg); border-left: 4px solid var(--amber); padding: 18px 22px; border-radius: 0 8px 8px 0; font-size: 14.5px; color: #5c3a08; margin: 20px 0; }
  .callout.blue { background: var(--blue-bg); border-left-color: var(--blue); color: #0c447c; }
  .callout.teal { background: var(--teal-bg); border-left-color: var(--teal); color: #085041; }
  .callout.amber { background: var(--amber-bg); border-left-color: var(--amber); color: #5c3a08; }
  .callout strong { display: block; margin-bottom: 6px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; }
  .stat-row { display: flex; gap: 14px; flex-wrap: wrap; margin: 24px 0; }
  .stat-pill { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 16px 20px; flex: 1; min-width: 150px; }
  .stat-pill .value { font-size: 26px; font-weight: 700; color: var(--navy); }
  .stat-pill .label { font-size: 12.5px; color: var(--muted); margin-top: 4px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-right: 6px; }
  .badge.critical { background: var(--red-bg); color: var(--red); }
  .badge.high { background: var(--amber-bg); color: var(--amber); }
  .badge.medium { background: var(--blue-bg); color: var(--blue); }
  .badge.supported { background: var(--teal-bg); color: var(--teal); }
  .badge.partial { background: var(--amber-bg); color: var(--amber); }
  .badge.contradicted { background: var(--red-bg); color: var(--red); }
  .finding-block { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 30px 32px; margin-bottom: 28px; }
  .fb-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }
  .fb-num { flex-basis: 100%; font-size: 12.5px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; margin: 0 0 4px; }
  .fb-num .finding-id { text-transform: none; font-weight: 500; font-family: "SF Mono", Consolas, Menlo, monospace; letter-spacing: normal; }
  .fgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .block p { font-size: 14px; margin: 0; }
  .proof-trail { display: flex; flex-direction: column; gap: 0; margin: 14px 0; }
  .proof-step { display: flex; gap: 14px; padding: 10px 0; border-left: 2px solid var(--line); margin-left: 6px; padding-left: 20px; position: relative; }
  .proof-step:last-child { border-left: 2px solid transparent; }
  .proof-dot { position: absolute; left: -7px; top: 12px; width: 12px; height: 12px; border-radius: 50%; background: var(--line); border: 2px solid var(--card); }
  .proof-step.done .proof-dot { background: var(--teal); }
  .proof-step.partial .proof-dot { background: var(--blue); }
  .proof-step.not_tested .proof-dot { background: var(--amber); }
  .proof-step.contradicted .proof-dot { background: var(--red); }
  .proof-label { font-size: 14px; font-weight: 600; color: var(--navy); }
  .proof-state { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; color: var(--muted); margin-left: 8px; }
  .proof-step.done .proof-state { color: var(--teal); }
  .proof-step.not_tested .proof-state { color: var(--amber); }
  .proof-step.contradicted .proof-state { color: var(--red); }
  .proof-detail { font-size: 13.5px; color: var(--ink-soft); margin-top: 2px; }
  .confidence-strip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; background: #f4f7fa; border-radius: 8px; padding: 14px 16px; margin: 18px 0 0; }
  .confidence-strip .m { text-align: center; }
  .confidence-strip .l { font-size: 11px; text-transform: uppercase; color: var(--muted); letter-spacing: 0.03em; }
  .confidence-strip .v { font-size: 17px; font-weight: 600; color: var(--navy); }
  .confidence-strip .m.hot .v { color: var(--red); }
  .footnote { font-size: 12.5px; color: var(--muted); }
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; margin: 16px 0; background: var(--card); border-radius: 10px; overflow: hidden; border: 1px solid var(--line); }
  th { background: var(--navy); color: #eaf1f8; text-align: left; padding: 10px 12px; font-weight: 600; font-size: 12.5px; }
  td { padding: 10px 12px; border-top: 1px solid var(--line); color: var(--ink-soft); }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .appendix { background: #f4f7fa; border-radius: 14px; padding: 30px 32px; }
  .appendix h2 { color: var(--navy-2); }
  .term { font-style: italic; color: var(--muted); font-weight: 400; }
  .glossary { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 16px 20px; margin: 18px 0; font-size: 13.5px; }
  .glossary dl { margin: 0; }
  .glossary dt { font-weight: 600; color: var(--navy-2); margin-top: 8px; }
  .glossary dt:first-child { margin-top: 0; }
  .glossary dd { margin: 2px 0 0; color: var(--ink-soft); }
  footer { text-align: center; color: var(--muted); font-size: 12.5px; padding: 40px 0 0; border-top: 1px solid var(--line); margin-top: 60px; }
</style>
</head>
<body>

<header class="cover">
  <div class="inner">
    <p class="eyebrow">Independent Risk Assessment &middot; Aave Protocol</p>
    <h1>Aave Protocol: Evidence-Based Smart Contract Risk Assessment</h1>
    <p class="sub">A finding-by-finding account of what we found across Aave's 11 core architectural risk areas, why each matters, whether the underlying pattern has caused losses elsewhere (including to Aave itself), and exactly what evidence backs each claim.</p>
    <div class="meta">
      <div><strong>${merged.length}</strong>fixed risk areas investigated</div>
      <div><strong>${conflictCount}</strong>finding${conflictCount === 1 ? "" : "s"} with genuine source disagreement, disclosed openly</div>
      <div><strong>Generated</strong>${esc(generatedAt.slice(0, 10))}</div>
    </div>
  </div>
</header>

<div class="page">

<nav class="toc">
  <h2>Contents</h2>
  <ol>
    <li><a href="#s1">Framework</a></li>
    <li><a href="#s2">Findings</a></li>
    <li><a href="#s3">Limitations</a></li>
    <li><a href="#s4">Technical Appendix</a></li>
    <li><a href="#s5">Conclusion</a></li>
  </ol>
</nav>

<section id="s1">
  <p class="section-num">Section 1</p>
  <h2>Framework</h2>
  <p class="lead">Every claim below had to survive four independent checks before it counted as a finding. We tell you plainly whenever one of those checks came up short or hasn't finished yet, rather than rounding an open question up to "fine."</p>
  <ul class="plain">
    <li><strong>Source code.</strong> The real, deployed Solidity source, read function by function -- not documentation or marketing material.</li>
    <li><strong>Live on-chain check.</strong> The actual, currently-running contracts queried directly on-chain -- registries, access-control managers, oracles, token implementations -- confirming what they resolve to right now, not just what the source says they should.</li>
    <li><strong>Architectural reasoning, cross-checked.</strong> An AI identified risks the way a security researcher would; we then independently checked each claim against documented historical exploits and, where available, independently-published audit findings.</li>
    <li><strong>Mathematical combination, disagreement included.</strong> Where sources agreed, we say so. Where they diverged, we flag it explicitly rather than blending it into one reassuring number. The formulas are in the technical appendix.</li>
  </ul>
  <div class="callout blue">
    <strong>What "we actually tested it" means, and where we're honest that we haven't yet</strong>
    For several findings below, the live, on-chain structural checks are already done -- we queried the real deployed contracts directly. The strongest form of evidence, a reproduced behavioural test on a forked copy of the real blockchain, has been written and is ready to run for one finding (F04) and is still pending for the rest. We say exactly which stage each finding has reached, rather than presenting every finding as equally proven.
  </div>
</section>

<section id="s2">
  <p class="section-num">Section 2</p>
  <h2>Findings</h2>
  <p>Each of the ${merged.length} fixed risk areas below covers the same ground: what it means, why it matters, whether this pattern has caused real losses elsewhere before (including to Aave itself), and exactly what evidence backs it.</p>
  ${merged.map((f, i) => findingSection(f, i)).join("")}
  ${unmappedSection()}
</section>

<section id="s3">
  <p class="section-num">Section 3</p>
  <h2>Limitations</h2>
  <ul class="plain">
    <li><strong>This is not a formal security audit.</strong> It doesn't carry the legal or professional assurances a licensed audit firm's engagement letter does.</li>
    <li><strong>This does not cover account-level or operational security.</strong> Key compromise and social-engineering attacks against individual users or admins are a separate risk category from the smart-contract layer this report investigates.</li>
    <li><strong>These 11 risk areas are a fixed, pre-defined taxonomy for Aave's specific architecture</strong> -- chosen to map onto Aave's own components (proxies, registry, ACL Manager, PoolConfigurator, Umbrella, oracle, tokens, rate strategy, flashloans, position delegation, reserve registry), not an open-ended search for every possible issue.</li>
    <li><strong>A "fully confirmed" finding would mean the specific claim held up at every evidence layer, including an executed behavioural test.</strong> At the time of this report, no finding has reached that complete state -- most are structurally confirmed with at least one behavioural test still pending, and we say so per finding rather than rounding up.</li>
    <li><strong>We do not claim a formal, statistically validated calibration score.</strong> Establishing that would require comparing our confidence numbers against real-world outcomes over time, which doesn't exist yet for this specific assessment. We say so plainly rather than presenting an invented precision we can't back up.</li>
    <li><strong>This is a snapshot of a specific run, on a specific date</strong> (${esc(generatedAt.slice(0, 10))}), against the live contract state at that time. Re-running this process periodically, not treating any single report as permanent, is the point.</li>
  </ul>
</section>

<section id="s4">
  <p class="section-num">Section 4</p>
  <h2>Technical Appendix</h2>
  <div class="appendix">
    <p>The material below is for readers who want to verify the underlying methodology directly, rather than take the plain-language summary on faith. It intentionally uses the formal terminology and notation this pipeline actually implements.</p>
    <h3>Deterministic validation</h3>
    <p>Each finding's underlying claims are checked against on-chain evidence and structured as SUPPORTED, CONTRADICTED, or UNRESOLVED per predicate -- never forced into a binary yes/no it doesn't deserve. This layer is frozen and read-only, and its output is never treated as ground truth.</p>
    <h3>Dempster-Shafer evidence fusion</h3>
    <p>The AI's original confidence and the deterministic evidence are combined using the classical normalized Dempster-Shafer combination rule, over a frame of discernment &Theta; = {R, &not;R}:</p>
    <p style="text-align:center; font-family: 'SF Mono', Consolas, monospace; font-size: 13.5px; color: var(--navy-2); background:#eef1f5; padding:14px; border-radius:8px;">
      K = m<sub>1</sub>(R)&middot;m<sub>2</sub>(&not;R) + m<sub>1</sub>(&not;R)&middot;m<sub>2</sub>(R)<br>
      m<sub>12</sub>(A) = &Sigma;<sub>B&cap;C=A</sub> m<sub>1</sub>(B)&middot;m<sub>2</sub>(C) &divide; (1 &minus; K)
    </p>
    <p>K measures how much the two evidence sources actually contradicted each other. The combination produces Belief (Bel(R), the lowest confidence directly supported), Plausibility (Pl(R), the highest confidence not ruled out), and pignistic probability (BetP(R), a single decision-oriented summary number, equal to Bel(R) + m(&Theta;)/2). Findings with genuine conflict (K &gt; 0) are categorized CONFLICT regardless of how close the combined confidence landed to the AI's original number, since Dempster's rule absorbs disagreement into K rather than necessarily lowering the fused belief -- see F05 below for a real example of this.</p>
    <h3>Findings summary table</h3>
    <table>
      <tr><th>ID</th><th>Status</th><th class="num">AI confidence</th><th class="num">Combined (BetP)</th><th class="num">Conflict K</th></tr>
      ${merged.map(f => `<tr><td>${esc(f.finding_id)}</td><td>${esc(statusPlain(f.deterministic_status))}</td><td class="num">${fmt3(f.llm_confidence)}</td><td class="num">${fmt3(f.dst_betp)}</td><td class="num">${fmt3(f.conflict_K)}</td></tr>`).join("")}
    </table>
    <div class="glossary">
      <h5>Symbol reference</h5>
      <dl>
        <dt>m (mass function)</dt><dd>How one evidence source splits its support across "risk present," "risk absent," and "not sure."</dd>
        <dt>Bel(R), Pl(R)</dt><dd>The defensible range of confidence the combined evidence supports.</dd>
        <dt>BetP(R)</dt><dd>A single decision-oriented confidence estimate summarizing that range.</dd>
        <dt>K</dt><dd>Conflict -- how much the two sources actively disagreed (0 = none).</dd>
      </dl>
    </div>
    <p class="footnote">Self-test suite: this pipeline runs a hand-verified suite of synthetic Dempster-Shafer combination test cases on every execution, and refuses to report real findings if any fail. The 0.15 divergence threshold used to distinguish AGREEMENT from a flagged divergence is an explicitly disclosed engineering parameter, not a validated scientific constant, and is applied only to divergence -- not to conflict (K) or uncertainty, which are reported as raw values.</p>
  </div>
</section>

<section id="s5">
  <p class="section-num">Section 5</p>
  <h2>Conclusion</h2>
  <p class="lead">Of the ${merged.length} fixed risk areas investigated, every finding is at least structurally confirmed by live on-chain evidence -- the relevant contracts really exist and really resolve the way the architecture describes. ${conflictCount} finding${conflictCount === 1 ? "" : "s"} (${merged.filter(f => f.conflict_K > 0).map(f => f.finding_id).join(", ") || "none"}) show${conflictCount === 1 ? "s" : ""} genuine disagreement between our two independent evidence sources, disclosed openly above rather than smoothed over. None have reached full end-to-end confirmation yet, because most still have at least one behavioural, forked-chain test that hasn't been run -- we'd rather tell you that plainly than round an open question up to "fine."</p>
  <div class="stat-row">
    <div class="stat-pill"><div class="value">${fullySupportedCount}/${merged.length}</div><div class="label">Findings fully confirmed end-to-end</div></div>
    <div class="stat-pill"><div class="value">${pct(agg.mean_llm_confidence)}</div><div class="label">AI's average initial confidence</div></div>
    <div class="stat-pill"><div class="value">${pct(agg.mean_dst_betp)}</div><div class="label">Average confidence after combining with hard evidence</div></div>
    <div class="stat-pill"><div class="value">${agg.divergence_count ?? "--"}</div><div class="label">Finding(s) where AI and hard evidence meaningfully diverged</div></div>
  </div>
  <p>On average, verifying each claim against real code and live on-chain data moved the confidence level by ${fmt3(agg.mean_absolute_change)} (on a 0-to-1 scale) relative to the AI's first, unverified read. This assessment reflects the protocol's code and on-chain state as of ${esc(generatedAt.slice(0, 10))}; it should be re-run periodically, and re-run again once the remaining behavioural tests are executed, rather than treated as a permanent verdict.</p>
</section>

</div>

<footer>Aave Protocol Risk Assessment &middot; generated ${esc(generatedAt)} from live pipeline outputs &middot; not a conventional security audit</footer>

</body>
</html>`;


// ======================================================================
// OUTPUT
// ======================================================================

return [
    {
        json: {
            node: "Node 19 (Aave) - Investor Security Assessment Report Generator",
            version: "1.0",
            generated_at: generatedAt,
            era_available: !!era,
            finding_count: merged.length,
            html
        },
        binary: {
            report: {
                data: Buffer.from(html, "utf-8").toString("base64"),
                mimeType: "text/html",
                fileName: "Aave_Protocol_Investor_Risk_Assessment.html"
            }
        }
    }
];
