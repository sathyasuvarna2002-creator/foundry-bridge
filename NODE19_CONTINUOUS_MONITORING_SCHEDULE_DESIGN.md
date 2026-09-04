# Continuous monitoring via Schedule Trigger — design note

**Status: design, not yet wired in n8n.** This describes how Node 19 becomes an
unattended, continuously-running check rather than a check you have to trigger
by hand. Nothing below has been built yet — this is the plan, written up so it
can be shared as-is.

## What's already true, without any scheduling

Node 19 does not cache or remember anything between runs. Each time it runs,
it computes `days_open` fresh: today's date (read live, at execution time)
minus `date_flagged` (a fixed fact pulled verbatim from the audit document by
Node 08). So the number is always correct whenever the workflow happens to
run — it doesn't drift or go stale between runs. What's missing is *automatic
execution*: right now, nothing runs the workflow except a person triggering it
manually.

## What the Schedule Trigger adds

An n8n **Schedule Trigger** node (cron-based — e.g., daily at a fixed time)
replaces the manual trigger at the front of the workflow. On each firing, it
runs the full chain end to end: Node 06 → 07 → 13 → Foundry evidence → Node 16
(deterministic anchor), in parallel with Node 08 (audit ingestion, re-reading
whatever audit documents are in scope) → Node 19 (merge on `claim_id`).

The effect: Node 19's `is_still_open`, `days_open`, and
`status_changed_since_disposition` fields get recomputed automatically, on a
fixed cadence, without anyone remembering to run it. That's what makes the
day-count and current-status check "continuous" rather than "on request."

## What this does *not* include

No persisted run history. Each firing reports the *current* state only — it
does not log "on this date the status was X, on that date it changed to Y."
Without a data store, the schedule gives you an always-current answer, not a
trend line or change-log across runs.

This is a deliberate scope boundary, not an oversight: adding persistence
means adding a database to what has so far been a stateless pipeline, and
that tradeoff hasn't been decided. If a trend/change-log view is wanted later,
it's a named Phase 2 addition (a claims table plus a run-history table, as
discussed separately) — not something silently missing from this design.

## Why this still satisfies the "track dismissed findings over time" ask

Jerry's Dimension 1 scope asks for dismissed findings to be tracked over
time. A scheduled, unattended re-check that always reports an accurate,
live day-count and current disposition status meets that ask directly, even
without a persisted history. What it does not yet provide is retrospective
visibility ("show me when this changed") — that's explicitly future work,
consistent with how block-height replay was scoped out earlier: named and
deferred, not quietly absent.

## Mechanical summary

1. Replace the workflow's manual trigger with a Schedule Trigger node (cron
   expression sets the cadence — daily is the natural default).
2. No other node changes required. Node 08, Node 16, and Node 19 all already
   recompute from scratch on every execution — the schedule just decides how
   often "every execution" happens.
3. Each firing produces a complete, independent, correct snapshot. Continuity
   comes from the cadence, not from memory of prior runs.
