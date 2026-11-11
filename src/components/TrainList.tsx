import { Bell, Clock3, TrainFront } from 'lucide-react'
import type { ScheduledTrip } from '../types/bookingFlow'
import { formatDate, formatDuration, formatPrice } from '../utils/format'

type TripResult = { trip: ScheduledTrip; availableSeatCount: number }

type Props = {
  visible: boolean
  origin: string
  destination: string
  departureDate: string
  tripType: 'oneWay' | 'roundTrip'
  returnDate: string
  trips: TripResult[]
  unavailableTripCount: number
  alternativeTrip?: ScheduledTrip
  isNotificationRegistered: (trip: ScheduledTrip) => boolean
  onSelectTrip: (trip: ScheduledTrip) => void
  onRegisterNotification: (trip: ScheduledTrip) => void
}

export function TrainList({
  visible,
  origin,
  destination,
  departureDate,
  tripType,
  returnDate,
  trips,
  unavailableTripCount,
  alternativeTrip,
  isNotificationRegistered,
  onSelectTrip,
  onRegisterNotification,
}: Props) {
  if (!visible) return null

  return (
    <section className="search-results" aria-live="polite" aria-label="Kết quả tìm kiếm">
      <div className="results-heading">
        <div><span className="eyebrow">Hành trình của bạn</span><h3>{origin} <span>→</span> {destination}</h3></div>
        <p>{formatDate(departureDate)}{tripType === 'roundTrip' && returnDate ? ` · Về ${formatDate(returnDate)}` : ''}</p>
      </div>
      {trips.length > 0 ? (
        <div className="trip-list">
          {trips.map(({ trip, availableSeatCount }) => {
            const registered = isNotificationRegistered(trip)
            return (
              <article className="trip-card" key={trip.id}>
                <div className="trip-code"><span className="trip-icon"><TrainFront size={19} /></span><div><strong>{trip.code}</strong><small>Tàu Thống Nhất</small></div></div>
                <div className="trip-times"><strong>{trip.departureTime}</strong><span className="trip-track"><i /></span><strong>{trip.arrivalTime}<small>{trip.arrivalDayOffset ? '+1 ngày' : ''}</small></strong></div>
                <div className="trip-meta"><span><Clock3 size={14} />{formatDuration(trip.durationMinutes)}</span><span className="trip-price">{formatPrice(trip.minimumPrice)} – {formatPrice(trip.maximumPrice)} đ</span></div>
                <div className={`trip-availability${availableSeatCount === 0 ? ' trip-availability-full' : ''}`}><span className="availability-dot" />{availableSeatCount > 0 ? `Còn ${availableSeatCount} chỗ` : 'Hết chỗ (0)'}</div>
                <div className="trip-card-actions">
                  <button className="details-button" type="button" onClick={() => onSelectTrip(trip)}>Xem chi tiết</button>
                  {availableSeatCount === 0 && (
                    <button
                      className={`notify-seat-button${registered ? ' notify-seat-registered' : ''}`}
                      type="button"
                      disabled={registered}
                      onClick={() => onRegisterNotification(trip)}
                    >
                      <Bell size={15} />{registered ? 'Đã đăng ký báo chỗ' : 'Báo tôi khi có chỗ'}
                    </button>
                  )}
                </div>
              </article>
            )
          })}
          {unavailableTripCount > 0 && alternativeTrip && (
            <p className="alternative-trip-tip" role="status">
              💡 Gợi ý: Còn chuyến {alternativeTrip.code} lúc {alternativeTrip.departureTime} cùng ngày còn {alternativeTrip.availableSeats} chỗ.
            </p>
          )}
        </div>
      ) : (
        <div className="empty-results">
          <span className="empty-icon"><TrainFront size={22} /></span>
          <div><strong>Không tìm thấy chuyến tàu phù hợp cho lộ trình này</strong><p>Hãy thử chọn ngày khác hoặc kiểm tra lại ga đi và ga đến.</p></div>
        </div>
      )}
    </section>
  )
}
