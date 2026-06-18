---
type: DecisionTool
title: "ZK Compliance Proof Generator"
description: "Synthetic ZK compliance proof token for AML/Travel Rule predicates (amount threshold, sanctions clear, KYC complete, velocity normal, source of funds). NTT simulation — models the number-theoretic transform in real ZK-SNARK/STARK backends. GDPR Art. 25 data-minimisation demonstrator. Explicitly educational."
resource: https://ainumbers.co/chaingraph/cry-01-zk-compliance-proof-generator.html
tags: ["compliance_mandate", "wave-2", "mcp:generate_zk_compliance_proof"]
timestamp: 2026-06-18T15:15:44.978Z
---

# ZK Compliance Proof Generator

> Exports a decision via MCP `generate_zk_compliance_proof` — mandate type `compliance_mandate`.

**Context:** GDPR Art. 25 / FATF Travel Rule / EU AMLR 2024/1624

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/cry-01-zk-compliance-proof-generator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [AMLA Transaction-Typology Risk Scorer](./art-10-amla-transaction-typology-risk-scorer.md)

**Feeds:** [Merkle Batch Verifier](./cry-04-merkle-batch-verifier.md), [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
