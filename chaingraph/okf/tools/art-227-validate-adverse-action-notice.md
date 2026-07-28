---
type: DecisionTool
title: "Validate Adverse Action Notice"
description: "Validates an adverse action notice against Reg B §1002.9 completeness requirements: reason count (max 4), prohibited vague reason codes (CFPB Circulars 2022-03/2023-03), required content fields (creditor name, date, statement of rights), and FCRA §615(a) rights disclosure when a credit score was used. Outputs compliance_score (0-100), violation list, and a remediation checklist. Reg B 12 CFR §1002.9, ECOA 15 USC §1691, FCRA §615(a)."
resource: https://ainumbers.co/chaingraph/art-227-validate-adverse-action-notice.html
tags: ["compliance_mandate", "wave-39", "mcp:validate_adverse_action_notice"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-227-validate-adverse-action-notice.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-227-validate-adverse-action-notice.html
    title: "public tool page"
---

# Validate Adverse Action Notice

> Exports a decision via MCP `validate_adverse_action_notice` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-227-validate-adverse-action-notice.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Build Adverse Action Notice](./art-228-build-adverse-action-notice.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-227-validate-adverse-action-notice.md) — §10.2.
