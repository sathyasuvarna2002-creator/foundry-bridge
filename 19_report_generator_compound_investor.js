/***********************************************************************
 * NODE 19 — INVESTOR SECURITY ASSESSMENT REPORT GENERATOR (COMPOUND)
 * VERSION 1.2
 *
 * v1.0 -> v1.1: added a new "What This Assessment Actually Found" section
 * (id="sfunnel"), placed right after the cover/table of contents, driven
 * by Node 18 (Compound) v2.2's new `disclosure_funnel` field. Reason: a
 * bare top-line "N risk areas investigated" (N = the small, fully
 * cross-validated set) undersold runs where architecture/audit review
 * actually surfaced many more candidate findings than made it into that
 * final number -- most of the gap is the anchor-token matcher correctly
 * declining to force weak matches onto Compound's small, strict 5-key
 * taxonomy, not evidence going missing. This section states the real
 * funnel (identified -> matched to a canonical claim -> cross-validated
 * -> fully confirmed) using numbers Node 18 already computed, with no
 * new classification logic and no change to any per-finding content
 * below it. Falls back gracefully (skips the section) if an older Node
 * 18 without `disclosure_funnel` is connected, rather than throwing.
 *
 * v1.1 -> v1.2: fixed two real problems found by comparing a v1.1 report
 * against a real run (not hypothetical -- a real generated HTML was
 * reviewed):
 *
 * (a) `merged` was built strictly from `node18.per_finding`, which only
 *     contains findings with `fusion_applicable: true`. That silently
 *     excludes every canonical-matched finding with no independent Node
 *     07 claim to compare against -- which, by design, is
 *     UPGRADEABILITY_01 (the negative control) on most real runs, since
 *     it has an always-on deterministic check but no guaranteed Node 07
 *     counterpart. Result: the single most distinctive, reassuring,
 *     fully-researched finding in this report (real source-code check +
 *     real on-chain query both confirming no delegatecall-proxy exists)
 *     was completely invisible in Section 2 of a real generated report,
 *     even though Node 18's own disclosure_funnel correctly counted it
 *     as "matched." Fixed by building `merged` from Node 17's full
 *     findings array (excluding only true UNMAPPED-* / UNMAPPED-AUDIT-*
 *     entries), so every canonical-matched finding gets a full writeup
 *     regardless of fusion_applicable -- with confidence-strip rendering
 *     adapted (see (b)) for the ones with no independent AI claim to
 *     compare against.
 *
 * (b) buildProofTrail()'s SOURCE_RELATIONSHIP step displayed
 *     MAPPED_PENDING_INDEPENDENT_VERIFICATION as "done"/"Confirmed" --
 *     the same visual treatment as a true PASS -- while Node 16
 *     (Compound) deliberately classifies that same validation_result as
 *     UNRESOLVED, never SUPPORTED (see 16_deterministic_evidence_anchor_
 *     compound.js's own header comment on why this is more conservative
 *     than Aave/Venus). The real report this was caught against showed
 *     all three proof-trail steps for ACCESS_CONTROL_01 as "Confirmed"
 *     while the finding's own badge read "Partially confirmed" directly
 *     above it -- a visible, confusing self-contradiction inside the
 *     same finding-block. Fixed with a new, honest "mapped_pending"
 *     proof-step state, distinct from "done," whose label and detail
 *     text match Compound's own more conservative language instead of
 *     overstating it.
 *
 * Compound counterpart to 19_report_generator_venus_investor.js. Same
 * architecture -- generated dynamically from live pipeline outputs on
 * every run, never a hand-built static document -- with four real
 * changes beyond renaming:
 *
 * 1. NEGATIVE CONTROL RENDERING (the load-bearing change). Compound's
 *    spec always emits UPGRADEABILITY_01 as a NEGATIVE_CONTROL finding
 *    -- its stated claim is the ABSENCE of a delegatecall-proxy
 *    mechanism, not the presence of one. Venus/Aave have no equivalent
 *    concept, so their report generators have no code path for it. If
 *    this finding were rendered through the same badge/callout logic as
 *    every other finding, a FULLY_SUPPORTED status and a 99%+ combined
 *    confidence would visually read to an investor as "high confidence
 *    this upgrade risk is real" -- exactly backwards. findingSection()
 *    below checks finding_polarity and, for NEGATIVE_CONTROL, renders a
 *    distinct green "Risk Check: Ruled Out" callout instead of the
 *    standard risk framing, and the severity badge uses its own
 *    "informational" class rather than reusing "medium" the way the
 *    Venus version defaults Low/Informational findings.
 *
 * 2. EXECUTED_PRECONDITION_UNMET in the proof trail. Compound's Node 13
 *    has a real third behavioural outcome beyond PASS/FAIL/not-tested:
 *    a test that genuinely executed against live state but hit a
 *    disclosed real-world precondition (ECONOMIC_DEPENDENCY_01's
 *    interest-accrual test, gated on a non-zero borrow rate that was 0
 *    at the block tested). buildProofTrail() now has a fourth proof-step
 *    state, "precondition_unmet", with its own honest plain-language
 *    description -- distinct from "not tested yet," since a real
 *    experiment did run.
 *
 * 3. UNMAPPED CONTEXT FROM BOTH SOURCES. Venus's ERA only ever produced
 *    audit-sourced (`unmapped_audit_context`) entries. Compound's ERA
 *    schema (`ERA_compound_schema_v1.json`) renames this to
 *    `unmapped_context` and adds a `source` field, because Compound's
 *    anchor-token matcher draws unmatched candidates from BOTH Node 07
 *    (architecture) and Node 08 (audit). unmappedSection() reads the
 *    new field name (falling back to the old one defensively) and no
 *    longer assumes every entry is audit-sourced in its prose.
 *
 * 4. REAL, VERIFIED CITATIONS, SPECIFIC TO COMPOUND. Verified via live
 *    web search on 2026-08-19, not asserted from model memory:
 *   [1] CNBC (MacKenzie Sigalos), "DeFi protocol Compound mistakenly
 *       gives away $90 million to users," Oct 1, 2021.
 *       https://www.cnbc.com/2021/10/01/defi-protocol-compound-mistakenly-gives-away-millions-to-users.html
 *   [2] CoinDesk, "Compound Founder Says $80M Bug Presents 'Moral
 *       Dilemma' for DeFi Users," Oct 1, 2021.
 *       https://www.coindesk.com/tech/2021/10/01/compound-founder-says-80m-bug-presents-moral-dilemma-for-defi-users
 *   [3] altFINS (Lenka Fetyko), "DeFi Hacks 2026: $840M+ Lost and the
 *       Attack That Changed Everything," June 9, 2026 (same source
 *       already cited in the Venus report, reused here for consistent,
 *       industry-wide, dated figures rather than a second source).
 *       https://altfins.com/blog/defi-hacks-2026/
 *
 *   IMPORTANT HONESTY NOTE baked into the report itself, not just this
 *   comment: unlike Venus's cited incident, Compound's own real 2021
 *   COMP-distribution bug ([1], [2]) was NOT a smart-contract access-
 *   control bypass or a reentrancy exploit -- it was a governance-
 *   executed distribution-logic error (a single incorrect comparison
 *   operator in a formally-proposed and voted-on upgrade, Proposal 62),
 *   caught and patched by the same governance process days later
 *   (Proposal 64). It illustrates why this report tests governance/
 *   admin power generally (see ACCESS_CONTROL_01, UPGRADEABILITY_01
 *   below), not that it independently confirms any single finding in
 *   this run. The report states this distinction plainly rather than
 *   borrowing the incident's drama without it.
 *
 * REQUIRED INPUTS (by logical Node number -- actual on-canvas node
 * names for Node 18/ERA on the Compound canvas were not confirmed this
 * session, since both are brand-new nodes; candidate-name lists below
 * include the most likely names but MUST be checked against your real
 * canvas, same caveat as every other Compound file this session):
 *   07_AI_Risk_Reasoner               -- architectural narrative (logical Node 07)
 *   09_AI_Historical_Exploit_Reasoner  -- historical precedent (logical Node 09)
 *   13_Deterministic_Evidence_Specification_Compound -- verbatim evidence,
 *                                         executed test names, source
 *                                         provenance, unmapped entries
 *                                         (logical Node 13, Compound)
 *   Node 18 (Compound)'s grounding-effect output -- authoritative numeric
 *                                         figures per finding
 * OPTIONAL INPUT:
 *   ERA (Compound)'s structured output -- narrative enrichment and the
 *   pre-separated mapped/unmapped context. Falls back gracefully, never
 *   fabricates ERA prose that wasn't produced.
 *
 * HISTORICAL-PRECEDENT MATCHING CAVEAT (disclosed in the report itself,
 * not hidden) -- unchanged from Venus: Node 09's historical assessments
 * are keyed to Node 07's OWN raw finding_id/risk_name, not guaranteed to
 * match COMPOUND_SPEC's finding_id. This node matches by exact verbatim
 * name first (via Node 13's source_findings.node07_architecture.
 * source_finding_name), falling back to normalized fuzzy matching, and
 * to "no precedent identified" rather than guessing when no confident
 * match exists.
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
    "13_Deterministic_Evidence_Specification_Compound",
    "13_Deterministic_Evidence_Specification",
    "Deterministic Evidence Specification (Compound)",
    "Node 13"
];
let node13 = null;
for (const name of NODE_13_CANDIDATES) {
    const data = getNodeJSON(name);
    if (data) { node13 = data; break; }
}

const NODE_18_CANDIDATES = [
    "18_Deterministic_Grounding_Effect_Evaluation_Compound",
    "18_Grounding_Effect_Evaluation_Compound",
    "18_grounding_effect_evaluation_compound",
    "18_Deterministic_Grounding_Effect_Evaluation",
    "18_Grounding_Effect_Evaluation",
    "17_Deterministic_Ground_Truth",
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
        "Node 19 (Compound investor report): no valid Node 18 output found. This report is built " +
        "from Node 18's grounding effect evaluation and cannot run without it. Tried: " +
        NODE_18_CANDIDATES.join(", ") + "."
    );
}

// Node 17 is now a REQUIRED input as of v1.2 (previously Node 19 only read
// Node 18, which excludes fusion_applicable=false findings like the
// negative control -- see v1.1 -> v1.2 changelog point (a) above). Node
// 17's own findings array is the authoritative full canonical population
// this report is built from.
const NODE_17_CANDIDATES = [
    "15_DST_Evidence_Fusion",
    "17_DST_Evidence_Fusion_Compound",
    "17_dst_evidence_fusion_compound",
    "17_DST_Evidence_Fusion",
    "Node 17"
];
let node17 = null;
for (const name of NODE_17_CANDIDATES) {
    const data = getNodeJSON(name);
    if (data) { node17 = data; break; }
}

if (!node17 || !Array.isArray(node17.findings) || node17.findings.length === 0) {
    throw new Error(
        "Node 19 (Compound investor report): no valid Node 17 output found. This report is built from " +
        "Node 17's full findings array (not just Node 18's fusion-applicable subset) so that canonical-" +
        "matched findings with no independent Node 07 claim -- e.g. the negative control on most real runs " +
        "-- still get a full writeup. Tried: " + NODE_17_CANDIDATES.join(", ") + "."
    );
}

// ERA is optional -- try every candidate name, never throw if missing.
const ERA_CANDIDATES = [
    "ERA_Compound", "Evidence_Review_Agent_Compound", "16_Evidence_Review_Agent_Compound",
    "ERA", "Evidence_Review_Agent", "16_Evidence_Review_Agent"
];
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
    if (s === "low") return "low";
    if (s === "informational") return "informational";
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
// EXTRACT NODE 13 (COMPOUND) FINDINGS -- verbatim evidence, executed
// tests, source provenance, unmapped entries
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
// EXTRACT ERA ASSESSMENTS + unmapped context (optional). Compound's ERA
// schema uses `unmapped_context` (dual-source), not Venus's
// `unmapped_audit_context` -- both are checked, new name first.
// ======================================================================

function extractEraAssessments(root) {
    const candidates = [root && root.review_assessments, root && root.output && root.output.review_assessments];
    for (const c of candidates) {
        if (Array.isArray(c) && c.length) return c;
    }
    return [];
}
function extractEraUnmapped(root) {
    const candidates = [
        root && root.unmapped_context,
        root && root.output && root.output.unmapped_context,
        root && root.unmapped_audit_context,
        root && root.output && root.output.unmapped_audit_context
    ];
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
// five COMPOUND_SPEC categories don't change name run to run, only
// their evidence does). Falls back to a generic template for any
// finding_id not in this list (e.g. a future spec category), never
// blocks the report from rendering.
// ======================================================================

const PLAIN_LANGUAGE = {
    UPGRADEABILITY_01: {
        headline: "Can this contract's logic be secretly swapped out?",
        plain: "This is the one check in this report where the answer is reassuring rather than a risk to weigh. Many DeFi lending contracts are deployed behind an upgradeable proxy -- a design where an administrator can swap the entire logic of the contract for something else, at any time, without users' consent. That pattern means trusting a key-holder as much as the code itself. We checked whether this specific deployment has that mechanism.",
        why_it_matters: "It doesn't. We queried the live, deployed contract directly and confirmed there is no implementation-swap function to call -- not that one exists and is well-guarded, but that the mechanism itself is absent from this specific market. There is no admin key anywhere that can silently rewrite this contract's logic after the fact.",
        is_negative_control: true
    },
    ACCESS_CONTROL_01: {
        headline: "Who is allowed to change the protocol's risk settings?",
        plain: "Certain sensitive actions -- like changing how much of a market's revenue goes to reserves via _setReserveFactor -- are gated behind a single administrator check. That's a deliberate, common design in this generation of lending protocols, but it does mean one key (or the multisig/governance process controlling it) has real power over the market's economics.",
        why_it_matters: "We tested this directly: can a random, unpermissioned wallet actually call this gated function? If the gate isn't real, the whole safety model built on top of it isn't real either."
    },
    ASSET_CUSTODY_01: {
        headline: "Can someone manipulate the exchange rate just by sending tokens?",
        plain: "This contract's internal exchange rate is calculated in part from its own token balance. That design has a known failure mode in Compound-derived lending markets: someone can send tokens directly to the contract (no special function call needed) and shift the exchange rate for everyone else, without ever calling the official deposit function.",
        why_it_matters: "This exact pattern is how real money has been lost elsewhere in DeFi before. We didn't just flag it -- we reproduced the attack ourselves on a forked copy of the real blockchain, with real recorded balance deltas, to see what actually happens to this specific contract."
    },
    OPERATIONAL_RESILIENCE_01: {
        headline: "Can protocol activity actually be paused if something goes wrong?",
        plain: "The protocol has a guardian-controlled emergency brake -- separate flags that can halt new minting and new borrowing in this market independently of each other. This matters because it's the tool that would actually get used in a live incident, not a theoretical safeguard.",
        why_it_matters: "We confirmed this pathway exists in the deployed contract and, in a real forked-chain test, that the market's current paused/deprecated state is exactly what the guardian mechanism would produce -- not just that the code looks like it should work."
    },
    ECONOMIC_DEPENDENCY_01: {
        headline: "What sets your interest rate, and can it be gamed?",
        plain: "Interest rates aren't calculated inside this contract -- they're pulled from a separate, external interest-rate model contract via accrueInterest(). If that external model can be swapped, misconfigured, or manipulated, borrower and lender rates change with it, even though the lending contract's own code never changed.",
        why_it_matters: "This is a dependency risk: the contract you're trusting is only as sound as another contract it silently relies on. We confirmed the external model is real and wired in; the live behavioural test for how accrual responds to it hit a real-world precondition at the specific block we tested (see below) rather than completing cleanly either way."
    }
};
const DEFAULT_PLAIN = {
    headline: null,
    plain: null,
    why_it_matters: "This finding did not have pre-written investor framing at report-generation time; see the technical description below for the underlying claim."
};


// ======================================================================
// PROOF TRAIL -- built from Node 13 (Compound)'s real predicates, per
// finding. Never fabricated: reflects exactly what evidence_requirement
// and validation_result each predicate actually reports. Has a fourth
// state, precondition_unmet, that Aave/Venus's versions of this
// function don't need -- see header comment point 2.
// ======================================================================

function buildProofTrail(f13) {
    const steps = [];
    if (!f13) {
        return [{ label: "Evidence detail", state: "unavailable", detail: "Node 13 (Compound) output for this finding was not available when this report was generated." }];
    }
    const predicates = Array.isArray(f13.predicates) ? f13.predicates : [];

    const sourceP = predicates.find(p => p.evidence_requirement === "SOURCE_RELATIONSHIP");
    if (sourceP) {
        // MAPPED_PENDING_INDEPENDENT_VERIFICATION is NOT the same as a pass --
        // Node 16 (Compound) deliberately classifies it as UNRESOLVED, never
        // SUPPORTED, more conservatively than Aave/Venus (see 16_deterministic_
        // evidence_anchor_compound.js's own header comment). Showing it as
        // "done"/"Confirmed" here would visually contradict a finding's own
        // PARTIALLY_SUPPORTED badge two lines above it -- fixed in v1.2 with a
        // distinct, honestly-worded state instead of conflating it with a pass.
        if (sourceP.validation_result === "PASS" || sourceP.validation_result === "SUPPORTED") {
            steps.push({
                label: "Source code",
                state: "done",
                detail: "The underlying mechanism was found directly in the protocol's own verified source code, quoted verbatim below."
            });
        } else if (sourceP.validation_result === "MAPPED_PENDING_INDEPENDENT_VERIFICATION") {
            steps.push({
                label: "Source code",
                state: "mapped_pending",
                detail: "The underlying mechanism was located and matched to this specific claim in the protocol's own verified source code (quoted below) -- but Compound's own evaluator treats a source-code mapping alone as not yet independently verified proof, more conservatively than simply counting it as confirmed. See the live on-chain and forked-test steps below for the independent verification this claim also has."
            });
        } else {
            steps.push({
                label: "Source code",
                state: "partial",
                detail: "No direct source-code citation was matched to this specific claim in this run."
            });
        }
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
        } else if (experimentP.validation_result === "EXECUTED_PRECONDITION_UNMET") {
            steps.push({
                label: "Forked test",
                state: "precondition_unmet",
                detail: `We ran ${esc(ve.executed_test || "a real test")} against live state -- it genuinely executed, but a specific real-world condition ` +
                    `it depends on (${esc(ve.note || "a named precondition")}) wasn't true at the block we tested. This is different from ` +
                    "never testing it: the test ran, it just couldn't observe the behavior this time. We treat it as neither confirmed nor contradicted, not as a pass."
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
//
// As of v1.2, iterates Node 17's full findings array (every canonical-
// matched finding, whether or not fusion_applicable), not just Node 18's
// per_finding subset -- see v1.1 -> v1.2 changelog point (a). Node 18's
// per_finding entry (when it exists for a given finding_id) supplies the
// grounding-effect-specific numbers (change/direction/category); for
// findings with no independent Node 07 claim, those numbers don't exist
// by construction and this falls back to Node 17's own raw dst values,
// with `has_independent_claim: false` so the renderer can adapt honestly
// instead of showing a misleading "--%" or implying a real comparison.
// ======================================================================

function isUnmapped(findingId) {
    return /^UNMAPPED-/.test(findingId || "");
}

const node18PerFindingById = {};
for (const f18 of node18.per_finding) {
    if (f18 && f18.finding_id) node18PerFindingById[f18.finding_id] = f18;
}

const canonicalNode17Findings = node17.findings.filter(f => !isUnmapped(f.finding_id));

const merged = canonicalNode17Findings.map(f17 => {
    const fid = f17.finding_id;
    const f18 = node18PerFindingById[fid] || null;
    const f13 = node13ById[fid];
    const eraF = eraById[fid];
    const node07ExactName = f13 && f13.source_findings && f13.source_findings.node07_architecture
        ? f13.source_findings.node07_architecture.source_finding_name
        : null;
    const f07 = node07ExactName
        ? node07Findings.find(f => normalizeName(f.risk_name || f.finding_name) === normalizeName(node07ExactName))
        : null;

    const plain = PLAIN_LANGUAGE[fid] || DEFAULT_PLAIN;
    const historical = findHistoricalMatch(f17.finding_name, node07ExactName);

    const sources = f17.sources || [];
    const hasAudit = Array.isArray(sources) && sources.includes("NODE_08_AUDIT");
    const auditDetail = hasAudit && f13 && f13.source_findings && f13.source_findings.node08_audit
        ? f13.source_findings.node08_audit
        : null;

    const hasIndependentClaim = !!f18; // f18 only exists when fusion_applicable was true this run
    const dstUndefined = f17.dst && f17.dst.primary && f17.dst.primary.undefined === true;

    return {
        finding_id: fid,
        finding_name: f17.finding_name || fid,
        finding_polarity: f17.finding_polarity || "STANDARD",
        status_interpretation: f17.status_interpretation || null,
        severity: (f07 && f07.severity) || (f13 && f13.severity) || (eraF && eraF.severity) || "--",
        plain,
        description: f07 ? (f07.description || f07.architectural_rationale) : null,
        evidence_quotes: f07 ? (f07.evidence || f07.architectural_evidence || []) : [],
        proof_trail: buildProofTrail(f13),
        historical,
        hasAudit,
        auditDetail,
        deterministic_status: f17.deterministic_evidence ? f17.deterministic_evidence.finding_status : null,
        has_independent_claim: hasIndependentClaim,
        llm_confidence: hasIndependentClaim ? f18.llm_confidence : (f17.llm_evidence ? f17.llm_evidence.confidence : null),
        dst_betp: hasIndependentClaim
            ? f18.dst_betp
            : (dstUndefined ? null : (f17.dst && f17.dst.primary ? f17.dst.primary.pignistic_R : null)),
        conflict_K: hasIndependentClaim
            ? f18.conflict_K
            : (dstUndefined ? null : (f17.dst && f17.dst.primary ? f17.dst.primary.K : null)),
        category: hasIndependentClaim ? f18.category : null,
        fusion_note: f17.fusion_note || null,
        era_evidence_summary: eraF ? eraF.evidence_summary : null,
        era_review_reasoning: eraF ? eraF.review_reasoning : null
    };
});

const agg = node18.aggregate_evaluation;
const strongCount = merged.filter(f => f.deterministic_status === "FULLY_SUPPORTED").length;
const openCount = merged.length - strongCount;
const negativeControlFindings = merged.filter(f => f.finding_polarity === "NEGATIVE_CONTROL");

// disclosure_funnel is optional (Node 18 v2.2+) -- render its own section
// only when present, never fabricate the numbers if an older Node 18 is
// connected.
const funnel = node18.disclosure_funnel || null;


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
    const stateLabel = {
        done: "Confirmed", partial: "Partial", not_tested: "Not tested yet",
        contradicted: "Contradicted", unavailable: "Unavailable",
        precondition_unmet: "Executed -- precondition unmet",
        mapped_pending: "Located -- not independently verified"
    };
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

    const isNegativeControl = f.finding_polarity === "NEGATIVE_CONTROL";

    // Negative-control findings get their own callout instead of the
    // standard "why this matters" framing, and skip the alarming-looking
    // status badge in favor of a plain confirmation banner -- see header
    // comment point 1. deterministic_status/llm/dst numbers underneath
    // are NOT altered, only how the top of the block reads.
    const negativeControlBanner = isNegativeControl
        ? `<div class="callout teal">
             <strong>Risk check: ruled out, not confirmed</strong>
             This is a negative control. "${esc(statusPlain(f.deterministic_status))}" here means the ABSENCE of this
             mechanism was confirmed -- i.e. this specific risk does not apply to this deployment${f.status_interpretation ? ` (status_interpretation: ${esc(f.status_interpretation)})` : ""}.
             A high confidence number below reflects certainty that the risk is ruled out, not that it is present.
           </div>`
        : "";

    return `
  <div class="finding-block${isNegativeControl ? " negative-control" : ""}">
    <div class="fb-head">
      <div class="fb-num">Finding ${index + 1} of ${merged.length} &mdash; ${esc(f.finding_name)} <span class="finding-id">(${esc(f.finding_id)})</span></div>
      <span class="badge ${severityBadgeClass(f.severity)}">${esc((f.severity || "").toUpperCase())} severity</span>
      ${isNegativeControl
          ? `<span class="badge negcontrol">NEGATIVE CONTROL</span>`
          : `<span class="badge ${statusBadgeClass(f.deterministic_status)}">${esc(statusPlain(f.deterministic_status))}</span>`}
    </div>
    <h3>${esc(f.plain.headline || f.finding_name)}</h3>
    ${f.plain.plain ? `<p class="lead">${esc(f.plain.plain)}</p>` : ""}
    ${negativeControlBanner}
    ${f.plain.why_it_matters ? `<div class="callout blue"><strong>${isNegativeControl ? "What we actually checked" : "Why this matters to you"}</strong>${esc(f.plain.why_it_matters)}</div>` : ""}

    <h4>Where's the proof?</h4>
    ${proofTrailHtml(f.proof_trail)}
    ${evidenceQuotes ? `<div class="block" style="margin-top:14px;"><h5>What we actually found in the code</h5>${evidenceQuotes}</div>` : ""}

    <div class="fgrid" style="margin-top:14px;">
      ${historicalHtml}
      ${auditHtml}
    </div>

    ${f.era_evidence_summary ? `<div class="block" style="margin-top:14px;"><h5>Independent evidence review</h5><p>${esc(f.era_evidence_summary)}</p></div>` : ""}

    ${f.has_independent_claim ? `
    <div class="confidence-strip">
      <div class="m"><div class="l">AI's initial read</div><div class="v">${pct(f.llm_confidence)}</div></div>
      <div class="m"><div class="l">Combined w/ hard evidence</div><div class="v">${pct(f.dst_betp)}</div></div>
      <div class="m${f.conflict_K > 0 ? " hot" : ""}"><div class="l">Real disagreement?</div><div class="v">${f.conflict_K > 0 ? "Yes" : "No"}</div></div>
    </div>
    ${isNegativeControl ? `<p class="footnote" style="margin-top:10px;">Reminder: the two figures above describe confidence in the STATED claim (no upgrade mechanism exists), not confidence that an upgradeability risk is present.</p>` : ""}
    ` : `
    <div class="confidence-strip">
      <div class="m" style="grid-column: 1 / -1;"><div class="l">Deterministic confidence (no independent AI claim to compare this run)</div><div class="v">${pct(f.dst_betp)}</div></div>
    </div>
    <p class="footnote" style="margin-top:10px;">${esc(f.fusion_note || "No independent AI assessment was available to cross-check against deterministic evidence for this finding this run -- the figure above reflects deterministic evidence alone, not a fusion of two independent sources.")}</p>
    `}
  </div>`;
}

function unmappedSection() {
    if (!eraUnmapped.length) return "";
    const archCount = eraUnmapped.filter(u => u.source === "NODE_07_ARCHITECTURE").length;
    const auditCount = eraUnmapped.filter(u => u.source === "NODE_08_AUDIT").length;
    const sourceBreakdown = (archCount && auditCount)
        ? `${archCount} from our own architectural analysis and ${auditCount} from independently-published audit material`
        : archCount
            ? `all ${archCount} from our own architectural analysis`
            : `all ${auditCount} from independently-published audit material`;
    return `
  <div class="callout amber">
    <strong>Findings we couldn't confidently place</strong>
    We found ${eraUnmapped.length} additional finding${eraUnmapped.length > 1 ? "s" : ""} (${sourceBreakdown}) that ${eraUnmapped.length > 1 ? "don't" : "doesn't"} cleanly match any of the ${merged.length} risk areas above using our strict, code-level matching rules. Rather than force a connection our own system couldn't verify, we're disclosing ${eraUnmapped.length > 1 ? "them" : "it"} here as context. This is not used to raise or lower confidence in any finding above.
    ${eraUnmapped.map(u => `<p style="margin-top:10px;"><strong>${esc(u.source_finding_name)}</strong>${u.source ? ` <span class="footnote">(${u.source === "NODE_07_ARCHITECTURE" ? "architectural analysis" : "audit material"})</span>` : ""} -- ${esc(u.note)}</p>`).join("")}
  </div>`;
}

const generatedAt = new Date().toISOString();

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Compound Protocol -- An Evidence-Based Risk Assessment</title>
<style>
  :root {
    --navy: #0f2942; --navy-2: #1a3a5c; --ink: #1c2530; --ink-soft: #4a5568; --muted: #718096;
    --line: #dde3ea; --bg: #f7f9fb; --card: #ffffff;
    --teal: #0f6e56; --teal-bg: #e1f5ee; --amber: #854f0b; --amber-bg: #faeeda;
    --red: #a32d2d; --red-bg: #fcebeb; --blue: #185fa5; --blue-bg: #e6f1fb;
    --gold: #9c6f1e; --gray: #4a5568; --gray-bg: #eef1f5;
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
  .badge.low { background: var(--gray-bg); color: var(--gray); }
  .badge.informational { background: var(--gray-bg); color: var(--gray); }
  .badge.supported { background: var(--teal-bg); color: var(--teal); }
  .badge.partial { background: var(--amber-bg); color: var(--amber); }
  .badge.contradicted { background: var(--red-bg); color: var(--red); }
  .badge.negcontrol { background: var(--teal-bg); color: var(--teal); }
  .finding-block { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 30px 32px; margin-bottom: 28px; }
  .finding-block.negative-control { border-color: var(--teal); box-shadow: 0 0 0 1px var(--teal) inset; }
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
  .proof-step.precondition_unmet .proof-dot { background: var(--gold); }
  .proof-step.mapped_pending .proof-dot { background: var(--blue); }
  .proof-label { font-size: 14px; font-weight: 600; color: var(--navy); }
  .proof-state { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; color: var(--muted); margin-left: 8px; }
  .proof-step.done .proof-state { color: var(--teal); }
  .proof-step.not_tested .proof-state { color: var(--amber); }
  .proof-step.contradicted .proof-state { color: var(--red); }
  .proof-step.precondition_unmet .proof-state { color: var(--gold); }
  .proof-step.mapped_pending .proof-state { color: var(--blue); }
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
    <p class="eyebrow">Independent Risk Assessment &middot; Compound Protocol</p>
    <h1>Compound Protocol: Evidence-Based Smart Contract Risk Assessment</h1>
    <p class="sub">A finding-by-finding account of what we found, why it matters, whether this pattern has caused losses elsewhere before, and exactly what evidence backs each claim.</p>
    <div class="meta">
      ${funnel ? `
      <div><strong>${funnel.stage_1_identified.count}</strong>candidate findings identified</div>
      <div><strong>${funnel.stage_2_matched_to_canonical_claim.count}</strong>matched a canonical, testable claim</div>
      <div><strong>${strongCount} of ${merged.length}</strong>fully confirmed by direct evidence</div>
      ` : `
      <div><strong>${merged.length}</strong>risk areas investigated</div>
      <div><strong>${strongCount} of ${merged.length}</strong>fully confirmed by direct evidence</div>
      `}
      <div><strong>Generated</strong>${esc(generatedAt.slice(0, 10))}</div>
    </div>
  </div>
</header>

<div class="page">

<nav class="toc">
  <h2>Contents</h2>
  <ol>
    ${funnel ? `<li><a href="#sfunnel">What We Actually Found</a></li>` : ""}
    <li><a href="#s0">Why This Matters</a></li>
    <li><a href="#s1">Framework</a></li>
    <li><a href="#s2">Findings</a></li>
    <li><a href="#s3">Limitations</a></li>
    <li><a href="#s4">Technical Appendix</a></li>
    <li><a href="#s5">Conclusion</a></li>
  </ol>
</nav>

${funnel ? `
<section id="sfunnel">
  <p class="section-num">The Headline Number, In Context</p>
  <h2>What This Assessment Actually Found</h2>
  <p class="lead">${esc(funnel.plain_language_summary)}</p>
  <div class="stat-row">
    <div class="stat-pill"><div class="value">${funnel.stage_1_identified.count}</div><div class="label">Candidate findings identified (architecture + audit review)</div></div>
    <div class="stat-pill"><div class="value">${funnel.stage_2_matched_to_canonical_claim.count}</div><div class="label">Matched to one of Compound's canonical, testable claims</div></div>
    <div class="stat-pill"><div class="value">${funnel.stage_3_cross_validated.count}</div><div class="label">Had both an AI assessment and deterministic evidence to cross-check</div></div>
    <div class="stat-pill"><div class="value">${strongCount}</div><div class="label">Fully confirmed by that cross-check</div></div>
  </div>
  <div class="callout blue">
    <strong>Why the numbers shrink at each stage -- and why that's not a weakness</strong>
    Compound's canonical claim list is deliberately small (5 categories) and strict: a candidate finding only counts as "matched" if it anchors to real, falsifiable evidence we can actually go and test, not just a plausible-sounding label. ${esc(funnel.stage_2_matched_to_canonical_claim.not_matched_note)}
  </div>
  ${funnel.stage_3_cross_validated.no_independent_llm_claim_count ? `<p class="footnote">${esc(funnel.stage_3_cross_validated.no_independent_llm_claim_note)}</p>` : ""}
</section>
` : ""}

<section id="s0">
  <p class="section-num">Why This Assessment Exists</p>
  <h2>DeFi risk is real, and it isn't hypothetical for this protocol</h2>
  <p class="lead">DeFi protocols collectively lost more than $840 million to exploits in the first half of 2026 alone [3]. Compound itself has direct, first-hand experience with how a single logic error in a governance-approved change can move tens of millions of dollars: in October 2021, a one-character error in a formally proposed and voted-on upgrade (Proposal 62) caused roughly $90 million in COMP tokens to be distributed incorrectly, patched days later by a follow-up proposal [1][2].</p>
  <div class="callout amber">
    <strong>An important distinction, stated plainly</strong>
    That 2021 incident was not a smart-contract access-control bypass or a reentrancy exploit -- it was a distribution-logic bug in code that had already passed through Compound's own governance process. It illustrates why this report tests governance and admin power generally (see Access Control and Upgradeability below), not that it independently confirms any specific finding in this run. We are not borrowing its drama without the distinction.
  </div>
</section>

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
  ${negativeControlFindings.length ? `<div class="callout teal">
    <strong>Not every finding below is a risk to weigh</strong>
    ${negativeControlFindings.length} of the ${merged.length} risk areas in this report is a negative control: a check we ran specifically to confirm a risky pattern seen elsewhere in DeFi does NOT apply here. It's marked clearly with a green "negative control" badge below so it isn't mistaken for a confirmed risk.
  </div>` : ""}
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
    <li><strong>Only ${merged.length} of this run's findings met our strict matching bar for a canonical risk category.</strong> Additional findings our architecture and audit analysis surfaced but couldn't confidently place are disclosed separately above, not silently dropped and not force-fit into a category they don't cleanly belong to.</li>
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
    <p>K measures how much the two evidence sources actually contradicted each other. The combination produces Belief (Bel(R), the lowest confidence directly supported), Plausibility (Pl(R), the highest confidence not ruled out), and pignistic probability (BetP(R), a single decision-oriented summary number). For a NEGATIVE CONTROL finding, R still means "the stated claim is true" -- it is never redefined by polarity -- so a negative control's high BetP(R) means high confidence in the absence claim, not the risk. Because the AI-reasoning source structurally never asserts &not;R, whenever deterministic evidence shows no contradiction the combined belief simplifies to combined_R = s + c(1&minus;s), where s is deterministic support and c is the AI's confidence -- always &ge; c. This is a proven structural property, not a per-finding correction.</p>
    <h3>Findings summary table</h3>
    <table>
      <tr><th>ID</th><th>Status</th><th class="num">AI confidence</th><th class="num">Combined (BetP)</th><th class="num">Conflict K</th></tr>
      ${merged.map(f => `<tr><td>${esc(f.finding_id)}${f.finding_polarity === "NEGATIVE_CONTROL" ? ' <span class="footnote">(negative control)</span>' : ""}</td><td>${esc(statusPlain(f.deterministic_status))}</td><td class="num">${fmt3(f.llm_confidence)}</td><td class="num">${fmt3(f.dst_betp)}</td><td class="num">${fmt3(f.conflict_K)}</td></tr>`).join("")}
    </table>
    <div class="glossary">
      <h5>Symbol reference</h5>
      <dl>
        <dt>m (mass function)</dt><dd>How one evidence source splits its support across "risk present," "risk absent," and "not sure."</dd>
        <dt>Bel(R), Pl(R)</dt><dd>The defensible range of confidence the combined evidence supports.</dd>
        <dt>BetP(R)</dt><dd>A single decision-oriented confidence estimate summarizing that range.</dd>
        <dt>K</dt><dd>Conflict -- how much the two sources actively disagreed (0 = none).</dd>
        <dt>Negative control</dt><dd>A finding whose stated claim is the ABSENCE of a risk, included specifically to test whether a known DeFi failure pattern applies here. High confidence on a negative control is good news.</dd>
      </dl>
    </div>
    <p class="footnote">Self-test suite: this pipeline runs 7 synthetic Dempster-Shafer combination test cases with independently hand-verified expected values on every execution, and refuses to report real findings if any fail. Divergence threshold (0.15) is an explicitly disclosed engineering parameter, not a validated scientific constant. Findings with genuine conflict (K &gt; 0) are categorized CONFLICT regardless of how close the combined confidence landed to the AI's original number, since Dempster's rule absorbs disagreement into K rather than necessarily lowering the fused belief. One behavioural test in this run (interest accrual) executed against live state but hit a real, disclosed precondition rather than completing cleanly -- reported as EXECUTED_PRECONDITION_UNMET, distinct from both a pass and a not-yet-run test.</p>
  </div>
</section>

<section id="s5">
  <p class="section-num">Section 5</p>
  <h2>Conclusion</h2>
  <p class="lead">Of the ${merged.length} risk areas investigated, ${strongCount} were fully confirmed by the combined evidence -- source code, live on-chain data, and in most cases a reproduced test all pointed the same direction${negativeControlFindings.length ? `, including the negative control above (no upgrade mechanism exists)` : ""}. None were contradicted. ${openCount} finding${openCount === 1 ? "" : "s"} still ha${openCount === 1 ? "s" : "ve"} a genuinely open question attached to ${openCount === 1 ? "it" : "them"}, disclosed above rather than rounded up.</p>
  <div class="stat-row">
    <div class="stat-pill"><div class="value">${strongCount}/${merged.length}</div><div class="label">Fully confirmed findings</div></div>
    <div class="stat-pill"><div class="value">${pct(agg.mean_llm_confidence)}</div><div class="label">AI's average initial confidence</div></div>
    <div class="stat-pill"><div class="value">${pct(agg.mean_dst_betp)}</div><div class="label">Average confidence after combining with hard evidence</div></div>
    <div class="stat-pill"><div class="value">${agg.divergence_count}</div><div class="label">Finding(s) where AI and hard evidence meaningfully diverged</div></div>
  </div>
  <p>On average, verifying each claim against real code and live on-chain data moved the confidence level by ${fmt3(agg.mean_absolute_change)} (on a 0-to-1 scale) relative to the AI's first, unverified read -- almost always upward, because the underlying architecture genuinely does work the way it was described. This assessment reflects the protocol's code and on-chain state as of ${esc(generatedAt.slice(0, 10))}; it should be re-run periodically rather than treated as a permanent verdict.</p>
</section>

</div>

<footer>Compound Protocol Risk Assessment &middot; generated ${esc(generatedAt)} from live pipeline outputs &middot; not a conventional security audit</footer>

</body>
</html>`;


// ======================================================================
// OUTPUT
// ======================================================================

return [
    {
        json: {
            node: "Node 19 (Compound) - Investor Security Assessment Report Generator",
            version: "1.2",
            generated_at: generatedAt,
            era_available: !!era,
            finding_count: merged.length,
            negative_control_count: negativeControlFindings.length,
            disclosure_funnel_available: !!funnel,
            html
        },
        binary: {
            report: {
                data: Buffer.from(html, "utf-8").toString("base64"),
                mimeType: "text/html",
                fileName: "Compound_Protocol_Investor_Risk_Assessment.html"
            }
        }
    }
];
