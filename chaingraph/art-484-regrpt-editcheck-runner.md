# Published Regulatory Report Edit-Check Runner

Evaluates a caller-supplied report instance against a caller-supplied published edit-check rule set - FFIEC Call Report validity and quality edits (Excel/PDF, published ahead of each quarter-end, latest 2026-01-22) or the EBA ITS validation-rules list - across seven rule shapes: intra-schedule arithmetic identity, cross-schedule tie-out, sign/domain constraint, mandatory-field completeness, closed-domain membership, conditional presence, and conditional prohibition. The three conditional shapes take a when predicate over other cells in the same row. Returns per-rule pass/fail/suppressed status keyed by the published edit id, with failing cell references and computed-vs-reported values. Accepts a deactivation/suppression list as a first-class policy input (the EBA publishes rules deactivated for inaccuracies or IT issues; this kernel never reports a failure on a stood-down rule, and records exactly which suppressions were applied plus any that are stale). Distinct from art-434-call-report-edit-check-gate, which runs a CURATED, HARDCODED battery of checks against a specific art-432/art-433 Schedule RC/RC-R output shape: this kernel bakes in no rule content at all, and evaluates whatever rule set the caller supplies against whatever report instance the caller supplies. Nothing access-gated is required to get a result.

- Page: https://ainumbers.co/chaingraph/art-484-regrpt-editcheck-runner.html
- Markdown twin: https://ainumbers.co/chaingraph/art-484-regrpt-editcheck-runner.md
- MCP tool: run_regrpt_edit_checks (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- report_instance (unknown, required)
- rule_set (unknown, required)
- suppressions (unknown, required)

## Outputs

- compliance_flags (array, optional)
- findings (array, optional)
- note (string, optional)
- rule_set_source (string, optional)
- rule_set_version (string, optional)
- stale_suppressions (array, optional)
- summary (object, optional)
- suppressions_applied (array, optional)

## Sample

```json
{
  "report_instance": {
    "as_of": "2026-03-31",
    "cells": [
      {
        "cell_ref": "RCON2170",
        "schedule": "RC",
        "line_item": "total_assets",
        "value": 1000
      },
      {
        "cell_ref": "RCON2948",
        "schedule": "RC",
        "line_item": "total_liabilities",
        "value": 700
      },
      {
        "cell_ref": "RCON3210",
        "schedule": "RC",
        "line_item": "total_equity_capital",
        "value": 300
      },
      {
        "cell_ref": "RCFA7206",
        "schedule": "RC-R",
        "line_item": "cet1_capital",
        "value": 250
      },
      {
        "cell_ref": "RCFA7206_TIEOUT",
        "schedule": "RC-R-SUMMARY",
        "line_item": "cet1_capital_restated",
        "value": 250
      },
      {
        "cell_ref": "RCFAB588",
        "schedule": "RC-R",
        "line_item": "total_rwa",
        "value": 2000
      },
      {
        "cell_ref": "RCONK652",
        "schedule": "RC",
        "line_item": "entity_id",
        "value": "FDIC-CERT-1234"
      }
    ]
  },
  "rule_set": {
    "version": "FFIEC-2026-01-22",
    "source": "FFIEC Call Report Validity and Quality Edits, effective 2026-01-22",
    "rules": [
      {
        "edit_id": "FFIEC-VE-0142",
        "type": "arithmetic_identity",
        "schedule": "RC",
        "description": "Total assets equals total liabilities plus total equity capital.",
        "severity": "fatal",
        "target_ref": "RCON2170",
        "component_refs": [
          "RCON2948",
          "RCON3210"
        ],
        "tolerance": 1
      },
      {
        "edit_id": "FFIEC-VE-0891",
        "type": "cross_schedule_tie_out",
        "schedule": "RC-R",
        "description": "CET1 capital ties out to its RC-R summary restatement.",
        "severity": "fatal",
        "ref_a": "RCFA7206",
        "ref_b": "RCFA7206_TIEOUT",
        "tolerance": 0
      },
      {
        "edit_id": "FFIEC-VE-0203",
        "type": "sign_domain",
        "schedule": "RC-R",
        "description": "Total risk-weighted assets is positive.",
        "severity": "fatal",
        "ref": "RCFAB588",
        "domain": "positive"
      },
      {
        "edit_id": "FFIEC-VE-0004",
        "type": "mandatory_field",
        "schedule": "RC",
        "description": "Entity identifier is present.",
        "severity": "fatal",
        "ref": "RCONK652"
      }
    ]
  },
  "suppressions": []
}
```

## Verify

Run the sample policy_parameters through MCP tool `run_regrpt_edit_checks` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
