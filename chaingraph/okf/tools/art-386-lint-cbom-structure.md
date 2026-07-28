---
type: DecisionTool
title: "CBOM Structural Lint & CNSA-2.0 Classifier"
description: "Validates a pasted CycloneDX 1.6 Cryptography Bill of Materials against a hand-derived field subset (algorithm, key size, certification level, crypto functions) and classifies declared algorithm assets as quantum-vulnerable (RSA, ECDSA/ECDH, DH, SHA-1) or CNSA-2.0 target-aligned (ML-KEM-1024, ML-DSA-87, AES-256, SHA-384/512). Structural and classification checks only; every finding asserted from the pasted CBOM. Not a scanner, not discovery, not a cryptographic audit."
resource: https://ainumbers.co/chaingraph/art-386-lint-cbom-structure.html
tags: ["compliance_mandate", "wave-65", "mcp:lint_cbom_structure"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-386-lint-cbom-structure.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-386-lint-cbom-structure.html
    title: "public tool page"
---

# CBOM Structural Lint & CNSA-2.0 Classifier

> Exports a decision via MCP `lint_cbom_structure` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-386-lint-cbom-structure.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
