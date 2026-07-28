---
type: DecisionTool
title: "EMIR UTI Completeness Checker"
description: "Validate EMIR Refit UTI format (ISO 23897, 52 alphanumeric characters max), generating-party identity, and T+1 sharing timing: UTI must be shared with the other counterparty by 10:00 CET next business day (approximately 34-hour window). Caller supplies Unix timestamps. Catches late or malformed UTIs before Trade Repository submission. Feeds UPI validator (art-155)."
resource: https://ainumbers.co/chaingraph/art-154-emir-uti-completeness-checker.html
tags: ["compliance_mandate", "wave-28", "mcp:check_emir_uti_completeness"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-154-emir-uti-completeness-checker.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-154-emir-uti-completeness-checker.html
    title: "public tool page"
---

# EMIR UTI Completeness Checker

> Exports a decision via MCP `check_emir_uti_completeness` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-154-emir-uti-completeness-checker.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [EMIR Trade Report Field Validator](./art-153-emir-trade-report-field-validator.md)

**Feeds:** [EMIR UPI Validator](./art-155-emir-upi-validator.md)

## Attested computation

[executor + attester binding](../computations/art-154-emir-uti-completeness-checker.md) — §10.2.
