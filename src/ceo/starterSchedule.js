// ─── Starter schedule ─────────────────────────────────────────────────────────
// Built around Sophia: wakes 7:30–8, naps ~10:30–12:30, bed 7–8 PM.
// All times Mountain. Deep work lives in three windows only:
//   5:30–7:15 AM (before she wakes) · 10:30–12:30 (nap) · 7:45–8:30 PM (after bed)
// Everything here is editable from the calendar.

import { uid } from './constants.js'

const START = '2026-10-05'          // Monday of the week this was set up
const WEEKDAYS = [1, 2, 3, 4, 5]
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6]

const list = (...lines) => lines.map((text, i) => ({ id: `c${i + 1}`, text }))

function block(title, category, byDay, start, end, extra = {}) {
  return {
    id: uid(),
    title,
    category,
    kind: 'block',
    start_date: START,
    until_date: null,
    all_day: false,
    start_time: start,
    end_time: end,
    recurrence: { freq: 'weekly', byDay },
    description: '',
    checklist: [],
    rotation: null,
    reminders: [5],
    location: null,
    meeting_url: null,
    link: null,
    unconfirmed: false,
    protected: false,
    ...extra,
  }
}

// Shared checklists
const FOLLOW_UP = list(
  'Open the CRM — sort by "next follow-up date"',
  'Hot leads first: call or text every lead touched in the last 7 days',
  'Buyers & renters: send 2+ new matching listings',
  'Sellers & landlords: status update (showings, feedback, price)',
  'Investors: 1 deal or market note to each active investor',
  'Active transactions: check every deadline in the next 7 days',
  'Listings & rentals: confirm showings, update status',
  'Every contact gets a next step + date before you close the CRM',
)

const POST_ENGAGE = list(
  'Confirm the scheduled post went live (if not — post it now)',
  'Set a 10-minute timer',
  'Reply to every comment on today\'s post',
  'Answer DMs — any lead goes straight into the CRM',
  'Share the post to Stories',
  'Timer done → close the app. No scrolling.',
)

