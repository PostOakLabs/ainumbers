# On-Ledger Transfer Batch Screen

Batch-level pre-commit sanctions and purpose-code screen for a shared-ledger transfer batch, modeled on the shipped screen_tip20_transfer_batch pattern: per-transfer status, screening-list hits, purpose-code validity, a batch-clean verdict, and coverage gaps. Reuses the same purpose-code enum and screening-hit shape as check_purpose_code_requirement / check_screening_list_coverage rather than duplicating their logic. Zero-network; screens against supplied flagged-name lists only.

- Page: https://ainumbers.co/chaingraph/art-291-screen-onledger-transfer-batch.html
- Markdown twin: https://ainumbers.co/chaingraph/art-291-screen-onledger-transfer-batch.md
- MCP tool: screen_onledger_transfer_batch (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- profile (unknown, required)
- screening_lists_meta (unknown, required)
- transfers (array, required)

## Outputs

- batch_clean (boolean, optional)
- coverage_gaps (array, optional)
- per_transfer (array, optional)
- profile (string, optional)
- transfer_count (integer, optional)

## Sample

```json
{
  "transfers": [
    {
      "originator": "Alice Corp",
      "beneficiary": "Bob Ltd",
      "amount": 1000,
      "purpose_code": "TRAD",
      "corridor": "US-EU"
    },
    {
      "originator": "Carol Inc",
      "beneficiary": "Dan LLC",
      "amount": 500,
      "purpose_code": "SVCS",
      "corridor": "US-UK"
    }
  ],
  "screening_lists_meta": {
    "flagged_names": [
      "sanctioned party a"
    ]
  },
  "profile": "sli-batch-screen-v1"
}
```

## Verify

Run the sample policy_parameters through MCP tool `screen_onledger_transfer_batch` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
