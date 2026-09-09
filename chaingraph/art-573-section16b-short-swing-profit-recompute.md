# Section 16(b) Short-Swing Profit Recomputation

Recomputes an Exchange Act Section 16(b) short-swing profit figure from a caller-declared list of an insider's own transactions in the issuer's equity security, then compares the recomputed figure against a number a demand letter claims where one is supplied. Section 16(b) demand letters are typically built by a plaintiff firm scanning Form 4 filings for a lowest-price-in, highest-price-out match; the recipient side, whether the insider or the issuer's counsel, has had no deterministic free tool to independently recompute that number, which this node is. Matching uses the Smolowe v. Delvag Reinsurance / Gratz v. Claughton maximal-recovery construction: the lowest-priced eligible purchase is repeatedly paired against the highest-priced eligible sale within a day-count approximation of the statutory less-than-six-months window, a pairing that would produce a loss is skipped rather than netted against a profitable one, and every matched pair is reported with its own purchase date, sale date, share count and profit. A transaction carrying a caller-declared exemption flag, such as a Rule 16b-3 approved-plan exemption, is excluded from matching and reported separately; this node makes no independent exemption determination. It also carries an informational Section 16(a) and 16(b) applicability check over caller-declared officer, director, and ten-percent-owner status, including the Holding Foreign Insiders Accountable Act asymmetry: a foreign private issuer's officers and directors became Section 16(a) reporting filers under HFIAA without becoming subject to Section 16(b) short-swing profit-recovery liability, which this node flags without gating the arithmetic on it. The verdict is MATCHES, DIVERGES, or INDETERMINATE, and INDETERMINATE covers both an empty transaction list and a run where no demand-letter figure was supplied to compare against; neither case is guessed toward agreement. Money is fixed point in integer minor units throughout with two-decimal display. Cites Exchange Act Section 16(b) and 16(a), Rule 16b-3, Rule 3a12-3, and HFIAA, each dated for re-verification against primary text, and names the matching algorithm and the six-month day-count approximation as research findings needing independent re-verification rather than established facts. Stated boundary: this is not legal advice, no computed figure resolves a matchability or exemption dispute, and a Rule 144 volume-limitation check is a named follow-on tool, not computed here.

- Page: https://ainumbers.co/chaingraph/art-573-section16b-short-swing-profit-recompute.html
- Markdown twin: https://ainumbers.co/chaingraph/art-573-section16b-short-swing-profit-recompute.md
- MCP tool: recompute_section16b_profit (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- currency (string, required)
- demand_letter_claimed_profit_minor_units (unknown, required)
- insider_ref (unknown, required)
- insider_status (unknown, required)
- issuer_ref (unknown, required)
- transactions (unknown, required)

## Outputs

- citations (object, optional)
- comparison_basis (string, optional)
- currency (string, optional)
- demand_letter_claimed_profit_display (string, optional)
- demand_letter_claimed_profit_minor_units (integer, optional)
- demand_letter_supplied (boolean, optional)
- difference_display (string, optional)
- difference_minor_units (integer, optional)
- excluded_transactions (array, optional)
- fence (string, optional)
- indeterminate_reason (string, optional)
- insider_ref (string, optional)
- insider_status (object, optional)
- issuer_ref (string, optional)
- matched_pairs (array, optional)
- minor_unit_exponent (integer, optional)
- not_proven (array, optional)
- note (string, optional)
- purchase_count (integer, optional)
- rationale (array, optional)
- rejected_inputs (array, optional)
- sale_count (integer, optional)
- section_16a_applicability (object, optional)
- six_month_window_day_threshold (integer, optional)
- total_profit_display (string, optional)
- total_profit_minor_units (integer, optional)
- transaction_count (integer, optional)
- unmatched_purchase_shares (integer, optional)
- unmatched_sale_shares (integer, optional)
- usable_transaction_count (integer, optional)
- verdict (string, optional)

## Sample

```json
{
  "insider_ref": "SYNTH-INSIDER-001",
  "issuer_ref": "SYNTH-ISSUER-CO",
  "currency": "USD",
  "transactions": [
    {
      "txn_id": "txn-1",
      "type": "buy",
      "date": "2026-01-10",
      "price_minor_units": 1000,
      "shares": 100
    },
    {
      "txn_id": "txn-2",
      "type": "buy",
      "date": "2026-02-10",
      "price_minor_units": 1200,
      "shares": 100
    },
    {
      "txn_id": "txn-3",
      "type": "sell",
      "date": "2026-04-01",
      "price_minor_units": 2000,
      "shares": 150
    }
  ],
  "insider_status": {
    "officer_or_director": true,
    "ten_pct_owner": false,
    "foreign_private_issuer": false
  },
  "demand_letter_claimed_profit_minor_units": 140000
}
```

## Verify

Run the sample policy_parameters through MCP tool `recompute_section16b_profit` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
