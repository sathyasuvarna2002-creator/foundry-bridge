# ORGANISATION AND SECTOR ANALYSIS
**Target: ~1,000 words. SWOT, PESTLE, Value Chain, Porter's Five Forces, AI Maturity Model. Third person, Harvard citation, strategic/critical register — every point argues something rather than merely describing a category.**

---

## Organisation and Sector Analysis

The unit of analysis here is not a single firm but an industry structure: the loose ecosystem of audit firms, automated tooling vendors, and emerging LLM-based review platforms that DeFi protocols rely on to certify the safety of the code securing roughly $78 billion in deposited value (eco.com, 2025). Framing the "organisation" this way matters strategically — the sector's failure mode is not any one tool underperforming, but a structural one: methods are evaluated in isolation from one another, with no established mechanism for reconciling disagreement between them (Chaliasos *et al.*, 2024). That structural gap is what the following analysis repeatedly returns to.

### SWOT

| | Critical point (not a generic listing) |
|---|---|
| **Strengths** | LLM-based review measurably outperforms static analysis on complex logic vulnerabilities (Wei *et al.*, 2024); forked-chain behavioural testing exposes tests to real, current on-chain conditions no testnet can replicate (Foundry-rs, 2024). |
| **Weaknesses** | LLMs cannot execute the code they review — the gap between confidence and correctness is structural, not a training limitation that scale will eventually close. |
| **Opportunities** | Evidence-fusion methods proven in adjacent fields (Dempster, 1967; Hall and Llinas, 1997) remain almost entirely unapplied to AI-generated security claims specifically — a genuine first-mover gap. |
| **Threats** | Losses are rising in absolute terms despite proliferating tooling — $3.1 billion in H1 2025 alone (Yellow.com, 2025) — and formal verification, the rigorous alternative, cannot scale to absorb the difference. |

The strategic reading of this table is that the sector's strengths and weaknesses sit on the same axis rather than opposite ones: the capability that makes LLM review valuable (fluent, fast pattern recognition) is inseparable from the limitation that makes it dangerous (no execution grounding). No amount of model improvement resolves that trade-off; only independent validation does.

### PESTLE

**Political and Legal.** Regulatory attention to DeFi is intensifying but remains fragmented across jurisdictions, which pushes protocols toward voluntary self-certification rather than waiting for a settled external standard. Liability for an AI-assisted audit failure is correspondingly unresolved — no case has yet established what happens when an LLM misses a vulnerability a human auditor would have caught, a governance vacuum the Queen's ethics framework itself gestures toward under "responsible use of AI technologies."

**Economic.** Capital concentration compounds the risk: Aave alone accounts for over half of lending-sector TVL and market share (Aave, 2025), meaning a single validation failure at scale carries systemic rather than merely local consequences.

**Social.** User trust remains anchored to a visible "audited" badge, largely independent of what that audit's methodology actually verified — an information asymmetry the market has shown little incentive to close on its own.

**Technological.** LLM capability continues to outpace the validation infrastructure built around it; the bottleneck has shifted from raw model capability to trust calibration (Lee and See, 2004), which is precisely the layer this research targets.

### Value chain: where efficiency actually sits

Applying Porter's (1985) value-chain logic, the sector's chain runs from development, through internal review, third-party audit, deployment, and post-deployment monitoring. Industry investment concentrates almost entirely on the audit stage — a discrete, billable, pre-deployment event with a clear commercial line item. The evidence-fusion capability this research develops sits instead at the *evaluation* layer, closer to a support activity in Porter's original terms than to a primary one. That positioning is the point rather than a limitation: efficiency gains at the evaluation layer are currently under-monetised precisely because they do not map onto any existing invoice line in the sector's present cost structure, which is exactly the condition under which a genuinely new capability tends to be underpriced relative to its value.

### Porter's Five Forces

Applied to the security-tooling industry rather than any single vendor: the **threat of new entrants** is moderate — open-source LLM tooling lowers the barrier to entry for surface-level review, but genuine deterministic validation (forked-chain infrastructure, RPC access, Foundry expertise) keeps the real barrier higher than it appears. **Buyer power** — protocols choosing among audit firms — is high, which commoditises point-in-time audits and pushes competition toward speed and price rather than evidentiary rigour. **Supplier power** is rising, since frontier-model access is concentrated among a small number of providers. The **threat of substitutes** is real but bounded: formal verification remains the credible alternative but is, by the literature's own consistent finding, too costly and too specialist to scale across the sector. **Rivalry** among existing tools is intense but strategically shallow — firms compete on turnaround time and headline price rather than on whether their findings can be reconciled with a competitor's. That last point is the more consequential one: intense rivalry combined with high buyer power gives no individual firm a commercial incentive to admit its tool disagrees with another's, since doing so would undercut the marketing value of the "audited" badge itself. The tool-isolation problem this research addresses is not, on this reading, an oversight — it is a rational consequence of how the industry currently competes.

