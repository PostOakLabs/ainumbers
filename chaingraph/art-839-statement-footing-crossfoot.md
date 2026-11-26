# Statement Footing and Cross-Footing Check

Foots and cross-foots declared financial statement lines and ties declared note amounts to declared statement lines, in integer minor units, under the tolerance and sign convention the caller declares. The caller declares the columns, the lines (an id, a section id, a role of detail, subtotal or total, and one amount per column), the total relations (a total line and the signed lines it sums), the cross-foot relations (a line whose total column equals the sum of declared columns) and the note references (a note id, the noted amount and the line and column it should tie to). Returns every footing break (column, expected sum, stated total, difference), every cross-foot break, every note-to-statement break, the lines no relation references, and a verdict of ties, breaks, indeterminate when a referenced id or a required declaration is missing, or input_refused. A statement never ties when it was not fully footed: a subtotal or total line that no total relation foots is flagged TOTAL_LINE_NOT_FOOTED and a statement with more than one column and no cross-foot relation is flagged CROSSFOOT_NOT_DECLARED, and either gives indeterminate unless a break is found; a statement with no subtotal or total lines may tie with a NOTHING_FOOTED warning when footing_checked is 0; note references are optional. Limits are 200 lines, 8 columns, 200 relations and 200 members per relation, and amounts and tolerance within 1e13 minor units; past a limit the verdict is indeterminate with a named flag such as LINE_AMOUNT_EXCEEDS_LIMIT. A difference at or inside the tolerance ties; one minor unit past it is a break. Ids and integers only: free-text labels, names and anything shaped like an account number are refused with an explicit code and never read. Checks arithmetic and references among declared values. It does not read a document, does not verify that the figures are the real ones, and is not an audit procedure on its own. It is distinct from art-526, which ties a reported figure to a general ledger figure by account, and from the domain-specific art-508 and art-509; this node checks a statement against itself and against its own note references. No adjacency is declared here.

- Page: https://ainumbers.co/chaingraph/art-839-statement-footing-crossfoot.html
- Markdown twin: https://ainumbers.co/chaingraph/art-839-statement-footing-crossfoot.md
- MCP tool: check_statement_footing_crossfoot (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "columns": [
    "c1",
    "c2",
    "c3"
  ],
  "lines": [
    {
      "line_id": "rev_a",
      "section_id": "rev",
      "role": "detail",
      "amounts_minor": [
        100000,
        50000,
        150000
      ]
    },
    {
      "line_id": "rev_b",
      "section_id": "rev",
      "role": "detail",
      "amounts_minor": [
        200000,
        25000,
        225000
      ]
    },
    {
      "line_id": "rev_tot",
      "section_id": "rev",
      "role": "total",
      "amounts_minor": [
        300000,
        75000,
        375000
      ]
    },
    {
      "line_id": "exp_a",
      "section_id": "exp",
      "role": "detail",
      "amounts_minor": [
        60000,
        10000,
        70000
      ]
    },
    {
      "line_id": "exp_b",
      "section_id": "exp",
      "role": "detail",
      "amounts_minor": [
        40000,
        5000,
        45000
      ]
    },
    {
      "line_id": "exp_tot",
      "section_id": "exp",
      "role": "subtotal",
      "amounts_minor": [
        100000,
        15000,
        115000
      ]
    },
    {
      "line_id": "net",
      "section_id": "net",
      "role": "total",
      "amounts_minor": [
        200000,
        60000,
        260000
      ]
    }
  ],
  "total_relations": [
    {
      "total_line_id": "rev_tot",
      "members": [
        {
          "line_id": "rev_a",
          "sign": 1
        },
        {
          "line_id": "rev_b",
          "sign": 1
        }
      ]
    },
    {
      "total_line_id": "exp_tot",
      "members": [
        {
          "line_id": "exp_a",
          "sign": 1
        },
        {
          "line_id": "exp_b",
          "sign": 1
        }
      ]
    },
    {
      "total_line_id": "net",
      "members": [
        {
          "line_id": "rev_tot",
          "sign": 1
        },
        {
          "line_id": "exp_tot",
          "sign": -1
        }
      ]
    }
  ],
  "crossfoot_relations": [
    {
      "line_id": "rev_a",
      "member_column_ids": [
        "c1",
        "c2"
      ],
      "total_column_id": "c3"
    },
    {
      "line_id": "rev_b",
      "member_column_ids": [
        "c1",
        "c2"
      ],
      "total_column_id": "c3"
    },
    {
      "line_id": "rev_tot",
      "member_column_ids": [
        "c1",
        "c2"
      ],
      "total_column_id": "c3"
    },
    {
      "line_id": "exp_a",
      "member_column_ids": [
        "c1",
        "c2"
      ],
      "total_column_id": "c3"
    },
    {
      "line_id": "exp_b",
      "member_column_ids": [
        "c1",
        "c2"
      ],
      "total_column_id": "c3"
    },
    {
      "line_id": "exp_tot",
      "member_column_ids": [
        "c1",
        "c2"
      ],
      "total_column_id": "c3"
    },
    {
      "line_id": "net",
      "member_column_ids": [
        "c1",
        "c2"
      ],
      "total_column_id": "c3"
    }
  ],
  "note_refs": [
    {
      "note_id": "n1",
      "noted_amount_minor": 300000,
      "line_id": "rev_tot",
      "column_id": "c1"
    },
    {
      "note_id": "n2",
      "noted_amount_minor": 115000,
      "line_id": "exp_tot",
      "column_id": "c3"
    }
  ],
  "tolerance_minor": 0,
  "sign_convention": "signed"
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_statement_footing_crossfoot` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
