---
type: DecisionTool
title: "FATCA/CRS Submission Conformance Check"
description: "Evaluates a FATCA/CRS submission record set against a policy-supplied schema version and business-rule set: DocTypeIndic sequencing (the public OECD CRS/FATCA XML Schema v2.0 new/corrected/void enumeration), MessageRefId/DocRefId uniqueness, CorrDocRefId referencing across corrected and voided records, mandatory-identifier structural checks (TIN presence, BirthDate format, address completeness), and the caller's own mandatory_element_rules array keyed by a published error code and element path. A suppression_list (F3) excludes stood-down rule codes from producing any finding at all, with an audit-trail count of what was suppressed. Schema versions and error-code sets are pinned policy inputs, never kernel source. Ahead of the annual Responsible Officer certification; feeds art-491 ro-remediation-closure. Not a validator competing on schema coverage -- free FATCA/CRS XML validators already exist -- the claim is the sealed, offline-verifiable evidence chain from submission error through remediation to a named RO signature."
resource: https://ainumbers.co/chaingraph/art-490-fatca-crs-submission-check.html
tags: ["compliance_mandate", "wave-77", "mcp:check_fatca_crs_submission_conformance"]
timestamp: 2026-07-14
---

# FATCA/CRS Submission Conformance Check

> Exports a decision via MCP `check_fatca_crs_submission_conformance` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-490-fatca-crs-submission-check.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
