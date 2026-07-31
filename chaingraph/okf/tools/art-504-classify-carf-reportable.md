---
type: DecisionTool
title: "CARF / DAC8 Reportable User Classifier"
description: "Classifies crypto-asset user records and their transactions for Crypto-Asset Reporting Framework and DAC8 purposes, against a policy set the caller declares rather than one this node asserts: which residence jurisdictions the reporting jurisdiction treats as reportable, which transaction classes are in scope, the due-diligence rule set keyed by the caller's own rule codes, and the pinned schema version. Nothing about any jurisdiction's transposition is in kernel source, so the node states no view on how a jurisdiction has implemented CARF or DAC8. A deactivation list is a first-class input: a suppressed rule code produces no unsatisfied due-diligence step at all for any record, and every suppression applied is echoed with a count so the exclusion is visible rather than silent. Self-certification is the gating step. Anything other than a valid self-certification leaves reportability undetermined rather than guessed, and an undetermined verdict is never a bare flag: each carries an entry naming what is undetermined, which input would resolve it, and the role that decides. Entity records fold controlling-person residences into the determination, so an entity outside the reportable set whose controlling person is inside it is caught. Transactions are classified only once the user is classifiable. Output is counts by verdict and by transaction class, never a ratio and never a percentage. Zero personal data by construction: users are identified by an opaque caller-supplied reference, and the node takes no name, no tax identification number, no address and no date of birth. No clock is read, so the reporting period is a declared input and nothing silently expires. Stated boundary: this classifies only. It computes no tax liability, it submits and transmits nothing, it makes no claim that its output is submittable, and it is not legal or tax advice."
resource: https://ainumbers.co/chaingraph/art-504-classify-carf-reportable.html
tags: ["compliance_mandate", "wave-78", "mcp:classify_carf_reportable"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-504-classify-carf-reportable.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-504-classify-carf-reportable.html
    title: "public tool page"
---

# CARF / DAC8 Reportable User Classifier

> Exports a decision via MCP `classify_carf_reportable` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-504-classify-carf-reportable.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [CARF Status Message Disposition](./art-505-dispose-carf-status-message.md)

## Attested computation

[executor + attester binding](../computations/art-504-classify-carf-reportable.md) — §10.2.
