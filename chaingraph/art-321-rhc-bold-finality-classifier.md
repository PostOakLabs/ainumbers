# BoLD Challenge-Window Finality Classifier

Classifies a settlement-finality claim on Robinhood Chain, an Arbitrum Orbit dedicated blockchain using BoLD interactive fraud proofs, into soft, posted, challengeable, or final. Onchain settlement inside the roughly week-long BoLD challenge window is optimistic, not final, and a claim asserting final finality inside that window is flagged as overstated. Downstream of classify_settlement_asset_finality in the finality-classification chain; follows the check_linea_l2_finality_window shape as a precedent only, since the proof system differs. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-321-rhc-bold-finality-classifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-321-rhc-bold-finality-classifier.md
- MCP tool: classify_bold_challenge_finality (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- assertion_created (unknown, optional)
- assertion_created_timestamp (unknown, optional)
- batch_posted_to_l1 (unknown, optional)
- challenge_window_seconds (unknown, optional)
- current_time (unknown, optional)
- finality_claim (unknown, optional)
- l2_inclusion_timestamp (unknown, optional)

## Outputs

- challenge_window_seconds (integer, optional)
- claim_verdict (string, optional)
- earliest_final_at (integer, optional)
- finality_claim (string, optional)
- finality_class (string, optional)
- verdict (string, optional)

## Sample

```json
{
  "l2_inclusion_timestamp": 100,
  "batch_posted_to_l1": true,
  "assertion_created": true,
  "assertion_created_timestamp": 1000,
  "current_time": 701000,
  "finality_claim": "final"
}
```

## Verify

Run the sample policy_parameters through MCP tool `classify_bold_challenge_finality` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
