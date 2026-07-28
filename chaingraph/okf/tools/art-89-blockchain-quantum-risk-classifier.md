---
type: DecisionTool
title: "Blockchain / Stablecoin Quantum-Risk Classifier"
description: "Classifies quantum-exposure risk for blockchain/stablecoin assets: exposed public-key percentage, address reuse, and migration-path maturity (BIP-360/XRPL/Ethereum roadmaps). Reuses CBOM inventory from tool 499. Ties PQC to the suite's stablecoin/tokenization clusters."
resource: https://ainumbers.co/chaingraph/art-89-blockchain-quantum-risk-classifier.html
tags: ["model_governance", "wave-18", "mcp:classify_blockchain_quantum_risk"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-89-blockchain-quantum-risk-classifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-89-blockchain-quantum-risk-classifier.html
    title: "public tool page"
---

# Blockchain / Stablecoin Quantum-Risk Classifier

> Exports a decision via MCP `classify_blockchain_quantum_risk` — mandate type `model_governance`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-89-blockchain-quantum-risk-classifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [PQC Timeline & Migration Fit Diagnostic](./art-85-pqc-timeline-fit-diagnostic.md), `499-crypto-asset-inventory-classifier` _(not live)_

**Feeds:** [Merkle Batch Verifier](./cry-04-merkle-batch-verifier.md)
