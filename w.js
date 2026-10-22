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
  // 置き場所は 0×0 にして、ボタンと小窓をそれぞれ画面に固定する（host に transform を付けると fixed がずれるので付けない）
  host.style.cssText = "all:initial;position:fixed;z-index:2147483000;right:0;top:0;width:0;height:0;";
  // キャラクター（SVG）。cls で大きさ・動きを切り替える（ch：ふだん、think：考え中）
  const CH = (cls) => `<svg class="${cls}" viewBox="0 0 48 48" aria-hidden="true">
<line x1="24" y1="11" x2="24" y2="5" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><circle class="bulb" cx="24" cy="4.5" r="3.2"/>
<rect x="3" y="21" width="5" height="10" rx="2.5" fill="#fff"/><rect x="40" y="21" width="5" height="10" rx="2.5" fill="#fff"/>
<rect x="6" y="11" width="36" height="31" rx="14" fill="#fff"/><rect class="face" x="11" y="17" width="26" height="18" rx="8"/>
<ellipse class="eye" cx="19" cy="25" rx="2.6" ry="3.4" fill="#fff"/><ellipse class="eye" cx="29" cy="25" rx="2.6" ry="3.4" fill="#fff"/>
<path d="M20.5 30.5q3.5 2.6 7 0" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>
<circle cx="9.5" cy="36" r="2.2" fill="#ffb3b3"/><circle cx="38.5" cy="36" r="2.2" fill="#ffb3b3"/></svg>`;

  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>
