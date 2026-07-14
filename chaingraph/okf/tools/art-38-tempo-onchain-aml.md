---
type: DecisionTool
title: "Tempo On-Chain AML & Travel Rule Screener"
description: "Parses a batch of synthetic TIP-20 transfers (with memos), runs OFAC/SDN hit screening, checks FATF Travel Rule field completeness (originator/beneficiary name + VASP ID, threshold US$3,000), scores AML typologies (structuring $9k–$9.99k, missing identity, unusual tx), and emits SAR determination + Travel Rule attestation. Bilateral: sending VASP emits; receiving VASP re-verifies. ISO 20022 pacs.008-subset artifact; instructed_amount = batch total."
resource: https://ainumbers.co/chaingraph/art-38-tempo-onchain-aml.html
tags: ["aml_rule", "wave-9", "mcp:screen_tip20_transfer_batch"]
timestamp: 2026-07-14
---

# Tempo On-Chain AML & Travel Rule Screener

> Exports a decision via MCP `screen_tip20_transfer_batch` — mandate type `aml_rule`.

**Context:** GENIUS PPSI AML NPRM (Fed. Reg. 2026-06963, April 2026); FATF Travel Rule ≥$3,000.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-38-tempo-onchain-aml.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Tempo Stablecoin Issuance Compliance](./art-37-tempo-stablecoin-issuance.md)

**Feeds:** [Tempo Zone Selective-Disclosure Attestation](./art-39-tempo-zone-disclosure.md), [AMLA Transaction-Typology Risk Scorer](./art-10-amla-transaction-typology-risk-scorer.md)
