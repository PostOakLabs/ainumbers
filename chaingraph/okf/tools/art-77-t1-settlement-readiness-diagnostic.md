---
type: DecisionTool
title: "T+1 Settlement Readiness Diagnostic"
description: "12-question A-F diagnostic scoring a firm's readiness for the coordinated EU/UK/CH T+1 move (11 Oct 2027) against the Industry Roadmap phases, grading trade-date allocation/confirmation (the Dec-2026 23:00 CET machine-readable mandate), SSI automation, funding compression and CSDR-penalty exposure, and routing to the right settlement-discipline chain."
resource: https://ainumbers.co/chaingraph/art-77-t1-settlement-readiness-diagnostic.html
tags: ["agent_guardrail_mandate", "wave-17", "mcp:run_t1_readiness_diagnostic"]
timestamp: 2026-07-14
---

# T+1 Settlement Readiness Diagnostic

> Exports a decision via MCP `run_t1_readiness_diagnostic` — mandate type `agent_guardrail_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-77-t1-settlement-readiness-diagnostic.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [CSDR Cash-Penalty Calculator](./art-78-csdr-penalty-calculator.md), [Settlement-Fail Predictor](./art-79-settlement-fail-predictor.md), [SSI Conformance Checker](./art-80-ssi-conformance-checker.md), [Allocation/Affirmation Conformance Checker](./art-81-allocation-affirmation-conformance.md), [Securities-Settlement Message Linter (ISO 20022 sese/semt)](./art-82-securities-settlement-message-linter.md), [Buy-In Exposure Modeler](./art-83-buy-in-exposure-modeler.md), [Agent-Action Audit-Trail Aggregator](./cry-05-agent-action-audit-trail-aggregator.md)
