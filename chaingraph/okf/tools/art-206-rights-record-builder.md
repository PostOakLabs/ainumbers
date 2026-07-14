---
type: DecisionTool
title: "Rights Record Builder"
description: "Builds a normalized IP3-style rights-portfolio row from licensor, licensee, territory, term, rights vector, and renewal fields. Computes a deterministic record_hash via SHA-256 over the JCS-canonical rights row. Not legal advice. Documentation of stated parameters only."
resource: https://ainumbers.co/chaingraph/art-206-rights-record-builder.html
tags: ["compliance_mandate", "wave-35", "mcp:build_rights_record"]
timestamp: 2026-07-14
---

# Rights Record Builder

> Exports a decision via MCP `build_rights_record` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-206-rights-record-builder.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [License Terms Assembler](./art-205-license-terms-assembler.md)

**Feeds:** _terminal node_
