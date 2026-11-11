import { Check, TrainFront, Utensils } from 'lucide-react'
import type { TrainCarriage } from '../data/trainCarriages'
import type { AddOnService, SeatHold, SeatRow, SelectedPlace } from '../types/bookingFlow'
import { formatPrice } from '../utils/format'

type Props = {
  car: TrainCarriage
  seats: SeatRow[]
  selectedPlaces: SelectedPlace[]
  seatHolds: SeatHold[]
  sessionId: string | null
  seatLoading: boolean
  seatError: string
  selectedServices: AddOnService['id'][]
  addOnServices: readonly AddOnService[]
  onToggleSeat: (carNumber: number, seat: SeatRow) => void
  onToggleService: (serviceId: AddOnService['id']) => void
}

export function SeatMap({
  car,
  seats,
  selectedPlaces,
  seatHolds,
  sessionId,
  seatLoading,
  seatError,
  selectedServices,
  addOnServices,
  onToggleSeat,
  onToggleService,
}: Props) {
  const tiers = car.type === 'berth4' ? 2 : 3
  const seatsPerCompartment = tiers * 2
  const carPlaces = selectedPlaces.filter((place) => place.carNumber === car.number)
  const availableSeatCount = seats.filter((seat) => seat.status === 'available').length

  function renderSeat(seat: SeatRow) {
    const isSelected = selectedPlaces.some((place) => place.id === seat.id)
    const ownHold = seatHolds.some((hold) => hold.seat_id === seat.id && hold.session_id === sessionId)
    const isHeldElsewhere = seat.status === 'held' && !ownHold
    const isUnavailable = seat.status === 'booked' || isHeldElsewhere

    return (
      <button className={`seat-tile${isSelected ? ' seat-tile-selected' : ''}${seat.status === 'booked' ? ' seat-tile-sold' : ''}${isHeldElsewhere ? ' seat-tile-held' : ''}`} type="button" key={seat.id} disabled={isUnavailable || seatLoading} aria-pressed={isSelected} aria-label={`${car.type === 'seat' ? 'Ghế' : 'Giường'} ${seat.seat_number}, ${isSelected ? 'đang được bạn giữ' : seat.status === 'available' ? 'còn trống' : seat.status === 'held' ? 'đang được giữ' : 'đã bán'}, ${formatPrice(Number(seat.price))} đồng`} onClick={() => onToggleSeat(car.number, seat)}>
        {seat.seat_number}{isSelected && <Check size={13} aria-hidden="true" />}
      </button>
    )
  }

  return (
    <div className="modal-content seat-map-content flex-1">
      <div className="seat-map-intro">
        <div><span className="eyebrow">Sơ đồ chọn chỗ</span><p>Ghế trống được tạo tự động nếu chưa có dữ liệu.</p></div>
        <div className="seat-map-legend" aria-label="Chú thích sơ đồ ghế">
          <span><i className="legend-available" />Còn trống</span>
          <span><i className="legend-held" />Đang giữ</span>
          <span><i className="legend-sold" />Đã bán</span>
          <span><i className="legend-selected" />Đang chọn</span>
        </div>
      </div>
      {seatError && <p className="seat-load-error" role="alert">{seatError}</p>}
      {seatLoading && <p className="seat-load-message" role="status">Đang tải sơ đồ ghế...</p>}
      <section className="car-map" role="tabpanel" key={car.number}>
        <div className="car-map-heading"><h3>{car.title} · {car.typeLabel}</h3><span>{availableSeatCount} chỗ còn</span></div>
        {car.type === 'seat' ? (
          <div className="seat-coach" aria-label="Sơ đồ 4 hàng ghế, lối đi giữa toa">
            <div className="seat-row-grid">
              {Array.from({ length: Math.ceil(seats.length / 4) }, (_, rowIndex) => {
                const rowSeats = seats.slice(rowIndex * 4, rowIndex * 4 + 4)
                return (
                  <div className="seat-row-line" key={rowIndex}>
                    <span className="seat-row-label">Hàng {rowIndex + 1}</span>
                    <div className="seat-pair">{rowSeats.slice(0, 2).map(renderSeat)}</div>
                    <span className="seat-aisle" aria-label="Lối đi" />
                    <div className="seat-pair">{rowSeats.slice(2).map(renderSeat)}</div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="seat-map-bedrooms">
            {Array.from({ length: Math.ceil(seats.length / seatsPerCompartment) }, (_, compartmentIndex) => {
              const compartmentSeats = seats.slice(compartmentIndex * seatsPerCompartment, compartmentIndex * seatsPerCompartment + seatsPerCompartment)
              return (
                <article className="bedroom" key={compartmentIndex}>
                  <div className="bedroom-header"><span>Khoang {compartmentIndex + 1}</span><small>{tiers} tầng · {seatsPerCompartment} giường</small></div>
                  <div className="bedroom-tiers">
                    {Array.from({ length: tiers }, (_, tierIndex) => (
                      <div className="bedroom-tier" key={tierIndex}>
                        <small>Tầng {tierIndex + 1}</small>
                        <div className="berth-pair">{compartmentSeats.slice(tierIndex * 2, tierIndex * 2 + 2).map(renderSeat)}</div>
                      </div>
                    ))}
                  </div>
                </article>
              )
            })}
          </div>
        )}
        <div className="selection-summary" aria-live="polite">
          <strong>Chỗ đã chọn trong {car.title}:</strong>
          {carPlaces.length > 0
            ? carPlaces.map((place) => <span className="selection-chip" key={place.seatNumber}>{car.type === 'seat' ? 'Ghế' : 'Giường'} {place.seatNumber}</span>)
            : <span className="selection-empty">Chưa chọn chỗ</span>}
        </div>
      </section>
      <section className="service-section">
        <h3>Dịch vụ mua kèm</h3>
        <div className="service-options">
          {addOnServices.map((service) => (
            <label className="service-option" key={service.id}>
              <input type="checkbox" checked={selectedServices.includes(service.id)} onChange={() => onToggleService(service.id)} />
              <span className="service-icon">{service.id === 'meal' ? <Utensils size={16} /> : <TrainFront size={16} />}</span>
              <span className="service-copy"><strong>{service.label}</strong><small>+{formatPrice(service.price)} đ</small></span>
            </label>
          ))}
        </div>
      </section>
    </div>
  )
}
