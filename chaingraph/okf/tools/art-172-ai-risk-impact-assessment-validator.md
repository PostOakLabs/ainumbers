---
type: DecisionTool
title: "AI Risk Impact Assessment Validator"
description: "Validate ISO 42005-style AI impact-assessment completeness across seven required elements: intended use, affected stakeholders (>=1), risk treatment definition, monitoring plan, formal approval, risk category identification (>=1), and data source documentation. Returns completeness_score (0-100) and gaps list. Feeds system governance classifier (art-173). Zero network, zero PII. ISO/IEC 42005."
resource: https://ainumbers.co/chaingraph/art-172-ai-risk-impact-assessment-validator.html
tags: ["compliance_mandate", "wave-31", "mcp:validate_ai_impact_assessment"]
timestamp: 2026-07-14
---

# AI Risk Impact Assessment Validator

> Exports a decision via MCP `validate_ai_impact_assessment` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-172-ai-risk-impact-assessment-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [ISO 42001 AIMS Clause Conformance](./art-171-iso42001-aims-clause-conformance.md)

**Feeds:** [AI System Governance Classifier](./art-173-ai-system-governance-classifier.md)
