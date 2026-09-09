# MLA Charge-Inclusion Classifier

Closed-set lookup of whether a charge type must be included in the Military Lending Act MAPR under 32 CFR 232.4(c) and 232.4(d), returning included_in_mapr as true, false or conditional together with the exact paragraph cited and a plain basis sentence. The domain is 9 charge types x is_credit_card_account x short_term_exception_claimed = 36 states, every one of them enumerated. Three charge types return conditional because the regulation's own worked examples at 232.4(d)(4)(iii) run the same fee twice and reach opposite answers on facts a charge type cannot express. The single cell the closed set cannot resolve, an application fee with the 232.4(c)(1)(iii)(B) short-term carve-out claimed, sets manual_review_required and names the three missing predicates rather than guessing. conditional_limit_usd reports the $100 per annum figure of 232.4(c)(2)(ii)(B) on the participation-fee credit-card cells: it NAMES that figure and never compares it to an amount, because 232.4(c)(2)(ii)(B) withdraws the limit for a bona fide participation fee under paragraph (d) and 232.4(d)(3)(iv) gives a $400 fee as potentially reasonable. Performs no arithmetic at all: no ratio, no scale, no threshold compare, no rounding. Zero network calls: does not determine covered-borrower status, does not compute a MAPR, does not compare anything to the 36 percent limit of 232.4(b), and does not decide whether a fee is bona fide or reasonable under 232.4(d)(1) and 232.4(d)(3).

- Page: https://ainumbers.co/chaingraph/art-615-mla-charge-inclusion-classifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-615-mla-charge-inclusion-classifier.md
- MCP tool: classify_mla_charge_inclusion (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- charge_type (string, required)
- is_credit_card_account (boolean, optional)
- short_term_exception_claimed (boolean, optional)

## Outputs

- charge_type (string,null, optional)
- is_credit_card_account (boolean, optional)
- short_term_exception_claimed (boolean, optional)
- included_in_mapr (boolean,string,null, optional)
- citation (string,null, optional)
- basis (string,null, optional)
- conditional_limit_usd (number,null, optional)
- manual_review_required (boolean, optional)
- manual_review_reason (string,null, optional)

## Sample

```json
{
  "charge_type": "debt_cancellation_fee",
  "is_credit_card_account": true,
  "short_term_exception_claimed": false
}
```

## Verify

Run the sample policy_parameters through MCP tool `classify_mla_charge_inclusion` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
