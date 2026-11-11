import { ArrowLeftRight, CalendarDays, ChevronDown, MapPin, TrainFront, Users } from 'lucide-react'
import type { FormEvent } from 'react'
import trips from '../data/trips.json'
import { stations } from '../services/tripSchedule'
import type { PassengerCounts, PassengerType } from '../types/bookingFlow'
import { formatPrice } from '../utils/format'

export type SearchErrors = { origin?: string; destination?: string; date?: string; returnDate?: string }
type SuggestedTrip = (typeof trips)[number]

const passengerTypes: { id: PassengerType; label: string; note: string; minimum: number }[] = [
  { id: 'adult', label: 'Người lớn', note: 'Từ 12 tuổi', minimum: 1 },
  { id: 'child', label: 'Trẻ em', note: 'Giảm vé', minimum: 0 },
  { id: 'student', label: 'Sinh viên', note: 'Giảm vé', minimum: 0 },
  { id: 'senior', label: 'Người cao tuổi', note: 'Giảm vé', minimum: 0 },
]

type Props = {
  origin: string
  destination: string
  departureDate: string
  tripType: 'oneWay' | 'roundTrip'
  returnDate: string
  passengerCounts: PassengerCounts
  passengerTotal: number
  passengerMenuOpen: boolean
  errors: SearchErrors
  nearestStation: { name: string; distanceKm: number } | null
  suggestedTrips: SuggestedTrip[]
  locationError: string
  isLocating: boolean
  onOriginChange: (value: string) => void
  onDestinationChange: (value: string) => void
  onDepartureDateChange: (value: string) => void
  onTripTypeChange: (value: 'oneWay' | 'roundTrip') => void
  onReturnDateChange: (value: string) => void
  onPassengerCountChange: (type: PassengerType, count: number) => void
  onPassengerMenuToggle: () => void
  onSearch: (event: FormEvent<HTMLFormElement>) => void
  onSwapStations: () => void
  onLocate: () => void
  onSuggestedTrip: (trip: SuggestedTrip) => void
}

