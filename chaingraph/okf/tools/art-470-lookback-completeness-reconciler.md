---
type: DecisionTool
title: "AML Lookback Completeness Reconciler"
description: "Reconciles an AML consent-order remediation lookback's order-scope population against the extract actually produced for re-screening, per historical period. Coverage is always measured against the caller-declared SOURCE-SYSTEM record count, never the extract's own self-reported count -- a lookback that reports zero gaps because it only counted what the extract already contains is indistinguishable from a clean lookback, and catching that blind spot is this node's purpose. A second axis reconciles versioned policy-list snapshot availability: any period whose sanctions/PEP list snapshot was not preserved is flagged unverifiable and excluded from the screened-coverage total rather than silently re-screened against today's list. Also flags duplicate records surviving dedup. Deterministic reconciliation arithmetic only. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-470-lookback-completeness-reconciler.html
tags: ["compliance_control", "wave-74", "mcp:reconcile_aml_lookback_completeness"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-470-lookback-completeness-reconciler.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-470-lookback-completeness-reconciler.html
    title: "public tool page"
---

# AML Lookback Completeness Reconciler

> Exports a decision via MCP `reconcile_aml_lookback_completeness` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-470-lookback-completeness-reconciler.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
