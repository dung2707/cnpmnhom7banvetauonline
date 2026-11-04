import { useState, type FormEvent } from 'react'
import { AlertCircle, CheckCircle2, Loader2, TicketX, TrainFront, UserRound, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { generateTripsForDate } from '../../services/tripSchedule'

interface BookingPassenger {
  id: string
  full_name: string
  phone: string
  email: string
  seat_id: string
  carriage_number: number
  seat_number: number
  base_fare: number | null
  final_fare: number | null
}

interface CancellationBooking {
  id: string
  booking_code: string
  trip_code: string
  trip_date: string
  departure_time: string | null
  origin: string
  destination: string
  status: string
  total_amount: number
  cancellation_fee: number | null
  refund_amount: number | null
  cancelled_at: string | null
  cancellation_reason: string | null
  booking_passengers: BookingPassenger[]
}

interface SeatSnapshot {
  id: string
  status: string
}

interface TicketCancelFormProps {
  onNavigateToHistory?: () => void
}

const cancellationReasons = [
  'Thay đổi kế hoạch',
  'Chọn nhầm chuyến hoặc thông tin vé',
  'Không còn nhu cầu di chuyển',
  'Lý do khác',
]
const invalidBookingMessage = 'Mã đơn hàng hoặc Số điện thoại không chính xác'
const expiredBookingMessage = 'Đã quá thời hạn hủy vé trực tuyến (Tối thiểu 4 tiếng trước giờ khởi hành)'
const feeRate = 0.1

function validateCancellation(departureTime: Date, now = new Date()) {
  if (Number.isNaN(departureTime.getTime())) return 'Không xác định được giờ khởi hành của chuyến tàu.'
  return departureTime.getTime() - now.getTime() >= 4 * 60 * 60 * 1000
    ? ''
    : expiredBookingMessage
}

function formatCurrency(amount: number) {
  return `${new Intl.NumberFormat('vi-VN').format(amount)} đ`
}

function formatDeparture(value: string) {
  const parsedDate = new Date(value)
  return Number.isNaN(parsedDate.getTime())
    ? value
    : new Intl.DateTimeFormat('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(parsedDate)
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Đã xảy ra lỗi. Vui lòng thử lại.'
}

export function TicketCancelForm({ onNavigateToHistory }: TicketCancelFormProps) {
  const [bookingCode, setBookingCode] = useState('')
  const [phone, setPhone] = useState('')
  const [booking, setBooking] = useState<CancellationBooking | null>(null)
  const [departureTime, setDepartureTime] = useState('')
  const [cancellationReason, setCancellationReason] = useState(cancellationReasons[0])
  const [isChecking, setIsChecking] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const passengerFare = booking?.booking_passengers.reduce((total, passenger) => {
    const fare = Number(passenger.final_fare ?? passenger.base_fare ?? 0)
    return total + (Number.isFinite(fare) ? fare : 0)
  }, 0) ?? 0
  const originalFare = passengerFare > 0 ? passengerFare : Number(booking?.total_amount ?? 0)
  const cancellationFee = Math.round(originalFare * feeRate)
  const refundAmount = originalFare - cancellationFee

  async function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isChecking || isSubmitting) return

    setBooking(null)
    setDepartureTime('')
    setErrorMessage('')
    setSuccessMessage('')
    setIsChecking(true)
    try {
      const normalizedCode = bookingCode.trim()
      const normalizedPhone = phone.trim()
      if (!normalizedCode || !normalizedPhone) {
        setErrorMessage('Vui lòng nhập mã đơn hàng và số điện thoại đặt vé.')
        return
      }

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          booking_code,
          trip_code,
          trip_date,
          departure_time,
          origin,
          destination,
          status,
          total_amount,
          cancellation_fee,
          refund_amount,
          cancelled_at,
          cancellation_reason,
          booking_passengers (
            id,
            full_name,
            phone,
            email,
            seat_id,
            carriage_number,
            seat_number,
            base_fare,
            final_fare
          )
        `)
        .eq('booking_code', normalizedCode)
        .maybeSingle()

      if (error) throw error
      const foundBooking = data as CancellationBooking | null
      if (!foundBooking || !foundBooking.booking_passengers.some(
        (passenger) => passenger.phone.trim() === normalizedPhone,
      )) {
        setErrorMessage(invalidBookingMessage)
        return
      }

      if (['cancelled', 'canceled'].includes(foundBooking.status.toLocaleLowerCase('en'))) {
        setErrorMessage('Vé này đã được hủy trước đó.')
        return
      }

      let departure: Date
      if (foundBooking.departure_time) {
        departure = new Date(foundBooking.departure_time)
      } else {
        const scheduledTrip = generateTripsForDate(
          foundBooking.origin,
          foundBooking.destination,
          foundBooking.trip_date.slice(0, 10),
        ).find((trip) => trip.code === foundBooking.trip_code)
        if (!scheduledTrip) {
          setErrorMessage('Không tìm thấy lịch khởi hành phù hợp với mã chuyến trong vé.')
          return
        }
        departure = new Date(`${foundBooking.trip_date.slice(0, 10)}T${scheduledTrip.departureTime}:00`)
      }
      const validationError = validateCancellation(departure)
      if (validationError) {
        setErrorMessage(validationError)
        return
      }

      setDepartureTime(departure.toISOString())
      setBooking(foundBooking)
    } catch (error) {
      setErrorMessage(`Không thể kiểm tra thông tin vé: ${getErrorMessage(error)}`)
    } finally {
      setIsChecking(false)
    }
  }

  async function restoreBookingAndSeats(
    currentBooking: CancellationBooking,
    seatSnapshots: SeatSnapshot[],
  ) {
    const restoreErrors: string[] = []
    const { error: bookingRestoreError } = await supabase
      .from('bookings')
      .update({
        status: currentBooking.status,
        cancellation_fee: currentBooking.cancellation_fee,
        refund_amount: currentBooking.refund_amount,
        cancelled_at: currentBooking.cancelled_at,
        cancellation_reason: currentBooking.cancellation_reason,
      })
      .eq('id', currentBooking.id)
    if (bookingRestoreError) restoreErrors.push(`booking: ${bookingRestoreError.message}`)

    const snapshotsByStatus = new Map<string, string[]>()
    for (const seat of seatSnapshots) {
      const seatIds = snapshotsByStatus.get(seat.status) ?? []
      seatIds.push(seat.id)
      snapshotsByStatus.set(seat.status, seatIds)
    }
    for (const [status, seatIds] of snapshotsByStatus) {
      const { error } = await supabase.from('seats').update({ status }).in('id', seatIds)
      if (error) restoreErrors.push(`ghế: ${error.message}`)
    }

    return restoreErrors
  }

  async function handleConfirmCancellation() {
    if (!booking || isSubmitting) return

    setErrorMessage('')
    setIsSubmitting(true)
    let updatedBooking = false
    let seatSnapshots: SeatSnapshot[] = []
    try {
      const currentDeparture = new Date(departureTime)
      const validationError = validateCancellation(currentDeparture)
      if (validationError) throw new Error(validationError)
      if (booking.booking_passengers.length === 0) {
        throw new Error('Không tìm thấy hành khách hoặc ghế của vé để thực hiện hủy.')
      }

      const seatIds = [...new Set(booking.booking_passengers.map((passenger) => passenger.seat_id).filter(Boolean))]
      if (seatIds.length === 0) throw new Error('Không tìm thấy mã ghế của vé để giải phóng.')

      const { data: currentSeats, error: seatLookupError } = await supabase
        .from('seats')
        .select('id, status')
        .in('id', seatIds)
      if (seatLookupError) throw seatLookupError
      seatSnapshots = (currentSeats ?? []) as SeatSnapshot[]
      if (seatSnapshots.length !== seatIds.length) {
        throw new Error('Không thể xác định trạng thái của toàn bộ ghế trong vé.')
      }

      const cancellationTime = new Date().toISOString()
      const { data: updatedRows, error: bookingUpdateError } = await supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          cancellation_fee: cancellationFee,
          refund_amount: refundAmount,
          cancelled_at: cancellationTime,
          cancellation_reason: cancellationReason,
        })
        .eq('id', booking.id)
        .eq('status', booking.status)
        .select('id')
      if (bookingUpdateError) throw bookingUpdateError
      if (!updatedRows?.length) throw new Error('Trạng thái vé đã thay đổi. Vui lòng tra cứu lại.')
      updatedBooking = true

      const { data: updatedSeats, error: seatUpdateError } = await supabase
        .from('seats')
        .update({ status: 'available' })
        .in('id', seatIds)
        .select('id')
      if (seatUpdateError) throw seatUpdateError
      if (updatedSeats?.length !== seatIds.length) {
        throw new Error('Không thể giải phóng toàn bộ ghế của vé.')
      }

      setBooking(null)
      setSuccessMessage('Hủy vé thành công. Đang chuyển đến Lịch sử đặt vé...')
      window.setTimeout(() => {
        if (onNavigateToHistory) onNavigateToHistory()
        else window.location.hash = '#lich-su'
      }, 1500)
    } catch (error) {
      let message = getErrorMessage(error)
      if (updatedBooking) {
        const restoreErrors = await restoreBookingAndSeats(booking, seatSnapshots)
        if (restoreErrors.length > 0) {
          message += ` Không thể hoàn tác đầy đủ dữ liệu: ${restoreErrors.join('; ')}`
        }
      }
      setErrorMessage(`Không thể hủy vé: ${message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6" aria-labelledby="ticket-cancel-title">
      <header className="mb-6">
        <span className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Hỗ trợ đặt vé</span>
        <h1 className="mt-2 text-3xl font-bold text-slate-900" id="ticket-cancel-title">Hủy vé trực tuyến</h1>
        <p className="mt-2 text-sm text-slate-600">
          Tra cứu bằng mã đơn hàng và số điện thoại đã dùng khi đặt vé. Yêu cầu hủy cần được thực hiện trước giờ tàu chạy ít nhất 4 tiếng.
        </p>
      </header>

      <form className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" onSubmit={(event) => void handleLookup(event)}>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="cancel-booking-code">
            Mã đơn hàng / Mã vé
          </label>
          <input
            autoComplete="off"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
            id="cancel-booking-code"
            maxLength={50}
            onChange={(event) => setBookingCode(event.target.value)}
            placeholder="Ví dụ: VR123456"
            value={bookingCode}
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="cancel-booking-phone">
            Số điện thoại đặt vé
          </label>
          <input
            autoComplete="tel"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
            id="cancel-booking-phone"
            inputMode="tel"
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Nhập số điện thoại đã đăng ký"
            value={phone}
            required
          />
        </div>
        {errorMessage && (
          <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
            <AlertCircle className="mt-0.5 shrink-0" size={17} />{errorMessage}
          </p>
        )}
        {successMessage && (
          <p className="fixed right-4 top-4 z-[60] flex max-w-md items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 shadow-lg" role="status">
            <CheckCircle2 className="mt-0.5 shrink-0" size={17} />{successMessage}
          </p>
        )}
        <button
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isChecking || isSubmitting}
          type="submit"
        >
          {isChecking ? <Loader2 className="animate-spin" size={17} /> : <TicketX size={17} />}
          {isChecking ? 'Đang kiểm tra...' : 'Kiểm tra thông tin vé'}
        </button>
      </form>

      {booking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4" role="presentation">
          <section
            aria-labelledby="cancel-confirm-title"
            aria-modal="true"
            className="my-auto w-full max-w-2xl rounded-2xl bg-white shadow-2xl"
            role="dialog"
          >
            <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900" id="cancel-confirm-title">Xác nhận hủy vé</h2>
                <p className="mt-1 text-sm text-slate-600">Mã đơn hàng: {booking.booking_code}</p>
              </div>
              <button
                aria-label="Đóng xác nhận hủy vé"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                disabled={isSubmitting}
                onClick={() => setBooking(null)}
                type="button"
              >
                <X size={20} />
              </button>
            </header>

            <div className="max-h-[70vh] space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
              <div className="space-y-3">
                {booking.booking_passengers.map((passenger) => (
                  <article className="rounded-xl border border-slate-200 p-4" key={passenger.id}>
                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                      <UserRound size={17} className="text-emerald-800" />
                      {passenger.full_name}
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{passenger.phone} · {passenger.email}</p>
                    <p className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                      <TrainFront size={16} className="text-emerald-800" />
                      {booking.origin} → {booking.destination} · Tàu {booking.trip_code}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      Toa {passenger.carriage_number} · Ghế {passenger.seat_number} · {formatDeparture(departureTime)}
                    </p>
                  </article>
                ))}
              </div>

              <dl className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-600">Giá vé gốc</dt>
                  <dd className="font-semibold text-slate-900">{formatCurrency(originalFare)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-600">Phí hủy vé (10%)</dt>
                  <dd className="font-semibold text-red-700">− {formatCurrency(cancellationFee)}</dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-slate-200 pt-2">
                  <dt className="font-semibold text-slate-800">Số tiền dự kiến hoàn</dt>
                  <dd className="font-bold text-emerald-800">{formatCurrency(refundAmount)}</dd>
                </div>
              </dl>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="cancel-reason">
                  Lý do hủy vé
                </label>
                <select
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                  disabled={isSubmitting}
                  id="cancel-reason"
                  onChange={(event) => setCancellationReason(event.target.value)}
                  value={cancellationReason}
                >
                  {cancellationReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                </select>
              </div>
              {errorMessage && <p className="text-sm text-red-700" role="alert">{errorMessage}</p>}
            </div>

            <footer className="flex flex-col-reverse gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                disabled={isSubmitting}
                onClick={() => setBooking(null)}
                type="button"
              >
                Quay lại
              </button>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting}
                onClick={() => void handleConfirmCancellation()}
                type="button"
              >
                {isSubmitting && <Loader2 className="animate-spin" size={17} />}
                {isSubmitting ? 'Đang xử lý...' : 'Xác nhận Hủy vé'}
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  )
}
