---
type: DecisionTool
title: "AP2 Prompt Template Generator"
description: "Transforms any ChainGraph artifact JSON into a structured, regulator-framed prompt for any external LLM. Template registry v1.0.0 — one entry per mandate_type with regulatory citations, audience framing, stochastic-output conventions, escalation conditions."
resource: https://ainumbers.co/chaingraph/ptg-01-ap2-prompt-template-generator.html
tags: ["prompt_template", "wave-1", "mcp:compose_ap2_prompt"]
timestamp: 2026-06-18T15:18:23.408Z
---

# AP2 Prompt Template Generator

> Exports a decision via MCP `compose_ap2_prompt` — mandate type `prompt_template`.

**Context:** Chains into all tools — the execution-hash citation footer makes every LLM narrative traceable

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/ptg-01-ap2-prompt-template-generator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [every tool in the suite](./index.md)