export function SearchTrainForm({
  origin,
  destination,
  departureDate,
  tripType,
  returnDate,
  passengerCounts,
  passengerTotal,
  passengerMenuOpen,
  errors,
  nearestStation,
  suggestedTrips,
  locationError,
  isLocating,
  onOriginChange,
  onDestinationChange,
  onDepartureDateChange,
  onTripTypeChange,
  onReturnDateChange,
  onPassengerCountChange,
  onPassengerMenuToggle,
  onSearch,
  onSwapStations,
  onLocate,
  onSuggestedTrip,
}: Props) {
  return (
    <>
      <form className="trip-search" onSubmit={onSearch} noValidate>
        <div className="trip-type-toggle" role="group" aria-label="Loại vé">
          <button className={tripType === 'oneWay' ? 'trip-type-active' : ''} type="button" aria-pressed={tripType === 'oneWay'} onClick={() => onTripTypeChange('oneWay')}>Một chiều</button>
          <button className={tripType === 'roundTrip' ? 'trip-type-active' : ''} type="button" aria-pressed={tripType === 'roundTrip'} onClick={() => onTripTypeChange('roundTrip')}>Khứ hồi</button>
        </div>
        <label className={`search-field${errors.origin ? ' search-field-error' : ''}`}>
          <span>Ga đi</span>
          <span className="search-control"><MapPin size={17} />
            <select aria-label="Ga đi" value={origin} onChange={(event) => onOriginChange(event.target.value)}>
              <option value="">Chọn ga khởi hành</option>
              {stations.map((station) => <option key={station.name} value={station.name}>{station.name}</option>)}
            </select>
          </span>
          {errors.origin && <small className="search-error">{errors.origin}</small>}
        </label>
        <button className="swap-button" type="button" onClick={onSwapStations} aria-label="Đảo chiều ga đi và ga đến" title="Đảo chiều ga">
          <ArrowLeftRight size={17} />
        </button>
        <label className={`search-field${errors.destination ? ' search-field-error' : ''}`}>
          <span>Ga đến</span>
          <span className="search-control"><MapPin size={17} />
            <select aria-label="Ga đến" value={destination} onChange={(event) => onDestinationChange(event.target.value)}>
              <option value="">Chọn ga đến</option>
              {stations.map((station) => <option key={station.name} value={station.name}>{station.name}</option>)}
            </select>
          </span>
          {errors.destination && <small className="search-error">{errors.destination}</small>}
        </label>
        <label className={`search-field departure-date-field${errors.date ? ' search-field-error' : ''}`}>
          <span>Ngày khởi hành</span>
          <span className="search-control"><CalendarDays size={17} />
            <input aria-label="Ngày khởi hành" type="date" value={departureDate} onChange={(event) => onDepartureDateChange(event.target.value)} />
          </span>
          {errors.date && <small className="search-error">{errors.date}</small>}
        </label>
        {tripType === 'roundTrip' && (
          <label className={`search-field return-date-field${errors.returnDate ? ' search-field-error' : ''}`}>
            <span>Ngày về</span>
            <span className="search-control"><CalendarDays size={17} />
              <input aria-label="Ngày về" type="date" min={departureDate || undefined} value={returnDate} onChange={(event) => onReturnDateChange(event.target.value)} />
            </span>
            {errors.returnDate && <small className="search-error">{errors.returnDate}</small>}
          </label>
        )}
        <div className="search-field passenger-field">
          <span>Hành khách</span>
          <div className="passenger-control">
            <Users size={17} aria-hidden="true" />
            <button className="passenger-trigger" type="button" aria-expanded={passengerMenuOpen} aria-controls="passenger-menu" onClick={onPassengerMenuToggle}>
              {passengerTotal} hành khách <ChevronDown size={15} aria-hidden="true" />
            </button>
            {passengerMenuOpen && (
              <div className="passenger-menu" id="passenger-menu">
                {passengerTypes.map((passenger) => (
                  <label className="passenger-option" key={passenger.id}>
                    <span><strong>{passenger.label}</strong><small>{passenger.note}</small></span>
                    <select aria-label={passenger.label} value={passengerCounts[passenger.id]} onChange={(event) => onPassengerCountChange(passenger.id, Number(event.target.value))}>
                      {Array.from({ length: 9 - passenger.minimum }, (_, index) => index + passenger.minimum).map((count) => <option value={count} key={count}>{count}</option>)}
                    </select>
                  </label>
                ))}
                <button className="passenger-done" type="button" onClick={onPassengerMenuToggle}>Xong</button>
              </div>
            )}
          </div>
        </div>
        <button className="submit-button search-button" type="submit">Tìm chuyến</button>
      </form>
      <div className="location-search">
        <button className="location-button" type="button" onClick={onLocate} disabled={isLocating}>
          <MapPin size={16} />{isLocating ? 'Đang xác định vị trí...' : 'Tìm chuyến từ vị trí của tôi'}
        </button>
        {locationError && <p className="location-error" role="alert">{locationError}</p>}
      </div>
      {nearestStation && (
        <section className="suggested-trips" aria-live="polite" aria-label="Chuyến tàu gợi ý gần bạn">
          <div className="location-banner">
            <MapPin size={18} />
            <p>Vị trí của bạn gần <strong>{nearestStation.name}</strong> (cách khoảng {nearestStation.distanceKm.toFixed(1)} km). Dưới đây là các chuyến tàu sẵn sàng khởi hành:</p>
          </div>
          {suggestedTrips.length > 0 ? (
            <div className="suggested-trip-list">
              {suggestedTrips.map((trip) => (
                <article className="suggested-trip-card" key={trip.code}>
                  <div className="suggested-trip-heading"><span className="trip-icon"><TrainFront size={19} /></span><strong>{trip.code}</strong></div>
                  <div className="suggested-trip-destination"><small>Ga đến</small><strong>{trip.destination}</strong></div>
                  <div className="suggested-trip-time"><small>Giờ chạy</small><strong>{trip.departureTime}</strong></div>
                  <div className="suggested-trip-price"><small>Giá vé từ</small><strong>{formatPrice(trip.minimumPrice)} đ</strong></div>
                  <div className="suggested-trip-seats"><span className="availability-dot" />Còn {trip.availableSeats} chỗ</div>
                  <button className="details-button" type="button" onClick={() => onSuggestedTrip(trip)}>Chọn chuyến này</button>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-results">
              <span className="empty-icon"><TrainFront size={22} /></span>
              <div><strong>Chưa có chuyến tàu còn chỗ từ ga {nearestStation.name}</strong><p>Hãy thử tìm lại sau hoặc chọn một ga đi khác.</p></div>
            </div>
          )}
        </section>
      )}
    </>
  )
}
