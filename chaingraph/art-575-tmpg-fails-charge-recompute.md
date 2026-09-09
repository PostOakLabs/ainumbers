# TMPG Fails-Charge Recompute

Recomputes the NY Fed Treasury Market Practices Group fails-charge claim a buyer presents to a failing seller on a UST, agency, or agency-MBS settlement fail: charge = max(0, 3% minus the caller-declared reference rate) / 360 x par amount x days failed, per the published trading practice (2016 revision). Accepts a batch of fails in one pass, each with its own par amount, reference rate, and day count, and diffs the recomputed charge against a caller-declared claimed amount within a caller-declared tolerance - never a default. A fail with no claimed amount contributes an INDETERMINATE line rather than a silent pass. Overall verdict DIVERGES if any fail's recomputed charge falls outside tolerance of its claimed amount; INDETERMINATE if every fail is within tolerance or unclaimed but at least one has no claimed amount to diff, or if the tolerance itself, or every fail, is absent; MATCHES only when every fail carries a claimed amount and every one agrees within tolerance. Par and claimed amounts are integer minor units, so the arithmetic is exact; recomputed charges round to the nearest minor unit. Performs arithmetic only over caller-declared par amounts, reference rates, day counts, and claimed amounts - does not source, derive, or independently verify fail status, par amounts, or reference rates from any feed, and makes no TMPG/NY Fed endorsement claim. Clause: NY Fed TMPG fails-charge trading practice (2016 revision); confirm current text at newyorkfed.org before relying on a computed figure for a live claim.

- Page: https://ainumbers.co/chaingraph/art-575-tmpg-fails-charge-recompute.html
- Markdown twin: https://ainumbers.co/chaingraph/art-575-tmpg-fails-charge-recompute.md
- MCP tool: recompute_tmpg_fails_charge (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- diff_tolerance_minor (unknown, required)
- fails (array, required)

## Outputs

- clause_note (string, optional)
- decision (object, optional)
- determinations (array, optional)
- diff_tolerance_minor (integer, optional)
- fail_count (integer, optional)
- rejected_inputs (array, optional)
- scope_note (string, optional)
- total_claimed_charge_minor (integer, optional)
- total_recomputed_charge_minor (integer, optional)
- verdict (string, optional)

## Sample

```json
{
  "diff_tolerance_minor": 0,
  "fails": [
    {
      "fail_id": "fail-A",
      "par_amount_minor": 10000000,
      "days_failed": 10,
      "reference_rate_bps": 250,
      "claimed_charge_minor": 1389
    },
    {
      "fail_id": "fail-B",
      "par_amount_minor": 5000000,
      "days_failed": 5,
      "reference_rate_bps": 0,
      "claimed_charge_minor": 2083
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `recompute_tmpg_fails_charge` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
