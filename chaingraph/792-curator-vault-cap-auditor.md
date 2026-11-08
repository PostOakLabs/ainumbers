# Curator Vault Cap Auditor

Audits a vault curator's point-in-time allocation snapshot against per-market caps and a declared mandate, from caller-declared minor-unit values only. Caps follow the pinned Morpho curation documentation semantics: an absolute cap is a fixed maximum amount per market and a relative cap is a maximum share of the vault's total assets, compared by exact integer cross-multiplication with no division; caps are allocation-time constraints, so an audit legitimately reports observed breaches on a snapshot. The kernel also checks the declared mandate (per-market, per-asset-class, idle floor, RWA floor, DeFi ceiling), reports concentration (largest market share and a Herfindahl index in basis points), idle-plus-withdrawable coverage of pending redemptions, and conservation (idle plus allocations equals total assets). Verdicts: WITHIN_MANDATE, WITHIN_MANDATE_WITH_WARNINGS or BREACH. Scope limits: no on-chain reads and no pricing: share pricing is the art-610 (ERC-4626 share math) domain and async redemption state is the art-611 (ERC-7540 request accounting) domain; asset classes are a fixed declared enum; relative-cap on-chain rounding and id-granularity encoding are code details shipped caller-declared, excluded here; profiles are morpho_vault_v2 (documented semantics) or generic (caller-declared); no curator or platform is named.

- Page: https://ainumbers.co/chaingraph/792-curator-vault-cap-auditor.html
- Markdown twin: https://ainumbers.co/chaingraph/792-curator-vault-cap-auditor.md
- MCP tool: audit_curator_vault_caps (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "profile": "morpho_vault_v2",
  "snapshot": {
    "total_assets_minor": 100000000,
    "idle_minor": 10000000,
    "markets": [
      {
        "market_label": "synthetic-market-A",
        "asset_class": "rwa_treasury",
        "allocated_minor": 30000000,
        "abs_cap_minor": 40000000,
        "rel_cap_bp": 4000,
        "withdrawable_minor": 25000000
      },
      {
        "market_label": "synthetic-market-B",
        "asset_class": "rwa_credit",
        "allocated_minor": 20000000,
        "abs_cap_minor": 35000000,
        "rel_cap_bp": 3500,
        "withdrawable_minor": 15000000
      },
      {
        "market_label": "synthetic-market-C",
        "asset_class": "defi_lending",
        "allocated_minor": 40000000,
        "abs_cap_minor": 50000000,
        "rel_cap_bp": 4500,
        "withdrawable_minor": 40000000
      }
    ]
  },
  "mandate": {
    "max_per_market_bp": 5000,
    "max_per_asset_class_bp": {
      "rwa_treasury": 4000,
      "defi_lending": 4500
    },
    "min_idle_bp": 800,
    "min_rwa_bp": 4000,
    "max_defi_bp": 5000
  },
  "redemptions": {
    "pending_minor": 5000000,
    "horizon_hours": 24
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `audit_curator_vault_caps` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
