---
type: DecisionTool
title: "Quarterly Agent Test Evidence Composer"
description: "Composes a quarterly agent testing-evidence pack: test-suite identity and digest, per-test receipts with an honest deterministic/estimated determinism class, pass rate, and a regression comparison chained to the prior quarter's pack digest. A declared prior-pack digest that does not match the caller-supplied prior record is flagged as a broken chain rather than silently accepted. When the caller declares which sealed subject artifact the pack evidences, the per-test receipt digests wrap as a section-27.6 evidence bundle over that subject. Evidence format only -- never a certification claim. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-378-quarterly-test-evidence-composer.html
tags: ["compliance_mandate", "wave-65", "mcp:build_agent_test_evidence"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-378-quarterly-test-evidence-composer.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-378-quarterly-test-evidence-composer.html
    title: "public tool page"
---

# Quarterly Agent Test Evidence Composer

> Exports a decision via MCP `build_agent_test_evidence` — mandate type `compliance_mandate`.

**Context:** No regulatory deadline; evidence-format tooling run on the adopter's own quarterly test cadence.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-378-quarterly-test-evidence-composer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-378-quarterly-test-evidence-composer.md) — §10.2.
