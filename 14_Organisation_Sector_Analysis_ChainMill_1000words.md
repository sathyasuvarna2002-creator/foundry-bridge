# ORGANISATION AND SECTOR ANALYSIS
**Third person throughout, no first-person pronouns. ChainMill named as the host consultancy organisation; KOVA named as ChainMill's proof-of-concept venture, for which this dissertation's pipeline was built. SWOT and PESTLE as tables.**

---

## 2. Organisational and Sector Analysis

### 2.1 ChainMill: Organisational Context

ChainMill is the consultancy organisation hosting this Independent Research Project, under the mentorship of co-founder Jerry Staple, and operates within the smart-contract security sector — auditing, automated analysis, formal verification, and emerging AI-based approaches — set against a DeFi ecosystem whose products span lending, exchanges, staking, insurance and asset management (Kotzer *et al.*, 2026; Bourveau, Brendel and Schoenfeld, 2024). This dissertation does not analyse ChainMill's established consultancy practice directly; it sits within a specific initiative inside ChainMill: KOVA, a new venture Jerry Staple is developing, for which the evidence-fusion pipeline described in this dissertation was built. ChainMill's existing security expertise and industry positioning provide the operating context this research draws on, while the research problem itself belongs to KOVA.

### 2.2 KOVA: Venture Context

KOVA is ChainMill's proof-of-concept venture: a nine-dimension institutional risk intelligence framework being developed for allocators deploying capital into DeFi protocols and tokenised real-world assets. This dissertation addresses Dimension 1 of that framework, smart-contract risk. The problem it addresses follows from the sector context above: institutional allocators currently have limited means of independently verifying a protocol's security beyond trusting whichever audit or scanner report a project chooses to publish, and Chaliasos *et al.* (2024) find no established way to reconcile disagreement between such reports even where several exist — the same gap the Venus Protocol donation exploit exposed in March 2026, when a vulnerability dismissed in a 2023 audit as having "no negative side effects" was used to leave the protocol with roughly $2.15 million in bad debt, though total value lost has been reported as high as $3.7 million (Behnke, 2026; Aziz, 2026; Venus Protocol, 2026). KOVA's Dimension 1 proposition is to combine AI-generated risk reasoning with independently gathered deterministic evidence — on-chain queries, Foundry-executed behavioural tests, historical exploit comparison — into a single evidence-fusion assessment an allocator can act on directly. Because KOVA remains a proof of concept, its customer base, pricing, the remaining eight risk dimensions, and long-term product form are not yet established; this dissertation investigates whether Dimension 1's underlying evidence-fusion capability is sound, not whether KOVA as a business is viable.

### 2.3 External Environment — PESTLE

The PESTLE analysis considers the external environment shaping institutional DeFi risk intelligence, with particular relevance to KOVA's Dimension 1 capability rather than its remaining eight dimensions.

