//sprint 5 them tinh nag moi 
import { useMemo, useState, type FormEvent } from 'react'
import { Search, TrainFront } from 'lucide-react'
import {
  findTrainSchedule,
  TRAIN_SCHEDULES,
  TRACKER_TRAIN_CODES,
  type TrainScheduleStation,
} from '../data/trainSchedules'

function getStationState(index: number, currentStationIndex: number) {
  if (index < currentStationIndex) return 'passed'
  if (index === currentStationIndex) return 'current'
  if (index === currentStationIndex + 1) return 'next'
  return 'future'
}

export function TrainScheduleTracker() {
  const [query, setQuery] = useState('SE21-12')
  const [currentCode, setCurrentCode] = useState('SE21-12')
  const [currentStationIndex, setCurrentStationIndex] = useState(1)

  const schedule = useMemo(
    () => findTrainSchedule(currentCode) ?? TRAIN_SCHEDULES[0],
    [currentCode],
  )

  function selectTrain(code: string) {
    setQuery(code)
    setCurrentCode(code)
    setCurrentStationIndex(code.includes('22') ? 0 : 1)
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const found = findTrainSchedule(query)
    if (found) selectTrain(found.code)
  }

  function advanceStation() {
    setCurrentStationIndex((current) =>
      Math.min(schedule.stations.length - 1, current + 1),
    )
  }

  const currentStation = schedule.stations[currentStationIndex]
  const nextStation = schedule.stations[currentStationIndex + 1]
  const progress = currentStationIndex / (schedule.stations.length - 1) * 100
  const distanceToNext = nextStation
    ? Math.max(0, nextStation.distanceKm - currentStation.distanceKm)
    : 0
  const mockedRemainingDistance = currentStationIndex === 0
    ? 18
    : Math.min(distanceToNext, 18 + currentStationIndex * 7)

  return (
    <section className="schedule-tracker-page" aria-label="Tra cứu lịch trình và vị trí tàu">
      <div className="schedule-tracker-heading">
        <div>
          <span className="eyebrow">Theo dõi chuyến đi</span>
          <h1>Lịch trình &amp; vị trí tàu</h1>
        </div>
        <span className="schedule-live-badge"><i /> Trực tuyến mô phỏng</span>
      </div>

      <form className="schedule-search" onSubmit={submitSearch}>
        <label>
          <span>Mã chuyến tàu</span>
          <div className="schedule-search-control">
            <TrainFront size={18} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value.toUpperCase())}
              placeholder="Nhập hoặc dán mã chuyến tàu"
              aria-label="Mã chuyến tàu"
            />
          </div>
        </label>
        <button type="submit"><Search size={16} />Tra cứu</button>
      </form>

      <div className="schedule-code-shortcuts" aria-label="Mã tàu gợi ý">
        {TRACKER_TRAIN_CODES.map((code) => (
          <button
            type="button"
            key={code}
            className={currentCode === code ? 'schedule-code-active' : ''}
            onClick={() => selectTrain(code)}
          >
            {code}
          </button>
        ))}
      </div>

      <section className="train-radar" aria-label="Vị trí đoàn tàu trực tuyến">
        <div className="train-radar-heading">
          <div>
            <span className="eyebrow">Vị trí đoàn tàu trực tuyến</span>
            <h2>🚆 Tàu {schedule.code}</h2>
          </div>
          <span className="train-on-time">Trạng thái: Đúng giờ</span>
        </div>

        <p className="train-radar-status" aria-live="polite">
          {currentStationIndex === 0
            ? `Tàu ${schedule.code} đang xuất phát tại Ga ${currentStation.name}`
            : `Tàu ${schedule.code} đang di chuyển từ Ga ${schedule.stations[currentStationIndex - 1].name} đến Ga ${currentStation.name}`}
          {' • '}Cách Ga {currentStation.name} {mockedRemainingDistance} km
          {' • '}Tốc độ 78 km/h
          {' • '}Trạng thái: Đúng giờ
        </p>

        <div className="train-progress-track">
          <div className="train-progress-line"><i style={{ width: `${progress}%` }} /></div>
          <div className="train-progress-stations">
            {schedule.stations.map((station, index) => {
              const state = getStationState(index, currentStationIndex)
              return (
                <span className={`train-progress-stop train-progress-${state}`} key={station.name}>
                  <i>{index < currentStationIndex ? '✓' : index === currentStationIndex ? '🚆' : index + 1}</i>
                  <small>{station.name}</small>
                </span>
              )
            })}
          </div>
          <span className="train-progress-train" style={{ left: `${progress}%` }} aria-hidden="true">🚆</span>
        </div>

        <button className="simulate-train-button" type="button" onClick={advanceStation} disabled={currentStationIndex === schedule.stations.length - 1}>
          Mô phỏng tàu di chuyển (+1 chặng)
        </button>
      </section>

      <section className="schedule-timeline" aria-label="Timeline 7 ga">
        <div className="schedule-timeline-heading">
          <h2>Lịch trình 7 ga</h2>
          <span>{schedule.direction}</span>
        </div>
        <div className="schedule-timeline-list">
          {schedule.stations.map((station: TrainScheduleStation, index) => {
            const state = getStationState(index, currentStationIndex)
            return (
              <article className={`schedule-stop schedule-stop-${state}`} key={station.name}>
                <div className="schedule-stop-marker">
                  <i>{state === 'passed' ? '✓' : state === 'current' ? '🚆' : index + 1}</i>
                </div>
                <div className="schedule-stop-copy">
                  <div>
                    <strong>{station.name}</strong>
                    <span>{station.distanceKm} km</span>
                  </div>
                  <div className="schedule-stop-times">
                    <span>Giờ đến <strong>{index === 0 ? '--:--' : station.arrivalTime}</strong></span>
                    <span>Giờ đi <strong>{index === schedule.stations.length - 1 ? '--:--' : station.departureTime}</strong></span>
                  </div>
                </div>
                <span className={`schedule-stop-label schedule-label-${state}`}>
                  {index === 0
                    ? 'Ga xuất phát'
                    : index === schedule.stations.length - 1
                      ? 'Ga cuối'
                      : state === 'passed'
                        ? 'Đã đi qua'
                        : state === 'current'
                          ? 'Đang dừng tại ga'
                          : state === 'next'
                            ? 'Sắp tới'
                            : `Dừng ${station.stopMinutes} phút`}
                </span>
              </article>
            )
          })}
        </div>
      </section>
    </section>
  )
}
