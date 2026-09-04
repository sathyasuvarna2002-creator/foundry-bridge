/***********************************************************************
 * NODE 19 — NEURO-SYMBOLIC SECURITY ASSESSMENT REPORT GENERATOR
 * VERSION 1.0
 *
 * Generates the HTML report dynamically from real pipeline outputs on
 * every run, rather than a hand-built static document.
 *
 * REQUIRED INPUTS (by node name):
 *   07_AI_Risk_Reasoner        -- architectural narrative (evidence,
 *                                  description, rationale) per finding
 *   18 (grounding effect node) -- authoritative numeric figures per
 *                                  finding: llm_confidence,
 *                                  deterministic_status, dst_belief/
 *                                  plausibility/betp, conflict_K,
 *                                  uncertainty, change, category, plus
 *                                  aggregate_evaluation, grounding_effect,
 *                                  formal_calibration, limitations
 *
 * OPTIONAL INPUT:
 *   15_Evidence_Review_Agent (ERA) -- if it has already run earlier in
 *   this same execution, its evidence_summary / review_reasoning /
 *   fusion_comparison_note are used to enrich the narrative. If it is
 *   not available (not wired, not yet run, or genuinely absent from
 *   this execution), the report falls back to a mechanically-derived
 *   final assessment (Contradicted vs Supported, using the same rule
 *   ERA itself follows) and omits ERA-specific prose -- it does not
 *   fabricate narrative text that wasn't actually produced.
 *
 * "Final assessment" per finding is derived directly from
 * deterministic_status when ERA's own review_assessment isn't
 * available: CONTRADICTED / PARTIALLY_CONTRADICTED /
 * MIXED_SUPPORT_AND_CONTRADICTION => "Contradicted", else "Supported".
 * This mirrors the rule already established in ERA's own prompt, so
 * the two never disagree when both are present.
 *
 * OUTPUT: returns the HTML as both a JSON string field (`html`, for
 * previewing or piping into another node) and as binary data (for a
 * downstream "Write Binary File", email, or HTTP-response node).
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

const node18 =
    getNodeJSON("18_Deterministic_Grounding_Effect_Evaluation") ||
    getNodeJSON("18_Grounding_Effect_Evaluation") ||
    getNodeJSON("Node 18") ||
    $input.first().json;

if (!node18 || !Array.isArray(node18.per_finding) || node18.per_finding.length === 0) {
    throw new Error(
        "Node 19: no valid Node 18 output found. This report is built from Node 18's grounding " +
        "effect evaluation and cannot run without it."
    );
}

// ERA is optional -- try, but never throw if missing.
let era = null;
try {
    era = getNodeJSON("15_Evidence_Review_Agent");
} catch (e) {
    era = null;
}


// ======================================================================
// HELPERS
// ======================================================================

function esc(s) {
    if (s === null || s === undefined) return "";
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function fmt3(x) {
    if (x === null || x === undefined || Number.isNaN(x)) return "--";
    return Number(x).toFixed(3);
}

function fmtSigned3(x) {
    if (x === null || x === undefined || Number.isNaN(x)) return "--";
    const v = Number(x);
    return (v >= 0 ? "+" : "") + v.toFixed(3);
}

function findingId(value) {
    const match = String(value || "").match(/F(\d{2})/i);
    return match ? `F${match[1]}` : "";
}

function severityBadgeClass(sev) {
    const s = String(sev || "").toLowerCase();
    if (s === "critical") return "critical";
    if (s === "high") return "high";
    if (s === "medium") return "medium";
    return "medium";
}

function isContradictedStatus(status) {
    return ["CONTRADICTED", "PARTIALLY_CONTRADICTED", "MIXED_SUPPORT_AND_CONTRADICTION"].includes(
        String(status || "").toUpperCase()
    );
}

function categoryBadgeClass(category) {
    // CONFLICT (K > 0) is visually distinct from the D-based AGREEMENT/INCREASE/DECREASE
    // categories -- it reflects real disagreement between sources, not how close the LLM's
    // confidence landed to BetP, so it must never read the same as "agreement" in the table.
    if (category === "CONFLICT") return "conflict";
    if (category === "AGREEMENT") return "agreement";
    return "increase"; // DETERMINISTIC_GROUNDING_INCREASE / DECREASE
}

// Final-assessment badge is ALWAYS derived mechanically from deterministic_status --
// never taken from ERA's free-text review_assessment field, even when ERA is available.
// ERA's own wording for this field was observed to be inconsistent across findings in the
// same run (e.g. most findings said "Supported" while one PARTIALLY_SUPPORTED finding said
// "Partially Supported" and the rest didn't), because it's LLM-generated prose, not a fixed
// enum. Deriving it mechanically guarantees the badge always agrees with the deterministic
// status shown in the same row.
function finalAssessmentFromStatus(status) {
    const s = String(status || "").toUpperCase();
    if (s === "FULLY_SUPPORTED") return "Supported";
    if (s === "PARTIALLY_SUPPORTED") return "Partially Supported";
    if (s === "UNRESOLVED") return "Unresolved";
    if (["CONTRADICTED", "PARTIALLY_CONTRADICTED", "MIXED_SUPPORT_AND_CONTRADICTION"].includes(s)) return "Contradicted";
    return status || "--";
}

function finalAssessmentBadgeClass(assessment) {
    if (assessment === "Contradicted") return "contradicted";
    if (assessment === "Supported") return "supported";
    if (assessment === "Partially Supported") return "partial";
    return "unresolved"; // Unresolved / unknown
}

function deterministicStatusLabel(status) {
    const map = {
        FULLY_SUPPORTED: "Fully supported",
        PARTIALLY_SUPPORTED: "Partially supported",
        MIXED_SUPPORT_AND_CONTRADICTION: "Mixed support and contradiction",
        PARTIALLY_CONTRADICTED: "Partially contradicted",
        CONTRADICTED: "Contradicted",
        UNRESOLVED: "Unresolved"
    };
    return map[String(status || "").toUpperCase()] || (status || "--");
}


// ======================================================================
// EXTRACT NODE 07 FINDINGS (architectural narrative), defensive about
// field-name variants seen across pipeline versions.
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
const node07ById = {};
for (const f of node07Findings) {
    const fid = findingId(f.canonical_finding_id || f.finding_id || f.id);
    if (fid) node07ById[fid] = f;
}

function node07Field(finding, ...candidateNames) {
    if (!finding) return null;
    for (const name of candidateNames) {
        if (finding[name] !== undefined && finding[name] !== null) return finding[name];
    }
    return null;
}


// ======================================================================
// EXTRACT ERA ASSESSMENTS (optional)
// ======================================================================

function extractEraAssessments(root) {
    const candidates = [
        root && root.review_assessments,
        root && root.output && root.output.review_assessments
    ];
    for (const c of candidates) {
        if (Array.isArray(c) && c.length) return c;
    }
    return [];
}

const eraById = {};
if (era) {
    const eraAssessments = extractEraAssessments(era);
    for (const a of eraAssessments) {
        const fid = findingId(a.canonical_finding_id);
        if (fid) eraById[fid] = a;
    }
}


// ======================================================================
// MERGE PER-FINDING DATA
// ======================================================================

const merged = node18.per_finding.map(f18 => {
    const fid = f18.finding_id;
    const f07 = node07ById[fid];
    const eraF = eraById[fid];

    // Always derived mechanically from deterministic_status -- see finalAssessmentFromStatus
    // for why ERA's own review_assessment text is not used here.
    const finalAssessment = finalAssessmentFromStatus(f18.deterministic_status);

    return {
        finding_id: fid,
        risk_name: f18.risk_name || node07Field(f07, "risk_name") || fid,
        severity: node07Field(f07, "severity") || "--",
        description: node07Field(f07, "description"),
        architectural_evidence: node07Field(f07, "architectural_evidence", "evidence") || [],
        risk_rationale: node07Field(f07, "risk_rationale", "architectural_rationale"),

        final_assessment: finalAssessment,
        final_assessment_source: "derived from deterministic_status",

        llm_confidence: f18.llm_confidence,
        deterministic_status: f18.deterministic_status,
        dst_belief: f18.dst_belief,
        dst_plausibility: f18.dst_plausibility,
        dst_betp: f18.dst_betp,
        conflict_K: f18.conflict_K,
        uncertainty_m_Theta: f18.uncertainty_m_Theta,
        change: f18.change,
        absolute_change: f18.absolute_change,
        direction: f18.direction,
        category: f18.category,
        divergence: f18.divergence,

        era_evidence_summary: eraF ? eraF.evidence_summary : null,
        era_review_reasoning: eraF ? eraF.review_reasoning : null,
        era_fusion_comparison_note: eraF ? eraF.fusion_comparison_note : null,
        historical_present: eraF ? !!(eraF.evidence_sources_present && eraF.evidence_sources_present.historical) : null,
        temporal_present: eraF ? !!(eraF.evidence_sources_present && eraF.evidence_sources_present.temporal) : null,
        audit_present: eraF ? !!(eraF.evidence_sources_present && eraF.evidence_sources_present.audit) : null
    };
});


// ======================================================================
// HTML GENERATION
// ======================================================================

const agg = node18.aggregate_evaluation;
const groundingEffect = node18.grounding_effect;
const formalCal = node18.formal_calibration;
const limitations = node18.limitations;

const conflictedFindings = merged.filter(f => f.conflict_K > 0);
const statusCounts = {};
for (const f of merged) {
    const label = deterministicStatusLabel(f.deterministic_status);
    statusCounts[label] = (statusCounts[label] || 0) + 1;
}

function findingsOverviewRows() {
    return merged.map(f => `
    <tr>
      <td>${esc(f.finding_id)}</td>
      <td>${esc(f.risk_name)}</td>
      <td><span class="badge ${severityBadgeClass(f.severity)}">${esc(f.severity)}</span></td>
      <td>${esc(deterministicStatusLabel(f.deterministic_status))}</td>
      <td class="num">${fmt3(f.llm_confidence)}</td>
      <td class="num">${fmt3(f.dst_betp)}</td>
      <td class="num">${fmtSigned3(f.change)}</td>
      <td class="num"${f.conflict_K > 0 ? ' style="color:var(--red);font-weight:600;"' : ""}>${fmt3(f.conflict_K)}</td>
      <td><span class="badge ${categoryBadgeClass(f.category)}">${esc(f.category.replace(/_/g, " ").toLowerCase())}</span></td>
    </tr>`).join("");
}

function findingCard(f) {
    const evidenceHtml = (f.architectural_evidence || []).slice(0, 3)
        .map(e => `<code class="ev">${esc(e)}</code>`).join("");

    const contradictionNote = f.conflict_K > 0
        ? `<div class="block"><h5>Deterministic evidence -- contradiction present</h5><p>${esc(f.era_evidence_summary) || "Deterministic validation reported a status reflecting real contradiction (conflict K = " + fmt3(f.conflict_K) + "), not merely incomplete evidence."}</p></div>`
        : `<div class="block"><h5>Deterministic evidence</h5><p>${f.era_evidence_summary ? esc(f.era_evidence_summary) : "Status: " + esc(deterministicStatusLabel(f.deterministic_status)) + "."}</p></div>`;

    const interpretation = f.era_fusion_comparison_note
        ? esc(f.era_fusion_comparison_note)
        : (f.conflict_K > 0
            ? `This finding carries real, measurable conflict (K = ${fmt3(f.conflict_K)}) between the LLM's claim and the deterministic runtime observation. DST BetP remains numerically high, but the contradiction is a separate, simultaneously true fact and is not resolved by that high number.`
            : `Deterministic evidence and the LLM's original claim agree (K = 0). DST BetP moved by ${fmtSigned3(f.change)} relative to the LLM's original confidence, consistent with the mass structure of this finding's evidence -- not a claim that the result is more accurate.`);

    return `
  <div class="finding-card">
    <div class="fh">
      <div><div class="id">${esc(f.finding_id)} &middot; ${esc((f.severity || "").toUpperCase())}</div><h4>${esc(f.risk_name)}</h4></div>
      <div class="badges"><span class="badge ${finalAssessmentBadgeClass(f.final_assessment)}">${esc(f.final_assessment)}</span></div>
    </div>
    <div class="fgrid">
      <div class="block"><h5>Architectural evidence</h5>${evidenceHtml || "<p>Not available in this run's Node 07 output.</p>"}</div>
      ${contradictionNote}
    </div>
    <div class="dst-strip">
      <div class="m"><div class="l">LLM conf.</div><div class="v">${fmt3(f.llm_confidence)}</div></div>
      <div class="m"><div class="l">Belief</div><div class="v">${fmt3(f.dst_belief)}</div></div>
      <div class="m"><div class="l">Plausibility</div><div class="v">${fmt3(f.dst_plausibility)}</div></div>
      <div class="m"><div class="l">BetP</div><div class="v">${fmt3(f.dst_betp)}</div></div>
      <div class="m${f.conflict_K > 0 ? " hot" : ""}"><div class="l">Conflict K</div><div class="v">${fmt3(f.conflict_K)}</div></div>
      <div class="m"><div class="l">Uncertainty</div><div class="v">${fmt3(f.uncertainty_m_Theta)}</div></div>
    </div>
    <p><strong style="color:var(--navy);">Neuro-symbolic interpretation:</strong> ${interpretation}</p>
  </div>`;
}

function historicalSection() {
    const withHistory = merged.filter(f => f.historical_present === true);
    const withoutHistory = merged.filter(f => f.historical_present === false);
    const unknown = merged.filter(f => f.historical_present === null);

    let body;
    if (era) {
        body = `<p>${withHistory.length} of ${merged.length} findings had historical precedent identified by ERA: ${withHistory.map(f => esc(f.finding_id)).join(", ") || "none"}. ${withoutHistory.length} findings had no matching precedent: ${withoutHistory.map(f => esc(f.finding_id)).join(", ") || "none"}.</p>`;
        if (withHistory.length) {
            body += "<ul class=\"plain\">" + withHistory.map(f => {
                const flagNote = f.audit_present
                    ? ' <em style="color:var(--amber);">(also flagged audit-evidence-present -- verify this reflects a genuine prior-exploit precedent and not only audit-intelligence, e.g. an unrelated informational audit finding, before citing it as historical precedent)</em>'
                    : "";
                return `<li><strong>${esc(f.finding_id)}</strong> -- ${esc(f.era_evidence_summary) || "historical evidence present, see ERA output"}${flagNote}</li>`;
            }).join("") + "</ul>";
        }
    } else {
        body = `<p>Historical precedent data requires the Evidence Review Agent's output, which was not available when this report was generated. ${unknown.length} findings have unknown historical-precedent status in this report.</p>`;
    }

    return body + `
  <div class="callout teal">
    <strong>Not ground truth</strong>
    Historical precedent establishes that a given architectural pattern has been exploited elsewhere under different conditions. It does not establish that this protocol's implementation is vulnerable, and it is never treated as ground truth anywhere in this pipeline. Historical precedent and audit intelligence are tracked as two separate evidence-source flags in ERA's output (historical vs. audit) -- a finding flagged for one is not automatically evidence of the other. The count above reflects ERA's own historical flag as reported; findings also flagged audit-present are marked so this can be spot-checked against the underlying historical intelligence source before being cited.
  </div>`;
}

function barsScript() {
    const data = merged.map(f => ({ id: f.finding_id, llm: f.llm_confidence, betp: f.dst_betp }));
    return JSON.stringify(data);
}

const generatedAt = new Date().toISOString();

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Neuro-Symbolic Security Assessment Report</title>
<style>
  :root {
    --navy: #0f2942; --navy-2: #1a3a5c; --ink: #1c2530; --ink-soft: #4a5568; --muted: #718096;
    --line: #dde3ea; --bg: #f7f9fb; --card: #ffffff;
    --teal: #0f6e56; --teal-bg: #e1f5ee; --amber: #854f0b; --amber-bg: #faeeda;
    --red: #a32d2d; --red-bg: #fcebeb; --blue: #185fa5; --blue-bg: #e6f1fb;
  }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: var(--ink); background: var(--bg); margin: 0; line-height: 1.65; }
  .page { max-width: 960px; margin: 0 auto; padding: 0 32px 80px; }
  header.cover { background: linear-gradient(180deg, var(--navy) 0%, var(--navy-2) 100%); color: #eaf1f8; padding: 72px 32px 56px; }
  header.cover .inner { max-width: 896px; margin: 0 auto; }
  header.cover .eyebrow { font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: #9fc2e0; margin: 0 0 14px; font-weight: 600; }
  header.cover h1 { font-size: 34px; line-height: 1.25; margin: 0 0 16px; font-weight: 600; }
  header.cover .sub { font-size: 17px; color: #c7d9ea; max-width: 640px; margin: 0 0 28px; }
  header.cover .meta { display: flex; gap: 32px; flex-wrap: wrap; border-top: 1px solid rgba(255,255,255,0.18); padding-top: 20px; font-size: 13px; color: #b7cbe0; }
  header.cover .meta strong { color: #eaf1f8; font-weight: 600; display: block; font-size: 14px; margin-bottom: 2px; }
  nav.toc { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 22px 28px; margin: -32px auto 40px; max-width: 896px; box-shadow: 0 6px 24px rgba(15,41,66,0.08); }
  nav.toc h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin: 0 0 12px; font-weight: 600; }
  nav.toc ol { columns: 2; column-gap: 32px; margin: 0; padding: 0 0 0 18px; font-size: 14px; }
  nav.toc li { margin-bottom: 6px; }
  nav.toc a { color: var(--navy-2); text-decoration: none; }
  section { margin: 56px 0; }
  section > h2 { font-size: 22px; font-weight: 600; color: var(--navy); margin: 0 0 6px; padding-bottom: 12px; border-bottom: 2px solid var(--navy); }
  section > .section-num { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; margin-bottom: 4px; }
  h3 { font-size: 16px; font-weight: 600; color: var(--navy-2); margin: 28px 0 10px; }
  p { color: var(--ink-soft); margin: 0 0 14px; font-size: 15px; }
  code { font-family: "SF Mono", Consolas, Menlo, monospace; font-size: 13px; background: #eef1f5; padding: 1px 6px; border-radius: 4px; color: var(--navy-2); }
  ul.plain, ol.plain { padding-left: 20px; color: var(--ink-soft); font-size: 15px; }
  ul.plain li { margin-bottom: 6px; }
  .callout { background: var(--amber-bg); border-left: 4px solid var(--amber); padding: 16px 20px; border-radius: 0 8px 8px 0; font-size: 14px; color: #5c3a08; margin: 20px 0; }
  .callout.blue { background: var(--blue-bg); border-left-color: var(--blue); color: #0c447c; }
  .callout.teal { background: var(--teal-bg); border-left-color: var(--teal); color: #085041; }
  .callout strong { display: block; margin-bottom: 4px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; }
  .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin: 24px 0; }
  .stat-card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 16px 18px; }
  .stat-card .label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
  .stat-card .sublabel { font-size: 11.5px; color: var(--muted); font-weight: 400; text-transform: none; letter-spacing: 0; margin-top: 4px; }
  .stat-card .value { font-size: 24px; font-weight: 600; color: var(--navy); }
  .term { font-style: italic; color: var(--muted); font-weight: 400; }
  .glossary { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 16px 20px; margin: 18px 0; font-size: 13.5px; }
  .glossary h5 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin: 0 0 10px; font-weight: 600; }
  .glossary dl { margin: 0; }
  .glossary dt { font-weight: 600; color: var(--navy-2); margin-top: 8px; }
  .glossary dt:first-child { margin-top: 0; }
  .glossary dd { margin: 2px 0 0; color: var(--ink-soft); }
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; margin: 20px 0; background: var(--card); border-radius: 10px; overflow: hidden; border: 1px solid var(--line); }
  th { background: var(--navy); color: #eaf1f8; text-align: left; padding: 10px 12px; font-weight: 600; font-size: 12.5px; }
  td { padding: 10px 12px; border-top: 1px solid var(--line); color: var(--ink-soft); }
  tr:nth-child(even) td { background: #fafbfc; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .badge { display: inline-block; padding: 2px 9px; border-radius: 20px; font-size: 11.5px; font-weight: 600; }
  .badge.critical { background: var(--red-bg); color: var(--red); }
  .badge.high { background: var(--amber-bg); color: var(--amber); }
  .badge.medium { background: var(--blue-bg); color: var(--blue); }
  .badge.agreement { background: var(--teal-bg); color: var(--teal); }
  .badge.increase { background: var(--blue-bg); color: var(--blue); }
  .badge.conflict { background: var(--red-bg); color: var(--red); }
  .badge.contradicted { background: var(--red-bg); color: var(--red); }
  .badge.supported { background: var(--teal-bg); color: var(--teal); }
  .badge.partial { background: var(--blue-bg); color: var(--blue); }
  .badge.unresolved { background: var(--amber-bg); color: var(--amber); }
  .pipeline { display: flex; align-items: center; gap: 0; margin: 28px 0; flex-wrap: wrap; }
  .pipeline .stage { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; flex: 1; min-width: 150px; text-align: center; }
  .pipeline .stage .t { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); font-weight: 600; margin-bottom: 4px; }
  .pipeline .stage .n { font-size: 14px; font-weight: 600; color: var(--navy); }
  .pipeline .arrow { color: var(--muted); font-size: 20px; padding: 0 10px; }
  .finding-card { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 22px 26px; margin-bottom: 20px; }
  .finding-card .fh { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 14px; padding-bottom: 14px; border-bottom: 1px solid var(--line); }
  .finding-card .fh .id { font-size: 12px; color: var(--muted); font-weight: 600; letter-spacing: 0.04em; }
  .finding-card .fh h4 { font-size: 17px; margin: 2px 0 0; color: var(--navy); font-weight: 600; }
  .fgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 14px; }
  .fgrid .block h5 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin: 0 0 6px; font-weight: 600; }
  .fgrid .block p { font-size: 13.5px; margin: 0; }
  .fgrid .block code.ev { display: block; background: #eef1f5; padding: 6px 8px; border-radius: 5px; margin-bottom: 5px; font-size: 12px; white-space: pre-wrap; word-break: break-word; }
  .dst-strip { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; background: #f4f7fa; border-radius: 8px; padding: 12px 14px; margin: 14px 0; }
  .dst-strip .m { text-align: center; }
  .dst-strip .m .l { font-size: 10.5px; text-transform: uppercase; color: var(--muted); letter-spacing: 0.04em; }
  .dst-strip .m .v { font-size: 15px; font-weight: 600; color: var(--navy); font-variant-numeric: tabular-nums; }
  .dst-strip .m.hot .v { color: var(--red); }
  .bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; font-size: 12.5px; }
  .bar-row .fid { width: 32px; color: var(--muted); font-weight: 600; flex-shrink: 0; }
  .bar-row .track { flex: 1; position: relative; height: 20px; background: #eef1f5; border-radius: 4px; }
  .bar-row .fill-llm { position: absolute; top: 3px; bottom: 3px; left: 0; background: #85b7eb; border-radius: 3px; }
  .bar-row .marker { position: absolute; top: -1px; bottom: -1px; width: 2px; background: var(--navy); }
  .bar-row .val { width: 100px; text-align: right; color: var(--ink-soft); font-variant-numeric: tabular-nums; flex-shrink: 0; }
  .legend-inline { display: flex; gap: 18px; font-size: 12.5px; color: var(--muted); margin: 6px 0 20px; }
  .legend-inline span { display: inline-flex; align-items: center; gap: 6px; }
  .legend-inline i { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
  footer { text-align: center; color: var(--muted); font-size: 12.5px; padding: 40px 0 0; border-top: 1px solid var(--line); margin-top: 60px; }
</style>
</head>
<body>

<header class="cover">
  <div class="inner">
    <p class="eyebrow">Neuro-Symbolic Assessment</p>
    <h1>Neuro-Symbolic Security Assessment Report</h1>
    <p class="sub">A grounded evaluation of probabilistic LLM risk reasoning using structurally distinct deterministic on-chain evidence and Dempster-Shafer combination. This is not a conventional security audit.</p>
    <div class="meta">
      <div><strong>Findings assessed</strong>${merged.length} canonical architectural risks</div>
      <div><strong>Method</strong>LLM reasoning + deterministic validation + Dempster-Shafer fusion</div>
      <div><strong>Ground truth</strong>${esc(formalCal.status)}</div>
      <div><strong>Generated</strong>${esc(generatedAt)}</div>
    </div>
  </div>
</header>

<div class="page">

<nav class="toc">
  <h2>Contents</h2>
  <ol>
    <li><a href="#s1">Executive summary</a></li>
    <li><a href="#s2">Assessment methodology</a></li>
    <li><a href="#s3">Protocol architecture overview</a></li>
    <li><a href="#s4">Findings overview</a></li>
    <li><a href="#s5">Detailed findings</a></li>
    <li><a href="#s6">Historical exploit context</a></li>
    <li><a href="#s7">Deterministic validation</a></li>
    <li><a href="#s8">Neuro-symbolic evidence fusion</a></li>
    <li><a href="#s9">Final grounding changes</a></li>
    <li><a href="#s10">Limitations</a></li>
    <li><a href="#s11">Conclusion</a></li>
  </ol>
</nav>

<section id="s1">
  <p class="section-num">Section 1</p>
  <h2>Executive summary</h2>
  <p>This report presents the output of a neuro-symbolic evaluation pipeline applied to ${merged.length} canonical architectural risk findings. Each finding was independently assessed by a probabilistic large language model, cross-checked against deterministic on-chain evidence, and mathematically combined using Dempster-Shafer evidence fusion. A final evaluation layer measured how much deterministic grounding changed the original LLM assessment, without treating that change as a claim of improved accuracy.</p>
  <div class="stat-grid">
    <div class="stat-card"><div class="label">Findings evaluated</div><div class="value">${agg.finding_count}</div></div>
    <div class="stat-card"><div class="label">Mean LLM confidence</div><div class="value">${fmt3(agg.mean_llm_confidence)}</div><div class="sublabel">the AI's original, un-grounded confidence</div></div>
    <div class="stat-card"><div class="label">Mean combined confidence <span class="term">(DST BetP)</span></div><div class="value">${fmt3(agg.mean_dst_betp)}</div><div class="sublabel">confidence after mathematically combining the AI's assessment with deterministic evidence</div></div>
    <div class="stat-card"><div class="label">Mean absolute change</div><div class="value">${fmt3(agg.mean_absolute_change)}</div><div class="sublabel">average size of the move from the first number to the second</div></div>
  </div>
  <p>Across all findings, deterministic grounding changed the assessed confidence by an average of ${fmt3(agg.mean_absolute_change)} (${agg.increased_count} increased, ${agg.decreased_count} decreased, ${agg.unchanged_count} unchanged). ${conflictedFindings.length} finding(s) carry genuine disagreement between the two evidence sources <span class="term">(conflict, K &gt; 0)</span>: ${conflictedFindings.map(f => esc(f.finding_id)).join(", ") || "none"}. That disagreement is reported explicitly in this document rather than absorbed silently into a single number.</p>
  <div class="callout">
    <strong>What this report is not</strong>
    This is not a claim that the protocol has been formally audited, that any finding is confirmed exploitable, or that the DST belief/BetP values represent calibrated probabilities of real-world risk. ${esc(formalCal.reason)}
  </div>
</section>

<section id="s2">
  <p class="section-num">Section 2</p>
  <h2>Assessment methodology</h2>
  <p>The assessment pipeline combines two structurally different reasoning modes -- probabilistic and symbolic -- into a single, mathematically principled evaluation, following a Dempster-Shafer evidence-fusion architecture.</p>
  <div class="pipeline">
    <div class="stage"><div class="t">Stage 1</div><div class="n">LLM risk reasoning</div></div>
    <div class="arrow">&rarr;</div>
    <div class="stage"><div class="t">Stage 2</div><div class="n">Deterministic validation</div></div>
    <div class="arrow">&rarr;</div>
    <div class="stage"><div class="t">Stage 3</div><div class="n">DST evidence fusion</div></div>
    <div class="arrow">&rarr;</div>
    <div class="stage"><div class="t">Stage 4</div><div class="n">Grounding effect evaluation</div></div>
  </div>
  <h3>Stage 1 -- probabilistic LLM baseline</h3>
  <p>A large language model reasons over a structured architectural model of the protocol and identifies architectural security risks against a fixed, closed taxonomy of canonical findings. Each finding is assigned a confidence score reflecting the model's certainty in its own specific causal claim -- not merely whether supporting evidence exists.</p>
  <h3>Stage 2 -- deterministic evidence anchor</h3>
  <p>Each finding is independently checked against on-chain evidence via Foundry runtime validation. This stage is frozen and read-only, and its output is never treated as ground truth -- it is one body of evidence, not an oracle of correctness.</p>
  <h3>Stage 3 -- Dempster-Shafer evidence fusion</h3>
  <p>The LLM's assessment and the deterministic evidence are mathematically combined into one result using a formal method for combining uncertain evidence from two sources <span class="term">(Dempster-Shafer combination, over a frame of discernment &Theta; = {R, &not;R}, meaning every possible outcome is either "risk present" or "risk absent")</span>. This combination produces four numbers per finding: the lowest confidence level directly supported by the combined evidence <span class="term">(Belief, Bel(R))</span>, the highest confidence level the evidence does not rule out <span class="term">(Plausibility, Pl(R))</span>, how much the two sources actually disagreed with each other <span class="term">(Conflict, K)</span>, and a single decision-oriented confidence estimate that summarizes the other three <span class="term">(pignistic probability, BetP(R))</span>.</p>
  <h3>Stage 4 -- grounding effect evaluation</h3>
  <p>The final stage measures how far the AI's original number moved after fusion <span class="term">(change = BetP(R) minus LLM confidence)</span>, and reports the size of that move, how much the two sources disagreed, and how much residual "don't know" remains <span class="term">(divergence, conflict, and uncertainty, respectively)</span> as raw, uninterpreted quantities. It does not compute a calibration score.</p>
  <div class="callout blue">
    <strong>Independence note</strong>
    The Evidence Review Agent (ERA) is not used as a fusion input, since it has already seen the deterministic evidence -- combining it with that same evidence would double-count the signal. Only the untouched LLM baseline and deterministic evidence are fused.
  </div>
</section>

<section id="s3">
  <p class="section-num">Section 3</p>
  <h2>Protocol architecture overview</h2>
  <p>The assessed protocol follows a registry-centric architecture: a single addresses provider resolves the Pool implementation, ACL Manager, Pool Configurator, Umbrella authority, and Price Oracle. The Pool is deployed behind an upgradeable proxy, delegates custody and accounting to external token contracts, externalizes interest-rate computation, and supports flashloans invoking arbitrary external receivers. Users may delegate account-level permissions to third-party Position Manager addresses. This concentrates several distinct forms of privileged authority behind a small number of resolvable addresses -- the structural pattern the findings below characterize.</p>
</section>

<section id="s4">
  <p class="section-num">Section 4</p>
  <h2>Findings overview</h2>
  <p>Table columns: <strong>LLM</strong> is the AI's original confidence; <strong>BetP</strong> <span class="term">(pignistic probability)</span> is the confidence estimate after mathematically combining the AI's assessment with deterministic evidence; <strong>Change</strong> is how far BetP moved from LLM; <strong>K</strong> <span class="term">(conflict)</span> is how much the two evidence sources actively disagreed, where 0 means no disagreement. The Category column reports CONFLICT for any finding with K &gt; 0 (real disagreement between the LLM and deterministic evidence), regardless of how close BetP landed to the original confidence. Findings with K = 0 are categorized by whether BetP diverged from confidence beyond Node 17's threshold (AGREEMENT vs. deterministic grounding increase/decrease).</p>
  <table>
    <tr><th>ID</th><th>Risk name</th><th>Severity</th><th>Det. status</th><th class="num">LLM</th><th class="num">BetP</th><th class="num">Change</th><th class="num">K</th><th>Category</th></tr>
    ${findingsOverviewRows()}
  </table>
  <h3>LLM confidence vs. DST BetP, per finding</h3>
  <div class="legend-inline">
    <span><i style="background:#85b7eb;"></i>LLM confidence</span>
    <span><i style="background:var(--navy);width:2px;border-radius:0;"></i>DST BetP(R)</span>
  </div>
  <div id="bars"></div>
</section>

<section id="s5">
  <p class="section-num">Section 5</p>
  <h2>Detailed findings</h2>
  <p>Each finding below shows the LLM's original architectural claim and evidence, the deterministic validation status, the Dempster-Shafer fusion result, and a plain-language neuro-symbolic interpretation.</p>
  <div class="glossary">
    <h5>What the six numbers in each finding's strip mean</h5>
    <dl>
      <dt>LLM conf. -- the AI's original confidence</dt><dd>Before any deterministic evidence was factored in.</dd>
      <dt>Belief -- <span class="term">Bel(R)</span></dt><dd>The lowest confidence level directly supported by the combined evidence.</dd>
      <dt>Plausibility -- <span class="term">Pl(R)</span></dt><dd>The highest confidence level the combined evidence does not rule out.</dd>
      <dt>BetP -- combined confidence estimate</dt><dd>A single decision-oriented number summarizing Belief and Plausibility together.</dd>
      <dt>Conflict K -- disagreement</dt><dd>How much the AI's assessment and the deterministic evidence actively disagreed (0 = none).</dd>
      <dt>Uncertainty -- leftover "not sure"</dt><dd>How much support is left unassigned after combining both sources.</dd>
    </dl>
  </div>
  ${merged.map(findingCard).join("")}
</section>

<section id="s6">
  <p class="section-num">Section 6</p>
  <h2>Historical exploit context</h2>
  ${historicalSection()}
</section>

<section id="s7">
  <p class="section-num">Section 7</p>
  <h2>Deterministic validation</h2>
  <p>Deterministic validation checks each finding's underlying claims against on-chain evidence using a logic system with three possible answers instead of the usual two <span class="term">(three-valued/Kleene K3 logic)</span>: unlike ordinary true/false checks, a claim can also come back "we don't have enough evidence to say either way," rather than being forced into a yes/no answer it doesn't deserve. Each claim is marked SUPPORTED, CONTRADICTED, or UNRESOLVED. This node is frozen and read-only, and its output is explicitly never treated as ground truth.</p>
  <table>
    <tr><th>Status</th><th class="num">Count</th></tr>
    ${Object.entries(statusCounts).map(([label, count]) => `<tr><td>${esc(label)}</td><td class="num">${count}</td></tr>`).join("")}
  </table>
  ${conflictedFindings.length ? `<p>${conflictedFindings.map(f => esc(f.finding_id)).join(" and ")} ${conflictedFindings.length === 1 ? "is" : "are"} the only finding(s) with a deterministic status reflecting genuine contradiction.</p>` : "<p>No findings in this run carry a deterministic status reflecting contradiction.</p>"}
</section>

<section id="s8">
  <p class="section-num">Section 8</p>
  <h2>Neuro-symbolic evidence fusion</h2>
  <p>Each evidence source first splits its support across three possible outcomes -- "risk present," "risk absent," and "not sure" -- rather than giving one flat confidence number <span class="term">(this three-way split is called a mass function, m)</span>. Dempster-Shafer combination fuses two structurally distinct evidence sources -- probabilistic LLM reasoning and deterministic on-chain validation -- into a single combined mass function, using the classical normalized rule. (Statistical independence between the two sources has not been experimentally established and is not claimed here; "structurally distinct" means the two evidence sources are produced by different, non-overlapping processes -- LLM architectural reasoning versus deterministic runtime validation -- not that they are provably uncorrelated.)</p>
  <p style="text-align:center; font-family: 'SF Mono', Consolas, monospace; font-size: 14px; color: var(--navy-2); background:#eef1f5; padding:14px; border-radius:8px;">
    K = m<sub>1</sub>(R)&middot;m<sub>2</sub>(&not;R) + m<sub>1</sub>(&not;R)&middot;m<sub>2</sub>(R)<br>
    m<sub>12</sub>(A) = &Sigma;<sub>B&cap;C=A</sub> m<sub>1</sub>(B)&middot;m<sub>2</sub>(C) &divide; (1 &minus; K)
  </p>
  <p>In plain terms: the first line (<span class="term">conflict, K</span>) adds up every case where one source says "risk present" while the other says "risk absent" -- it is a direct measure of how much the two sources actively contradicted each other. The second line combines the two sources' mass functions by keeping only the outcomes both sources agree are possible, then rescales the result so it still adds up to 100% after the contradictory cases (K) have been set aside.</p>
  <p>Because the LLM source structurally never asserts &not;R ("risk absent"), whenever deterministic evidence shows no contradiction, the combined belief simplifies to combined_R = s + c(1&minus;s), where s is the deterministic support fraction and c is the LLM's confidence -- always greater than or equal to c. This is a proven structural property of the fusion, not a per-finding correction.</p>
  <p>The primary comparison metric is the size of the gap between the AI's original number and the combined result <span class="term">(divergence, D = |confidence &minus; BetP(R)|)</span>: a bigger D means the two disagreed more. Where the combined confidence sits relative to the raw Belief/Plausibility range is reported descriptively only, never as a pass/fail overconfidence test.</p>
  <div class="glossary">
    <h5>Quick reference: what each symbol means</h5>
    <dl>
      <dt>m (mass function)</dt><dd>How one evidence source splits its support across "risk present," "risk absent," and "not sure."</dd>
      <dt>Bel(R) -- Belief</dt><dd>The lowest confidence level directly supported by the combined evidence.</dd>
      <dt>Pl(R) -- Plausibility</dt><dd>The highest confidence level the combined evidence does not rule out.</dd>
      <dt>BetP(R) -- pignistic probability / "DST BetP"</dt><dd>A single decision-oriented confidence estimate, roughly the midpoint of Belief and Plausibility, weighted by how the "not sure" mass is split.</dd>
      <dt>K -- Conflict</dt><dd>How much the two evidence sources actively disagreed (0 = no disagreement).</dd>
      <dt>m_&Theta; -- Uncertainty</dt><dd>How much support is left in "not sure" after combining both sources.</dd>
      <dt>D -- Divergence</dt><dd>The size of the gap between the AI's original confidence and the combined result (BetP).</dd>
    </dl>
  </div>
</section>

<section id="s9">
  <p class="section-num">Section 9</p>
  <h2>Final grounding changes</h2>
  <p>This section reports the <strong>deterministic grounding effect</strong> -- how much, and in what direction, deterministic evidence moved the LLM's stated confidence. It is deliberately not called a calibration score.</p>
  <div class="stat-grid">
    <div class="stat-card"><div class="label">Mean absolute change</div><div class="value">${fmt3(agg.mean_absolute_change)}</div></div>
    <div class="stat-card"><div class="label">Findings increased</div><div class="value">${agg.increased_count} / ${agg.finding_count}</div></div>
    <div class="stat-card"><div class="label">Findings decreased</div><div class="value">${agg.decreased_count} / ${agg.finding_count}</div></div>
    <div class="stat-card"><div class="label">Mean disagreement <span class="term">(conflict, K)</span></div><div class="value">${fmt3(agg.mean_conflict_K)}</div><div class="sublabel">how much the two evidence sources disagreed, on average</div></div>
  </div>
  <table>
    <tr><th>Metric</th><th class="num">Value</th></tr>
    <tr><td>Mean LLM confidence <span class="term">(AI's original number)</span></td><td class="num">${fmt3(agg.mean_llm_confidence)}</td></tr>
    <tr><td>Mean combined confidence <span class="term">(DST BetP)</span></td><td class="num">${fmt3(agg.mean_dst_betp)}</td></tr>
    <tr><td>Mean signed change</td><td class="num">${fmtSigned3(agg.mean_signed_change)}</td></tr>
    <tr><td>Findings exceeding divergence threshold <span class="term">(gap &gt; 0.15)</span></td><td class="num">${agg.divergence_count}</td></tr>
    <tr><td>Mean leftover "not sure" <span class="term">(uncertainty, m_&Theta;)</span></td><td class="num">${fmt3(agg.mean_uncertainty)}</td></tr>
    <tr><td>Largest single change</td><td class="num">${agg.max_increase_finding && agg.max_increase_finding.finding_id ? esc(agg.max_increase_finding.finding_id) + " (" + fmtSigned3(agg.max_increase_finding.change) + ")" : "n/a"}</td></tr>
    <tr><td>Findings with real disagreement <span class="term">(non-zero conflict, K &gt; 0)</span></td><td class="num">${conflictedFindings.map(f => esc(f.finding_id) + " (K=" + fmt3(f.conflict_K) + ")").join(", ") || "none"}</td></tr>
  </table>
  <div class="callout">
    <strong>Explicitly not a calibration claim</strong>
    ${esc(groundingEffect.not_a_calibration_score_disclaimer)}
  </div>
</section>

<section id="s10">
  <p class="section-num">Section 10</p>
  <h2>Limitations</h2>
  <ul class="plain">
    <li><strong>No independent ground truth.</strong> ${esc(formalCal.reason)}</li>
    <li><strong>Formal empirical calibration is unavailable.</strong> Status: ${esc(formalCal.status)}.</li>
    <li>${esc(limitations.reproducibility)}</li>
    <li><strong>Dempster combination has known limitations.</strong> Real contradiction is absorbed into the conflict statistic (K) rather than proportionally lowering DST BetP -- a documented property of the classical combination rule, and the reason findings with K &gt; 0 are labeled CONFLICT here regardless of how close their BetP landed to the original LLM confidence.</li>
    <li>${esc(limitations.scope)}</li>
    <li>${esc(limitations.statement)}</li>
  </ul>
</section>

<section id="s11">
  <p class="section-num">Section 11</p>
  <h2>Conclusion</h2>
  <p>The central result of this assessment is not any individual finding's severity or confidence score -- it is the demonstration that a probabilistic LLM risk assessment can be mathematically grounded against structurally distinct deterministic evidence, with the resulting agreement, disagreement, and residual uncertainty reported transparently. Across ${agg.finding_count} findings, grounding changed the assessed confidence by an average of ${fmt3(agg.mean_absolute_change)}. ${conflictedFindings.length} finding(s) demonstrate that real evidentiary conflict can and does surface through this process, and ${conflictedFindings.length === 1 ? "is" : "are"} preserved rather than smoothed over even when the headline fused value remains high.</p>
  <p>This pipeline does not, and does not claim to, establish that the assessed protocol is secure or insecure. It establishes a mathematically auditable evaluation method for combining what an LLM believes with what deterministic evidence shows -- and for saying, precisely, where those two things agree, where they conflict, and where the honest answer is that neither can currently be checked against ground truth.</p>
</section>

</div>

<footer>Neuro-Symbolic Security Assessment Report &middot; generated ${esc(generatedAt)} from live pipeline outputs &middot; not a conventional security audit</footer>

<script>
(function() {
  var findings = ${barsScript()};
  var container = document.getElementById("bars");
  var html = "";
  findings.forEach(function(f) {
    var llm = typeof f.llm === "number" ? f.llm : 0;
    var betp = typeof f.betp === "number" ? f.betp : 0;
    html += '<div class="bar-row">' +
      '<div class="fid">' + f.id + '</div>' +
      '<div class="track">' +
        '<div class="fill-llm" style="width:' + (llm*100).toFixed(1) + '%;"></div>' +
        '<div class="marker" style="left:' + (betp*100).toFixed(1) + '%;"></div>' +
      '</div>' +
      '<div class="val">' + llm.toFixed(3) + ' &rarr; ' + betp.toFixed(3) + '</div>' +
    '</div>';
  });
  container.innerHTML = html;
})();
</script>

</body>
</html>`;


// ======================================================================
// OUTPUT
// ======================================================================

return [
    {
        json: {
            node: "Node 19 - Neuro-Symbolic Security Assessment Report Generator",
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
                fileName: "Neuro_Symbolic_Security_Assessment_Report.html"
            }
        }
    }
];
