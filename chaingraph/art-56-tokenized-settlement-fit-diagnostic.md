# Wholesale Tokenized Settlement Fit Diagnostic

12-question A-F readiness diagnostic for wholesale tokenized settlement (tokenized deposits, central bank money, regulated stablecoins as settlement assets). Grades settlement-asset choice, finality regime, cross-network atomicity, asset-leg type, cash-leg issuer, intraday liquidity, and reconciliation controls; routes to the right wholesale-settlement chain and emits a remediation checklist.

- Page: https://ainumbers.co/chaingraph/art-56-tokenized-settlement-fit-diagnostic.html
- Markdown twin: https://ainumbers.co/chaingraph/art-56-tokenized-settlement-fit-diagnostic.md
- MCP tool: run_tokenized_settlement_fit (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- annual_settlement_value_usd (any, optional): Amount in US dollars; type not evidenced by kernel source
- asset_leg_type (any, optional): type not evidenced by kernel source
- atomicity_mechanism (any, optional): type not evidenced by kernel source
- cash_leg_asset (any, optional): type not evidenced by kernel source
- deposit_token_issuer (any, optional): type not evidenced by kernel source
- finality_regime (any, optional): type not evidenced by kernel source
- intraday_liquidity (any, optional): type not evidenced by kernel source
- network_model (any, optional): type not evidenced by kernel source
- operating_hours (any, optional): type not evidenced by kernel source
- participant_eligibility (any, optional): type not evidenced by kernel source
- participant_type (any, optional): type not evidenced by kernel source
- reconciliation_model (any, optional): type not evidenced by kernel source

## Outputs

- dim_scores (object, optional)
- finality_flag (string, optional)
- note (string, optional)
- overall_grade (string, optional)
- overall_score (number, optional)
- primary_recommendation (string, optional)
- remediation_checklist (array, optional)
- secondary_recommendations (array, optional)

## Sample

```json
{}
```

## Solana DvP profile (additive note)

- Trust model: the Solana Foundation DvP program is a bilateral two-escrow swap; a third-party settlement authority is the only signer for settle or cancel and cannot redirect proceeds. Matching, pricing, netting, partial fills and any off-ledger leg are outside the program ([program docs](https://solana.com/docs/defi/dvp-program), retrieved 2026-10-16).
- Escrow per leg: each party funds its own escrow token account by plain token transfer; the record is 458 bytes, so check owner, length, parties, mints, amounts, timestamps and destinations before funding ([README State @df9919ed](https://github.com/solana-foundation/dvp/blob/df9919ed02c25a93620e7f6820107c9050ce3b92/README.md#L19-L41), [SwapDvp struct @df9919ed](https://github.com/solana-foundation/dvp/blob/df9919ed02c25a93620e7f6820107c9050ce3b92/program/src/state/swap_dvp.rs#L28-L82)).
- Finalized is not legal finality: the doc treats on-chain `finalized` as the settlement point and states legal finality is contractual.
- Eligibility sits in the mint controls: no allowlist or KYC in the program; PermanentDelegate, Pausable, DefaultAccountState, freeze authority and Token ACL are accepted and carry counterparty risk.
- Transfer-fee mints are rejected ([blocked extensions @df9919ed](https://github.com/solana-foundation/dvp/blob/df9919ed02c25a93620e7f6820107c9050ce3b92/program/src/processor/shared/token_utils.rs#L275-L350)); see [ART-715](https://ainumbers.co/chaingraph/art-715-token2022-transfer-fee-reconciler.html).

Educational note, not legal or settlement advice. Pinned to program source commit df9919ed; verify the deployed program on chain.

## Verify

Run the sample policy_parameters through MCP tool `run_tokenized_settlement_fit` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
