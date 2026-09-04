# COMPLETE SESSION SUMMARY
**For Context Recovery**

---

## Project Overview

**MSc AI in Business - Independent Research Project (IRP)**
**Student:** Sathya Suvarna  
**Supervisor:** Charles (provided detailed feedback)  
**Topic:** Validating AI-generated smart contract risk assessments using evidence fusion  
**Status:** Findings complete, now in dissertation writing phase  
**Deadline:** 8 September 2026, 4:00 PM  

---

## The Research (Completed)

### Three Protocols Analyzed

1. **Aave V3** (Ethereum mainnet)
   - 11 pre-defined findings (F01-F11)
   - Fixed taxonomy
   - All 11 tested
   - Six tested bidirectionally (access denied + authorized works)
   - Key finding: F05 shows genuine disagreement between AI and tests

2. **Venus Protocol** (BNB Chain)
   - 6 findings in open taxonomy
   - 5 tested, 1 untested (Operational Resilience)
   - 5 of 6 reached deterministic confidence of 1.00
   - Deepest test in entire project: donation-attack mechanism (real tokens, real blockchain fork, re-runs live)

3. **Compound V2** (Ethereum mainnet)
   - 5 canonical claims pre-defined
   - 3 matched this run
   - Stricter scoring than Aave/Venus (source code alone ≠ proof)
   - 2 findings have tests written but weren't raised by LLM this run

### Methodology: Dempster-Shafer Evidence Fusion

**Core Innovation:** Preserve conflict information rather than averaging it away

**Three evidence buckets per finding:**
- REAL (weight assigned to "risk is genuine")
- NOT REAL (weight assigned to "risk is absent")
- DON'T KNOW (weight assigned to uncertainty)

**LLM proposes risks:** Puts weight in REAL + DON'T KNOW buckets (never argues absence)

**Tests validate:** Can put weight in either direction, or UNCERTAIN

**When disagreement occurs:** Conflict is measured and reported, not erased

