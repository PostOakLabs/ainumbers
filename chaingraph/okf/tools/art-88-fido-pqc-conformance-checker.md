---
type: DecisionTool
title: "FIDO2 / WebAuthn PQC Conformance Checker"
description: "Validates FIDO2/WebAuthn authenticator ML-DSA conformance vs IANA COSE algorithm registry identifiers and CTAP2.3 minimum version. Checks COSE identifier presence and CTAP version. Scoped to credential crypto-suite migration -- credential FORMAT/protocol conformance belongs to any future EUDI wave."
resource: https://ainumbers.co/chaingraph/art-88-fido-pqc-conformance-checker.html
tags: ["compliance_mandate", "wave-18", "mcp:check_fido_pqc_conformance"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-88-fido-pqc-conformance-checker.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-88-fido-pqc-conformance-checker.html
    title: "public tool page"
---

# FIDO2 / WebAuthn PQC Conformance Checker

> Exports a decision via MCP `check_fido_pqc_conformance` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-88-fido-pqc-conformance-checker.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [PQC Timeline & Migration Fit Diagnostic](./art-85-pqc-timeline-fit-diagnostic.md)

**Feeds:** [Agent-Action Audit-Trail Aggregator](./cry-05-agent-action-audit-trail-aggregator.md)
