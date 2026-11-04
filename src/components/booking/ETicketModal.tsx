import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, LoaderCircle, Mail, TrainFront, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../../lib/supabase'
import { generateTripsForDate } from '../../services/tripSchedule'
import { sendTicketEmail } from '../../services/sendTicketEmail'

interface TicketPassenger {
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

interface TicketBooking {
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

interface ETicketModalProps {
  bookingId: string
  onClose: () => void
}

function formatDeparture(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
}

function formatDateOfBirth(value: string | null) {
  if (!value) return 'Chưa cập nhật'
  const [year, month, day] = value.slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

function getTicketTypeLabel(passenger: TicketPassenger) {
  switch (passenger.passenger_type) {
    case 'child':
      return `Trẻ em - NS: ${formatDateOfBirth(passenger.date_of_birth)}`
    case 'student':
      return `Sinh viên - MSSV: ${passenger.student_id || 'Chưa cập nhật'}`
    case 'senior':
      return 'Người cao tuổi'
    default:
      return 'Người lớn'
  }
}

export function ETicketModal({ bookingId, onClose }: ETicketModalProps) {
  const [booking, setBooking] = useState<TicketBooking | null>(null)
  const [departureTime, setDepartureTime] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [notice, setNotice] = useState('')
  const ticketRefs = useRef<Record<string, HTMLElement | null>>({})

  useEffect(() => {
    let isActive = true

    async function loadTicket() {
      setIsLoading(true)
      setErrorMessage('')
      try {
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
        if (!data) throw new Error('Không tìm thấy thông tin vé.')

        const loadedBooking = data as TicketBooking
        const departure = loadedBooking.departure_time
          ? new Date(loadedBooking.departure_time)
          : (() => {
            const trip = generateTripsForDate(
              loadedBooking.origin,
              loadedBooking.destination,
              loadedBooking.trip_date.slice(0, 10),
            ).find((scheduledTrip) => scheduledTrip.code === loadedBooking.trip_code)
            return trip
              ? new Date(`${loadedBooking.trip_date.slice(0, 10)}T${trip.departureTime}:00`)
              : new Date(loadedBooking.trip_date)
          })()
        if (Number.isNaN(departure.getTime())) {
          throw new Error('Không xác định được ngày giờ khởi hành của vé.')
        }
        if (loadedBooking.booking_passengers.length === 0) {
          throw new Error('Vé chưa có thông tin hành khách.')
        }
        if (isActive) {
          setBooking(loadedBooking)
          setDepartureTime(departure.toISOString())
        }
      } catch (error) {
        if (isActive) setErrorMessage(error instanceof Error ? error.message : 'Không thể tải vé điện tử.')
      } finally {
        if (isActive) setIsLoading(false)
      }
    }

    void loadTicket()
    return () => { isActive = false }
  }, [bookingId])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isDownloading && !isSendingEmail) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDownloading, isSendingEmail, onClose])

