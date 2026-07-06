export function formatCurrency(n, compact = false) {
  if (n == null || isNaN(n)) return '—'
  const num = Number(n)
  if (compact && Math.abs(num) >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(num)
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

export function formatPercent(n, decimals = 1) {
  if (n == null || isNaN(n)) return '—'
  return `${Number(n).toFixed(decimals)}%`
}

// Parses ISO (YYYY-MM-DD), US slash/dash (MM/DD/YYYY, MM-DD-YYYY) and other
// common bank-CSV date formats without falling into timezone-shift bugs.
export function parseDateSafe(dateStr) {
  if (!dateStr) return null
  const s = String(dateStr).trim()

  // ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + 'T00:00:00')
    return isNaN(d.getTime()) ? null : d
  }

  // US slash or dash: MM/DD/YYYY, M/D/YYYY, MM-DD-YYYY, MM-DD-YY
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (m) {
    let [, mm, dd, yyyy] = m
    if (yyyy.length === 2) yyyy = (parseInt(yyyy, 10) < 70 ? '20' : '19') + yyyy
    const d = new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10))
    return isNaN(d.getTime()) ? null : d
  }

  // Fallback — let the engine try (handles ISO timestamps, "Jun 10 2026", etc.)
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

// Normalizes any supported input to canonical YYYY-MM-DD for storage.
export function normalizeDate(dateStr) {
  const d = parseDateSafe(dateStr)
  if (!d) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatDate(dateStr) {
  const d = parseDateSafe(dateStr)
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateShort(dateStr) {
  const d = parseDateSafe(dateStr)
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function today() {
  return new Date().toISOString().slice(0, 10)
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}
