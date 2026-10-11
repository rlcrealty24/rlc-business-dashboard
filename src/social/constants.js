// ─── Social Media HQ: brands, platforms, stages, formats ─────────────────────

export const BRANDS = {
  personal: {
    label: 'Royanna Carbajal', short: 'Personal', handle: '@royannacarbajal',
    color: '#8a6d3b', bg: '#f8f3ea',
    perWeek: [0.5, 1],          // ~1 feed post a week, sometimes less
    pillars: ['Lifestyle', 'Motherhood', 'Miami & Colorado life', 'Travel & experiences', 'Entrepreneurship',
      'Founder / broker life', 'Major wins', 'Reflections & lessons'],
  },
  rlc: {
    label: 'RLC Realty Co.', short: 'RLC Realty', handle: '@rlcrealtyco',
    color: '#0a0a0a', bg: '#f3f3f3',
    perWeek: [1, 2],
    pillars: ['Transactions', 'Agent spotlight', 'Agent accomplishments', 'Agent training', 'Brokerage culture',
      'Team growth', 'FL & CO expansion', 'Buyer / seller education', 'Client success', 'Technology',
      'Recruiting', 'Testimonials', 'Market updates'],
  },
  leasing: {
    label: 'RLC Leasing', short: 'Leasing', handle: '@rlcrealtycoleasing',
    color: '#1c9fd0', bg: '#eef9fe',
    perWeek: [1, 2],            // can rise during campaigns
    pillars: ['Apartment tours', 'Miami rentals', 'Denver rentals', 'Specials', 'Rental communities',
      'New developments', 'Rental education', 'Comparisons', 'Neighborhood guides'],
  },
}

export const PLATFORMS = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  youtube: 'YouTube Shorts',
  linkedin: 'LinkedIn',
}

export const STAGES = [
  ['idea', 'Idea'],
  ['planned', 'Planned'],
  ['gathering', 'Gathering assets'],
  ['ready_to_film', 'Ready to film'],
  ['filmed', 'Filmed'],
  ['editing', 'Editing'],
  ['review', 'Review'],
  ['approved', 'Approved'],
  ['scheduled', 'Scheduled'],
  ['published', 'Published'],
  ['reviewed', 'Performance reviewed'],
]
export const STAGE_INDEX = Object.fromEntries(STAGES.map(([k], i) => [k, i]))
export const stageLabel = k => (STAGES.find(s => s[0] === k) || [k, k])[1]

export const OBJECTIVES = [
  'Reconnect with audience', 'Personal brand', 'Authority & credibility', 'Buyer / seller leads', 'Rental leads',
  'Agent visibility', 'Recruiting', 'Announcement', 'Education', 'Client trust',
]

export const PRIORITIES = ['high', 'medium', 'low']

/*
 * Formats → production steps. Each step lands on a date relative to the publish
 * date ("anchor"), snapping to the Film / Edit / Schedule blocks already on the
 * CEO calendar. Finishing a step moves the post to that step's stage.
 */
const S = (key, label, anchor, stage, items) => ({ key, label, anchor, stage, items })

const APPROVE = S('approve', 'Review & approve', 'approve', 'approved',
  ['Watch / read the final version', 'Approve caption, CTA & hashtags', 'Brand voice check', 'No confidential client details'])
const SCHEDULE = S('schedule', 'Schedule', 'schedule', 'scheduled',
  ['Upload to each platform', 'Set cover image', 'Paste caption', 'Tag collaborators / send collab invite', 'Set publish time'])
const PUBLISH = S('publish', 'Publish', 'publish', 'published',
  ['Confirm it went live', 'Share to Stories', 'Reply to first comments', 'Paste the live link'])
const REVIEW = S('review', 'Performance check (7 days)', 'review', 'reviewed',
  ['Log views, saves, shares', 'Log inquiries & leads', 'What worked / what to change'])

