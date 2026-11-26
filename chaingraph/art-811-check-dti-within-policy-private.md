# Private-Input Debt-to-Income Within Policy Check

Pilot private-input predicate. Checks that privately held monthly debt obligations, 16 fixed slots, are at most a chosen share of a privately held monthly income, and publishes only a yes/no verdict. The share comes from a fixed public list (36, 43, 45 or 50 percent) because 12 CFR 1026.51(a)(1)(ii) tells a card issuer to consider the ratio of debt obligations to income in its written policies but names no number. Zero income gives no. Carries an OCG Standard section 25 ocg-private-input@1 declaration: the income and the debts are each committed under sha256-salted@1 with their own independent salt, in policy_parameters.income_commitment and policy_parameters.debts_commitment, so the income can be opened to an employment-verification party without opening the debts. Integer arithmetic only. The witness must be exactly 16 slots of 20-digit amounts so its length does not reveal how many debts exist; any other shape is refused and nothing is sealed. It does not show that every debt was listed, that the income is real or accessible, or the minimum-payment estimate in paragraph (a)(2), and assets are out of scope. The verdict is public and the inputs are not in the receipt; a receipt made from inputs given to a server was seen by that server, and many yes/no questions about the same figures at different shares reveal more than one. Pilot: the node lands with its proof deferred and the in-browser result is a preview, not a receipt.

- Page: https://ainumbers.co/chaingraph/art-811-check-dti-within-policy-private.html
- Markdown twin: https://ainumbers.co/chaingraph/art-811-check-dti-within-policy-private.md
- MCP tool: check_dti_within_policy_private (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "income_commitment": "sha256:911911b94024e38cd6bf3653e5bafddf71f0f033a7b24d342480646fff935182",
  "debts_commitment": "sha256:220fc342a3acb5b22b8775b5e04c6393654e78f31091f0c6e1aff8d65c5d8791",
  "dti_max_bps": 4300,
  "unit": "USD_cents",
  "as_of": "2026-10-31",
  "citation": "12 CFR 1026.51(a)(1)(ii): a card issuer's reasonable written policies and procedures must consider the ratio of debt obligations to income, and it is unreasonable to issue a card to a consumer who has no income or assets. The regulation names no ratio; the threshold is the issuer's own policy."
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_dti_within_policy_private` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