| | Point |
|---|---|
| **Political** | Regulatory treatment of DeFi is becoming more interventionist, most visibly through the EU's MiCA regime (European Union, 2023), while the UK has instead pursued a sandbox-led, proportionate approach to tokenised markets (Woolard, 2026), so jurisdictions have not converged on a single standard. Compliance alone does not evidence technical soundness, which raises the value of an independent assessment capability such as Dimension 1. |
| **Economic** | Ethereum's lending market remains highly concentrated five years on: Aave alone now holds just over 50% of the $29.9 billion locked in Ethereum lending protocols, and the top four collectively account for around 89% (DefiLlama, accessed 30 August 2026), concentration at least as high as the 85% Qin *et al.* (2021) recorded across four protocols five years earlier. Losses have reached roughly $8 billion (Landsman *et al.*, 2026) despite existing audit spending. The economic problem is therefore not a lack of assurance activity but its limited conversion into confidence institutions can act on, precisely the gap an evaluation-layer capability such as Dimension 1 is positioned to close. |
| **Technological** | Composability extends risk assessment beyond a single contract's own code (Qian *et al.*, 2026), even as large language models grow more capable of interpreting that structure (Wei *et al.*, 2025) and growing on-chain data availability makes automated verification more practical. Together, this points to combining AI-generated reasoning with deterministic evidence, the approach Dimension 1 investigates rather than assumes will succeed. |
| **Legal** | MiCA has applied in full since December 2024 (European Union, 2023), but liability where an investor relies on an AI-supported assessment remains legally uncertain, a question only beginning to be studied (Libby and Witz, 2025). This strengthens the case for evidence that stays traceable rather than an opaque conclusion. |
| **Social** | Institutional trust still leans on a visible audit signal regardless of methodology (Piñeiro-Chousa, Šević and González-López, 2023), while trust in AI judgement depends on calibration rather than confidence (Lee and See, 2004), a design requirement for communicating evidence strength, not just conclusions. |
| **Environmental** | Carries limited strategic significance at this stage: Ethereum's footprint fell by around 99.99% post-Merge (Neumüller, 2023), leaving AI-inference cost a secondary concern. |

Together, these pressures show institutional demand for DeFi risk intelligence is real but constrained by unsettled trust, liability and technical standards, the space Dimension 1 is positioned to test rather than assume.

### 2.4 Internal and Strategic Position — SWOT

Applied in the sense standardised by Johnson, Scholes and Whittington (2008), distinguishing what ChainMill contributes from what that means for KOVA specifically, rather than treating KOVA as though it already had ChainMill's full organisational resources.

| | Point |
|---|---|
| **Strengths** | ChainMill contributes existing smart-contract security expertise and industry relationships; KOVA's prototype combines AI reasoning with independently generated deterministic evidence, producing a more transparent, reproducible assessment than model confidence alone. |
| **Weaknesses** | KOVA's capability has so far been tested only on selected lending protocols and covers only Dimension 1 of the nine dimensions the framework is intended to span; as a proof of concept it has no established customer base or track record beyond this dissertation, and evidence-fusion decisions become harder to interpret when sources strongly conflict (Zadeh, 1986). |
| **Opportunities** | Evidence-based AI security assessment for investor due diligence remains relatively underexplored; KOVA could extend beyond lending protocols to DEXs, bridges and other DeFi primitives as the prototype matures. |
| **Threats** | Established audit firms, automated scanners and formal-verification tools already serve investors in adjacent ways; as a new venture, KOVA must build credibility with an audience that may be reluctant to rely on an assessment method still at proof-of-concept stage. |

Read together, the Weaknesses and Opportunities rows describe the same underlying fact from two directions: KOVA's proof-of-concept status is simultaneously what limits it today and what leaves the evaluation-layer space open for it to occupy before an established player claims it. SWOT's box format tends to obscure that connection by listing strengths, weaknesses, opportunities and threats as though they were independent of one another.

### 2.5 Value Chain — Where KOVA Could Create Efficiency

Applying Porter's (1985) value-chain logic to the specific capability this dissertation builds and tests, the security-assessment industry's chain runs from contract development, through internal review, third-party audit, deployment, and post-deployment monitoring. Investment concentrates almost entirely on the audit stage — a discrete, billable, pre-deployment event. Dimension 1's proposed position sits instead at the *evaluation* layer: not producing new findings, but determining how much confidence an investor should place in findings that already exist. That is the entire premise being tested by this proof of concept — whether that evaluation-layer capability can be built, and whether it is something investors would value enough to adopt. That position is also the chain's most exposed: unlike an audit firm, which controls the artefact it sells, this evaluation layer depends entirely on the quality and availability of the underlying findings it assesses, so its output can only ever be as reliable as the reports that feed it.

### 2.6 Competitive Landscape — Porter's Five Forces

