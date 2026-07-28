---
type: DecisionTool
title: "CRA Vulnerability Reporting Readiness (Art. 14)"
description: "Assesses EU CRA Article 14 vulnerability reporting readiness: actively_exploited_detection, 24-hour early_warning_24h_process, 72-hour notification_72h_process, csirt_enisa_endpoint_configured, and coordinated_disclosure_policy. Obligation date: 11 Sep 2026. Penalty: up to €15M or 2.5% global turnover. Emits vuln_reporting_ready verdict with PDF export. Terminal stage of cra-product-conformance chain."
resource: https://ainumbers.co/chaingraph/art-140-cra-vuln-reporting-readiness.html
tags: ["compliance_mandate", "wave-25", "mcp:assess_cra_vuln_reporting_readiness"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-140-cra-vuln-reporting-readiness.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-140-cra-vuln-reporting-readiness.html
    title: "public tool page"
---

# CRA Vulnerability Reporting Readiness (Art. 14)

> Exports a decision via MCP `assess_cra_vuln_reporting_readiness` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-140-cra-vuln-reporting-readiness.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [CRA Annex I Completeness Checker](./art-139-cra-annex1-completeness-checker.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-140-cra-vuln-reporting-readiness.md) — §10.2.
