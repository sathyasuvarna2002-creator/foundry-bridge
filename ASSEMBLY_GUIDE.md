# DISSERTATION ASSEMBLY GUIDE
**Final Document Construction**

---

## What You'll Have When Done

Seven section drafts (`.md` files) + supporting materials → **One final Word document (DISSERTATION_FINAL.docx)**

---

## File Organization

```
C:\Users\Sathya\Desktop\FoundryBridge\
├── 00_DISSERTATION_SCHEDULE.md          [Timeline & tracking]
├── PROGRESS_TRACKER.md                  [Daily progress]
├── ASSEMBLY_GUIDE.md                    [This file]
│
├── 01_Findings_DRAFT.md                 [Section 1]
├── 02_Methodology_DRAFT.md              [Section 2]
├── 03_LiteratureReview_DRAFT.md         [Section 3]
├── 04_Discussion_DRAFT.md               [Section 4]
├── 05_Conclusions_DRAFT.md              [Section 5]
├── ABSTRACT_DRAFT.md                    [Section 7 - write last]
├── APPENDIX_DRAFT.md                    [Section 8]
│
├── Findings_Summary_v2.docx             [Data source for tables]
├── README_for_Steven.md                 [Technical reference]
│
└── DISSERTATION_FINAL.docx              [Final output - created at end]
```

---

## Order of Assembly

**Step 1: Title Page**

```
MSc AI in Business
Independent Research Project

TITLE: [Your dissertation title]

AUTHOR: Sathya Suvarna

DATE: [Submission date]

WORD COUNT: [X,XXX words]
```

**Step 2: Declaration of Originality**

```
I declare that this submission is my own work. 
All sources have been acknowledged.
```

**Step 3: Abstract** (~200 words)

Copy from ABSTRACT_DRAFT.md (written last but placed early)

**Step 4: Table of Contents**

Auto-generated from headings in Word. Ensure all sections have proper heading styles:
- Heading 1: Main sections (Findings, Methodology, etc.)
- Heading 2: Subsections (What This Section Validates, Evidence Layers, etc.)

**Step 5: Main Sections**

In this order:

1. **Findings** (~3,500 words) — from 01_Findings_DRAFT.md
2. **Methodology** (~1,500 words) — from 02_Methodology_DRAFT.md
3. **Literature Review** (~1,200 words) — from 03_LiteratureReview_DRAFT.md
4. **Discussion** (~1,200 words) — from 04_Discussion_DRAFT.md
5. **Conclusions & Recommendations** (~600 words) — from 05_Conclusions_DRAFT.md

**Step 6: References**

Compile all citations from all sections. Format per university guidelines (likely Harvard or APA).

**Step 7: Appendix**

From APPENDIX_DRAFT.md:
- A1: Summary Table (per Charles's request)
- A2: Full Findings Tables
- A3: Technical Details (optional)
- A4: Specification Documents (optional)

**Step 8: Final Pages**

- Checklist (Appendix 3 from handbook)
- Ethics approval form (Appendix 2 from handbook)

---

## Word Count Verification

**What counts:**
- Title page
- Table of contents
- All text in sections 1-5
- Tables, figures, footnotes, citations

**What doesn't count:**
- Abstract (separate page)
- Appendices
- References
- Declaration of originality

**Your target:** 9,000 words (max 10,000 with 10% allowance)

**How to check in Word:**
1. Tools → Word Count
2. Note the number
3. Write it on the title page

---

## Formatting Checklist

- [ ] Title page included with word count
- [ ] Abstract on its own page
- [ ] Table of contents auto-generated
- [ ] Section headings use built-in Heading styles (Heading 1 & 2)
- [ ] All tables have captions (e.g., "Table 1: Aave Findings Summary")
- [ ] All figures have captions
- [ ] Page numbers on every page (usually bottom right)
- [ ] References formatted consistently (Harvard or APA)
- [ ] Appendix clearly labeled (Appendix A, Appendix B, etc.)
- [ ] Margins: 1" on all sides
- [ ] Font: Times New Roman or Calibri, 12pt
- [ ] Line spacing: 1.5 or double-spaced (check handbook)

---

## Building the Final Document

### Option A: Manual Assembly (Recommended for Control)

1. Create new Word document
2. Copy-paste each section in order
3. Format as you go
4. Use Word's Table of Contents feature to auto-generate TOC
5. Insert page breaks between major sections
6. Add header/footer with page numbers

### Option B: Convert from Markdown

If using Pandoc:

```bash
pandoc 01_Findings_DRAFT.md 02_Methodology_DRAFT.md \
  03_LiteratureReview_DRAFT.md 04_Discussion_DRAFT.md \
  05_Conclusions_DRAFT.md -o DISSERTATION_FINAL.docx
```

Then format the output (may need manual cleanup).

---

## Submission Checklist

Before uploading to Canvas on 8 September at 4pm:

- [ ] Word count on title page
- [ ] Word count verified (9,000-10,000 range)
- [ ] All sections present
- [ ] Appendix complete (summary table, full tables)
- [ ] References formatted
- [ ] Ethics form included
- [ ] Checklist form (Appendix 3) included
- [ ] No placeholder text or [INSERT X HERE] remaining
- [ ] Proofread (no typos, grammar checked)
- [ ] Turnitin check run (to catch any accidental plagiarism)
- [ ] Saved as `.docx` file
- [ ] File name: `Sathya_Suvarna_IRP_MSc.docx` (or per instructions)

---

## If Word Count Is Over Limit

**10,001+ words = 10-mark penalty**

Where to cut if needed:
1. Trim Discussion section (most expendable)
2. Condense Literature Review
3. Shorten Conclusions
4. Reduce tables (move full versions to appendix only)

Priority: Keep Findings and Methodology intact. These are your core contribution.

---

## What Charles's Feedback Means for Assembly

**In your finished document:**

✅ **Findings section:**
- Clear statements: "This section validates [access control / upgradeability / etc.]"
- F05 shown as contradiction case
- Untested findings explicitly labeled
- Summary table in appendix showing Supported / Contradicted / Untested

✅ **Methodology section:**
- Decision-support framing of DST (why conflict is useful)
- Evidence independence explained
- Protocol-specific scoring differences justified

✅ **Discussion section:**
- Limitations section is honest and complete
- F05 case study detailed
- Implications clearly stated

✅ **Appendix:**
- Summary table per Charles's request (first thing in appendix)
- All 22 findings represented
- Protocol comparisons visible at a glance

---

## Timeline for Assembly

**By 06 Sep (1 day before deadline):**
- All sections written and polished
- Word count finalized
- All tables filled in
- References compiled

**07 Sep (morning):**
- Assemble all sections into single document
- Add title page, TOC, appendix
- Verify formatting
- Final proofread

**07 Sep (afternoon):**
- Run through Turnitin
- Make any final corrections
- Save final version

**08 Sep (morning):**
- Final check
- Export to PDF (optional backup)
- Prepare for submission

**08 Sep at 4pm:**
- Upload to Canvas
- Confirm submission receipt

---

## Help With Assembly

If you get stuck:
- Use the Handbook's example structure
- Check Queen's Business School submission guidelines
- Ask in a supervision meeting

---

## Key Files You'll Reference

- `Findings_Summary_v2.docx` — all your data
- `00_DISSERTATION_SCHEDULE.md` — your timeline
- `PROGRESS_TRACKER.md` — keep updating daily
- Charles's feedback email — your north star

---

**You're ready. Start with the Findings section. Go.**
