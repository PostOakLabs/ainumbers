---
type: DecisionTool
title: "NAIC AI Systems Program Readiness Assessment"
description: "Scores insurance AI program readiness against the NAIC AI Model Bulletin (adopted Aug 2020, updated 2023) and the NAIC AI Systems (AIS) Evaluation Tool (2024 edition). Six dimensions scored 0-3 (Not Started/Planning/Partial/Implemented): Governance & Accountability, Risk Management Framework, Data Governance & Bias Monitoring, Testing & Validation, Transparency & Explainability, Complaint & Audit Readiness. Total 0-18; readiness tier: GREEN >= 78% (EXAM_READY), YELLOW >= 44% (IN_PROGRESS), RED < 44% (SIGNIFICANT_GAPS). 24+ states have adopted or substantially adopted the NAIC AI Model Bulletin as of mid-2026; 12-state market-conduct exam pilot ran Jan-Sep 2026 (verify current adoption status with NAIC and your state regulator)."
resource: https://ainumbers.co/chaingraph/art-240-assess-naic-ais-program-readiness.html
tags: ["compliance_mandate", "wave-40", "mcp:assess_naic_ais_program_readiness"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-240-assess-naic-ais-program-readiness.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-240-assess-naic-ais-program-readiness.html
    title: "public tool page"
---

# NAIC AI Systems Program Readiness Assessment

> Exports a decision via MCP `assess_naic_ais_program_readiness` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-240-assess-naic-ais-program-readiness.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [BIFSG Insurance Proxy Bias Threshold Test (Colorado SB 21-169)](./art-239-test-bifsg-bias-thresholds.md)

**Feeds:** _terminal node_