Applying Porter's (1980) framework to the market KOVA would enter — assessment aimed at investors and asset managers, rather than protocols or auditors themselves — the threat of new entrants is moderate: open-source LLM tooling lowers the barrier to surface-level review, but genuine deterministic validation keeps the real barrier higher than it first appears. Buyer power is high, since investors already have published audits, scanner reports and their own AI-assisted tools, so KOVA's assessment must add something those alternatives do not. Traditional audits and automated scanners are the closest substitutes, offering credibility or coverage but rarely reconciling findings against each other; formal verification remains the strongest guarantee but scales poorly. KOVA targets the gap between these — an evaluation layer none currently occupy — but as an unproven proof of concept, it has yet to demonstrate investors will value that positioning enough to adopt it. Of the five forces, buyer power is the most decisive constraint specifically for KOVA: switching cost is close to zero for an investor already receiving audit and scanner output at no additional charge, so the evaluation layer only earns adoption if its output measurably changes an allocation decision, not merely if it exists.

### 2.7 AI Maturity and Readiness

Assessed against Alsheibani, Cheung and Messom's (2019) descriptive–prescriptive–comparative framework, ChainMill's existing capability sits at an early descriptive stage: able to describe AI's use in security review, but not yet benchmark its reliability against independently gathered evidence at scale. KOVA's intended capability — combining AI reasoning with deterministic evidence and reporting confidence explicitly — targets the comparative end of that framework, the rarest and most mature stage it describes. Most published AI maturity models remain purely descriptive, offering a snapshot of current capability without a mechanism for acting on it; Witkowski and Wodecki (2026) treat this as a substantive gap in the literature and, building a dual-maturity model through the same Design Science Research paradigm this dissertation follows, deliberately design its second stage to be prescriptive rather than descriptive, generating cost-benefit-qualified improvement pathways instead of a static score. Interview and co-design work with ninety responsible-AI specialists across organisations reaches a similar conclusion from practice: even organisations actively working on AI governance struggle to operationalise maturity consistently, rather than treat it as a settled, benchmarkable state (Heger et al., 2025). That gap is precisely what this dissertation's evidence-fusion pipeline is built to close, though as a proof of concept it demonstrates feasibility rather than the validated, firm-level AI capability construct more mature organisations would need to claim (Mikalef and Gupta, 2021). Linear maturity models such as Alsheibani et al.'s assume steady, stage-by-stage progression, which understates what an evidence-fusion approach is attempting: rather than advancing through the prescriptive stage the way ChainMill's broader practice might, KOVA's Dimension 1 capability is designed to reach the comparative stage directly, by pairing AI output with deterministic evidence from the outset rather than first building confidence in AI reasoning alone.

### 2.8 Strategic Implications

The frameworks above converge on the same tension: KOVA's proposed differentiation rests on evidence quality and adoption behaviour it does not yet control, which is precisely what this dissertation sets out to test. Together, this analysis suggests KOVA needs an assessment capability that does more than generate plausible risk findings: one that pairs those findings with independently verifiable evidence, so investors and asset managers can see not just what a model concluded but how much that conclusion is worth trusting. That is the specific need this dissertation's research addresses — not by building KOVA into a finished product, but by investigating whether combining AI-generated probabilistic reasoning with independently gathered deterministic evidence can produce a more defensible, decision-useful risk assessment. Whether that capability translates into a viable product for KOVA remains an open question beyond this dissertation's scope.

**Word count: ~1,600 words including table text** (up from ~1,270; the increase reflects adding an original critical claim to each framework, PESTLE, SWOT, Value Chain, Five Forces, and AI Maturity, rather than applying each one purely descriptively)

---

## Reference List (Harvard Style)

Aguilar, F.J. (1967) *Scanning the Business Environment*. New York: Macmillan.

Alsheibani, S., Cheung, Y. and Messom, C. (2019) 'Towards an artificial intelligence maturity model: from science fiction to business facts', in *Proceedings of the 23rd Pacific Asia Conference on Information Systems (PACIS 2019)*.

