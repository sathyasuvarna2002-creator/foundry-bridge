/***********************************************************************
 * NODE 08a — SPLIT AUDIT DOCUMENT INTO PER-FINDING CHUNKS
 * VERSION 1.0
 *
 * Fixes a real n8n error: feeding the full StErMi Aave v3.3 audit
 * (~86K characters) plus the Node 08 system prompt and schema into one
 * AI Agent call exceeds that model's context window ("400 Your input
 * exceeds the context window of this model").
 *
 * Fix: split the raw markdown into one small item per finding BEFORE
 * it reaches the Node 08 AI Agent, using this document's own heading
 * convention -- every finding starts at a top-level heading of the
 * exact form `# [ID] Title`, e.g. `# [M-01] Reserve deficit defined
 * as uint128...`. Front-matter sections (Introduction, Disclaimer,
 * About Aave v3.3, About StErMi, Summary & Scope, Severity
 * classification, Findings Summary) never start with `# [`, so this
 * split naturally isolates only the real findings.
 *
 * Each output item also carries the severity-classification legend and
 * the Findings Summary table as shared context, so the model still has
 * that cross-reference available even though it's only seeing one
 * finding's own section text -- this is what the Node 08 (Aave) user
 * message's "Disposition source" / "Severity source" guidance depends
 * on being present.
 *
 * n8n will automatically execute the downstream Node 08 AI Agent once
 * per item this node outputs (this is n8n's default per-item execution
 * behaviour -- no special "loop" node or "Execute Once" setting needed,
 * just make sure "Execute Once" is NOT checked on the AI Agent node).
 * Pair with 08b_merge_audit_findings.js immediately after Node 08 to
 * recombine all per-chunk outputs into a single item before Node 13.
 *
 * INPUT: one item from the HTTP Request node that fetched the raw
 * audit markdown. Tries several likely field names for the response
 * body since this depends on that node's "Response Format" setting.
 ***********************************************************************/

function getRawText(item) {
    const j = item.json || {};
    const candidates = [j.data, j.body, j.text, j.content];
    for (const c of candidates) {
        if (typeof c === "string" && c.length > 0) return c;
    }
    // Some n8n HTTP Request configurations put plain text response directly
    // as the top-level json value when there's no structured wrapper.
    if (typeof j === "string" && j.length > 0) return j;
    return null;
}

const input = $input.first();
const rawText = getRawText(input);

if (!rawText) {
    throw new Error(
        "08a_split_audit_findings: could not find the fetched audit's raw text on the input item. " +
        "Checked json.data / json.body / json.text / json.content. Check the HTTP Request node's " +
        "Response Format setting and adjust getRawText() above to match."
    );
}

// ---- Extract shared context blocks (Severity classification, Findings Summary) ----

function extractSection(text, headingRegex, nextHeadingRegex) {
    const startMatch = headingRegex.exec(text);
    if (!startMatch) return null;
    const startIdx = startMatch.index;
    nextHeadingRegex.lastIndex = startIdx + startMatch[0].length;
    const nextMatch = nextHeadingRegex.exec(text);
    const endIdx = nextMatch ? nextMatch.index : text.length;
    return text.slice(startIdx, endIdx).trim();
}

const ANY_TOP_HEADING = /^# .+$/m;

const severityClassification = extractSection(
    rawText,
    /^# Severity classification$/m,
    /^# .+$/gm
) || "(Severity classification section not found in source -- proceeding without it.)";

const findingsSummary = extractSection(
    rawText,
    /^# Findings Summary$/m,
    /^# .+$/gm
) || "(Findings Summary table not found in source -- proceeding without it.)";

// ---- Split the document into per-finding chunks ----
// A finding heading is `# [` at the start of a line -- this pattern never
// matches front-matter headings (Introduction, Disclaimer, etc.), which
// don't have a bracket immediately after "# ".

const FINDING_HEADING = /^# \[[^\]]+\][^\n]*$/gm;

const headingMatches = [...rawText.matchAll(FINDING_HEADING)];

if (headingMatches.length === 0) {
    throw new Error(
        "08a_split_audit_findings: found zero '# [ID] Title' style finding headings in the fetched " +
        "document. Either the document's heading format differs from what this splitter expects, or " +
        "the fetch returned something other than the expected markdown (check for an HTML error page, " +
        "a login wall, or a truncated response)."
    );
}

const chunks = [];
for (let i = 0; i < headingMatches.length; i++) {
    const start = headingMatches[i].index;
    const end = i + 1 < headingMatches.length ? headingMatches[i + 1].index : rawText.length;
    const findingText = rawText.slice(start, end).trim();
    const headingLine = headingMatches[i][0];
    const idMatch = headingLine.match(/^# \[([^\]]+)\]/);
    chunks.push({
        finding_heading_id: idMatch ? idMatch[1] : `UNKNOWN-${i + 1}`,
        text: findingText
    });
}

// ---- Build one output item per finding chunk ----

const SOURCE_DOCUMENT_TITLE = "Aave v3.3 Report";
const SOURCE_URL = "https://github.com/aave-dao/aave-v3-origin/blob/main/audits/2024-10-22_StErMi_Aave-v3.3.md";
const SOURCE_FIRM = "StErMi (Independent Security Researcher, Lead Security Researcher at Spearbit)";

const items = chunks.map((chunk, idx) => {
    const combinedText = `Document Title: ${SOURCE_DOCUMENT_TITLE}
Document Source URL: ${SOURCE_URL}
Source Firm: ${SOURCE_FIRM}

NOTE: You are being given ONE finding's own section from a larger, multi-finding audit report, not the full report. The severity-classification legend and the full findings summary table (for cross-referencing this finding's stated severity and status) are included below for context. Only extract the ONE finding whose section appears under "THIS FINDING'S SECTION" below -- do not attempt to extract findings from the summary table itself, it is reference context only, not source text to extract from.

${severityClassification}

${findingsSummary}

────────────────────────────────────────
THIS FINDING'S SECTION (chunk ${idx + 1} of ${chunks.length}, heading ID: ${chunk.finding_heading_id})
────────────────────────────────────────
${chunk.text}`;

    return {
        json: {
            chunk_index: idx + 1,
            chunk_count: chunks.length,
            finding_heading_id: chunk.finding_heading_id,
            document_text: combinedText
        }
    };
});

return items;
