const DAY_IN_MILLISECONDS = 86_400_000

function parseDateParts(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''))
  if (!match) {
    return null
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const timestamp = Date.UTC(year, month - 1, day)
  const date = new Date(timestamp)
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return { year, month, day, timestamp }
}

export function getDday(dueDate, today = new Date()) {
  const due = parseDateParts(dueDate)
  if (!due || !(today instanceof Date) || Number.isNaN(today.getTime())) {
    return null
  }
  const todayTimestamp = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  )
  const difference = Math.round(
    (due.timestamp - todayTimestamp) / DAY_IN_MILLISECONDS,
  )
  if (difference === 0) {
    return { kind: 'today', days: 0, label: 'D-Day' }
  }
  if (difference > 0) {
    return { kind: 'future', days: difference, label: `D-${difference}` }
  }
  return { kind: 'past', days: -difference, label: `D+${-difference}` }
}
