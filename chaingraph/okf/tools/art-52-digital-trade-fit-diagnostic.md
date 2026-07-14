---
type: DecisionTool
title: "Digital Trade Corridor Fit Diagnostic"
description: "12-question A–F readiness diagnostic for digital trade / electronic trade documents (MLETR). Grades corridor legality, document digitisation, platform connectivity, trade-rule basis (eUCP/URDTT), financing, and AML/TBML controls; routes to the right chain and emits a remediation checklist."
resource: https://ainumbers.co/chaingraph/art-52-digital-trade-fit-diagnostic.html
tags: ["agent_guardrail_mandate", "wave-12", "mcp:run_digital_trade_fit"]
timestamp: 2026-07-14
---

# Digital Trade Corridor Fit Diagnostic

> Exports a decision via MCP `run_digital_trade_fit` — mandate type `agent_guardrail_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-52-digital-trade-fit-diagnostic.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [MLETR / eBL Conformance & Enforceability Validator](./art-53-mletr-ebl-conformance-validator.md), [Digital Trade Rules Compliance Checker](./art-54-digital-trade-rules-checker.md), [Trade Document Provenance & Consistency Verifier](./art-55-trade-document-provenance-verifier.md), [Canton Party Allowlist Validator](./509-canton-party-allowlist-validator.md), [AMLA Transaction-Typology Risk Scorer](./art-10-amla-transaction-typology-risk-scorer.md), [Credit Default Risk Scorer](./ml-02-credit-default-risk-scorer.md), [Agent-Action Audit-Trail Aggregator](./cry-05-agent-action-audit-trail-aggregator.md)
