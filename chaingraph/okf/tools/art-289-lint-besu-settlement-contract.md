---
type: DecisionTool
title: "Besu Settlement Contract Linter"
description: "Static conformance lint of a permissioned-EVM settlement contract (Solidity source or ABI) against six invariants: atomic PvP/DvP (paired-or-revert), no native-token/msg.value settlement dependence, a finality-hook/settlement event, a compliance-gate modifier preceding every value transfer, bounded participant-set loops, and upgradeability disclosure. Lightweight in-browser parse only, never solc, never a network call. v1 scope is source + ABI; bytecode/opcode heuristics are deferred. Not a security audit."
resource: https://ainumbers.co/chaingraph/art-289-lint-besu-settlement-contract.html
tags: ["compliance_mandate", "wave-53", "mcp:lint_besu_settlement_contract"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-289-lint-besu-settlement-contract.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-289-lint-besu-settlement-contract.html
    title: "public tool page"
---

# Besu Settlement Contract Linter

> Exports a decision via MCP `lint_besu_settlement_contract` — mandate type `compliance_mandate`.

**Context:** Swift shared-ledger MVP live 2026-07-09; bank settlement contracts moving from design to production review.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-289-lint-besu-settlement-contract.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Settlement Orchestrator Attestation](./art-292-attest-settlement-orchestrator.md)

## Attested computation

[executor + attester binding](../computations/art-289-lint-besu-settlement-contract.md) — §10.2.
