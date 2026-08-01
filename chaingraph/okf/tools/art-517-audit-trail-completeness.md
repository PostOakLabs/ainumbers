---
type: DecisionTool
title: "Audit-Trail Completeness Attestation"
description: "Attests that an audit log covering transactions and user activity is complete and gap-free over a caller-declared window, against a caller-declared continuity mechanism: sequence numbers, hash-chain links, or periodic control totals. Enumerates gap position where the mechanism can localize one, reports privileged-action coverage separately from transaction coverage (a trail that logs transactions but not administrator actions fails the 'and user activities' requirement explicitly), checks retention conformance, and reports an undecidable list where the declared mechanism cannot support a position-level verdict (control totals confirm a period is short but cannot localize which event is missing). No log ingestion, no vendor log format parsing -- the caller supplies counts and the declared mechanism only. Zero PII: users are role classes and opaque refs, never a username, email, or IP. Region-portable: window, retention requirement, and mechanism are entirely caller-declared inputs, with no country, currency, scheme, or statute hardcoded. Disambiguation: art-237-validate-agent-audit-trail validates the field structure of one IETF AAT agent-to-agent record; cry-05-agent-action-audit-trail-aggregator builds a Merkle root over this suite's own execution receipts. Neither evaluates a window, detects a gap across a population of external log events, or checks privileged-action coverage -- that is this node."
resource: https://ainumbers.co/chaingraph/art-517-audit-trail-completeness.html
tags: ["compliance_mandate", "wave-80", "mcp:validate_audit_trail_completeness"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-517-audit-trail-completeness.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-517-audit-trail-completeness.html
    title: "public tool page"
---

# Audit-Trail Completeness Attestation

> Exports a decision via MCP `validate_audit_trail_completeness` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-517-audit-trail-completeness.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-517-audit-trail-completeness.md) — §10.2.
