# Declarative Decision-Tree Evaluator

Evaluates a caller-supplied, hash-pinned decision tree against caller-supplied facts entirely offline, client-side. The tree is inert data - one audited interpreter walks it over a closed operator set (eq, in, lt, lte, gt, gte, between, all_of, any_of, none_of), never eval and never a function-valued criterion. Every node in the tree, internal criteria included and not leaves only, must carry a citation to a pinned clause snapshot; a tree with any uncited node is rejected by the loader. Independently recomputes the tree's own tree_digest from its bytes and refuses to evaluate on a mismatch - never trusting the declared digest as an oracle for itself. Ships with a demonstrator tree exercising the Reg D Rule 501(a) entity-type accredited-investor category test (17 CFR 230.501(a)(1), (2), (3), (8), (9)), enumerated exhaustively over its 5 declared boolean fields (32 combinations, 0 unexplained results) because every criterion in that tree is a bounded enum. Never a full accredited-investor determination: the natural-person and numeric-threshold prongs of Rule 501(a) are explicitly out of this demonstrator's scope.

- Page: https://ainumbers.co/chaingraph/art-628-declarative-decision-tree-evaluator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-628-declarative-decision-tree-evaluator.md
- MCP tool: evaluate_decision_tree (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- tree (object, optional)
- facts (object, optional)

## Outputs

- verdict (string,null, optional)
- error_code (string,null, optional)
- message (string,null, optional)
- matched_node_id (string,null, optional)
- matched_citation (object,null, optional)
- path (array, optional)
- weight (any, optional)
- tree_id (string,null, optional)
- tree_version (string,null, optional)
- tree_digest_recomputed (string,null, optional)
- bounds (object, optional)
- closed_operator_set (array, optional)
- scope_note (string, optional)

## Sample

```json
{
  "tree": {
    "tree_id": "reg-d-501a-entity-accredited-investor-category-test",
    "tree_version": "1.0.0",
    "tree_digest": "f61c62137ae8f90a43866df4e8cfbd122499c942599d3287813dc2fc71c0dd91",
    "root": "c_501a1",
    "nodes": {
      "c_501a1": {
        "kind": "criterion",
        "field": "is_501a1_institution",
        "operator": "eq",
        "operand": true,
        "branches": {
          "true": "leaf_501a1",
          "false": "c_bdc"
        },
        "citation": {
          "clause": "17 CFR 230.501(a)(1)",
          "source": "17 CFR 230.501(a)(1) (Regulation D, Securities Act of 1933, accredited investor definition)",
          "source_digest": "0cd4295ba5a4b7192725f7dcf323d59c3e4f4768064b9a498f721504119279f6",
          "snapshot_location": "research/clause-snapshots/17-cfr-230.501-a.snapshot.md"
        }
      },
      "c_bdc": {
        "kind": "criterion",
        "field": "is_private_bdc",
        "operator": "eq",
        "operand": true,
        "branches": {
          "true": "leaf_bdc",
          "false": "c_501c3"
        },
        "citation": {
          "clause": "17 CFR 230.501(a)(2)",
          "source": "17 CFR 230.501(a)(2) (Regulation D, Securities Act of 1933, accredited investor definition)",
          "source_digest": "0cd4295ba5a4b7192725f7dcf323d59c3e4f4768064b9a498f721504119279f6",
          "snapshot_location": "research/clause-snapshots/17-cfr-230.501-a.snapshot.md"
        }
      },
      "c_501c3": {
        "kind": "criterion",
        "field": "is_501c3_or_qualifying_entity_over_5m",
        "operator": "eq",
        "operand": true,
        "branches": {
          "true": "leaf_501c3",
          "false": "c_equity"
        },
        "citation": {
          "clause": "17 CFR 230.501(a)(3)",
          "source": "17 CFR 230.501(a)(3) (Regulation D, Securities Act of 1933, accredited investor definition)",
          "source_digest": "0cd4295ba5a4b7192725f7dcf323d59c3e4f4768064b9a498f721504119279f6",
          "snapshot_location": "research/clause-snapshots/17-cfr-230.501-a.snapshot.md"
        }
      },
      "c_equity": {
        "kind": "criterion",
        "field": "all_equity_owners_accredited",
        "operator": "eq",
        "operand": true,
        "branches": {
          "true": "leaf_equity",
          "false": "c_catchall"
        },
        "citation": {
          "clause": "17 CFR 230.501(a)(8)",
          "source": "17 CFR 230.501(a)(8) (Regulation D, Securities Act of 1933, accredited investor definition)",
          "source_digest": "0cd4295ba5a4b7192725f7dcf323d59c3e4f4768064b9a498f721504119279f6",
          "snapshot_location": "research/clause-snapshots/17-cfr-230.501-a.snapshot.md"
        }
      },
      "c_catchall": {
        "kind": "criterion",
        "field": "is_other_entity_investments_over_5m",
        "operator": "eq",
        "operand": true,
        "branches": {
          "true": "leaf_catchall",
          "false": "leaf_not_accredited"
        },
        "citation": {
          "clause": "17 CFR 230.501(a)(9)",
          "source": "17 CFR 230.501(a)(9) (Regulation D, Securities Act of 1933, accredited investor definition)",
          "source_digest": "0cd4295ba5a4b7192725f7dcf323d59c3e4f4768064b9a498f721504119279f6",
          "snapshot_location": "research/clause-snapshots/17-cfr-230.501-a.snapshot.md"
        }
      },
      "leaf_501a1": {
        "kind": "leaf",
        "verdict": "accredited",
        "citation": {
          "clause": "17 CFR 230.501(a)(1)",
          "source": "17 CFR 230.501(a)(1) (Regulation D, Securities Act of 1933, accredited investor definition)",
          "source_digest": "0cd4295ba5a4b7192725f7dcf323d59c3e4f4768064b9a498f721504119279f6",
          "snapshot_location": "research/clause-snapshots/17-cfr-230.501-a.snapshot.md"
        }
      },
      "leaf_bdc": {
        "kind": "leaf",
        "verdict": "accredited",
        "citation": {
          "clause": "17 CFR 230.501(a)(2)",
          "source": "17 CFR 230.501(a)(2) (Regulation D, Securities Act of 1933, accredited investor definition)",
          "source_digest": "0cd4295ba5a4b7192725f7dcf323d59c3e4f4768064b9a498f721504119279f6",
          "snapshot_location": "research/clause-snapshots/17-cfr-230.501-a.snapshot.md"
        }
      },
      "leaf_501c3": {
        "kind": "leaf",
        "verdict": "accredited",
        "citation": {
          "clause": "17 CFR 230.501(a)(3)",
          "source": "17 CFR 230.501(a)(3) (Regulation D, Securities Act of 1933, accredited investor definition)",
          "source_digest": "0cd4295ba5a4b7192725f7dcf323d59c3e4f4768064b9a498f721504119279f6",
          "snapshot_location": "research/clause-snapshots/17-cfr-230.501-a.snapshot.md"
        }
      },
      "leaf_equity": {
        "kind": "leaf",
        "verdict": "accredited",
        "citation": {
          "clause": "17 CFR 230.501(a)(8)",
          "source": "17 CFR 230.501(a)(8) (Regulation D, Securities Act of 1933, accredited investor definition)",
          "source_digest": "0cd4295ba5a4b7192725f7dcf323d59c3e4f4768064b9a498f721504119279f6",
          "snapshot_location": "research/clause-snapshots/17-cfr-230.501-a.snapshot.md"
        }
      },
      "leaf_catchall": {
        "kind": "leaf",
        "verdict": "accredited",
        "citation": {
          "clause": "17 CFR 230.501(a)(9)",
          "source": "17 CFR 230.501(a)(9) (Regulation D, Securities Act of 1933, accredited investor definition)",
          "source_digest": "0cd4295ba5a4b7192725f7dcf323d59c3e4f4768064b9a498f721504119279f6",
          "snapshot_location": "research/clause-snapshots/17-cfr-230.501-a.snapshot.md"
        }
      },
      "leaf_not_accredited": {
        "kind": "leaf",
        "verdict": "not_accredited",
        "citation": {
          "clause": "17 CFR 230.501(a)",
          "source": "17 CFR 230.501(a) chapeau (categories are exhaustive: any person within any of the following categories)",
          "source_digest": "0cd4295ba5a4b7192725f7dcf323d59c3e4f4768064b9a498f721504119279f6",
          "snapshot_location": "research/clause-snapshots/17-cfr-230.501-a.snapshot.md"
        }
      }
    }
  },
  "facts": {
    "is_501a1_institution": true,
    "is_private_bdc": false,
    "is_501c3_or_qualifying_entity_over_5m": false,
    "all_equity_owners_accredited": false,
    "is_other_entity_investments_over_5m": false
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `evaluate_decision_tree` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
