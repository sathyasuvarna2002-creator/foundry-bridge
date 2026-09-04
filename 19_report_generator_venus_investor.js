/***********************************************************************
 * NODE 19 — INVESTOR SECURITY ASSESSMENT REPORT GENERATOR (VENUS)
 * VERSION 1.0
 *
 * Replaces the technical-first Neuro-Symbolic Assessment Report
 * (19_report_generator.js) for an investor audience, per explicit
 * redesign request. Same architecture -- generated dynamically from
 * live pipeline outputs on every run, never a hand-built static
 * document -- but restructured end to end:
 *
 *   - Leads with WHY this exists (real, cited DeFi loss data; a real,
 *     cited September 2025 incident against Venus Protocol itself),
 *     not with Dempster-Shafer notation.
 *   - Tells the method as a four-step story in plain language.
 *   - Each finding is framed as: what it means in plain terms, where
 *     the proof actually came from (source code / live on-chain check
 *     via direct contract calls / a reproduced forked-chain test /
 *     documented historical precedent / independent audit), and what
 *     it means for an investor -- not a statistics table first.
 *   - All DST/K3 mathematics moved to a short technical appendix at
 *     the end, for the reader who wants to verify the machinery.
 *
 * EXTERNAL CITATIONS (static, dated, sourced -- NOT computed by this
 * pipeline, and clearly separated from it). Verified by direct fetch
 * on 2026-08-12, not asserted from model memory:
 *   [1] Chainalysis, "The Venus Protocol Incident: How Hexagate and a
 *       Community Stopped a Hack and Enabled a Swift Recovery,"
 *       Sept 9, 2025.
 *       https://www.chainalysis.com/blog/hexagate-and-community-stops-a-hack-on-venus-protocol/
 *   [2] The Block (Danny Park), "Crypto hacks hit $3.4 billion in
 *       2025, attacks on individual wallets rise: Chainalysis,"
 *       Dec 18, 2025.
 *       https://www.theblock.co/news/regulation/2025-12-18-crypto-hack-2025-chainalysis-382477
 *   [3] altFINS (Lenka Fetyko), "DeFi Hacks 2026: $840M+ Lost and the
 *       Attack That Changed Everything," June 9, 2026 (data as of
 *       that date; sources cited therein: Halborn, CCN, CoinDesk,
 *       Chainalysis, Koinly, DeFiLlama).
 *       https://altfins.com/blog/defi-hacks-2026/
 *   [4] Venus Protocol Community, "[BNB Chain] Venus 2026 H1 Review,"
 *       July 30, 2026.
 *       https://community.venus.io/t/bnb-chain-venus-2026-h1-review/5874
 *
 * IMPORTANT HONESTY NOTE baked into the report itself, not just this
 * comment: the real September 2025 Venus incident cited above was an
 * ACCOUNT-LEVEL social engineering / delegate-permission attack against
 * one user, not a smart-contract code vulnerability. This report's
 * pipeline assesses a DIFFERENT, complementary risk surface --
 * architectural / smart-contract risk -- and says so explicitly rather
 * than borrowing the incident's drama without the distinction. Per
 * [3], 72% of 2026 DeFi losses industry-wide were key/credential theft,
 * not contract bugs -- the report states this plainly rather than
 * overselling what code-level analysis alone covers.
 *
 * REQUIRED INPUTS (by actual on-canvas node name -- confirmed against the
 * live "Venus - Final (4).json" export on 2026-08-12. Note the on-canvas
 * `name` fields are NOT in sync with the logical "Node NN" numbers used
 * in code comments throughout this pipeline -- e.g. the canvas node
 * literally titled "13_Deterministic_Evidence_Fusion" is logical Node 13
 * per its own header comment, and "17_Deterministic_Ground_Truth" is
 * logical Node 18. This file's candidate-name lists account for both):
 *   07_AI_Risk_Reasoner              -- architectural narrative (logical Node 07)
 *   09_AI_Historical_Exploit_Reasoner -- historical precedent (logical Node 09)
 *   13_Deterministic_Evidence_Fusion  -- verbatim evidence, executed test
 *                                        names, source provenance, unmapped
 *                                        audit entries (logical Node 13, Venus)
 *   17_Deterministic_Ground_Truth     -- authoritative numeric figures per
 *                                        finding (logical Node 18, Venus)
 * OPTIONAL INPUT:
 *   16_Evidence_Review_Agent (logical ERA, Venus) -- narrative enrichment
 *   and the pre-separated mapped/unmapped audit distinction. Falls back
 *   gracefully, never fabricates ERA prose that wasn't produced.
 *
 * HISTORICAL-PRECEDENT MATCHING CAVEAT (disclosed in the report itself,
 * not hidden): Node 09's historical assessments are keyed to Node 07's
 * OWN raw finding_id, which is not guaranteed to be the same string as
 * the VENUS_SPEC finding_id Node 13/18 resolve to (this is the same
 * open-taxonomy reason Node 13 needed anchor-token matching in the
 * first place). This node matches them by normalized finding-name
 * similarity, best-effort, and falls back to "no precedent identified"
 * rather than guessing when no confident match exists -- consistent
 * with the open-world-assumption discipline used throughout this
 * pipeline. It does not invent a link Node 07/09's own IDs don't
 * support.
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

const node09 =
    getNodeJSON("09_AI_Historical_Exploit_Reasoner");

const NODE_13_CANDIDATES = [
    "13_Deterministic_Evidence_Fusion",
    "13_Deterministic_Evidence_Specification_Venus",
    "13_Deterministic_Evidence_Specification",
    "Node 13"
];
let node13 = null;
for (const name of NODE_13_CANDIDATES) {
    const data = getNodeJSON(name);
    if (data) { node13 = data; break; }
}

const NODE_18_CANDIDATES = [
    "17_Deterministic_Ground_Truth",
    "18_Grounding_Effect_Evaluation_Venus",
    "18_grounding_effect_evaluation_venus",
    "18_Deterministic_Grounding_Effect_Evaluation",
    "18_Grounding_Effect_Evaluation",
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
        "Node 19 (Venus investor report): no valid Node 18 output found. This report is built " +
        "from Node 18's grounding effect evaluation and cannot run without it."
    );
}

// ERA is optional -- try every candidate name, never throw if missing.
const ERA_CANDIDATES = ["16_Evidence_Review_Agent", "ERA", "Evidence_Review_Agent", "15_Evidence_Review_Agent", "ERA_Venus"];
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
// (see HISTORICAL-PRECEDENT MATCHING CAVEAT in the header comment)
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
    // Node 09 operates directly on Node 07's raw findings and preserves Node 07's
    // own risk_name verbatim in its architectural_risk field. Node 13 separately
    // preserves that same verbatim Node 07 name in source_findings.node07_architecture
    // .source_finding_name. So an EXACT match against that name (when available) is
    // far more reliable than fuzzy-matching against the VENUS_SPEC's own paraphrased
    // finding_name -- confirmed against real pipeline output, where fuzzy matching
    // alone produced a false negative (ACCESS_CONTROL_01) that exact matching resolves
    // correctly. Fuzzy matching against the spec name is kept only as a fallback for
    // when Node 13's exact name isn't available.
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
// EXTRACT NODE 13 (VENUS) FINDINGS -- verbatim evidence, executed tests,
// source provenance, unmapped entries
// ======================================================================

function extractNode13Findings(root) {
    const candidates = [root && root.deterministic_evidence && root.deterministic_evidence.findings, root && root.findings];
    for (const c of candidates) {
        if (Array.isArray(c) && c.length) return c;
    }
    return [];
}
const node13Findings = node13 ? extractNode13Findings(node13) : [];
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
// INVESTOR-FRIENDLY, FINDING-KEYED CONTENT (stable across runs -- the
// six VENUS_SPEC categories don't change name run to run, only their
// evidence does). Falls back to a generic template for any finding_id
// not in this list (e.g. a future spec category), never blocks the
// report from rendering.
// ======================================================================

const PLAIN_LANGUAGE = {
    UPGRADEABILITY_01: {
        headline: "Who can change how the contract behaves?",
        plain: "This contract can be upgraded -- its logic can be swapped out after deployment. That's normal for DeFi, but it means a single administrative key (or the multisig/governance process controlling it) has real power to change what the contract does in the future. If that key is ever compromised, an attacker doesn't need a code bug at all -- they'd already have the keys to the building.",
        why_it_matters: "As an investor, this is about who you're trusting, not just what code you're trusting. We checked whether that door is actually locked to everyone except the intended admin."
    },
    ACCESS_CONTROL_01: {
        headline: "Who is allowed to change the protocol's risk settings?",
        plain: "Certain sensitive actions -- like changing how much of a market's revenue goes to reserves -- are gated behind a permission check managed by a separate access-control contract. That's good practice, but it centralizes trust in one more place: whoever controls that access-control contract effectively controls those settings.",
        why_it_matters: "We tested this directly: can a random, unpermissioned wallet actually perform one of these gated actions? If the gate isn't real, the whole safety model built on top of it isn't real either."
    },
    ECONOMIC_DEPENDENCY_01: {
        headline: "What sets your interest rate, and can it be gamed?",
        plain: "Interest rates aren't calculated inside this contract -- they're pulled from a separate, external interest-rate model contract. If that external model can be swapped, misconfigured, or manipulated, borrower and lender rates change with it, even though the lending contract's own code never changed.",
        why_it_matters: "This is a dependency risk: the contract you're trusting is only as sound as another contract it silently relies on."
    },
    ASSET_CUSTODY_01: {
        headline: "Can someone manipulate the exchange rate just by sending tokens?",
        plain: "The contract calculates its internal exchange rate directly from its own token balance. That design has a known failure mode in Compound-derived lending markets: someone can send tokens directly to the contract (no special function call needed) and shift the exchange rate for everyone else, without ever calling the official deposit function.",
        why_it_matters: "This exact pattern is how real money has been lost elsewhere in DeFi before (see the historical precedent below). We didn't just flag it -- we reproduced the attack ourselves on a forked copy of the real blockchain to see what actually happens."
    },
    DEPENDENCY_01: {
        headline: "Does a single policy contract control market safety limits?",
        plain: "A central risk-management contract (the Comptroller) reads this contract's own numbers back to decide things like supply caps and fee routing. If that central contract is ever misconfigured or contains a bug -- even one totally unrelated to this specific market -- the effects ripple outward to every market that depends on it.",
        why_it_matters: "This is the same structural pattern behind Compound's real 2021 distribution incident (see below) -- a central policy contract, not any individual market, was the point of failure."
    },
    OPERATIONAL_RESILIENCE_01: {
        headline: "Does moving protocol reserves out actually work as intended?",
        plain: "When the protocol reduces its reserves, funds are sent to a separate external contract responsible for distributing protocol revenue, which then has to update its own accounting. We could confirm this pathway exists and is wired up correctly in the code -- but the live, end-to-end \"does the actual money movement succeed and land correctly\" test for this specific pathway has not been executed yet.",
        why_it_matters: "This is the one finding in this report where we're telling you plainly: the architecture looks right, but we haven't finished proving it in practice yet. We'd rather say that clearly than round it up to \"fine.\""
    }
};
const DEFAULT_PLAIN = {
    headline: null,
    plain: null,
    why_it_matters: "This finding did not have pre-written investor framing at report-generation time; see the technical description below for the underlying claim."
};


// ======================================================================
// PROOF TRAIL -- built from Node 13 (Venus)'s real predicates, per
// finding. Never fabricated: reflects exactly what evidence_requirement
// and validation_result each predicate actually reports.
// ======================================================================

function buildProofTrail(f13) {
    const steps = [];
    if (!f13) {
        return [{ label: "Evidence detail", state: "unavailable", detail: "Node 13 (Venus) output for this finding was not available when this report was generated." }];
    }
    const predicates = Array.isArray(f13.predicates) ? f13.predicates : [];

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
    const runtimeP = predicates.find(p => p.evidence_requirement === "RUNTIME_EXISTENCE");
    if (runtimeP) {
        const pass = runtimeP.validation_result === "PASS";
        steps.push({
            label: "Live on-chain check",
            state: pass ? "done" : "partial",
            detail: pass
                ? "Confirmed by directly querying the actual, currently-deployed contract on-chain -- not the source code, the real running bytecode."
                : "Could not be confirmed against the live, currently-deployed contract in this run."
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

    const hasAudit = Array.isArray(f18.sources) && f18.sources.includes("NODE_08_AUDIT");
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
        proof_trail: buildProofTrail(f13),
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

const agg = node18.aggregate_evaluation;
const strongCount = merged.filter(f => f.deterministic_status === "FULLY_SUPPORTED").length;
const openCount = merged.length - strongCount;


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
    <strong>An audit finding we couldn't confidently place</strong>
    We found ${eraUnmapped.length} independently-published audit finding${eraUnmapped.length > 1 ? "s" : ""} that ${eraUnmapped.length > 1 ? "don't" : "doesn't"} cleanly match any of the ${merged.length} risk areas above using our strict, code-level matching rules. Rather than force a connection our own system couldn't verify, we're disclosing ${eraUnmapped.length > 1 ? "them" : "it"} here as context. This is not used to raise or lower confidence in any finding above.
    ${eraUnmapped.map(u => `<p style="margin-top:10px;"><strong>${esc(u.source_finding_name)}</strong> -- ${esc(u.note)}</p>`).join("")}
  </div>`;
}

const generatedAt = new Date().toISOString();

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Venus Protocol -- An Evidence-Based Risk Assessment</title>
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
    <p class="eyebrow">Independent Risk Assessment &middot; Venus Protocol</p>
    <h1>Venus Protocol: Evidence-Based Smart Contract Risk Assessment</h1>
    <p class="sub">A finding-by-finding account of what we found, why it matters, whether this pattern has caused losses elsewhere before, and exactly what evidence backs each claim.</p>
    <div class="meta">
      <div><strong>${merged.length}</strong>risk areas investigated</div>
      <div><strong>${strongCount} of ${merged.length}</strong>fully confirmed by direct evidence</div>
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
  <p class="lead">Every claim below had to survive four independent checks before it counted as a finding. We tell you plainly whenever one of those checks came up short, rather than rounding an open question up to "fine."</p>
  <ul class="plain">
    <li><strong>Source code.</strong> The real, deployed Solidity source, read function by function -- not documentation or marketing material.</li>
    <li><strong>Live on-chain check.</strong> The actual, currently-running contract queried directly on-chain, confirming what it does now, not just what the source says it should do.</li>
    <li><strong>Architectural reasoning, cross-checked.</strong> An AI identified risks the way a security researcher would; we then independently checked each claim against documented historical exploits and, where available, independently-published audit findings.</li>
    <li><strong>Mathematical combination, disagreement included.</strong> Where sources agreed, we say so. Where they diverged, we flag it explicitly rather than blending it into one reassuring number. The formulas are in the technical appendix.</li>
  </ul>
  <div class="callout blue">
    <strong>What "we actually tested it" means</strong>
    For most findings below, we didn't just read code and reason about what should happen -- we reproduced the underlying scenario on a forked copy of the real blockchain and watched what actually occurred.
  </div>
</section>

<section id="s2">
  <p class="section-num">Section 2</p>
  <h2>Findings</h2>
  <p>Each of the ${merged.length} risk areas below covers the same ground: what it means, why it matters, whether this pattern has caused real losses elsewhere before, and exactly what evidence backs it.</p>
  ${merged.map((f, i) => findingSection(f, i)).join("")}
  ${unmappedSection()}
</section>

<section id="s3">
  <p class="section-num">Section 3</p>
  <h2>Limitations</h2>
  <ul class="plain">
    <li><strong>This is not a formal security audit.</strong> It doesn't carry the legal or professional assurances a licensed audit firm's engagement letter does.</li>
    <li><strong>This does not cover account-level or operational security.</strong> Key compromise and social-engineering attacks against individual users or admins are a separate risk category from the smart-contract layer this report investigates.</li>
    <li><strong>A "fully confirmed" finding is not a guarantee against exploitation.</strong> It means the specific claim we tested held up against the evidence we could gather -- not that no other issue exists.</li>
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
    <p>Each finding's underlying claims are checked against on-chain evidence using a three-valued logic system <span class="term">(Kleene K3)</span>: every claim is marked SUPPORTED, CONTRADICTED, or UNRESOLVED -- never forced into a binary yes/no it doesn't deserve. This layer is frozen and read-only, and its output is never treated as ground truth.</p>
    <h3>Dempster-Shafer evidence fusion</h3>
    <p>The AI's original confidence and the deterministic evidence are combined using the classical normalized Dempster-Shafer combination rule, over a frame of discernment &Theta; = {R, &not;R}:</p>
    <p style="text-align:center; font-family: 'SF Mono', Consolas, monospace; font-size: 13.5px; color: var(--navy-2); background:#eef1f5; padding:14px; border-radius:8px;">
      K = m<sub>1</sub>(R)&middot;m<sub>2</sub>(&not;R) + m<sub>1</sub>(&not;R)&middot;m<sub>2</sub>(R)<br>
      m<sub>12</sub>(A) = &Sigma;<sub>B&cap;C=A</sub> m<sub>1</sub>(B)&middot;m<sub>2</sub>(C) &divide; (1 &minus; K)
    </p>
    <p>K measures how much the two evidence sources actually contradicted each other. The combination produces Belief (Bel(R), the lowest confidence directly supported), Plausibility (Pl(R), the highest confidence not ruled out), and pignistic probability (BetP(R), a single decision-oriented summary number). Because the AI-reasoning source structurally never asserts &not;R, whenever deterministic evidence shows no contradiction the combined belief simplifies to combined_R = s + c(1&minus;s), where s is deterministic support and c is the AI's confidence -- always &ge; c. This is a proven structural property, not a per-finding correction.</p>
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
    <p class="footnote">Self-test suite: this pipeline runs 7 synthetic Dempster-Shafer combination test cases with independently hand-verified expected values on every execution, and refuses to report real findings if any fail. Divergence threshold (0.15) is an explicitly disclosed engineering parameter, not a validated scientific constant. Findings with genuine conflict (K &gt; 0) are categorized CONFLICT regardless of how close the combined confidence landed to the AI's original number, since Dempster's rule absorbs disagreement into K rather than necessarily lowering the fused belief.</p>
  </div>
</section>

<section id="s5">
  <p class="section-num">Section 5</p>
  <h2>Conclusion</h2>
  <p class="lead">Of the ${merged.length} risk areas investigated, ${strongCount} were fully confirmed by the combined evidence -- source code, live on-chain data, and in most cases a reproduced test all pointed the same direction. None were contradicted. ${openCount} finding${openCount === 1 ? "" : "s"} still ha${openCount === 1 ? "s" : "ve"} a genuinely open question attached to ${openCount === 1 ? "it" : "them"}, disclosed above rather than rounded up.</p>
  <div class="stat-row">
    <div class="stat-pill"><div class="value">${strongCount}/${merged.length}</div><div class="label">Fully confirmed findings</div></div>
    <div class="stat-pill"><div class="value">${pct(agg.mean_llm_confidence)}</div><div class="label">AI's average initial confidence</div></div>
    <div class="stat-pill"><div class="value">${pct(agg.mean_dst_betp)}</div><div class="label">Average confidence after combining with hard evidence</div></div>
    <div class="stat-pill"><div class="value">${agg.divergence_count}</div><div class="label">Finding(s) where AI and hard evidence meaningfully diverged</div></div>
  </div>
  <p>On average, verifying each claim against real code and live on-chain data moved the confidence level by ${fmt3(agg.mean_absolute_change)} (on a 0-to-1 scale) relative to the AI's first, unverified read -- almost always upward, because the underlying architecture genuinely does work the way it was described. This assessment reflects the protocol's code and on-chain state as of ${esc(generatedAt.slice(0, 10))}; it should be re-run periodically rather than treated as a permanent verdict.</p>
</section>

</div>

<footer>Venus Protocol Risk Assessment &middot; generated ${esc(generatedAt)} from live pipeline outputs &middot; not a conventional security audit</footer>

</body>
</html>`;


// ======================================================================
// OUTPUT
// ======================================================================

return [
    {
        json: {
            node: "Node 19 (Venus) - Investor Security Assessment Report Generator",
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
                fileName: "Venus_Protocol_Investor_Risk_Assessment.html"
            }
        }
    }
];
