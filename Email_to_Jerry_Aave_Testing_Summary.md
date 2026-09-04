Subject: Aave Testing — Where Things Stand (ahead of Wednesday)

Hi Jerry,

Before Wednesday, I wanted to walk you and your CTO through what I've been building on the Aave side, so the live walkthrough makes sense instead of me explaining terms as we go.

The starting point was something that had been bothering me: when you ask an AI to look at a smart contract and tell you if it's safe, it gives you a confident-sounding answer, and there's not really a way to check whether that confidence is earned. So I tried building something where the AI's reasoning has to actually be checked against something outside itself, rather than just taking its word for it. I don't think I've fully solved that problem, but I think the approach is a reasonable step toward it, and that's really what I want your and your CTO's read on.

Quick rundown of how it works, start to finish:

- Evidence collection — pull the real architecture out of Aave's source code, no risk judgments yet
- Risk reasoning — flag architectural risks, constrained to only what the evidence actually supports
- Exploit matching — check each risk against real, documented past hacks for precedent
- Deterministic validation — Foundry tests that pass or fail against the real contracts, no AI involved
- Calibration — combine the AI's confidence with the test results into one honest number

A bit more detail on each below.

The first step is evidence collection, and I kept this part deliberately narrow — an AI reads Aave's actual contract source and just extracts the architecture as it is: what each contract does, who controls what, what it depends on. No risk judgments at this stage, everything has to tie back to a real line of code. I leaned on this being strict because everything after it depends on it being right.

From there, a second AI reasons about where the architectural risks actually are — things like a single address controlling upgrades, or a dependency on an external price feed. I tried to constrain it so it can only flag something the architecture actually supports, though I'll be honest, this is the stage I trust the least, since it's still fundamentally a language model making a judgment call.

Next, I check each of those risks against real, documented exploits, to see if there's a precedent — a case where a similar setup actually got exploited before. This felt important because a "theoretical risk" and "a pattern that has actually caused a loss" are pretty different things, and I didn't want to blur that.

The part I think matters most is the next one: deterministic validation. Instead of just trusting the AI's reasoning, I wrote automated tests, using Foundry, that run directly against Aave's real contracts and either support or contradict what the AI claimed. These give a plain pass or fail, no interpretation involved — which is really the whole point, since it's the one part of the pipeline that isn't just another AI opinion.

Last piece is where the math comes in, and I want to be upfront that this is the part I'm least confident is fully right. I combined the AI's confidence with what the deterministic tests actually showed using something called Dempster-Shafer combination — a way of merging two different kinds of evidence into one number, that's also honest about it when the two sources disagree instead of quietly averaging over it.

In plain terms, the formula is basically:

Final confidence = (what the AI believed × what the tests showed) ÷ (1 − how much they disagreed)

So when the AI and the tests agree, the combined score lands close to both of them, which is what you'd want. When they disagree, that disagreement doesn't just get smoothed over — it shows up as its own separate number in the output, so it's actually visible where the AI and the real tests didn't line up, instead of that friction getting buried inside one clean-looking score. I think the logic holds, but I'd genuinely like your and your CTO's eyes on whether that's the right way to combine them.

None of this worked cleanly the first time. I went through several rounds of running it, checking the actual output against what it should have said, finding real problems — labels not matching the underlying data, wording that claimed more than the evidence actually supported, scores that weren't varying the way they should have — and fixing each one before moving on. The report itself went through two review passes before I felt okay sharing it.

Where it landed, across Aave:

- 11 architectural risks surfaced — upgrade control, oracle dependency, governance concentration, and a few around asset custody
- 9 fully or partially backed up by the deterministic tests
- 2 contradicted outright

I don't take that as proof the framework works — if anything, the 2 contradictions are the more interesting result, since they're a reminder the AI stage still gets things wrong on its own.

This whole direction came out of the feedback you gave me earlier about not trusting AI confidence by itself, and this is my attempt at actually building toward that. I don't think it's finished, and I'd rather hear where you and your CTO think it's weak than just present it like it's a solved problem.

Looking forward to going through it together Wednesday.

Sathya
