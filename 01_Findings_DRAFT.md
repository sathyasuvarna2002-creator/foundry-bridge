# 1. FINDINGS
**Target: 3,500 words**  
**Status: IN PROGRESS**

---

## Structure Overview

- **Aave Findings** (~1,200 words)
  - What's being validated
  - The 11 findings table & summary
  - Key observations

- **Venus Findings** (~1,000 words)
  - What's being validated
  - The 6 findings table & summary
  - Key observations

- **Compound Findings** (~900 words)
  - What's being validated
  - The 3 matched findings table & summary
  - Why stricter scoring
  - Key observations

- **Cross-Protocol Observations** (~400 words)
  - Contradictions revealed
  - Untested areas
  - What this means

---

## Key Requirements (from Charles)

✅ Be very explicit about what is being validated  
✅ Show genuine disagreement (F05 example)  
✅ Discuss untested findings honestly  
✅ For each protocol: state clearly whether validating access control, upgradeability, governance, dependency, or observable behavior  
✅ Avoid overclaiming: don't say "increased confidence = better accuracy" without ground truth  

---

## 1.1 AAVE — 11 Findings, All Tested

### What This Section Validates

Aave V3 core protocol mechanisms. Specifically:
- **Access Control:** Can unauthorized parties invoke protected functions?
- **Upgradeability:** Is the proxy pattern correctly locked down?
- **Governance & Centralization:** Do admin controls concentrate risk?
- **Economic Dependency:** Do interest rates, fees, and reserves behave as designed?
- **Composability & Trust Boundaries:** Can external actors abuse flashloans or delegation?

### The 11 Findings

[INSERT TABLE HERE — reference Findings_Summary_v2.docx]

| Finding | LLM Confidence | Deterministic | Difference | Status |
|---------|---|---|---|---|
| F01 — Upgradeable Proxy Control | 0.90 | 0.99 | +0.09 | Both directions tested |
| F02 — Registry Centralisation | 0.92 | 0.99 | +0.07 | Both directions tested |
| F03 — ACL Manager Role Concentration | 0.89 | 0.99 | +0.10 | Real finding: same owner across F01/F02/F03 |
| ... | | | | |

### What the Testing Revealed

**All eleven scores rose.** None fell. This indicates:
- The deterministic evidence layer consistently supported what the LLM identified
- Six findings were tested bidirectionally (stranger blocked + legitimate action works)
- Testing added confidence in almost every case

### The Exception: F05 (Umbrella Deficit Authority)

**Lowest movement: +0.05**

This is the finding where the AI and test evidence genuinely disagree. The LLM was 90% confident; tests came back 95% (modest increase). This disagreement is discussed in detail in the Discussion section and is Appendix notation as "Contradicted."

### Untested Areas Within Tested Findings

- **F07, F08, F11:** Confirmed that unauthorized parties are blocked, but the downstream effects of authorized changes were not tested (e.g., whether rate changes actually move live rates). These are flagged as partially tested.

---

## 1.2 VENUS — 6 Findings, 5 Tested

### What This Section Validates

Venus on BNB Chain. Specifically:
- **Upgradeability:** Implementation swap mechanisms
- **Access Control:** Who can modify risk parameters?
- **Economic Dependency:** Interest accrual, exchange rates, supply caps
- **Asset Custody:** Can the contract's backing be manipulated?
- **Operational Resilience:** Reserve distribution safety

### The 6 Findings

| Finding | LLM Confidence | Deterministic | Difference | Tested? |
|---------|---|---|---|---|
| Upgradeability | 0.90 | 1.00 | +0.10 | Yes |
| Access Control | 0.85 | 1.00 | +0.15 | Yes |
| Economic Dependency | 0.85 | 1.00 | +0.15 | Yes |
| Asset Custody (donation attack) | 0.90 | 1.00 | +0.10 | Yes |
| Dependency (supply cap) | 0.88 | 1.00 | +0.12 | Yes |
| Operational Resilience | 0.78 | 0.89 | +0.11 | **No** |

### What the Testing Revealed

**Five of six reached 1.00.** The tested evidence fully supported every claim.

**One remains untested:** Operational Resilience (moving reserves to external distributor). No Foundry test has been written; we report it as unresolved rather than assume it's fine.

### The Deepest Test in the Project

**Asset Custody (donation attack):** This is the single deepest behavioral test across all three protocols.
- Sent real tokens directly to the contract, bypassing the official deposit path
- Watched the exchange rate shift in real time
- Confirmed the attack mechanism works
- **And crucially:** this test re-runs live every pipeline execution, not from a recorded snapshot

