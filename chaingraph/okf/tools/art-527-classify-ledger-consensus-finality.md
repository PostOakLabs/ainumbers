---
type: DecisionTool
title: "Ledger Consensus Finality Classifier"
description: "Classifies a ledger-consensus position under a deadline-bounded-inclusion model (XRPL) or a federated-BFT model (Stellar SCP), each expressed as terminal outcome branches rather than a monotone tier ladder. Flags an overstated finality claim and a fee-consuming tec final failure, and names the unprovable-absence gap where validated history is not continuous. Caller-supplied signed ledger facts only: no live network fetch, no witness/light-client infrastructure, no embedded validator-list snapshot. Zero PII. Client-side."
resource: https://ainumbers.co/chaingraph/art-527-classify-ledger-consensus-finality.html
tags: ["compliance_mandate", "wave-82", "mcp:classify_ledger_consensus_finality"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-527-classify-ledger-consensus-finality.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-527-classify-ledger-consensus-finality.html
    title: "public tool page"
---

# Ledger Consensus Finality Classifier

> Exports a decision via MCP `classify_ledger_consensus_finality` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-527-classify-ledger-consensus-finality.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-527-classify-ledger-consensus-finality.md) — §10.2.
