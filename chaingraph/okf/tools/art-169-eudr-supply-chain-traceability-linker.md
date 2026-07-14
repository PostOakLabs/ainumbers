---
type: DecisionTool
title: "EUDR Supply-Chain Traceability Linker"
description: "Validate EUDR single-DDS rule compliance and supply-chain traceability: first operators file the DDS; downstream operators reference upstream DDS reference numbers from TRACES NT. Checks single-DDS rule, TRACES NT reference format validity, plot geolocation coverage, and custody-chain completeness. Returns chain_integrity verdict and traceability_gaps list. Feeds readiness diagnostic (art-170). Zero network, zero PII. Reg. EU 2023/1115 Art. 4."
resource: https://ainumbers.co/chaingraph/art-169-eudr-supply-chain-traceability-linker.html
tags: ["compliance_mandate", "wave-30", "mcp:link_eudr_supply_chain_traceability"]
timestamp: 2026-07-14
---

# EUDR Supply-Chain Traceability Linker

> Exports a decision via MCP `link_eudr_supply_chain_traceability` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-169-eudr-supply-chain-traceability-linker.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [EUDR Country Benchmark Risk Scorer](./art-168-eudr-country-benchmark-risk-scorer.md)

**Feeds:** [EUDR Readiness Diagnostic](./art-170-eudr-readiness-diagnostic.md)
