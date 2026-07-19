---
type: DecisionTool
title: "DPA Article 28 Completeness Checker"
description: "Checks a data processing agreement against GDPR Article 28(3)'s 12 mandatory processor clauses -- subject-matter, duration, nature/purpose, data categories, controller-instructions-only, confidentiality, Article 32 security, sub-processor authorization, data-subject-rights assistance, breach/DPIA assistance, deletion/return, and audit rights. Deterministic checklist over a caller-declared present/missing/weak status per clause, returning a completeness verdict and coverage percentage. This node reads the caller's own compliance reading of an agreement -- it never vendors, assembles, or redistributes any third-party template body. Not legal advice and not a determination that any agreement is compliant. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-409-dpa-art28-completeness-checker.html
tags: ["compliance_mandate", "wave-69", "mcp:check_dpa_gdpr_art28"]
timestamp: 2026-07-14
---

# DPA Article 28 Completeness Checker

> Exports a decision via MCP `check_dpa_gdpr_art28` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-409-dpa-art28-completeness-checker.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
