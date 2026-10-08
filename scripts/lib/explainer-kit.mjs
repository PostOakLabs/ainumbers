/**
 * scripts/lib/explainer-kit.mjs — EXPLAINER-KIT v1 (EXPLAINER-KIT-1, 2026-09-28).
 *
 * The shared design of an OpenChainGraph explainer page: colour tokens, page
 * layout, panels, prompt blocks, run tables, cards, the PII banner slot and
 * presenter mode, plus the presenter and playback JavaScript that drives them.
 * Lifted verbatim from chaingraph/agent-staircase-explainer.html, which Tim
 * ruled on 2026-09-28 becomes the template every later explainer starts from.
 *
 * RELATION TO SCENE-KIT (scripts/lib/scene-kit.mjs). This kit carries NO
 * animation rules. It COMPOSES the scene kit: an explainer page carries the
 * SCENE-KIT regions for its motion and the EXPLAINER-KIT regions for its
 * design, and scripts/sync-explainer-kit.mjs --check fails a page that
 * declares animation of its own outside those regions. That keeps one
 * animation system across the estate. The Staircase page's own an-* classes
 * were folded into the scene kit as sk-* when it adopted this kit, so nothing
 * runs in parallel with it.
 *
 * Pages stay single self-contained files (CONTRACT §1), so an explainer cannot
 * import this module. It carries an inline COPY of each region instead, marked
 * by the comment pairs below, and sync-explainer-kit.mjs owns those copies the
 * way sync-scene-kit.mjs owns the scene kit's.
 *
 * What a consuming page must provide:
 *   · <section class="panel" data-stair="Label" data-part="1|2|3"> per step,
 *     each with an id, wrapping its content in <div class="wrap">;
 *   · a #btnPresent button and the .pbar toolbar (#pPrev, #pCount, #pNext,
 *     #pRail, #pAuto, #pExit) for presenter mode;
 *   · optionally #stairMap, the hero staircase drawn from the panel list;
 *   · scenes as <svg class="sk-scene"> inside .scene-wrap > .scene-scroll,
 *     with a [data-replay] button when the scene should be replayable.
 * Every one of those is optional to the script: a page missing a hook simply
 * loses that feature, so the scaffold can grow into a full explainer.
 */

export const EXPLAINER_KIT_VERSION = 'v1';

