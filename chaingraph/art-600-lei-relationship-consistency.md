# LEI Relationship Consistency Checker

Checks four structural invariants over a pasted set of GLEIF Level-2 relationship records for one subject LEI: every startNode and endNode is a syntactically valid LEI (ISO 17442 mod-97, the same check art-246 carries), walking IS_DIRECTLY_CONSOLIDATED_BY edges never revisits a node already on the current path, every reporting-exception code is a published GLEIF category held as a versioned constant rather than inferred, and no two active records share a startNode, endNode and relationshipType triple with overlapping validity periods. A violation flags a possible inconsistency in GLEIF's published Level-2 data for this LEI. It is not an assertion about the entity's actual corporate structure and not a finding about the entity itself; golden-copy data is periodically corrected, so recheck against a fresh pull before treating any violation as durable. An empty record set returns consistent as null rather than a clean pass. Zero network: this never queries GLEIF and is not a re-implementation of GLEIF's own reconciliation service.

- Page: https://ainumbers.co/chaingraph/art-600-lei-relationship-consistency.html
- Markdown twin: https://ainumbers.co/chaingraph/art-600-lei-relationship-consistency.md
- MCP tool: check_lei_relationship_consistency (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- relationships (array, required)
- subject_lei (unknown, required)

## Outputs

- consistent (boolean, optional)
- cycle_path (string, optional)
- deprecated_exception_codes (array, optional)
- duplicate_active_triples (array, optional)
- exception_table_source (string, optional)
- exception_table_version (string, optional)
- invalid_node_leis (array, optional)
- invariant_results (array, optional)
- pii_note (string, optional)
- recognized_exception_codes_current (array, optional)
- recognized_exception_codes_deprecated (array, optional)
- record_count (integer, optional)
- records_assessed (boolean, optional)
- scope_note (string, optional)
- subject_lei (string, optional)
- subject_lei_valid (boolean, optional)
- unrecognized_exception_codes (array, optional)
- violation_count (integer, optional)
- violations (array, optional)

## Sample

```json
{
  "subject_lei": "5493001KJTIIGC8Y1R12",
  "relationships": [
    {
      "start_node_lei": "5493001KJTIIGC8Y1R12",
      "end_node_lei": "7LTWFZYICNSX8D621K86",
      "relationship_type": "IS_DIRECTLY_CONSOLIDATED_BY",
      "relationship_status": "ACTIVE",
      "start_date": "2020-01-01"
    },
    {
      "start_node_lei": "7LTWFZYICNSX8D621K86",
      "end_node_lei": "529900T8BM49AURSDO55",
      "relationship_type": "IS_ULTIMATELY_CONSOLIDATED_BY",
      "relationship_status": "ACTIVE",
      "start_date": "2019-01-01",
      "exception_code": "NON_PUBLIC"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_lei_relationship_consistency` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
