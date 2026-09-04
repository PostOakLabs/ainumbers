---
type: DecisionTool
title: "EBA IM-Model Validation Tracker"
description: "Deterministic roll-up arithmetic over a caller-declared internal-model inventory. Counts the declared inventory by status (submitted, approved, rejected), lists pending submission ids in declared order, ages each pending submission in whole days from its declared submitted date to the declared as_of date, and issues an overall verdict under a named aging rule: TRACKING_EMPTY when no submitted or approved models are declared, TRACKING_AGED when any pending submission is older than 180 days at as_of, TRACKING_CURRENT otherwise. No register, no SSR tape, no cutoff feed, no network, no clock: every id, status, date, and the as_of snapshot are caller-declared inputs, never fetched or inferred. This is a tracker of declared-inventory arithmetic, NOT a regulatory determination, NOT advice on any application, and NOT a check of any supervisor register -- the not_proven discipline applies. An absent or invalid as_of, model entry, id, status, or submitted date resolves to a fail-closed payload naming each rejected input, never a silently repaired inventory. Settled arithmetic (counting and calendar-day aging); it cites no external standard."
resource: https://ainumbers.co/tools/674-eba-im-model-validation-tracker.html
tags: ["compliance_mandate", "wave-114", "mcp:compute_eba_im_model_validation_tracker"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-674-eba-im-model-validation-tracker.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/tools/674-eba-im-model-validation-tracker.html
    title: "public tool page"
---

# EBA IM-Model Validation Tracker

> Exports a decision via MCP `compute_eba_im_model_validation_tracker` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/674-eba-im-model-validation-tracker.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-674-eba-im-model-validation-tracker.md) — §10.2.
