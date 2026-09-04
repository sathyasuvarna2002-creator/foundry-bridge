# 2. METHODOLOGY
**Target: 1,500 words**  
**Status: PENDING**

---

## Structure Overview

- **Research Design & Protocol Selection** (~400 words)
  - Why Aave, Venus, Compound
  - Open vs fixed taxonomies

- **Evidence Layers & Validation Approach** (~400 words)
  - AI risk reasoning (Node 07)
  - Deterministic validation (Foundry + cast)
  - Evidence independence

- **Dempster-Shafer Evidence Fusion** (~400 words)
  - Three-bucket model (real, not real, don't know)
  - Conflict measurement
  - Why this preserves decision-useful information
  - NOT a calibrated probability

- **Specific Protocol Considerations** (~300 words)
  - Aave's fixed taxonomy (11 findings)
  - Venus's open taxonomy (6 findings)
  - Compound's stricter scoring (3 matched)
  - Why the differences matter

---

## Key Requirements (from Charles)

✅ Explain what's being validated in each protocol  
✅ Emphasize decision-support value of conflict preservation, not the math  
✅ Be explicit about evidence independence (why LLM code can't sit on both sides)  
✅ Avoid claiming higher scores = better accuracy  

---

## 2.1 Research Design & Protocol Selection

### Scope Definition

The research addresses a fundamental question in smart contract security: when an AI system identifies a potential risk and independent testing either confirms or contradicts it, how should we interpret that disagreement?

**Three protocols were selected** to represent different design patterns and risk profiles:

- **Aave V3** (Ethereum mainnet): Mature lending protocol with fixed taxonomy (11 pre-defined risks)
- **Venus Protocol** (BNB Chain): Compound fork with open taxonomy (risk discovery process)
- **Compound V2** (Ethereum mainnet): Original lending protocol with explicit specification matching

### Taxonomy Approach

**Aave:** Fixed taxonomy. The 11 risks (F01-F11) are pre-defined, stable, and comprehensive for the protocol architecture.

**Venus:** Open taxonomy. No fixed list. The AI and audit process discover risks independently, and we match them to specification.

**Compound:** Specification-driven. Five canonical claims are formally defined; candidates must anchor-token match to be considered.

Each approach reflects real-world validation complexity.

---

## 2.2 Evidence Layers

### Layer 1: AI Risk Reasoning (Node 07)

The LLM reads the protocol's architecture and specification, then:
- Proposes risks it identifies
- Assigns a confidence score (0–1) on its own assessment
- Produces reasoning + source code citations

**This layer sees:** Contract code, documentation, architecture diagrams.  
**This layer does NOT see:** Real contract state, Foundry test outcomes, live blockchain queries.

### Layer 2: Deterministic Validation (Nodes 13, 16, 18)

Independent of the LLM's reasoning, we verify each risk through:

1. **Source Code Analysis** (Node 13)
   - Does the mechanism the LLM described actually exist in the contract?
   - Are there controlled predicates that can be verified?

2. **Live Contract Queries** (Node 16)
   - Call `cast` to read the deployed contract's state
   - Verify configuration parameters match assumptions
   - Check access control structures

3. **Behavioral Testing** (Node 18 / Foundry)
   - Write executable tests that attempt to trigger or prevent the risk
   - Run against a fork of the real blockchain state
   - Record pass/fail with evidence

**This layer sees:** Real contract bytecode, on-chain state, test execution.  
**This layer does NOT see:** The LLM's reasoning or scores.

### Why Evidence Independence Matters

The LLM's citations (e.g., "line 542 of contract X shows this") cannot directly feed the deterministic layer as proof. If they did:
- The LLM's own reasoning would inflate the deterministic confidence
- We'd be double-counting the same evidence source
- Contradictions would be hidden rather than revealed

Instead, the deterministic layer **rediscovers** what the LLM claimed, using different methods:
- Source code: direct verification, not LLM interpretation
- Live queries: read from the blockchain, not the LLM's model
- Tests: executed behavior, not hypothetical scenarios

---

## 2.3 Dempster-Shafer Evidence Fusion

### The Three-Bucket Model

Standard probability forces evidence into binary: "true" or "false." Dempster-Shafer adds a third option: "don't know."

**For each claim, we assign weight across three buckets:**

- **REAL** — weight assigned to "the risk is genuine"
- **NOT REAL** — weight assigned to "the risk does not exist"
- **DON'T KNOW** — weight assigned to "the evidence is inconclusive"

The LLM proposes risks; it never argues a risk is absent. So:
- LLM's "REAL" bucket gets the confidence score
- LLM's "NOT REAL" bucket stays at 0 (the LLM doesn't claim absence)
- LLM's "DON'T KNOW" bucket gets the remainder

Tests, by contrast, can go either way:
- Passing test → "NOT REAL" bucket (protection worked)
- Failing test → "REAL" bucket (vulnerability confirmed)
- Inconclusive test → "DON'T KNOW" bucket

### Measuring Conflict

When the two sources assign weight to opposite buckets, that's conflict.

**Example (F05):**
- LLM: 0.90 (REAL) | 0.00 (NOT REAL) | 0.10 (DON'T KNOW)
- Test: 0.50 (REAL) | 0.25 (NOT REAL) | 0.25 (DON'T KNOW)

Conflict = (LLM's "REAL" × Test's "NOT REAL") + (LLM's "NOT REAL" × Test's "REAL")  
= (0.90 × 0.25) + (0.00 × 0.50) = **0.225**

That 0.225 is real, measured disagreement. It gets set aside and reported as a **conflict indicator**, not blended away.

### Why This Preserves Decision-Useful Information

A decision-maker reviewing F05 needs to know:
- The AI thought it was likely real
- The tests found mixed evidence
- These two views contradict each other

An average (e.g., (0.90 + 0.95) / 2 = 0.925) smooths away that contradiction and loses the signal.

Dempster-Shafer keeps it visible: the score shows the fused assessment (0.95), but the conflict figure (0.225) tells you *why* to be cautious.

### What the Final Score Means

The fused confidence is **not a calibrated probability.** It is:
- A systematic aggregation of two independent evidence sources
- Sensitive to conflict between those sources
- A summary for decision-makers, not a prediction

---

## 2.4 Protocol-Specific Considerations

### Aave: Why Higher Scores

Aave was tested bidirectionally on 6 of 11 findings:
- Stranger blocked from action → confirmed
- Legitimate actor can perform action → confirmed

This dual testing produces high confidence. Additionally, source-code evidence (e.g., "the access control modifier is present") counts toward the deterministic layer, so confidence rises.

### Venus: Why 1.00 on Five Findings

Five of six Venus findings have both:
- Written Foundry tests
- Real execution against BNB Chain fork
- All test assertions passed

With complete evidence, the deterministic score reaches 1.00. This is not overclaiming; it reflects that every tested claim held.

### Compound: Why Stricter Scoring

Compound deliberately does not count source-code presence as deterministic proof on its own. A finding must have:
- Source-code match (predicate mapping)
- Live contract query confirmation
- **AND** a Foundry test with pass/fail

This stricter rule means:
- "Found in source" alone → MAPPED_PENDING_INDEPENDENT_VERIFICATION (not SUPPORTED)
- Multiple evidence layers must align
- Source-code presence is necessary but not sufficient

This choice explains why Compound's deterministic scores are more cautious even though tests passed.

---

## NEXT STEPS

- [ ] Expand each subsection to full prose (current = outline)
- [ ] Add specific examples from findings (reference Aave F01, Venus Asset Custody, Compound Access Control)
- [ ] Write detailed DST explanation with the F05 worked example
- [ ] Clarify why each protocol's scoring rule is justified
- [ ] Add diagram or flowchart (optional but helpful): three evidence layers → fusion → decision
- [ ] Word count check: target 1,500 words
- [ ] Ensure Charles's feedback is addressed: decision-support framing, not math

---

**Current Word Count:** 0 / 1,500  
**Status:** Ready for drafting
