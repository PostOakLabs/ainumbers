# VoP Session Receipt Builder

Builds a signed, hash-chained Verification-of-Payee / Confirmation-of-Payee session receipt: binds the declared match result (score, band, algorithm_version or an external source), the warning text and severity shown, and the consumer's action (proceeded, abandoned, retried) across a session's attempts. Each attempt's receipt hash chains to the prior one, rooted at a session-anchored genesis hash, so any reordering or edit breaks the downstream chain. Attests the computation over the declared session record, not ground-truth identity and not the PSP's own UI - that assertion is the PSP's, bound here as evidence. Verifies fully offline.

- Page: https://ainumbers.co/chaingraph/art-377-build-vop-session-receipt.html
- Markdown twin: https://ainumbers.co/chaingraph/art-377-build-vop-session-receipt.md
- MCP tool: build_vop_session_receipt (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- attempts (array, required)
- session_id (unknown, required)

## Outputs

- attempt_count (integer, optional)
- chain_genesis_hash (string, optional)
- final_match_band (string, optional)
- final_receipt_hash (string, optional)
- note (string, optional)
- session_id (string, optional)
- session_outcome (string, optional)
- session_receipts (string, optional)
- warning_overridden (boolean, optional)

## Sample

```json
{
  "session_id": "vop-sess-0001",
  "attempts": [
    {
      "attempt_id": "a1",
      "match_result": {
        "source": "score_payee_name_match",
        "algorithm_version": "vop-namematch-1.0.0",
        "score": 100,
        "match_band": "MATCH"
      },
      "warning_shown": {
        "text": "",
        "severity": "none"
      },
      "consumer_action": "proceeded",
      "asserted_at": "2026-07-18T09:00:00Z"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `build_vop_session_receipt` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
