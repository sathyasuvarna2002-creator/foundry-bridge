# APPENDIX
**Status: PENDING**

---

## What Goes Here

Per Charles's feedback:
- Summary table (Supported / Contradicted / Partially Resolved / Untested)
- Technical details (optional)
- Full findings tables (if not in main text)

Appendix word count does NOT count toward the 9,000-word limit.

---

## A1. SUMMARY TABLE (Per Charles's Request)

This table should appear early in the appendix. It gives readers a one-page snapshot of all findings across the three protocols.

### Table Structure

| Protocol | Finding ID | Finding Name | LLM Confidence | Deterministic Confidence | Status | Tested? |
|----------|-----------|---|---|---|---|---|
| **AAVE** | F01 | Upgradeable Proxy Control | 0.90 | 0.99 | SUPPORTED | Yes (both directions) |
| | F02 | Registry Centralisation | 0.92 | 0.99 | SUPPORTED | Yes (both directions) |
| | F03 | ACL Manager Role Concentration | 0.89 | 0.99 | SUPPORTED | Yes (both directions) |
| | F04 | Pool Configurator Authority | 0.90 | 0.99 | SUPPORTED | Yes (both directions) |
| | F05 | Umbrella Deficit Authority | 0.90 | 0.95 | CONTRADICTED | Yes (one direction only) |
| | F06 | Asset Price Oracle Dependency | 0.92 | 0.99 | SUPPORTED | Yes (with tracing) |
| | F07 | aToken Custody Dependency | 0.90 | 0.99 | PARTIALLY RESOLVED | Partial (auth only) |
| | F08 | Interest Rate Strategy Externalisation | 0.90 | 0.98 | PARTIALLY RESOLVED | Partial (auth only) |
| | F09 | Flashloan Receiver Composability | 0.75 | 0.97 | SUPPORTED | Yes (both directions) |
| | F10 | Position Manager Delegation | 0.92 | 0.99 | SUPPORTED | Yes (both directions) |
| | F11 | Reserve Registry Dependency | 0.88 | 0.99 | PARTIALLY RESOLVED | Partial (auth only) |
| **VENUS** | — | Upgradeability | 0.90 | 1.00 | SUPPORTED | Yes |
| | — | Access Control | 0.85 | 1.00 | SUPPORTED | Yes |
| | — | Economic Dependency | 0.85 | 1.00 | SUPPORTED | Yes |
| | — | Asset Custody (Donation) | 0.90 | 1.00 | SUPPORTED | Yes (live re-run) |
| | — | Dependency (Supply Cap) | 0.88 | 1.00 | SUPPORTED | Yes |
| | — | Operational Resilience | 0.78 | 0.89 | UNTESTED | No |
| **COMPOUND** | AC-01 | Access Control | 0.96 | 0.99 | SUPPORTED | Yes (3 layers) |
| | ED-01 | Economic Dependency | 0.92 | 0.97 | PARTIALLY RESOLVED | Yes (inconclusive) |
| | UP-01 | Upgradeability (negative control) | — | — | MATCHED_NOT_SCORED | Yes (query only) |

### Legend

- **SUPPORTED:** Evidence from multiple sources agrees; finding is real and the protocol defends against it (or the risk is absent as claimed)
- **CONTRADICTED:** AI and deterministic evidence genuinely disagree; conflict is measured and reported (see F05)
- **PARTIALLY RESOLVED:** Evidence confirms part of the claim but not all (e.g., authorization works but downstream effects untested)
- **UNTESTED:** No test has been written; claim remains open
- **MATCHED_NOT_SCORED:** Negative control or finding without LLM opinion; evidence alone

---

## A2. DETAILED FINDINGS TABLES

If your main Findings section uses abbreviated tables, include full tables here with all metadata.

### Aave Full Findings Table

[Include the complete table from Findings_Summary_v2.docx with all 11 findings, all columns]

### Venus Full Findings Table

[Include the complete table from Findings_Summary_v2.docx with all 6 findings]

### Compound Full Findings Table

[Include the complete table from Findings_Summary_v2.docx with the 3 matched findings + explanation of unmatched]

---

## A3. TECHNICAL DETAILS (Optional)

### Node Architecture Overview

Brief diagram or description of the pipeline:
- Node 07: AI Risk Reasoner
- Node 13: Deterministic Specification
- Node 16: Anchor Token Matching / Evidence Evaluation
- Node 17: DST Fusion
- Node 18: Grounding Effect Evaluation
- Node 19: Report Generation

This is optional but helpful for readers interested in the technical implementation.

### Dempster-Shafer Calculation Example (F05)

Full worked example showing:
- LLM weights: real=0.90, not_real=0.00, unknown=0.10
- Test weights: real=0.50, not_real=0.25, unknown=0.25
- Conflict calculation: 0.225
- Fusion result: 0.94 / 0.03 / 0.03
- Final score: 0.95

### Foundry Test Example

One representative Foundry test (e.g., access control pattern) showing:
- Test structure
- What passed/failed
- How it maps to the finding

---

## A4. PROTOCOLS SPECIFICATION DOCUMENTS

Optional: Reference materials for each protocol
- Aave V3 specification (governance, roles, access control)
- Venus specification (cToken mechanism, reserve distribution)
- Compound V2 specification (interest rate model, liquidation)

These can be links or brief summaries.

---

## CHECKLIST FOR APPENDIX

- [ ] Summary table created (per Charles's request)
- [ ] All 22 findings represented in the summary
- [ ] Full findings tables included
- [ ] Technical details included (if space permits)
- [ ] Formatting consistent with main document
- [ ] No word-count penalty calculations in appendix (word count doesn't count)
- [ ] All references to appendix are cited in main text (e.g., "see Appendix A1")

---

**Appendix is assembled LAST, after all main sections are polished.**
