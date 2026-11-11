# Privacy Coin Regulatory Classifier (MiCA and AMLR)

Places caller-declared properties of a privacy-feature coin and of the declaring entity against two pinned provisions of the Official Journal text: Article 76(3) of Regulation (EU) 2023/1114 (operating rules of a trading platform for crypto-assets and an inbuilt anonymisation function, with the unless clause on identifiability of holders and transaction history) and Article 79(1) of Regulation (EU) 2024/1624 (the prohibition on accounts allowing anonymisation or increased obfuscation of transactions, including through anonymity-enhancing coins). Application dates come from the text: 30 December 2024 for the first (Article 149(2)), 10 July 2027 for the second, or 10 July 2029 for obliged entities in Article 3(3) points (n) and (o) (Article 90); before those dates the rule is reported as not yet applicable and is never presented as in force. Each rule cites its pinned paragraph. The output is a classification of the declared inputs against the text: whether a coin has an inbuilt anonymisation function, or whether an account allows anonymisation or obfuscation, is declared by the caller and is not judged here, and the declarations are not verified. This is technical documentation, not legal advice. Malformed input is refused with INPUT_REFUSED.

- Page: https://ainumbers.co/chaingraph/art-818-zcash-reg-classifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-818-zcash-reg-classifier.md
- MCP tool: classify_privacy_coin_regulatory_treatment (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "assessment_date": "2025-03-01",
  "coin_label": "EXAMPLE-COIN",
  "entity": {
    "role": "casp_operating_trading_platform"
  },
  "declared_properties": {
    "inbuilt_anonymisation_function": true,
    "holders_identifiable_by_platform_casp": false,
    "transaction_history_identifiable_by_platform_casp": false
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `classify_privacy_coin_regulatory_treatment` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
