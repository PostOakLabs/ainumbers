#!/usr/bin/env python3
"""
patch_gpu_compute_capability.py
Workstream B — flip compute_capability for all gpu:true nodes.

For nodes that now have a real pure-JS kernel (the 15 in KERNEL_IDS):
  compute_capability: "server"

For any remaining gpu:true nodes that did NOT get a kernel:
  compute_capability: "browser"   (fallback — browser delegation)

Run: python repo/patch_gpu_compute_capability.py
"""

import json
import pathlib

CHAINGRAPH_PATH = pathlib.Path(__file__).parent / "chaingraph" / "chaingraph.json"

# The 15 tool_ids that received real pure-JS kernels in Workstream B
KERNEL_IDS = {
    "art-02-agent-spend-policy-simulator",
    "art-07-basel31-reporting-delta-calculator",
    "art-08-en16931-einvoice-batch-validator",
    "art-10-amla-transaction-typology-risk-scorer",
    "cry-01-zk-compliance-proof-generator",
    "qfa-02-portfolio-var-engine",
    "rca-03-iso20022-address-migration-verifier",
    "sim-01-lcr-nsfr-liquidity-stress-test",
    "sim-03-basel-rwa-scenario-modeler",
    "rca-02-mica-reserve-stress",
    "pnr-01-dora-ict-cascade-simulator",
    "mms-03-app-fraud-graph",
    "qfa-04-xva-cva-calculator",
    "qfa-03-stress-test-engine",
    "ml-02-credit-default-risk-scorer",
}


def patch():
    with open(CHAINGRAPH_PATH, encoding="utf-8") as f:
        cg = json.load(f)

    nodes = cg.get("nodes", [])
    patched_server = []
    patched_browser = []

    for node in nodes:
        if not node.get("gpu", False):
            continue
        tool_id = node.get("tool_id", "")
        if tool_id in KERNEL_IDS:
            node["compute_capability"] = "server"
            patched_server.append(tool_id)
        else:
            node["compute_capability"] = "browser"
            patched_browser.append(tool_id)

    with open(CHAINGRAPH_PATH, "w", encoding="utf-8", newline="\n") as f:
        json.dump(cg, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"Patched {len(patched_server)} nodes → compute_capability: 'server':")
    for tid in sorted(patched_server):
        print(f"  {tid}")

    if patched_browser:
        print(f"\nPatched {len(patched_browser)} nodes → compute_capability: 'browser' (no kernel):")
        for tid in sorted(patched_browser):
            print(f"  {tid}")
    else:
        print("\nNo remaining gpu:true nodes without a kernel.")


if __name__ == "__main__":
    patch()
