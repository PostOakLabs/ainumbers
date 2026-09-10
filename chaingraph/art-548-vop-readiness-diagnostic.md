# VoP Readiness Diagnostic

EU Instant Payments Regulation Verification-of-Payee (VoP) readiness/consistency diagnostic. Deterministically classifies a caller-declared match_score against caller-declared thresholds into match, close_match, no_match, or not_verifiable, then cross-checks that classification against the caller-declared psp_vop_response_code - flagging, never silently correcting, a mismatch. Outcome-attestation shape, not recompute-the-match: this node does not implement the EPC VoP fuzzy name-matching algorithm and makes no live IBAN/account-holder-name directory call. Carries an OCG Standard §25 ocg-private-input@1 declaration: the IBAN, payee name, and account-holder identifier (if collected) are committed via sha256-salted@1, never in the clear. Distinct from simulate_vop_matching (art-11, a batch aggregate match-rate analyser using its own similarity math), score_payee_name_match (art-376, computes a name-match score from a name pair), and build_vop_session_receipt (art-377, builds the downstream session receipt); use this node for the upstream threshold/response-code consistency check. ZERO plaintext PII disclosed.

- Page: https://ainumbers.co/chaingraph/art-548-vop-readiness-diagnostic.html
- Markdown twin: https://ainumbers.co/chaingraph/art-548-vop-readiness-diagnostic.md
- MCP tool: run_vop_readiness_diagnostic (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- psp_vop_response_code (unknown, optional)

## Outputs

- classification (string, optional)
- consistent (boolean, optional)
- match_score_provided (boolean, optional)
- not_legal_advice (string, optional)
- pii_note (string, optional)
- psp_declared_maps_to (string, optional)
- psp_vop_response_code (string, optional)
- regulatory_basis (string, optional)
- scope_note (string, optional)

## Sample

```json
{
  "iban_commitment": "sha256:d0261b5555a4df1d5fbed786c9a8977e8196c81c8859cfcf683fadfea157ea91",
  "payee_name_commitment": "sha256:47048eda633d4509b69fc56390c9240f0e33d759b98493d3cc7385bd672b8815",
  "match_threshold_exact": 0.9,
  "match_threshold_close": 0.7,
  "psp_vop_response_code": "MTCH"
}
```

## Verify

Run the sample policy_parameters through MCP tool `run_vop_readiness_diagnostic` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
