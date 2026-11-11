import { supabase } from '../lib/supabase'
import type {
  Booking,
  BookingPassengerInput,
  BookingRecord,
  CancellationBooking,
  CreateBookingInput,
  PassengerType,
  SavedPassengerRecord,
  TicketBooking,
} from '../types'

export type {
  BookingPassengerInput,
  BookingRecord,
  CreateBookingInput,
  SavedPassengerRecord,
} from '../types'

export class BookingServiceError extends Error {
  readonly originalError: unknown

  constructor(message: string, originalError: unknown) {
    super(message)
    this.name = 'BookingServiceError'
    this.originalError = originalError
  }
}

export interface CancelBookingInput {
  booking: CancellationBooking
  cancellationFee: number
  refundAmount: number
  cancellationReason: string
}

export const cancellationWindowError =
  'Không thể hủy vé: Đã quá thời hạn cho phép hủy vé (chỉ được phép hủy trong vòng 4 tiếng sau khi đặt / trước giờ tàu chạy).'
const cancellationWindowMs = 4 * 60 * 60 * 1000

const discountRates: Record<PassengerType, number> = {
  adult: 0,
  child: 0.25,
  student: 0.1,
  senior: 0.15,
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function isValidDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export async function createBooking(input: CreateBookingInput): Promise<BookingRecord> {
  try {
    if (!input.bookingCode.trim() || !input.tripId.trim() || !input.tripCode.trim()) {
      throw new Error('Mã đặt vé và thông tin chuyến tàu là bắt buộc.')
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.tripDate)) {
      throw new Error('Ngày khởi hành không đúng định dạng YYYY-MM-DD.')
    }
    if (Number.isNaN(Date.parse(input.departureTime))) {
      throw new Error('Giờ khởi hành không hợp lệ.')
    }
    if (!Number.isFinite(input.totalAmount) || input.totalAmount <= 0) {
      throw new Error('Tổng tiền đặt vé phải lớn hơn 0.')
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.contactEmail.trim())) {
      throw new Error('Email liên hệ không hợp lệ.')
    }

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        booking_code: input.bookingCode.trim(),
        trip_id: input.tripId,
        trip_code: input.tripCode.trim(),
        trip_date: input.tripDate,
        departure_time: input.departureTime,
        origin: input.origin.trim(),
        destination: input.destination.trim(),
        contact_email: input.contactEmail.trim(),
        total_amount: Math.round(input.totalAmount),
        status: 'pending_payment',
      })
      .select('id, booking_code, status, total_amount')
      .single()

    if (error) throw error
    if (!data) throw new Error('Supabase không trả về thông tin đặt vé vừa tạo.')

    return data
  } catch (error) {
    throw new BookingServiceError(`Không thể tạo đặt vé: ${errorMessage(error)}`, error)
  }
}

export async function savePassengers(
  bookingId: string,
  passengers: BookingPassengerInput[],
  departureDate: string,
): Promise<SavedPassengerRecord[]> {
  try {
    if (!bookingId.trim()) throw new Error('Thiếu mã đặt vé.')
    if (passengers.length === 0) throw new Error('Đặt vé phải có ít nhất một hành khách.')
    if (!isValidDateOnly(departureDate)) {
      throw new Error('Ngày khởi hành không hợp lệ để xác thực loại hành khách.')
    }

    const passengerRows = passengers.map((passenger) => {
      if (!passenger.seatId.trim() || !passenger.fullName.trim()) {
        throw new Error('Mỗi hành khách cần có ghế và họ tên hợp lệ.')
      }
      if (!/^0(?:3|5|7|8|9)\d{8}$/.test(passenger.phone.trim())) {
        throw new Error(`Số điện thoại của ${passenger.fullName} không hợp lệ.`)
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(passenger.email.trim())) {
        throw new Error(`Email của ${passenger.fullName} không hợp lệ.`)
      }
      if (!Number.isFinite(passenger.baseFare) || passenger.baseFare <= 0) {
        throw new Error(`Giá vé của ghế ${passenger.seatNumber} không hợp lệ.`)
      }
      if (passenger.type === 'child') {
        const dateOfBirth = passenger.dateOfBirth ?? ''
        if (!isValidDateOnly(dateOfBirth)) {
          throw new Error(`Ngày sinh của ${passenger.fullName} không hợp lệ.`)
        }
        const [birthYear, birthMonth, birthDay] = dateOfBirth.split('-').map(Number)
        const [departureYear, departureMonth, departureDay] = departureDate.split('-').map(Number)
        const birthDate = new Date(Date.UTC(birthYear, birthMonth - 1, birthDay))
        const tripDate = new Date(Date.UTC(departureYear, departureMonth - 1, departureDay))
        if (
          birthDate.getUTCFullYear() !== birthYear || birthDate.getUTCMonth() !== birthMonth - 1 || birthDate.getUTCDate() !== birthDay ||
          birthDate > tripDate
        ) {
          throw new Error(`Ngày sinh của ${passenger.fullName} không hợp lệ hoặc sau ngày khởi hành.`)
        }
        let age = departureYear - birthYear
        if (departureMonth < birthMonth || (departureMonth === birthMonth && departureDay < birthDay)) age -= 1
        if (age >= 12) throw new Error('Hành khách từ 12 tuổi trở lên phải chọn vé Người lớn')
      }
      if (passenger.type === 'student' && (!passenger.studentId?.trim() || !passenger.schoolName?.trim())) {
        throw new Error(`Vui lòng nhập MSSV và tên trường của ${passenger.fullName}.`)
      }

      const discountRate = discountRates[passenger.type]
      const baseFare = Math.round(passenger.baseFare)
      return {
        booking_id: bookingId,
        seat_id: passenger.seatId,
        carriage_number: passenger.carNumber,
        seat_number: passenger.seatNumber,
        full_name: passenger.fullName.trim(),
        phone: passenger.phone.trim(),
        email: passenger.email.trim(),
        passenger_type: passenger.type,
        date_of_birth: passenger.type === 'child' ? passenger.dateOfBirth : null,
        student_id: passenger.type === 'student' ? passenger.studentId?.trim() : null,
        school_name: passenger.type === 'student' ? passenger.schoolName?.trim() : null,
        base_fare: baseFare,
        discount_rate: discountRate,
        final_fare: baseFare - Math.round(baseFare * discountRate),
      }
    })

    const { data, error } = await supabase
      .from('booking_passengers')
      .insert(passengerRows)
      .select('id, booking_id, seat_id, full_name, phone, email, passenger_type, date_of_birth, student_id, school_name, base_fare, discount_rate, final_fare')

    if (error) throw error
    if (!data || data.length !== passengerRows.length) {
      throw new Error('Số hành khách được lưu không khớp với số hành khách đã gửi.')
    }

    return data
  } catch (error) {
    throw new BookingServiceError(`Không thể lưu thông tin hành khách: ${errorMessage(error)}`, error)
  }
}

