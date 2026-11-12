# Yield Curve & G-Spread

Builds a par yield curve from caller-supplied benchmark points (at least 2, strictly increasing tenors; no live data, the caller's points are used exactly as given) under a named, versioned interpolation, linear (linear@1) or monotone cubic Hermite with Fritsch-Carlson 1980 tangents (monotone_cubic_hermite@1), and reports the G-spread of a bond against that curve: the interpolated benchmark yield at the bond's maturity and (bond yield minus benchmark yield) x 100 in basis points. A bond maturity outside the benchmark tenor range is refused naming the range, never extrapolated. Every assumption is named in plain sentences in the output. Exclusions: no bootstrapping of zero rates, no day-count, no live Treasury feed.

- Page: https://ainumbers.co/chaingraph/art-706-yield-curve-gspread.html
- Markdown twin: https://ainumbers.co/chaingraph/art-706-yield-curve-gspread.md
- MCP tool: build_yield_curve_gspread (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- benchmark_points (array, required): Caller-supplied benchmark points [{ tenor_years, yield_pct }]: at least 2, strictly increasing tenors, used exactly as given (no live data).
- benchmark_name (string, required): Non-empty string naming the caller-supplied benchmark, echoed into the output curve.
- interpolation (string, optional): Named interpolation: 'linear' (linear@1) or 'monotone_cubic_hermite' (monotone_cubic_hermite@1, Fritsch-Carlson 1980). Defaults to linear.
- bond (object, required): { maturity_years, yield_pct } of the bond. A maturity_years outside the benchmark tenor range is refused naming the range, never extrapolated.

## Outputs

- assumptions (array, required)
- benchmark_yield_at_maturity_pct (number,null, required)
- curve (object,null, required)
- detail (string, optional)
- domain_errors (array, optional)
- error (string, optional)
- g_spread_bp (number,null, required)
- note (string, optional)
- regulatory_basis (string, optional)

## Sample

```json
{
  "benchmark_points": [
    {
      "tenor_years": 2,
      "yield_pct": 4
    },
    {
      "tenor_years": 5,
      "yield_pct": 4.5
    },
    {
      "tenor_years": 10,
      "yield_pct": 4.8
    }
  ],
  "benchmark_name": "UST par, as supplied",
  "interpolation": "linear",
  "bond": {
    "maturity_years": 5,
    "yield_pct": 5.1
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `build_yield_curve_gspread` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
