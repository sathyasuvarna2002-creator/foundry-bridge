# METHODOLOGY
**Third person, no first person pronouns, narrative flow, heavy Harvard citation. ~1,550 words.**

---

## Methodology

The research did not begin with a plan to build a fusion pipeline. It began with a narrower, almost naive question: could a large language model read Aave's contracts, flag the risks it saw, and simply be checked for accuracy? Two weeks into that exercise, the question itself started to look wrong. The model was rarely simply right or simply wrong. It was confident about things the evidence only partly supported, and cautious about things the evidence supported completely. That mismatch — not the model's raw accuracy — turned out to be the more interesting object of study, and the shape of the project changed accordingly.

### A design science framing, tested across three cases

Because the eventual output of the work is an artefact rather than a tested hypothesis, the research sits more comfortably within design science than within a conventional empirical study. Peffers *et al.* (2007) set out six activities for this kind of work — problem identification, definition of objectives, design and development, demonstration, evaluation, and communication — and this project follows that sequence in substance if not always in the paper's exact order. Hevner *et al.* (2004) add a further requirement that shaped how the study was structured: rigour must be visible in both construction and evaluation, since design science submissions are commonly criticised for over-describing the build and under-describing how it was tested (Hevner *et al.*, 2004; March and Smith, 1995).

Three protocols were selected for evaluation — Aave V3, Venus Protocol, and Compound V2 — rather than one. Yin's (2014) rationale for multiple-case designs rests on testing two kinds of prediction simultaneously: cases expected to behave similarly, which Yin terms literal replication, and cases expected to diverge for identifiable reasons, termed theoretical replication. Aave and Venus, as architecturally similar lending protocols, were expected to produce broadly comparable evidence patterns; Compound, whose evidentiary threshold is deliberately stricter, was expected to diverge in a specific and explicable way. Both predictions held, and the divergence in Compound's case turned out to be one of the more instructive results in the Findings chapter, since it demonstrates that a stricter rule produces more conservative numbers without implying weaker underlying security.

### Three evidence layers, kept structurally apart

The pipeline is organised into three layers, and the separation between them proved to be the single design decision on which everything else depended.

| Layer | Evidence it draws on | Evidence it is denied access to |
|---|---|---|
| AI risk reasoning | Contract source code, architecture documentation | Live chain state, executed test outcomes |
| Deterministic validation | Deployed bytecode, on-chain state, executed Foundry tests | The reasoning or confidence scores produced by the AI layer |
| Evidence fusion | The outputs of both layers, represented as weighted mass | No new evidence — combination only |

The first layer consists of an LLM agent reading a protocol's contracts and producing a set of proposed risks, each carrying a self-assigned confidence score. This stage draws conceptually on the multi-agent auditing work of Wei *et al.* (2024), whose LLM-SmartAudit framework outperforms conventional static analysis on complex logic vulnerabilities, and on Hu *et al.*'s (2023) GPTLens, which separates generation from discrimination to reduce false positives. A single-pass reasoning agent was used here rather than an adversarial generator-critic pair, since the deterministic layer already performs a comparable critical function; duplicating that role within the AI layer itself was judged unnecessary.

The second layer performs the actual verification, through three distinct mechanisms. Source-code predicates confirm whether the mechanism an AI-proposed finding describes is genuinely present in the contract, rather than merely plausible or implied. Live queries against the deployed contract — executed through Foundry's `cast` utility — confirm configuration parameters directly from chain state rather than from documentation, which may lag behind what is actually deployed. Foundry's fork-testing capability then allows a written test to execute against a snapshot of genuine mainnet or BNB Chain state, a distinction the Foundry documentation itself emphasises: a testnet can confirm that a function reverts under a given condition, but only a forked mainnet snapshot exposes a test to an actual, currently live oracle price or an actual pool of borrowed liquidity (Foundry-rs, 2024). The most consequential evidence produced across the three case protocols originates from this fork-testing step specifically.

Maintaining the boundary between these layers was harder in practice than the design implies. During early development, several source-code citations generated by the AI layer were inadvertently carried into what was intended to be independently derived evidence — a violation of the basic principle, established in the classical multisensor fusion literature, that fused sources must be genuinely non-redundant rather than the same evidence counted twice (Hall and Llinas, 1997). Identifying and correcting that leakage was a turning point in the project's development, since it forced a stricter separation between what the AI layer asserts and what the deterministic layer independently rediscovers.

### Combining the two sources without erasing disagreement

An initial version of the pipeline combined the two confidence scores through simple averaging. The limitation of that approach became apparent quickly: averaging discards precisely the information most worth preserving. Where an AI assessment sits at 90 per cent confidence and the deterministic evidence agrees with only half of that, an average reports something close to 70 per cent — a figure that reads as mild uncertainty when it in fact represents a substantive disagreement between two independent sources, a distinction the trust-calibration literature treats as consequential rather than cosmetic (Lee and See, 2004; Zhang, Liao and Bellamy, 2020).

Dempster-Shafer evidence theory (Dempster, 1967; Shafer, 1976) was adopted instead. Rather than forcing evidence into a binary of true or false, each source distributes weight across three propositions: that the risk is real, that it is not, and that the evidence is inconclusive. Where two sources' weights fall on opposing conclusions, Dempster's rule of combination computes that overlap as an explicit conflict measure, conventionally denoted *K*, rather than folding it into the fused result. The rule is not without established critique — Zadeh (1986) demonstrated a case in which Dempster's normalised combination produces counter-intuitive results under high, non-total conflict, and this critique continues to be cited in the subsequent literature on evidence combination. Conflict values across the twenty findings evaluated in this study remained close to zero in all but one case, which limits, though does not eliminate, exposure to the failure mode Zadeh (1986) identifies.

