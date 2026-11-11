create or replace function public.cancel_booking_and_release_seats(
  p_booking_code text,
  p_cancellation_fee numeric,
  p_refund_amount numeric,
  p_cancellation_reason text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_booking_id public.bookings.id%type;
  v_status text;
  v_created_at timestamptz;
  v_departure_time timestamptz;
  v_expected_seats bigint;
  v_updated_seats bigint;
begin
  select id, status, created_at, departure_time
    into v_booking_id, v_status, v_created_at, v_departure_time
    from public.bookings
    where booking_code = p_booking_code
    for update;

  if not found then
    raise exception 'Không tìm thấy đơn hàng với mã đã nhập.';
  end if;

  if lower(v_status) in ('cancelled', 'canceled') then
    raise exception 'Vé này đã được hủy trước đó.';
  end if;

  if v_created_at is null
    or now() - v_created_at > interval '4 hours'
    or (v_departure_time is not null and v_departure_time <= now() + interval '4 hours') then
    raise exception 'Không thể hủy vé: Đã quá thời hạn cho phép hủy vé (chỉ được phép hủy trong vòng 4 tiếng sau khi đặt / trước giờ tàu chạy).';
  end if;

  select count(distinct seat_id)
    into v_expected_seats
    from public.booking_passengers
    where booking_id = v_booking_id;

  update public.bookings
    set status = 'cancelled',
        cancellation_fee = p_cancellation_fee,
        refund_amount = p_refund_amount,
        cancelled_at = now(),
        cancellation_reason = p_cancellation_reason
    where id = v_booking_id;

  update public.seats
    set status = 'available'
    where id in (
      select distinct seat_id
        from public.booking_passengers
        where booking_id = v_booking_id
    );
  get diagnostics v_updated_seats = row_count;

  if v_updated_seats <> v_expected_seats then
    raise exception 'Không thể giải phóng đầy đủ ghế của đơn hàng.';
  end if;
end;
$$;
