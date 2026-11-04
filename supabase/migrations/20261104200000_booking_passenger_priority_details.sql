alter table public.booking_passengers
  add column if not exists date_of_birth date,
  add column if not exists student_id text,
  add column if not exists school_name text;
