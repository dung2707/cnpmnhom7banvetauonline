import type { generateTripsForDate } from '../services/tripSchedule'

export type ScheduledTrip = ReturnType<typeof generateTripsForDate>[number]

export type SeatStatus = 'available' | 'held' | 'booked'

export interface SeatRow {
  id: string
  carriage_id: string
  seat_number: number
  price: number
  status: SeatStatus
  isFallback?: boolean
  trip_code?: string
  trip_id?: string
  trip_date?: string
}

export interface SeatHold {
  id: string
  seat_id: string
  session_id: string
  expires_at: string
}

export interface SelectedPlace {
  id: string
  carNumber: number
  seatNumber: number
  price: number
}

export type PassengerType = 'adult' | 'child' | 'student' | 'senior'
export type PassengerCounts = Record<PassengerType, number>

export interface AddOnService {
  id: 'vipLounge' | 'meal'
  label: string
  price: number
}

export interface BookingSeat {
  id: string
  carNumber: number
  seatNumber: number
  price: number
  carriageTitle?: string
}

export interface PassengerDetails {
  seatId: string
  fullName: string
  phone: string
  email: string
  type: PassengerType
  dateOfBirth?: string
  studentId?: string
  schoolName?: string
}

export interface CreateBookingInput {
  bookingCode: string
  tripId: string
  tripCode: string
  tripDate: string
  departureTime: string
  origin: string
  destination: string
  contactEmail: string
  totalAmount: number
}

export interface BookingRecord {
  id: string
  booking_code: string
  status: string
  total_amount: number
}

export interface BookingPassengerInput extends PassengerDetails {
  carNumber: number
  seatNumber: number
  baseFare: number
}

export interface SavedPassengerRecord {
  id: string
  booking_id: string
  seat_id: string
  full_name: string
  phone: string
  email: string
  passenger_type: PassengerType
  date_of_birth: string | null
  student_id: string | null
  school_name: string | null
  base_fare: number
  discount_rate: number
  final_fare: number
}

export interface CancellationPassenger {
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

export interface CancellationBooking {
  id: string
  booking_code: string
  trip_code: string
  trip_date: string
  created_at: string
  departure_time: string | null
  origin: string
  destination: string
  status: string
  total_amount: number
  cancellation_fee: number | null
  refund_amount: number | null
  cancelled_at: string | null
  cancellation_reason: string | null
  booking_passengers: CancellationPassenger[]
}

export interface BookingHistoryPassenger {
  id: string
  full_name: string
  phone: string
  email: string
  carriage_number: number
  seat_number: number
  passenger_type: string
}

export interface BookingPayment {
  id: string
  status: string
}

export interface Booking {
  id: string
  booking_code: string
  trip_code: string
  trip_date: string
  departure_time: string | null
  origin: string
  destination: string
  status: string
  total_amount: number
  booking_passengers: BookingHistoryPassenger[]
  payments: BookingPayment[]
}

export interface TicketPassenger {
  id: string
  full_name: string
  phone: string
  email: string
  carriage_number: number
  seat_number: number
  passenger_type: string
  date_of_birth: string | null
  student_id: string | null
  school_name: string | null
}

export interface TicketBooking {
  id: string
  booking_code: string
  trip_code: string
  trip_date: string
  departure_time: string | null
  origin: string
  destination: string
  contact_email: string
  status: string
  booking_passengers: TicketPassenger[]
}

export interface TicketQrCodeData {
  bookingId: string
  passengerName: string
  seatNumber: number
  trainNo: string
}
