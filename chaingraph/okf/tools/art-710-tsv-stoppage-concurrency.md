---
type: DecisionTool
title: "TSV Stoppage Concurrency"
description: "Checks a tokenized-stock venue (TSV) against condition H of the SEC TSV Exemption (FR 2026-19388, 91 Fed. Reg. 60176, Sept. 22, 2026): a TSV must stop trading in a Tokenized NMS Stock concurrently with any stoppage of trading in the underlying NMS stock on the primary listing exchange, which includes a halt or a suspension, and must immediately notify its TSV Participants. Replays caller-supplied TSV trades against caller-declared listing-exchange stoppage intervals under a declared half-open boundary rule (start-inclusive, end-exclusive), flags every trade inside an interval beyond the caller-declared concurrency tolerance, checks that the TSV's own halt record spans each stoppage (an open-ended stoppage is covered only by an open-ended record), and reports participant-notice presence with the notice latency as a MEASURED value in milliseconds from stoppage start to the earliest notice at or after it, never graded pass/fail because the order says \"immediately\" without a number. Per stoppage: covered, trades_during, trades_flagged, trades_within_tolerance, notice_latency_ms; violations carry TRADE_DURING_STOPPAGE, HALT_RECORD_NOT_COVERING and NO_PARTICIPANT_NOTICE. Evidence only: it states no opinion on whether any latency, gap or trade is lawful. Zero network: the node never reads a chain and checks only what the caller supplies."
resource: https://ainumbers.co/chaingraph/art-710-tsv-stoppage-concurrency.html
tags: ["compliance_control", "wave-129", "mcp:check_tsv_stoppage_concurrency"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-710-tsv-stoppage-concurrency.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-710-tsv-stoppage-concurrency.html
    title: "public tool page"
---

# TSV Stoppage Concurrency

> Exports a decision via MCP `check_tsv_stoppage_concurrency` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-710-tsv-stoppage-concurrency.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-710-tsv-stoppage-concurrency.md) — §10.2.
