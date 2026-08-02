---
type: DecisionTool
title: "Source Arrival & Freshness Register"
description: "Reconciles a caller-declared EXPECTED-source inventory against caller-declared OBSERVED arrivals, per source: arrived, missing, late (arrived after its declared expected-as-of), or stale (arrived but older than its declared freshness threshold relative to a declared reference-as-of). The expected inventory is always an independently supplied caller input, never derived from the observed set -- a register that only counts what showed up cannot tell 'nothing broke' from 'a whole source never arrived,' and closing that blind spot is this node's purpose. If no expected-source inventory is declared, the node refuses to report on arrivals alone and emits a did-not-run execution state instead of a degraded pass. All sources current yields auto_pass; any late-but-present source yields review_required (which routes to an exception step, never a human blocker); any missing expected source yields reject; an observed arrival supplied with no as-of yields a ran-stale execution state rather than a guessed decision. Deterministic reconciliation arithmetic only, no clock, no network, zero PII. Not a log tailer: completeness is measured against the declared expected inventory, never the extract's own self-reported arrivals. Clause: GAO-25-107721 SS13.07 (currency as an attribute of the information itself); ECB RDARR Guide (May 2024) SS3.5(1) (timeliness)."
resource: https://ainumbers.co/chaingraph/art-524-source-arrival-freshness-register.html
tags: ["compliance_control", "wave-81", "mcp:register_source_arrival_freshness"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-524-source-arrival-freshness-register.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-524-source-arrival-freshness-register.html
    title: "public tool page"
---

# Source Arrival & Freshness Register

> Exports a decision via MCP `register_source_arrival_freshness` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-524-source-arrival-freshness-register.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-524-source-arrival-freshness-register.md) — §10.2.
