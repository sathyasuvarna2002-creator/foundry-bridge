/***********************************************************************
 * NODE 08b — MERGE PER-CHUNK NODE 08 OUTPUTS BACK INTO ONE ITEM
 * VERSION 1.0
 *
 * Pairs with 08a_split_audit_findings.js. Since Node 08's AI Agent now
 * runs once per finding-chunk (n8n's default per-item execution when
 * fed multiple items), it produces N separate output items instead of
 * one. This node collects all of them back into a single item with one
 * combined `architectural_risks` array, so every downstream node (Node
 * 13's `safeNodeJson('08_...')`-style single-item read) keeps working
 * completely unchanged -- point Node 13's Node 08 lookup at THIS node's
 * name instead of the AI Agent node's own name directly.
 *
 * Also fixes a real correctness issue that splitting introduces: each
 * chunk's AI Agent call resets its own finding_id numbering to 01
 * within its own call (per the system prompt: "NN is a two-digit
 * sequence number ... unique within that category for THIS output").
 * Because each chunk is now its own isolated "output," two different
 * chunks can independently produce e.g. "ASSET-CUSTODY-01" and collide
 * once merged. This node detects and renumbers any such collisions
 * after merging so every finding_id is unique in the final combined
 * array. claim_id (the actual stable matching key Node 13 will use) is
 * never touched -- only the cosmetic finding_id suffix is renumbered.
 *
 * INPUT: all items produced by the Node 08 AI Agent (one per chunk),
 * each expected to carry its Structured Output Parser result under
 * either `json.output.architectural_risks` or `json.architectural_risks`
 * (checked defensively, matching the pattern used elsewhere in this
 * pipeline for reading agent output shapes).
 ***********************************************************************/

function extractFindings(item) {
    const j = item.json || {};
    const candidates = [
        j.output && j.output.architectural_risks,
        j.architectural_risks
    ];
    for (const c of candidates) {
        if (Array.isArray(c)) return c;
    }
    return null;
}

const allItems = $input.all();

if (!allItems || allItems.length === 0) {
    throw new Error("08b_merge_audit_findings: received zero input items from Node 08. Nothing to merge.");
}

let allFindings = [];
let chunksWithNoFindings = 0;
let chunksWithParseFailure = 0;

for (const item of allItems) {
    const findings = extractFindings(item);
    if (findings === null) {
        chunksWithParseFailure++;
        continue;
    }
    if (findings.length === 0) {
        chunksWithNoFindings++;
        continue;
    }
    allFindings = allFindings.concat(findings);
}

if (chunksWithParseFailure > 0) {
    throw new Error(
        `08b_merge_audit_findings: ${chunksWithParseFailure} of ${allItems.length} chunk(s) did not have a ` +
        `recognizable architectural_risks array (checked json.output.architectural_risks and json.architectural_risks). ` +
        `This likely means Node 08's Structured Output Parser failed on those chunks -- check them individually ` +
        `before trusting this merged result.`
    );
}

// ---- Renumber any finding_id collisions introduced by per-chunk isolation ----
// (claim_id is untouched -- this only fixes the cosmetic {CATEGORY-SLUG}-{NN} routing id.)

const seenIds = new Set();
const usedNumbersByCategory = {};

for (const f of allFindings) {
    const originalId = f.finding_id;
    const match = typeof originalId === "string" ? originalId.match(/^(.+)-(\d{2})$/) : null;
    if (!match) continue; // leave malformed ids alone; that's a separate data-quality issue to surface, not silently fix here

    const categorySlug = match[1];
    if (!usedNumbersByCategory[categorySlug]) usedNumbersByCategory[categorySlug] = new Set();

    if (!seenIds.has(originalId)) {
        seenIds.add(originalId);
        usedNumbersByCategory[categorySlug].add(parseInt(match[2], 10));
        continue;
    }

    // Collision: find the next free number in this category and renumber.
    let n = 1;
    while (usedNumbersByCategory[categorySlug].has(n)) n++;
    const newId = `${categorySlug}-${String(n).padStart(2, "0")}`;
    usedNumbersByCategory[categorySlug].add(n);
    seenIds.add(newId);
    f._original_finding_id_before_renumbering = originalId;
    f.finding_id = newId;
}

return [
    {
        json: {
            architectural_risks: allFindings,
            merge_summary: {
                chunks_processed: allItems.length,
                chunks_with_findings: allItems.length - chunksWithNoFindings,
                chunks_with_zero_findings: chunksWithNoFindings,
                total_findings_merged: allFindings.length,
                findings_renumbered_due_to_id_collision: allFindings.filter(f => f._original_finding_id_before_renumbering).length
            }
        }
    }
];
