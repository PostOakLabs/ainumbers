---
type: DecisionTool
title: "UCP 600 / ISBP 745 Document Examination Assembler"
description: "Recomputes the letter-of-credit document examination a checker already works from a paper checklist inside the 5-banking-day window, from structured fields the checker has transcribed off the presentation -- no OCR, no document upload, no parsing of any document image or free text. Checks presentation timing against the credit's expiry date and the UCP 600 Art. 14(c) 21-calendar-day-after-shipment window (or the credit's own stated period); the Art. 14(b) 5-banking-day examination-window deadline when an examination-completion date is declared; Art. 30 quantity and amount tolerances, +/-5% or +/-10% when the credit qualifies the figure with 'about'; the Art. 28(f)(ii) insurance floor against the declared CIF/CIP value; cross-document consistency under Art. 14(d)/(e), including named-port conflicts and a checker-declared goods-description conformity flag; and draft tenor arithmetic against the credit's stipulated tenor. Every finding cites its article number. Verdict COMPLYING_PRESENTATION when no discrepancy is found, DISCREPANT when at least one is, INDETERMINATE when a required input (the credit amount or quantity, the expiry or latest-shipment date, the presentation date, or the invoice/transport-document fields) is absent. This is the examination side of the LC lifecycle -- the companion tool tools/420-mt700-lc-field-validator.html validates the MT700 issuance message; the two are cross-linked, not duplicated. UCP 600 and ISBP 745 are cited by article/paragraph number only; their text is ICC copyright and is never reproduced, and this tool carries no claim of ICC endorsement."
resource: https://ainumbers.co/chaingraph/art-570-ucp600-document-examination-assembler.html
tags: ["compliance_control", "wave-93", "mcp:examine_lc_document_presentation"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-570-ucp600-document-examination-assembler.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-570-ucp600-document-examination-assembler.html
    title: "public tool page"
---

# UCP 600 / ISBP 745 Document Examination Assembler

> Exports a decision via MCP `examine_lc_document_presentation` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-570-ucp600-document-examination-assembler.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-570-ucp600-document-examination-assembler.md) — §10.2.
