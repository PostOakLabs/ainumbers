---
type: DecisionTool
title: "Sanctions & Export-Control Screening Fit Diagnostic"
description: "12-param A-F diagnostic scoping a firm's sanctions/export-control screening program (50%-rule ownership, list coverage, fuzzy-match calibration, ECCN classification, circumvention controls) and routing to the right sanctions/export-control chain. Operates on program config only -- no real customer data."
resource: https://ainumbers.co/chaingraph/art-90-sanctions-screening-fit-diagnostic.html
tags: ["agent_guardrail_mandate", "wave-19", "mcp:run_sanctions_screening_fit"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-90-sanctions-screening-fit-diagnostic.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-90-sanctions-screening-fit-diagnostic.html
    title: "public tool page"
---

# Sanctions & Export-Control Screening Fit Diagnostic

> Exports a decision via MCP `run_sanctions_screening_fit` — mandate type `agent_guardrail_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-90-sanctions-screening-fit-diagnostic.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Ownership 50%-Rule Aggregator](./art-91-ownership-50pct-aggregator.md), [Screening List-Coverage Checker](./art-92-screening-list-coverage-checker.md), [Fuzzy-Match Calibration Scorer](./art-93-fuzzy-match-calibration-scorer.md), [ECCN / Dual-Use Classifier](./art-94-eccn-dual-use-classifier.md), [Circumvention Diligence Assessor](./art-95-circumvention-diligence-assessor.md), [Agent-Action Audit-Trail Aggregator](./cry-05-agent-action-audit-trail-aggregator.md)
