---
type: DecisionTool
title: "GLEIF Snapshot Digest"
description: "Hash-pins a pasted GLEIF Golden Copy record or file segment as of a caller-stated capture time, so a later reader can tell whether the entity data in front of them is the same data a pack was built from. The digest is taken over the raw pasted bytes, never a parsed, trimmed or re-serialized form, so anyone holding the original file can reproduce it. Reads LastUpdateDate only from the unambiguous CDF XML element; for a CSV row the caller states the value and the output records which of the two it came from. Validates LEI syntax as a courtesy flag (ISO 17442 mod-97, the same check art-246 carries), never as a blocking gate. Zero network: the GLEIF Golden Copy URL is named for the reader, never fetched. This records that these exact bytes were pinned at the stated time. It is not a statement that the record is still current, not a validation of the entity data, and carries no ongoing monitoring duty."
resource: https://ainumbers.co/chaingraph/art-599-gleif-snapshot-digest.html
tags: ["cryptographic_mandate", "wave-99", "mcp:digest_gleif_snapshot"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-599-gleif-snapshot-digest.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-599-gleif-snapshot-digest.html
    title: "public tool page"
---

# GLEIF Snapshot Digest

> Exports a decision via MCP `digest_gleif_snapshot` — mandate type `cryptographic_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-599-gleif-snapshot-digest.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-599-gleif-snapshot-digest.md) — §10.2.