**Example (F05):**
- LLM: 0.90 (REAL) | 0.00 (NOT REAL) | 0.10 (DON'T KNOW)
- Tests: 0.50 (REAL) | 0.25 (NOT REAL) | 0.25 (DON'T KNOW)
- Conflict = 0.225 (real, measured disagreement)
- Final score = 0.95 (fused assessment) + conflict indicator shown

**Why it matters:** Decision-makers see that F05 is real but constrained, not that it's a certain vulnerability.

### Results Summary

| Protocol | Findings | Status | Key Insight |
|----------|----------|--------|-------------|
| Aave | 11 | 10 Supported + 1 Contradicted | Evidence agreement strong; F05 shows real disagreement |
| Venus | 6 | 5 Supported + 1 Untested | Full evidence on tested findings = 1.00 confidence |
| Compound | 3 matched | All have evidence | Stricter scoring shows different confidence than Aave/Venus |

---

## Charles's Feedback (Key Guidance)

### What He Emphasized

1. **Real strength:** Framework showing how independent evidence can support/challenge/leave unresolved AI judgments
2. **Most valuable:** Contradiction cases (F05) justify why validation is needed
3. **Be explicit:** State clearly whether validating access control, upgradeability, governance, dependency, or observable behavior
4. **Don't overclaim:** Increased scores ≠ better accuracy without ground truth
5. **Be honest:** Open discussion of limitations won't hurt grades
6. **DST framing:** Emphasize decision-support value of preserving conflict, not mathematical details

### Specific Recommendations

- Add summary table to appendix (Supported / Contradicted / Partially Resolved / Untested across all protocols)
- Use F05 as worked example of evidence disagreement
- Discuss untested findings (Aave F07/F08/F11, Venus Operational Resilience, Compound unraised)
- Explain why each protocol has different scoring rules
- Frame DST as "preserving useful conflict for decision-makers"

---

## Files Created for Dissertation

### Core Working Documents

1. **00_DISSERTATION_SCHEDULE.md**
   - 19-day timeline (20 Aug - 8 Sep)
   - Daily breakdown of work
   - Deadline for each section

2. **01_Findings_DRAFT.md** (~3,500 words)
   - Aave: 11 findings, access control & governance
   - Venus: 6 findings, economic dependency & upgradeability
   - Compound: 3 matched findings, scoring differences
   - Cross-protocol observations
   - **Status:** Outlined, ready for drafting

3. **02_Methodology_DRAFT.md** (~1,500 words)
   - Research design & protocol selection
   - Evidence layers (AI reasoning, deterministic validation)
   - DST fusion explanation (decision-support framing)
   - Protocol-specific scoring considerations
   - **Status:** Outlined, ready for drafting

4. **03_LiteratureReview_DRAFT.md** (~1,200 words)
   - Evidence validation in software security
   - AI in smart contract analysis
   - DeFi risk assessment landscape
   - Gap: systematic evidence integration
   - **Status:** Outlined, ready for drafting

5. **04_Discussion_DRAFT.md** (~1,200 words)
   - What findings reveal (evidence patterns)
   - F05 case study (genuine disagreement)
   - Limitations (honest per Charles)
   - Implications for validation
   - **Status:** Outlined, ready for drafting

6. **05_Conclusions_DRAFT.md** (~600 words)
   - Key findings summary
   - Main contribution
   - Recommendations for validators
   - Future work
   - **Status:** Outlined, ready for drafting

7. **ABSTRACT_DRAFT.md** (~200 words)
   - Problem statement
   - Approach
   - Findings
   - Implications
   - **Status:** Template ready, write LAST

8. **APPENDIX_DRAFT.md**
   - Summary table (per Charles)
   - Full findings tables
   - Technical details
   - **Status:** Template ready, assemble last

### Supporting Documents

9. **START_HERE.md**
   - Quick overview for starting writing
   - File checklist
   - Daily task guidance

10. **PROGRESS_TRACKER.md**
    - Daily log template
    - Section progress tracking
    - Word count monitoring

11. **ASSEMBLY_GUIDE.md**
    - How to combine sections into final Word document
    - Formatting checklist
    - Submission verification

---

## Data Sources Available

1. **Findings_Summary_v2.docx** (in FoundryBridge folder)
   - All real findings data
   - Aave 11-row table (F01-F11 with scores, differences, descriptions)
   - Venus 6-row table (with 1.00 deterministic on 5 findings)
   - Compound 3-row table (matched findings with deterministic evidence)

2. **README_for_Steven.md**
   - Technical background on audit repository
   - N8n workflow details
   - Server setup guidance

3. **Node Outputs** (from earlier sessions)
   - Node 17 (DST Fusion) output for all three protocols
   - Node 18 (Grounding Effect) evaluation
   - Node 19 (Investor Report) for Compound

---

## Earlier Work Completed (Previous Sessions)

### Technical Pipeline Built

- **Node 07:** AI Risk Reasoner (identifies risks from contract code)
- **Node 08:** Audit Integration (pulls independent audits via HTTP)
- **Node 13:** Deterministic Specification (maps findings to testable claims)
- **Node 15/16:** Evidence Evaluation (cross-validates source code vs. live contract)
- **Node 17:** DST Evidence Fusion (combines AI + deterministic evidence)
- **Node 18:** Grounding Effect Evaluation (measures confidence changes)
- **Node 19:** Investor Report Generator (produces findings summaries)

### Key Fixes Applied

1. **Node 19 Bug Fix (Compound):**
   - UPGRADEABILITY_01 (negative control) wasn't showing in reports
   - Fixed by reading full Node 17 canonical findings, not just Node 18 subset
   - Added `has_independent_claim` field tracking
   - Created "mapped_pending" proof state for MAPPED_PENDING_INDEPENDENT_VERIFICATION

2. **Proof Trail Contradiction Fixed:**
   - SOURCE_RELATIONSHIP was showing "Confirmed" while badge showed "Partially Supported"
   - Created distinct "mapped_pending" state reflecting Compound's conservative evidence rules
   - No longer visually contradictory

3. **Cross-Protocol Document:**
   - Built findings summary with all three protocols
   - Landscape 9-page Word document
   - Included DST fusion explanation with F05 worked example
   - Shows real numbers from actual pipeline runs

---

## Current Status: Ready to Write

### What's Complete
✅ All three protocols tested and findings documented  
✅ Real findings data extracted and verified  
✅ Charles's feedback received and integrated into templates  
✅ 8 section templates created with detailed outlines  
✅ Dissertation schedule and tracking tools built  
✅ Assembly guide for final document created  

### What's Next
⏳ **Write sections (20 Aug - 4 Sep)**
- Findings: Due 24 Aug (3,500 words)
- Methodology: Due 27 Aug (1,500 words)
- Literature Review: Due 30 Aug (1,200 words)
- Discussion: Due 02 Sep (1,200 words)
- Conclusions: Due 04 Sep (600 words)

⏳ **Assemble and polish (5-8 Sep)**
- Combine all sections
- Add title page, TOC, appendix
- Verify formatting and word count
- Run Turnitin check
- Final proofread

⏳ **Submit (8 Sep at 4:00 PM)**
- Upload to Canvas

---

## Key Learning Outcomes from Process

**Sathya learned:**
- Dempster-Shafer evidence fusion and why it preserves decision-useful information
- Kleene three-valued logic (K3: SUPPORTED/CONTRADICTED/UNRESOLVED)
- Negative control findings (statements of absence, not presence)
- Evidence independence and why LLM code can't be used as deterministic proof
- Protocol-specific scoring rules and their implications
- How to structure findings for DeFi risk assessment
- How to handle conflicts between evidence sources
- The importance of explicit scope (what's being validated)
- Honest reporting of untested/partial findings

---

## Contact & References

**Supervisor:** Charles  
**Key Feedback Email:** Reviewed, all recommendations incorporated into templates

**Important Files:**
- `Findings_Summary_v2.docx` — All findings data
- Charles's feedback — North star for writing direction
- Node outputs from pipeline runs — Raw data source

---

## Instructions for Context Recovery

**If conversation is cut off and you need to resume:**

1. **Read this file first** (you're reading it)
2. **Open START_HERE.md** (quick overview)
3. **Check PROGRESS_TRACKER.md** (see where you left off)
4. **Open relevant section draft** (01-05_DRAFT.md files)
5. **Refer to 00_DISSERTATION_SCHEDULE.md** (stay on timeline)
6. **Use ASSEMBLY_GUIDE.md** when ready to combine sections

**All context is here. You can pick up exactly where you left off.**

---

## Timeline at a Glance

```
Day 1-4 (Aug 20-23):  Write Findings (~3,500 words)
Day 5 (Aug 24):       Findings due + start Methodology
Day 6-8 (Aug 25-27):  Write Methodology + Literature Review (~2,700 words)
Day 9-10 (Aug 28-29): Continue Literature Review
Day 11-12 (Aug 30-31): Write Discussion (~1,200 words)
Day 13-14 (Sep 1-2):  Write Discussion + start Conclusions
Day 15 (Sep 3):       Conclusions due
Day 16-17 (Sep 4-5):  Appendix + Abstract
Day 18-19 (Sep 6-7):  Assembly, formatting, final review
Day 20 (Sep 8):       Final check + submit by 4:00 PM
```

---

## Success Criteria

✅ 9,000 words (max 10,000)  
✅ All sections present and polished  
✅ Charles's recommendations incorporated  
✅ Findings explicit about what's validated  
✅ F05 shown as worked example  
✅ Untested areas honestly discussed  
✅ Appendix includes summary table  
✅ Word count on title page  
✅ Submitted via Canvas by deadline  

---

## You're Ready

All the work. All the data. All the guidance.

**Now write it.**

**Start with `01_Findings_DRAFT.md` → Aave section → ~250 words today.**

---

**Last updated:** 20 August 2026  
**Session:** Complete dissertation kit created  
**Next step:** Begin Findings section
