# TSV Tier-Cap Ladder

Replays a tokenized-stock venue's (TSV's) daily per-symbol share volume and distinct-symbol counts, aggregated across the TSV and its caller-declared affiliated TSVs, against the SEC TSV Exemption tier caps of FR 2026-19388 (91 FR 60174-76, condition F): Tier 1 is 75 symbols and 0.25 percent of the declared prior-month ADV, Tier 2 is 250 symbols and 2.5 percent; the daily volume cap in integer shares is floor(ADV x 25/10000) or floor(ADV x 250/10000), and a breach is volume strictly greater than the cap. Applies the condition F stepped-compliance ladder to volume breaches only: the first breach in a stock requires no action, every later breach forces an immediate three-month pause in that stock with affiliates included, and the node emits each pause window (breach date to breach date plus three calendar months, month-end clamped) and the notification and public-Notice obligations. Symbol-count breaches get no first-breach pass; the node reports the stated consequence (the TSV would not meet the conditions of the TSV Exemption) and imposes no pause, because the order states none. A stock with no declared prior-month ADV is reported INDETERMINATE, never given an assumed ADV. The order states no reset or look-back window for the ladder, so none is applied and the assumption is carried in the output. Evidence replay only over caller-supplied data: it never looks up LULD tiers or halts and never states or implies that a venue is compliant.

- Page: https://ainumbers.co/chaingraph/art-707-tsv-tier-cap-ladder.html
- Markdown twin: https://ainumbers.co/chaingraph/art-707-tsv-tier-cap-ladder.md
- MCP tool: check_tsv_tier_cap_ladder (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- tsv_id (string, required): Non-empty identifier of the venue being replayed; its volume is always included in the aggregate.
- affiliated_tsv_ids (array, optional): Affiliated TSV identifiers whose volume and symbols aggregate with the venue's. Never repeats tsv_id.
- stocks (array, required): Declared universe [{ symbol, tier, prior_month_adv_shares }]; tier is caller-declared, no LULD lookup.
- daily_volume (array, optional): One row per venue per day per symbol; rows for the declared group are summed. Duplicates refused.
- symbols_traded (array, optional): Optional distinct-symbol record; derived from daily_volume when omitted.
- prior_breaches (array, optional): Volume breaches recorded before the window; consumes the stock's one-time first-breach pass.
- as_of_date (string, required): YYYY-MM-DD date the pause status is evaluated as of.

## Outputs

- affiliated_tsv_ids (array, optional)
- as_of_date (string, optional)
- assumptions (array, required)
- detail (string, optional)
- domain_errors (array, optional)
- error (string, optional)
- note (string, optional)
- obligations (array, required)
- per_stock (array,null, required)
- status_as_of (object,null, required)
- symbol_count (array,null, required)
- tsv_id (string, optional)

## Sample

```json
{
  "tsv_id": "TSV-A",
  "affiliated_tsv_ids": [],
  "stocks": [
    {
      "symbol": "AAA",
      "tier": "tier_1",
      "prior_month_adv_shares": 400000
    }
  ],
  "daily_volume": [
    {
      "date": "2026-10-01",
      "tsv_id": "TSV-A",
      "symbol": "AAA",
      "shares": 1001
    }
  ],
  "as_of_date": "2026-10-11"
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_tsv_tier_cap_ladder` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
