/***********************************************************************
 * NODE 08a — FILTER AN OVERSIZED AUDIT DOCUMENT TO RELEVANT SECTIONS
 * VERSION 2.0 (replaces the split/merge fan-out approach from v1 --
 * see note at bottom)
 *
 * Generic, protocol-agnostic utility: fixes "input exceeds context
 * window" errors on large multi-finding audit documents by keeping the
 * pipeline shape identical to the Venus pattern (one HTTP fetch -> one
 * AI Agent call, no fan-out, no merge step) and instead filtering the
 * document DOWN to only the sections relevant to the taxonomy Node 13
 * actually resolves against, before it ever reaches the model.
 *
 * Not Aave-specific: RELEVANCE_KEYWORDS below is the only thing that
 * changes per audit document. The splitting/filtering logic itself
 * works on any document using this "# [ID] Title" heading convention
 * (StErMi/Spearbit-style reports use it; adjust FINDING_HEADING if a
 * different audit source uses a different heading convention).
 *
 * For the StErMi Aave v3.3 report specifically: RELEVANCE_KEYWORDS is
 * set to match the Umbrella / deficit-elimination findings (the ones
 * that overlap with F05, Umbrella-exclusive deficit elimination
 * authority). This keeps PRE-REVIEW M-01, M-01, M-02, L-04, L-05, and
 * DISCUSSION (~6 of 16 findings) and drops the rest (dust-liquidation
 * mechanics, GHO edge cases unrelated to Umbrella, and purely
 * informational/documentation findings) -- those are real findings in
 * the source document, just not ones this pipeline's fixed F01-F11
 * taxonomy has a slot for, so including them would only ever produce
 * more UNMAPPED-AUDIT-N entries, not real union matches.
 *
 * INPUT: one item from the HTTP Request node that fetched the raw
 * audit markdown (unchanged wiring from before -- this node just sits
 * between HTTP fetch and the AI Agent now, nothing after the Agent).
 *
 * v1 note: an earlier version of this fix (08a_split_audit_findings.js
 * + 08b_merge_audit_findings.js) split the document into 16 chunks and
 * ran the Agent once per chunk, fanning out then merging back. That
 * captured every finding but changed the execution shape from Venus's
 * one-call pattern. Superseded by this version per explicit direction:
 * keep HTTP -> single Agent call, trade full document coverage for a
 * targeted, relevant excerpt instead.
 ***********************************************************************/

// ---- Configure per audit document ----

const RELEVANCE_KEYWORDS = [
    "umbrella",
    "eliminatereservedeficit",
    "eliminatedeficit",
    "executeeliminatedeficit",
    "onlyumbrella"
];

// Headings confirmed relevant by direct reading even though their text
// doesn't contain any RELEVANCE_KEYWORDS string (e.g. M-01 discusses the
// `deficit` struct field's uint128 overflow risk without ever naming the
// elimination functions themselves) -- keyword matching alone is
// approximate, this is the manual override for known false negatives.
const ALWAYS_INCLUDE_HEADING_IDS = ["M-01"];

// Headings that DID match a keyword only incidentally (e.g. a single
// unrelated refactoring bullet point mentioning "onlyUmbrella" in passing)
// rather than being substantively about the relevant mechanism -- manual
// override for known false positives.
const ALWAYS_EXCLUDE_HEADING_IDS = ["I-01"];

// ---- Input extraction ----

function getRawText(item) {
    const j = item.json || {};
    const candidates = [j.data, j.body, j.text, j.content];
    for (const c of candidates) {
        if (typeof c === "string" && c.length > 0) return c;
    }
    if (typeof j === "string" && j.length > 0) return j;
    return null;
}

const input = $input.first();
const rawText = getRawText(input);

if (!rawText) {
    throw new Error(
        "08a_filter_audit_document: could not find the fetched audit's raw text on the input item. " +
        "Checked json.data / json.body / json.text / json.content. Check the HTTP Request node's " +
        "Response Format setting and adjust getRawText() above to match."
    );
}

// ---- Extract shared context blocks ----