:host{--c:#1d5fa8;--bg:#fff;--ink:#1f2328;--mut:#5f6670;--line:#e3e6ea;--me:#eef3fa}
@media (prefers-color-scheme:dark){:host{--bg:#1c1f24;--ink:#e8eaed;--mut:#a3a9b1;--line:#30353c;--me:#24303f}}
*{box-sizing:border-box;font-family:"Hiragino Sans","Noto Sans JP",system-ui,sans-serif}
/* 画面の右端・縦の真ん中に付いてくる縦長のタブ */
.btn{position:fixed;right:0;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;align-items:center;gap:12px;border:0;border-radius:16px 0 0 16px;padding:20px 14px 22px;background:var(--c);color:#fff;font-size:19px;font-weight:700;cursor:pointer;box-shadow:-2px 4px 16px #0003}
.btn .ch{width:52px;height:52px}
.btn .tx{display:flex;flex-direction:column;align-items:center;line-height:1.12}
.btn:hover{padding-right:18px}
@media (max-width:480px){.btn{font-size:16px;padding:14px 10px 16px;gap:8px}.btn .ch{width:42px;height:42px}}
/* キャラクターの動き：ふだんはふわふわ＋まばたき、考え中はアンテナが光って目がきょろきょろ */
.ch{overflow:visible;animation:bob 2.8s ease-in-out infinite}
.ch .face{fill:var(--c)}
.ch .bulb{fill:#ffd34d;animation:glow 2.8s ease-in-out infinite}
.ch .eye{transform-box:fill-box;transform-origin:center;animation:blink 4.6s infinite}
.ch.think{animation-duration:1.1s}
.ch.think .bulb{animation-duration:.7s}
.ch.think .eye{animation:look 1.8s ease-in-out infinite}
.btn:hover .ch{animation:hop .5s ease-out}
@keyframes bob{50%{transform:translateY(-3px)}}
@keyframes hop{40%{transform:translateY(-6px) rotate(-6deg)}70%{transform:translateY(0) rotate(4deg)}}
@keyframes blink{0%,91%,97%,100%{transform:scaleY(1)}94%{transform:scaleY(.1)}}
@keyframes look{0%,100%{transform:translateX(0)}25%{transform:translateX(-1.6px)}75%{transform:translateX(1.6px)}}
@keyframes glow{50%{fill:#fff6c9;filter:drop-shadow(0 0 3px #ffd34d)}}
header .ch{width:30px;height:30px;flex:none}
/* AI の答えの横にいつもキャラクター。動くのは最新の1体だけ */
.row{display:flex;align-items:flex-start;gap:8px;align-self:flex-start;max-width:94%}
.row .m{max-width:none;min-width:0}
.av{display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background:var(--c);flex:none}
.av .ch{width:28px;height:28px}
.av.still .ch,.av.still .ch *{animation:none}
.wait .m{display:flex;align-items:center;gap:2px;color:var(--mut)}
.log>.chips,.log>.links,.log>.note{margin-left:46px}
.dots i{font-style:normal;animation:dot 1.2s infinite}.dots i:nth-child(2){animation-delay:.2s}.dots i:nth-child(3){animation-delay:.4s}
@keyframes dot{0%,60%,100%{opacity:.2}30%{opacity:1}}
@media (prefers-reduced-motion:reduce){.ch,.ch *,.dots i{animation:none!important}}
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
form{display:flex;gap:8px;padding:10px;border-top:1px solid var(--line)}
input{flex:1;min-width:0;font-size:16px;padding:9px 12px;border:1.5px solid var(--line);border-radius:10px;background:var(--bg);color:var(--ink)}
form button{border:0;border-radius:10px;padding:0 14px;background:var(--c);color:#fff;font-weight:700;font-size:14px;cursor:pointer}
form button:disabled{opacity:.5}
form button.mic{display:grid;place-items:center;width:42px;padding:0;background:var(--bg);color:var(--c);border:1.5px solid var(--c)}
form button.mic[hidden]{display:none}
form button.mic svg{width:20px;height:20px}
form button.mic.on{background:#d9473a;border-color:#d9473a;color:#fff;animation:pulse 1.2s ease-in-out infinite}
@keyframes pulse{50%{box-shadow:0 0 0 6px #d9473a33}}
@media (prefers-reduced-motion:reduce){form button.mic.on{animation:none}}
.foot{padding:0 12px 8px;font-size:11px;color:var(--mut)}
@media (max-width:480px){.panel{right:0;bottom:0;width:100vw;max-width:100vw;height:100%;max-height:100%;border-radius:0}}
</style>
<button class="btn" type="button" aria-haspopup="dialog" aria-label="AIに質問する">${CH("ch")}<span class="tx" aria-hidden="true"><span>A</span><span>I</span><span>に</span><span>質</span><span>問</span><span>す</span><span>る</span></span></button>
<div class="panel" role="dialog" aria-modal="false" hidden>
  <header>${CH("ch")}<b></b><button type="button" class="x" aria-label="閉じる">×</button></header>
  <div class="log" aria-live="polite"></div>
  <form><input type="text" maxlength="300" placeholder="ご質問を入力" aria-label="ご質問"><button type="button" class="mic" aria-label="音声で入力" aria-pressed="false" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/></svg></button><button type="submit">送信</button></form>
  <div class="foot"></div>
</div>`;
  const $ = (s) => root.querySelector(s);
  const btn = $(".btn"), panel = $(".panel"), log = $(".log"), form = $("form"), input = $("input"), send = $("button[type=submit]"), mic = $(".mic");
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const scroll = () => { log.scrollTop = log.scrollHeight; };

  let cfg = null, started = false, busy = false;
  const history = [];

  // AI 側の発言は、キャラクターと並べた行にする（前のキャラクターは止める）
  function botRow(cls, think) {
    for (const a of log.querySelectorAll(".av")) a.classList.add("still");
    const row = el("div", "row" + (cls ? " " + cls : ""));
    const av = el("span", "av"); av.innerHTML = CH(think ? "ch think" : "ch");
    row.append(av); log.append(row); return row;
  }
  function say(text, who, src) {
    const m = el("div", "m " + who, text);
    if (src) m.append(el("span", "src", "出典：" + src));
    if (who.startsWith("bot")) botRow().append(m); else log.append(m);
    scroll(); return m;
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
    const wait = botRow("wait", true), wm = el("div", "m bot");
    wm.innerHTML = `<span>確認しています</span><span class="dots"><i>・</i><i>・</i><i>・</i></span>`;
    wait.append(wm); scroll();
    try {
      const res = await fetch(`${cfg.api}?bot=${id}`, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ bot: id, messages: history.slice(-12) }) });
      const j = await res.json().catch(() => ({}));
      wait.remove();
      if (!res.ok || !j.answer) { local(q); return; }
      history.push({ role: "assistant", content: j.answer });
      say(j.answer, "bot", j.src);
      // 聞き返しのときは、答えやすいよう選択肢をボタンで出す
      chips((Array.isArray(j.choices) ? j.choices : []).filter((c) => typeof c === "string" && c).slice(0, 4).map((c) => c.slice(0, 40)));
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
  function close() { if (rec) rec.abort(); panel.hidden = true; btn.hidden = false; btn.focus(); }

  // 音声入力（ブラウザの音声認識。使えないブラウザではボタンを出さない）
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  if (SR) {
    mic.hidden = false;
    const ph = input.placeholder;
    const stop = () => { mic.classList.remove("on"); mic.setAttribute("aria-pressed", "false"); input.placeholder = ph; rec = null; };
    mic.onclick = () => {
      if (rec) { rec.stop(); return; }
      rec = new SR();
      rec.lang = "ja-JP"; rec.interimResults = true; rec.continuous = false;
      const before = input.value ? input.value + " " : "";
      rec.onresult = (e) => { input.value = before + [...e.results].map((r) => r[0].transcript).join(""); };
      rec.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") say("マイクが使えませんでした。ブラウザの設定でマイクを許可するか、文字で入力してください。", "bot");
        else if (e.error === "no-speech") input.placeholder = "聞き取れませんでした。もう一度どうぞ";
      };
      rec.onend = () => { const p = input.placeholder; stop(); if (p !== "お話しください…") input.placeholder = p; input.focus(); };
      try {
        rec.start();
        mic.classList.add("on"); mic.setAttribute("aria-pressed", "true"); input.placeholder = "お話しください…";
      } catch { stop(); }
    };
  }

  btn.onclick = open;
  $(".x").onclick = close;
  panel.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  form.onsubmit = (e) => { e.preventDefault(); if (rec) rec.abort(); const q = input.value; input.value = ""; ask(q); };
  if (me.dataset.color) host.style.setProperty("--c", me.dataset.color);
  (document.body || document.documentElement).append(host);
})();
