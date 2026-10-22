// お問い合わせチャットの AI 回答（Supabase Edge Function）
//   POST { bot, messages: [{ role, content }] } → { answer, src, handoff }
//   - お客さんの設定・資料は配信元（GitHub Pages）の bots/<bot>.json と、そこに書いた knowledge のファイル
//   - 呼び出し元は設定の allowed_origins に書いたドメインだけ
//   - お客さんごとの月の上限は chat_usage 表で数える（上限を超えたら FAQ に任せる）
// 環境変数：ANTHROPIC_API_KEY、BOTS_BASE（例 https://chat.example.jp/）、SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY
import Anthropic from "npm:@anthropic-ai/sdk";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk/helpers/zod";
import { z } from "npm:zod";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-haiku-5-5";
const BOTS_BASE = Deno.env.get("BOTS_BASE") ?? "";
const client = new Anthropic();
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

type Bot = { id: string; name: string; allowed_origins: string[]; knowledge?: string[]; monthly_limit?: number; contact_note?: string };
type Loaded = { bot: Bot; system: string; at: number };
const cache = new Map<string, Loaded>();

const Answer = z.object({
  answer: z.string(),
  src: z.string(),
  handoff: z.boolean(),
});

async function load(id: string): Promise<Loaded | null> {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit;
  const r = await fetch(`${BOTS_BASE}bots/${id}.json`);
  if (!r.ok) return null;
  const bot = await r.json() as Bot & { faq?: { q: string; a: string; src: string }[] };
  const docs: string[] = [];
  for (const f of bot.knowledge ?? []) {
    const d = await fetch(`${BOTS_BASE}bots/${f}`);
    if (d.ok) docs.push(`<document name="${f}">\n${await d.text()}\n</document>`);
  }
  const faq = (bot.faq ?? []).map((f) => `Q: ${f.q}\nA: ${f.a}\n出典: ${f.src}`).join("\n\n");
  // 変わらない部分（指示＋資料）を先頭に置き、キャッシュを効かせる
  const system = `あなたは「${bot.name}」の問い合わせ窓口の案内係です。
次の資料に書かれている内容だけをもとに、日本語でやさしく、短く（目安300字以内）答えてください。
- 資料にないことは推測で答えず、「資料には書かれていません」と伝え、handoff を true にする
- 個別の案件が対象になるか・採択されるかの判断はしない。一般的な決まりを示したうえで、窓口への相談を勧め、handoff を true にする
- 金額・日付・書類名は資料の表記どおりに書く
- src には根拠にした資料の箇所（例：公募要領 P.5）を書く。根拠がなければ空文字
- 資料と関係のない話題には答えない
連絡先の補足：${bot.contact_note ?? ""}

<faq>
${faq}
</faq>

${docs.join("\n\n")}`;
  const v = { bot, system, at: Date.now() };
  cache.set(id, v);
  return v;
}

function cors(origin: string) {
  return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type", "Vary": "Origin", "content-type": "application/json" };
}
const reply = (origin: string, status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: cors(origin) });

// 同じ人の連打を止める（インスタンスごとの簡易な制限。月の上限は表で数える）
const recent = new Map<string, number[]>();
function tooMany(key: string) {
  const now = Date.now(), list = (recent.get(key) ?? []).filter((t) => now - t < 10 * 60_000);
  list.push(now); recent.set(key, list);
  return list.length > 20;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  let body: { bot?: string; messages?: { role: string; content: string }[] } = {};
  if (req.method === "POST") body = await req.json().catch(() => ({}));
  const id = String(body.bot ?? new URL(req.url).searchParams.get("bot") ?? "").replace(/[^a-z0-9_-]/gi, "");
  const loaded = id ? await load(id) : null;
  if (!loaded || !loaded.bot.allowed_origins.includes(origin)) return new Response("forbidden", { status: 403 });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return reply(origin, 405, { error: "method" });

  const msgs = (body.messages ?? []).slice(-8)
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 600) }));
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return reply(origin, 400, { error: "messages" });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "";
  if (tooMany(`${id}|${ip}`)) return reply(origin, 429, { error: "busy" });
  const month = new Date().toISOString().slice(0, 7);
  const { data: used, error: uerr } = await db.rpc("chat_count", { p_bot: id, p_month: month });
  if (uerr || Number(used) > (loaded.bot.monthly_limit ?? 1000)) return reply(origin, 429, { error: "limit" });

  try {
    const res = await client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "low", format: zodOutputFormat(Answer) },
      system: [{ type: "text", text: loaded.system, cache_control: { type: "ephemeral" } }],
      messages: msgs,
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) return reply(origin, 200, { answer: "その内容にはお答えできません。窓口へお問い合わせください。", src: "", handoff: true });
    return reply(origin, 200, res.parsed_output);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return reply(origin, 429, { error: "busy" });
    console.error(e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
    return reply(origin, 502, { error: "ai" });
  }
});
