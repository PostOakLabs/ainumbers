---
type: DecisionTool
title: "Client Porting Check"
description: "Checks whether a client's cleared positions and collateral are portable to a backup clearing member under a caller-declared porting window, given caller-declared position/collateral completeness and backup-member consent status. Evaluates one caller-supplied snapshot: an empty position set, a missed porting window, and a not-yet-consented backup member each resolve to a distinct, defined not-portable outcome rather than a generic failure. A portable verdict is an evaluation of the supplied snapshot, never a guarantee that porting will in fact occur, and this tool does not itself move any position or collateral. Clause: PFMI Principle 14 (Segregation and Portability), 17 CFR 240.15c3-3a where a broker-dealer customer-protection structure is in view."
resource: https://ainumbers.co/chaingraph/art-532-client-porting-check.html
tags: ["attestation_mandate", "wave-83", "mcp:check_client_porting"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-532-client-porting-check.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-532-client-porting-check.html
    title: "public tool page"
---

# Client Porting Check

> Exports a decision via MCP `check_client_porting` — mandate type `attestation_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-532-client-porting-check.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-532-client-porting-check.md) — §10.2.