export const FORMATS = {
  talking_reel: {
    label: 'Talking Reel', effort: 'heavy',
    steps: [
      S('plan', 'Script & talking points', 'plan', 'planned', ['Three opening hooks', 'Talking points', 'Full script', 'Review script']),
      S('gather', 'Gather B-roll', 'gather', 'gathering', ['Pull clips from phone / iCloud', 'List B-roll still needed']),
      S('film', 'Film', 'film', 'filmed', ['Filming setup & location', 'Camera framing — vertical 9:16, eye level', 'Lighting — face the window or ring light',
        'Audio — mic on, quiet room', 'Record the talking portion', 'Capture B-roll']),
      S('edit', 'Edit Reel', 'edit', 'editing', ['Rough cut & pacing', 'On-screen text', 'Captions / subtitles', 'Music', 'Cover image']),
      APPROVE, SCHEDULE, PUBLISH, REVIEW,
    ],
  },
  lifestyle_reel: {
    label: 'Lifestyle Reel (B-roll + voice)', effort: 'medium',
    steps: [
      S('plan', 'Concept & voiceover script', 'plan', 'planned', ['Concept / story', 'Three opening hooks', 'Voiceover or talking script']),
      S('gather', 'Select footage', 'gather', 'gathering', ['Pick clips from phone / iCloud', 'Miami footage', 'Colorado footage', 'Choose music']),
      S('film', 'Record talking / voiceover', 'film', 'filmed', ['Record voiceover or talking part', 'Any missing B-roll']),
      S('edit', 'Edit Reel', 'edit', 'editing', ['Cut to music & pacing', 'On-screen text', 'Captions / subtitles', 'Cover image']),
      APPROVE, SCHEDULE, PUBLISH, REVIEW,
    ],
  },
  apartment_tour: {
    label: 'Apartment tour', effort: 'medium',
    steps: [
      S('plan', 'Property details & pricing', 'plan', 'planned', ['Community name & neighborhood', 'Unit types & pricing',
        'Current special — verify with the leasing office', 'Availability & move-in dates', 'Amenities list', 'Agent / contact attribution']),
      S('film', 'Film tour', 'film', 'filmed', ['Exterior & entrance', 'Lobby & amenities', 'Unit walkthrough — living, kitchen, bed, bath',
        'Views / balcony', 'Neighborhood B-roll']),
      S('edit', 'Edit tour', 'edit', 'editing', ['Hook in the first 2 seconds', 'On-screen pricing & special', 'Captions', 'Lead CTA (DM / link)', 'Cover image']),
      APPROVE,
      S('verify', 'Re-verify price, special & availability', 'verify', 'approved', ['Price still current', 'Special still active', 'Unit still available']),
      SCHEDULE, PUBLISH,
      S('review', 'Performance check (7 days)', 'review', 'reviewed', ['Log views, saves, shares', 'Log rental inquiries', 'Add leads to CRM']),
    ],
  },
  carousel: {
    label: 'Carousel', effort: 'light',
    steps: [
      S('plan', 'Slide-by-slide outline', 'plan', 'planned', ['Slide 1 hook', 'Slide-by-slide outline', 'Last slide CTA']),
      S('gather', 'Gather photos', 'gather', 'gathering', ['Photo requirements per slide', 'Pull photos']),
      S('edit', 'Design slides', 'edit', 'editing', ['Design per brand style', 'Text check']),
      S('approve', 'Caption, CTA & final review', 'approve', 'approved', ['Caption', 'CTA', 'Hashtags', 'Final review']),
      SCHEDULE, PUBLISH, REVIEW,
    ],
  },
  transaction_story: {
    label: 'Closing story (Reel)', effort: 'medium',
    steps: [
      S('plan', 'Story & permission', 'plan', 'planned', ['Client / agent permission confirmed', 'Remove confidential details (names, price) unless approved',
        'Story arc: challenge → turning point → result', 'Script']),
      S('gather', 'Gather photos & video', 'gather', 'gathering', ['Closing / keys photo', 'Property photos or clips', 'Agent photo']),
      S('film', 'Record the story', 'film', 'filmed', ['Talking portion', 'B-roll']),
      S('edit', 'Edit', 'edit', 'editing', ['Pacing', 'On-screen text', 'Captions', 'Cover image']),
      APPROVE, SCHEDULE, PUBLISH, REVIEW,
    ],
  },
  recap_carousel: {
    label: 'Deals recap carousel', effort: 'medium',
    steps: [
      S('plan', 'Select transactions', 'plan', 'planned', ['Pick the deals to include', 'Confirm what is shareable (permissions)', 'Group by agent / market']),
      S('gather', 'Photos for each deal', 'gather', 'gathering', ['One strong photo per deal', 'Agent headshots']),
      S('edit', 'Design carousel', 'edit', 'editing', ['Cover slide', 'One slide per deal / agent', 'Closing slide CTA']),
      APPROVE, SCHEDULE, PUBLISH, REVIEW,
    ],
  },
  agent_spotlight: {
    label: 'Agent spotlight', effort: 'medium',
    steps: [
      S('plan', 'Agent details', 'plan', 'planned', ['Bio & service areas', 'Specialties', 'Recent transactions to mention', 'Agent agrees to be featured']),
      S('gather', 'Headshot, photos & clips from agent', 'gather', 'gathering', ['Headshot', 'Transaction photos', 'Short video (optional)']),
      S('edit', 'Design / edit', 'edit', 'editing', ['Slides or Reel', 'On-screen text', 'Cover']),
      S('approve', 'Agent & you approve', 'approve', 'approved', ['Agent approves', 'Caption & CTA approved', 'Tag agent / collab invite ready']),
      SCHEDULE, PUBLISH, REVIEW,
    ],
  },
  announcement: {
    label: 'Announcement / reveal', effort: 'medium',
    steps: [
      S('plan', 'Key message & demo script', 'plan', 'planned', ['The one-sentence announcement', 'What it means for clients / agents', 'Demo script']),
      S('gather', 'Screen recordings & screenshots', 'gather', 'gathering', ['Screen recordings', 'Screenshots', 'Logo / brand assets']),
      S('film', 'Record talking intro', 'film', 'filmed', ['Talking intro', 'B-roll']),
      S('edit', 'Edit', 'edit', 'editing', ['Cut', 'On-screen text', 'Captions', 'Cover']),
      APPROVE, SCHEDULE, PUBLISH, REVIEW,
    ],
  },
  photo: {
    label: 'Single photo', effort: 'light',
    steps: [
      S('gather', 'Pick the photo', 'gather', 'gathering', ['Choose photo', 'Light edit']),
      S('approve', 'Caption & approve', 'approve', 'approved', ['Caption', 'CTA / hashtags']),
      PUBLISH,
    ],
  },
  story: {
    label: 'Story', effort: 'light',
    steps: [
      S('gather', 'Gather story frames', 'gather', 'gathering', ['Photos / clips', 'Stickers or link']),
      PUBLISH,
    ],
  },
}

export const EFFORT_LABEL = { light: 'Light', medium: 'Medium', heavy: 'Heavy' }
