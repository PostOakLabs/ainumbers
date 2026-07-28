---
type: DecisionTool
title: "Settlement Orchestrator Attestation"
description: "Extends the attest_mcp_server (art-33) self-attestation doctrine to the settlement decision path: attests the off-chain orchestrator deciding commit/halt on a shared-ledger orchestration layer, never the ledger itself. Four-domain check (manifest lint, decision-policy reference, kernel-binding audit, transport audit) into a composite ship-readiness grade, binding the decision policy and invoked kernels to an execution-receipt chain."
resource: https://ainumbers.co/chaingraph/art-292-attest-settlement-orchestrator.html
tags: ["infrastructure_mandate", "wave-53", "mcp:attest_settlement_orchestrator"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-292-attest-settlement-orchestrator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-292-attest-settlement-orchestrator.html
    title: "public tool page"
---

# Settlement Orchestrator Attestation

> Exports a decision via MCP `attest_settlement_orchestrator` — mandate type `infrastructure_mandate`.

**Context:** Swift shared-ledger MVP live 2026-07-09; orchestration-layer attestation need follows the settlement-contract lint.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-292-attest-settlement-orchestrator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Besu Settlement Contract Linter](./art-289-lint-besu-settlement-contract.md)

**Feeds:** _terminal node_
