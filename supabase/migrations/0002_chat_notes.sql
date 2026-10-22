-- お問い合わせチャット：公開しない参考メモ（運営側の取り扱いなど）。AI だけが読む
-- 中身はリポジトリに置かない（個人名・会社名を除いたうえで、表に直接入れる）
create table if not exists public.chat_notes (
  bot        text primary key,
  body       text not null,
  updated_at timestamptz not null default now()
);
alter table public.chat_notes enable row level security;

-- 権限：サイトからは直接触らせない。Edge Function（service_role）だけ
revoke all on public.chat_notes from anon, authenticated;
grant select, insert, update on public.chat_notes to service_role;
