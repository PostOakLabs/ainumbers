---
type: DecisionTool
title: "ISO 20022 Purpose Code Requirement Checker"
description: "Given a beneficiary country and payment amount, determines whether ExternalPurpose1Code (Purp/Cd) or ExternalCategoryPurpose1Code (CtgyPurp/Cd) is mandatory per BIS CPMI d218 jurisdiction profiles (UAE, India, Bahrain, Jordan, China, Malaysia mandate purpose codes). Also checks SwiftGo eligibility (amount at most $12,500 USD and ExternalCategoryPurpose1Code in accepted set). Outputs purpose_code_compliant, code_type_required, and swiftgo_eligible."
resource: https://ainumbers.co/chaingraph/art-243-purpose-code-requirement-checker.html
tags: ["compliance_mandate", "wave-41", "mcp:check_purpose_code_requirement"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-243-purpose-code-requirement-checker.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-243-purpose-code-requirement-checker.html
    title: "public tool page"
---

# ISO 20022 Purpose Code Requirement Checker

> Exports a decision via MCP `check_purpose_code_requirement` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-243-purpose-code-requirement-checker.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Cross-Border Payment Prevalidation Readiness Scorer](./art-247-prevalidation-readiness-scorer.md)

## Attested computation

[executor + attester binding](../computations/art-243-purpose-code-requirement-checker.md) — §10.2.
