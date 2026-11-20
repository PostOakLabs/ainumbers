# Stablecoin Admin Role Lint

Lints a stablecoin token's declared admin-role configuration for separation of duties, key concentration and issuance-policy fit, over ROLE LABELS ONLY (never addresses or key material). Given a profile (Circle FiatToken, Paxos USDP, or generic caller-declared), holder kinds (eoa, multisig, timelock, hsm_service), a role-to-holder map (owner, proxy_admin, master_minter, pauser, blacklister, rescuer, supply_controller, asset_protection as the profile defines), minter allowances and an issuance policy, it reports: distinctness pairs held by the same label; labels holding multiple critical roles and single-signer holders of critical roles; per-minter and total allowance breaches against the declared ceilings; and whether pause, freeze and upgrade capabilities exist and who holds them. Verdict is PASS, PASS_WITH_FINDINGS or FAIL, each finding cited to the pinned source or marked caller-declared policy. Scope limits: configuration lint only: no live-chain reads, no key custody advice, no statutory claims (no lawful-order or GENIUS Act obligations are asserted); reserve-evidence questions are out of scope (art-06, art-275 cover reserve evidence; art-45 is the sibling linter for Arc xReserve bridge configuration). Any label resembling an address, public key or private key is refused.

- Page: https://ainumbers.co/chaingraph/art-789-stablecoin-admin-role-lint.html
- Markdown twin: https://ainumbers.co/chaingraph/art-789-stablecoin-admin-role-lint.md
- MCP tool: lint_stablecoin_admin_roles (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "profile": "fiattoken",
  "holders": [
    {
      "label": "org-treasury-msig",
      "kind": "multisig",
      "threshold": 3,
      "signers_count": 5
    },
    {
      "label": "upgrade-timelock",
      "kind": "timelock",
      "threshold": 0,
      "signers_count": 0
    },
    {
      "label": "minting-ops-msig",
      "kind": "multisig",
      "threshold": 2,
      "signers_count": 4
    },
    {
      "label": "risk-pause-msig",
      "kind": "multisig",
      "threshold": 2,
      "signers_count": 3
    },
    {
      "label": "compliance-blacklist-msig",
      "kind": "multisig",
      "threshold": 2,
      "signers_count": 3
    },
    {
      "label": "rescue-hsm",
      "kind": "hsm_service",
      "threshold": 0,
      "signers_count": 0
    }
  ],
  "roles": {
    "owner": "org-treasury-msig",
    "proxy_admin": "upgrade-timelock",
    "master_minter": "minting-ops-msig",
    "pauser": "risk-pause-msig",
    "blacklister": "compliance-blacklist-msig",
    "rescuer": "rescue-hsm"
  },
  "minters": [
    {
      "holder_label": "minting-ops-msig",
      "allowance_minor": 400000000000
    },
    {
      "holder_label": "org-treasury-msig",
      "allowance_minor": 500000000000
    }
  ],
  "policy": {
    "max_single_minter_allowance_minor": 1000000000000,
    "max_total_allowance_minor": 5000000000000,
    "require_multisig_for": [
      "owner",
      "proxy_admin",
      "master_minter",
      "pauser",
      "blacklister",
      "rescuer"
    ],
    "require_distinct": []
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `lint_stablecoin_admin_roles` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
