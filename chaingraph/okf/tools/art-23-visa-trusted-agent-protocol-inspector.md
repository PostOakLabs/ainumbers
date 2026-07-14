---
type: DecisionTool
title: "Visa Trusted Agent Protocol (TAP) Signature Inspector"
description: "Parses and scores Visa TAP Signature-Input / Signature header pairs (RFC 9421 HTTP Message Signatures). Runs a 5-question TAP Readiness Assessment. Branch A, node 2 of the Agentic Rail Chain. Promoted from T286."
resource: https://ainumbers.co/chaingraph/art-23-visa-trusted-agent-protocol-inspector.html
tags: ["compliance_control", "wave-A", "mcp:inspect_visa_trusted_agent_protocol"]
timestamp: 2026-07-14
---

# Visa Trusted Agent Protocol (TAP) Signature Inspector

> Exports a decision via MCP `inspect_visa_trusted_agent_protocol` — mandate type `compliance_control`.

**Context:** Visa TAP launched; RFC 9421 stable

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-23-visa-trusted-agent-protocol-inspector.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Agentic Payments Protocol Comparator](./art-22-agentic-payments-protocol-comparator.md), `art-16-google-ap2-mandate-builder` _(not live)_

**Feeds:** [Mastercard Agentic Token Scope Builder](./art-24-mastercard-agentic-token-builder.md), `art-18-mcp-developer-readiness-scorecard` _(not live)_, [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
