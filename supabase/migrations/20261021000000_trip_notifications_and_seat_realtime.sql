create table if not exists public.trip_notifications (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  trip_code text not null,
  trip_date date not null,
  origin text not null,
  destination text not null,
  created_at timestamptz not null default now()
);

alter table public.trip_notifications
  add column if not exists user_email text,
  add column if not exists trip_code text,
  add column if not exists trip_date date,
  add column if not exists origin text,
  add column if not exists destination text,
  add column if not exists created_at timestamptz not null default now();

alter table public.seats replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'seats'
  ) then
    alter publication supabase_realtime add table public.seats;
  end if;
end
$$;
