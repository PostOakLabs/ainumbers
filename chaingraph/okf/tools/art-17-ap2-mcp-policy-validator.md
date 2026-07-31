---
type: DecisionTool
title: "AP2/MCP Policy Validator"
description: "Validates a caller-supplied payload against the AINumbers Unified Build Contract v1.0 Policy Mandate field set (ap2_version, mandate_id, tool_id, mandate_type, jurisdiction, audit_metadata, and related fields), scoring compliance 0-100 and flagging deprecated fields. Stage 3 of the Agentic Policy Chain. Deterministic, zero PII, no external network calls."
resource: https://ainumbers.co/chaingraph/art-17-ap2-mcp-policy-validator.html
tags: ["scheme_rule", "wave-ORPHANNODE-ONBOARD-2", "mcp:validate_ap2_mandate_credential"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-17-ap2-mcp-policy-validator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-17-ap2-mcp-policy-validator.html
    title: "public tool page"
---

# AP2/MCP Policy Validator

> Exports a decision via MCP `validate_ap2_mandate_credential` — mandate type `scheme_rule`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-17-ap2-mcp-policy-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Google AP2 Mandate Builder](./art-16-google-ap2-mandate-builder.md), [Agentic Payments Readiness Diagnostic](./art-27-agentic-readiness-diagnostic.md)

**Feeds:** [MCP Developer Readiness Scorecard](./art-18-mcp-developer-readiness-scorecard.md)

## Attested computation

[executor + attester binding](../computations/art-17-ap2-mcp-policy-validator.md) — §10.2.
