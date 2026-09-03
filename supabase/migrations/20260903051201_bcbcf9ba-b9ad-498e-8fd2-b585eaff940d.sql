create table if not exists public.cron_secret (
  id boolean primary key default true check (id),
  token text not null,
  updated_at timestamptz not null default now()
);

revoke all on public.cron_secret from anon, authenticated;
grant all on public.cron_secret to service_role;

alter table public.cron_secret enable row level security;

insert into public.cron_secret (id, token)
values (true, encode(gen_random_bytes(32), 'hex'))
on conflict (id) do nothing;