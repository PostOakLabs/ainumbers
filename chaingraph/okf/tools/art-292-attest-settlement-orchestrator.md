---
type: DecisionTool
title: "Settlement Orchestrator Attestation"
description: "Extends the lint_mcp_server_conformance (art-33) self-reported conformance lint to the settlement decision path: checks the off-chain orchestrator deciding commit/halt on a shared-ledger orchestration layer, never the ledger itself. Four-domain check (manifest lint, decision-policy reference, kernel-binding audit, transport audit) into a composite ship-readiness grade, binding the decision policy and invoked kernels to an execution-receipt chain. This is an unsigned lint result, not a signed attestation. audit_signature.signatures is empty by design, as it is on every unsigned OpenChainGraph node. Formerly named attest_settlement_orchestrator; that name remains accepted permanently."
resource: https://ainumbers.co/chaingraph/art-292-attest-settlement-orchestrator.html
tags: ["infrastructure_mandate", "wave-53", "mcp:lint_settlement_orchestrator_conformance"]
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

> Exports a decision via MCP `lint_settlement_orchestrator_conformance` — mandate type `infrastructure_mandate`.

**Context:** Swift shared-ledger MVP live 2026-07-09; orchestration-layer attestation need follows the settlement-contract lint.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-292-attest-settlement-orchestrator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Besu Settlement Contract Linter](./art-289-lint-besu-settlement-contract.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-292-attest-settlement-orchestrator.md) — §10.2.
