-- お問い合わせチャット：お客さんごとの月の利用回数
create table if not exists public.chat_usage (
  bot   text not null,
  month text not null,          -- 例 2026-10
  count integer not null default 0,
  primary key (bot, month)
);
alter table public.chat_usage enable row level security;

-- 1回数えて、数えたあとの回数を返す（Edge Function から service_role で呼ぶ）
create or replace function public.chat_count(p_bot text, p_month text)
returns integer language sql security definer set search_path = public as $$
  insert into chat_usage (bot, month, count) values (p_bot, p_month, 1)
  on conflict (bot, month) do update set count = chat_usage.count + 1
  returning count;
$$;

-- 権限：サイトからは直接触らせない。Edge Function（service_role）だけ
revoke all on public.chat_usage from anon, authenticated;
grant select, insert, update on public.chat_usage to service_role;
revoke execute on function public.chat_count(text, text) from public, anon, authenticated;
grant execute on function public.chat_count(text, text) to service_role;
