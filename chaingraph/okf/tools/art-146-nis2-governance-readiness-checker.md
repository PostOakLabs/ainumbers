---
type: DecisionTool
title: "NIS2 Governance Readiness Checker (Art. 20 — Management Body Accountability)"
description: "Assess NIS2 Art. 20 management-body accountability: board approval of Art. 21 measures, quarterly status updates, CISO designation, cybersecurity training coverage, and board review freshness (board_review_age_days). Grades governance A–F; flags personal liability risk (board has not approved Art. 21 or review stale >365 days). §16 proof OPT-IN signing candidate. Terminal stage of nis2-incident-and-supply-chain-readiness chain."
resource: https://ainumbers.co/chaingraph/art-146-nis2-governance-readiness-checker.html
tags: ["compliance_mandate", "wave-26", "mcp:check_nis2_governance_readiness"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-146-nis2-governance-readiness-checker.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-146-nis2-governance-readiness-checker.html
    title: "public tool page"
---

# NIS2 Governance Readiness Checker (Art. 20 — Management Body Accountability)

> Exports a decision via MCP `check_nis2_governance_readiness` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-146-nis2-governance-readiness-checker.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [NIS2 ICT Supply-Chain Diligence Scorer (Art. 21(2)(d) / ENISA)](./art-145-nis2-ict-supply-chain-diligence-scorer.md)

**Feeds:** _terminal node_
