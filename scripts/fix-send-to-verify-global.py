#!/usr/bin/env python3
"""
fix-send-to-verify-global.py — SPINE-BRIDGE-SEND2VERIFY-1 repair

apSendToVerify() is declared inside the bridge's IIFE, but the button
sweep-ain-bridge-v1_1.py inserted calls it via an inline onclick attribute
(onclick="apSendToVerify()"), which resolves against the GLOBAL scope, not
the IIFE closure. Result: every deployed button throws
"ReferenceError: apSendToVerify is not defined" on click (confirmed via a
real click in the browser, window.onerror capture).

Fix: expose the function globally right after its declaration, via the
one anchor common to both injected shapes (the plain and the compact
custom-stub variant end identically):
  ...
  },10000);
}
window.AINBridge=...

Usage (from repo root of the worktree):
  python scripts/fix-send-to-verify-global.py            # dry-run
  python scripts/fix-send-to-verify-global.py --write    # apply
"""

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
WRITE = "--write" in sys.argv

ANCHOR = "  },10000);\n}\nwindow.AINBridge="
REPLACEMENT = "  },10000);\n}\nwindow.apSendToVerify=apSendToVerify;\nwindow.AINBridge="

# A second, distinct defect (16 files): sweep-ain-bridge-v1_1.py's button
# anchor (.results-export-row) matched independently of the function-anchor
# check, so these files got a button with no apSendToVerify definition at
# all — a plain ReferenceError, not just a scope bug. All 16 share one
# minified shape: window.AINBridge={version:'1.0',apply:applyFields,...
MINIFIED_ANCHOR_RE = re.compile(r"window\.AINBridge=\{version:'1\.0',")
MINIFIED_FN = """window.apSendToVerify=function(){
  var m;try{m=window.AINBridge.getMandate();}catch(e){m=null;}
  if(!m){notice('\\u26a0 No Policy Mandate to send \\u2014 run the tool first.','warn');return;}
  var json;try{json=JSON.stringify(m);}catch(e){notice('\\u26a0 Could not serialize the mandate: '+e.message,'warn');return;}
  if(json.length>2000000){notice('\\u26a0 Too large to hand off ('+json.length+' chars).','warn');return;}
  var target=new URL('../chaingraph/verify.html',window.location.href).href;
  var win=window.open(target,'_blank');
  if(!win){notice('\\u26a0 The verifier window was blocked. Allow pop-ups for this site.','warn');return;}
  var sent=false,timer=null;
  function onReady(ev){
    if(ev.origin!==window.location.origin)return;
    if(ev.source!==win)return;
    var d=ev.data;
    if(!d||typeof d!=='object'||d.type!=='ain-handoff-ready/v1')return;
    if(sent)return;sent=true;
    window.removeEventListener('message',onReady);
    if(timer)clearTimeout(timer);
    win.postMessage({type:'ain-handoff/v1',kind:'policy-mandate',mandate:json},window.location.origin);
    notice('\\u27a1 Sent to the Artifact Verifier in the new tab.','ok');
  }
  window.addEventListener('message',onReady);
  notice('Opening the Artifact Verifier\\u2026','ok');
  timer=setTimeout(function(){
    if(sent)return;
    window.removeEventListener('message',onReady);
    notice('\\u26a0 The verifier did not answer. Export the mandate and paste it in.','warn');
  },10000);
};
"""


def main():
    mode = "APPLYING" if WRITE else "DRY-RUN"
    print(f"=== {mode} ===\n")

    snippet = REPO / "scripts" / "ain-bridge-v1.snippet.html"
    if snippet.exists():
        src = snippet.read_text(encoding="utf-8", errors="replace")
        if ANCHOR in src and "window.apSendToVerify=apSendToVerify" not in src:
            src = src.replace(ANCHOR, REPLACEMENT, 1)
            print(f"  fix: {snippet.relative_to(REPO)}")
            if WRITE:
                snippet.write_text(src, encoding="utf-8", newline="")

    tools_dir = REPO / "tools"
    fixed = missing_fn = already = fixed_minified = still_broken = 0
    for path in sorted(tools_dir.glob("*.html")):
        src = path.read_text(encoding="utf-8", errors="replace")
        has_fn = "function apSendToVerify(" in src or "window.apSendToVerify=function(" in src
        if not has_fn:
            if "ainSendVerifyBtn" in src and MINIFIED_ANCHOR_RE.search(src):
                out = MINIFIED_ANCHOR_RE.sub(
                    lambda m: MINIFIED_FN + "window.AINBridge={version:'1.1',sendToVerify:window.apSendToVerify,",
                    src,
                    count=1,
                )
                fixed_minified += 1
                if WRITE:
                    path.write_text(out, encoding="utf-8", newline="")
            elif "ainSendVerifyBtn" in src:
                still_broken += 1
                print(f"  STILL BROKEN (button, no function, no known anchor): {path.relative_to(REPO)}")
            else:
                missing_fn += 1
            continue
        if "window.apSendToVerify=apSendToVerify" in src or "window.apSendToVerify=function(" in src:
            already += 1
            continue
        if ANCHOR not in src:
            print(f"  WARN anchor not found: {path.relative_to(REPO)}")
            continue
        out = src.replace(ANCHOR, REPLACEMENT, 1)
        fixed += 1
        if WRITE:
            path.write_text(out, encoding="utf-8", newline="")

    print(
        f"\n  fixed (scope-exposed): {fixed}  fixed (function was missing entirely): {fixed_minified}  "
        f"already global: {already}  no apSendToVerify at all (no button either): {missing_fn}  "
        f"still broken: {still_broken}"
    )
    if not WRITE and fixed:
        print("\nRe-run with --write to apply.")


if __name__ == "__main__":
    main()
