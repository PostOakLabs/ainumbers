#!/usr/bin/env python3
"""
sync_manifests.py — Bring every tool's standalone manifests/*.manifest.json up to the
CONTRACT §2.2 shape, sourcing from the tool HTML's own inline `var MANIFEST` where present
(authoritative, author-written) and constructing the mcp_tool_definition only where the tool
never had one.

Run from repo root:  python scripts/sync_manifests.py   (then re-run scripts/regen_catalog.py)

Only touches tools whose standalone manifest is MISSING or SHORT-FORM (no mcp_tool_definition.name).
The 300 already-complete manifests are left untouched. Idempotent.
"""
import json, glob, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

VERB = {  # tool_id trailing noun -> action verb, for deriving a verb_noun mcp name
    'builder':'build','mapper':'map','checker':'check','classifier':'classify',
    'calculator':'calculate','scorer':'score','assessor':'assess','validator':'validate',
    'splitter':'split','analyzer':'analyze','analyser':'analyse','generator':'generate',
    'simulator':'simulate','optimizer':'optimize','comparator':'compare','decoder':'decode',
    'linter':'lint','auditor':'audit','inspector':'inspect','estimator':'estimate',
    'detector':'detect','tester':'test','tracker':'track','planner':'plan',
}
def derive_name(tool_id):
    parts = re.sub(r'[^a-z0-9]+',' ', tool_id.lower()).split()
    if parts and parts[-1] in VERB:
        verb = VERB[parts[-1]]; rest = parts[:-1]
        return '_'.join([verb] + rest) if rest else verb
    return '_'.join(parts) or 'run_tool'

def inline_manifest(slug):
    fs = glob.glob(f'tools/{slug}.html')
    if not fs: return None, None
    h = open(fs[0], encoding='utf-8').read()
    run = None
    m = re.search(r'class="run-btn"[^>]*onclick="([a-zA-Z_]\w*)\(', h)
    if m: run = m.group(1)
    mv = re.search(r'var MANIFEST\s*=\s*(\{.*?\});', h, re.S)
    man = None
    if mv:
        try: man = json.loads(mv.group(1))
        except Exception: man = None
    return man, run

# Canonical key order per CONTRACT §2.2 (extras preserved at the end)
ORDER = ['tool_id','version','title','description','category','tags','audience',
         'input_schema','output_schema','mcp_tool_definition','execution','ap2_export']
def ordered(m):
    out = {k: m[k] for k in ORDER if k in m}
    for k in m:
        if k not in out: out[k] = m[k]
    return out

def complete(slug):
    """Return a complete manifest dict for slug, or None if no source at all."""
    inline, run = inline_manifest(slug)
    std_path = f'manifests/{slug}.manifest.json'
    std = json.load(open(std_path, encoding='utf-8')) if os.path.exists(std_path) else None
    # prefer the richer source as the base
    base = inline if (inline and len(inline) >= len(std or {})) else (std or inline or {})
    if not base: return None
    m = dict(base)
    m.setdefault('tool_id', slug.split('-',1)[1] if '-' in slug else slug)
    m.setdefault('version', '1.0.0')
    m.setdefault('title', m.get('tool_id', slug))
    m.setdefault('description', '')
    m.setdefault('category', (std or {}).get('category') or (inline or {}).get('category') or 'cat-2')
    m.setdefault('tags', [])
    m.setdefault('audience', [])
    m.setdefault('input_schema', {'type': 'object'})
    m.setdefault('output_schema', {'type': 'object'})
    if 'ap2_export' not in m: m['ap2_export'] = base.get('ap2_export', True)
    # mcp_tool_definition
    mtd = dict(m.get('mcp_tool_definition') or {})
    if not mtd.get('name'):
        mtd['name'] = derive_name(m['tool_id'])
    mtd.setdefault('description', m.get('description', ''))
    mtd.setdefault('inputSchema', m.get('input_schema', {'type': 'object'}))
    m['mcp_tool_definition'] = mtd
    # execution
    ex = dict(m.get('execution') or {})
    ex.setdefault('type', 'browser-javascript')
    ex['entry'] = f'tools/{slug}.html'
    if not ex.get('function_name'):
        ex['function_name'] = run or 'runTool'
    ex.setdefault('timeout_ms', 5000)
    m['execution'] = ex
    return ordered(m)

def main():
    tool_slugs = {os.path.basename(f)[:-5] for f in glob.glob('tools/*.html')}
    targets = []
    for slug in sorted(tool_slugs):
        p = f'manifests/{slug}.manifest.json'
        if not os.path.exists(p):
            targets.append((slug, 'MISSING')); continue
        m = json.load(open(p, encoding='utf-8'))
        if not m.get('mcp_tool_definition', {}).get('name'):
            targets.append((slug, 'short-form'))

    wrote = []
    for slug, why in targets:
        m = complete(slug)
        if not m:
            print(f"  SKIP {slug}: no source manifest found"); continue
        json.dump(m, open(f'manifests/{slug}.manifest.json', 'w', encoding='utf-8'),
                  indent=2, ensure_ascii=False)
        open(f'manifests/{slug}.manifest.json', 'a', encoding='utf-8').write('\n')
        wrote.append((slug, why, m['mcp_tool_definition']['name'], m['execution']['function_name']))

    print(f"Completed {len(wrote)} manifests ({sum(1 for w in wrote if w[1]=='MISSING')} were missing, "
          f"{sum(1 for w in wrote if w[1]=='short-form')} short-form):")
    for slug, why, name, fn in wrote:
        print(f"  [{why:>10}] {slug}  -> name={name}  fn={fn}")

    # global uniqueness check across ALL manifests
    names = {}
    for f in glob.glob('manifests/*.manifest.json'):
        if 'DELETE' in f: continue
        nm = json.load(open(f, encoding='utf-8')).get('mcp_tool_definition', {}).get('name')
        names.setdefault(nm, []).append(os.path.basename(f))
    dupes = {n: fs for n, fs in names.items() if n and len(fs) > 1}
    missing = [f for n, fs in names.items() if not n for f in fs]
    print(f"\nGlobal name uniqueness: {len(names)} names, {len(dupes)} duplicates, {len(missing)} still missing")
    for n, fs in dupes.items(): print(f"  DUPLICATE {n}: {fs}")
    for f in missing: print(f"  STILL MISSING NAME: {f}")
    assert not dupes and not missing, "manifest name invariant failed"
    print("OK — every manifest now has a unique mcp_tool_definition.name")
    return 0

if __name__ == '__main__':
    sys.exit(main())
