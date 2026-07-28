---
type: DecisionTool
title: "Agent Audit Trail Conformance Validator (IETF AAT)"
description: "Validates agent audit trail records against IETF draft-sharif-agent-audit-trail-00 (AAT, expires Sept 2026). Checks required fields (agent_identity, action_class, outcome, trust_level, timestamp), sha256_prev_record chain-link format (/^[0-9a-f]{64}$/ or empty for first record), ECDSA signature presence, and enum conformance for action_class / outcome / trust_level. Returns conformance_result: CONFORMANT | PARTIAL | NON_CONFORMANT | EMPTY_INPUT with aat_completeness_score and validation_errors. Disambiguates from the RFC 9421 HTTP message signature nodes (art-129..132): those validate HTTP message signatures; this node validates agent-to-agent audit trail records per the IETF AAT draft."
resource: https://ainumbers.co/chaingraph/art-237-validate-agent-audit-trail.html
tags: ["compliance_mandate", "wave-40", "mcp:validate_agent_audit_trail"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-237-validate-agent-audit-trail.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-237-validate-agent-audit-trail.html
    title: "public tool page"
---

# Agent Audit Trail Conformance Validator (IETF AAT)

> Exports a decision via MCP `validate_agent_audit_trail` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-237-validate-agent-audit-trail.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [AI Decision Log Record Builder (EU AI Act Art 12)](./art-236-build-ai-decision-log-record.md)

**Feeds:** _terminal node_