export const EXPLAINER_KIT_CSS = `/* EXPLAINER-KIT:v1 (scripts/lib/explainer-kit.mjs) */
:root{
  --bg:#080E1A; --bg-2:#0D1627; --bg-3:#111E35; --bg-4:#162340;
  --border:#1E2F4A; --border-2:#263855; --muted:#3A5270; --body:#6888A8;
  --text:#A8C4DE; --bright:#D4E8F8; --white:#EEF6FD;
  --teal:#14B8A6; --teal-dim:rgba(20,184,166,.12); --teal-lt:#2DD4BF;
  --gold:#D4A847; --gold-dim:rgba(212,168,71,.12);
  --green:#22C55E; --green-dim:rgba(34,197,94,.12);
  --red:#EF4444; --red-dim:rgba(239,68,68,.12);
  --warn:#F59E0B; --warn-dim:rgba(245,158,11,.12);
  --purple:#9B72F5; --purple-dim:rgba(155,114,245,.12);
  --blue:#60A5FA; --blue-dim:rgba(96,165,250,.12);
  --radius:6px; --radius-lg:10px;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--text);font-family:'Sora',sans-serif;font-weight:300;font-size:15px;line-height:1.75;-webkit-font-smoothing:antialiased;overflow-x:hidden}
body::before{content:'';position:fixed;inset:0;background-image:linear-gradient(rgba(20,184,166,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(20,184,166,.02) 1px,transparent 1px);background-size:48px 48px;pointer-events:none;z-index:0}
h1,h2,h3{font-family:'DM Serif Display',serif;font-weight:400;line-height:1.22}
code{font-family:'JetBrains Mono',monospace;font-size:.82em;color:var(--teal-lt);background:var(--teal-dim);padding:.05rem .3rem;border-radius:3px;word-break:break-word}
a{color:var(--teal-lt);text-decoration:none}
a:hover{text-decoration:underline}
a:focus-visible,button:focus-visible,[tabindex]:focus-visible{outline:2px solid var(--teal-lt);outline-offset:2px}
.wrap{max-width:1000px;margin:0 auto;padding:0 2rem;position:relative;z-index:1}

/* hero */
.hero{padding:3.5rem 0 2.4rem;border-bottom:1px solid var(--border)}
.eyebrow{font-family:'JetBrains Mono',monospace;font-size:.54rem;letter-spacing:.22em;text-transform:uppercase;color:var(--teal);margin-bottom:1rem;display:flex;align-items:center;gap:.8rem;flex-wrap:wrap}
.eyebrow::before{content:'';width:28px;height:1px;background:var(--teal)}
.loop-pill{font-family:'JetBrains Mono',monospace;font-size:.52rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);border:1px solid rgba(212,168,71,.35);background:var(--gold-dim);border-radius:20px;padding:.15rem .6rem}
.hero h1{font-size:clamp(1.9rem,4vw,3rem);color:var(--white);margin-bottom:.9rem}
.hero p{font-size:1rem;color:var(--body);max-width:760px;line-height:1.9}
.hero-actions{display:flex;align-items:center;gap:1rem;flex-wrap:wrap;margin:1.5rem 0 .4rem}
.btn{font-family:'JetBrains Mono',monospace;font-size:.7rem;letter-spacing:.06em;border-radius:var(--radius);padding:.5rem .95rem;cursor:pointer;border:1px solid var(--border-2);background:var(--bg-2);color:var(--text)}
.btn:hover{border-color:var(--teal);color:var(--teal-lt)}
.btn-primary{background:var(--gold);color:#080E1A;border-color:var(--gold);font-weight:600}
.btn-primary:hover{opacity:.88;color:#080E1A}
.hint{font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--body)}
.stair-map{margin:1.2rem 0 .4rem;background:var(--bg-2);border:1px solid var(--border);border-radius:var(--radius-lg);overflow-x:auto}
.stair-map svg{display:block;width:100%;height:auto;min-width:640px}
.stair-bar{cursor:pointer}
.stair-bar rect{transition:fill .2s,stroke .2s}
.stair-bar:hover rect,.stair-bar:focus rect{stroke:var(--white)}
.thesis{margin-top:1.4rem;padding:1rem 1.3rem;background:var(--teal-dim);border-left:3px solid var(--teal);border-radius:0 var(--radius) var(--radius) 0;font-size:.95rem;color:var(--bright)}

/* parts */
.part-head{padding:3rem 0 .6rem;border-bottom:1px solid var(--border)}
.part-head .kicker{font-family:'JetBrains Mono',monospace;font-size:.54rem;letter-spacing:.22em;text-transform:uppercase;color:var(--gold);margin-bottom:.4rem}
.part-head h2{font-size:clamp(1.4rem,2.8vw,2rem);color:var(--white)}
.part-head p{color:var(--body);max-width:740px;margin:.6rem 0 1.2rem}

/* panels */
.panel{padding:2.6rem 0;border-bottom:1px solid var(--border)}
.panel-head{display:flex;align-items:baseline;gap:.9rem;margin-bottom:.4rem;flex-wrap:wrap}
.stage-n{font-family:'JetBrains Mono',monospace;font-size:.9rem;color:var(--teal-lt);border:1px solid rgba(20,184,166,.35);border-radius:50%;width:2.2rem;height:2.2rem;display:flex;align-items:center;justify-content:center;flex:none}
.panel.ex .stage-n{color:var(--gold);border-color:rgba(212,168,71,.4)}
.panel h2{font-size:clamp(1.25rem,2.4vw,1.7rem);color:var(--white)}
.panel h3{font-size:1.05rem;color:var(--bright);margin:1.5rem 0 .5rem}
.panel .kicker{font-family:'JetBrains Mono',monospace;font-size:.5rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);margin-bottom:.4rem}
.panel p{color:var(--body);max-width:760px;margin:.9rem 0}
.panel .lede{color:var(--text)}
.scene-wrap{position:relative;margin:1.2rem 0}
.scene-scroll{max-width:100%;overflow-x:auto;background:var(--bg-2);border:1px solid var(--border);border-radius:var(--radius-lg)}
.scene-scroll svg{display:block;width:100%;height:auto;min-width:640px}
.replay{position:absolute;top:8px;right:8px;z-index:2;font-family:'JetBrains Mono',monospace;font-size:.58rem;letter-spacing:.08em;background:var(--bg-3);color:var(--body);border:1px solid var(--border-2);border-radius:20px;padding:.2rem .6rem;cursor:pointer}
.replay:hover{color:var(--teal-lt);border-color:var(--teal)}
.cite{display:inline-block;font-family:'JetBrains Mono',monospace;font-size:.62rem;letter-spacing:.04em;padding:.15rem .55rem;border-radius:12px;background:var(--bg-3);color:var(--teal-lt);border:1px solid var(--border-2);margin:.15rem .25rem .15rem 0}
.cites{margin-top:.8rem}

/* prompts */
.prompt{margin:1.2rem 0;background:var(--bg-2);border:1px solid var(--border);border-left:3px solid var(--purple);border-radius:0 var(--radius) var(--radius) 0;max-width:860px}
.prompt-head{display:flex;align-items:center;justify-content:space-between;gap:.6rem;padding:.5rem .9rem;border-bottom:1px solid var(--border);font-family:'JetBrains Mono',monospace;font-size:.58rem;letter-spacing:.16em;text-transform:uppercase;color:var(--purple)}
.prompt-head .lvl{color:var(--body);letter-spacing:.08em}
.prompt pre{margin:0;padding:.8rem .95rem;font-family:'JetBrains Mono',monospace;font-size:.74rem;line-height:1.7;color:var(--bright);white-space:pre-wrap;word-break:break-word}
.prompt.long pre{max-height:360px;overflow:auto}
.copy{font-family:'JetBrains Mono',monospace;font-size:.56rem;letter-spacing:.08em;text-transform:uppercase;background:transparent;border:1px solid var(--border-2);color:var(--body);border-radius:20px;padding:.18rem .6rem;cursor:pointer}
.copy:hover{border-color:var(--purple);color:var(--purple)}
.answer{padding:.55rem .95rem;border-top:1px dashed var(--border);font-family:'JetBrains Mono',monospace;font-size:.68rem;color:var(--body);line-height:1.7}
.answer{overflow-wrap:anywhere}
.answer .hl{color:var(--gold);word-break:break-all}
.cite{max-width:100%;overflow-wrap:anywhere}
.checks{list-style:none;margin:1.2rem 0;padding:0;counter-reset:chk}
.checks li{position:relative;padding:.8rem 1rem .8rem 3rem;background:var(--bg-2);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:8px;font-size:.88rem;color:var(--text);counter-increment:chk}
.checks li::before{content:counter(chk);position:absolute;left:.9rem;top:.8rem;width:1.5rem;height:1.5rem;border-radius:50%;border:1px solid var(--teal);color:var(--teal-lt);font-family:'JetBrains Mono',monospace;font-size:.72rem;display:flex;align-items:center;justify-content:center}

/* run tables */
.runs{width:100%;border-collapse:collapse;margin:1.1rem 0;font-size:.8rem}
.runs th{text-align:left;font-family:'JetBrains Mono',monospace;font-size:.54rem;letter-spacing:.14em;text-transform:uppercase;color:var(--body);padding:.5rem .6rem;border-bottom:1px solid var(--border)}
.runs td{padding:.55rem .6rem;border-bottom:1px solid var(--border);vertical-align:top;color:var(--text)}
.runs td.m{font-family:'JetBrains Mono',monospace;font-size:.72rem;color:var(--gold);word-break:break-all}
.runs-scroll{overflow-x:auto}
.v{display:inline-block;font-family:'JetBrains Mono',monospace;font-size:.62rem;padding:.08rem .45rem;border-radius:10px;white-space:nowrap}
.v-ok{background:var(--green-dim);color:var(--green);border:1px solid rgba(34,197,94,.35)}
.v-no{background:var(--red-dim);color:var(--red);border:1px solid rgba(239,68,68,.35)}
.v-esc{background:var(--warn-dim);color:var(--warn);border:1px solid rgba(245,158,11,.35)}

/* cards */
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:1.4rem 0}
.card{background:var(--bg-2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:1.1rem 1.2rem}
.card h3{font-size:1.02rem;color:var(--bright);margin:0 0 .4rem;font-family:'DM Serif Display',serif}
.card p{font-size:.85rem;color:var(--body);margin:0}
.claim-card{border-left:3px solid var(--gold)}
.map{width:100%;border-collapse:collapse;margin:1.2rem 0;font-size:.82rem}
.map th{text-align:left;font-family:'JetBrains Mono',monospace;font-size:.55rem;letter-spacing:.14em;text-transform:uppercase;color:var(--body);padding:.55rem .7rem;border-bottom:1px solid var(--border-2)}
.map td{padding:.6rem .7rem;border-bottom:1px solid var(--border);vertical-align:top;color:var(--text)}
.map td:first-child{font-family:'JetBrains Mono',monospace;font-size:.68rem;color:var(--gold);white-space:nowrap}
.note{background:var(--green-dim);border-left:3px solid var(--green);border-radius:0 var(--radius) var(--radius) 0;padding:.9rem 1.1rem;margin:1.2rem 0;font-size:.88rem;color:var(--text)}
.warn-note{background:var(--gold-dim);border-left:3px solid var(--gold);border-radius:0 var(--radius) var(--radius) 0;padding:.9rem 1.1rem;margin:1.2rem 0;font-size:.88rem;color:var(--text)}
.cross-link{font-family:'JetBrains Mono',monospace;font-size:.7rem;color:var(--body);background:var(--bg-2);border:1px solid var(--border);border-left:3px solid var(--gold);border-radius:0 var(--radius) var(--radius) 0;padding:.9rem 1.1rem;line-height:1.9;margin:1.4rem auto;max-width:1000px}
.cross-link a{color:var(--gold)}
.pii{background:var(--bg-2);border:1px solid var(--border);border-radius:var(--radius);padding:.7rem 1rem;font-size:.78rem;color:var(--body);margin:2rem auto;max-width:1000px;font-family:'JetBrains Mono',monospace}
.dl-row{display:flex;gap:.6rem;flex-wrap:wrap;margin:.8rem 0}

/* presenter mode */
.pbar{display:none}
body.present{overflow:hidden}
body.present nav,body.present header.hero,body.present .part-head,body.present footer,body.present .pii,body.present .detail,body.present .replay{display:none!important}
body.present .panel{display:none;border:0;padding:0}
body.present .panel.current{display:flex;flex-direction:column;height:100vh;padding:1rem 0 5.2rem;overflow-y:auto}
body.present .panel.current .wrap{max-width:min(1360px,96vw);width:100%;margin:auto}
body.present .panel h2{font-size:clamp(1.25rem,2.4vw,1.8rem)}
body.present .panel p.lede{max-width:none;font-size:.95rem;line-height:1.65;margin:.4rem 0}
body.present .scene-wrap{margin:.6rem 0}
body.present .scene-scroll svg{max-height:calc(100vh - 23rem);min-width:0}
body.present .prompt{max-width:none;margin:.6rem 0}
body.present .prompt pre{max-height:15vh;overflow:auto;font-size:.72rem}
body.present .prompt.long pre{max-height:15vh}
body.present .runs-scroll{max-height:24vh;overflow:auto}
body.present .pbar{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:300;align-items:center;gap:.7rem;padding:.45rem 1rem;background:rgba(8,14,26,.94);border-top:1px solid var(--border);backdrop-filter:blur(8px)}
.pbar .rail{flex:1;min-width:0}
.pbar .rail svg{display:block;width:100%;height:46px}
.pbar .count{font-family:'JetBrains Mono',monospace;font-size:.7rem;color:var(--body);min-width:4.5rem;text-align:center}
.pbar .btn{padding:.35rem .7rem}
.pbar .btn[aria-pressed="true"]{border-color:var(--gold);color:var(--gold)}

@media(max-width:680px){.grid{grid-template-columns:1fr}.wrap{padding:0 1rem}.hero{padding:2.4rem 0 1.8rem}.map td:first-child{white-space:normal}}
/* Phone widths: keep the shared nav inside the viewport (page-local; the canonical chrome block is untouched). */
@media(max-width:760px){.nav-breadcrumb span:last-child,.nav-breadcrumb span:nth-last-child(2){display:none}}
@media(max-width:480px){nav .nav-breadcrumb{display:none}}
@media print,(prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
}`;

