---
type: DecisionTool
title: "Crypto-Asset Whitepaper Linter (iXBRL)"
description: "Validates Art 6/8 whitepaper: Annex I section completeness + iXBRL/XHTML well-formedness + ESMA MiCA taxonomy structural conformance (ITS 2024/2984). Section gaps + non-compliance-register risk."
resource: https://ainumbers.co/chaingraph/art-102-crypto-asset-whitepaper-linter.html
tags: ["compliance_mandate", "wave-20", "mcp:lint_crypto_asset_whitepaper"]
timestamp: 2026-07-14
---

# Crypto-Asset Whitepaper Linter (iXBRL)

> Exports a decision via MCP `lint_crypto_asset_whitepaper` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-102-crypto-asset-whitepaper-linter.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [MiCA CASP Fit Diagnostic](./art-98-mica-casp-fit-diagnostic.md)

**Feeds:** [Merkle Batch Verifier](./cry-04-merkle-batch-verifier.md)
