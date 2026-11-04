alter table public.bookings
  add column if not exists email_sent boolean not null default false;
