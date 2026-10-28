import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, ChevronDown, Clock3, RotateCw, Ticket, TrainFront, Users } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { supabase } from '../../lib/supabase'

interface BookingPassenger {
  id: string
  full_name: string
  phone: string
  email: string
  carriage_number: number
  seat_number: number
  passenger_type: string
}

interface BookingPayment {
  id: string
  status: string
}

interface Booking {
  id: string
  booking_code: string
  trip_code: string
  trip_date: string
  status: string
  total_amount: number
  booking_passengers: BookingPassenger[]
  payments: BookingPayment[]
}

const demoEmail = 'demo@duongsat.vn'

function getStatus(booking: Booking) {
  const bookingStatus = booking.status.toLocaleLowerCase('en')
  if (bookingStatus === 'cancelled' || bookingStatus === 'canceled') return 'cancelled'

  const paymentStatuses = booking.payments.map((payment) => payment.status.toLocaleLowerCase('en'))
  if (
    ['paid', 'confirmed', 'completed'].includes(bookingStatus) ||
    paymentStatuses.some((status) => ['paid', 'success', 'succeeded', 'completed'].includes(status))
  ) {
    return 'paid'
  }

  return 'pending'
}

const statusLabels = {
  paid: 'Đã thanh toán',
  pending: 'Chờ thanh toán',
  cancelled: 'Đã hủy',
} as const

function formatCurrency(amount: number) {
  return `${new Intl.NumberFormat('vi-VN').format(amount)} đ`
}

function formatDepartureDate(date: string) {
  const parsedDate = new Date(`${date}T12:00:00`)
  return Number.isNaN(parsedDate.getTime())
    ? date
    : new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' }).format(parsedDate)
}

