---
type: DecisionTool
title: "Build Adverse Action Notice"
description: "Assembles an adverse action notice skeleton from SHAP-ranked principal-factor codes (FICO reason codes 01-40, VantageScore VS001-VS015). Resolves codes to full human-readable text, orders sections per Reg B §1002.9, and appends the FCRA §615(a) credit score disclosure when a credit score was used in the decision. Exports a receipt artifact. Reg B 12 CFR §1002.9, CFPB Circulars 2022-03/2023-03, FCRA §615(a)."
resource: https://ainumbers.co/chaingraph/art-228-build-adverse-action-notice.html
tags: ["compliance_mandate", "wave-39", "mcp:build_adverse_action_notice"]
timestamp: 2026-07-14
---

# Build Adverse Action Notice

> Exports a decision via MCP `build_adverse_action_notice` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-228-build-adverse-action-notice.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Validate Adverse Action Notice](./art-227-validate-adverse-action-notice.md)
