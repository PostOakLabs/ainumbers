---
type: DecisionTool
title: "DORA ICT Incident Classifier & Reporting Clock"
description: "Classifies an ICT-related incident as major or non-major under DORA (EU 2022/2554) Art. 18, applying the published RTS (EU 2024/1772) numeric criteria (clients affected %, duration, geographical spread, data losses, economic impact, critical-services impact, reputational impact), then starts the DORA Art. 19 reporting clock (4-hour initial notification, 72-hour intermediate report, 1-calendar-month final report, all from classification) once classified major. Follows the art-428-cyber-incident-clock deadline-clock pattern for the EU DORA regime; see that node for the analogous US banking/SEC/NYDFS clock. Not a duplicate of the existing art-09-dora-incident-classifier (earlier draft-RTS citation, no notification-clock link, infrastructure_mandate) -- art-467 cites the final 2024 RTS/ITS package and is built to the attestation-clock pattern; the overlap between the two is flagged for review, not hidden. This node classifies and computes deadlines only; it does not itself transmit, file, or submit any regulatory notification, and it is not legal advice."
resource: https://ainumbers.co/chaingraph/art-467-dora-incident-classifier.html
tags: ["attestation_mandate", "wave-74", "mcp:classify_dora_ict_incident_and_clock_deadlines"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-467-dora-incident-classifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-467-dora-incident-classifier.html
    title: "public tool page"
---

# DORA ICT Incident Classifier & Reporting Clock

> Exports a decision via MCP `classify_dora_ict_incident_and_clock_deadlines` — mandate type `attestation_mandate`.

**Context:** DORA (EU) 2022/2554 in force January 2025; incident-classification/reporting obligations are ongoing, not a one-time deadline.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-467-dora-incident-classifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-467-dora-incident-classifier.md) — §10.2.