  async function handleDownload() {
    if (!booking || isDownloading) return
    setErrorMessage('')
    setIsDownloading(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
      for (const passenger of booking.booking_passengers) {
        const ticketElement = ticketRefs.current[passenger.id]
        if (!ticketElement) throw new Error(`Không thể tạo ảnh vé của ${passenger.full_name}.`)

        const canvas = await html2canvas(ticketElement, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
        })
        const downloadLink = document.createElement('a')
        downloadLink.download = `${booking.booking_code}-ghe-${passenger.seat_number}.png`
        downloadLink.href = canvas.toDataURL('image/png')
        downloadLink.click()
      }
      setNotice('Đã tải vé điện tử về máy.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể tải vé về máy.')
    } finally {
      setIsDownloading(false)
    }
  }

  async function handleSendEmail() {
    if (!booking || isSendingEmail) return
    setErrorMessage('')
    setNotice('')
    setIsSendingEmail(true)
    try {
      await sendTicketEmail({ bookingId: booking.id })
      setNotice(`Đã gửi lại email vé đến ${booking.contact_email}.`)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể gửi email vé.')
    } finally {
      setIsSendingEmail(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isDownloading && !isSendingEmail) onClose()
      }}
    >
      <section
        aria-labelledby="e-ticket-modal-title"
        aria-modal="true"
        className="my-auto w-full max-w-3xl rounded-2xl bg-slate-50 shadow-2xl"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">VietRail · US06</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900" id="e-ticket-modal-title">Vé điện tử</h2>
          </div>
          <button
            aria-label="Đóng vé điện tử"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
            disabled={isDownloading || isSendingEmail}
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </header>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4 sm:p-6">
          {isLoading ? (
            <p className="flex items-center justify-center gap-2 py-12 text-sm text-slate-600" role="status">
              <LoaderCircle className="animate-spin" size={18} />Đang tải thông tin vé...
            </p>
          ) : errorMessage && !booking ? (
            <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{errorMessage}</p>
          ) : booking ? (
            <>
              {booking.booking_passengers.map((passenger) => {
                const qrValue = JSON.stringify({
                  bookingId: booking.id,
                  passengerName: passenger.full_name,
                  seatNumber: passenger.seat_number,
                  trainNo: booking.trip_code,
                })
                return (
                  <article
                    className="mx-auto max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                    key={passenger.id}
                    ref={(element) => { ticketRefs.current[passenger.id] = element }}
                  >
                    <div className="flex items-center justify-between bg-emerald-900 px-5 py-4 text-white">
                      <div className="flex items-center gap-3">
                        <span className="grid size-10 place-items-center rounded-xl bg-white/15"><TrainFront size={22} /></span>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-100">VietRail</p>
                          <h3 className="font-bold">Vé tàu điện tử</h3>
                        </div>
                      </div>
                      <p className="text-right text-xs text-emerald-100">Mã vé<strong className="mt-1 block text-sm text-white">{booking.booking_code}</strong></p>
                    </div>

                    <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div className="space-y-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Chặng đi</p>
                          <p className="mt-1 text-lg font-bold text-slate-900">{booking.origin} <span className="text-emerald-700">→</span> {booking.destination}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ngày giờ khởi hành</p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">{formatDeparture(departureTime)}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hành khách</p>
                            <p className="mt-1 text-sm font-semibold text-slate-800">{passenger.full_name}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Số hiệu tàu</p>
                            <p className="mt-1 text-sm font-semibold text-slate-800">{booking.trip_code}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Số hiệu toa</p>
                            <p className="mt-1 text-sm font-semibold text-slate-800">{passenger.carriage_number}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Số ghế</p>
                            <p className="mt-1 text-sm font-semibold text-slate-800">{passenger.seat_number}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Loại vé</p>
                            <p className="mt-1 text-sm font-semibold text-slate-800">{getTicketTypeLabel(passenger)}</p>
                            {passenger.passenger_type === 'student' && passenger.school_name && (
                              <p className="mt-1 text-xs text-slate-600">{passenger.school_name}</p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mx-auto rounded-xl border border-slate-200 bg-white p-3 text-center">
                        <QRCodeSVG aria-label={`Mã QR vé ${booking.booking_code}, ghế ${passenger.seat_number}`} size={144} value={qrValue} />
                        <p className="mt-2 text-xs font-medium text-slate-500">Quét mã khi vào ga</p>
                      </div>
                    </div>
                    <div className="border-t border-dashed border-slate-300 px-5 py-3 text-xs text-slate-500">
                      Vui lòng có mặt tại ga trước giờ khởi hành 30 phút.
                    </div>
                    {['child', 'student'].includes(passenger.passenger_type) && (
                      <div className="border-t border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700">
                        ⚠️ Vé ưu tiên chỉ có giá trị khi đi kèm Giấy khai sinh (Trẻ em) hoặc Thẻ Sinh viên hợp lệ tại cửa soát vé.
                      </div>
                    )}
                  </article>
                )
              })}
            </>
          ) : null}
          {errorMessage && booking && (
            <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{errorMessage}</p>
          )}
          {notice && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{notice}</p>}
        </div>

        {booking && (
          <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              disabled={isDownloading || isSendingEmail}
              onClick={() => void handleDownload()}
              type="button"
            >
              {isDownloading ? <LoaderCircle className="animate-spin" size={17} /> : <Download size={17} />}
              {isDownloading ? 'Đang tải vé...' : 'Tải vé về máy'}
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:opacity-50"
              disabled={isDownloading || isSendingEmail}
              onClick={() => void handleSendEmail()}
              type="button"
            >
              {isSendingEmail ? <LoaderCircle className="animate-spin" size={17} /> : <Mail size={17} />}
              {isSendingEmail ? 'Đang gửi email...' : 'Gửi lại Email vé'}
            </button>
          </footer>
        )}
      </section>
    </div>,
    document.body,
  )
}
