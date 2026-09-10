# Clause Coverage Scorer

Scores an agreement's clause coverage against a named clause taxonomy - the oneSaaS 52-clause canonical set, the Common Paper Language Library, the GDPR Article 28 processor set, or a custom list. Reads a caller-declared present/modified/extra/missing status per clause and returns a coverage percentage, modification rate, and a maturity tier (minimal/partial/substantial/full). Extra clauses are tracked but excluded from the coverage denominator. This node reads the caller's own clause inventory - it never vendors, assembles, or redistributes any third-party template body. Not legal advice and not a determination that any agreement is compliant. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-410-clause-coverage-scorer.html
- Markdown twin: https://ainumbers.co/chaingraph/art-410-clause-coverage-scorer.md
- MCP tool: score_clause_coverage (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "taxonomy": "onesaas_52",
  "clauses": [
    {
      "id": "data_ownership",
      "status": "present"
    },
    {
      "id": "sla_uptime",
      "status": "present"
    },
    {
      "id": "termination_for_convenience",
      "status": "present"
    },
    {
      "id": "limitation_of_liability",
      "status": "present"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `score_clause_coverage` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
