---
type: DecisionTool
title: "License Election Verifier"
description: "Verifies a certificate produced by the License Election Certifier by recomputing the SHA-256 terms_hash over the JCS-canonical election core and comparing it against the stored hash. Returns verdict (valid | binding_mismatch | incomplete_fields | malformed), binding_ok flag, recomputed_terms_hash, and per-check results. Not legal advice."
resource: https://ainumbers.co/chaingraph/art-200-license-election-verifier.html
tags: ["cryptographic_mandate", "wave-35", "mcp:verify_license_election"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-200-license-election-verifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-200-license-election-verifier.html
    title: "public tool page"
---

# License Election Verifier

> Exports a decision via MCP `verify_license_election` — mandate type `cryptographic_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-200-license-election-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [License Election Certifier](./art-199-license-election-certifier.md)

**Feeds:** _terminal node_
