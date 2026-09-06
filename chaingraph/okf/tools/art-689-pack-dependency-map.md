---
type: DecisionTool
title: "Pack Dependency Map"
description: "Maps the blast radius of a changed component across caller-declared pack-to-component usage lists: each declared pack carries the component identifiers it declares, and the kernel emits the impacted-pack set (in declared order), the impact count, a trace restating the membership count, and an overall verdict (IMPACT_MAPPED when at least one declared usage list contains the changed component; NO_IMPACT when none does). Every impacted pack is a direct (depth-1) consumer: the kernel maps membership in the declared lists only; it computes no transitive closure and claims no observation of any real repository, registry, or build system. The impacted-pack export is a registry export intended for the drift sweep's allowlist decisions. Zero storage, zero network, no runtime clock."
resource: https://ainumbers.co/chaingraph/art-689-pack-dependency-map.html
tags: ["compliance_control", "wave-117", "mcp:compute_pack_dependency_map"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-689-pack-dependency-map.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-689-pack-dependency-map.html
    title: "public tool page"
---

# Pack Dependency Map

> Exports a decision via MCP `compute_pack_dependency_map` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-689-pack-dependency-map.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-689-pack-dependency-map.md) — §10.2.
