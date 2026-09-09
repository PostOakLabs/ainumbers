# Tempo On-Chain AML & Travel Rule Screener

Parses a batch of synthetic TIP-20 transfers (with memos), runs OFAC/SDN hit screening, checks FATF Travel Rule field completeness (originator/beneficiary name + VASP ID, threshold US$3,000), scores AML typologies (structuring $9k–$9.99k, missing identity, unusual tx), and emits SAR determination + Travel Rule attestation. Bilateral: sending VASP emits; receiving VASP re-verifies. ISO 20022 pacs.008-subset artifact; instructed_amount = batch total.

- Page: https://ainumbers.co/chaingraph/art-38-tempo-onchain-aml.html
- Markdown twin: https://ainumbers.co/chaingraph/art-38-tempo-onchain-aml.md
- MCP tool: screen_tip20_transfer_batch (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- sar_threshold (number, required)
- tr_threshold (number, required)
- transfers (array, required)

## Outputs

- batch_verdict (string, optional)
- escalate_count (integer, optional)
- flag_count (integer, optional)
- pass_count (integer, optional)
- results (array, optional)
- sar_threshold_usd (integer, optional)
- total (integer, optional)
- tr_threshold_usd (integer, optional)

## Sample

```json
{
  "transfers": [
    {
      "tx_ref": "tx-001",
      "amount_usd": 1000,
      "originator_name": "Alice Corp",
      "originator_vasp": "vasp-001",
      "beneficiary_name": "Bob Ltd",
      "beneficiary_vasp": "vasp-002",
      "memo": "Invoice INV-001"
    }
  ],
  "tr_threshold": 3000,
  "sar_threshold": 5000
}
```

## Verify

Run the sample policy_parameters through MCP tool `screen_tip20_transfer_batch` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
