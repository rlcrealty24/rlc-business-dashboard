// ─── Tracking links + verified-lead matching (Phase 4) ───────────────────────
// Every post+platform gets a short code. Links carry it as utm_content; the
// RLC Leasing site tags any lead that arrives through the link with
// "via <platform>/<code>", which is how a lead is *verified* as coming from a post.

export const DEFAULT_DESTINATIONS = {
  leasing: 'https://rlc-leasing-portal.vercel.app/',
  rlc: 'https://rlc-realty-main-website.vercel.app/',
  personal: 'https://rlc-realty-main-website.vercel.app/',
}

export const postCode = item => (item?.id || '').replace(/-/g, '').slice(0, 6).toLowerCase()

const slug = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)

export function trackingLink(dest, { platform, item, campaign }) {
  if (!dest) return ''
  try {
    const u = new URL(dest)
    u.searchParams.set('utm_source', platform)
    u.searchParams.set('utm_medium', 'social')
    u.searchParams.set('utm_campaign', campaign ? slug(campaign.name) : slug(item.brand + '-posts'))
    u.searchParams.set('utm_content', postCode(item))
    return u.toString()
  } catch { return '' }
}

/** Find "via <platform>/<code>" tags in any lead text */
const VIA = /via\s+([a-z]+)\/([a-z0-9]{6})\b/gi
export function parseVia(text) {
  const out = []
  for (const m of String(text || '').matchAll(VIA)) out.push({ platform: m[1].toLowerCase(), code: m[2].toLowerCase() })
  return out
}
