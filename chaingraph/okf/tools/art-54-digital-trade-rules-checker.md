---
type: DecisionTool
title: "Digital Trade Rules Compliance Checker"
description: "Machine-checks a digital trade presentation (digital LC, collection, or open-account transaction) against the ICC digital rulebooks: eUCP v2.1, eURC v1.1, URDTT v1.0. Produces a discrepancy list with article citations, severity ratings, and remediation actions."
resource: https://ainumbers.co/chaingraph/art-54-digital-trade-rules-checker.html
tags: ["scheme_rule", "wave-12", "mcp:check_digital_trade_rules"]
timestamp: 2026-07-14
---

# Digital Trade Rules Compliance Checker

> Exports a decision via MCP `check_digital_trade_rules` — mandate type `scheme_rule`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-54-digital-trade-rules-checker.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Digital Trade Corridor Fit Diagnostic](./art-52-digital-trade-fit-diagnostic.md)

**Feeds:** [EN 16931 / Factur-X E-Invoicing Batch Validator](./art-08-en16931-einvoice-batch-validator.md), [Trade Document Provenance & Consistency Verifier](./art-55-trade-document-provenance-verifier.md)
