# Node 13 Changes — Plain-Language Summary

## 3. Aave now reads the audit agent too (v2.4/2.5 → v2.6)

**File:** `13_deterministic_evidence_specification.js`

**What was wrong:** Node 08 (the audit/incident ingestion agent, reading real
audit reports like the StErMi Aave v3.3 audit) was already wired up and
producing output, but Node 13 never read it — only Node 07's live-contract
reasoning fed into the spec. Node 08's own design doc says its findings are
supposed to be unioned with Node 07's before Node 13 processes either. That
union was never actually built for Aave, exactly the same gap Venus had
before its own v1.1 fix.

**What I changed:** Node 13 now reads both Node 07 and Node 08, resolves
each finding to one of the 11 fixed Aave findings (F01-F11), and merges the
two sources when they land on the same finding — keeping both sides'
evidence, severity, and claim_id side by side rather than overwriting one
with the other. Node 07 still resolves the way it always did (it already
tells you which F0x finding it means). Node 08 doesn't know Aave's F01-F11
list at all, so it resolves by checking whether the specific function/
variable names it quoted (like `eliminateReserveDeficit` or
`initReserve`) match a fixed list built from function names already
verified against the real Aave source, one list per finding. If a Node 08
finding's names match more than one finding's list, it's flagged for manual
review instead of guessing — same rule used everywhere else in this file.

**Two things worth knowing, not bugs:**

1. Two of the eleven findings (F01, F02 — proxy upgrades and registry
   centralisation) don't have a pre-verified function-name list to draw on,
   because nothing else in this file happens to need one for them. Their
   lists are reasoned from how Aave is generally known to work, not checked
   against the actual deployed contracts the way the other nine were. Said
   plainly in the file so it isn't mistaken for equally solid.
2. Node 07 doesn't produce a `claim_id` at all (only Node 08 does), so when
   you look at a merged finding, the Node 07 side's claim_id will always be
   blank. That's expected, not a missing-data bug.

**How I know it works:** Ran it against synthetic data covering all four
outcomes — a finding only Node 07 flagged, a finding both flagged (which
correctly merged, keeping the higher severity), a Node 08 finding that
matched nothing, and a Node 08 finding whose names matched two findings at
once (correctly flagged instead of guessed). Also confirmed a missing Node
08 (or any other upstream node) just means "nothing to add," not a crash.

---

Two things got changed tonight. Here's what happened and why, in plain terms.

---

## 1. Fixed a crash risk in the Aave version

**File:** `13_deterministic_evidence_specification.js`

**What was wrong:** This code reads data from 4 other nodes at the start. It
assumed all 4 would always be there and working. If one of them didn't run
(like when we deleted the temporal-evidence node because the BSC API access
broke), this code would crash instead of just continuing without it.

**What I changed:** Added a small safety check around those 4 reads. Now if
one of those nodes is missing, this code just treats it as "no data" and
keeps going, instead of crashing.

**How I know it works:** Ran it after deleting the temporal node. No crash.
The temporal-related fields just came back empty, which is correct.

**Also confirmed (not a bug, just worth knowing):** This Aave file will
never match Venus findings, on purpose. It only recognizes Aave's exact 11
finding names. When we ran it against real Venus data, all 6 findings came
back "unmapped" — that's the code correctly refusing to guess, not a
malfunction. This is why we built a separate file for Venus (below).

---

## 2. Built a new file for Venus

**File:** `13_deterministic_evidence_specification_venus.js` (brand new)

**Why Venus needed its own file:** Aave's findings always have the same
names every time (F01, F02, etc.), so matching is easy — just compare
strings. Venus's findings don't work that way. The same underlying issue
got 3 different names across 3 different runs earlier this session. So
name-matching doesn't work for Venus — we needed a different approach.

**What this file does instead:** Instead of matching by name, it matches by
checking if specific function names (like `getCashPrior` or
`_setImplementation`) show up in the finding's evidence. These function
names don't change between runs, even if the finding's title does.

It covers 6 Venus risk areas: implementation upgrades, Comptroller
dependency, interest rate model dependency, the donation-attack cash issue,
access control, and reserve reduction.

For 5 of those 6, we already have real Foundry test results from tonight
(actual `forge test` runs, not guesses), so this file reports real
PASS/FAIL instead of just "not tested yet." The 6th one (reserve reduction)
honestly says "not tested" because no test exists for it yet.

**Two mistakes I found and fixed while checking this against real data:**

1. I forgot to include the donation-attack test result in the "known
   results" list. I'd assumed it would come from a different, automated
   source, but it actually came from the same kind of manual test run as
   the other four. Without this fix, that finding would have wrongly shown
   "not tested" even though we have a real, passing result for it.

2. One function name was missing an underscore (`reduceReservesFresh`
   instead of the real `_reduceReservesFresh`). Small typo, but it means
   an exact match, so it needed to be exact.

**How I know it works now:** Ran it against real data pulled from the
actual pipeline. All 6 findings matched correctly, no mix-ups, no
unmatched ones. 5 of 6 show real passing test results. The 1 without a
test honestly says so instead of faking a result.

**One thing to fix later:** Part of this file guesses the name of a future
node that doesn't exist yet (for automatically pulling in more test
results). That name is just a placeholder — update it once that node
actually exists.