export function buildStarterBlocks() {
  return [
    // ── Every day ─────────────────────────────────────────────────────────────
    block('Morning Routine — No Screens', 'personal', EVERY_DAY, '05:30', '06:00', {
      protected: true,
      description: 'Phone stays on the charger until this block is done. This is what makes the rest of the day work.',
      checklist: list(
        'Phone stays on the charger — no screens',
        'Big glass of water',
        'Prayer / devotional (5 min)',
        'Stretch or move (5 min)',
        'Write today\'s Top 3 on paper (at least 1 must make money)',
        'Get dressed — shoes on',
        'Coffee, then start the focus block',
      ),
    }),
    block('Sophia: Wake-Up & Breakfast', 'sophia', EVERY_DAY, '07:30', '08:00', {
      reminders: [0],
      checklist: list('Diaper + dress', 'Breakfast + water', 'Pack diaper bag (snacks, water, change of clothes)', 'Gym / activity bag by the door'),
    }),
    block('Walk with Sophia', 'fitness', EVERY_DAY, '16:00', '16:45', {
      description: 'Movement for both of you. Phone in pocket — podcast or audiobook is fine.',
      checklist: list('Stroller walk 30–40 min', 'Point out & name 5 things (colors, animals, sounds)', 'Water for both'),
    }),
    block('Family Dinner & Evening', 'personal', EVERY_DAY, '17:00', '19:00', {
      reminders: [10],
      description: 'Work is closed. Be here.',
      checklist: list('Dinner prep', 'Eat together — phones away', 'Play / bath prep'),
    }),
    block('Sophia: Bath & Bedtime', 'sophia', EVERY_DAY, '19:00', '19:45', {
      checklist: list('Bath', 'Pajamas + bottle/milk', 'Read 2 books', 'Lights out by 7:45'),
    }),
    block('Hard Stop — Phone Down', 'personal', EVERY_DAY, '20:45', '21:00', {
      protected: true,
      description: 'The day is over. No checking numbers, email, DMs, or socials. Tomorrow is already planned.',
      checklist: list(
        'Phone on the charger OUTSIDE the bedroom',
        'No email, no numbers, no socials',
        'Tomorrow\'s Top 3 is already set',
        'Lights low — wind down',
      ),
    }),
    block('Saturday: Family Day — No Work', 'personal', [6], null, null, {
      all_day: true, reminders: [],
      description: 'No calls, no CRM, no content. Rest is part of the plan.',
    }),

    // ── 6:00–7:15 AM focus blocks (one theme per day) ───────────────────────
    block('Build Block — Websites, Systems & Portal', 'business', [1], '06:00', '07:15', {
      protected: true,
      description: 'ONE build task, picked during Sunday planning. Do not open email.',
      checklist: list(
        'Open the build task chosen on Sunday (written in Today\'s Top 3)',
        'Timer: 25 min work / 5 min break × 2',
        'Websites · agent portal · leasing portal · automations — just the one task',
        'Write down exactly where you stopped (next step) before closing',
      ),
    }),
    block('Recruiting & Onboarding', 'business', [2], '06:00', '07:15', {
      protected: true,
      checklist: list(
        'Message 5 prospective agents (warm list first)',
        'Follow up with every recruit in conversation',
        'Move each new agent one onboarding step forward',
        'Answer agent questions from the last 24 hrs',
        'Log every recruit touch in the portal',
      ),
    }),
    block('Edit Content — Finish Next Week\'s Posts', 'content', [3], '06:00', '07:15', {
      protected: true,
      description: 'RULE: Work leaves this block FINISHED. Nothing gets completed on the day it\'s due — you are editing NEXT week\'s posts.',
      checklist: list(
        'Edit the 5 posts filmed on Tuesday (one at a time, start to finish)',
        'Captions + hashtags + cover image for each',
        'Export and save to the "Ready to Schedule" folder',
        'Every post leaves this block DONE — no "almost finished"',
      ),
    }),
    block('Marketing & New Business', 'money', [4], '06:00', '07:15', {
      protected: true,
      checklist: list(
        'Market 1 active listing or rental (email blast / ad / feature)',
        'Push rental specials to the leasing list',
        'Reach out to 3 referral partners (lenders, title, past clients)',
        'Check ads / lead forms — leads into the CRM',
        'One new lead-gen idea → write it in the Inbox',
      ),
    }),
    block('Brokerage Ops & Admin', 'business', [5], '06:00', '07:15', {
      protected: true,
      checklist: list(
        'Review & approve pending broker items in the portal',
        'Compliance: missing docs, license renewals, E&O',
        'Commission requests — approve or follow up',
        'Pay / schedule vendor bills',
        'File documents, clear admin inbox',
      ),
    }),

    // ── Mornings with Sophia ─────────────────────────────────────────────────
    block('Gym — Kids Club Window', 'fitness', [1, 2, 5], '08:00', '09:15', {
      protected: true, reminders: [15], link: '/fitness',
      description: 'Leave at 8:00, Sophia into kids club by 8:15, train for 1 hour. Today\'s workout is from your Fitness plan.',
      checklist: list('Gym bag + water + diaper bag', 'Sophia into kids club', 'Warm-up', 'Today\'s workout (see Fitness)', 'Log it in Fitness'),
    }),
    block('Work Out of the House — Not a Break', 'business', [1, 5], '09:15', '09:50', {
      description: 'This is a WORK block somewhere other than home (gym lounge / coffee shop) while Sophia is still in kids club. It is not a break.',
      checklist: list(
        'Sit down, laptop or phone open — no scrolling',
        'Return 3 calls / texts',
        'Approve anything waiting on you',
        'Clear 10 emails',
        'Drive home by 9:50 for nap',
      ),
    }),
    block('Drive Home + Stroller Walk', 'sophia', [2], '09:15', '10:00', {
      checklist: list('Drive home', 'Short stroller walk before nap'),
    }),
    block('Baby Bounce — Library (9:00)', 'sophia', [3], '08:45', '09:45', {
      protected: true, reminders: [30],
      checklist: list('Leave by 8:45', 'Diaper bag + snack + water', 'Baby Bounce at 9:00'),
    }),
    block('Sophia Gymnastics (9:00) — ends mid-Dec', 'sophia', [4], '08:45', '09:45', {
      protected: true, reminders: [30], unconfirmed: true, until_date: '2026-12-17',
      description: 'End date is "mid-December" — confirm the last class and update the end date.',
      checklist: list('Leave by 8:45', 'Comfy clothes + water + snack', 'Gymnastics at 9:00'),
    }),
    block('Nap Routine + Desk Setup', 'sophia', WEEKDAYS, '10:00', '10:30', {
      checklist: list('Snack + diaper', 'Nap down', 'Desk: water, headphones, CRM open, phone on Do Not Disturb (except calls)'),
    }),

    // ── Nap = money time ─────────────────────────────────────────────────────
    block('Lead Gen & Prospecting', 'money', [1, 3, 4, 5], '10:30', '11:30', {
      protected: true,
      description: 'Income-producing only. 12:30 PM Eastern for Florida contacts. No email, no content, no admin.',
      checklist: list(
        'Call / text 10 new prospects (FSBO, expireds, renters, past clients, sphere)',
        'Every new conversation → CRM with a next step',
        'Ask every person: "Who do you know looking to buy, sell or rent?"',
        'Book at least 1 appointment',
        'Log your numbers: dials, conversations, appointments',
      ),
    }),
    block('Agent Training (Zoom)', 'meetings', [2], '10:30', '11:15', {
      protected: true, reminders: [1440, 15],
      description: '12:30 PM Eastern. Topic rotates weekly — this week\'s topic is shown above.\n\nStanding agenda:\n• Wins of the week (5 min)\n• Training topic (25 min)\n• Q&A (10 min)\n• One action item per agent (5 min)',
      rotation: [
        'Sales strategies & scripts',
        'Lead generation',
        'Contracts (FL & CO)',
        'Transaction management',
        'Brokerage procedures & compliance',
        'CRM & portal system training',
      ],
      checklist: list(
        'Day before: prep 1 slide or doc for this week\'s topic',
        'Send Zoom link + topic reminder to agents',
        'Record the session → save to Training',
        'Post the action items in the agent group',
      ),
    }),
    block('Lead Gen Sprint', 'money', [2], '11:15', '11:50', {
      protected: true,
      checklist: list('Call / text 6 prospects', 'Every conversation → CRM with a next step', 'Book 1 appointment'),
    }),
    block('Follow-Up & Pipeline', 'money', [1, 3, 5], '11:30', '12:30', { protected: true, checklist: FOLLOW_UP }),
    block('Follow-Up & Pipeline', 'money', [2], '11:50', '12:30', { protected: true, checklist: FOLLOW_UP }),
    block('Agent 1:1 Check-ins (Zoom)', 'meetings', [4], '11:30', '12:00', {
      protected: true, reminders: [15],
      description: '1:30 PM Eastern. Rotate through agents — 2 per week, 15 min each.\n\nStanding agenda:\n• Pipeline: who are you working with?\n• Stuck deals / contract questions\n• Their numbers vs goal\n• One thing I can help with this week',
      checklist: list('Agent 1 — pipeline, stuck deals, goal check', 'Agent 2 — pipeline, stuck deals, goal check', 'Log notes in the portal'),
    }),
    block('Follow-Up & Pipeline', 'money', [4], '12:00', '12:30', { protected: true, checklist: FOLLOW_UP }),

    // ── Posting & engagement (posts are pre-scheduled) ───────────────────────
    block('Post & Engage — @rlcrealtycoleasing', 'content', [1], '12:30', '12:45', {
      reminders: [0],
      description: 'Today\'s post: Rental Deal of the Week\nPlatforms: Instagram Reel + TikTok\nAccount: @rlcrealtycoleasing',
      checklist: POST_ENGAGE,
    }),
    block('Post & Engage — @rlcrealtyco', 'content', [2], '12:30', '12:45', {
      reminders: [0],
      description: 'Today\'s post: Agent Spotlight (agent, their listing, rental or win)\nPlatforms: Instagram Reel + TikTok\nAccount: @rlcrealtyco',
      checklist: POST_ENGAGE,
    }),
    block('Post & Engage — @royannacarbajal', 'content', [3], '12:30', '12:45', {
      reminders: [0],
      description: 'Today\'s post: Founder / business lesson (what I\'m building, a lesson, a win)\nPlatforms: TikTok + Instagram Reel\nAccount: @royannacarbajal\nPrivacy rule: no location, no Sophia\'s face unless you choose to.',
      checklist: POST_ENGAGE,
    }),
    block('Post & Engage — @rlcrealtyco', 'content', [4], '12:30', '12:45', {
      reminders: [0],
      description: 'Today\'s post: Just Listed / Just Leased / Closed / Market Update\nPlatforms: Instagram (Reel or carousel) + TikTok\nAccount: @rlcrealtyco',
      checklist: POST_ENGAGE,
    }),
    block('Post & Engage — @rlcrealtycoleasing', 'content', [5], '12:30', '12:45', {
      reminders: [0],
      description: 'Today\'s post: Weekend Move-In Specials roundup\nPlatforms: Instagram carousel + Story\nAccount: @rlcrealtycoleasing',
      checklist: POST_ENGAGE,
    }),

    // ── Afternoons ───────────────────────────────────────────────────────────
    block('Lunch with Sophia', 'sophia', WEEKDAYS, '12:45', '13:30', {
      checklist: list('Lunch together', 'Water', 'Clean up'),
    }),
    block('Sophia Time — Outdoor Play', 'sophia', [1, 4], '13:30', '14:30', {
      description: 'Phone away. Ideas: park, swings, nature walk, sandbox, bubbles.',
      checklist: list('Get outside', 'Climb, crawl, walk practice', 'Name what you see'),
    }),
    block('Sophia Time — Learning Play', 'sophia', [3], '13:30', '14:30', {
      description: 'Phone away. Ideas: board books, stacking/sorting, music & clapping, sensory bin, animal sounds.',
      checklist: list('Read 3 books', 'One hands-on activity (stack, sort, sensory)', 'Music & movement'),
    }),
    block('Film Content (with Sophia)', 'content', [2], '13:30', '14:45', {
      protected: true, reminders: [60],
      description: 'Film ALL of next week\'s posts in this one outing (Sophia in stroller/carrier). Editing happens Wednesday — not today.',
      checklist: list(
        'Rental walkthrough / building b-roll (leasing: Mon + Fri posts)',
        'Agent spotlight clip or agent-sent footage (brokerage: Tue)',
        'Listing / closing / market clip (brokerage: Thu)',
        'Founder talking-head clip (personal: Wed)',
        'Upload all clips to the "To Edit" folder before you leave',
      ),
    }),
    block('Weekly Business & Financial Review', 'business', [5], '13:30', '14:30', {
      protected: true, reminders: [60], link: '/finance',
      description: 'Sophia: high-chair snack or independent play next to you.',
      checklist: list(
        'Money in this week (commissions received, rent/lease fees)',
        'Commissions owed to you — who, how much, when',
        'Outstanding payments to agents / vendors',
        'Bills & expenses due in the next 14 days (see Calendar → bills)',
        'Pipeline: new leads, appointments, under contract, closings',
        'Marketing: best post & worst post this week — and WHY',
        'Lead sources: where did this week\'s leads come from?',
        'One adjustment for next week → Inbox',
      ),
    }),
    block('Sophia Time — Play & Explore', 'sophia', [5], '14:30', '15:30', {
      checklist: list('Phone away', 'Play outside or a new place (library, store, park)'),
    }),
    block('Messages & Admin Sweep', 'business', [1, 2, 3, 4], '15:00', '15:30', {
      description: 'Light, interruptible work while Sophia plays nearby. Timer: 30 minutes, then stop.',
      checklist: list('Texts & DMs — reply or move to Inbox', 'Email — 2-minute rule', 'Sign / approve anything waiting', 'Capture anything new into the Inbox'),
    }),

    // ── Evenings (after bedtime) ─────────────────────────────────────────────
    block('Content Planning — Next Week', 'content', [1], '19:45', '20:30', {
      checklist: list(
        'Pick next week\'s 5 posts (Mon leasing · Tue agent · Wed personal · Thu brokerage · Fri leasing)',
        'Ask agents for listings, closings, wins to feature',
        'Write hooks + shot list for Tuesday\'s filming',
        'Check marketing dates coming up (Dates page)',
      ),
    }),
    block('Learning Block — Pick Your Topic', 'learning', [2], '19:45', '20:30', {
      description: 'For the thing you keep postponing. Set ONE topic, rename this block to it, and work on only that.',
      checklist: list('Open the course / material', '40 minutes on ONE topic', 'Write 1 takeaway + 1 action into the Inbox'),
    }),
    block('Build Block #2 — Systems & Portal', 'business', [3], '19:45', '20:30', {
      checklist: list('Continue Monday\'s build task from where you stopped', 'Write the next step before closing'),
    }),
    block('Schedule Next Week\'s Posts', 'content', [4], '19:45', '20:15', {
      checklist: list(
        'Load the 5 finished posts into Meta Business Suite / TikTok scheduler',
        'Post time: 11:00 AM MT (1:00 PM ET)',
        'Double-check accounts: @rlcrealtyco · @rlcrealtycoleasing · @royannacarbajal',
      ),
    }),
    block('Tomorrow Setup', 'personal', [1, 2, 3, 4], '20:30', '20:45', {
      checklist: list(
        'Empty the Quick Capture Inbox (2 min — sort, don\'t do)',
        'Pick tomorrow\'s Top 3 (★ in the Inbox)',
        'Check tomorrow\'s appointments',
        'Bags packed (gym / diaper)',
        'Close the laptop',
      ),
    }),
    block('Weekly Planning', 'business', [0], '19:45', '20:45', {
      protected: true, reminders: [60, 10],
      description: 'Start the week before it starts.',
      checklist: list(
        'What has to be MADE this week? (listings, posts, docs, builds)',
        'What is BLOCKED — and who/what unblocks it?',
        'What do I OWE people? (callbacks, docs, payments, answers)',
        'What is still UNBUILT? Pick Monday\'s ONE build task',
        'Review this week\'s appointments, showings & deadlines',
        'Content: confirm the 5 posts for this week are scheduled',
        'Agent training topic for Tuesday — prep needed?',
        'Birthdays / dates in the next 14 days',
        'Empty the Inbox; star Monday\'s Top 3',
      ),
    }),
    {
      ...block('Month-End Review', 'business', [], '19:45', '20:45', {
        protected: true, reminders: [4320, 60], link: '/finance',
        description: 'Full financial + content analysis. Takes over this evening\'s block.',
        checklist: list(
          'Revenue: closed deals, leases, commissions received',
          'Commissions still owed to you — chase list',
          'Expenses & subscriptions — cancel what you don\'t use',
          'Profit vs. last month',
          'Bills & taxes due next month',
          'Pipeline: leads → appointments → contracts → closings (conversion)',
          'Agents: production, recruiting, onboarding status',
          'Content: posts made vs. planned; best & worst performers and why',
          'Followers & inquiries per account',
          'Set next month\'s 3 goals',
        ),
      }),
      recurrence: { freq: 'monthly_last' },
    },
  ]
}

