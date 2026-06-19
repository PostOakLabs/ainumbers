"""
Patch chaingraph.json: flip every compute_capability "auto" → "server".
Run from repo root:  python patch_compute_capability.py
"""
import json, pathlib, sys

TARGET = pathlib.Path(__file__).parent / "chaingraph" / "chaingraph.json"

data = json.loads(TARGET.read_text(encoding="utf-8"))

nodes = data.get("nodes", [])
patched = 0
for node in nodes:
    if node.get("compute_capability") == "auto":
        node["compute_capability"] = "server"
        patched += 1

if patched == 0:
    print("No 'auto' nodes found — nothing to patch.")
    sys.exit(0)

TARGET.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"Patched {patched} node(s): compute_capability 'auto' → 'server'")
print(f"Written: {TARGET}")
