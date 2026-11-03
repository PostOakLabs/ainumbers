# Token-2022 Transfer-Fee Payment Reconciler

Recomputes the transfer fee a Token-2022 mint with the transfer-fee extension withholds and the net amount the recipient receives, given the fee schedule, the TransferChecked amount, the execution epoch and the amount a payment verifier credited, then reconciles the credited amount against that net: MATCH, OVER_CREDITED or UNDER_CREDITED with credited_minus_net reported. OVER_CREDITED with the fee as the difference reproduces the Kora GHSA-725g defect class, a facilitator crediting the pre-fee gross amount; the advisory's arithmetic is quoted only as its public text states it. All amounts are decimal strings computed in BigInt with 128-bit intermediates and no floats, porting the pinned Token-2022 clause arithmetic: ceiling(amount times basis points over 10,000) capped at maximum_fee, the newer schedule applying from its epoch on, and the informational minimal pre-fee inverse choosing the smaller amount. The output also records a declared-fee FeeMismatch for TransferCheckedWithFee, an EPOCH_SCHEDULE_DIVERGENCE when the verifier used a different schedule than the execution epoch, and an informational consumer view showing where the x402 SVM gross-amount exact-match path and the balance-delta net path disagree. Exclusions: no wallet addresses, no authorities, no account keys, no signatures, no live data.

- Page: https://ainumbers.co/chaingraph/art-715-token2022-transfer-fee-reconciler.html
- Markdown twin: https://ainumbers.co/chaingraph/art-715-token2022-transfer-fee-reconciler.md
- MCP tool: reconcile_token2022_transfer_fee (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- older_transfer_fee (object, required): Schedule used before the switch epoch: { epoch, maximum_fee, transfer_fee_basis_points }, all decimal strings (u64; basis points u16).
- newer_transfer_fee (object, required): Schedule used from its epoch on: { epoch, maximum_fee, transfer_fee_basis_points }, all decimal strings. Applies when execution_epoch >= this epoch.
- amount (string, required): The TransferChecked amount, i.e. pre-fee, in base units. Decimal string in u64 range.
- execution_epoch (string, required): The Clock epoch in which the transfer executes. Decimal string in u64 range.
- instruction (string, required): The checked transfer instruction. Unchecked transfers are refused: they fail with MintRequiredForTransfer on a mint carrying the fee extension.
- declared_fee (string, optional): TransferCheckedWithFee only: the fee the instruction states. A mismatch is recorded as FeeMismatch.
- credited_amount (string, required): What the payment verifier credited, in base units. Decimal string in u64 range.
- verifier_epoch (string, optional): Optional: the epoch the verifier used for its fee. A different schedule pick than the execution epoch emits EPOCH_SCHEDULE_DIVERGENCE.
- required_amount (string, optional): Optional: the payee's required amount, for the informational x402 consumer view (gross-accept static path vs net-accept balance-delta path).

## Outputs

- consumer_view (null,object, required)
- credited_amount (string, optional)
- credited_minus_net (string,null, required)
- declared_fee (null,string, optional)
- detail (string, optional)
- domain_errors (array, optional)
- epoch_race (null,string, required)
- error (string, optional)
- execution_epoch (string, optional)
- fee (string,null, required)
- fee_mismatch (null,string, optional)
- min_pre_fee_for_net (string,null, required)
- net (string,null, required)
- note (string, optional)
- reconciliation (string,null, required)
- schedule (string,null, required)
- verifier_epoch (null,string, optional)
- withheld_added (string,null, required)

## Sample

```json
{
  "older_transfer_fee": {
    "epoch": "0",
    "maximum_fee": "5000",
    "transfer_fee_basis_points": "1"
  },
  "newer_transfer_fee": {
    "epoch": "0",
    "maximum_fee": "5000",
    "transfer_fee_basis_points": "1"
  },
  "amount": "1",
  "execution_epoch": "0",
  "instruction": "TransferChecked",
  "credited_amount": "0"
}
```

## Verify

Run the sample policy_parameters through MCP tool `reconcile_token2022_transfer_fee` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
