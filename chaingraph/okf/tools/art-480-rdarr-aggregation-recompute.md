---
type: DecisionTool
title: "RDARR Aggregation Recompute"
description: "Re-derives a stated risk-report figure from a SUPPLIED source extract under a declared aggregation policy (filter set, netting rule, FX rate set, hierarchy roll-up). Returns the recomputed figure, a signed delta vs the reported figure, and a per-roll-up-node contribution breakdown so a break localises to one node instead of the whole report. HARD FENCE: every FX rate is supplied and asserted, never fetched (zero-egress); this recomputes the arithmetic over declared inputs and attests THAT, never an opinion on extract or reported-figure correctness, never a data-quality assessment, never a materiality judgement. First entry of the BCBS 239 / RDARR family."
resource: https://ainumbers.co/chaingraph/art-480-rdarr-aggregation-recompute.html
tags: ["attestation_mandate", "wave-66", "mcp:rdarr_aggregation_recompute"]
timestamp: 2026-07-27
---

# RDARR Aggregation Recompute

> Exports a decision via MCP `rdarr_aggregation_recompute` — mandate type `attestation_mandate`.

**Context:** No statutory deadline; RDARR aggregation recompute is a continuous data-governance control, not a periodic filing. The ECB named RDARR remediation a supervisory priority for 2025-2027.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-480-rdarr-aggregation-recompute.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _rdarr-attestation-cycle (with art-481-rdarr-quality-scorecard)_
