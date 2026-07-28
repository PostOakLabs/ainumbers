---
type: DecisionTool
title: "Cross-Border Payment Prevalidation Readiness Scorer"
description: "Aggregate CBPR+ pre-validation readiness check for a single pacs.008 payment instruction. Combines IBAN mod-97 check (ISO 13616), BIC format (ISO 9362), LEI format (ISO 17442, presence and format only), UUIDv4 UETR, and PostalAddress24 structure (CBPR+ Nov-2026 hybrid/fully-structured rules) into a single /ready boolean for STP gate use. Gate node for the cross-border-payment-prevalidation chain: ready=true means the instruction passes pre-validation; ready=false means remediation is required."
resource: https://ainumbers.co/chaingraph/art-247-prevalidation-readiness-scorer.html
tags: ["compliance_mandate", "wave-41", "mcp:prevalidation_readiness_scorer"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-247-prevalidation-readiness-scorer.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-247-prevalidation-readiness-scorer.html
    title: "public tool page"
---

# Cross-Border Payment Prevalidation Readiness Scorer

> Exports a decision via MCP `prevalidation_readiness_scorer` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-247-prevalidation-readiness-scorer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [ISO 20022 Purpose Code Requirement Checker](./art-243-purpose-code-requirement-checker.md)

**Feeds:** _terminal node_
