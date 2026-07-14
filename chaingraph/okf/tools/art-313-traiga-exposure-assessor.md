---
type: DecisionTool
title: "TRAIGA Exposure Assessor"
description: "Assesses supplied Texas AI-deployment attributes and intentional-use assertions against the Texas Responsible AI Governance Act (TRAIGA, HB 149, eff. 2026-01-01): applicability flag plus prohibited-use-category matches (intentional self-harm/violence/illegal-activity incitement, intentional unlawful discrimination, illegal sexual content, child impersonation). Asserts the supplied inputs replay to this exposure finding, never that a violation has legally occurred (TRAIGA's intent standard is a separate legal determination this kernel does not make). Root node of the traiga-safe-harbor chain. Not the same as the EU AI Act or Colorado high-risk classifiers. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-313-traiga-exposure-assessor.html
tags: ["compliance_mandate", "wave-55", "mcp:assess_traiga_exposure"]
timestamp: 2026-07-14
---

# TRAIGA Exposure Assessor

> Exports a decision via MCP `assess_traiga_exposure` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-313-traiga-exposure-assessor.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [TRAIGA Safe Harbor Pack Builder](./art-314-traiga-safe-harbor-pack-builder.md)