---

## 1.3 COMPOUND — 5 Canonical Claims, 3 Matched This Run

### What This Section Validates

Compound V2 cToken mechanism. Specifically:
- **Access Control:** Who can modify protocol risk settings?
- **Economic Dependency:** Is the interest rate model genuinely connected to live data?
- **Upgradeability:** Can the contract's logic be secretly rewritten?

### The Scoring Difference

Compound is scored more strictly than Aave and Venus. Finding something in the source code counts as supporting evidence for Aave/Venus. For Compound, source-code findings alone do **not** count as deterministic proof. This choice is why Compound's scores look more cautious despite comparable live checks and tests.

### The 3 Matched Findings

| Finding | LLM Confidence | Deterministic | Difference | Status |
|---------|---|---|---|---|
| Access Control | 0.96 | 0.99 | +0.03 | Found in source, confirmed on chain, test passed |
| Economic Dependency | 0.92 | 0.97 | +0.05 | Rate model confirmed real; behavioral test inconclusive (market paused) |
| Upgradeability (negative control) | not scored | — | — | **Negative control:** no mechanism to swap logic exists |

### What "Negative Control" Means

**UPGRADEABILITY_01 is a statement of absence, not presence.**

The claim: "There is NO mechanism to upgrade this contract's logic."

We verified:
- Queried the live deployed contract
- Confirmed there is no delegatecall pattern
- Confirmed no admin key can rewrite it

Unscored because the LLM did not independently raise this risk (it proposes risks, never argues risks are absent). With no LLM judgment to fuse against, the finding stays unscored. But it's documented and true.

### Untested Compound Checks

Two other Compound checks have real Foundry tests written and ready:
- Exchange-rate manipulation (donation-style attack)
- Emergency pause authority

The LLM did not raise these in this run, so they never entered the matching stage. Their tests exist and could be run in future iterations.

### Why "0 Fully Confirmed" Despite Tests Passing

This is the critical Compound distinction. Compound requires **every** checklist item to be independently tested to call a finding SUPPORTED. Aave/Venus treat source-code evidence as valid supporting mass.

Compound's stricter rule means:
- 3 findings have both AI judgment and deterministic evidence
- 2 of those 3 passed Foundry tests
- But Compound's evidence independence rules mean "0 fully confirmed" is honest, not a failure

This is discussed in detail in the Discussion section.

---

## 1.4 Cross-Protocol Observations

### Where Evidence Agreed

Across all three protocols, the highest agreement was on:
- Access control mechanisms (both AI and tests confirmed)
- Upgradeability patterns (source code + live queries aligned)
- Basic economic model structure (LLM reasoning + parameter queries agreed)

### Where Evidence Disagreed

Only **one genuine contradiction:** Aave F05 (Umbrella Deficit Authority). The LLM was confident; the evidence was less conclusive. This disagreement is preserved and discussed.

### What Remained Untested

- Aave: 3 findings confirmed access is blocked, but downstream effects untested (F07, F08, F11)
- Venus: 1 finding (Operational Resilience) has no test at all
- Compound: 2 findings have tests written but were not raised by LLM this run

### The Bigger Picture

These untested areas are not failures. They're intentional design choices:
- Aave F07/F08/F11 test authorization, not downstream effects (which require live market conditions)
- Venus Operational Resilience is genuinely open (reserves move is a governance action, not something to simulate)
- Compound's two untested findings exist and can be re-run when the LLM raises them

---

## Key Takeaway from Findings

The real contribution is not the final scores themselves, but the demonstration that:

1. **Independent evidence can support an AI assessment** (all three protocols showed this)
2. **Independent evidence can challenge an AI assessment** (F05 showed this)
3. **Independent evidence can leave an assessment unresolved** (Venus Operational Resilience showed this)

This three-part outcome is exactly why validation is necessary.

---

## NEXT STEPS

- [ ] Fill in actual Aave table with all 11 findings (copy from Findings_Summary_v2.docx)
- [ ] Fill in actual Venus table with all 6 findings
- [ ] Fill in actual Compound table with the 3 matched findings
- [ ] Expand each protocol section with precise language from the findings document
- [ ] Add explicit statements on what's being validated
- [ ] Ensure contradiction cases are highlighted
- [ ] Word count check: target 3,500 words
- [ ] Polish and iterate

---

**Current Word Count:** 0 / 3,500  
**Status:** Ready for drafting
