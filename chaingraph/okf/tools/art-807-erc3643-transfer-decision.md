---
type: DecisionTool
title: "ERC-3643 Transfer Decision Recompute"
description: "Recomputes whether one proposed ERC-3643 (T-REX) transfer or mint would go through, from caller-declared state only: identity registry entries (identity present, investor country, claims with caller-declared validity), required claim topics, trusted issuers per topic, bound compliance modules and token state (paused, frozen wallets, frozen token amounts, balances, total supply). Gate order follows the reference implementation pinned at commit 2f0704d: for a transfer the pause gate, then either party frozen, then the amount against the sender's unfrozen balance, then receiver identity verification, then every bound module in declared order as a logical AND; a mint skips the first three. The output names the first failing gate (and the failing module or claim topics) while still reporting every gate. Four module rules are re-implemented from the pinned legacy compliance features: max balance per identity, supply limit on mints, country restriction and country whitelist, reading the receiver's registry country. Any other module can be declared as a pass-through outcome, which the node aggregates but does not judge. An optional fund covenant (jurisdiction allowlist, holder cap, lock-up date) is evaluated separately over the same state and any divergence from the token-level outcome is reported. Declared-state recompute only: no chain is read, claim signatures are not checked, and the node cannot confirm the declared state matches a deployed contract. The output is not legal advice and not a determination that a transfer is lawful. Malformed or missing inputs refuse with INPUT_REFUSED rather than being coerced."
resource: https://ainumbers.co/chaingraph/art-807-erc3643-transfer-decision.html
tags: ["compliance_mandate", "wave-142", "mcp:recompute_erc3643_transfer_decision"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-807-erc3643-transfer-decision.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-807-erc3643-transfer-decision.html
    title: "public tool page"
---

# ERC-3643 Transfer Decision Recompute

> Exports a decision via MCP `recompute_erc3643_transfer_decision` — mandate type `compliance_mandate`.

**Context:** No regulatory deadline: this node recomputes a declared transfer decision, it does not carry a dated obligation.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-807-erc3643-transfer-decision.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-807-erc3643-transfer-decision.md) — §10.2.
