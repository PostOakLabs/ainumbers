---
type: DecisionTool
title: "Clause Coverage Scorer"
description: "Scores an agreement's clause coverage against a named clause taxonomy -- the oneSaaS 52-clause canonical set, the Common Paper Language Library, the GDPR Article 28 processor set, or a custom list. Reads a caller-declared present/modified/extra/missing status per clause and returns a coverage percentage, modification rate, and a maturity tier (minimal/partial/substantial/full). Extra clauses are tracked but excluded from the coverage denominator. This node reads the caller's own clause inventory -- it never vendors, assembles, or redistributes any third-party template body. Not legal advice and not a determination that any agreement is compliant. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-410-clause-coverage-scorer.html
tags: ["compliance_mandate", "wave-69", "mcp:score_clause_coverage"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-410-clause-coverage-scorer.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-410-clause-coverage-scorer.html
    title: "public tool page"
---

# Clause Coverage Scorer

> Exports a decision via MCP `score_clause_coverage` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-410-clause-coverage-scorer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
