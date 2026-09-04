# Node 08 — User Message / Input template

Paste into the AI Agent's "User Message" (or "Text") field, not the system
message. Node names in the expressions below (`08_HTTP_Fetch_Issue220`) must
match whatever you actually named the HTTP Request node fetching the GitHub
API issue -- rename here if yours differs.

```
Audit Report / Incident Document to Extract

Source URL: {{ $node["08_HTTP_Fetch_Issue220"].json.html_url }}
Source Firm: Code4rena
Date Originally Opened (from source, for date_flagged): {{ $node["08_HTTP_Fetch_Issue220"].json.created_at }}
Labels (from source, may include severity/status): {{ $node["08_HTTP_Fetch_Issue220"].json.labels.map(l => l.name).join(", ") }}

Document Text:
{{ $node["08_HTTP_Fetch_Issue220"].json.body }}
```

Notes on each line, for future documents (not just Issue #220):
- `Source URL` — always the canonical `html_url` from the GitHub API response, not the `api.github.com` fetch URL itself.
- `Source Firm` — currently hardcoded to "Code4rena" since this is proven on one known document. Generalize to an expression once you're feeding more than one source/firm through this node.
- `Date Originally Opened` — GitHub's `created_at`, a full ISO 8601 timestamp. The prompt instructs the model to use this directly for `date_flagged` rather than searching the document body for a date (the raw issue body has no date in its text).
- `Labels` — added so the model can find a real severity label (e.g. "2 (Med Risk)") that exists in the source's metadata but not in the body text. The prompt explicitly warns that judging labels ("satisfactory", "selected for report") are not the same as the team's disposition of the finding, so this doesn't cause the model to fabricate a disposition.
- `Document Text` — the raw issue body, unprocessed.
