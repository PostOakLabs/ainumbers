# Regulatory Report Period-over-Period Variance Explainer

Computes period-over-period variance across a regulatory report instance pair - absolute and relative movement per line item against a policy-supplied materiality threshold (default plus per-line overrides), ranked by contribution (largest absolute movement first) - and flags which movements require a written explanation, i.e. exceed materiality with no matching explanation on file. Does not judge whether a supplied explanation is adequate; that is a human review-and-approval step downstream (RGEC-K-2's gate: an unexplained material variance routes to review_required). Pairs with art-484-regrpt-editcheck-runner's rule-based edit checks - this node handles analytical-review variance, not rule pass/fail.

- Page: https://ainumbers.co/chaingraph/art-485-regrpt-variance-explainer.html
- Markdown twin: https://ainumbers.co/chaingraph/art-485-regrpt-variance-explainer.md
- MCP tool: explain_regrpt_variance (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- explanations (unknown, required)
- instance_pair (unknown, required)
- materiality_policy (unknown, required)

## Outputs

- compliance_flags (array, optional)
- current_as_of (string, optional)
- note (string, optional)
- policy_version (string, optional)
- prior_as_of (string, optional)
- summary (object, optional)
- variances (array, optional)

## Sample

```json
{
  "instance_pair": {
    "prior": {
      "as_of": "2026-03-31",
      "cells": [
        {
          "line_item": "total_loans",
          "value": 10000
        },
        {
          "line_item": "total_deposits",
          "value": 9000
        }
      ]
    },
    "current": {
      "as_of": "2026-06-30",
      "cells": [
        {
          "line_item": "total_loans",
          "value": 11500
        },
        {
          "line_item": "total_deposits",
          "value": 9050
        },
        {
          "line_item": "other_real_estate_owned",
          "value": 200
        }
      ]
    }
  },
  "materiality_policy": {
    "version": "FFIEC-MATERIALITY-2026-Q2",
    "default_threshold_abs": 100,
    "default_threshold_pct": 0.05,
    "per_line_overrides": {
      "other_real_estate_owned": {
        "abs": 50,
        "pct": 0
      }
    }
  },
  "explanations": [
    {
      "line_item": "total_loans",
      "text": "Growth from a Q2 syndicated-loan participation purchase."
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `explain_regrpt_variance` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
