---
type: DecisionTool
title: "T+1 Post-Trade Timing Classifier"
description: "Classifies the post-trade timings a caller supplies to answer the question a settlement readiness programme is actually trying to answer: which step breaches its cut-off under the shorter settlement cycle that did not breach under the longer one. Each step in the caller's declared chain order is measured against a target-cycle cut-off and a baseline-cycle cut-off, and reports its status as on time, at risk, breached or undetermined, the residual margin in seconds on both sides, and whether the shorter cycle is what breaks it. The first failing step is named, and it is the first in the declared chain order rather than the earliest by clock, because a post-trade chain is a sequence of dependencies and not a sorted list of instants. The at-risk band is a caller policy input: with no band declared there is no at-risk zone, and that absence is reported rather than filled with an invented threshold. No cut-off table is shipped and there is no named-venue profile set. Market and venue cut-offs are caller inputs, never data kept current here, because a table of cut-offs is a standing maintenance duty and a duty that silently goes false is worse than no table at all. This classifies supplied timings. It observes no venue, no central securities depository and no matching platform, it opens no connection, and it is not monitoring. No clock is read: timestamps are parsed from caller strings with a strict ISO 8601 grammar and nothing is compared against the present moment, so nothing expires on its own. Every emitted number passes a finite gate, so a missing, blank, malformed or non-existent timestamp yields a null margin with a named reason and marks the step undetermined rather than reading as on time, and an unclassified step is never counted as an on-time step. Zero personal data by construction: trades and steps are identified by opaque caller references only. Stated boundary: this computes no settlement penalty, which is a separate concern, it states nothing about funding or foreign exchange implications, it makes no claim about markets outside the cycle change the caller declares, and it is not legal, tax or regulatory advice."
resource: https://ainumbers.co/chaingraph/art-506-classify-t1-posttrade-timing.html
tags: ["compliance_mandate", "wave-78", "mcp:classify_t1_posttrade_timing"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-506-classify-t1-posttrade-timing.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-506-classify-t1-posttrade-timing.html
    title: "public tool page"
---

# T+1 Post-Trade Timing Classifier

> Exports a decision via MCP `classify_t1_posttrade_timing` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-506-classify-t1-posttrade-timing.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-506-classify-t1-posttrade-timing.md) — §10.2.
