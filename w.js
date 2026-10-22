/* お問い合わせチャット（埋め込み用）
 * 使い方：<script src="https://<配信元>/w.js" data-id="<お客さんの番号>" async></script>
 * 設定は配信元の bots/<番号>.json。答えは AI（設定に api があるとき）か、FAQ から選ぶ。
 */
(() => {
  const me = document.currentScript || document.querySelector("script[src*='w.js'][data-id]");
  if (!me || window.__qachat) return;
  window.__qachat = true;
  const id = (me.dataset.id || "").replace(/[^a-z0-9_-]/gi, "");
  const base = new URL(".", me.src).href;
  if (!id) return;

  // ---- 文字の正規化と FAQ の探し方（日本語は2文字ずつに切って重なりを数える） ----
  const norm = (s) => String(s || "").normalize("NFKC").toLowerCase()
    .replace(/[\s、。・，．,.!?！？「」『』（）()【】\[\]〜~ー－\-：:；;／\/]/g, "")
    .replace(/(ですか|ますか|ください|でしょうか|について|教えて|知りたい|ありますか|なりますか|いいですか)/g, "");
  const grams = (s) => { const t = norm(s), g = new Set(); for (let i = 0; i < t.length - 1; i++) g.add(t.slice(i, i + 2)); if (t.length === 1) g.add(t); return g; };
  function rank(cfg, query) {
    const qn = norm(query), qg = grams(query);
    if (!qg.size) return [];
    return cfg.faq.map((f, i) => {
      if (!f._g) { f._g = grams(f.q + f.k); f._a = grams(f.a); f._k = String(f.k || "").split(/\s+/).map(norm).filter((w) => w.length >= 2); }
      let s = 0;
      for (const g of qg) s += f._g.has(g) ? 2 : f._a.has(g) ? 0.4 : 0;
      for (const w of f._k) if (qn.includes(w)) s += w.length;
      return { i, s: s / Math.sqrt(qg.size + 2) };
    }).filter((r) => r.s > 0).sort((a, b) => b.s - a.s);
  }

  // ---- 画面 ----
  const host = document.createElement("div");
  host.style.cssText = "all:initial;position:fixed;z-index:2147483000;right:16px;bottom:16px;";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>
:host{--c:#1d5fa8;--bg:#fff;--ink:#1f2328;--mut:#5f6670;--line:#e3e6ea;--me:#eef3fa}
@media (prefers-color-scheme:dark){:host{--bg:#1c1f24;--ink:#e8eaed;--mut:#a3a9b1;--line:#30353c;--me:#24303f}}
*{box-sizing:border-box;font-family:"Hiragino Sans","Noto Sans JP",system-ui,sans-serif}
.btn{display:flex;align-items:center;gap:8px;border:0;border-radius:999px;padding:12px 18px;background:var(--c);color:#fff;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px #0003}
.btn:focus-visible,button:focus-visible,input:focus-visible{outline:3px solid var(--c);outline-offset:2px}
.panel{position:fixed;right:16px;bottom:16px;width:380px;max-width:calc(100vw - 32px);height:600px;max-height:calc(100vh - 32px);background:var(--bg);color:var(--ink);border-radius:16px;box-shadow:0 8px 32px #0004;display:flex;flex-direction:column;overflow:hidden}
.panel[hidden],.btn[hidden]{display:none}
header{display:flex;align-items:center;gap:8px;padding:12px 14px;background:var(--c);color:#fff}
header b{flex:1;font-size:15px}
header button{background:none;border:0;color:#fff;font-size:22px;line-height:1;cursor:pointer;padding:2px 6px}
.log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;font-size:14px;line-height:1.7}
.m{max-width:88%;padding:9px 12px;border-radius:12px;white-space:pre-wrap;overflow-wrap:anywhere}
.bot{align-self:flex-start;background:var(--bg);border:1px solid var(--line)}
.you{align-self:flex-end;background:var(--me)}
.src{display:block;margin-top:6px;font-size:12px;color:var(--mut)}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chips button{border:1.5px solid var(--c);background:var(--bg);color:var(--c);border-radius:999px;padding:5px 11px;font-size:13px;cursor:pointer;text-align:left}
.links{display:flex;flex-direction:column;gap:6px}
.links a{display:block;text-align:center;border-radius:10px;padding:9px;background:var(--c);color:#fff;text-decoration:none;font-size:14px;font-weight:700}
.note{font-size:12px;color:var(--mut)}
.wait{color:var(--mut)}
form{display:flex;gap:8px;padding:10px;border-top:1px solid var(--line)}
input{flex:1;min-width:0;font-size:16px;padding:9px 12px;border:1.5px solid var(--line);border-radius:10px;background:var(--bg);color:var(--ink)}
form button{border:0;border-radius:10px;padding:0 14px;background:var(--c);color:#fff;font-weight:700;font-size:14px;cursor:pointer}
form button:disabled{opacity:.5}
.foot{padding:0 12px 8px;font-size:11px;color:var(--mut)}
@media (max-width:480px){.panel{right:0;bottom:0;width:100vw;max-width:100vw;height:100%;max-height:100%;border-radius:0}}
</style>
<button class="btn" type="button" aria-haspopup="dialog">💬 <span>質問する</span></button>
<div class="panel" role="dialog" aria-modal="false" hidden>
  <header><b></b><button type="button" class="x" aria-label="閉じる">×</button></header>
  <div class="log" aria-live="polite"></div>
  <form><input type="text" maxlength="300" placeholder="ご質問を入力" aria-label="ご質問"><button type="submit">送信</button></form>
  <div class="foot"></div>
</div>`;
  const $ = (s) => root.querySelector(s);
  const btn = $(".btn"), panel = $(".panel"), log = $(".log"), form = $("form"), input = $("input"), send = $("form button");
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const scroll = () => { log.scrollTop = log.scrollHeight; };

  let cfg = null, started = false, busy = false;
  const history = [];

  function say(text, who, src) {
    const m = el("div", "m " + who, text);
    if (src) m.append(el("span", "src", "出典：" + src));
    log.append(m); scroll(); return m;
  }
  function chips(list) {
    if (!list.length) return;
    const c = el("div", "chips");
    for (const q of list) { const b = el("button", "", q); b.type = "button"; b.onclick = () => ask(q); c.append(b); }
    log.append(c); scroll();
  }
  function contact() {
    const box = el("div", "links");
    for (const l of cfg.contact || []) {
      if (!/^(https:|tel:|mailto:)/.test(l.href)) continue;
      const a = el("a", "", l.label); a.href = l.href; if (l.href.startsWith("https:")) { a.target = "_blank"; a.rel = "noopener"; }
      box.append(a);
    }
    if (box.childNodes.length) log.append(box);
    if (cfg.contact_note) log.append(el("div", "note", cfg.contact_note));
    scroll();
  }

  function local(q) {
    const r = rank(cfg, q);
    const top = r[0];
    if (!top || top.s < 1.2) { say(cfg.fallback, "bot"); contact(); return; }
    const f = cfg.faq[top.i];
    say(f.a, "bot", f.src);
    chips(r.slice(1, 4).filter((x) => x.s >= 1.2).map((x) => cfg.faq[x.i].q));
  }

  async function ai(q) {
    const wait = say("確認しています…", "bot wait");
    try {
      const res = await fetch(`${cfg.api}?bot=${id}`, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ bot: id, messages: history.slice(-8) }) });
      const j = await res.json().catch(() => ({}));
      wait.remove();
      if (!res.ok || !j.answer) { local(q); return; }
      history.push({ role: "assistant", content: j.answer });
      say(j.answer, "bot", j.src);
      if (j.handoff) contact();
    } catch { wait.remove(); local(q); }
  }

  async function ask(q) {
    q = String(q || "").trim().slice(0, 300);
    if (!q || busy) return;
    busy = true; send.disabled = true;
    say(q, "you");
    history.push({ role: "user", content: q });
    if (cfg.api) await ai(q); else local(q);
    busy = false; send.disabled = false; input.focus();
  }

  async function open() {
    btn.hidden = true; panel.hidden = false;
    if (!cfg) {
      try { const r = await fetch(`${base}bots/${id}.json`, { cache: "no-cache" }); cfg = await r.json(); }
      catch { say("読み込めませんでした。時間をおいてお試しください。", "bot"); return; }
      if (me.dataset.api) cfg.api = me.dataset.api;
      if (cfg.color && !me.dataset.color) host.style.setProperty("--c", cfg.color);
      $("header b").textContent = cfg.title || "ご質問";
      $(".foot").textContent = cfg.notice || "";
    }
    if (!started) { started = true; say(cfg.greeting, "bot"); chips(cfg.starters || []); }
    input.focus();
  }
  function close() { panel.hidden = true; btn.hidden = false; btn.focus(); }

  btn.onclick = open;
  $(".x").onclick = close;
  panel.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  form.onsubmit = (e) => { e.preventDefault(); const q = input.value; input.value = ""; ask(q); };
  if (me.dataset.color) host.style.setProperty("--c", me.dataset.color);
  (document.body || document.documentElement).append(host);
})();
