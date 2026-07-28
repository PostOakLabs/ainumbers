---
type: DecisionTool
title: "GPAI Code of Practice Conformance"
description: "Check GPAI provider obligations under EU AI Act Art. 53 (technical documentation, training-data summary, copyright policy, model card, 4 base checks) and Art. 55 systemic-risk obligations (risk evaluation, adversarial testing, incident reporting, cybersecurity measures, 4 additional checks for systemic-risk models). Also scores voluntary Code of Practice sign-up. Returns base_score, systemic_score, overall_score, conformant flags, and gap lists. Feeds readiness diagnostic (art-176). GPAI enforcement Aug 2026. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-175-gpai-code-of-practice-conformance.html
tags: ["compliance_mandate", "wave-31", "mcp:check_gpai_code_conformance"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-175-gpai-code-of-practice-conformance.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-175-gpai-code-of-practice-conformance.html
    title: "public tool page"
---

# GPAI Code of Practice Conformance

> Exports a decision via MCP `check_gpai_code_conformance` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-175-gpai-code-of-practice-conformance.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [NIST AI RMF Function Mapper](./art-174-nist-ai-rmf-function-mapper.md)

**Feeds:** [AI Governance Readiness Diagnostic](./art-176-ai-governance-readiness-diagnostic.md)
