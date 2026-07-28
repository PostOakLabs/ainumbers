---
type: DecisionTool
title: "On-Chain Cash-Leg Finality Checker"
description: "Validate USDC/deposit-token cash-leg finality, reserve attestation, and GENIUS Act / MiCA compliance for Canton settlement. Emits a finality_verdict and GENIUS PPSI / MiCA EMT conformance flags."
resource: https://ainumbers.co/tools/506-onchain-cash-leg-finality-checker.html
tags: ["attestation_mandate", "wave-8", "mcp:check_cash_leg_finality", "iso20022:pacs.008-subset"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/506-onchain-cash-leg-finality-checker.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/tools/506-onchain-cash-leg-finality-checker.html
    title: "public tool page"
---

# On-Chain Cash-Leg Finality Checker

> Exports a decision via MCP `check_cash_leg_finality` — mandate type `attestation_mandate`.

**Context:** cash-leg finality. GENIUS Act enacted; GENIUS PPSI AML NPRM (Fed. Reg. 2026-06963); MiCA EMT Art. 48.

**Semantic profile:** `iso20022:pacs.008-subset` (ISO 20022-aligned)

**Conforms to (`dct:conformsTo`):** <https://ainumbers.co/chaingraph/profiles/iso20022/pacs008-subset.jsonld>

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/506-onchain-cash-leg-finality-checker.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Tokenized Collateral Eligibility Checker](./505-tokenized-collateral-eligibility-checker.md)

**Feeds:** _terminal node_
