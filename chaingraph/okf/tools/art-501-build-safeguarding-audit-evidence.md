---
type: DecisionTool
title: "CASS 15 Safeguarding Audit Evidence Pack"
description: "Assembles the evidence set a qualified auditor asks a UK payment or e-money firm for at the start of a CASS 15 safeguarding audit: the reconciliation results across the declared audit period, the safeguarding method classification, a schedule of the matters those raise keyed by the individual rule reference with a management response recorded against each item, and the section 27 accountability trail over the firm's own reconciliation export. It is the first consumer of the section 27.4 attested-artifact subject class: the export is a non-OCG producer's sealed output, so its subject identifier is computed by art-502-bind-attested-subject and echoed here verbatim rather than recomputed, because a second implementation of that preimage would be a second canon. The trail counts distinct identities, never records and never signing keys; an unsigned approval record is not conformant evidence and holds the role rather than passing it; an agent identity does not satisfy a human role absent an explicit human-role mandate; and because this surface reads no clock a time-boxed override can never resolve to a silent auto-pass. Stated limit, normative: the attested subject evidences producer pinning, input binding and content integrity, never that the arithmetic inside the firm's export is correct, and the artifact omits replay_verified entirely rather than setting it false because no replay was attempted. This pack expresses neither of the two audit opinions, systems adequacy throughout the period and compliance at the period end, which belong to the safeguarding auditor and are emitted as open slots naming who decides. It records no breach, it is evidence assembled for the engagement rather than a filing, it is not submittable to the FCA, and it does not discharge the audit."
resource: https://ainumbers.co/chaingraph/art-501-build-safeguarding-audit-evidence.html
tags: ["compliance_mandate", "wave-78", "mcp:build_safeguarding_audit_evidence"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-501-build-safeguarding-audit-evidence.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-501-build-safeguarding-audit-evidence.html
    title: "public tool page"
---

# CASS 15 Safeguarding Audit Evidence Pack

> Exports a decision via MCP `build_safeguarding_audit_evidence` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-501-build-safeguarding-audit-evidence.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-501-build-safeguarding-audit-evidence.md) — §10.2.
