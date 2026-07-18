---
type: DecisionTool
title: "AI System Governance Classifier"
description: "Classify an AI system to its governance tier across EU AI Act (prohibited/high-risk/limited-risk/minimal-risk), NIST AI RMF profile (T1 basic/T2 standard/T3 enhanced), and ISO/IEC 42001 control set (light/standard/enhanced). Identifies GPAI provider status and systemic-risk flag. Terminal node of the ai-management-system-conformance chain. EU AI Act Art. 6-17 enforcement from 2 December 2027, per the Digital Omnibus amendments (June 2026); Art. 50 transparency stays 2 August 2026. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-173-ai-system-governance-classifier.html
tags: ["compliance_mandate", "wave-31", "mcp:classify_ai_system_governance"]
timestamp: 2026-07-14
---

# AI System Governance Classifier

> Exports a decision via MCP `classify_ai_system_governance` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-173-ai-system-governance-classifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [AI Risk Impact Assessment Validator](./art-172-ai-risk-impact-assessment-validator.md)

**Feeds:** _terminal node_
