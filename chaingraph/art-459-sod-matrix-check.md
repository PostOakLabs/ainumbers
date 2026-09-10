# Segregation-of-Duties Matrix Checker

Evaluates a caller-declared role-assignment set against a caller-declared SoD conflict ruleset for SOX 404 / ICFR access controls. For every user, checks all pairs of assigned roles against the ruleset and returns any conflicts found, the count of affected users, and a clean/not-clean verdict. The ruleset is a versioned policy input, never derived by the kernel. Deterministic pairwise set evaluation only. Zero network, zero PII - user_id and role names are caller-supplied opaque strings.

- Page: https://ainumbers.co/chaingraph/art-459-sod-matrix-check.html
- Markdown twin: https://ainumbers.co/chaingraph/art-459-sod-matrix-check.md
- MCP tool: check_sod_matrix (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- assignments (array, required)
- conflict_ruleset (array, required)
- ruleset_version (unknown, required)

## Outputs

- clean (boolean, optional)
- conflict_count (integer, optional)
- conflict_rules_evaluated (integer, optional)
- conflicts (array, optional)
- ruleset_version (string, optional)
- users_evaluated (integer, optional)
- users_with_conflicts (integer, optional)

## Sample

```json
{
  "ruleset_version": "sod-ruleset-v1",
  "conflict_ruleset": [
    {
      "role_a": "AP_ENTRY",
      "role_b": "AP_APPROVE",
      "reason_code": "SOD_AP_ENTRY_APPROVE"
    }
  ],
  "assignments": [
    {
      "user_id": "u1",
      "roles": [
        "AP_ENTRY"
      ]
    },
    {
      "user_id": "u2",
      "roles": [
        "AP_APPROVE"
      ]
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_sod_matrix` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
