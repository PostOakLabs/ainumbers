---
type: DecisionTool
title: "ViDA OSS Registration Router"
description: "Route a supply to the correct ViDA Single VAT Registration scheme: Union OSS (EU-established supplier, cross-border B2C or stock transfer within EU), Non-Union OSS (non-EU digital or deemed services to EU consumers), IOSS (non-EU goods ≤EUR 150 to EU consumers), or Domestic VAT (same-MS supply). ViDA extends Union OSS coverage from 2028-07-01. Returns recommended_scheme, scheme_rationale, and eligible_for_oss. Middle node of the vida-platform-and-registration chain. Zero network, zero PII. EU 2025/516."
resource: https://ainumbers.co/chaingraph/art-163-vida-oss-registration-router.html
tags: ["compliance_mandate", "wave-29", "mcp:route_vida_oss_registration"]
timestamp: 2026-07-14
---

# ViDA OSS Registration Router

> Exports a decision via MCP `route_vida_oss_registration` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-163-vida-oss-registration-router.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [ViDA Platform Deemed Supplier Classifier](./art-162-vida-platform-deemed-supplier-classifier.md)

**Feeds:** [ViDA Compliance Readiness Diagnostic](./art-164-vida-compliance-readiness-diagnostic.md)
