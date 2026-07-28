---
type: DecisionTool
title: "MT103 to MX Translation Fidelity Scorer"
description: "Scores ISO 15022 MT103 to ISO 20022 pacs.008 translation fidelity for CBPR+ November 2026 migration. Checks field presence mapping (:20: to UETR, :50K/A to Dbtr/Nm, :59/:59A to Cdtr/Nm, :52A/:57A to BIC agents, :70: to RmtInf/Ustrd, :71A to ChrgBr), truncation risks (140-char remittance info, address line lengths), and charge bearer code mapping (OUR=DEBT, SHA=SHAR, BEN=CRED). Outputs fidelity score and per-field mapping results."
resource: https://ainumbers.co/chaingraph/art-245-mt-mx-translation-fidelity-scorer.html
tags: ["compliance_mandate", "wave-41", "mcp:score_mt_mx_translation_fidelity"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-245-mt-mx-translation-fidelity-scorer.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-245-mt-mx-translation-fidelity-scorer.html
    title: "public tool page"
---

# MT103 to MX Translation Fidelity Scorer

> Exports a decision via MCP `score_mt_mx_translation_fidelity` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-245-mt-mx-translation-fidelity-scorer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [SWIFT GPI Tracker Lifecycle Simulator](./art-244-gpi-tracker-lifecycle-simulator.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-245-mt-mx-translation-fidelity-scorer.md) — §10.2.
