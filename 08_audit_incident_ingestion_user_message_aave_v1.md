# Node 08 (Aave) — User Message / Input template

Paste into the AI Agent's "User Message" (or "Text") field, not the system
message. This is a different shape from the Venus template
(`08_audit_incident_ingestion_user_message_v1.md`) because the source here
is a single, large, multi-finding markdown audit report -- not one small
GitHub Issue fetched via the GitHub API's JSON response.

**Updated per the real "input exceeds context window" error encountered
running this against the full 86K-character document in one call.** The
document is no longer fed to Node 08 directly from the HTTP Request node --
it now passes through `08a_filter_audit_document.js` first, which keeps the
pipeline shape identical to the Venus pattern (one HTTP fetch, one AI Agent
call, no fan-out, no merge step) by filtering the document down to just the
sections relevant to this pipeline's fixed F01-F11 taxonomy before the model
ever sees it -- 7 of 16 findings kept for this document (the ones
substantively about the Umbrella/deficit-elimination mechanism, which
overlaps with F05), 38% smaller.

Wiring: `08_HTTP_Fetch_Aave_Audit` (HTTP Request, GET, Response Format =
Text) → `08a_Filter_Audit_Document` (Code) → `08_AI_Audit_Agent` (this
node). Node names in the expression below are suggested -- rename to match
whatever you actually called them if different.

**HTTP Request node URL — must be the RAW file, not the GitHub blob page.**
The GitHub URL `https://github.com/aave-dao/aave-v3-origin/blob/main/audits/2024-10-22_StErMi_Aave-v3.3.md`
renders a full HTML/React page when fetched -- it contains zero
`# [ID] Title` headings, so `08a_filter_audit_document.js` will throw
"found zero '# [ID] Title' style finding headings" if you point the HTTP
node at it. Use one of these instead, both return plain markdown text:
```
https://raw.githubusercontent.com/aave-dao/aave-v3-origin/main/audits/2024-10-22_StErMi_Aave-v3.3.md
```
or
```
https://github.com/aave-dao/aave-v3-origin/raw/refs/heads/main/audits/2024-10-22_StErMi_Aave-v3.3.md
```

```
Audit Report / Incident Document to Extract

{{ $json.document_text }}
```

That's it -- `08a_split_audit_findings.js` already builds the full context
(document title, source URL, source firm, the severity-classification
legend, the findings-summary table, and the date-selection / disposition /
severity guidance that used to be written out longhand in this template)
directly into each chunk's `document_text` field, since that guidance only
needs to be computed once per document, not re-typed per chunk. Read
`08a_split_audit_findings.js` if you need to change any of that guidance
text -- it lives there now, not here.

Notes:
- If you rename the splitter or merge node, no changes are needed here --
  this template only references `$json.document_text`, which is scoped to
  whatever fed this AI Agent node directly, not by node name.
- If you later feed a second, different audit document through this same
  Node 08 agent, decide whether it also needs the same split treatment
  (likely yes, if it's comparably long) or whether it's short enough to
  skip 08a/08b and go straight from HTTP fetch to Node 08, single-shot, the
  way the original Venus Code4rena template does.