### AI maturity model

Assessed against Alsheibani, Cheung and Messom's (2019) AI Maturity Model — which distinguishes descriptive, prescriptive, and comparative organisational capability — the sector sits, on balance, at an early descriptive stage. Firms can readily describe that they use AI in security review; few can benchmark that AI's reliability against independently gathered evidence, which the model identifies as the rarest and most mature capability. Jöhnk, Weißert and Wyrtki (2021) reach a related conclusion from interview-based research: organisational AI readiness depends less on technical capability than on institutional mechanisms for calibrating trust in AI output. Read against that framing, the contribution of this research is not best understood as a novel AI application competing with existing tools, but as maturity-advancing infrastructure for a sector that has adopted AI considerably faster than it has learned to validate it.

---

**Word count: 1,012**

---

## Reference List (Harvard Style)

Aave (2025) *Aave 2025 Year in Review*. Available at: https://aave.com/blog/aave-2025-recap (Accessed: 20 August 2026).

Alsheibani, S., Cheung, Y. and Messom, C. (2019) 'Towards an artificial intelligence maturity model: from science fiction to business facts', in *Proceedings of the 23rd Pacific Asia Conference on Information Systems (PACIS 2019)*.

Chaliasos, S., Charalambous, M.A., Zhou, L., Galanopoulou, R., Gervais, A., Mitropoulos, D. and Livshits, B. (2024) 'Smart contract and DeFi security tools: do they meet the needs of practitioners?', in *Proceedings of the 46th International Conference on Software Engineering (ICSE '24)*. New York: ACM.

Dempster, A.P. (1967) 'Upper and lower probabilities induced by a multivalued mapping', *Annals of Mathematical Statistics*, 38(2), pp.325–339.

eco.com (2025) *Best DeFi Lending Protocols 2026: TVL, Rates, Risk Compared*. Available at: https://eco.com/support/en/articles/15254000-best-defi-lending-protocols-2026-tvl-rates-risk-compared (Accessed: 20 August 2026).

Foundry-rs (2024) *Foundry Book: Fork Testing*. Available at: https://getfoundry.sh/guides/fork-testing (Accessed: 20 August 2026).

Hall, D.L. and Llinas, J. (1997) 'An introduction to multisensor data fusion', *Proceedings of the IEEE*, 85(1), pp.6–23.

Jöhnk, J., Weißert, M. and Wyrtki, K. (2021) 'Ready or not, AI comes — an interview study of organizational AI readiness factors', *Business & Information Systems Engineering*, 63(1), pp.5–20.

Lee, J.D. and See, K.A. (2004) 'Trust in automation: designing for appropriate reliance', *Human Factors*, 46(1), pp.50–80.

Porter, M.E. (1980) *Competitive Strategy: Techniques for Analyzing Industries and Competitors*. New York: Free Press.

Porter, M.E. (1985) *Competitive Advantage: Creating and Sustaining Superior Performance*. New York: Free Press.

Wei, Z., Sun, J., Zhang, Z., Zhang, X., Li, M. and Hou, Z. (2024) 'LLM-SmartAudit: advanced smart contract vulnerability detection', *arXiv preprint* arXiv:2410.09381.

Yellow.com (2025) *Why DEX Exploits Cost $3.1B in 2025: Analysis of 12 Major Hacks*. Available at: https://yellow.com/research/why-dex-exploits-cost-dollar31b-in-2025-analysis-of-12-major-hacks (Accessed: 20 August 2026).

---

## Notes

**Kept it deliberately un-general.** Textbook SWOT/PESTLE sections are the single easiest place in a dissertation to sound like a template — six bullet points per framework, none of them argued, all of them true of almost any tech sector. Every point above instead makes a specific claim about *this* sector that would be false or at least contestable if applied elsewhere (e.g. the rivalry point — competing on speed rather than reconciliation — is a claim about *why* the tool-isolation problem persists, not a generic statement that "competition is intense").

**The value-chain point is the sharpest one to defend in a viva.** Positioning your own contribution as sitting in an *under-monetised* part of the chain, rather than claiming it as a totally new market, is a more defensible and more interesting strategic claim — worth being ready to expand on if asked.

**Nothing here names Jerry's product**, per where things stood after yesterday's conversation — the AI Maturity Model section gestures at "a sector that has adopted AI faster than it has learned to validate it" without pointing at anyone specific, which keeps the door open either way once you've spoken to Charles.
