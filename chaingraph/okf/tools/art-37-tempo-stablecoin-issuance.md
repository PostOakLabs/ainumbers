---
type: DecisionTool
title: "Tempo Stablecoin Issuance Compliance"
description: "Dual-jurisdiction TIP-20 token compliance validator. Tab 1: TIP-20 Config Lint: currency code, supply cap, RBAC (ISSUER/PAUSE/BURN_BLOCKED), yield prohibition per GENIUS Act §4(a)(11). Tab 2: TIP-403 Policy Design: allowlist/blocklist/freeze, OFAC SDN, FATF Travel Rule. Dual scorecard: US GENIUS PPSI (Fed. Reg. 2026-06963 NPRM) + EU MiCA EMT (EU Reg. 2023/1114). OCG v0.3.1 artifact; dct:conformsTo party-identification.jsonld; issuer LEI in output_payload."
resource: https://ainumbers.co/chaingraph/art-37-tempo-stablecoin-issuance.html
tags: ["compliance_mandate", "wave-9", "mcp:validate_tempo_token_compliance"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-37-tempo-stablecoin-issuance.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-37-tempo-stablecoin-issuance.html
    title: "public tool page"
---

# Tempo Stablecoin Issuance Compliance

> Exports a decision via MCP `validate_tempo_token_compliance` — mandate type `compliance_mandate`.

**Context:** GENIUS Act enacted; GENIUS PPSI AML NPRM April 2026; MiCA EMT in force.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-37-tempo-stablecoin-issuance.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Tempo Fit Diagnostic](./art-34-tempo-fit-diagnostic.md)

**Feeds:** [GENIUS Act Reserve Attestation Pre-Check](./art-06-genius-act-reserve-attestation.md), [AMLA Transaction-Typology Risk Scorer](./art-10-amla-transaction-typology-risk-scorer.md), [Tempo On-Chain AML & Travel Rule Screener](./art-38-tempo-onchain-aml.md)
