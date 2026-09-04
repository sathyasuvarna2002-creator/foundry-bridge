# INTRODUCTION
**Third person throughout. Heavy Harvard citation. ~1,050 words. Structured on the same five headings as the Methodology chapter, since the Introduction's job is partly to preview that argument before it is made in full.**

---

## Introduction

### Problem identification: validation and scoping

Decentralised finance lending protocols now secure more capital than most mid-sized national payment systems process in a year. Aave alone reports over $14.6 billion in total value locked and more than $3 trillion in cumulative assets supplied since launch (Aave, 2025), while DeFi lending as a category held over $78 billion in deposits by 2025 (eco.com, 2025). Losses have kept pace with growth rather than falling behind it: approximately $1.48 billion was drained from the ecosystem in 2024 (Hackread, 2024), and a further $3.1 billion in the first half of 2025 alone (Yellow.com, 2025). Chaliasos *et al.* (2024) trace a meaningful share of this loss — 127 attacks, $2.3 billion — to a specific and correctable weakness: the tools used to secure these protocols are evaluated in isolation from one another, with no established mechanism for reconciling what one method finds against what another confirms.

Two validation approaches currently dominate practice, and each carries a limitation the other does not share. Large language models can now review contract code with genuine competence — Wei *et al.* (2024) report an LLM-based auditing framework catching complex logic vulnerabilities that conventional static analysis tools overlook, and Hu *et al.* (2023) show that separating an LLM's generation and discrimination roles measurably reduces false positives. What an LLM cannot do, however structurally rather than incidentally, is execute the contract it is reading. It can identify that a pattern resembles a known vulnerability class; it cannot confirm that pattern is reachable, authorised, or exploitable against the contract's actual deployed state. Formal verification addresses precisely that gap, but the literature is consistent on its cost: verification scales poorly as contract complexity increases, and the specialist theorem-proving expertise it requires is, in practice, the binding constraint on its use rather than the underlying vulnerability being verified.

The question this raises has, to date, gone largely unanswered rather than merely under-answered: when an AI-generated risk assessment and an independently gathered piece of deterministic evidence disagree, what is supposed to happen to that disagreement? The default answer in most current practice is that it disappears — folded into a single blended confidence figure, or resolved by simply preferring whichever source the analyst trusts more. Neither response treats the disagreement as informative. This research treats it as the central object of study.

### Solution objectives: aim and success criteria

The aim of the research is to design, build, and empirically evaluate a methodology capable of combining AI-generated risk assessments with independently derived deterministic evidence in a way that preserves genuine disagreement between the two, rather than concealing it through averaging or arbitrary preference.

Four criteria were set against which the resulting artefact would be judged. First, independence: the deterministic evidence layer must not be derivable from the AI layer's own reasoning, since treating a model's citation of its own source-code reading as independent proof would violate the basic non-redundancy requirement long established in the multisensor fusion literature (Hall and Llinas, 1997). Second, conflict preservation: where the two sources disagree, that disagreement must be a reported, measurable quantity rather than an artefact absorbed into a single number. Third, empirical grounding: the methodology would be tested against live, economically material protocols rather than synthetic benchmarks, following Chaliasos *et al.*'s (2024) finding that benchmark performance is a weak predictor of real-world tool behaviour. Fourth, decision-usefulness: in line with the trust-calibration literature (Lee and See, 2004; Zhang, Liao and Bellamy, 2020), the resulting confidence figure was required to support appropriately calibrated human judgement, not to imitate a calibrated probability of ground-truth correctness it cannot actually claim.

### Design and development: tools, data and approach

The research was conducted as design science, in the sense set out by Hevner *et al.* (2004) and operationalised by Peffers *et al.* (2007): the primary output is a purposeful artefact, evaluated through its performance against a defined problem, rather than a hypothesis tested against a population. Three case protocols were selected — Aave V3, Venus Protocol, and Compound V2 — under a multiple-case logic (Yin, 2014) that required at least one case chosen specifically to diverge from the others rather than to confirm a uniform result. Compound, whose evidentiary rules are deliberately stricter than Aave's or Venus's, served that function.

The artefact itself comprises three evidence layers held structurally apart: an AI reasoning layer that proposes risks and self-assigns confidence from source code alone; a deterministic layer that independently rediscovers each claim through source-code predicate matching, live on-chain queries, and Foundry-executed behavioural tests run against forked mainnet and BNB Chain state (Foundry-rs, 2024); and a fusion layer that combines the two using Dempster-Shafer evidence theory (Dempster, 1967; Shafer, 1976), which represents each source's assessment as mass distributed across three propositions — real, not real, inconclusive — and computes disagreement between sources as an explicit, reportable quantity.

### Demonstration and evaluation: real and simulated scenarios

The methodology was demonstrated by running the complete three-layer pipeline against all three case protocols, producing twenty independently fused findings across access control, upgradeability, economic dependency, and asset-custody risk categories. Evaluation drew primarily on real rather than simulated evidence: Venus's asset-custody finding, for instance, was tested by executing a genuine token transfer directly against a forked instance of the deployed contract and observing the resulting shift in live exchange-rate accounting, rather than by modelling that shift hypothetically. Not every claim tolerated this treatment — authorised interest-rate changes, for example, could not safely be rehearsed against live market conditions, and are evaluated for authorisation only, with the downstream behavioural claim reported as open rather than assumed. One finding, Aave's Umbrella deficit-authority risk, produced a measured conflict of *K* = 0.225 under Dempster's combination rule (Dempster, 1967), against near-zero conflict everywhere else in the dataset — evidence that the fusion mechanism surfaces disagreement precisely where it exists, rather than manufacturing it or concealing it.

### Methodological limitations