/**
 * Inline at the end of <body>. Scene playback, the staircase map, presenter
 * mode, and the copy and download helpers. In-memory only: no network calls,
 * no storage. Every DOM hook is optional, so a page that carries part of the
 * kit gets the part it carries.
 */
export const EXPLAINER_KIT_JS = `/* EXPLAINER-KIT:v1 (scripts/lib/explainer-kit.mjs) */
(function () {
  'use strict';
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var body = document.body;
  var panels = Array.prototype.slice.call(document.querySelectorAll('section.panel[data-stair]'));
  var HEX = '0123456789abcdef';
  function byId(id) { return document.getElementById(id); }
  function on(id, ev, fn) { var n = byId(id); if (n) n.addEventListener(ev, fn); }

  // Scramble a hash label, then settle on its real value (skipped under reduced motion).
  function rollHashes(scene) {
    Array.prototype.forEach.call(scene.querySelectorAll('[data-roll]'), function (el) {
      var fin = el.getAttribute('data-roll');
      if (reduce) { el.textContent = fin; return; }
      var delay = parseFloat(el.getAttribute('data-roll-delay') || '0') * 1000;
      var dur = 900, t0 = null;
      function frame(t) {
        if (t0 === null) t0 = t;
        var e = t - t0 - delay;
        if (e < 0) { requestAnimationFrame(frame); return; }
        if (e >= dur) { el.textContent = fin; return; }
        var keep = Math.floor(fin.length * (e / dur)), out = fin.slice(0, keep);
        for (var i = keep; i < fin.length; i++) {
          var c = fin.charAt(i);
          out += /[0-9a-f]/.test(c) ? HEX.charAt(Math.floor(Math.random() * 16)) : c;
        }
        el.textContent = out;
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  }

  // Start a scene that has not run yet. The scene kit's own head script marks
  // scenes sk-play on scroll, so this only has to cover the hash roll.
  function reveal(scene) {
    scene.classList.add('sk-play');
    rollHashes(scene);
  }

  // Restart every animation in a scene: drop sk-play, force a reflow so the
  // start states apply again, then put it back.
  function play(scene) {
    scene.classList.remove('sk-play');
    void scene.getBoundingClientRect();
    reveal(scene);
  }

  var scenes = Array.prototype.slice.call(document.querySelectorAll('svg.sk-scene'));
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && !body.classList.contains('present')) { reveal(e.target); io.unobserve(e.target); }
      });
    }, { threshold: 0.25 });
    scenes.forEach(function (s) { io.observe(s); });
  } else {
    scenes.forEach(reveal);
  }

  // Staircase drawing, shared by the hero map and the presenter rail.
  var PART_FILL = { '1': 'var(--teal-dim)', '2': 'var(--gold-dim)', '3': 'var(--purple-dim)' };
  var PART_STROKE = { '1': 'var(--teal)', '2': 'var(--gold)', '3': 'var(--purple)' };
  var NS = 'http://www.w3.org/2000/svg';
  function el(name, attrs, text) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) { if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]); }
    if (text != null) n.textContent = text;
    return n;
  }
  function drawStairs(svg, opts) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var n = panels.length, W = 1000, H = opts.h, base = H - (opts.pad || 4);
    var w = W / n, minH = opts.minH, maxH = base - (opts.top || 6);
    panels.forEach(function (p, i) {
      var part = p.getAttribute('data-part') || '1';
      var h = minH + (maxH - minH) * (n > 1 ? i / (n - 1) : 0);
      var g = el('g', { 'class': 'stair-bar', 'data-i': String(i), tabindex: opts.focusable ? '0' : '-1', role: opts.focusable ? 'listitem' : 'presentation' });
      if (opts.focusable) g.setAttribute('aria-label', 'Step ' + (i + 1) + ': ' + p.getAttribute('data-stair'));
      g.appendChild(el('rect', { x: (i * w + 1.5).toFixed(1), y: (base - h).toFixed(1), width: (w - 3).toFixed(1), height: h.toFixed(1), rx: '3', fill: PART_FILL[part], stroke: PART_STROKE[part], 'stroke-width': '1' }));
      if (opts.labels) {
        var cx = i * w + w / 2 + 4, ty = base - 8;
        g.appendChild(el('text', { x: cx.toFixed(1), y: ty.toFixed(1), transform: 'rotate(-90 ' + cx.toFixed(1) + ' ' + ty.toFixed(1) + ')', 'font-family': 'JetBrains Mono, monospace', 'font-size': '11', fill: 'var(--bright)' }, p.getAttribute('data-stair')));
        g.appendChild(el('text', { x: (i * w + w / 2).toFixed(1), y: (base - h - 6).toFixed(1), 'text-anchor': 'middle', 'font-family': 'JetBrains Mono, monospace', 'font-size': '10', fill: PART_STROKE[part] }, String(i + 1)));
      }
      svg.appendChild(g);
    });
  }
  var map = byId('stairMap');
  var rail = byId('pRail');
  if (map && panels.length) drawStairs(map, { h: 260, minH: 58, top: 22, pad: 8, labels: true, focusable: true });
  if (rail && panels.length) drawStairs(rail, { h: 60, minH: 10, top: 4, pad: 2, labels: false, focusable: false });

  // Presenter mode.
  var cur = 0, auto = null;
  function paintRail() {
    Array.prototype.forEach.call(document.querySelectorAll('#pRail .stair-bar rect'), function (r, i) {
      r.setAttribute('opacity', i === cur ? '1' : (i < cur ? '.75' : '.35'));
      r.setAttribute('stroke-width', i === cur ? '2.5' : '1');
    });
  }
  function go(i) {
    if (!panels.length) return;
    cur = Math.max(0, Math.min(panels.length - 1, i));
    panels.forEach(function (p, k) { p.classList.toggle('current', k === cur); });
    var sc = panels[cur].querySelector('svg.sk-scene');
    if (sc) play(sc);
    panels[cur].scrollTop = 0;
    var count = byId('pCount');
    if (count) count.textContent = (cur + 1) + ' / ' + panels.length;
    paintRail();
    try { history.replaceState(null, '', '#' + panels[cur].id); } catch (e) { /* file: URLs */ }
  }
  function stopAuto() { if (auto) { clearInterval(auto); auto = null; } var b = byId('pAuto'); if (b) b.setAttribute('aria-pressed', 'false'); }
  function toggleAuto() {
    if (auto) { stopAuto(); return; }
    auto = setInterval(function () { if (cur >= panels.length - 1) { stopAuto(); return; } go(cur + 1); }, 15000);
    var b = byId('pAuto');
    if (b) b.setAttribute('aria-pressed', 'true');
  }
  function enter(startAt) {
    if (!panels.length) return;
    body.classList.add('present');
    var idx = typeof startAt === 'number' ? startAt : -1;
    if (idx < 0 && location.hash) { var t = byId(location.hash.slice(1)); idx = panels.indexOf(t); }
    go(idx >= 0 ? idx : 0);
    window.scrollTo(0, 0);
  }
  function exit() {
    body.classList.remove('present');
    stopAuto();
    panels.forEach(function (p) { p.classList.remove('current'); });
    if (panels[cur]) panels[cur].scrollIntoView();
  }
  on('btnPresent', 'click', function () { enter(); });
  on('pPrev', 'click', function () { stopAuto(); go(cur - 1); });
  on('pNext', 'click', function () { stopAuto(); go(cur + 1); });
  on('pAuto', 'click', toggleAuto);
  on('pExit', 'click', exit);
  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    if (!body.classList.contains('present')) {
      if ((e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.metaKey && !e.altKey) enter();
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) { e.preventDefault(); stopAuto(); go(cur + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) { e.preventDefault(); stopAuto(); go(cur - 1); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(panels.length - 1); }
    else if (e.key === 'Escape') { exit(); }
    else if (e.key === 'a' || e.key === 'A') { toggleAuto(); }
  });

  // Staircase clicks: jump in presenter mode, scroll otherwise.
  function stairJump(e) {
    var g = e.target.closest ? e.target.closest('.stair-bar') : null;
    if (!g) return;
    var i = parseInt(g.getAttribute('data-i'), 10);
    if (body.classList.contains('present')) { stopAuto(); go(i); }
    else if (panels[i]) { panels[i].scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); }
  }
  if (map) {
    map.addEventListener('click', stairJump);
    map.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); stairJump(e); } });
  }
  if (rail) rail.addEventListener('click', stairJump);

  // Replay, copy and download buttons.
  document.addEventListener('click', function (e) {
    var t = e.target;
    var rp = t.closest && t.closest('[data-replay]');
    if (rp) { var s = rp.parentNode.querySelector('svg.sk-scene'); if (s) play(s); return; }
    var cp = t.closest && t.closest('[data-copy]');
    if (cp) {
      var src = byId(cp.getAttribute('data-copy'));
      var text = src ? src.textContent : '';
      var label = cp.textContent;
      var done = function (ok) { cp.textContent = ok ? 'Copied' : 'Select the text to copy'; setTimeout(function () { cp.textContent = label; }, 1600); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      else done(false);
      return;
    }
    var dl = t.closest && t.closest('[data-download]');
    if (dl) {
      var block = byId(dl.getAttribute('data-download'));
      if (!block) return;
      var json = JSON.stringify(JSON.parse(block.textContent), null, 2);
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      a.download = dl.getAttribute('data-filename') || 'download.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    }
  });

  // Deep link straight into presenter mode: #present or #present-<panel id>, on load or later.
  function presentFromHash() {
    if (!/^#present/.test(location.hash) || body.classList.contains('present')) return;
    var want = location.hash.replace(/^#present-?/, '');
    var idx = want ? panels.indexOf(byId(want)) : 0;
    enter(idx >= 0 ? idx : 0);
  }
  window.addEventListener('hashchange', presentFromHash);
  presentFromHash();
})();`;
