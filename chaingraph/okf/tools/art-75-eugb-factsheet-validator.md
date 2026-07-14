---
type: DecisionTool
title: "EU Green Bond Factsheet & Allocation Validator"
description: "Validates an EuGB factsheet (Annex I) + allocation report (Annex II) for completeness and the 100% Taxonomy-aligned proceeds threshold, cross-checking against ART-73 alignment of the funded activities. EuGB Reg. (EU) 2023/2631 applies since 21 Dec 2024; external-reviewer RTS 12 Mar 2026."
resource: https://ainumbers.co/chaingraph/art-75-eugb-factsheet-validator.html
tags: ["compliance_mandate", "wave-16", "mcp:validate_eugb_factsheet"]
timestamp: 2026-07-14
---

# EU Green Bond Factsheet & Allocation Validator

> Exports a decision via MCP `validate_eugb_factsheet` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-75-eugb-factsheet-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Carbon & Climate Compliance Fit Diagnostic](./art-68-carbon-compliance-fit-diagnostic.md), [EU Taxonomy Alignment Scorer](./art-73-taxonomy-alignment-scorer.md)

**Feeds:** [Merkle Batch Verifier](./cry-04-merkle-batch-verifier.md)