function extractSection(text, headingRegex, nextHeadingRegex) {
    const startMatch = headingRegex.exec(text);
    if (!startMatch) return null;
    const startIdx = startMatch.index;
    nextHeadingRegex.lastIndex = startIdx + startMatch[0].length;
    const nextMatch = nextHeadingRegex.exec(text);
    const endIdx = nextMatch ? nextMatch.index : text.length;
    return text.slice(startIdx, endIdx).trim();
}

const severityClassification = extractSection(
    rawText, /^# Severity classification$/m, /^# .+$/gm
) || "(Severity classification section not found in source -- proceeding without it.)";

const findingsSummary = extractSection(
    rawText, /^# Findings Summary$/m, /^# .+$/gm
) || "(Findings Summary table not found in source -- proceeding without it.)";

// ---- Split into per-finding sections, then keep only relevant ones ----

const FINDING_HEADING = /^# \[[^\]]+\][^\n]*$/gm;
const headingMatches = [...rawText.matchAll(FINDING_HEADING)];

if (headingMatches.length === 0) {
    throw new Error(
        "08a_filter_audit_document: found zero '# [ID] Title' style finding headings in the fetched " +
        "document. Either the heading format differs from what this filter expects, or the fetch " +
        "returned something other than the expected markdown."
    );
}

const allSections = [];
for (let i = 0; i < headingMatches.length; i++) {
    const start = headingMatches[i].index;
    const end = i + 1 < headingMatches.length ? headingMatches[i + 1].index : rawText.length;
    const sectionText = rawText.slice(start, end).trim();
    const idMatch = headingMatches[i][0].match(/^# \[([^\]]+)\]/);
    allSections.push({
        heading_id: idMatch ? idMatch[1] : `UNKNOWN-${i + 1}`,
        text: sectionText
    });
}

const lowerKeywords = RELEVANCE_KEYWORDS.map(k => k.toLowerCase());
const relevantSections = allSections.filter(s => {
    if (ALWAYS_EXCLUDE_HEADING_IDS.includes(s.heading_id)) return false;
    if (ALWAYS_INCLUDE_HEADING_IDS.includes(s.heading_id)) return true;
    const lower = s.text.toLowerCase();
    return lowerKeywords.some(k => lower.includes(k));
});

if (relevantSections.length === 0) {
    throw new Error(
        `08a_filter_audit_document: none of the ${allSections.length} finding sections matched any of ` +
        `the configured RELEVANCE_KEYWORDS (${RELEVANCE_KEYWORDS.join(", ")}). Either widen the keyword ` +
        `list or confirm this document actually covers the intended topic area.`
    );
}

// ---- Build the single combined document_text sent to the AI Agent ----

const SOURCE_DOCUMENT_TITLE = "Aave v3.3 Report";
const SOURCE_URL = "https://github.com/aave-dao/aave-v3-origin/blob/main/audits/2024-10-22_StErMi_Aave-v3.3.md";
const SOURCE_FIRM = "StErMi (Independent Security Researcher, Lead Security Researcher at Spearbit)";

const documentText = `Document Title: ${SOURCE_DOCUMENT_TITLE}
Document Source URL: ${SOURCE_URL}
Source Firm: ${SOURCE_FIRM}

NOTE: This document originally contained ${allSections.length} findings. To fit within this model's context window, it has been filtered down to only the ${relevantSections.length} finding(s) relevant to this pipeline's fixed risk taxonomy (matched on: ${RELEVANCE_KEYWORDS.join(", ")}). The excluded findings are real findings in the source document -- they were not judged invalid, just outside this run's scope. Do not treat their absence as meaning the source document only contains these findings.

${severityClassification}

${findingsSummary}

────────────────────────────────────────
RELEVANT FINDING SECTIONS (${relevantSections.length} of ${allSections.length}, kept because they matched: ${RELEVANCE_KEYWORDS.join(", ")})
────────────────────────────────────────
${relevantSections.map(s => s.text).join("\n\n")}`;

return [
    {
        json: {
            document_text: documentText,
            filter_summary: {
                total_findings_in_source: allSections.length,
                relevant_findings_kept: relevantSections.length,
                kept_heading_ids: relevantSections.map(s => s.heading_id),
                excluded_heading_ids: allSections.filter(s => !relevantSections.includes(s)).map(s => s.heading_id),
                document_text_length: documentText.length
            }
        }
    }
];
