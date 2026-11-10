---
type: DecisionTool
title: "UCP Capability Negotiation"
description: "Intersects the UCP capability sets two pasted profiles advertise: keeps the capabilities named by both sides at their highest mutually supported dated version, applies each extension's requires bounds, prunes extensions whose parents did not survive, and reports profile-shape findings (canonical keys[] placement, namespace authority binding against the reversed schema host, dev.ucp.* release pinning, protocol version format). Verify-only: decides from the two pasted profile objects and never fetches profiles, leaf documents, or schemas."
resource: https://ainumbers.co/chaingraph/art-820-negotiate-ucp-capabilities.html
tags: ["compliance_mandate", "wave-142", "mcp:negotiate_ucp_capabilities"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-820-negotiate-ucp-capabilities.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-820-negotiate-ucp-capabilities.html
    title: "public tool page"
---

# UCP Capability Negotiation

> Exports a decision via MCP `negotiate_ucp_capabilities` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-820-negotiate-ucp-capabilities.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-820-negotiate-ucp-capabilities.md) — §10.2.
