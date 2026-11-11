import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Bell, BellRing, Check, Clock3, LogOut, TrainFront, X } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import trips from '../data/trips.json'
import { supabase } from '../lib/supabase'
import { TrainCarriageBar } from './TrainCarriageBar'
import { trainCarriages } from '../data/trainCarriages'
import { BookingSummary, type BookingSummaryResult } from './booking/BookingSummary'
import { PassengerForm } from './booking/PassengerForm'
import { defaultVietQrBankConfig, PaymentPage } from './payment/PaymentPage'
import { BookingHistory } from './booking/BookingHistory'
import { createBooking, savePassengers } from '../services/bookingService'
import { generateTripsForDate, seededRandom, stations } from '../services/tripSchedule'
import { TicketCancelForm } from './booking/TicketCancelForm'
import { SearchTrainForm, type SearchErrors } from './SearchTrainForm'
import { TrainList } from './TrainList'
import { SeatMap } from './SeatMap'
import type {
  AddOnService,
  BookingRecord,
  PassengerCounts,
  PassengerDetails,
  ScheduledTrip,
  SeatHold,
  SeatRow,
  SelectedPlace,
} from '../types'
import { formatDate, formatPrice } from '../utils/format'

type Trip = (typeof trips)[number]
type Toast = { message: string; kind: 'error' | 'warning' | 'success'; notification?: TripNotification }
type TripNotification = {
  id: string
  userEmail: string
  tripCode: string
  tripDate: string
  origin: string
  destination: string
  message: string
  createdAt: string
  read: boolean
}
type TripNotificationRequest = {
  id: string
  tripCode: string
  tripDate: string
  origin: string
  destination: string
  userEmail: string
}
type BookingStep = 'seats' | 'passengers' | 'summary' | 'payment'
const HOLD_DURATION_MS = 10 * 60 * 1000
const SESSION_STORAGE_KEY = 'duongsat.seat-session-id'
const NOTIFICATION_STORAGE_KEY = 'duongsat.notifications'
const REQUEST_STORAGE_KEY = 'duongsat.trip-notifications'
const addOnServices: readonly AddOnService[] = [
  { id: 'vipLounge', label: 'Phòng chờ VIP ga Sài Gòn / Hà Nội', price: 20000 },
  { id: 'meal', label: 'Suất ăn nhẹ trên tàu', price: 35000 },
]
type AddOnId = AddOnService['id']
const totalFallbackSeatCapacity = trainCarriages.reduce((total, carriage) => total + carriage.seatNumbers.length, 0)
function getDistanceInKm(latitude: number, longitude: number, stationLatitude: number, stationLongitude: number) {
  const earthRadiusKm = 6371
  const toRadians = (degrees: number) => degrees * Math.PI / 180
  const latitudeDifference = toRadians(stationLatitude - latitude)
  const longitudeDifference = toRadians(stationLongitude - longitude)
  const haversine = Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(toRadians(latitude)) * Math.cos(toRadians(stationLatitude)) *
    Math.sin(longitudeDifference / 2) ** 2
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

function getOrCreateSessionId() {
  const existingSessionId = localStorage.getItem(SESSION_STORAGE_KEY)
  if (existingSessionId) return existingSessionId

  const sessionId = globalThis.crypto.randomUUID()
  localStorage.setItem(SESSION_STORAGE_KEY, sessionId)
  return sessionId
}

function getDateString(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function readLocalValue<T>(key: string, fallback: T): T {
  try {
    const savedValue = localStorage.getItem(key)
    return savedValue ? JSON.parse(savedValue) as T : fallback
  } catch (error) {
    console.error(`Không thể đọc dữ liệu ${key} trong LocalStorage.`, error)
    return fallback
  }
}

function createFallbackSeats(
  trip: ScheduledTrip,
  carNumber: number,
  availableSeatCount = trip.availableSeats,
  forceUnavailable = false,
): SeatRow[] {
  const carriageId = `T${carNumber}`
  const carriage = trainCarriages.find((item) => item.number === carNumber)
  const fare = trip.seats.find((item) => item.name === carriage?.fareName)
  const random = seededRandom(`${trip.id}|${carriageId}`)
  const seatCapacity = carriage?.seatNumbers.length ?? 0
  const firstSeatIndex = trainCarriages
    .filter((item) => item.number < carNumber)
    .reduce((total, item) => total + item.seatNumbers.length, 0)
  const availableEnd = forceUnavailable ? 0 : availableSeatCount
  const availableCount = forceUnavailable
    ? 0
    : Math.max(0, Math.min(firstSeatIndex + seatCapacity, availableEnd) - firstSeatIndex)
  const heldStart = availableEnd
  const heldEnd = Math.min(totalFallbackSeatCapacity, heldStart + 16)
  const heldCount = Math.max(0, Math.min(firstSeatIndex + seatCapacity, heldEnd) - Math.max(firstSeatIndex, heldStart))
  const statuses: SeatRow['status'][] = [
    ...Array.from({ length: availableCount }, () => 'available' as const),
    ...Array.from({ length: heldCount }, () => 'held' as const),
    ...Array.from({ length: seatCapacity - availableCount - heldCount }, () => 'booked' as const),
  ]

  for (let index = statuses.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const status = statuses[index]
    statuses[index] = statuses[swapIndex]
    statuses[swapIndex] = status
  }

  return statuses.map((status, index) => ({
    id: `fallback:${trip.id}:${carriageId}:${index + 1}`,
    carriage_id: carriageId,
    seat_number: index + 1,
    price: fare?.price ?? trip.minimumPrice,
    status,
    isFallback: true,
  }))
}

export function HomePage() {
  const { user, signOut } = useAuth()
  const [activeView, setActiveView] = useState(() =>
    window.location.hash === '#lich-su' || window.location.hash === '#history'
      ? 'history'
      : window.location.hash === '#huy-ve' ? 'cancel' : 'home',
  )
  const [cancellationBookingCode, setCancellationBookingCode] = useState('')
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [departureDate, setDepartureDate] = useState('')
  const [tripType, setTripType] = useState<'oneWay' | 'roundTrip'>('oneWay')
  const [returnDate, setReturnDate] = useState('')
  const [passengerCounts, setPassengerCounts] = useState<PassengerCounts>({ adult: 1, child: 0, student: 0, senior: 0 })
  const [passengerMenuOpen, setPassengerMenuOpen] = useState(false)
  const [errors, setErrors] = useState<SearchErrors>({})
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedTrip, setSelectedTrip] = useState<ScheduledTrip | null>(null)
  const [selectedCarNumber, setSelectedCarNumber] = useState(1)
  const [selectedPlaces, setSelectedPlaces] = useState<SelectedPlace[]>([])
  const [selectedServices, setSelectedServices] = useState<AddOnId[]>([])
  const [seats, setSeats] = useState<SeatRow[]>([])
  const [tripSeatRows, setTripSeatRows] = useState<Record<string, SeatRow[]>>({})
  const [seatHolds, setSeatHolds] = useState<SeatHold[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [seatLoading, setSeatLoading] = useState(false)
  const [seatError, setSeatError] = useState('')
  const [toast, setToast] = useState<Toast | null>(null)
  const [clockNow, setClockNow] = useState(Date.now())
  const [bookingConfirmed, setBookingConfirmed] = useState(false)
  const [bookingStep, setBookingStep] = useState<BookingStep>('seats')
  const [bookingPassengers, setBookingPassengers] = useState<PassengerDetails[]>([])
  const [bookingRecord, setBookingRecord] = useState<BookingRecord | null>(null)
  const [isBookingSubmitting, setIsBookingSubmitting] = useState(false)
  const [bookingError, setBookingError] = useState('')
  const pendingSeatIds = useRef(new Set<string>())
  const expiringHoldIds = useRef(new Set<string>())
  const seatStatuses = useRef(new Map<string, SeatRow['status']>())
  const seatUpdatesReceived = useRef(new Set<string>())
  const tripNotificationRequestsRef = useRef<TripNotificationRequest[]>([])
  const generatedTripCache = useRef(new Map<string, ScheduledTrip[]>())
  const toastTimeout = useRef<number | null>(null)
  const [nearestStation, setNearestStation] = useState<{ name: string; distanceKm: number } | null>(null)
  const [locationError, setLocationError] = useState('')
  const [isLocating, setIsLocating] = useState(false)
  const [tripNotifications, setTripNotifications] = useState<TripNotification[]>([])
  const [tripNotificationRequests, setTripNotificationRequests] = useState<TripNotificationRequest[]>([])
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false)
  const notificationStorageKey = `${NOTIFICATION_STORAGE_KEY}.${user?.email ?? 'anonymous'}`
  const requestStorageKey = `${REQUEST_STORAGE_KEY}.${user?.email ?? 'anonymous'}`
  const suggestedTrips = nearestStation
    ? trips.filter((trip) => trip.origin === nearestStation.name && trip.availableSeats > 0)
    : []
  const scheduleKey = `${origin}|${destination}|${departureDate}`
  const matchingTrips: ScheduledTrip[] = (() => {
    if (!origin || !destination || !departureDate) return []
    const cachedTrips = generatedTripCache.current.get(scheduleKey)
    if (cachedTrips) return cachedTrips
    const generatedTrips = generateTripsForDate(origin, destination, departureDate)
    generatedTripCache.current.set(scheduleKey, generatedTrips)
    return generatedTrips
  })()
  const getTripSeatRows = (trip: ScheduledTrip) => tripSeatRows[trip.id] ?? trainCarriages.flatMap((car) => createFallbackSeats(trip, car.number))
  const getTripAvailableSeatCount = (trip: ScheduledTrip) =>
    (selectedTrip?.id === trip.id ? seats : getTripSeatRows(trip))
      .filter((seat) => seat.status === 'available').length
  const tripsWithSeatCounts = matchingTrips.map((trip) => ({
    trip,
    availableSeats: getTripAvailableSeatCount(trip),
  }))
  const unavailableTrips = tripsWithSeatCounts
    .filter(({ availableSeats }) => availableSeats === 0)
    .map(({ trip }) => trip)
  const alternativeTrip = matchingTrips
    .filter((trip) => getTripAvailableSeatCount(trip) > 0)
    .sort((first, second) => {
      const getNearestDepartureDifference = (candidate: ScheduledTrip) => {
        if (unavailableTrips.length === 0) return 0
        const candidateMinutes = Number(candidate.departureTime.slice(0, 2)) * 60 + Number(candidate.departureTime.slice(3))
        return Math.min(...unavailableTrips.map((trip) => {
          const unavailableMinutes = Number(trip.departureTime.slice(0, 2)) * 60 + Number(trip.departureTime.slice(3))
          return Math.abs(candidateMinutes - unavailableMinutes)
        }))
      }
      return getNearestDepartureDifference(first) - getNearestDepartureDifference(second)
    })[0]
  const unreadNotificationCount = tripNotifications.filter((notification) => !notification.read).length
  const selectedCar = trainCarriages.find((car) => car.number === selectedCarNumber)!
  const selectedCarriageId = `T${selectedCarNumber}`
  const currentCarSeats = seats
    .filter((seat) => seat.carriage_id === selectedCarriageId)
    .sort((first, second) => first.seat_number - second.seat_number)
  const nextHoldExpiry = seatHolds.reduce<number | null>((earliest, hold) => {
    const expiry = Date.parse(hold.expires_at)
    return earliest === null || expiry < earliest ? expiry : earliest
  }, null)
  const holdCountdown = nextHoldExpiry === null ? null : Math.max(0, Math.ceil((nextHoldExpiry - clockNow) / 1000))
  const displayedCarriages = trainCarriages.map((car) => ({
    ...car,
    availableSeatCount: seats.filter((seat) => seat.carriage_id === `T${car.number}` && seat.status === 'available').length,
  }))
  const passengerTotal = Object.values(passengerCounts).reduce((total, count) => total + count, 0)
  const totalPrice = selectedPlaces.reduce((total, place) => total + place.price, 0) +
    addOnServices.filter((service) => selectedServices.includes(service.id)).reduce((total, service) => total + service.price, 0)
  const seatSearchKey = hasSearched ? `${origin}|${destination}|${departureDate}` : ''

  useEffect(() => {
    const updateView = () => {
      const nextView = window.location.hash === '#lich-su' || window.location.hash === '#history'
        ? 'history'
        : window.location.hash === '#huy-ve' ? 'cancel' : 'home'
      setActiveView(nextView)
      if (nextView !== 'home') window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    window.addEventListener('hashchange', updateView)
    return () => window.removeEventListener('hashchange', updateView)
  }, [])

  useEffect(() => {
    try {
      setSessionId(getOrCreateSessionId())
    } catch (error) {
      setToast({ message: `Không thể khởi tạo phiên giữ chỗ: ${error instanceof Error ? error.message : 'Lỗi không xác định'}`, kind: 'error' })
    }
  }, [])

  useEffect(() => {
    setTripNotifications(readLocalValue<TripNotification[]>(notificationStorageKey, []))
    setTripNotificationRequests(readLocalValue<TripNotificationRequest[]>(requestStorageKey, []))
  }, [notificationStorageKey, requestStorageKey])

  useEffect(() => {
    if (!seatSearchKey || matchingTrips.length === 0) return
    let isActive = true
    const carriageIds = trainCarriages.map((car) => `T${car.number}`)

    async function loadTripSeatRows() {
      try {
        const { data, error } = await supabase
          .from('seats')
          .select('*')
          .in('carriage_id', carriageIds)
        if (!isActive) return

        const remoteSeats = error ? [] : (data ?? []) as SeatRow[]
        const hasTripIdentity = remoteSeats.some((seat) => seat.trip_id || seat.trip_code || seat.trip_date)
        const nextTripRows = Object.fromEntries(matchingTrips.map((trip) => {
          const matchingTripSeats = remoteSeats.filter((seat) => {
            if (seat.trip_id && seat.trip_id !== trip.id) return false
            if (seat.trip_code && seat.trip_code !== trip.code) return false
            if (seat.trip_date && seat.trip_date !== trip.scheduleDate) return false
            return true
          })
          const matchingSeats = hasTripIdentity
            ? matchingTripSeats
            : []
          const allActualSeatsAreUnavailable = matchingSeats.length > 0 &&
            !matchingSeats.some((seat) => seat.status === 'available')
          const rows = trainCarriages.flatMap((car) => {
            const carriageId = `T${car.number}`
            const actualCarSeats = matchingSeats.filter((seat) => seat.carriage_id === carriageId)
            const targetUnavailable = trip.availableSeats === 0 || allActualSeatsAreUnavailable
            if (actualCarSeats.length > 0) {
              return targetUnavailable
                ? actualCarSeats.map((seat) => ({
                  ...seat,
                  status: seat.status === 'held' ? 'held' as const : 'booked' as const,
                }))
                : actualCarSeats
            }
            return createFallbackSeats(
              trip,
              car.number,
              matchingSeats.length > 0 ? 0 : trip.availableSeats,
              targetUnavailable,
            )
          })
          return [trip.id, rows]
        }))
        setTripSeatRows((current) => ({ ...current, ...nextTripRows }))
      } catch {
        if (!isActive) return
        const fallbackRows = Object.fromEntries(matchingTrips.map((trip) => [
          trip.id,
          trainCarriages.flatMap((car) => createFallbackSeats(
            trip,
            car.number,
            trip.availableSeats,
            trip.availableSeats === 0,
          )),
        ]))
        setTripSeatRows((current) => ({ ...current, ...fallbackRows }))
      }
    }

    void loadTripSeatRows()
    return () => {
      isActive = false
    }
  }, [seatSearchKey])

  useEffect(() => {
    if (!selectedTrip || seats.length === 0) return
    setTripSeatRows((current) => current[selectedTrip.id] === seats
      ? current
      : { ...current, [selectedTrip.id]: seats })
  }, [seats, selectedTrip?.id])

  useEffect(() => {
    if (!user?.email) return
    const email = user.email
    let isActive = true

    async function loadNotificationRequests() {
      try {
        const { data, error } = await supabase
          .from('trip_notifications')
          .select('trip_code, trip_date, origin, destination')
          .eq('user_email', email)
        if (error) throw error
        if (!isActive) return

        const remoteRequests: TripNotificationRequest[] = (data ?? []).map((request) => ({
          id: `${email}:${request.trip_code}:${request.trip_date}`,
          tripCode: request.trip_code,
          tripDate: request.trip_date,
          origin: request.origin,
          destination: request.destination,
          userEmail: email,
        }))
        const requestsById = new Map(tripNotificationRequestsRef.current.map((request) => [request.id, request]))
        for (const request of remoteRequests) requestsById.set(request.id, request)
        const mergedRequests = [...requestsById.values()]
        tripNotificationRequestsRef.current = mergedRequests
        setTripNotificationRequests(mergedRequests)
        localStorage.setItem(requestStorageKey, JSON.stringify(mergedRequests))
      } catch {
        if (!isActive) return
        const fallbackRequests = readLocalValue<TripNotificationRequest[]>(requestStorageKey, [])
        tripNotificationRequestsRef.current = fallbackRequests
        setTripNotificationRequests(fallbackRequests)
      }
    }

    void loadNotificationRequests()
    return () => {
      isActive = false
    }
  }, [requestStorageKey, user?.email])

  useEffect(() => {
    tripNotificationRequestsRef.current = tripNotificationRequests
  }, [tripNotificationRequests])

  useEffect(() => {
    if (!user?.email) return
    let isActive = true
    const channel = supabase
      .channel(`seat-availability:${user.email}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'seats' }, (payload) => {
        const changedSeat = payload.new as SeatRow
        if (!changedSeat.id) return
        const previousSeat = payload.old as Partial<SeatRow>
        const previousStatus = previousSeat.status ?? seatStatuses.current.get(changedSeat.id)
        seatStatuses.current.set(changedSeat.id, changedSeat.status)
        seatUpdatesReceived.current.add(changedSeat.id)
        if (previousStatus !== 'held' || changedSeat.status !== 'available') return

        const tripCode = changedSeat.carriage_id?.split('_T')[0]
        if (!tripCode) return
        const matchingRequests = tripNotificationRequestsRef.current.filter((request) =>
          request.userEmail === user.email && request.tripCode === tripCode,
        )
        for (const request of matchingRequests) {
          const notification: TripNotification = {
            id: globalThis.crypto.randomUUID(),
            userEmail: user.email,
            tripCode,
            tripDate: request.tripDate,
            origin: request.origin,
            destination: request.destination,
            message: `🔔 Ghế trống mới! Chuyến ${tripCode} vừa có người hủy giữ chỗ, bấm vào để chọn ghế ngay!`,
            createdAt: new Date().toISOString(),
            read: false,
          }
          setTripNotifications((current) => {
            const updated = [notification, ...current]
            try {
              localStorage.setItem(notificationStorageKey, JSON.stringify(updated))
            } catch (error) {
              console.error('Không thể lưu thông báo vào LocalStorage.', error)
            }
            return updated
          })
          setToast({ message: notification.message, kind: 'success', notification })
        }
      })
      .subscribe((status, error) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setToast({
            message: `Không thể lắng nghe ghế trống Realtime${error?.message ? `: ${error.message}` : '.'}`,
            kind: 'error',
          })
        }
      })

    async function loadSeatStatuses() {
      const { data, error } = await supabase.from('seats').select('id, status')
      if (!isActive) return
      if (error) {
        setToast({ message: `Không thể tải trạng thái ghế để kích hoạt chuông: ${error.message}`, kind: 'error' })
        return
      }
      for (const seat of (data ?? []) as Pick<SeatRow, 'id' | 'status'>[]) {
        if (!seatUpdatesReceived.current.has(seat.id)) seatStatuses.current.set(seat.id, seat.status)
      }
    }

    void loadSeatStatuses()
    return () => {
      isActive = false
      void supabase.removeChannel(channel)
    }
  }, [notificationStorageKey, user?.email])

  useEffect(() => {
    for (const seat of seats) seatStatuses.current.set(seat.id, seat.status)
  }, [seats])

  useEffect(() => {
    if (!toast) return
    if (toastTimeout.current !== null) window.clearTimeout(toastTimeout.current)
    toastTimeout.current = window.setTimeout(() => setToast(null), 5000)
    return () => {
      if (toastTimeout.current !== null) window.clearTimeout(toastTimeout.current)
    }
  }, [toast])

  useEffect(() => {
    if (!selectedTrip || !sessionId) return
    let isActive = true
    const tripForSeatMap = selectedTrip
    const tripCode = tripForSeatMap.code
    const cachedTripSeatRows = tripSeatRows[tripForSeatMap.id]
    const carriageIds = trainCarriages.map((car) => `T${car.number}`)
    const realtimeSeatUpdates = new Map<string, SeatRow | null>()

    async function loadSeatData() {
      setSeatLoading(true)
      setSeatError('')
      setSeats(cachedTripSeatRows ?? [])
      try {
        const [seatResult, holdResult] = await Promise.all([
          supabase.from('seats').select('*').in('carriage_id', carriageIds),
          supabase.from('seat_holds').select('*').eq('session_id', sessionId),
        ])

        if (!isActive) return
        let loadedSeatRows: SeatRow[]
        const loadedSeats = new Map<string, SeatRow>(
          (((seatResult.data ?? []) as SeatRow[])).map((seat) => [seat.id, seat]),
        )
        for (const [seatId, updatedSeat] of realtimeSeatUpdates) {
          if (updatedSeat) loadedSeats.set(seatId, updatedSeat)
          else loadedSeats.delete(seatId)
        }
        const queriedSeatRows = [...loadedSeats.values()]
        const hasTripIdentity = queriedSeatRows.some((seat) => seat.trip_id || seat.trip_code || seat.trip_date)
        const matchingTripSeats = queriedSeatRows.filter((seat) => {
          if (seat.trip_id && seat.trip_id !== tripForSeatMap.id) return false
          if (seat.trip_code && seat.trip_code !== tripCode) return false
          if (seat.trip_date && seat.trip_date !== tripForSeatMap.scheduleDate) return false
          return true
        })
        const matchingSeats = hasTripIdentity ? matchingTripSeats : []
        const allActualSeatsAreUnavailable = matchingSeats.length > 0 &&
          !matchingSeats.some((seat) => seat.status === 'available')
        if (seatResult.error && cachedTripSeatRows) {
          loadedSeatRows = cachedTripSeatRows
        } else if (matchingSeats.length === 0 && cachedTripSeatRows) {
          loadedSeatRows = cachedTripSeatRows
        } else {
          loadedSeatRows = trainCarriages.flatMap((car) => {
            const carriageId = `T${car.number}`
            const carriageSeats = matchingSeats.filter((seat) => seat.carriage_id === carriageId)
            const forceUnavailable = tripForSeatMap.availableSeats === 0 || allActualSeatsAreUnavailable
            if (carriageSeats.length > 0) {
              return forceUnavailable
                ? carriageSeats.map((seat) => ({
                  ...seat,
                  status: seat.status === 'held' ? 'held' as const : 'booked' as const,
                }))
                : carriageSeats
            }
            return createFallbackSeats(
              tripForSeatMap,
              car.number,
              matchingSeats.length > 0 ? 0 : tripForSeatMap.availableSeats,
              forceUnavailable,
            )
          })
        }
        if (seatResult.error) {
          setSeatError(`Không thể tải sơ đồ ghế từ Supabase; đang dùng dữ liệu ghế dự phòng: ${seatResult.error.message}`)
        }
        setSeats(loadedSeatRows)
        setTripSeatRows((current) => ({ ...current, [tripForSeatMap.id]: loadedSeatRows }))
        if (holdResult.error) {
          setSeatError((current) => current || `Không thể tải trạng thái giữ chỗ: ${holdResult.error.message}`)
        } else {
          setSeatHolds((holdResult.data ?? []) as SeatHold[])
          const activeSeatIds = new Set((holdResult.data ?? [])
            .filter((hold) => Date.parse(hold.expires_at) > Date.now())
            .map((hold) => hold.seat_id))
          setSelectedPlaces((current) => {
            const otherCarriagePlaces = current.filter((place) => !carriageIds.includes(`T${place.carNumber}`))
            const restoredPlaces = loadedSeatRows
              .filter((seat) => activeSeatIds.has(seat.id) && seat.status === 'held')
              .map((seat) => ({
                id: seat.id,
                carNumber: Number(seat.carriage_id.match(/T(\d+)$/)?.[1]),
                seatNumber: seat.seat_number,
                price: Number(seat.price),
              }))
            return [...otherCarriagePlaces, ...restoredPlaces]
          })
        }
      } catch (error) {
        if (!isActive) return
        const fallbackRows = cachedTripSeatRows ?? trainCarriages.flatMap((car) =>
          createFallbackSeats(
            tripForSeatMap,
            car.number,
            tripForSeatMap.availableSeats,
            tripForSeatMap.availableSeats === 0,
          ),
        )
        setSeats(fallbackRows)
        setTripSeatRows((current) => ({ ...current, [tripForSeatMap.id]: fallbackRows }))
        setSeatError(`Không thể tải dữ liệu ghế từ Supabase; đang dùng dữ liệu ghế dự phòng: ${error instanceof Error ? error.message : 'Lỗi không xác định'}`)
      } finally {
        if (isActive) setSeatLoading(false)
      }
    }

    const channel = supabase
      .channel(`seats:${sessionId}:${tripCode}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seats' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const deletedSeat = payload.old as Partial<SeatRow>
          if (deletedSeat.id) {
            realtimeSeatUpdates.set(deletedSeat.id, null)
            setSeats((current) => current.filter((seat) => seat.id !== deletedSeat.id))
          }
          return
        }

        const changedSeat = payload.new as SeatRow
        if (!changedSeat.id || !carriageIds.includes(changedSeat.carriage_id)) return
        realtimeSeatUpdates.set(changedSeat.id, changedSeat)
        setSeats((current) => [
          ...current.filter((seat) => seat.id !== changedSeat.id),
          changedSeat,
        ])
      })
      .subscribe((status, error) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setSeatError(`Không thể đồng bộ ghế Realtime${error?.message ? `: ${error.message}` : '.'}`)
        }
      })

    void loadSeatData()

    return () => {
      isActive = false
      void supabase.removeChannel(channel)
    }
  }, [selectedTrip?.id, sessionId])

  useEffect(() => {
    if (!seatHolds.length) return
    const interval = window.setInterval(() => setClockNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [seatHolds.length])

  useEffect(() => {
    const expiredHolds = seatHolds.filter((hold) => Date.parse(hold.expires_at) <= clockNow)
    for (const hold of expiredHolds) {
      if (expiringHoldIds.current.has(hold.id) || !sessionId) continue
      expiringHoldIds.current.add(hold.id)
      void (async () => {
        try {
          if (hold.seat_id.startsWith('fallback:')) {
            setSeats((current) => current.map((seat) =>
              seat.id === hold.seat_id ? { ...seat, status: 'available' } : seat,
            ))
          } else {
            const { error: seatUpdateError } = await supabase
              .from('seats')
              .update({ status: 'available' })
              .eq('id', hold.seat_id)
              .eq('status', 'held')
            if (seatUpdateError) throw seatUpdateError

            const { error: holdDeleteError } = await supabase
              .from('seat_holds')
              .delete()
              .eq('id', hold.id)
              .eq('session_id', sessionId)
            if (holdDeleteError) throw holdDeleteError
          }

          setSeatHolds((current) => current.filter((item) => item.id !== hold.id))
          setSelectedPlaces((current) => current.filter((place) => place.id !== hold.seat_id))
          setToast({ message: '⏱️ Hết thời gian giữ chỗ! Ghế của bạn đã được giải phóng.', kind: 'warning' })
        } catch (error) {
          expiringHoldIds.current.delete(hold.id)
          setToast({ message: `Không thể giải phóng ghế đã hết hạn: ${error instanceof Error ? error.message : 'Lỗi không xác định'}`, kind: 'error' })
        }
      })()
    }
  }, [clockNow, seatHolds, sessionId])

  useEffect(() => {
    if (!selectedTrip) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedTrip(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [selectedTrip])

  function findTripsFromCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationError('Trình duyệt của bạn không hỗ trợ định vị.')
      return
    }

    setIsLocating(true)
    setLocationError('')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const closestStation = stations
          .map((station) => ({
            name: station.name,
            distanceKm: getDistanceInKm(coords.latitude, coords.longitude, station.latitude, station.longitude),
          }))
          .reduce((nearest, station) => station.distanceKm < nearest.distanceKm ? station : nearest)

        setNearestStation(closestStation)
        setOrigin(closestStation.name)
        setDestination('')
        setErrors({})
        setHasSearched(false)
        setIsLocating(false)
      },
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? 'Bạn chưa cấp quyền truy cập vị trí. Hãy cho phép định vị rồi thử lại.'
          : error.code === error.POSITION_UNAVAILABLE
            ? 'Không thể xác định vị trí hiện tại. Vui lòng thử lại sau.'
            : 'Định vị đã hết thời gian chờ. Vui lòng thử lại.'
        setLocationError(message)
        setIsLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  function selectSuggestedTrip(trip: Trip) {
    setOrigin(trip.origin)
    setDestination(trip.destination)
    setErrors({})
    openTripSelection({ ...trip, id: trip.code, scheduleDate: departureDate || getDateString(new Date()) })
  }

  function openTripSelection(trip: ScheduledTrip) {
    setSelectedCarNumber(1)
    setSelectedPlaces([])
    setSelectedServices([])
    setBookingConfirmed(false)
    setBookingStep('seats')
    setBookingPassengers([])
    setBookingRecord(null)
    setIsBookingSubmitting(false)
    setBookingError('')
    setSelectedTrip(trip)
  }

  async function continueToPayment(summary: BookingSummaryResult) {
    if (!selectedTrip || isBookingSubmitting) return

    setIsBookingSubmitting(true)
    setBookingError('')
    try {
      let booking = bookingRecord
      if (!booking) {
        booking = await createBooking({
          bookingCode: `DS${Date.now()}${globalThis.crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          tripId: selectedTrip.id,
          tripCode: selectedTrip.code,
          tripDate: selectedTrip.scheduleDate,
          departureTime: new Date(`${selectedTrip.scheduleDate}T${selectedTrip.departureTime}:00`).toISOString(),
          origin: selectedTrip.origin,
          destination: selectedTrip.destination,
          contactEmail: bookingPassengers[0]?.email ?? '',
          totalAmount: summary.total,
        })
        setBookingRecord(booking)
      }

      const passengersToSave = bookingPassengers.map((passenger) => {
        const seat = selectedPlaces.find((place) => place.id === passenger.seatId)
        if (!seat) throw new Error('Một ghế đã chọn không còn được giữ. Vui lòng kiểm tra lại danh sách hành khách.')
        return {
          ...passenger,
          carNumber: seat.carNumber,
          seatNumber: seat.seatNumber,
          baseFare: seat.price,
        }
      })
      await savePassengers(booking.id, passengersToSave, selectedTrip.scheduleDate)
      setBookingStep('payment')
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : 'Không thể tạo đặt vé. Vui lòng thử lại.')
    } finally {
      setIsBookingSubmitting(false)
    }
  }

  function isNotificationRegistered(trip: ScheduledTrip) {
    return tripNotificationRequests.some((request) =>
      request.userEmail === user?.email &&
      request.tripCode === trip.code &&
      request.tripDate === trip.scheduleDate,
    )
  }

  async function registerForSeatNotification(trip: ScheduledTrip) {
    if (!user?.email || isNotificationRegistered(trip)) return
    const request: TripNotificationRequest = {
      id: `${user.email}:${trip.code}:${trip.scheduleDate}`,
      tripCode: trip.code,
      tripDate: trip.scheduleDate,
      origin: trip.origin,
      destination: trip.destination,
      userEmail: user.email,
    }
    const updatedRequests = [...tripNotificationRequests, request]
    try {
      localStorage.setItem(requestStorageKey, JSON.stringify(updatedRequests))
    } catch (error) {
      setToast({
        message: `Không thể lưu yêu cầu báo chỗ trên thiết bị: ${error instanceof Error ? error.message : 'Lỗi không xác định'}`,
        kind: 'error',
      })
      return
    }
    tripNotificationRequestsRef.current = updatedRequests
    setTripNotificationRequests(updatedRequests)

    try {
      const { error } = await supabase.from('trip_notifications').insert({
        user_email: user.email,
        trip_code: trip.code,
        trip_date: trip.scheduleDate,
        origin: trip.origin,
        destination: trip.destination,
      })
      if (!error) setToast({ message: 'Đã đăng ký báo chỗ cho chuyến tàu này.', kind: 'success' })
    } catch {
      // The request was saved locally before the remote insert was attempted.
    }
  }

  function openTripNotification(notification: TripNotification) {
    const trip = generateTripsForDate(notification.origin, notification.destination, notification.tripDate)
      .find((item) => item.code === notification.tripCode)
    if (!trip) return
    const updatedNotifications = tripNotifications.map((item) =>
      item.id === notification.id ? { ...item, read: true } : item,
    )
    try {
      localStorage.setItem(notificationStorageKey, JSON.stringify(updatedNotifications))
    } catch (error) {
      setToast({
        message: `Không thể cập nhật trạng thái thông báo: ${error instanceof Error ? error.message : 'Lỗi không xác định'}`,
        kind: 'error',
      })
      return
    }
    setTripNotifications(updatedNotifications)
    setOrigin(notification.origin)
    setDestination(notification.destination)
    setDepartureDate(notification.tripDate)
    setHasSearched(true)
    setNotificationMenuOpen(false)
    setToast(null)
    openTripSelection(trip)
  }

  async function toggleSeat(carNumber: number, seat: SeatRow) {
    if (!sessionId || pendingSeatIds.current.has(seat.id)) return
    pendingSeatIds.current.add(seat.id)
    setBookingConfirmed(false)

    try {
      const ownHold = seatHolds.find((hold) => hold.seat_id === seat.id && hold.session_id === sessionId)
      if (seat.isFallback) {
        if (ownHold) {
          setSeats((current) => current.map((item) =>
            item.id === seat.id ? { ...item, status: 'available' } : item,
          ))
          setSeatHolds((current) => current.filter((hold) => hold.id !== ownHold.id))
          setSelectedPlaces((current) => current.filter((place) => place.id !== seat.id))
          return
        }
        if (seat.status !== 'available') return

        const fallbackHold: SeatHold = {
          id: globalThis.crypto.randomUUID(),
          seat_id: seat.id,
          session_id: sessionId,
          expires_at: new Date(Date.now() + HOLD_DURATION_MS).toISOString(),
        }
        setSeats((current) => current.map((item) =>
          item.id === seat.id ? { ...item, status: 'held' } : item,
        ))
        setSeatHolds((current) => [...current, fallbackHold])
        setSelectedPlaces((current) => [...current, {
          id: seat.id,
          carNumber,
          seatNumber: seat.seat_number,
          price: Number(seat.price),
        }])
        return
      }
      if (ownHold) {
        const { error: releaseError } = await supabase
          .from('seats')
          .update({ status: 'available' })
          .eq('id', seat.id)
          .eq('status', 'held')
        if (releaseError) throw releaseError

        const { error: holdDeleteError } = await supabase
          .from('seat_holds')
          .delete()
          .eq('id', ownHold.id)
          .eq('session_id', sessionId)
        if (holdDeleteError) throw holdDeleteError

        setSeatHolds((current) => current.filter((hold) => hold.id !== ownHold.id))
        setSelectedPlaces((current) => current.filter((place) => place.id !== seat.id))
        return
      }

      if (seat.status !== 'available') return
      const { data: updatedSeats, error: updateError } = await supabase
        .from('seats')
        .update({ status: 'held' })
        .eq('id', seat.id)
        .eq('status', 'available')
        .select('id')

      if (updateError) throw updateError
      if (!updatedSeats?.length) {
        setToast({ message: `⚠️ Rất tiếc, ghế ${seat.seat_number} vừa được hành khách khác nhanh tay giữ!`, kind: 'error' })
        return
      }

      const expiresAt = new Date(Date.now() + HOLD_DURATION_MS).toISOString()
      const holdRecord: SeatHold = {
        id: globalThis.crypto.randomUUID(),
        seat_id: seat.id,
        session_id: sessionId,
        expires_at: expiresAt,
      }
      const { error: holdInsertError } = await supabase.from('seat_holds').insert(holdRecord)

      if (holdInsertError) {
        const { error: rollbackError } = await supabase
          .from('seats')
          .update({ status: 'available' })
          .eq('id', seat.id)
          .eq('status', 'held')
        if (rollbackError) {
          throw new Error(`Không thể tạo giữ chỗ (${holdInsertError.message}) hoặc hoàn tác trạng thái ghế (${rollbackError.message}).`)
        }
        throw holdInsertError
      }

      setSeatHolds((current) => [...current.filter((hold) => hold.id !== holdRecord.id), holdRecord])
      setSelectedPlaces((current) => [...current, {
        id: seat.id,
        carNumber,
        seatNumber: seat.seat_number,
        price: Number(seat.price),
      }])
    } catch (error) {
      setToast({ message: `Không thể giữ ghế ${seat.seat_number}: ${error instanceof Error ? error.message : 'Lỗi không xác định'}`, kind: 'error' })
    } finally {
      pendingSeatIds.current.delete(seat.id)
    }
  }

  function toggleService(serviceId: AddOnId) {
    setSelectedServices((current) => current.includes(serviceId)
      ? current.filter((id) => id !== serviceId)
      : [...current, serviceId])
    setBookingConfirmed(false)
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: SearchErrors = {}
    if (!origin) nextErrors.origin = 'Vui lòng chọn ga đi.'
    if (!destination) nextErrors.destination = 'Vui lòng chọn ga đến.'
    if (!departureDate) nextErrors.date = 'Vui lòng chọn ngày khởi hành.'
    else if (origin && origin === destination) nextErrors.destination = 'Ga đến phải khác ga đi.'
    if (tripType === 'roundTrip') {
      if (!returnDate) nextErrors.returnDate = 'Vui lòng chọn ngày về.'
      else if (departureDate && returnDate < departureDate) nextErrors.returnDate = 'Ngày về không thể trước ngày đi.'
    }
    setErrors(nextErrors)
    setHasSearched(Object.keys(nextErrors).length === 0)
  }

  function swapStations() {
    setOrigin(destination)
    setDestination(origin)
    setErrors({})
    setHasSearched(false)
  }

  return (
    <main className="home-page">
      <header className="home-header">
        <a className="brand" href="#home">
          <span className="brand-mark"><TrainFront size={20} /></span>
          <span>đường sắt<span className="brand-dot">.</span></span>
        </a>
        <nav className="home-nav" aria-label="Điều hướng chính">
          <a className={activeView === 'home' ? 'nav-active' : undefined} aria-current={activeView === 'home' ? 'page' : undefined} href="#dat-ve">Vé tàu</a>
          <a className={activeView === 'history' ? 'nav-active' : undefined} aria-current={activeView === 'history' ? 'page' : undefined} href="#lich-su">Lịch sử đặt vé</a>
          <a className={activeView === 'cancel' ? 'nav-active' : undefined} aria-current={activeView === 'cancel' ? 'page' : undefined} href="#huy-ve">Hủy vé trực tuyến</a>
        </nav>
        <div className="notification-center">
          <button
            className={`notification-bell${notificationMenuOpen ? ' notification-bell-active' : ''}`}
            type="button"
            aria-label={`Thông báo${unreadNotificationCount ? `, ${unreadNotificationCount} chưa đọc` : ''}`}
            aria-expanded={notificationMenuOpen}
            aria-controls="notification-menu"
            onClick={() => setNotificationMenuOpen((open) => !open)}
          >
            {unreadNotificationCount > 0 ? <BellRing size={19} /> : <Bell size={19} />}
            {unreadNotificationCount > 0 && <span className="notification-badge">{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</span>}
          </button>
          {notificationMenuOpen && (
            <div className="notification-menu" id="notification-menu">
              <div className="notification-menu-heading">
                <strong>Thông báo</strong>
                {unreadNotificationCount > 0 && <span>{unreadNotificationCount} chưa đọc</span>}
              </div>
              {tripNotifications.length > 0 ? tripNotifications.map((notification) => (
                <button
                  className={`notification-item${notification.read ? '' : ' notification-item-unread'}`}
                  type="button"
                  key={notification.id}
                  onClick={() => openTripNotification(notification)}
                >
                  <span className="notification-item-icon"><Bell size={15} /></span>
                  <span className="notification-item-copy">
                    <strong>{notification.message}</strong>
                    <small>{notification.origin} → {notification.destination} · {formatDate(notification.tripDate)}</small>
                  </span>
                  {!notification.read && <i aria-label="Chưa đọc" />}
                </button>
              )) : (
                <p className="notification-empty">Chưa có thông báo mới.</p>
              )}
            </div>
          )}
        </div>
        <div className="account-menu">
          <span className="account-avatar">{user?.displayName.slice(0, 1).toLocaleUpperCase('vi')}</span>
          <span className="account-copy"><strong>{user?.displayName}</strong><small>{user?.email}</small></span>
          <button className="icon-button" type="button" onClick={signOut} aria-label="Đăng xuất" title="Đăng xuất">
            <LogOut size={18} />
          </button>
        </div>
      </header>
      {activeView === 'history' ? (
        <BookingHistory onCancelBooking={(bookingCode) => {
          setCancellationBookingCode(bookingCode)
          window.location.hash = '#huy-ve'
        }} />
      ) : activeView === 'cancel' ? (
        <TicketCancelForm
          initialBookingCode={cancellationBookingCode}
          onInitialBookingCodeConsumed={() => setCancellationBookingCode('')}
          onNavigateToHistory={() => { window.location.hash = '#lich-su' }}
        />
      ) : <>
      <section className="home-hero">
        <div className="home-hero-content">
          <span className="eyebrow">Xin chào, {user?.displayName}</span>
          <h1>Đi xa hơn,<br />thảnh thơi hơn.</h1>
          <p>Chuyến tàu tiếp theo của bạn bắt đầu từ đây.</p>
        </div>
        <div className="home-hero-stamp"><TrainFront size={34} /><span>ĐƯỜNG SẮT<br />VIỆT NAM</span></div>
      </section>
      <section className="search-section" id="dat-ve">
        <div className="section-title">
            <div><span className="eyebrow">Tìm chuyến tàu</span><h2>Lên kế hoạch chuyến đi</h2></div>
            <span className="section-note">Chọn hành trình phù hợp với bạn</span>
        </div>
        <SearchTrainForm
          origin={origin}
          destination={destination}
          departureDate={departureDate}
          tripType={tripType}
          returnDate={returnDate}
          passengerCounts={passengerCounts}
          passengerTotal={passengerTotal}
          passengerMenuOpen={passengerMenuOpen}
          errors={errors}
          nearestStation={nearestStation}
          suggestedTrips={suggestedTrips}
          locationError={locationError}
          isLocating={isLocating}
          onOriginChange={setOrigin}
          onDestinationChange={setDestination}
          onDepartureDateChange={setDepartureDate}
          onTripTypeChange={setTripType}
          onReturnDateChange={setReturnDate}
          onPassengerCountChange={(type, count) => setPassengerCounts((current) => ({ ...current, [type]: count }))}
          onPassengerMenuToggle={() => setPassengerMenuOpen((open) => !open)}
          onSearch={handleSearch}
          onSwapStations={swapStations}
          onLocate={findTripsFromCurrentLocation}
          onSuggestedTrip={selectSuggestedTrip}
        />
          <TrainList
            visible={hasSearched}
            origin={origin}
            destination={destination}
            departureDate={departureDate}
            tripType={tripType}
            returnDate={returnDate}
            trips={tripsWithSeatCounts.map(({ trip, availableSeats }) => ({ trip, availableSeatCount: availableSeats }))}
            unavailableTripCount={unavailableTrips.length}
            alternativeTrip={alternativeTrip}
            isNotificationRegistered={isNotificationRegistered}
            onSelectTrip={openTripSelection}
            onRegisterNotification={(trip) => { void registerForSeatNotification(trip) }}
          />
      </section>
        {selectedTrip && (
          <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedTrip(null) }}>
            <section className="trip-modal flex flex-col" role="dialog" aria-modal="true" aria-labelledby="trip-modal-title">
              <header className="modal-header">
                <div><span className="eyebrow">{bookingStep === 'seats' ? 'Chọn chỗ' : bookingStep === 'passengers' ? 'Bước 1 · Thông tin hành khách' : 'Bước 2 · Tóm tắt & thanh toán'} · {selectedTrip.code}</span><h2 id="trip-modal-title">{origin} đến {destination}</h2><p>{selectedTrip.departureTime} · {departureDate ? formatDate(departureDate) : 'Tàu Thống Nhất'}</p></div>
                {holdCountdown !== null && <span className="hold-countdown" role="timer" aria-label={`Thời gian giữ chỗ còn ${Math.floor(holdCountdown / 60)} phút ${holdCountdown % 60} giây`}><Clock3 size={16} />{String(Math.floor(holdCountdown / 60)).padStart(2, '0')}:{String(holdCountdown % 60).padStart(2, '0')}</span>}
                <button className="modal-close" type="button" onClick={() => setSelectedTrip(null)} aria-label="Đóng chi tiết"><X size={20} /></button>
              </header>
              {bookingStep === 'seats' && (
                <TrainCarriageBar cars={displayedCarriages} selectedCarNumber={selectedCarNumber} trainCode={selectedTrip.code} onSelectCar={(carNumber) => {
                  setSelectedCarNumber(carNumber)
                  setBookingConfirmed(false)
                }} />
              )}
              {bookingStep === 'seats' && (
                <SeatMap
                  car={selectedCar}
                  seats={currentCarSeats}
                  selectedPlaces={selectedPlaces}
                  seatHolds={seatHolds}
                  sessionId={sessionId}
                  seatLoading={seatLoading}
                  seatError={seatError}
                  selectedServices={selectedServices}
                  addOnServices={addOnServices}
                  onToggleSeat={(carNumber, seat) => { void toggleSeat(carNumber, seat) }}
                  onToggleService={toggleService}
                />
              )}
              {bookingStep === 'seats' && <footer className="modal-footer">
                <div className="total-copy"><small><strong>Đang xem {selectedCar.title}</strong> · {selectedPlaces.length > 0 ? selectedPlaces.map((place) => `${trainCarriages[place.carNumber - 1].title} · ${place.seatNumber}`).join(', ') : 'Chưa chọn chỗ'} · dịch vụ {selectedServices.length} mục</small><strong>{formatPrice(totalPrice)} đ</strong>{bookingConfirmed && <p className="confirmation-message" role="status">Đã xác nhận lựa chọn chỗ ngồi.</p>}</div>
                <div className="confirm-action">
                  {(selectedPlaces.length === 0 || totalPrice === 0) && <small className="seat-selection-reminder" role="status">⚠️ Vui lòng chọn ít nhất 1 chỗ để tiếp tục</small>}
                  <button className={`confirm-seat-button${bookingConfirmed ? ' confirm-seat-button-confirmed' : ''}`} type="button" disabled={selectedPlaces.length === 0 || totalPrice === 0} onClick={() => {
                    setBookingConfirmed(true)
                    setBookingStep('passengers')
                  }}>
                    <Check size={16} />{bookingConfirmed ? 'Đã xác nhận đặt vé' : 'Xác nhận đặt vé'}
                  </button>
                </div>
              </footer>}
              {bookingStep !== 'seats' && (
                <div className="modal-content flex-1">
                  {bookingStep === 'passengers' && (
                    <PassengerForm
                      seats={selectedPlaces.map((place) => ({
                        ...place,
                        carriageTitle: trainCarriages.find((carriage) => carriage.number === place.carNumber)?.title,
                      }))}
                      departureDate={selectedTrip.scheduleDate}
                      onContinue={(passengers) => {
                        setBookingPassengers(passengers)
                        setBookingError('')
                        setBookingStep('summary')
                      }}
                    />
                  )}
                  {(bookingStep === 'summary' || bookingStep === 'payment') && (
                    <>
                      <BookingSummary
                        seats={selectedPlaces.map((place) => ({
                          ...place,
                          carriageTitle: trainCarriages.find((carriage) => carriage.number === place.carNumber)?.title,
                        }))}
                        passengers={bookingPassengers}
                        addOns={addOnServices
                          .filter((service) => selectedServices.includes(service.id))
                          .map(({ label, price }) => ({ label, price }))}
                        showContinue={bookingStep === 'summary'}
                        isSubmitting={isBookingSubmitting}
                        onContinue={(summary) => void continueToPayment(summary)}
                      />
                      {bookingError && (
                        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
                          {bookingError}
                        </p>
                      )}
                      {bookingStep === 'payment' && bookingRecord && (
                        <PaymentPage
                          bookingId={bookingRecord.id}
                          bookingCode={bookingRecord.booking_code}
                          totalAmount={bookingRecord.total_amount}
                          bankConfig={defaultVietQrBankConfig}
                          tripDetails={{
                            tripCode: selectedTrip?.code ?? '',
                            origin: selectedTrip?.origin ?? '',
                            destination: selectedTrip?.destination ?? '',
                            departureDate: selectedTrip?.scheduleDate ?? '',
                            departureTime: selectedTrip
                              ? new Date(`${selectedTrip.scheduleDate}T${selectedTrip.departureTime}:00`).toISOString()
                              : null,
                            seats: selectedPlaces.map((place) =>
                              `Toa ${place.carNumber} · Ghế ${place.seatNumber}`,
                            ),
                          }}
                          onNavigateToHistory={() => {
                            setSelectedTrip(null)
                            window.location.hash = '#lich-su'
                          }}
                          onNavigateHome={() => {
                            setSelectedTrip(null)
                            window.location.hash = ''
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          }}
                        />
                      )}
                    </>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
        {toast && (
          toast.notification
            ? <button className={`seat-toast seat-toast-${toast.kind} seat-toast-action`} type="button" onClick={() => {
              if (toast.notification) openTripNotification(toast.notification)
            }}>{toast.message}</button>
            : <div className={`seat-toast seat-toast-${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}>{toast.message}</div>
        )}
      </>}
    </main>
  )
}