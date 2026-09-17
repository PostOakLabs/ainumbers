# Payee Name-Match Score (VoP/CoP)

Deterministic, versioned single-pair payee name-matching score for Verification-of-Payee / Confirmation-of-Payee evidence. Normalizes (diacritic stripping, legal-entity suffix removal), scores by integer Levenshtein edit distance against both a plain and a token-sorted form, and bands the result MATCH / CLOSE_MATCH / NO_MATCH against declared thresholds. algorithm_version is carried in the receipt so a score is reproducible evidence, not a black-box vendor output. Distinct from the batch aggregate analyser art-11: this scores one declared pair for downstream session-receipt binding.

- Page: https://ainumbers.co/chaingraph/art-376-score-payee-name-match.html
- Markdown twin: https://ainumbers.co/chaingraph/art-376-score-payee-name-match.md
- MCP tool: score_payee_name_match (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- account_name (unknown, optional)
- close_match_threshold (unknown, required)
- match_threshold (unknown, required)
- reference_name (unknown, optional)

## Outputs

- algorithm_version (string, optional)
- close_match_threshold (integer, optional)
- compliance_flags (array, optional)
- entity_suffix_stripped (boolean, optional)
- match_band (string, optional)
- match_threshold (integer, optional)
- normalized_account_name (string, optional)
- normalized_reference_name (string, optional)
- score (integer, optional)
- transliteration_in_scope (boolean, optional)

## Sample

```json
{
  "account_name": "John Smith",
  "reference_name": "John Smith"
}
```

## Verify

Run the sample policy_parameters through MCP tool `score_payee_name_match` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
