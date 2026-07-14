---
type: DecisionTool
title: "EMIR Lifecycle Event Validator"
description: "Validate an EMIR Refit action type against the prior reported state of the UTI: New/Position are legal on a previously unreported trade; Modify/Correct/Valuation/Terminate/Error require a prior open trade; Revive/Correct/Error apply to terminated trades. Catches the most common Refit rejection cause before Trade Repository submission. Feeds readiness diagnostic (art-158)."
resource: https://ainumbers.co/chaingraph/art-157-emir-lifecycle-event-validator.html
tags: ["compliance_mandate", "wave-28", "mcp:validate_emir_lifecycle_event"]
timestamp: 2026-07-14
---

# EMIR Lifecycle Event Validator

> Exports a decision via MCP `validate_emir_lifecycle_event` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-157-emir-lifecycle-event-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [EMIR Counterparty Pairing Reconciler](./art-156-emir-counterparty-pairing-reconciler.md)

**Feeds:** [EMIR Reporting Readiness Diagnostic](./art-158-emir-reporting-readiness-diagnostic.md)
