# 3. LITERATURE REVIEW
**Target: 1,200 words**  
**Status: PENDING**

---

## Structure Overview

- **Evidence Validation in Software Security** (~300 words)
  - Formal verification approaches
  - Testing & behavioral validation
  - Multi-source evidence evaluation

- **AI in Smart Contract Analysis** (~300 words)
  - LLM-based code analysis (current state)
  - Limitations of AI-only approaches
  - Why independent verification is needed

- **DeFi Risk Assessment** (~300 words)
  - Existing audit frameworks (OpenZeppelin, Trail of Bits, etc.)
  - Categorical risk models
  - How risks are currently discovered and validated

- **The Gap: Systematic Evidence Integration** (~300 words)
  - Why contradictory evidence matters
  - How existing frameworks handle disagreement (or don't)
  - Your contribution: methodical integration of conflicting evidence

---

## Key Themes

✅ Evidence from multiple sources is stronger than single-source analysis  
✅ Disagreement between sources is informative, not a failure  
✅ AI-generated assessments need independent validation  
✅ Current audit practices don't systematically handle evidence conflicts  

---

## 3.1 Evidence Validation in Software Security

### Formal Verification

Traditional formal verification (model checking, theorem proving) provides mathematical proof that code meets a specification. Strengths:
- Guarantees (not probabilities)
- Finds subtle bugs that tests miss

Limitations:
- Expensive and time-consuming
- Requires formal specification (often unavailable)
- Doesn't scale to large, complex systems

### Testing & Behavioral Validation

Foundry, Truffle, and similar frameworks focus on **observable behavior:**
- Does the contract reject unauthorized access?
- Does the state change correctly after an action?
- Can an invariant be violated?

Strengths:
- Practical and scalable
- Tests real contract bytecode on real blockchain forks
- Catches integration bugs

Limitations:
- Test coverage is incomplete (what wasn't tested might still be broken)
- Doesn't prove absence of vulnerabilities
- Depends on the quality and creativity of test design

### Multi-Source Evidence Integration

Security research increasingly combines multiple validation techniques:
- Source-code static analysis
- Symbolic execution
- Dynamic testing
- Human manual review

Each source has blind spots. Together, they're stronger.

**The gap:** Most frameworks don't systematically measure how sources agree or disagree. This work addresses that.

---

## 3.2 AI in Smart Contract Analysis

### Current Landscape

Large language models (GPT-4, Claude) can read smart contract code and identify potential risks. Studies show:
- High recall on known vulnerability classes (off-by-one, integer overflow, etc.)
- Reasonable precision on architectural risks (access control patterns)
- Lower performance on economic/game-theoretic risks

### Why AI Alone Is Insufficient

The LLM reads code and reasoning; it doesn't:
- Execute the contract on live blockchain state
- Run behavioral tests
- Verify that the risk is actually exploitable (not just theoretically present)
- See what the actual deployed contract does vs. what the code says

Example: An LLM might identify "this contract has a flashloan function" and flag it as a risk. But whether that risk is actually exploitable depends on:
- What other contracts call it
- Market conditions (liquidity, price feeds)
- Timing (within a single transaction or across blocks)

The LLM cannot determine these without independent evidence.

### The Validation Question

The core question: Can we systematically evaluate AI findings against independent evidence?

This is not "is the AI right or wrong" (binary). It's "how do we aggregate evidence when sources disagree?"

---

## 3.3 DeFi Risk Assessment

### Existing Audit Frameworks

Professional auditors (OpenZeppelin, Trail of Bits, CertiK, Spearbit) typically:
1. Read the code
2. Categorize findings by severity (Critical, High, Medium, Low)
3. List recommendations
4. Issue a report

Strengths:
- Expert human review
- Proven track record
- Risk categorization is standardized

Limitations:
- Expensive (weeks to months)
- Coverage varies (different auditors, different practices)
- No systematic way to say "we tested X and found Y"
- When findings disagree between auditors, no clear way to resolve

### Risk Taxonomies

Most frameworks use categorical models:
- **Access Control:** Can unauthorized parties invoke functions?
- **Upgradeability:** Can someone secretly change the code?
- **Economic Dependency:** Do financial mechanisms work as claimed?

These categories are useful but:
- They don't capture all risks
- Different protocols use different taxonomies
- No standard for what constitutes "proof" of a risk

### Current Validation Gaps

Most audits report:
- "We reviewed the code and found X"
- "We recommend Y"

They rarely report:
- "We wrote tests; here's what passed and what failed"
- "Here's where we're certain and where we're not"
- "Here's what happened when two assessment methods disagreed"

---

## 3.4 The Contribution: Systematic Evidence Integration

### The Problem This Work Addresses

When you have multiple evidence sources (AI reasoning + deterministic validation), three things can happen:

1. **Agreement:** Both sources confirm the risk is real → high confidence
2. **Disagreement:** One source says risk is real; the other says it's not → decision-makers need to see this conflict
3. **Partial Resolution:** One source confirms; the other is inconclusive → legitimate uncertainty

Current practices either:
- Ignore the disagreement (average the scores, hide the conflict)
- Pick the "stronger" source arbitrarily
- Don't systematically compare at all

### Why Conflict Is Useful

Contradiction is not a failure; it's signal. If the LLM says a risk is likely real, but testing shows it's blocked, that contradiction tells you:
- The LLM correctly identified an exploitable pattern
- But the contract's implementation successfully defends against it
- This is a success story, not a contradiction

Or the reverse: LLM says it's low risk, but testing finds a gap. The contradiction points to a real oversight.

### Your Contribution

This work provides:
1. **A methodology** for systematically combining AI and deterministic evidence
2. **A framework** (Dempster-Shafer fusion) that preserves conflict rather than erasing it
3. **Evidence** from three real protocols showing how disagreement appears in practice
4. **Guidance** for decision-makers on how to interpret conflicting evidence

This is not just "audits are better than AI" or vice versa. It's "here's how to use both together."

---

## Positioning Your Work

**Intellectual lineage:**
- Builds on formal verification literature (multi-source validation)
- Extends evidence integration theory (Dempster-Shafer)
- Applies to the emerging challenge of AI-assisted security (how to trust AI when it's not always right)

**Novelty:**
- First systematic application of conflict-preserving fusion to smart contract validation
- Empirical evidence from three major DeFi protocols
- Clear decision-support framework for resolving evidence disagreement

**Impact:**
- Auditors can use this to be more systematic about combining AI findings with testing
- Protocol teams can understand where to focus testing efforts
- Academic security community has a new lens for AI validation

---

## NEXT STEPS

- [ ] Expand each subsection with citations (find 3-5 academic papers per section)
- [ ] Add concrete examples: cite a specific OpenZeppelin audit, a known vulnerability, etc.
- [ ] Write the "positioning" section to show how your work fits into the literature
- [ ] Connect literature directly to your findings (e.g., "As shown in Aave F05...")
- [ ] Word count check: target 1,200 words
- [ ] Ensure the narrative flows: problem → existing solutions → gap → your contribution

---

**Current Word Count:** 0 / 1,200  
**Status:** Ready for drafting

**Suggested Academic Sources:**
- Formal verification in blockchain (KeVM, Vyper, etc.)
- LLM applications in code analysis
- Dempster-Shafer theory applications
- Audit frameworks (read the actual audit reports from your three protocols)
- DeFi risk literature
