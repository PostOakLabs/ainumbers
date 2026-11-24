---
type: DecisionTool
title: "Murabahah Tawarruq Sequence Check"
description: "Checks the order of steps and the content of a murabahah or tawarruq structure against the Bank Negara Malaysia policy documents for each, from a list of at most 64 step records (step name, ordinal, whether evidence is present, and flags for agent role, delivery restriction, on-sale obligation, promise to sell to a third party, promise to sell to its original seller, payment before contract and a wakalah embedded in the sale contract). Eleven fixed checks each return pass, fail or not applicable with the paragraph they rest on: ownership before the murabahah contract, the transfer step evidenced, the wa'd separate and before the contract, the agent purchase before the contract, separate evidenced tawarruq contracts, possession before the onward sale, delivery unrestricted, no on-sale obligation, no payment before the contract, a separate wakalah with the agent role specified, and no promise to sell to a third party or to its original seller. The output keeps order_ok and rules_ok as two separate flags and names the first failing check and step. The authority profile is Bank Negara Malaysia only; other authorities, IIFA Resolution 179 among them, are not assessed and a request for another profile is refused by name. This is arithmetic and rule checking against the cited text, not a fatwa, Shariah certification, legal opinion or regulatory approval, and every payload says not_a_shariah_ruling. Inputs are enum names, ordinals and booleans only, with no names, accounts or identifiers."
resource: https://ainumbers.co/chaingraph/art-855-murabahah-tawarruq-sequence.html
tags: ["compliance_control", "wave-151", "mcp:check_murabahah_tawarruq_seq"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-855-murabahah-tawarruq-sequence.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-855-murabahah-tawarruq-sequence.html
    title: "public tool page"
---

# Murabahah Tawarruq Sequence Check

> Exports a decision via MCP `check_murabahah_tawarruq_seq` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-855-murabahah-tawarruq-sequence.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-855-murabahah-tawarruq-sequence.md) — §10.2.