export function buildStarterDates() {
  const date = (title, date_type, start_date, recurrence, extra = {}) => ({
    id: uid(),
    title,
    category: date_type === 'marketing' ? 'content' : 'dates',
    kind: 'date',
    date_type,
    start_date,
    until_date: null,
    all_day: true,
    start_time: null,
    end_time: null,
    recurrence,
    description: '',
    checklist: [],
    rotation: null,
    reminders: [60480, 20160],      // 6 weeks + 2 weeks out
    location: null,
    meeting_url: null,
    link: null,
    unconfirmed: false,
    protected: false,
    ...extra,
  })
  const prep = (...extra) => list(
    'Pick the offer / angle for each account',
    'Leasing: rental specials or move-in deal tied to the date',
    'Brokerage: listing feature, agent post, or client event',
    ...extra,
    'Film + edit at least 1 week before',
    'Schedule posts + email blast',
  )
  return [
    date('Halloween', 'marketing', '2026-10-31', { freq: 'yearly' }, { checklist: prep('Personal: family-friendly costume content (optional)') }),
    date('Singles\' Day (11.11)', 'marketing', '2026-11-11', { freq: 'yearly' }, { checklist: prep('Leasing: "Solo living" studio & 1-bed deals') }),
    date('Thanksgiving', 'marketing', '2026-01-01', { freq: 'yearly_nth', month: 10, weekday: 4, nth: 4 }, { checklist: prep('Client gratitude post / past-client check-ins') }),
    date('Black Friday', 'marketing', '2026-01-01', { freq: 'yearly_nth', month: 10, weekday: 4, nth: 4, offsetDays: 1 }, { checklist: prep('Leasing: Black Friday move-in specials roundup') }),
    date('Cyber Monday', 'marketing', '2026-01-01', { freq: 'yearly_nth', month: 10, weekday: 4, nth: 4, offsetDays: 4 }, { checklist: prep('Online offer: free buyer/renter consult, digital guides') }),
    date('New Year\'s Day', 'marketing', '2026-01-01', { freq: 'yearly' }, { checklist: prep('Year-in-review post + "new year, new home" campaign') }),
  ]
}

export function buildStarterTasks() {
  const t = (title, extra = {}) => ({
    id: uid(), title, notes: null, priority: 'high', status: 'next', category: null,
    due_date: null, scheduled_date: null, scheduled_time: null, duration_min: 30,
    focus_date: null, completed_at: null, created_at: new Date().toISOString(), ...extra,
  })
  return [
    t('Halloween & Singles\' Day — late start: decide on 1 post each (6-week window already passed)'),
    t('Add birthdays, events, deadlines & campaigns on the Dates page', { priority: 'medium' }),
    t('Confirm Sophia\'s last gymnastics class and update the end date', { priority: 'medium' }),
    t('Pick the Learning Block topic and rename the block', { priority: 'medium' }),
    t('Add the Zoom link to Agent Training + Agent 1:1 blocks', { priority: 'medium' }),
  ]
}
