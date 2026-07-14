---
type: DecisionTool
title: "FSMA 204 Recall Trace Resolver (24-Hour FDA List)"
description: "One-up/one-back trace from a contaminated Traceability Lot Code to affected recipients and sources. Emits the data for the FDA 24-hour sortable spreadsheet. Terminal stage of food-traceability-fsma204 chain."
resource: https://ainumbers.co/chaingraph/art-120-recall-trace-resolver.html
tags: ["compliance_mandate", "wave-22", "mcp:resolve_recall_trace"]
timestamp: 2026-07-14
---

# FSMA 204 Recall Trace Resolver (24-Hour FDA List)

> Exports a decision via MCP `resolve_recall_trace` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-120-recall-trace-resolver.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [FSMA 204 Traceability Lot Code Chain Linker](./art-119-traceability-lot-code-linker.md)

**Feeds:** _terminal node_
