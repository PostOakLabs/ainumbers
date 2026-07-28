---
type: DecisionTool
title: "Agreement Acceptance Binder"
description: "Binds a party's acceptance to a specific assembled agreement artifact, referenced by its execution_hash, template_id, and vendored body_sha256, never by re-embedding the agreement text. Carries no party identity, only the accepting role and the referenced hashes. An OPTIONAL section-16 eddsa-jcs-2022 signature on the emitted artifact turns this into a countersignable acceptance receipt; an optional previous_proof_hash links a second party's acceptance to the first, forward-compatible with a future proof-chain endorsement. Not legal advice."
resource: https://ainumbers.co/chaingraph/art-277-agreement-acceptance-binder.html
tags: ["compliance_mandate", "wave-49", "mcp:bind_agreement_acceptance"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-277-agreement-acceptance-binder.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-277-agreement-acceptance-binder.html
    title: "public tool page"
---

# Agreement Acceptance Binder

> Exports a decision via MCP `bind_agreement_acceptance` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-277-agreement-acceptance-binder.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Mutual NDA Composer](./art-276-mutual-nda-composer.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-277-agreement-acceptance-binder.md) — §10.2.
