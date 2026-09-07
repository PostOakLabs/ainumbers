---
type: DecisionTool
title: "Consultation Response Tracker"
description: "Open/closed roll-up over a caller-declared set of regulatory consultations against a declared as-of date: open count (a consultation whose closes date equals as_of is still open), closed-unresponded count, the ids of missed closes, the whole-day count to the next unresponded close, and an overall verdict (ATTENTION_REQUIRED iff a missed close exists; else ON_TRACK iff an open unresponded consultation exists; else ALL_RESPONDED). Declared-date discipline: as_of is a declared input, never a runtime clock; no register, portal, feed, or calendar is read, and responded is the caller's declaration, never an observation this kernel makes. Absent or malformed as_of, consultation lists, ids, closes dates, or responded flags fail closed with each offending input named. Day deltas are exact whole-day integers (civil-days arithmetic, no Date object); the declared rounding convention is 2dp half-up. Zero network, zero storage, zero clock."
resource: https://ainumbers.co/tools/678-consultation-response-tracker.html
tags: ["analytics_mandate", "wave-115", "mcp:compute_consultation_response_tracker"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-678-consultation-response-tracker.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/tools/678-consultation-response-tracker.html
    title: "public tool page"
---

# Consultation Response Tracker

> Exports a decision via MCP `compute_consultation_response_tracker` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/678-consultation-response-tracker.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-678-consultation-response-tracker.md) — §10.2.
