---
type: DecisionTool
title: "IDV/KYC Verification-Failure Incident Composer"
description: "Composes a structured verification-failure/fraud-attempt incident record from an IDV/KYC session for fraud teams, regulators, and insurers: a cross-link to the session's hash-chained receipt (art-359), an honest failure classification (type + AR4SI severity tier), session evidence digests, remediation status, and an optional cross-link to an escalation record or a signed failure receipt. Reuses the art-379 agent-incident-record shape and vocabulary. A missing session-receipt link degrades the record's claim strength rather than being silently accepted, and a malformed cross-link hash is flagged, not hidden. This is an evidence format for an incident the caller declares, not a fraud-detection system, not a determination of fault, and not a regulatory or insurance adjudication. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-418-idv-verification-failure-incident-composer.html
tags: ["compliance_mandate", "wave-62", "mcp:build_idv_verification_incident_record"]
timestamp: 2026-07-14
---

# IDV/KYC Verification-Failure Incident Composer

> Exports a decision via MCP `build_idv_verification_incident_record` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-418-idv-verification-failure-incident-composer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [IDV/KYC Session Evidence Receipt Builder](./art-359-idv-session-receipt-builder.md)

**Feeds:** _terminal node_
