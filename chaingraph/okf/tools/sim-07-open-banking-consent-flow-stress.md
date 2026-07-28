---
type: DecisionTool
title: "Open Banking Consent Flow Stress Simulator"
description: "Monte Carlo stress simulation of PSD2/FAPI 2.0/CDR consent lifecycle FSM (INIT→REDIRECT→AUTH→AUTHORIZED→ACTIVE→FAILED/EXPIRED/REVOKED). Configurable failure probabilities per transition stage, terminal state distribution, ASPSP SCA availability compliance check (95% threshold). Chains from PNR-01 (DORA ICT cascade)."
resource: https://ainumbers.co/chaingraph/sim-07-open-banking-consent-flow-stress.html
tags: ["compliance_mandate", "wave-3", "mcp:simulate_consent_stress"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/sim-07-open-banking-consent-flow-stress.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/sim-07-open-banking-consent-flow-stress.html
    title: "public tool page"
---

# Open Banking Consent Flow Stress Simulator

> Exports a decision via MCP `simulate_consent_stress` — mandate type `compliance_mandate`.

**Context:** PSD2 RTS Art.32/33 ASPSP availability obligations in force; FAPI 2.0 live; CDR ongoing in AU

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/sim-07-open-banking-consent-flow-stress.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [DORA ICT Cascade Simulator](./pnr-01-dora-ict-cascade-simulator.md)

**Feeds:** [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)

## Attested computation

[executor + attester binding](../computations/sim-07-open-banking-consent-flow-stress.md) — §10.2.
