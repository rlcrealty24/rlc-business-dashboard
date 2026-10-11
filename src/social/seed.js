// Starter idea bank (from the Social HQ brief). Ideas only — nothing is scheduled.
import { uid } from '../ceo/constants.js'

export function seedCampaigns() {
  return [{
    id: uid(), name: '30 Days, 30 Apartments — Miami + Denver', brand: 'leasing', type: 'apartments',
    status: 'proposed', start_date: null, duration_days: 30,
    goal: 'Rental leads: one apartment video a day across Miami and Denver. Choose a 7-day pilot, 14, 30 or custom before launch.',
    notes: 'Proposed only — approve scope and launch date first. Leasing-only cadence; personal and brokerage accounts keep their normal rhythm.',
  }]
}

const idea = (letter, title, brand, format, platforms, fields) => ({
  id: uid(), title, brand, format, platforms, stage: 'idea', source: 'seed', source_ref: `seed:${letter}`,
  priority: 'medium', is_backlog: false, publish_date: null, ...fields,
})

export function seedIdeas(campaigns) {
  const apartments = campaigns.find(c => c.type === 'apartments')
  return [
    // ── Personal ──────────────────────────────────────────────────────────
    idea('A', 'Summer / Life Lately recap', 'personal', 'lifestyle_reel', ['instagram', 'tiktok'], {
      pillar: 'Lifestyle', objective: 'Reconnect with audience', priority: 'high', timeliness: 'timely', lead_potential: 'low', effort: 'medium',
      notes: 'Talking Reel over summer B-roll. I stepped back from social to enjoy life — travel, motherhood, living between Miami and Colorado — while the business kept running behind the scenes.',
    }),
    idea('B', "I Stopped Posting. I Didn't Stop Closing.", 'personal', 'talking_reel', ['instagram', 'tiktok'], {
      pillar: 'Founder / broker life', objective: 'Authority & credibility', priority: 'high', timeliness: 'timely', lead_potential: 'high', effort: 'heavy',
      notes: 'Business storytelling: deals kept closing because of relationships, referrals, reputation and the foundation already built. Goal: authority + buyer/seller leads.',
    }),
    idea('C', 'Bi-Coastal Life — Miami & Colorado', 'personal', 'lifestyle_reel', ['instagram'], {
      pillar: 'Miami & Colorado life', objective: 'Personal brand', timeliness: 'evergreen', lead_potential: 'medium', effort: 'medium',
      notes: 'Life and business between Miami and Colorado. Reel or carousel. Builds personal brand + quiet market awareness in both states.',
    }),
    // ── RLC Realty ────────────────────────────────────────────────────────
    idea('D', 'Recent closing — the deal that almost didn\'t happen', 'rlc', 'transaction_story', ['instagram', 'tiktok', 'facebook'], {
      pillar: 'Transactions', objective: 'Authority & credibility', priority: 'high', timeliness: 'timely', lead_potential: 'high', effort: 'medium',
      notes: 'Showcase the recent closing that went through after significant obstacles (first lender denied the buyer). Tell it as a story, not a Just Sold graphic. Confirm client permission first.',
    }),
    idea('E', 'Deals We Didn\'t Post', 'rlc', 'recap_carousel', ['instagram', 'facebook'], {
      pillar: 'Transactions', objective: 'Agent visibility', priority: 'high', timeliness: 'evergreen', lead_potential: 'medium', effort: 'medium',
      is_backlog: true,
      notes: 'Carousel of completed transactions from the past few months — brokerage and agent production. Pull the deal list from Backlog.',
    }),
    idea('F', 'RLC Realty website reveal', 'rlc', 'announcement', ['instagram', 'facebook'], {
      pillar: 'Technology', objective: 'Announcement', timeliness: 'timely', lead_potential: 'medium', effort: 'medium',
      notes: 'Introduce the updated website and our expanded presence (Florida + Colorado).',
    }),
    idea('G', 'RLC Portal — technology reveal', 'rlc', 'announcement', ['instagram', 'facebook', 'linkedin'], {
      pillar: 'Technology', objective: 'Recruiting', timeliness: 'evergreen', lead_potential: 'medium', effort: 'medium',
      notes: 'Show our systems and what they mean for agents (support, tools) and clients (transparency). Doubles as recruiting content.',
    }),
    idea('H', 'Agent spotlight — our top leasing agent', 'rlc', 'agent_spotlight', ['instagram', 'facebook'], {
      pillar: 'Agent spotlight', objective: 'Agent visibility', priority: 'high', timeliness: 'evergreen', lead_potential: 'medium', effort: 'medium',
      notes: 'Feature a productive leasing agent and their recent transactions. Consider grouping their leases into one recap.',
    }),
    idea('I', 'Agent training — behind the brokerage', 'rlc', 'lifestyle_reel', ['instagram', 'facebook'], {
      pillar: 'Agent training', objective: 'Recruiting', timeliness: 'evergreen', lead_potential: 'medium', effort: 'medium',
      notes: 'Document a real Tuesday training session and show how RLC supports its agents.',
    }),
    idea('J', 'Apartment communities — our rental search platform', 'rlc', 'announcement', ['instagram', 'facebook'], {
      pillar: 'Technology', objective: 'Rental leads', timeliness: 'evergreen', lead_potential: 'high', effort: 'medium',
      collab_with: ['@rlcrealtycoleasing'],
      notes: 'Introduce the apartment discovery and rental experience (leasing portal). Collab with @rlcrealtycoleasing.',
    }),
    // ── RLC Leasing ───────────────────────────────────────────────────────
    idea('K', 'Denver apartment tour', 'leasing', 'apartment_tour', ['instagram', 'tiktok'], {
      pillar: 'Denver rentals', objective: 'Rental leads', priority: 'high', timeliness: 'evergreen', lead_potential: 'high', effort: 'medium',
      notes: 'Pick a Denver community from active listings. Verify pricing and specials before publishing.',
    }),
    idea('L', 'Miami apartment tour', 'leasing', 'apartment_tour', ['instagram', 'tiktok'], {
      pillar: 'Miami rentals', objective: 'Rental leads', priority: 'high', timeliness: 'evergreen', lead_potential: 'high', effort: 'medium',
      notes: 'Pick a Miami community from active listings. Verify pricing and specials before publishing.',
    }),
    idea('M', 'Apartment specials roundup', 'leasing', 'carousel', ['instagram', 'facebook'], {
      pillar: 'Specials', objective: 'Rental leads', timeliness: 'expiring', lead_potential: 'high', effort: 'light',
      notes: 'Current move-in specials across communities. Specials expire — verify each one the day before posting.',
    }),
    idea('N', '30 Days, 30 Apartments — campaign', 'leasing', 'apartment_tour', ['instagram', 'tiktok'], {
      pillar: 'Apartment tours', objective: 'Rental leads', timeliness: 'evergreen', lead_potential: 'high', effort: 'heavy',
      campaign_id: apartments?.id || null,
      notes: 'Proposed campaign — approve scope (7 / 14 / 30 days) and launch date before anything is scheduled.',
    }),
  ]
}
