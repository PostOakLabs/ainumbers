# Redline Round Classifier

Classifies per-segment changes between two negotiation rounds of the same document (paragraph or clause-segmented structured text, pasted or pre-extracted; never parses DOCX or any other binary format). Each declared segment carries a baseline text (the clause as it stood in round 1), a prior text (as it stood in the immediately preceding round), and a current text, and is classified ACCEPTED when current equals prior, REVERTED when current equals baseline after having diverged from it, MODIFIED when current differs from both, NEW when no prior text was declared, or DELETED when no current text was declared. Produces a word-level diff transcript for every changed segment. Round-over-round history is a hash chain: each round after the first declares the execution_hash the node produced for the immediately preceding round's own artifact as prior_round_digest, and a separate chain-verification pass recomputes each prior round's hash from its own content and confirms the next round committed to exactly that value, so a tampered middle round fails the chain check even though its own classification output still looks well-formed. Classifies the type of change only; never scores or evaluates which side a change favors, and is not legal advice. Five-state enum (adds DELETED) is a design borrow from eigenlegal/counsel-os diff_rounds.py (MIT), not a code port; that file has not been read by this node's author. Clause: illustrative only, no jurisdiction's redlining or e-discovery rules are encoded here.

- Page: https://ainumbers.co/chaingraph/art-589-redline-round-classifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-589-redline-round-classifier.md
- MCP tool: classify_redline_round_changes (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- document_id (string, required)
- prior_round_digest (string, required)
- round (unknown, required)
- segments (array, required)

## Outputs

- verdict (string, optional)
- reason (string,null, optional)
- round_summary (object, optional)
- round_chain (object, optional)
- classifications (array, optional)
- diff_transcript (array, optional)
- rejected_inputs (array, optional)
- scope_note (string, optional)
- attribution_note (string, optional)

## Sample

```json
{
  "document_id": "msa-2026-acme",
  "round": {
    "number": 2,
    "label": "Round 2"
  },
  "prior_round_digest": "1111111111111111111111111111111111111111111111111111111111111111",
  "segments": [
    {
      "segment_id": "S1-payment-terms",
      "baseline_text": "Payment is due within 30 days of invoice.",
      "prior_text": "Payment is due within 45 days of invoice.",
      "current_text": "Payment is due within 45 days of invoice."
    },
    {
      "segment_id": "S2-liability-cap",
      "baseline_text": "Liability is capped at fees paid in the prior 12 months.",
      "prior_text": "Liability is capped at 2x fees paid in the prior 12 months.",
      "current_text": "Liability is capped at fees paid in the prior 12 months."
    },
    {
      "segment_id": "S3-termination",
      "baseline_text": "Either party may terminate for convenience on 30 days notice.",
      "prior_text": "Either party may terminate for convenience on 60 days notice.",
      "current_text": "Either party may terminate for convenience on 90 days notice with written approval."
    },
    {
      "segment_id": "S4-data-processing",
      "baseline_text": null,
      "prior_text": null,
      "current_text": "Vendor will process personal data only as instructed by Customer."
    },
    {
      "segment_id": "S5-arbitration",
      "baseline_text": "Disputes are resolved by binding arbitration in Delaware.",
      "prior_text": "Disputes are resolved by binding arbitration in Delaware.",
      "current_text": null
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `classify_redline_round_changes` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