Aziz, A. (2026) 'Venus Protocol Loses $3.7M in Thena Token Supply Cap Attack', *CoinMarketCap*, 15 March. Available at: https://coinmarketcap.com/academy/article/venus-protocol-loses-dollar37m-in-thena-token-supply-cap-attack (Accessed: 28 August 2026).

Behnke, R. (2026) 'Explained: The Venus Protocol Hack (March 2026)', *Halborn*, 23 March. Available at: https://www.halborn.com/blog/post/explained-the-venus-protocol-hack-march-2026 (Accessed: 27 August 2026).

Bourveau, T., Brendel, J. and Schoenfeld, J. (2024) 'Decentralized Finance (DeFi) assurance: early evidence', *Review of Accounting Studies*, 29, pp.2209–2253. https://doi.org/10.1007/s11142-024-09834-8

Chaliasos, S., Charalambous, M.A., Zhou, L., Galanopoulou, R., Gervais, A., Mitropoulos, D. and Livshits, B. (2024) 'Smart contract and DeFi security tools: do they meet the needs of practitioners?', in *Proceedings of the 46th International Conference on Software Engineering (ICSE '24)*. New York: ACM.

DefiLlama (2026) *Lending — Ethereum.* Available at: https://defillama.com/protocols/lending/ethereum (Accessed: 30 August 2026).

European Union (2023) Regulation (EU) 2023/1114 of the European Parliament and of the Council of 31 May 2023 on markets in crypto-assets (MiCA). *Official Journal of the European Union*, L 150, 9 June, pp.40–205. Available at: https://eur-lex.europa.eu/eli/reg/2023/1114/oj/eng (Accessed: 28 August 2026).

Heger, A.K., Passi, S., Dhanorkar, S., Kahn, Z., Wang, R. and Vorvoreanu, M. (2025) 'Towards a responsible AI organizational maturity model', *Proceedings of the ACM on Human-Computer Interaction*, 9(7), Article CSCW333. https://doi.org/10.1145/3757514

Johnson, G., Scholes, K. and Whittington, R. (2008) *Exploring Corporate Strategy: Text and Cases*. 8th edn. Harlow: Prentice Hall.

Kotzer, A., Azoulay, T., Abels, Y., Yaish, A. and Rottenstreich, O. (2026) 'SoK: DeFi lending and yield aggregation protocol taxonomy, empirical measurements, and security challenges', *IEEE Transactions on Network and Service Management*, 23, pp.4982–4997. https://doi.org/10.1109/TNSM.2026.3682174

Landsman, W., Lyandres, E., Maydew, E., Rabetti, D. and Zhang, C. (2026) 'Auditing smart contracts', *Journal of Accounting and Economics*, 101911. Available online 10 July 2026, in press. https://doi.org/10.1016/j.jacceco.2026.101911

Lee, J.D. and See, K.A. (2004) 'Trust in automation: designing for appropriate reliance', *Human Factors*, 46(1), pp.50–80.

Libby, R. and Witz, P.D. (2025) 'Artificial intelligence in auditing: how auditor AI use can mitigate legal liability', *Current Issues in Auditing*, 19(2), pp.P49–P59. https://doi.org/10.2308/CIIA-2024-029

Mikalef, P. and Gupta, M. (2021) 'Artificial intelligence capability: conceptualization, measurement calibration, and empirical study on its impact on organizational creativity and firm performance', *Information & Management*, 58(3), 103434. https://doi.org/10.1016/j.im.2021.103434

Neumüller, A. (2023) 'Ethereum's climate impact: a contemporary and historical perspective', *Cambridge Judge Business School*. Available at: https://www.jbs.cam.ac.uk/2023/ethereums-climate-impact-a-contemporary-and-historical-perspective/ (Accessed: 28 August 2026).

OWASP Smart Contract Security Project (2026) *OWASP Smart Contract Top 10: 2026*. Available at: https://scs.owasp.org/sctop10/ (Accessed: 28 August 2026). Licensed under CC BY-NC-SA 4.0.

Porter, M.E. (1980) *Competitive Strategy: Techniques for Analyzing Industries and Competitors*. New York: Free Press.

Porter, M.E. (1985) *Competitive Advantage: Creating and Sustaining Superior Performance*. New York: Free Press.

Piñeiro-Chousa, J., Šević, A. and González-López, I. (2023) 'Impact of social metrics in decentralized finance', *Journal of Business Research*, 158, 113673.

Qian, P., Cao, R., Liu, Z., Li, W., Li, M., Zhang, L., Xu, Y., Chen, J. and He, Q. (2026) 'Comprehensive review of smart contract and DeFi security: attack, vulnerability detection, and automated repair', *Expert Systems with Applications*, 291, 128431.

Qin, K., Zhou, L., Gamito, P., Jovanovic, P. and Gervais, A. (2021) 'An empirical study of DeFi liquidations: incentives, risks, and instabilities', in *Proceedings of the 21st ACM Internet Measurement Conference (IMC '21)*. New York: ACM, pp.336–350.

Venus Protocol (2026) 'THE Market Incident Post-Mortem'. Available at: https://community.venus.io/t/the-market-incident-post-mortem/5712 (Accessed: 27 August 2026).

Wei, Z., Sun, J., Sun, Y., Liu, Y., Wu, D., Zhang, Z., Zhang, X., Li, M., Liu, Y., Li, C., Wan, M., Dong, J. and Zhu, L. (2025) 'Advanced smart contract vulnerability detection via LLM-powered multi-agent systems', *IEEE Transactions on Software Engineering*, 51(10), pp.2830–2846.

Witkowski, A. and Wodecki, A. (2026) 'A prescriptive generative AI maturity model for new product development processes', *Journal of Manufacturing Technology Management*, 37(9), pp.40–63. https://doi.org/10.1108/JMTM-09-2025-0884

Woolard, C. (2026) *Wholesale Digital Markets Champion – First Report*. London: HM Treasury. Available at: https://www.gov.uk/government/publications/wholesale-digital-markets-champion-first-report/wholesale-digital-markets-champion-first-report (Accessed: 28 August 2026).

Zadeh, L.A. (1986) 'A simple view of the Dempster-Shafer theory of evidence and its implication for the rule of combination', *AI Magazine*, 7(2), pp.85–90.

---

## Notes

**What changed and why.** The previous version treated ChainMill itself as the sector-analysis subject, which overstated what this research actually examines — it is not an analysis of ChainMill's established consultancy operations. Restructured around the distinction you gave: ChainMill hosts the internship and supplies the industry context and expertise (2.1); KOVA is the actual venture the pipeline was built for — an AI-supported security-assessment product aimed at investors and asset managers doing DeFi due diligence, currently a proof of concept (2.2). Every subsequent framework (PESTLE, SWOT, Value Chain, Five Forces, AI Maturity) is now read through KOVA's specific opportunity rather than ChainMill's whole business, and a new closing section (2.8 Strategic Implications) ties the analysis back to why this dissertation's research question matters to KOVA specifically.

**What stayed honest.** Every KOVA-specific claim is hedged to what you've actually told me: it serves investors/asset managers, it is a proof of concept, its pipeline is what this dissertation tests. Nothing about funding, team size, competitors by name, launch timeline, or market traction is claimed, because none of that was given and inventing it would misrepresent an early-stage venture as more established than it is.

**Citations dropped.** Scharfman (2021) and Qiao et al. (2023) no longer had a sentence to attach to once the Competitive Landscape and Five Forces sections merged; Cornelli et al., Dempster (1967), Hall and Llinas (1997), Jöhnk et al. (2021), and Puyt et al. (2025) were already absent from the prior version and remain so.
