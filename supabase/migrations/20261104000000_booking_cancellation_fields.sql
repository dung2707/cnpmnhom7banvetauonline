alter table public.bookings
  add column if not exists departure_time timestamptz,
  add column if not exists cancellation_fee numeric not null default 0,
  add column if not exists refund_amount numeric not null default 0,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancellation_reason text;