That single exception concerns Aave's Umbrella deficit-authority finding, and it is worth treating as the clearest demonstration that the fusion mechanism performs as intended. The AI layer assigned high confidence to the risk; the deterministic layer's evidence supported it only partially. The resulting conflict measure, *K* = 0.225, stands well above every other finding in the dataset and is reported rather than smoothed into an average — precisely the behaviour the method was selected to produce.

### Divergent evidentiary standards across the three protocols

The three case protocols were not evaluated under identical rules, and that asymmetry is deliberate rather than an inconsistency requiring correction. For Aave and Venus, a matched source-code predicate is treated as genuine supporting evidence within the deterministic layer. For Compound, a source-code match alone establishes only a provisional status pending independent execution — a stricter evidentiary bar included specifically to test how the fusion methodology behaves under tighter proof requirements. The consequence is that Compound's reported confidence scores appear more conservative than those of the other two protocols, even in instances where the underlying testing was equally thorough. This should not be read as evidence that Compound's contracts are less secure; it reflects a difference in how much independent confirmation was required before a finding was permitted to count as settled, a distinction that must accompany any cross-protocol comparison of the reported figures.

### Sourcing and triangulation

Primary evidence throughout consists of the deployed, verified source code of each protocol together with live on-chain state retrieved at the moment each pipeline run was executed. Independently published third-party audits were incorporated as a secondary cross-check rather than a primary evidentiary source — including the StErMi review of Aave v3.3 and CertiK's published Venus assessments — following Yin's (2014) argument that triangulating across independently sourced evidence strengthens case-study validity beyond what any single source, however thorough, can provide on its own. This combination of primary contract-level evidence and secondary published audit material is consistent with the broader empirical pattern identified by Chaliasos *et al.* (2024), whose review of DeFi security practice found that tools evaluated in isolation, without a mechanism for reconciling their outputs against one another, offer a weaker basis for confidence than tools whose findings are cross-checked systematically.

---

## Reference List (Harvard Style)

Chaliasos, S., Charalambous, M.A., Zhou, L., Galanopoulou, R., Gervais, A., Mitropoulos, D. and Livshits, B. (2024) 'Smart contract and DeFi security tools: do they meet the needs of practitioners?', in *Proceedings of the 46th International Conference on Software Engineering (ICSE '24)*. New York: ACM.

Dempster, A.P. (1967) 'Upper and lower probabilities induced by a multivalued mapping', *Annals of Mathematical Statistics*, 38(2), pp.325–339.

Foundry-rs (2024) *Foundry Book: Fork Testing*. Available at: https://getfoundry.sh/guides/fork-testing (Accessed: 20 August 2026).

Hall, D.L. and Llinas, J. (1997) 'An introduction to multisensor data fusion', *Proceedings of the IEEE*, 85(1), pp.6–23.

Hevner, A.R., March, S.T., Park, J. and Ram, S. (2004) 'Design science in information systems research', *MIS Quarterly*, 28(1), pp.75–105.

Hu, S., Huang, T., Ilhan, F., Tekin, S.F. and Liu, L. (2023) 'Large language model-powered smart contract vulnerability detection: new perspectives', in *Proceedings of the 2023 IEEE International Conference on Trust, Privacy and Security in Intelligent Systems and Applications (TPS-ISA)*. IEEE.

Lee, J.D. and See, K.A. (2004) 'Trust in automation: designing for appropriate reliance', *Human Factors*, 46(1), pp.50–80.

March, S.T. and Smith, G.F. (1995) 'Design and natural science research on information technology', *Decision Support Systems*, 15(4), pp.251–266.

Peffers, K., Tuunanen, T., Rothenberger, M.A. and Chatterjee, S. (2007) 'A design science research methodology for information systems research', *Journal of Management Information Systems*, 24(3), pp.45–77.

Shafer, G. (1976) *A Mathematical Theory of Evidence*. Princeton, NJ: Princeton University Press.

Wei, Z., Sun, J., Zhang, Z., Zhang, X., Li, M. and Hou, Z. (2024) 'LLM-SmartAudit: advanced smart contract vulnerability detection', *arXiv preprint* arXiv:2410.09381.

Yin, R.K. (2014) *Case Study Research: Design and Methods*. 5th edn. Thousand Oaks, CA: Sage.

Zadeh, L.A. (1986) 'A simple view of the Dempster-Shafer theory of evidence and its implication for the rule of combination', *AI Magazine*, 7(2), pp.85–90.

Zhang, Y., Liao, Q.V. and Bellamy, R.K.E. (2020) 'Effect of confidence and explanation on accuracy and trust calibration in AI-assisted decision making', in *Proceedings of the 2020 Conference on Fairness, Accountability, and Transparency (FAT\* '20)*. New York: ACM, pp.295–305.

---

## A brief note on the rewrite

Every first-person pronoun has been replaced with the research, the study, the project, or the artefact as the grammatical subject — standard convention for most UK postgraduate submissions, and this framing tends to read as more authoritative to examiners in any case. The narrative structure is retained: the false start with simple accuracy-checking, the discovery that disagreement mattered more than correctness, the accidental evidence leak and its correction, the rejected averaging approach, and the F05 case as the payoff. Sentence length still varies deliberately, and citation density has been raised again per this request, spread across roughly one supporting reference every two to three sentences rather than clustered.

As before: no amount of stylistic rewriting guarantees a particular AI-detector score, since these tools score statistical fingerprints rather than comprehension. The most reliable way to reduce a flagged score, and the only way to satisfy the university's own declaration that submitted work is the student's own, is to retype key passages by hand in your own phrasing once the structure and citations above are confirmed to be right.
