---
type: DecisionTool
title: "Revocation-Status Verifier"
description: "Reads a revocation bit from an uncompressed status bitstring up to 8 KB, shaped after W3C BitstringStatusList, for a receipt's optional credentialStatus reference, from a supplied, zero-egress status list credential. A real W3C v1.0 BitstringStatusList (GZIP plus multibase u) is refused, not read. A set bit means revoked, and revocation overrides the receipt's own signature validity even when that signature is cryptographically valid. Absence of a credentialStatus reference is its own no-signal state, never treated as evidence of active status. Not-X-use-Y: this kernel checks revocation status only, it does not verify the underlying §16 signature itself."
resource: https://ainumbers.co/chaingraph/art-287-revocation-status-verifier.html
tags: ["compliance_mandate", "wave-52", "mcp:verify_revocation_status"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-287-revocation-status-verifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-287-revocation-status-verifier.html
    title: "public tool page"
---

# Revocation-Status Verifier

> Exports a decision via MCP `verify_revocation_status` — mandate type `compliance_mandate`.

**Context:** Voluntary evidentiary practice per SPEC.md §REVOKE-1 (OPTIONAL, additive profile); no statutory deadline.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-287-revocation-status-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-287-revocation-status-verifier.md) — §10.2.
