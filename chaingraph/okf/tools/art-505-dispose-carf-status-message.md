---
type: DecisionTool
title: "CARF Status Message Disposition"
description: "Turns a returned Crypto-Asset Reporting Framework or DAC8 status message into a dispositioned break list: every file-level and record-level error the authority reported, tied to the record and the field that caused it, with the disposition that answers it. The differentiator is that a disposition signed in an earlier reporting cycle is carried forward against the same break reference, keeping the named signer and the originating cycle attached, so the answer to why an error is still open survives from one cycle to the next. A disposition is countable only when it is signed by a named signer: an unsigned one is rejected with its reason and the break stays open, because an unsigned disposition is a note rather than accountable evidence. The return path is not assumed. The OECD status message schema is an instrument for one competent authority to report errors back to another, and the OECD states it may also be used for domestic reporting to the extent the relevant jurisdiction's own law permits, which is a permission and not a guarantee. So the operator must declare that its jurisdiction returns a status message and name the channel; absent that declaration the node returns a stated verdict and produces no break list rather than implying a file came back. A deactivation list is a first-class input: a suppressed error code produces no break at all and the suppression is counted in the artifact. A record-level error whose document reference matches nothing in the submitted set is itself reported, because an operator that cannot say which record the authority is complaining about has a finding of its own. Error codes arrive as data and the schema version is a pinned policy input, never kernel source. Zero personal data by construction: records are identified by opaque references only. No clock is read, so cycle references are declared strings and nothing silently expires. Stated boundary: this dispositions a file the operator already holds. It does not fetch, submit or transmit anything, it makes no claim that any output is submittable, and it is not legal or tax advice."
resource: https://ainumbers.co/chaingraph/art-505-dispose-carf-status-message.html
tags: ["compliance_mandate", "wave-78", "mcp:dispose_carf_status_message"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-505-dispose-carf-status-message.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-505-dispose-carf-status-message.html
    title: "public tool page"
---

# CARF Status Message Disposition

> Exports a decision via MCP `dispose_carf_status_message` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-505-dispose-carf-status-message.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [CARF / DAC8 Reportable User Classifier](./art-504-classify-carf-reportable.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-505-dispose-carf-status-message.md) — §10.2.