export function BookingHistory() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadingError, setLoadingError] = useState('')
  const [cancelError, setCancelError] = useState('')
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null)

  const loadBookings = useCallback(async () => {
    setIsLoading(true)
    setLoadingError('')

    try {
      let query = supabase
        .from('bookings')
        .select(`
          id,
          booking_code,
          trip_code,
          trip_date,
          status,
          total_amount,
          booking_passengers (
            id,
            full_name,
            phone,
            email,
            carriage_number,
            seat_number,
            passenger_type
          ),
          payments (
            id,
            status
          )
        `)
        .order('created_at', { ascending: false })

      if (user?.email?.toLocaleLowerCase('vi') !== demoEmail) {
        if (!user?.email) {
          setBookings([])
          return
        }
        query = query.eq('contact_email', user.email)
      }

      const { data, error } = await query
      if (error) throw error

      setBookings((data ?? []) as Booking[])
    } catch (error) {
      setLoadingError(error instanceof Error ? error.message : 'Không thể tải lịch sử đặt vé.')
    } finally {
      setIsLoading(false)
    }
  }, [user?.email])

  useEffect(() => {
    void loadBookings()
  }, [loadBookings])

  async function cancelBooking(booking: Booking) {
    if (cancellingBookingId || getStatus(booking) === 'cancelled') return
    if (!window.confirm(`Bạn có chắc muốn hủy vé ${booking.booking_code}?`)) return

    setCancellingBookingId(booking.id)
    setCancelError('')
    try {
      let query = supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', booking.id)

      if (user?.email?.toLocaleLowerCase('vi') !== demoEmail && user?.email) {
        query = query.eq('contact_email', user.email)
      }

      const { data, error } = await query.select('id').maybeSingle()
      if (error) throw error
      if (!data) throw new Error('Không tìm thấy vé phù hợp để hủy.')

      setBookings((current) => current.map((item) =>
        item.id === booking.id ? { ...item, status: 'cancelled' } : item,
      ))
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : 'Không thể hủy vé. Vui lòng thử lại.')
    } finally {
      setCancellingBookingId(null)
    }
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8" aria-labelledby="booking-history-title">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Vé của bạn</span>
          <h1 className="mt-2 text-3xl font-bold text-slate-900" id="booking-history-title">Lịch sử đặt vé</h1>
          <p className="mt-2 text-sm text-slate-600">Theo dõi thông tin chuyến đi và trạng thái thanh toán.</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
          type="button"
          onClick={() => void loadBookings()}
          disabled={isLoading}
        >
          <RotateCw size={16} className={isLoading ? 'animate-spin' : ''} />
          Làm mới
        </button>
      </header>

      {cancelError && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
          {cancelError}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-4" aria-label="Đang tải lịch sử đặt vé" aria-busy="true">
          {[0, 1, 2].map((item) => (
            <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={item}>
              <div className="mb-5 flex justify-between gap-4">
                <div className="h-5 w-40 rounded bg-slate-200" />
                <div className="h-6 w-28 rounded-full bg-slate-100" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[0, 1, 2, 3].map((field) => <div className="h-12 rounded-lg bg-slate-100" key={field} />)}
              </div>
            </div>
          ))}
        </div>
      ) : loadingError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-800" role="alert">Không thể tải lịch sử đặt vé: {loadingError}</p>
          <button
            className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
            type="button"
            onClick={() => void loadBookings()}
          >
            Thử lại
          </button>
        </div>
      ) : bookings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-50 text-emerald-800">
            <Ticket size={25} />
          </span>
          <h2 className="mt-4 text-lg font-bold text-slate-900">Bạn chưa có vé nào</h2>
          <p className="mt-2 text-sm text-slate-600">Các đơn đặt vé của bạn sẽ hiển thị tại đây.</p>
          <a className="mt-5 inline-flex rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-900" href="#dat-ve">
            Tìm chuyến tàu
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => {
            const status = getStatus(booking)
            const seatLabels = booking.booking_passengers
              .map((passenger) => `Toa ${passenger.carriage_number} · Ghế ${passenger.seat_number}`)
              .join(', ')

            return (
              <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" key={booking.id}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-800"><Ticket size={19} /></span>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Mã đặt vé</p>
                      <h2 className="font-bold text-slate-900">{booking.booking_code}</h2>
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    status === 'paid' ? 'bg-emerald-50 text-emerald-800'
                      : status === 'cancelled' ? 'bg-slate-100 text-slate-600'
                        : 'bg-amber-50 text-amber-800'
                  }`}>
                    {status === 'paid' ? <Ticket className="mr-1 inline" size={13} />
                      : status === 'cancelled' ? null : <Clock3 className="mr-1 inline" size={13} />}
                    {statusLabels[status]}
                  </span>
                </div>

                <dl className="grid gap-x-6 gap-y-5 px-5 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
                  <div>
                    <dt className="flex items-center gap-2 text-xs font-medium text-slate-500"><TrainFront size={15} />Mã chuyến tàu</dt>
                    <dd className="mt-1 font-semibold text-slate-900">{booking.trip_code}</dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-2 text-xs font-medium text-slate-500"><CalendarDays size={15} />Ngày khởi hành</dt>
                    <dd className="mt-1 font-semibold text-slate-900">{formatDepartureDate(booking.trip_date)}</dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-2 text-xs font-medium text-slate-500"><Users size={15} />Danh sách ghế</dt>
                    <dd className="mt-1 font-semibold text-slate-900">{seatLabels || 'Chưa có thông tin ghế'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Tổng tiền</dt>
                    <dd className="mt-1 font-bold text-emerald-800">{formatCurrency(Number(booking.total_amount))}</dd>
                  </div>
                </dl>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-3 sm:px-6">
                  {booking.booking_passengers.length > 0 ? (
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-emerald-800 hover:text-emerald-950">
                        <Users size={16} />
                        Xem chi tiết hành khách ({booking.booking_passengers.length})
                        <ChevronDown className="transition group-open:rotate-180" size={15} />
                      </summary>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {booking.booking_passengers.map((passenger) => (
                          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm" key={passenger.id}>
                            <strong className="text-slate-900">{passenger.full_name}</strong>
                            <p className="mt-1 text-slate-600">Toa {passenger.carriage_number} · Ghế {passenger.seat_number}</p>
                            <p className="mt-1 text-slate-600">{passenger.phone}</p>
                            <p className="mt-1 break-all text-slate-600">{passenger.email}</p>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : <span className="text-sm text-slate-500">Chưa có thông tin hành khách.</span>}

                  {status !== 'cancelled' && (
                    <button
                      className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      type="button"
                      disabled={cancellingBookingId !== null}
                      onClick={() => void cancelBooking(booking)}
                    >
                      {cancellingBookingId === booking.id ? 'Đang hủy...' : 'Hủy vé'}
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
