export function formatDate(date: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`))
}

export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours} giờ${remainingMinutes ? ` ${remainingMinutes} phút` : ''}`
}

export function formatPrice(price: number) {
  return new Intl.NumberFormat('vi-VN').format(price)
}
