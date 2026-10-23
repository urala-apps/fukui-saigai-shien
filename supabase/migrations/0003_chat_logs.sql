-- お問い合わせチャット：質問と答えの記録（保存期間は無制限。2026-10-23 決定）
-- 電話番号・メールアドレスは Edge Function で伏せ字にしてから入れる
create table if not exists public.chat_logs (
  id         bigint generated always as identity primary key,
  bot        text not null,
  session    text not null,          -- 小窓を開くごとのランダムな番号（同じ人の一連の会話をまとめる）
  question   text not null,
  answer     text not null,
  src        text not null default '',
  choices    jsonb not null default '[]'::jsonb,
  handoff    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists chat_logs_bot_created on public.chat_logs (bot, created_at desc);
alter table public.chat_logs enable row level security;

-- 権限：サイトからは直接触らせない。書き込みは Edge Function（service_role）、見るのは運営（ダッシュボード）
revoke all on public.chat_logs from anon, authenticated;
grant select, insert on public.chat_logs to service_role;
