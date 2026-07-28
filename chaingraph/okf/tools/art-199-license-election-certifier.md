---
type: DecisionTool
title: "License Election Certifier"
description: "Binds a license election (family, id, params) to a named asset and licensor DID, producing a deterministic terms_hash via SHA-256 over the JCS-canonical election core. Emits a portable certificate object with all fields needed for downstream verification. Not legal advice. Selection only."
resource: https://ainumbers.co/chaingraph/art-199-license-election-certifier.html
tags: ["cryptographic_mandate", "wave-35", "mcp:certify_license_election"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-199-license-election-certifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-199-license-election-certifier.html
    title: "public tool page"
---

# License Election Certifier

> Exports a decision via MCP `certify_license_election` — mandate type `cryptographic_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-199-license-election-certifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Story PIL Flavor Mapper](./art-197-pil-flavor-mapper.md), [Can't Be Evil License Selector](./art-196-cant-be-evil-license-selector.md), [Creative Commons License Chooser](./art-195-creative-commons-license-chooser.md)

**Feeds:** [License Election Verifier](./art-200-license-election-verifier.md)
