---
type: DecisionTool
title: "NIS2 ICT Supply-Chain Diligence Scorer (Art. 21(2)(d) / ENISA)"
description: "Score ICT vendor due-diligence posture against NIS2 Art. 21(2)(d) and ENISA ICT supply-chain risk framework. Seven controls: ISO 27001 certification, vendor incident history, audit clause, breach-notification SLA ≤72h, EU-only data residency, sub-contractor mapping, availability SLA ≥99.5%. Emits risk score, tier (Low/Medium/High/Critical), active flags, and remediation checklist."
resource: https://ainumbers.co/chaingraph/art-145-nis2-ict-supply-chain-diligence-scorer.html
tags: ["compliance_mandate", "wave-26", "mcp:score_nis2_supply_chain_diligence"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-145-nis2-ict-supply-chain-diligence-scorer.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-145-nis2-ict-supply-chain-diligence-scorer.html
    title: "public tool page"
---

# NIS2 ICT Supply-Chain Diligence Scorer (Art. 21(2)(d) / ENISA)

> Exports a decision via MCP `score_nis2_supply_chain_diligence` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-145-nis2-ict-supply-chain-diligence-scorer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [NIS2 Incident Significance Scorer (Art. 23 Reporting Threshold)](./art-144-nis2-incident-significance-scorer.md)

**Feeds:** [NIS2 Governance Readiness Checker (Art. 20 — Management Body Accountability)](./art-146-nis2-governance-readiness-checker.md)

## Attested computation

[executor + attester binding](../computations/art-145-nis2-ict-supply-chain-diligence-scorer.md) — §10.2.
