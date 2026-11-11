---
type: DecisionTool
title: "CBR Data Return Validator"
description: "Validates a bank's or money transfer operator's periodic AGGREGATE correspondent-banking data return against an illustrative, profile-driven template (generic first, Pacific second) so an institution can check completeness, internal consistency and comparability locally before submission. Inputs are counts, sums, currency codes, ISO country codes, period dates and enumerated institution types only: per key currency the active correspondent count with relationships opened and terminated or restricted, and outbound and inbound counts and values by corridor country, plus optional message-quality summaries (structure mix and valid-LEI counts) taken from lint_cbpr_structured_address (art-241) and lint_lei_payment_binding (art-246) outputs. Rules: required fields per profile (the Pacific profile requires USD, AUD and NZD present), correspondent roll-forward (closing equals opening plus opened minus terminated), corridor sums against stated currency totals (counts exact, values within a stated 0.5 percent tolerance), period sanity, code membership, single-correspondent key-currency watch, and concentration (top corridor share and a Herfindahl-Hirschman index over corridor shares). Output is verdict, violations by JSON path with rule ids, computed flags, a readiness roll-up band (or not_supplied), the profile and template version -- it never echoes a free-text value. The template is ILLUSTRATIVE: it is not the official Pacific CBR project data collection template (still being finalised by that programme) and not the World Bank CBR Resilience Index (calibration pending). Declared exclusions: aggregate-only -- any string leaf outside the enumerations and the FI-NNN pseudonymous institution code pattern (no names, BIC, LEI or account identifiers in the return itself) is refused by path with the value never echoed; per-message ISO 20022 linting is out of scope (use art-241 and art-246). Swift's CBPR+ structured-address change was deferred on 27 Aug 2026 with an update promised by December 2026 at the latest, so no hard migration date is asserted anywhere; readiness prose anchors on the FATF revised Recommendation 16 (June 2025) payment-transparency direction with its end-2030 transition."
resource: https://ainumbers.co/chaingraph/784-cbr-data-return-validator.html
tags: ["compliance_mandate", "wave-140", "mcp:validate_cbr_data_return"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/784-cbr-data-return-validator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/784-cbr-data-return-validator.html
    title: "public tool page"
---

# CBR Data Return Validator

> Exports a decision via MCP `validate_cbr_data_return` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/784-cbr-data-return-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/784-cbr-data-return-validator.md) — §10.2.
