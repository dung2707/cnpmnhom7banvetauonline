create or replace function public.confirm_booking_payment(
  p_booking_id uuid,
  p_payment_method text,
  p_amount numeric,
  p_reference_code text
)
returns public.payments
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_payment public.payments%rowtype;
begin
  if p_payment_method not in ('vietqr', 'domestic_card') then
    raise exception 'Phương thức thanh toán không hợp lệ.';
  end if;
  if p_amount <= 0 or p_reference_code is null or btrim(p_reference_code) = '' then
    raise exception 'Số tiền hoặc mã tham chiếu thanh toán không hợp lệ.';
  end if;

  select *
    into v_booking
    from public.bookings
    where id = p_booking_id
    for update;

  if not found then
    raise exception 'Không tìm thấy đơn đặt vé.';
  end if;
  if lower(v_booking.status) in ('cancelled', 'canceled') then
    raise exception 'Không thể thanh toán đơn vé đã hủy.';
  end if;
  if round(v_booking.total_amount) <> round(p_amount) then
    raise exception 'Số tiền thanh toán không khớp với tổng tiền đơn hàng.';
  end if;

  select *
    into v_payment
    from public.payments
    where booking_id = p_booking_id
      and reference_code = btrim(p_reference_code)
    limit 1
    for update;

  if found then
    update public.payments
      set status = 'paid',
          amount = round(p_amount),
          payment_method = p_payment_method
      where id = v_payment.id
      returning * into v_payment;

    update public.bookings
      set status = 'paid'
      where id = p_booking_id;

    return v_payment;
  end if;

  insert into public.payments (
    booking_id,
    payment_method,
    amount,
    reference_code,
    status
  )
  values (
    p_booking_id,
    p_payment_method,
    round(p_amount),
    btrim(p_reference_code),
    'paid'
  )
  returning * into v_payment;

  update public.bookings
    set status = 'paid'
    where id = p_booking_id;

  return v_payment;
end;
$$;

grant execute on function public.confirm_booking_payment(uuid, text, numeric, text) to anon, authenticated;