export async function getBookingForCancellation(bookingCode: string): Promise<CancellationBooking | null> {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id,
      booking_code,
      trip_code,
      trip_date,
      created_at,
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
    .eq('booking_code', bookingCode)
    .maybeSingle()

  if (error) throw error
  return data as CancellationBooking | null
}

function validateCancellationWindow(booking: CancellationBooking) {
  const createdAt = Date.parse(booking.created_at)
  const departureAt = booking.departure_time ? Date.parse(booking.departure_time) : Number.NaN
  const now = Date.now()

  if (
    !Number.isFinite(createdAt) ||
    (now - createdAt > cancellationWindowMs) ||
    (Number.isFinite(departureAt) && departureAt - now <= cancellationWindowMs)
  ) {
    throw new BookingServiceError(cancellationWindowError, cancellationWindowError)
  }
}

function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null) {
    const details = error as { message?: unknown; error?: unknown }
    if (typeof details.message === 'string' && details.message.trim()) return details.message
    if (typeof details.error === 'string' && details.error.trim()) return details.error
  }
  if (typeof error === 'string' && error.trim()) return error
  return 'Đã có lỗi xảy ra'
}

export async function cancelBooking(input: CancelBookingInput): Promise<void> {
  try {
    validateCancellationWindow(input.booking)
    const { error } = await supabase.rpc('cancel_booking_and_release_seats', {
      p_booking_code: input.booking.booking_code,
      p_cancellation_fee: input.cancellationFee,
      p_refund_amount: input.refundAmount,
      p_cancellation_reason: input.cancellationReason,
    })
    if (error) throw error
  } catch (error) {
    if (error instanceof BookingServiceError) throw error
    throw new BookingServiceError(getErrorMessage(error), error)
  }
}

export async function getBookingHistory(contactEmail?: string): Promise<Booking[]> {
  let query = supabase
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

  if (contactEmail) query = query.eq('contact_email', contactEmail)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Booking[]
}

export async function getTicketBooking(bookingId: string): Promise<TicketBooking | null> {
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
      contact_email,
      status,
      booking_passengers (
        id,
        full_name,
        phone,
        email,
        carriage_number,
        seat_number,
        passenger_type,
        date_of_birth,
        student_id,
        school_name
      )
    `)
    .eq('id', bookingId)
    .maybeSingle()

  if (error) throw error
  return data as TicketBooking | null
}

/*
Test case 1 — US04: Chọn hai ghế, nhập đủ họ tên, số điện thoại Việt Nam hợp lệ,
email hợp lệ và hai loại hành khách khác nhau; nút Tiếp tục được bật và callback
nhận đúng hai hành khách cùng seatId tương ứng.

Test case 2 — US04: Nhập số điện thoại thiếu số, không bắt đầu bằng 0, hoặc email
sai định dạng; lỗi hiển thị ngay dưới trường tương ứng và nút Tiếp tục bị vô hiệu hóa.

Test case 3 — US04: Tóm tắt một vé Người lớn 100.000 đồng, Trẻ em 100.000 đồng,
Sinh viên 100.000 đồng và Người cao tuổi 100.000 đồng; thành tiền lần lượt là
100.000, 75.000, 90.000 và 85.000 đồng, tổng thanh toán là 350.000 đồng.

Test case 4 — US05: Tạo booking thành công, lưu hành khách, chọn VietQR và gửi
xác nhận; QR chứa số tiền đã giảm cùng mã đặt vé, payment được lưu ở trạng thái
pending_verification và UI báo đang chờ đối soát, không báo đã thanh toán thành công.

Test case 5 — US05: Khi request processPayment đang chạy, nút xác nhận bị vô hiệu
hóa; khi Supabase trả lỗi, lỗi được hiển thị và trạng thái loading kết thúc để
người dùng có thể thử lại.
*/
