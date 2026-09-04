# ERA fix v2 — distinguish mechanical ceiling effects from genuine evidentiary corrections

No wiring or schema change this time — just a refinement to Step 6 of the system prompt (the
one added in the last patch). ERA is currently treating every "fused belief > Node 07's raw
confidence" case as if it were a meaningful correction, when most of them are a proven
mathematical artifact (Section G of the design doc: when Node 16 shows strong, uncontested
support, the fused belief lands near a ceiling almost regardless of what Node 07's confidence
was).

## In the system prompt, find Step 6's paragraph starting "Say whether these three views
broadly agree..." and the two bulleted situations that follow it. Add a third bullet after them:

```
- **The fused belief landed near the deterministic support level almost regardless of Node
  07's confidence.** When Node 16 shows strong, uncontested support (few or no contradicted
  propositions, K=0 or close to it), the fusion math mechanically pulls the result toward that
  support level -- this happens even when Node 07's confidence was already high, and the size
  of the resulting "increase" mostly reflects how close Node 07's confidence already was to
  that ceiling, not new evidentiary weight. Do NOT describe this as "deterministic grounding
  increased confidence" as if it were a finding-specific correction. Instead say plainly that
  the shift is small and expected given how much deterministic support existed, and reserve
  language like "meaningfully corrected" or "materially raised confidence" for cases where
  Node 07's original confidence was substantially below what the deterministic evidence alone
  would justify -- a large gap, not a small one, and ideally not a gap that looks identical
  across many other findings with similar deterministic support levels (if several findings
  show the same small upward nudge, that repetition is itself a sign you're looking at the
  structural ceiling effect, not several independent corrections).
```

And update the worked F11 example immediately below (keep it, but add one sentence
distinguishing it explicitly from the ceiling-effect case):

```json
{
  "fusion_comparison_note": "Node 07 originally rated this finding at only 0.60 confidence, reflecting that the evidence for operational/governance correctness is inherently harder to verify from code alone. Node 16's deterministic check found strong support (3 of 4 propositions confirmed, none contradicted). Node 17's mathematical fusion combined these into a belief range of [0.90, 1.00] with a single BetP value of 0.95 -- meaningfully higher than Node 07's original number, and outside the range Node 07 alone would have implied. Unlike findings where Node 07 was already confident (0.90+) and the fused belief only nudged up a few hundredths as an expected ceiling effect, here the gap (0.35) is large and Node 07's own uncertainty was genuine -- this is a case where deterministic grounding meaningfully changed the conclusion, not just confirmed one Node 07 already held."
}
```

That's the whole change -- one new bullet, one added sentence in the existing example. Paste
into the system message, rerun, and send me the new output.
