---
type: DecisionTool
title: "AI-Tool-Usage Workpaper Record"
description: "Composes a documentation-element workpaper record from an existing OCG receipt (tool identity, execution hash, kernel digest), a declared determinism class and conventions, engagement metadata, and a reviewer sign-off statement. Maps to the six elements firms must document for AI/technology-assisted audit evidence under amended AU-C 500 / PCAOB guidance: tool identity, inputs, outputs, limitations, sign-off, and optional linkage to a prior workpaper. An evidence format, not an audit opinion -- makes no PCAOB or AICPA endorsement or compliance-sufficiency claim. An OPTIONAL section-16 eddsa-jcs-2022 signature on the emitted artifact turns the declared sign-off into a countersigned record."
resource: https://ainumbers.co/chaingraph/art-380-build-ai-workpaper-record.html
tags: ["compliance_mandate", "wave-65", "mcp:build_ai_workpaper_record"]
timestamp: 2026-07-14
---

# AI-Tool-Usage Workpaper Record

> Exports a decision via MCP `build_ai_workpaper_record` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-380-build-ai-workpaper-record.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
