// Read-only view of the RLC Leasing site's active apartments (its own Supabase
// project, public listings). Only public fields — never the private building name.
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const leasing = createClient(
  'https://pzxpctojsybstxgifvzf.supabase.co',
  'sb_publishable_v2F3uNa6zJ62NVo0GT0h-Q_XD9-eRh5',
  { auth: { persistSession: false, autoRefreshToken: false } },
)

const PUBLIC_FIELDS = 'id, display_name, area, location, market, description, amenities, special, is_hot_deal, is_new, photo_url, video_url, price_studio, price_1bed, price_1den, price_2bed, price_3bed, base_price, lease_term, last_updated, posted_to_ig'

/** Miami vs Denver from the listing's market / location text */
export function marketOf(l) {
  const t = `${l.market || ''} ${l.location || ''} ${l.area || ''}`.toLowerCase()
  if (/denver|colorado|aurora|lakewood|englewood|\bco\b/.test(t)) return 'Denver'
  if (/miami|florida|kendall|dadeland|brickell|beach|doral|hialeah|coral|aventura|\bfl\b/.test(t)) return 'Miami'
  return 'Other'
}

export function priceLine(l) {
  const parts = [['Studio', l.price_studio], ['1BD', l.price_1bed], ['1BD+Den', l.price_1den], ['2BD', l.price_2bed], ['3BD', l.price_3bed]]
    .filter(([, v]) => v && !/rented/i.test(String(v)))
    .map(([k, v]) => `${k} ${v}`)
  return parts.join(' · ') || (l.base_price ? `From ${l.base_price}` : '')
}

export function useLeasingListings() {
  const [state, setState] = useState({ loading: true, listings: [], error: null })
  useEffect(() => {
    let cancelled = false
    leasing.from('listings').select(PUBLIC_FIELDS).eq('is_active', true).order('display_name')
      .then(({ data, error }) => {
        if (cancelled) return
        setState({ loading: false, error: error?.message || null, listings: (data || []).map(l => ({ ...l, marketName: marketOf(l) })) })
      })
    return () => { cancelled = true }
  }, [])
  return state
}