The research does not claim, and should not be read as claiming, that a higher fused confidence score corresponds to a higher probability of real-world correctness; no ground-truth benchmark exists for these live, still-evolving protocols against which such a claim could be tested (Zhang, Liao and Bellamy, 2020). Dempster's combination rule is itself not beyond challenge — Zadeh (1986) demonstrated conditions under which it produces counter-intuitive results under high conflict, a critique this research's low conflict scores limit exposure to without eliminating. The deterministic layer, moreover, validates only what the AI layer raises in the first instance; it does not perform independent hazard discovery, a constraint discussed further in the Discussion chapter. These limitations are stated here, at the outset, rather than reserved for the closing pages, because the contribution being claimed is deliberately narrower than "a better way to find smart contract risks." It is a way of handling disagreement once a risk has already been raised — a smaller claim, but one the evidence presented in this dissertation supports.

---

## Reference List (Harvard Style)

Aave (2025) *Aave 2025 Year in Review*. Available at: https://aave.com/blog/aave-2025-recap (Accessed: 20 August 2026).

Chaliasos, S., Charalambous, M.A., Zhou, L., Galanopoulou, R., Gervais, A., Mitropoulos, D. and Livshits, B. (2024) 'Smart contract and DeFi security tools: do they meet the needs of practitioners?', in *Proceedings of the 46th International Conference on Software Engineering (ICSE '24)*. New York: ACM.

Dempster, A.P. (1967) 'Upper and lower probabilities induced by a multivalued mapping', *Annals of Mathematical Statistics*, 38(2), pp.325–339.

eco.com (2025) *Best DeFi Lending Protocols 2026: TVL, Rates, Risk Compared*. Available at: https://eco.com/support/en/articles/15254000-best-defi-lending-protocols-2026-tvl-rates-risk-compared (Accessed: 20 August 2026).

Foundry-rs (2024) *Foundry Book: Fork Testing*. Available at: https://getfoundry.sh/guides/fork-testing (Accessed: 20 August 2026).

Hackread (2024) *Hackers Drain $1.48 Billion from Crypto in 2024, Led by DeFi Exploits*. Available at: https://hackread.com/hackers-drain-billions-crypto-2024-led-defi-exploits/ (Accessed: 20 August 2026).

Hall, D.L. and Llinas, J. (1997) 'An introduction to multisensor data fusion', *Proceedings of the IEEE*, 85(1), pp.6–23.

Hevner, A.R., March, S.T., Park, J. and Ram, S. (2004) 'Design science in information systems research', *MIS Quarterly*, 28(1), pp.75–105.

Hu, S., Huang, T., Ilhan, F., Tekin, S.F. and Liu, L. (2023) 'Large language model-powered smart contract vulnerability detection: new perspectives', in *Proceedings of the 2023 IEEE International Conference on Trust, Privacy and Security in Intelligent Systems and Applications (TPS-ISA)*. IEEE.

Lee, J.D. and See, K.A. (2004) 'Trust in automation: designing for appropriate reliance', *Human Factors*, 46(1), pp.50–80.

Peffers, K., Tuunanen, T., Rothenberger, M.A. and Chatterjee, S. (2007) 'A design science research methodology for information systems research', *Journal of Management Information Systems*, 24(3), pp.45–77.

Shafer, G. (1976) *A Mathematical Theory of Evidence*. Princeton, NJ: Princeton University Press.

Wei, Z., Sun, J., Zhang, Z., Zhang, X., Li, M. and Hou, Z. (2024) 'LLM-SmartAudit: advanced smart contract vulnerability detection', *arXiv preprint* arXiv:2410.09381.

Yellow.com (2025) *Why DEX Exploits Cost $3.1B in 2025: Analysis of 12 Major Hacks*. Available at: https://yellow.com/research/why-dex-exploits-cost-dollar31b-in-2025-analysis-of-12-major-hacks (Accessed: 20 August 2026).

Yin, R.K. (2014) *Case Study Research: Design and Methods*. 5th edn. Thousand Oaks, CA: Sage.

Zadeh, L.A. (1986) 'A simple view of the Dempster-Shafer theory of evidence and its implication for the rule of combination', *AI Magazine*, 7(2), pp.85–90.

Zhang, Y., Liao, Q.V. and Bellamy, R.K.E. (2020) 'Effect of confidence and explanation on accuracy and trust calibration in AI-assisted decision making', in *Proceedings of the 2020 Conference on Fairness, Accountability, and Transparency (FAT\* '20)*. New York: ACM, pp.295–305.

---

## Notes on how this was written

**Same critical-thinking standard as the revised Methodology paragraph.** The closing lines of the Solution Objectives and Methodological Limitations sections both do the same move: state plainly what is *not* being claimed, before anyone has to ask. "This is a smaller claim, but one the evidence presented in this dissertation supports" is doing real work — it pre-empts the most obvious examiner pushback (that the project overreaches) by naming and bounding the contribution itself, rather than letting the reader arrive at that boundary unassisted.

**Every number in the opening paragraph is load-bearing.** Each statistic sets up a specific claim used later — the TVL figures establish stakes, the loss figures establish that the problem is current and unsolved, and the Chaliasos *et al.* (2024) figure specifically sets up the tool-isolation gap this research addresses. None of them are decorative.

**The Introduction previews the Methodology's own argumentative structure** — naming Compound as a falsification case, not just a third data point — so a reader who continues to the Methodology chapter meets an argument they were already primed for rather than one starting cold.

**Next step:** this and the Methodology chapter now share vocabulary and citations almost entirely, which is deliberate — an Introduction that promises one thing and a Methodology that delivers something differently framed is one of the more common weaknesses examiners flag. Read them back to back once both are in your own words, and check the promise made here is the one actually kept there.
