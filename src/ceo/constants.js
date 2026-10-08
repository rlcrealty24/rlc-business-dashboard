// Categories, colors and reminder presets for the CEO calendar.

export const CATEGORIES = {
  money:    { label: 'Income-Producing',   color: '#1c9fd0', bg: '#eef9fe' },
  business: { label: 'Business & Ops',     color: '#0a0a0a', bg: '#f3f3f3' },
  meetings: { label: 'Meetings & Training', color: '#4f46e5', bg: '#eef0ff' },
  content:  { label: 'Content',            color: '#c2410c', bg: '#fff4ec' },
  sophia:   { label: 'Sophia',             color: '#db2777', bg: '#fdf0f6' },
  fitness:  { label: 'Fitness',            color: '#15803d', bg: '#ecfdf3' },
  personal: { label: 'Personal',           color: '#8a6d3b', bg: '#f8f3ea' },
  learning: { label: 'Learning',           color: '#7c3aed', bg: '#f5f0ff' },
  dates:    { label: 'Dates & Deadlines',  color: '#b91c1c', bg: '#fef2f2' },
}

// Items that come from outside the CEO tables
export const SOURCE_STYLE = {
  portal: { label: 'RLC Portal',      color: '#0a0a0a', bg: '#0a0a0a', text: '#ffffff' },
  life:   { label: 'Dashboard',       color: '#8a6d3b', bg: '#f8f3ea' },
  bill:   { label: 'Bill due',        color: '#b91c1c', bg: '#fef2f2' },
}

export function itemColors(item) {
  if (item.source === 'portal') return SOURCE_STYLE.portal
  if (item.source === 'bill') return SOURCE_STYLE.bill
  const c = CATEGORIES[item.category] || CATEGORIES.business
  return { ...c, text: '#0a0a0a' }
}

export const DATE_TYPES = {
  birthday:  { label: 'Birthday',          category: 'personal', recurrence: { freq: 'yearly' }, reminders: [10080, 1440],
    checklist: ['Buy / order a gift (7 days out)', 'Card', 'Call or text on the day'] },
  marketing: { label: 'Marketing date',    category: 'content',  recurrence: { freq: 'yearly' }, reminders: [60480, 20160],
    checklist: ['Pick the angle for each account', 'Film + edit 1 week before', 'Schedule posts + email'] },
  event:     { label: 'Event',             category: 'dates',    recurrence: { freq: 'none' },   reminders: [20160, 10080, 1440],
    checklist: ['RSVP / tickets', 'Plan childcare or bring Sophia?', 'What to bring / prepare'] },
  deadline:  { label: 'Deadline',          category: 'dates',    recurrence: { freq: 'none' },   reminders: [20160, 10080, 2880],
    checklist: ['Gather what\'s needed', 'Finish 2 days early', 'Submit + save confirmation'] },
  campaign:  { label: 'Campaign',          category: 'content',  recurrence: { freq: 'none' },   reminders: [42 * 1440, 20160, 10080],
    checklist: ['Offer + goal', 'Content plan (posts, email, ads)', 'Film + edit 1 week before', 'Schedule everything', 'Review results'] },
}

export const MIN_PER_DAY = 1440

export const REMINDER_PRESETS = [
  { min: 0, label: 'At start' },
  { min: 5, label: '5 min' },
  { min: 10, label: '10 min' },
  { min: 15, label: '15 min' },
  { min: 30, label: '30 min' },
  { min: 60, label: '1 hr' },
  { min: 1440, label: '1 day' },
  { min: 2880, label: '2 days' },
  { min: 10080, label: '1 week' },
  { min: 20160, label: '2 weeks' },
  { min: 60480, label: '6 weeks' },
]

export function reminderLabel(min) {
  const p = REMINDER_PRESETS.find(r => r.min === min)
  if (p) return p.label
  if (min % 10080 === 0) return `${min / 10080} wks`
  if (min % 1440 === 0) return `${min / 1440} days`
  if (min % 60 === 0) return `${min / 60} hr`
  return `${min} min`
}

// Default reminders for things that live in the RLC portal
export const PORTAL_REMINDERS = {
  appointment: [15],
  showing: [30],
  event: [60],
  community: [60],
  pipeline: [30],
  deadline: [4320, 1440],   // 3 days + 1 day
  task: [1440],
  post: [],
}

export const PORTAL_URL = 'https://portal.rlcrealtyco.com'

export const uid = () =>
  (crypto?.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  }))
