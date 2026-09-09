# Public-Money Settlement Receipt

A payment of public money reconciles from payer to the correct government revenue line (art-513), with its finality (art-492) and settlement-asset legal-finality class (art-59) classified. Where the receipt actually declares a settlement currency, a multi-currency PvP atomicity check runs (511); where that PvP leg is not itself a Canton/DLT-native leg, an ISO 20022 address-migration check runs on the messaging leg (rca-03). GATED (OCG Standard v0.8 §21.4): gate 1 on art-513's own /currency (a receipt with no declared currency has nothing further to classify or PvP-check, so the automated path ends); gate 2 on 511's own /has_canton_leg (a Canton-native PvP leg does not carry an ISO 20022 message, so rca-03 does not apply). Portable to any government payment platform, any treasury-single-account regime, any supreme audit institution - not specific to any one jurisdiction, ministry or vendor.

- Page: https://ainumbers.co/chaingraph/chains/public-money-settlement-receipt.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/public-money-settlement-receipt.md

## Workflow chain: Public-Money Settlement Receipt

A payment of public money reconciles from payer to the correct government revenue line (art-513), with its finality (art-492) and settlement-asset legal-finality class (art-59) classified. Where the receipt actually declares a settlement currency, a multi-currency PvP atomicity check runs (511); where that PvP leg is not itself a Canton/DLT-native leg, an ISO 20022 address-migration check runs on the messaging leg (rca-03). GATED (OCG Standard v0.8 §21.4): gate 1 on art-513's own /currency (a receipt with no declared currency has nothing further to classify or PvP-check, so the automated path ends); gate 2 on 511's own /has_canton_leg (a Canton-native PvP leg does not carry an ISO 20022 message, so rca-03 does not apply). Portable to any government payment platform, any treasury-single-account regime, any supreme audit institution - not specific to any one jurisdiction, ministry or vendor.

Domain: Public Finance & Government Payments

### Steps

1. art-513-public-money-settlement-receipt
   Single-settlement, attribution and at-par verdicts. Gate: a declared /currency continues to finality classification; no declared currency means there is nothing further to classify, and the automated path ends.
2. art-492-classify-settlement-finality
   Rail-agnostic settlement-finality tier feeds the settlement-asset legal-finality classification.
3. art-59-settlement-asset-finality-classifier
   Settlement-asset legal-finality tier and singleness verdict feed the multi-currency PvP check.
4. 511-multi-currency-pvp-validator
   PFMI Principle 12 atomicity and Herstatt-risk verdict for the currency leg. Gate: a Canton/DLT-native leg carries no ISO 20022 message and ends here; any other leg continues to the address-migration check.
5. rca-03-iso20022-address-migration-verifier
   ISO 20022 pacs.008 Nov-2026 address-field readiness verdict for the messaging leg - final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
