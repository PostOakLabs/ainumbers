# Fuzzy-Match Calibration Scorer

Given a config (algorithm, threshold) and a synthetic labelled name-pair set, computes FPR/recall/F1, scores threshold quality, and recommends calibration. No real names - synthetic fixtures only.

- Page: https://ainumbers.co/chaingraph/art-93-fuzzy-match-calibration-scorer.html
- Markdown twin: https://ainumbers.co/chaingraph/art-93-fuzzy-match-calibration-scorer.md
- MCP tool: score_fuzzy_match_calibration (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `score_fuzzy_match_calibration` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
