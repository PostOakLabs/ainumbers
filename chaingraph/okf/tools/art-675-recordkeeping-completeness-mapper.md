---
type: DecisionTool
title: "Recordkeeping Completeness Mapper"
description: "Channel inventory roll-up for books-and-records completeness. The caller declares each books-and-records channel (email, chat, voice, messaging, ...) with a captured flag and a retrieval-test result (pass/fail/not_run); the kernel computes total channels, captured count, completeness percentage (whole number, half-up), the uncaptured listing, the retrieval-pass count, and an overall verdict: COMPLETE only when every declared channel is captured AND every retrieval test reports pass; otherwise GAPS_FOUND (an untested channel is a gap, never an assumed pass). Not-proven discipline: arithmetic of caller-declared synthetic inputs only -- it never checks live SSR tapes, borrow lists, cutoff feeds, registers, or any records system, and a COMPLETE verdict is the caller's declaration, not an attestation that any regulatory recordkeeping obligation is met. Absent or malformed channel lists, names, captured flags, or retrieval results fail closed with each offending input named. No network, no clock, no storage."
resource: https://ainumbers.co/tools/675-recordkeeping-completeness-mapper.html
tags: ["analytics_mandate", "wave-114", "mcp:compute_recordkeeping_completeness_mapper"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-675-recordkeeping-completeness-mapper.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/tools/675-recordkeeping-completeness-mapper.html
    title: "public tool page"
---

# Recordkeeping Completeness Mapper

> Exports a decision via MCP `compute_recordkeeping_completeness_mapper` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/675-recordkeeping-completeness-mapper.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-675-recordkeeping-completeness-mapper.md) — §10.2.
