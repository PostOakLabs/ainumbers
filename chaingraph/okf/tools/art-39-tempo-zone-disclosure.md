---
type: DecisionTool
title: "Tempo Zone Selective-Disclosure Attestation"
description: "Maps a Tempo Zone's party-visibility model (operator-sees-all / users-see-own / outsiders-see-ZK-proofs) against AML/audit/regulator disclosure obligations. Confirms TIP-403 freeze/allowlist propagates cross-zone. Issues a privacy-and-auditability attestation for the board/regulator. Verdict: FULL_ATTESTATION / PARTIAL_ATTESTATION / INSUFFICIENT. ISO 20022 pacs.008-subset artifact. Zones live June 2026; payroll/treasury first use case."
resource: https://ainumbers.co/chaingraph/art-39-tempo-zone-disclosure.html
tags: ["attestation_mandate", "wave-9", "mcp:validate_tempo_zone_disclosure"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-39-tempo-zone-disclosure.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-39-tempo-zone-disclosure.html
    title: "public tool page"
---

# Tempo Zone Selective-Disclosure Attestation

> Exports a decision via MCP `validate_tempo_zone_disclosure` — mandate type `attestation_mandate`.

**Context:** Tempo Zones launched June 2026. AML obligations persist inside Zones per GENIUS PPSI AML NPRM.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-39-tempo-zone-disclosure.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Tempo On-Chain AML & Travel Rule Screener](./art-38-tempo-onchain-aml.md)

**Feeds:** [ZK Compliance Proof Generator](./cry-01-zk-compliance-proof-generator.md)
