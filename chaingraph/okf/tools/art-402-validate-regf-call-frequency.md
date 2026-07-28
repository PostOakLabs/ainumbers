---
type: DecisionTool
title: "Reg F Call-Frequency Presumption Validator"
description: "Checks a declared debt-collection call log against the two 12 CFR 1006.14(b) Regulation F rebuttable presumptions: more than seven telephone calls to a person on a single debt within any seven consecutive days, and a call placed within seven days after a telephone conversation with that person on that debt. Pure interval counting over declared timestamps under a declared timezone offset; returns per-debt findings and a receipt. Presumptions are rebuttable per 1006.14(b)(3) and this does not determine that harassment occurred."
resource: https://ainumbers.co/chaingraph/art-402-validate-regf-call-frequency.html
tags: ["compliance_mandate", "wave-60", "mcp:validate_regf_call_frequency"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-402-validate-regf-call-frequency.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-402-validate-regf-call-frequency.html
    title: "public tool page"
---

# Reg F Call-Frequency Presumption Validator

> Exports a decision via MCP `validate_regf_call_frequency` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-402-validate-regf-call-frequency.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Debt Validation Notice Completeness Checker](./art-403-check-debt-validation-notice.md)
