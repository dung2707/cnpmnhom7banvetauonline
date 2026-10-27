import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeftRight, Bell, BellRing, CalendarDays, Check, ChevronDown, Clock3, LogOut, MapPin, TrainFront, Users, Utensils, X } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import trips from '../data/trips.json'
import { supabase } from '../lib/supabase'
import { TrainCarriageBar } from './TrainCarriageBar'
import { trainCarriages } from '../data/trainCarriages'

type Trip = (typeof trips)[number]
type ScheduledTrip = Trip & { id: string; scheduleDate: string }
type SearchErrors = { origin?: string; destination?: string; date?: string; returnDate?: string }
type SelectedPlace = { id: string; carNumber: number; seatNumber: number; price: number }
type SeatRow = {
  id: string
  carriage_id: string
  seat_number: number
  price: number
  status: 'available' | 'held' | 'booked'
  isFallback?: boolean
  trip_code?: string
  trip_id?: string
  trip_date?: string
}
type SeatHold = { id: string; seat_id: string; session_id: string; expires_at: string }
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
type PassengerType = 'adult' | 'child' | 'student' | 'senior'
type PassengerCounts = Record<PassengerType, number>
const HOLD_DURATION_MS = 10 * 60 * 1000
const SESSION_STORAGE_KEY = 'duongsat.seat-session-id'
const NOTIFICATION_STORAGE_KEY = 'duongsat.notifications'
const REQUEST_STORAGE_KEY = 'duongsat.trip-notifications'
const passengerTypes: { id: PassengerType; label: string; note: string; minimum: number }[] = [
  { id: 'adult', label: 'Người lớn', note: 'Từ 12 tuổi', minimum: 1 },
  { id: 'child', label: 'Trẻ em', note: 'Giảm vé', minimum: 0 },
  { id: 'student', label: 'Sinh viên', note: 'Giảm vé', minimum: 0 },
  { id: 'senior', label: 'Người cao tuổi', note: 'Giảm vé', minimum: 0 },
]
const addOnServices = [
  { id: 'vipLounge', label: 'Phòng chờ VIP ga Sài Gòn / Hà Nội', price: 20000 },
  { id: 'meal', label: 'Suất ăn nhẹ trên tàu', price: 35000 },
] as const
type AddOnId = (typeof addOnServices)[number]['id']

const stations = [
  { name: 'Hà Nội', latitude: 21.0245, longitude: 105.8412 },
  { name: 'Nam Định', latitude: 20.4286, longitude: 106.1683 },
  { name: 'Vinh', latitude: 18.6796, longitude: 105.6813 },
  { name: 'Huế', latitude: 16.4637, longitude: 107.5909 },
  { name: 'Đà Nẵng', latitude: 16.068, longitude: 108.212 },
  { name: 'Nha Trang', latitude: 12.2486, longitude: 109.1848 },
  { name: 'Sài Gòn', latitude: 10.7811, longitude: 106.6782 },
]

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

function formatDate(date: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`))
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours} giờ${remainingMinutes ? ` ${remainingMinutes} phút` : ''}`
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('vi-VN').format(price)
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

function seededRandom(seed: string) {
  let value = 2166136261
  for (const character of seed) {
    value ^= character.charCodeAt(0)
    value = Math.imul(value, 16777619)
  }
  return () => {
    value += 0x6d2b79f5
    let next = value
    next = Math.imul(next ^ (next >>> 15), next | 1)
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61)
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296
  }
}

