---
type: DecisionTool
title: "NIS2 Incident Significance Scorer (Art. 23 Reporting Threshold)"
description: "Score whether an operational event meets the NIS2 Art. 23 significant-incident threshold (any of: service disruption ≥1h, ≥1,000 affected users, estimated financial loss ≥€100k, third-party cascade, malicious act, cross-border impact). Emits significance verdict (not_significant / significant / critical), fires 24h/72h/30d reporting clocks, and identifies recipient authorities. Root stage of nis2-incident-and-supply-chain-readiness chain."
resource: https://ainumbers.co/chaingraph/art-144-nis2-incident-significance-scorer.html
tags: ["compliance_mandate", "wave-26", "mcp:score_nis2_incident_significance"]
timestamp: 2026-07-14
---

# NIS2 Incident Significance Scorer (Art. 23 Reporting Threshold)

> Exports a decision via MCP `score_nis2_incident_significance` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-144-nis2-incident-significance-scorer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [NIS2 ICT Supply-Chain Diligence Scorer (Art. 21(2)(d) / ENISA)](./art-145-nis2-ict-supply-chain-diligence-scorer.md)
