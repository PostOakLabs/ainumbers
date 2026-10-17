# Settlement-Asset & Legal-Finality Classifier

Classifies the settlement asset (CBM token / tokenized commercial bank deposit / regulated stablecoin / e-money token) against its legal-finality regime (EU SFD 98/26/EC / CPMI-IOSCO PFMI Principle 8 / UCC Article 12 control) -> finality tier 1-4 + singleness-of-money verdict. Gates ART-58 cross-network atomicity check.

- Page: https://ainumbers.co/chaingraph/art-59-settlement-asset-finality-classifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-59-settlement-asset-finality-classifier.md
- MCP tool: classify_settlement_asset_finality (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- finality_designation (any, optional): type not evidenced by kernel source
- governing_law (any, optional): type not evidenced by kernel source
- issuer (any, optional): type not evidenced by kernel source
- jurisdiction (any, optional): type not evidenced by kernel source
- settlement_asset (any, optional): type not evidenced by kernel source
- singleness_test (any, optional): type not evidenced by kernel source
- transfer_mechanism (any, optional): type not evidenced by kernel source

## Outputs

- applicable_regime (string, optional)
- finality_gaps (array, optional)
- finality_tier (integer, optional)
- note (string, optional)
- recommendation (string, optional)
- settlement_asset_class (string, optional)
- singleness_verdict (string, optional)
- status_asof (string, optional)

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

Run the sample policy_parameters through MCP tool `classify_settlement_asset_finality` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