function generateTripsForDate(origin: string, destination: string, date: string): ScheduledTrip[] {
  const generationId = globalThis.crypto.randomUUID()
  const random = seededRandom(`${origin}|${destination}|${date}|${generationId}`)
  const originIndex = stations.findIndex((station) => station.name === origin)
  const destinationIndex = stations.findIndex((station) => station.name === destination)
  const routeStations = stations
    .slice(Math.min(originIndex, destinationIndex), Math.max(originIndex, destinationIndex) + 1)
    .map((station) => station.name)
  if (originIndex > destinationIndex) routeStations.reverse()

  const generatedTemplates = [...trips]
    .sort(() => random() - 0.5)
    .slice(0, 4)
  const fullTripIndex = Math.floor(random() * generatedTemplates.length)
  const generatedSeatCounts = new Set<number>([0])

  return generatedTemplates.map((template, index) => {
      const departureMinutes = Math.floor(random() * 24 * 60)
      const durationMinutes = Math.max(120, Math.round(template.durationMinutes * (0.8 + random() * 0.4)))
      const arrivalMinutes = departureMinutes + durationMinutes
      const departureTime = `${String(Math.floor(departureMinutes / 60)).padStart(2, '0')}:${String(departureMinutes % 60).padStart(2, '0')}`
      const arrivalTime = `${String(Math.floor(arrivalMinutes / 60) % 24).padStart(2, '0')}:${String(arrivalMinutes % 60).padStart(2, '0')}`
      const minimumPrice = Math.round(template.minimumPrice * (0.85 + random() * 0.3) / 1000) * 1000
      const maximumPrice = Math.max(minimumPrice, Math.round(template.maximumPrice * (0.85 + random() * 0.3) / 1000) * 1000)
      let availableSeats = 0
      if (index !== fullTripIndex) {
        do {
          availableSeats = 5 + Math.floor(random() * 176)
        } while (generatedSeatCounts.has(availableSeats))
        generatedSeatCounts.add(availableSeats)
      }
      const routeSuffix = `${originIndex + 1}${destinationIndex + 1}`
      return {
        ...template,
        id: `${template.code}-${routeSuffix}-${date}-${generationId}`,
        code: `${template.code}-${routeSuffix}`,
        origin,
        destination,
        departureTime,
        arrivalTime,
        arrivalDayOffset: Math.floor(arrivalMinutes / (24 * 60)),
        durationMinutes,
        minimumPrice,
        maximumPrice,
        availableSeats,
        stops: routeStations.map((station, index) => ({
          station,
          time: index === 0 ? departureTime : index === routeStations.length - 1 ? arrivalTime : departureTime,
        })),
        scheduleDate: date,
      }
    })
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
  const firstSeatIndex = (carNumber - 1) * 32
  const availableEnd = forceUnavailable ? 0 : availableSeatCount
  const availableCount = forceUnavailable
    ? 0
    : Math.max(0, Math.min(firstSeatIndex + 32, availableEnd) - firstSeatIndex)
  const heldStart = availableEnd
  const heldEnd = Math.min(320, heldStart + 16)
  const heldCount = Math.max(0, Math.min(firstSeatIndex + 32, heldEnd) - Math.max(firstSeatIndex, heldStart))
  const statuses: SeatRow['status'][] = [
    ...Array.from({ length: availableCount }, () => 'available' as const),
    ...Array.from({ length: heldCount }, () => 'held' as const),
    ...Array.from({ length: 32 - availableCount - heldCount }, () => 'booked' as const),
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
        if (!isActive || error) return

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
        // Keep locally saved requests when Supabase is unavailable or its schema differs.
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
    setSelectedTrip(trip)
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
          <a className="nav-active" href="#dat-ve">Vé tàu</a>
          <a href="#lich-su">Lịch sử đặt vé</a>
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
          <form className="trip-search" onSubmit={handleSearch} noValidate>
            <div className="trip-type-toggle" role="group" aria-label="Loại vé">
              <button className={tripType === 'oneWay' ? 'trip-type-active' : ''} type="button" aria-pressed={tripType === 'oneWay'} onClick={() => setTripType('oneWay')}>Một chiều</button>
              <button className={tripType === 'roundTrip' ? 'trip-type-active' : ''} type="button" aria-pressed={tripType === 'roundTrip'} onClick={() => setTripType('roundTrip')}>Khứ hồi</button>
            </div>
            <label className={`search-field${errors.origin ? ' search-field-error' : ''}`}>
              <span>Ga đi</span>
              <span className="search-control"><MapPin size={17} />
                <select aria-label="Ga đi" value={origin} onChange={(event) => setOrigin(event.target.value)}>
                  <option value="">Chọn ga khởi hành</option>
                  {stations.map((station) => <option key={station.name} value={station.name}>{station.name}</option>)}
                </select>
              </span>
              {errors.origin && <small className="search-error">{errors.origin}</small>}
            </label>
            <button className="swap-button" type="button" onClick={swapStations} aria-label="Đảo chiều ga đi và ga đến" title="Đảo chiều ga">
              <ArrowLeftRight size={17} />
            </button>
            <label className={`search-field${errors.destination ? ' search-field-error' : ''}`}>
              <span>Ga đến</span>
              <span className="search-control"><MapPin size={17} />
                <select aria-label="Ga đến" value={destination} onChange={(event) => setDestination(event.target.value)}>
                  <option value="">Chọn ga đến</option>
                  {stations.map((station) => <option key={station.name} value={station.name}>{station.name}</option>)}
                </select>
              </span>
              {errors.destination && <small className="search-error">{errors.destination}</small>}
            </label>
            <label className={`search-field departure-date-field${errors.date ? ' search-field-error' : ''}`}>
              <span>Ngày khởi hành</span>
              <span className="search-control"><CalendarDays size={17} />
                <input aria-label="Ngày khởi hành" type="date" value={departureDate} onChange={(event) => setDepartureDate(event.target.value)} />
              </span>
              {errors.date && <small className="search-error">{errors.date}</small>}
            </label>
            {tripType === 'roundTrip' && (
              <label className={`search-field return-date-field${errors.returnDate ? ' search-field-error' : ''}`}>
                <span>Ngày về</span>
                <span className="search-control"><CalendarDays size={17} />
                  <input aria-label="Ngày về" type="date" min={departureDate || undefined} value={returnDate} onChange={(event) => setReturnDate(event.target.value)} />
                </span>
                {errors.returnDate && <small className="search-error">{errors.returnDate}</small>}
              </label>
            )}
            <div className="search-field passenger-field">
              <span>Hành khách</span>
              <div className="passenger-control">
                <Users size={17} aria-hidden="true" />
                <button className="passenger-trigger" type="button" aria-expanded={passengerMenuOpen} aria-controls="passenger-menu" onClick={() => setPassengerMenuOpen((open) => !open)}>
                  {passengerTotal} hành khách <ChevronDown size={15} aria-hidden="true" />
                </button>
                {passengerMenuOpen && (
                  <div className="passenger-menu" id="passenger-menu">
                    {passengerTypes.map((passenger) => (
                      <label className="passenger-option" key={passenger.id}>
                        <span><strong>{passenger.label}</strong><small>{passenger.note}</small></span>
                        <select aria-label={passenger.label} value={passengerCounts[passenger.id]} onChange={(event) => setPassengerCounts((current) => ({ ...current, [passenger.id]: Number(event.target.value) }))}>
                          {Array.from({ length: 9 - passenger.minimum }, (_, index) => index + passenger.minimum).map((count) => <option value={count} key={count}>{count}</option>)}
                        </select>
                      </label>
                    ))}
                    <button className="passenger-done" type="button" onClick={() => setPassengerMenuOpen(false)}>Xong</button>
                  </div>
                )}
              </div>
            </div>
            <button className="submit-button search-button" type="submit">Tìm chuyến</button>
        </form>
          <div className="location-search">
            <button className="location-button" type="button" onClick={findTripsFromCurrentLocation} disabled={isLocating}>
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
                      <button className="details-button" type="button" onClick={() => selectSuggestedTrip(trip)}>Chọn chuyến này</button>
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
          {hasSearched && (
            <section className="search-results" aria-live="polite" aria-label="Kết quả tìm kiếm">
              <div className="results-heading">
                <div><span className="eyebrow">Hành trình của bạn</span><h3>{origin} <span>→</span> {destination}</h3></div>
                <p>{formatDate(departureDate)}{tripType === 'roundTrip' && returnDate ? ` · Về ${formatDate(returnDate)}` : ''}</p>
              </div>
              {matchingTrips.length > 0 ? (
                <div className="trip-list">
                {matchingTrips.map((trip) => {
                  const availableSeatCount = getTripAvailableSeatCount(trip)
                  return <article className="trip-card" key={trip.id}>
                    <div className="trip-code"><span className="trip-icon"><TrainFront size={19} /></span><div><strong>{trip.code}</strong><small>Tàu Thống Nhất</small></div></div>
                    <div className="trip-times"><strong>{trip.departureTime}</strong><span className="trip-track"><i /></span><strong>{trip.arrivalTime}<small>{trip.arrivalDayOffset ? '+1 ngày' : ''}</small></strong></div>
                    <div className="trip-meta"><span><Clock3 size={14} />{formatDuration(trip.durationMinutes)}</span><span className="trip-price">{formatPrice(trip.minimumPrice)} – {formatPrice(trip.maximumPrice)} đ</span></div>
                    <div className={`trip-availability${availableSeatCount === 0 ? ' trip-availability-full' : ''}`}><span className="availability-dot" />{availableSeatCount > 0 ? `Còn ${availableSeatCount} chỗ` : 'Hết chỗ (0)'}</div>
                    <div className="trip-card-actions">
                      <button className="details-button" type="button" onClick={() => openTripSelection(trip)}>Xem chi tiết</button>
                      {availableSeatCount === 0 && (
                        <button
                          className={`notify-seat-button${isNotificationRegistered(trip) ? ' notify-seat-registered' : ''}`}
                            type="button"
                            disabled={isNotificationRegistered(trip)}
                            onClick={() => { void registerForSeatNotification(trip) }}
                          >
                            <Bell size={15} />{isNotificationRegistered(trip) ? 'Đã đăng ký báo chỗ' : 'Báo tôi khi có chỗ'}
                          </button>
                        )}
                      </div>
                    </article>
                  })}
                  {unavailableTrips.length > 0 && alternativeTrip && (
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
          )}
      </section>
        {selectedTrip && (
          <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedTrip(null) }}>
            <section className="trip-modal flex flex-col" role="dialog" aria-modal="true" aria-labelledby="trip-modal-title">
              <header className="modal-header">
                <div><span className="eyebrow">Chọn chỗ · {selectedTrip.code}</span><h2 id="trip-modal-title">{origin} đến {destination}</h2><p>{selectedTrip.departureTime} · {departureDate ? formatDate(departureDate) : 'Tàu Thống Nhất'}</p></div>
                {holdCountdown !== null && <span className="hold-countdown" role="timer" aria-label={`Thời gian giữ chỗ còn ${Math.floor(holdCountdown / 60)} phút ${holdCountdown % 60} giây`}><Clock3 size={16} />{String(Math.floor(holdCountdown / 60)).padStart(2, '0')}:{String(holdCountdown % 60).padStart(2, '0')}</span>}
                <button className="modal-close" type="button" onClick={() => setSelectedTrip(null)} aria-label="Đóng chi tiết"><X size={20} /></button>
              </header>
              <TrainCarriageBar cars={displayedCarriages} selectedCarNumber={selectedCarNumber} trainCode={selectedTrip.code} onSelectCar={(carNumber) => {
                setSelectedCarNumber(carNumber)
                setBookingConfirmed(false)
              }} />
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
                {(() => {
                  const car = selectedCar
                  const tiers = car.type === 'berth4' ? 2 : 3
                  const seatsPerCompartment = tiers * 2
                  const seatRows = currentCarSeats
                  const renderSeat = (seat: SeatRow) => {
                    const isSelected = selectedPlaces.some((place) => place.id === seat.id)
                    const ownHold = seatHolds.some((hold) => hold.seat_id === seat.id && hold.session_id === sessionId)
                    const isHeldElsewhere = seat.status === 'held' && !ownHold
                    const isUnavailable = seat.status === 'booked' || isHeldElsewhere
                    return (
                      <button className={`seat-tile${isSelected ? ' seat-tile-selected' : ''}${seat.status === 'booked' ? ' seat-tile-sold' : ''}${isHeldElsewhere ? ' seat-tile-held' : ''}`} type="button" key={seat.id} disabled={isUnavailable || seatLoading} aria-pressed={isSelected} aria-label={`${car.type === 'seat' ? 'Ghế' : 'Giường'} ${seat.seat_number}, ${isSelected ? 'đang được bạn giữ' : seat.status === 'available' ? 'còn trống' : seat.status === 'held' ? 'đang được giữ' : 'đã bán'}, ${formatPrice(Number(seat.price))} đồng`} onClick={() => void toggleSeat(car.number, seat)}>
                        {seat.seat_number}{isSelected && <Check size={13} aria-hidden="true" />}
                      </button>
                    )
                  }
                  const carPlaces = selectedPlaces.filter((place) => place.carNumber === car.number)
                  const availableSeatCount = seatRows.filter((seat) => seat.status === 'available').length
                  return (
                    <section className="car-map" role="tabpanel" key={car.number}>
                      <div className="car-map-heading"><h3>{car.title} · {car.typeLabel}</h3><span>{availableSeatCount} chỗ còn</span></div>
                      {car.type === 'seat' ? (
                        <div className="seat-coach" aria-label="Sơ đồ 4 hàng ghế, lối đi giữa toa">
                          <div className="seat-row-grid">
                            {Array.from({ length: Math.ceil(seatRows.length / 4) }, (_, rowIndex) => {
                              const rowSeats = seatRows.slice(rowIndex * 4, rowIndex * 4 + 4)
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
                          {Array.from({ length: Math.ceil(seatRows.length / seatsPerCompartment) }, (_, compartmentIndex) => {
                            const compartmentSeats = seatRows.slice(compartmentIndex * seatsPerCompartment, compartmentIndex * seatsPerCompartment + seatsPerCompartment)
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
                  )
                })()}
                <section className="service-section">
                  <h3>Dịch vụ mua kèm</h3>
                  <div className="service-options">
                    {addOnServices.map((service) => (
                      <label className="service-option" key={service.id}>
                        <input type="checkbox" checked={selectedServices.includes(service.id)} onChange={() => toggleService(service.id)} />
                        <span className="service-icon">{service.id === 'meal' ? <Utensils size={16} /> : <TrainFront size={16} />}</span>
                        <span className="service-copy"><strong>{service.label}</strong><small>+{formatPrice(service.price)} đ</small></span>
                      </label>
                    ))}
                  </div>
                </section>
              </div>
              <footer className="modal-footer">
                <div className="total-copy"><small><strong>Đang xem {selectedCar.title}</strong> · {selectedPlaces.length > 0 ? selectedPlaces.map((place) => `${trainCarriages[place.carNumber - 1].title} · ${place.seatNumber}`).join(', ') : 'Chưa chọn chỗ'} · dịch vụ {selectedServices.length} mục</small><strong>{formatPrice(totalPrice)} đ</strong>{bookingConfirmed && <p className="confirmation-message" role="status">Đã xác nhận lựa chọn chỗ ngồi.</p>}</div>
                <div className="confirm-action">
                  {(selectedPlaces.length === 0 || totalPrice === 0) && <small className="seat-selection-reminder" role="status">⚠️ Vui lòng chọn ít nhất 1 chỗ để tiếp tục</small>}
                  <button className={`confirm-seat-button${bookingConfirmed ? ' confirm-seat-button-confirmed' : ''}`} type="button" disabled={selectedPlaces.length === 0 || totalPrice === 0} onClick={() => setBookingConfirmed(true)}>
                    <Check size={16} />{bookingConfirmed ? 'Đã xác nhận đặt vé' : 'Xác nhận đặt vé'}
                  </button>
                </div>
              </footer>
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
    </main>
  )
}