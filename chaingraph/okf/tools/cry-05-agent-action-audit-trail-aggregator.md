---
type: DecisionTool
title: "Agent-Action Audit-Trail Aggregator"
description: "The regulatory receipt. Aggregates N execution_hashes from an agent session into one SHA-256 Merkle-root session receipt with per-leaf inclusion proofs and an ordered chain-depth map. Sets session_receipt_root. The tamper-evident audit object for EU AI Act Art. 12 record-keeping + DORA. Consumes ANY ChainGraph artifact; feeds CRY-04, PTG-01."
resource: https://ainumbers.co/chaingraph/cry-05-agent-action-audit-trail-aggregator.html
tags: ["cryptographic_mandate", "wave-6", "mcp:aggregate_execution_receipts"]
timestamp: 2026-06-18T15:09:48.675Z
---

# Agent-Action Audit-Trail Aggregator

> Exports a decision via MCP `aggregate_execution_receipts` — mandate type `cryptographic_mandate`.

**Context:** Wave 6 — session-level provenance receipt; positions execution_hash as a portable agent-action receipt.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/cry-05-agent-action-audit-trail-aggregator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Agent Commerce Cross-Protocol Conformance Validator](./art-30-agent-commerce-conformance-validator.md), [A2A x402-Extension Mandate Validator](./art-31-a2a-x402-extension-mandate-validator.md), [MCP Server Self-Attestation Pack](./art-33-mcp-server-self-attestation-pack.md)

**Feeds:** [Merkle Batch Verifier](./cry-04-merkle-batch-verifier.md), [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
