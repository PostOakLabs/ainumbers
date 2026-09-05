---
type: DecisionTool
title: "Lending Recall Prioritizer"
description: "Deterministic ranking arithmetic over a caller-declared synthetic recall queue. Ranks declared recalls by due date ascending, then declared quantity ascending, then declared id ascending (a deterministic total order), and flags a recall urgent when its due date is 0 or 1 day after the caller-declared as_of date (due-within-one-day); past-due and further-out recalls are ranked but never flagged. Dates are strict YYYY-MM-DD calendar dates parsed and differenced with pure integer civil-day arithmetic -- no Date object, no runtime clock: as_of is an input, never today. No securities-lending tape, no borrow list, no cutoff feed, no register, no network: every recall, date, and quantity is a caller-declared input, never fetched or inferred. This is a prioritizer of declared inputs under named rules, NOT live recall data, NOT an instruction to recall, return, or borrow any security, and NOT a check of any live feed -- the not_proven discipline applies. An absent or invalid as_of, recall list, id, due date, or quantity resolves to a fail-closed payload naming each rejected input, never a silently repaired queue. Settled ranking arithmetic; it cites no external standard."
resource: https://ainumbers.co/tools/673-lending-recall-prioritizer.html
tags: ["compliance_control", "wave-114", "mcp:compute_lending_recall_prioritizer"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-673-lending-recall-prioritizer.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/tools/673-lending-recall-prioritizer.html
    title: "public tool page"
---

# Lending Recall Prioritizer

> Exports a decision via MCP `compute_lending_recall_prioritizer` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/673-lending-recall-prioritizer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-673-lending-recall-prioritizer.md) — §10.2.
