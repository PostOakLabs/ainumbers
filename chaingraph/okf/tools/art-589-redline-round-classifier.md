---
type: DecisionTool
title: "Redline Round Classifier"
description: "Classifies per-segment changes between two negotiation rounds of the same document (paragraph or clause-segmented structured text, pasted or pre-extracted; never parses DOCX or any other binary format). Each declared segment carries a baseline text (the clause as it stood in round 1), a prior text (as it stood in the immediately preceding round), and a current text, and is classified ACCEPTED when current equals prior, REVERTED when current equals baseline after having diverged from it, MODIFIED when current differs from both, NEW when no prior text was declared, or DELETED when no current text was declared. Produces a word-level diff transcript for every changed segment. Round-over-round history is a hash chain: each round after the first declares the execution_hash the node produced for the immediately preceding round's own artifact as prior_round_digest, and a separate chain-verification pass recomputes each prior round's hash from its own content and confirms the next round committed to exactly that value, so a tampered middle round fails the chain check even though its own classification output still looks well-formed. Classifies the type of change only; never scores or evaluates which side a change favors, and is not legal advice. Five-state enum (adds DELETED) is a design borrow from eigenlegal/counsel-os diff_rounds.py (MIT), not a code port; that file has not been read by this node's author. Clause: illustrative only, no jurisdiction's redlining or e-discovery rules are encoded here."
resource: https://ainumbers.co/chaingraph/art-589-redline-round-classifier.html
tags: ["compliance_control", "wave-94", "mcp:classify_redline_round_changes"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-589-redline-round-classifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-589-redline-round-classifier.html
    title: "public tool page"
---

# Redline Round Classifier

> Exports a decision via MCP `classify_redline_round_changes` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-589-redline-round-classifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-589-redline-round-classifier.md) — §10.2.
