import { useState, useRef, useEffect } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { formatCurrency, formatDate, normalizeDate, today, uid } from '../utils/formatters.js'
import { categorizeTransactions } from '../utils/anthropic.js'
import Papa from 'papaparse'

// ─── Category System ──────────────────────────────────────────────────────────
const GROUP_ORDER = ['Income', 'Bills', 'Expenses', 'Subscriptions', 'Savings', 'Debts']
const GROUP_STYLE = {
  Income:        { color:'var(--green)',   bg:'var(--green-bg)',  border:'#86efac' },
  Bills:         { color:'var(--blue)',    bg:'var(--blue-bg)',   border:'#93c5fd' },
  Expenses:      { color:'var(--amber)',   bg:'var(--amber-bg)',  border:'#fcd34d' },
  Subscriptions: { color:'#7c3aed',       bg:'#f5f3ff',          border:'#c4b5fd' },
  Savings:       { color:'#0f766e',       bg:'#f0fdfa',          border:'#99f6e4' },
  Debts:         { color:'var(--red)',     bg:'var(--red-bg)',    border:'#fca5a5' },
}

const TXN_STATUS = {
  investigate: { label:'Needs Investigation',    icon:'🔍', color:'#b45309', bg:'#fffbeb', border:'#fcd34d' },
  alert:       { label:'Alert',                  icon:'⚠️',  color:'#dc2626', bg:'#fef2f2', border:'#fca5a5' },
  refund:      { label:'Need to Request Refund', icon:'💰', color:'#7c3aed', bg:'#f5f3ff', border:'#c4b5fd' },
}

// ─── Built-in Vendor → Category Map ──────────────────────────────────────────
const BUILTIN_VENDOR_MAP = [
  // Gas & Fuel
  { kw:['chevron','shell','exxon','exxonmobil','mobil gas','bp gas','bp station','texaco','citgo','marathon gas','sunoco','valero','speedway gas','wawa gas','sheetz','circle k gas','racetrac','murphy usa','casey\'s gas','kwik trip','loves travel','pilot flying j','getgo gas','holiday stationstores','fl est fuel','gas station','gasoline'],  category:'Mileage/Gas' },
  // Rideshare
  { kw:['uber trip','lyft ride','via ride','curb taxi','yellow cab'],  category:'Rideshare (Uber/Lyft)' },
  // Flights
  { kw:['delta air','united airlines','american airlines','southwest airlines','jetblue','spirit airlines','frontier airlines','alaska airlines','air canada','british airways','expedia air','kayak flights','priceline flights'],  category:'Travel - Flights' },
  // Hotels / Lodging
  { kw:['marriott','hilton','hyatt','ihg hotels','holiday inn','best western','hampton inn','courtyard marriott','residence inn','doubletree','sheraton','westin','embassy suites','airbnb','vrbo','motel 6','la quinta','comfort inn','super 8','days inn','quality inn'],  category:'Travel - Accommodation' },
  // Car Rental
  { kw:['enterprise rent','hertz rental','avis rental','budget car rental','national car rental','alamo car','dollar rent a car','thrifty car rental'],  category:'Travel - Transportation' },
  // Parking
  { kw:['parkwhiz','spothero','lazerparking','imperial parking','propark','ace parking','republic parking','parking garage','parking meter','city parking'],  category:'Public Parking' },
  // Meals & Dining
  { kw:['mcdonald','starbucks','dunkin','chick-fil-a','chick fil a','chipotle','panera','subway restaurant','domino\'s pizza','pizza hut','taco bell','burger king','wendy\'s','olive garden','applebee\'s','ihop','denny\'s','cracker barrel','buffalo wild wings','outback steakhouse','longhorn steakhouse','cheesecake factory','red lobster','five guys','panda express','popeyes chicken','raising cane','wingstop','jersey mike','firehouse subs','potbelly','jason\'s deli','waffle house','bob evans','first watch','doordash','grubhub','ubereats','uber eats','door dash','grub hub'],  category:'Meals (Business-Related)' },
  // Travel Meals (sit-down, not fast food) — keep broad
  // Amazon & Supplies
  { kw:['amazon.com','amazon mktpl','amzn mktp','amazon retail','amazon prime'],  category:'Supplies' },
  { kw:['refund amazon','amazon refund','amzn refund'],  category:'Refund — Amazon' },
  { kw:['staples store','office depot','officemax','uline','quill corp'],  category:'Supplies' },
  // Printing / Branding
  { kw:['vistaprint','moo print','gotprint','48hourprint','printingforless','fedex office','fedex kinkos','ups store printing','signarama','fastsigns','signco','banana tags'],  category:'Printing/Branding' },
  // Signs / Lockboxes
  { kw:['supra lockbox','sentrilock','real estate sign','yard sign','open house sign'],  category:'Signs/Lockboxes' },
  // Photography / Virtual Tours
  { kw:['matterport','iguide 360','zillow 3d','virtual tour','drone photo','real estate photo','aerial photography'],  category:'Photography/Videography' },
  // Marketing & Ads
  { kw:['facebook ads','meta ads','google ads','google adwords','linkedin ads','instagram ads','tiktok ads','youtube ads','corefact','postcard mania','redx ','propstream','batchleads','batch leads','mojo dialing','vulcan7','landvoice','realvolve'],  category:'Marketing & Ads' },
  // Website Hosting
  { kw:['godaddy','namecheap','bluehost','hostgator','siteground','cloudflare','wix.com','weebly','squarespace hosting','webflow'],  category:'Website Hosting' },
  // Named subscriptions → exact existing categories
  { kw:['canva'],  category:'Canva' },
  { kw:['adobe ','adobe.com','acrobat pro','creative cloud','lightroom subscription'],  category:'Adobe' },
  { kw:['chatgpt','openai subscription'],  category:'ChatGPT' },
  { kw:['coffee & contracts','coffeeandcontracts'],  category:'Coffee & Contracts' },
  { kw:['cognito forms','cognitoforms'],  category:'Cognito Forms' },
  { kw:['microsoft workspace','microsoft 365','office 365','office365','msft 365'],  category:'Microsoft Workspace' },
  { kw:['dotloop'],  category:'Dotloop Transaction Management' },
  { kw:['monday.com','monday crm'],  category:'Monday CRM Software' },
  // General software → Other Subscription
  { kw:['zoom subscription','dropbox','google workspace','gsuite','slack subscription','notion','hubspot','mailchimp','constant contact','asana','trello','clickup','airtable','zapier','github subscription','figma','miro subscription','loom','calendly','typeform','docusign','hellosign','pandadoc','freshbooks','quickbooks','intuit subscription','freshdesk','zendesk','intercom','netlify','digitalocean','heroku','vercel subscription','aws subscription','amazon web services'],  category:'Other Subscription' },
  // MLS / Real Estate professional fees
  { kw:['stellar mls','mls membership','matrix mls','flexmls','rapattoni','mlslistings','realtor association','nar dues','board of realtors','car dues','nar annual'],  category:'MLS Dues' },
  // E&O Insurance
  { kw:['e&o insurance','eo insurance','errors omissions','hiscox professional','rice insurance','cna professional liability'],  category:'E&O Insurance' },
  // Accounting / Legal
  { kw:['h&r block','h & r block','turbotax','taxact','jackson hewitt','legalzoom','rocket lawyer','cpa fee','cpa payment','accountant fee','attorney fee','notary fee','accounting service'],  category:'Accounting/Professional Fees' },
  // Education
  { kw:['udemy','coursera','skillshare','masterclass','linkedin learning','pluralsight','keller williams training','real estate express','colibri real','the ce shop','aceable agent','continuing education','coaching program','real estate course'],  category:'Education/Coaching' },
  // Mortgage
  { kw:['quicken loans','rocket mortgage','wells fargo mortgage','chase mortgage','bank of america mortgage','mr. cooper','pennymac','loandepot','freedom mortgage','caliber home loans','mortgage payment','home loan payment'],  category:'Mortgage Loan' },
  // Bank fees
  { kw:['service charge','monthly maintenance fee','overdraft fee','nsf fee','wire transfer fee','atm fee','account fee','bank service fee'],  category:'Bank Service Fees' },
  // Credit card payments
  { kw:['payment thank you','autopay payment','credit card autopay','chase payment','amex payment','american express payment','discover card payment','capital one payment','citi payment','citibank payment','synchrony payment','barclays payment'],  category:'Credit Card Payment' },
  // Savings / Investment transfers
  { kw:['transfer to savings','savings deposit','robinhood deposit','fidelity deposit','charles schwab deposit','etrade deposit','vanguard deposit','acorns deposit','betterment deposit'],  category:'Personal Savings' },
  // Client gifts
  { kw:['gift card purchase','1-800-flowers','teleflora','edible arrangements','wine gift','closing gift'],  category:'Client Gifts' },
]

// Match a description: custom rules → built-in map → payee history
function matchVendor(description, customRules, payeeRules, categories) {
  if (!description) return null
  const norm = description.toLowerCase().trim()

  // 1. Custom rules (highest priority)
  for (const rule of (customRules || []).filter(r => r.enabled !== false)) {
    if (norm.includes(rule.contains.toLowerCase().trim())) {
      const cat = categories.find(c => c.name === rule.category)
      if (cat) return { cat, source: 'custom' }
    }
  }

  // 2. Built-in vendor map
  for (const entry of BUILTIN_VENDOR_MAP) {
    for (const kw of entry.kw) {
      if (norm.includes(kw)) {
        const cat = categories.find(c => c.name === entry.category)
        if (cat) return { cat, source: 'builtin' }
      }
    }
  }

  // 3. Transaction history — exact then prefix
  if (payeeRules[norm]) {
    const cat = categories.find(c => c.name === payeeRules[norm])
    if (cat) return { cat, source: 'history' }
  }
  for (const [k, catName] of Object.entries(payeeRules)) {
    const len = Math.min(k.length, norm.length, 10)
    if (len >= 5 && k.slice(0, len) === norm.slice(0, len)) {
      const cat = categories.find(c => c.name === catName)
      if (cat) return { cat, source: 'history' }
    }
  }

  return null // unknown merchant
}

const DEFAULT_CATEGORIES = [
  { id:uid(), name:'Commission Income',                       group:'Income',        kind:'business' },
  { id:uid(), name:'Wholesale Fees',                          group:'Income',        kind:'business' },
  { id:uid(), name:'Rental Income',                           group:'Income',        kind:'business' },
  { id:uid(), name:'Referral Fee',                            group:'Income',        kind:'business' },
  { id:uid(), name:'Consulting Income',                       group:'Income',        kind:'business' },
  { id:uid(), name:'Personal Income / Salary',                group:'Income',        kind:'personal' },
  { id:uid(), name:'Other Income',                            group:'Income',        kind:'both'     },
  { id:uid(), name:'Refund — Amazon',                        group:'Income',        kind:'both'     },
  { id:uid(), name:'Refund — Store Return',                  group:'Income',        kind:'both'     },
  { id:uid(), name:'Refund — Vendor Credit',                 group:'Income',        kind:'business' },
  { id:uid(), name:'Refund — Client Reimbursement',          group:'Income',        kind:'business' },
  { id:uid(), name:'Other Refund / Credit',                  group:'Income',        kind:'both'     },
  { id:uid(), name:'MLS Dues',                                group:'Bills',         kind:'business' },
  { id:uid(), name:'E&O Insurance',                           group:'Bills',         kind:'business' },
  { id:uid(), name:'Brokerage Insurance',                     group:'Bills',         kind:'business' },
  { id:uid(), name:'Virtual Assistant/Admin',                 group:'Bills',         kind:'business' },
  { id:uid(), name:'Monday CRM Software',                     group:'Bills',         kind:'business' },
  { id:uid(), name:'Website Hosting',                         group:'Bills',         kind:'business' },
  { id:uid(), name:'Microsoft Workspace',                     group:'Bills',         kind:'business' },
  { id:uid(), name:'Dotloop Transaction Management',          group:'Bills',         kind:'business' },
  { id:uid(), name:'Mortgage Loan',                           group:'Bills',         kind:'both'     },
  { id:uid(), name:'Accounting/Professional Fees',            group:'Bills',         kind:'business' },
  { id:uid(), name:'Marketing & Ads',                         group:'Expenses',      kind:'business' },
  { id:uid(), name:'Photography/Videography',                 group:'Expenses',      kind:'business' },
  { id:uid(), name:'Signs/Lockboxes',                         group:'Expenses',      kind:'business' },
  { id:uid(), name:'Open House Expenses',                     group:'Expenses',      kind:'business' },
  { id:uid(), name:'Client Gifts',                            group:'Expenses',      kind:'business' },
  { id:uid(), name:'Meals (Business-Related)',                group:'Expenses',      kind:'business' },
  { id:uid(), name:'Mileage/Gas',                             group:'Expenses',      kind:'both'     },
  { id:uid(), name:'Education/Coaching',                      group:'Expenses',      kind:'business' },
  { id:uid(), name:'Event Costs',                             group:'Expenses',      kind:'business' },
  { id:uid(), name:'Supplies',                                group:'Expenses',      kind:'both'     },
  { id:uid(), name:'Printing/Branding',                       group:'Expenses',      kind:'business' },
  { id:uid(), name:'Owner Draw/Personal Use',                 group:'Expenses',      kind:'personal' },
  { id:uid(), name:'Agent Commission',                        group:'Expenses',      kind:'business' },
  { id:uid(), name:'Events/Conferences',                      group:'Expenses',      kind:'business' },
  { id:uid(), name:'Travel - Meals',                          group:'Expenses',      kind:'both'     },
  { id:uid(), name:'Travel - Flights',                        group:'Expenses',      kind:'both'     },
  { id:uid(), name:'Travel - Transportation',                 group:'Expenses',      kind:'both'     },
  { id:uid(), name:'Travel - Accommodation',                  group:'Expenses',      kind:'both'     },
  { id:uid(), name:'Travel - Entertainment',                  group:'Expenses',      kind:'both'     },
  { id:uid(), name:'Public Parking',                          group:'Expenses',      kind:'both'     },
  { id:uid(), name:'Refunds/Credits',                         group:'Expenses',      kind:'both'     },
  { id:uid(), name:'Bank Service Fees',                       group:'Expenses',      kind:'both'     },
  { id:uid(), name:'Rideshare (Uber/Lyft)',                   group:'Expenses',      kind:'both'     },
  { id:uid(), name:'ESCROW - Client Funds Held',              group:'Expenses',      kind:'business' },
  { id:uid(), name:'Client Application Fee (Reimbursable)',   group:'Expenses',      kind:'business' },
  { id:uid(), name:'Owner Draw/Personal Compensation',        group:'Expenses',      kind:'personal' },
  { id:uid(), name:'Personal Broker Compensation - Accrued', group:'Expenses',      kind:'business' },
  { id:uid(), name:'Client Advance (Reimbursable)',           group:'Expenses',      kind:'business' },
  { id:uid(), name:'RJ Finish + Drywall Expenses',            group:'Expenses',      kind:'business' },
  { id:uid(), name:'RJ Realty Group Expenses',                group:'Expenses',      kind:'business' },
  { id:uid(), name:'Broker to Broker Agent Commission Split', group:'Expenses',      kind:'business' },
  { id:uid(), name:'Unknown',                                 group:'Expenses',      kind:'both'     },
  { id:uid(), name:'Other',                                   group:'Expenses',      kind:'both'     },
  { id:uid(), name:'Canva',                                   group:'Subscriptions', kind:'business' },
  { id:uid(), name:'Adobe',                                   group:'Subscriptions', kind:'business' },
  { id:uid(), name:'ChatGPT',                                 group:'Subscriptions', kind:'business' },
  { id:uid(), name:'Coffee & Contracts',                      group:'Subscriptions', kind:'business' },
  { id:uid(), name:'Cognito Forms',                           group:'Subscriptions', kind:'business' },
  { id:uid(), name:'Other Subscription',                      group:'Subscriptions', kind:'both'     },
  { id:uid(), name:'Business Emergency Fund',                 group:'Savings',       kind:'business' },
  { id:uid(), name:'Personal Savings',                        group:'Savings',       kind:'personal' },
  { id:uid(), name:'Investment Account',                      group:'Savings',       kind:'both'     },
  { id:uid(), name:'Credit Card Payment',                     group:'Debts',         kind:'both'     },
  { id:uid(), name:'Student Loan',                            group:'Debts',         kind:'personal' },
  { id:uid(), name:'Business Loan',                           group:'Debts',         kind:'business' },
  { id:uid(), name:'Other Debt Payment',                      group:'Debts',         kind:'both'     },
]

const DEFAULT_ACCOUNTS = [
  { id:'a1', name:'Chase Checking',    balance:0, type:'checking',    ownership:'personal', isLiability:false, countInNetWorth:true,  balanceHistory:[] },
  { id:'a2', name:'Chase Savings',     balance:0, type:'savings',     ownership:'personal', isLiability:false, countInNetWorth:true,  balanceHistory:[] },
  { id:'a3', name:'Chase Credit Card', balance:0, type:'credit_card', ownership:'personal', isLiability:true,
    creditLimit:0, minPayment:0, dueDate:'', apr:'', paymentStatus:'upcoming', countInNetWorth:true, balanceHistory:[] },
]

// ─── Payment Status Helpers ───────────────────────────────────────────────────
function payStatusStyle(status) {
  if (status==='paid')    return { bg:'#f0fdf4', color:'#15803d', border:'#86efac', label:'✓ Paid'     }
  if (status==='overdue') return { bg:'#fef2f2', color:'#dc2626', border:'#fca5a5', label:'⚠ Overdue'  }
  return                         { bg:'#fffbeb', color:'#b45309', border:'#fcd34d', label:'⏳ Upcoming' }
}

// dueDate is now a day-of-month number (1–31), not a full ISO date
function isDueSoon(dueDay) {
  const n = parseInt(dueDay)
  if (!n || n < 1 || n > 31) return false
  const now   = new Date()
  const thisM = new Date(now.getFullYear(), now.getMonth(),     n)
  const nextM = new Date(now.getFullYear(), now.getMonth() + 1, n)
  const target = thisM >= now ? thisM : nextM
  const diff   = (target - now) / 86400000
  return diff >= 0 && diff <= 7
}

function formatDueDay(dueDay) {
  const n = parseInt(dueDay)
  if (!n) return ''
  const s = n===1||n===21||n===31 ? 'st' : n===2||n===22 ? 'nd' : n===3||n===23 ? 'rd' : 'th'
  return `${n}${s}`
}

// ─── Monthly Payment Calendar ──────────────────────────────────────────────────
function PaymentsCalendar({ accounts }) {
  const now      = new Date()
  const year     = now.getFullYear()
  const month    = now.getMonth()
  const todayDay = now.getDate()
  const monthName = now.toLocaleString('default', { month:'long' })

  const liabs = accounts.filter(a => a.isLiability && a.dueDate)

  const firstDow   = new Date(year, month, 1).getDay()   // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < firstDow; i++)    cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0)        cells.push(null)

  function getDue(day) {
    return liabs.filter(a => parseInt(a.dueDate) === day)
  }

  return (
    <div className="card mb-24">
      <div className="card-header">
        <h3>📅 {monthName} {year} — Payment Calendar</h3>
        <span style={{fontSize:'0.72rem',color:'var(--text-muted)'}}>Recurring monthly due dates</span>
      </div>
      <div style={{padding:'12px 16px 16px'}}>
        {/* Day-of-week headers */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3,marginBottom:3}}>
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>(
            <div key={d} style={{textAlign:'center',fontSize:'0.62rem',fontWeight:'bold',color:'var(--text-muted)',padding:'3px 0'}}>{d}</div>
          ))}
        </div>
        {/* Date cells */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3}}>
          {cells.map((day,i)=>{
            const due = day ? getDue(day) : []
            const isToday  = day === todayDay
            const isPast   = day !== null && day < todayDay
            const hasDue   = due.length > 0
            return (
              <div key={i} style={{
                minHeight: 52,
                padding: '4px 3px',
                borderRadius: 6,
                background: isToday ? 'var(--blue-bg)' : hasDue ? '#fef2f2' : day ? 'var(--surface-hover)' : 'transparent',
                border: `1px solid ${isToday ? '#93c5fd' : hasDue ? '#fca5a5' : 'transparent'}`,
                opacity: isPast ? 0.5 : 1,
                transition: 'opacity 0.15s',
              }}>
                {day && <>
                  <div style={{fontSize:'0.72rem',fontWeight:isToday?'bold':'normal',color:isToday?'var(--blue)':hasDue?'var(--red)':'var(--text)',textAlign:'center',marginBottom:2}}>
                    {day}
                  </div>
                  {due.map(a=>(
                    <div key={a.id} title={a.name} style={{
                      fontSize:'0.6rem',color:'#fff',fontWeight:'bold',
                      background:'var(--red)',borderRadius:4,padding:'1px 3px',
                      overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
                      lineHeight:1.4,marginBottom:1,textAlign:'center',
                    }}>
                      {a.name.length > 10 ? a.name.replace(/Chase\s*/i,'').replace(/Credit Card/i,'CC').substring(0,9) : a.name}
                    </div>
                  ))}
                </>}
              </div>
            )
          })}
        </div>
        {/* Legend */}
        {liabs.length > 0 ? (
          <div style={{marginTop:12,display:'flex',flexWrap:'wrap',gap:6}}>
            {liabs.map(a=>(
              <div key={a.id} style={{display:'flex',alignItems:'center',gap:5,fontSize:'0.72rem',padding:'3px 10px',background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:20}}>
                <span style={{width:7,height:7,borderRadius:'50%',background:'var(--red)',display:'inline-block',flexShrink:0}}/>
                <span style={{color:'var(--text)'}}>{a.name}</span>
                <span style={{color:'var(--red)',fontWeight:'bold'}}>— {a.dueDate ? `${formatDueDay(a.dueDate)} of each month` : 'no date set'}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{textAlign:'center',padding:'12px 0 0',color:'var(--text-faint)',fontSize:'0.82rem'}}>
            No recurring due dates yet — edit a liability to set its payment day
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getGroup(txn, categories) {
  const cat = categories.find(c => c.name === txn.category)
  if (cat) return cat.group
  return txn.type === 'income' ? 'Income' : 'Expenses'
}

function DollarInput({ value, onChange, placeholder='0.00', style: s={} }) {
  return (
    <div style={{ display:'flex', alignItems:'stretch' }}>
      <span style={{
        padding:'7px 8px', background:'var(--surface-hover)', borderRadius:'var(--radius) 0 0 var(--radius)',
        border:'1px solid var(--border)', borderRight:'none', color:'var(--text-muted)', fontSize:'0.875rem',
        display:'flex', alignItems:'center', lineHeight:1,
      }}>$</span>
      <input type="number" step="0.01" min="0" placeholder={placeholder} value={value} onChange={onChange}
        style={{ borderRadius:`0 var(--radius) var(--radius) 0`, flex:1, ...s }} />
    </div>
  )
}

function KindBadge({ kind }) {
  if (kind==='business') return <span className="badge badge-blue"  style={{fontSize:'0.65rem'}}>Business</span>
  if (kind==='personal') return <span className="badge badge-pink"  style={{fontSize:'0.65rem'}}>Personal</span>
  return                        <span className="badge badge-gray"  style={{fontSize:'0.65rem'}}>Both</span>
}

// ─── Reusable Transaction Form ────────────────────────────────────────────────
const REFUND_CATS = ['Refund — Amazon','Refund — Store Return','Refund — Vendor Credit','Refund — Client Reimbursement','Other Refund / Credit']

function TxnForm({ categories, accounts=[], onAdd, defaultGroup, onCancel, forRefund=false }) {
  const initial = {
    date:today(), description:'', amount:'',
    category: forRefund
      ? (categories.find(c=>REFUND_CATS.includes(c.name))?.name || 'Other Refund / Credit')
      : defaultGroup ? (categories.find(c=>c.group===defaultGroup)?.name||'') : '',
    spendingType:'business', status:'cleared', account:'', accountId:'', notes:'',
    isRefund: forRefund,
  }
  const [form, setForm] = useState(initial)

  const catRec   = categories.find(c=>c.name===form.category)
  const catGroup = catRec?.group || defaultGroup || 'Expenses'
  const isIncome = catGroup === 'Income'

  function submit(e) {
    e.preventDefault()
    if (!form.description || !form.amount || !form.category) return
    onAdd({ ...form, id:uid(), amount:Math.abs(parseFloat(form.amount)), type:isIncome?'income':'expense', group:catGroup })
    setForm({ ...initial, category:form.category, spendingType:form.spendingType })
    onCancel?.()
  }

  // For refund form, only show refund income categories. Otherwise show group-filtered or all.
  const groupCats = forRefund
    ? categories.filter(c=>REFUND_CATS.includes(c.name))
    : defaultGroup ? categories.filter(c=>c.group===defaultGroup) : categories

  return (
    <form onSubmit={submit} style={{ background:'var(--surface-hover)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:16, marginBottom:16 }}>
      <div className="form-row">
        <div className="form-group">
          <label>Date</label>
          <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} required />
        </div>
        <div className="form-group" style={{gridColumn:'span 2'}}>
          <label>Description</label>
          <input placeholder="Vendor / Client / Note" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} required />
        </div>
        <div className="form-group">
          <label>Amount</label>
          <DollarInput value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} />
        </div>
        <div className="form-group">
          <label>Category</label>
          <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} required>
            <option value="">Select…</option>
            {groupCats.map(c=><option key={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Business / Personal</label>
          <select value={form.spendingType} onChange={e=>setForm({...form,spendingType:e.target.value})}>
            <option value="business">Business</option>
            <option value="personal">Personal</option>
          </select>
        </div>
        {isIncome && (
          <div className="form-group">
            <label>Status</label>
            <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
              <option value="cleared">Received ✓</option>
              <option value="pending">Pending…</option>
            </select>
          </div>
        )}
        <div className="form-group">
          <label>Account</label>
          {accounts.length > 0 ? (
            <select value={form.accountId||''} onChange={e=>{
              const a=accounts.find(x=>x.id===e.target.value)
              setForm({...form,accountId:e.target.value,account:a?.name||''})
            }}>
              <option value="">— None —</option>
              {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          ) : (
            <input placeholder="Chase Checking" value={form.account} onChange={e=>setForm({...form,account:e.target.value})} />
          )}
        </div>
      </div>
      <div style={{display:'flex',gap:8,marginTop:4}}>
        <button type="submit" className="btn btn-primary btn-sm">Save</button>
        {onCancel && <button type="button" className="btn btn-sm" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}

// ─── Overview ─────────────────────────────────────────────────────────────────
function Overview({ transactions, categories, accounts=[] }) {
  const posted  = transactions.filter(t=>t.status!=='pending_review')
  const incRec  = posted.filter(t=>t.type==='income'&&t.status!=='pending')
  const incPend = posted.filter(t=>t.type==='income'&&t.status==='pending')
  const exps    = posted.filter(t=>t.type!=='income')

  const totalRec  = incRec.reduce((s,t)=>s+Number(t.amount),0)
  const totalPend = incPend.reduce((s,t)=>s+Number(t.amount),0)
  const totalExp  = exps.reduce((s,t)=>s+Number(t.amount),0)
  const net       = totalRec - totalExp

  const bizInc  = incRec.filter(t=>t.spendingType!=='personal').reduce((s,t)=>s+Number(t.amount),0)
  const persInc = incRec.filter(t=>t.spendingType==='personal').reduce((s,t)=>s+Number(t.amount),0)
  const bizExp  = exps.filter(t=>t.spendingType!=='personal').reduce((s,t)=>s+Number(t.amount),0)
  const persExp = exps.filter(t=>t.spendingType==='personal').reduce((s,t)=>s+Number(t.amount),0)

  const byGroup = GROUP_ORDER.map(g=>{
    const gtxns = posted.filter(t=>getGroup(t,categories)===g)
    return { group:g, total:gtxns.reduce((s,t)=>s+Number(t.amount),0), count:gtxns.length }
  }).filter(g=>g.count>0)

  return (
    <div>
      <h2 className="mb-16">Overview</h2>
      <div className="metrics-grid mb-24" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
        <div className="metric-card metric-card-income"><div className="metric-label">Income Received</div><div className="metric-value text-green">{formatCurrency(totalRec,true)}</div><div className="metric-change neutral">{incRec.length} entries</div></div>
        <div className="metric-card metric-card-pending">
          <div className="metric-label">Pending Income</div>
          <div className="metric-value text-amber">{formatCurrency(totalPend,true)}</div>
          <div className="metric-change neutral">{incPend.length} entries</div>
        </div>
        <div className="metric-card metric-card-expense"><div className="metric-label">Total Expenses</div><div className="metric-value text-red">{formatCurrency(totalExp,true)}</div><div className="metric-change neutral">{exps.length} entries</div></div>
        <div className="metric-card metric-card-net">
          <div className="metric-label">Net Income</div>
          <div className={`metric-value ${net>=0?'text-green':'text-red'}`}>{formatCurrency(net,true)}</div>
        </div>
      </div>

      <div className="section-grid mb-24">
        <div className="card">
          <div className="card-header"><h3>Business</h3><KindBadge kind="business" /></div>
          <div className="card-body">
            <table><tbody>
              <tr><td>Income</td><td className="text-right text-green bold">{formatCurrency(bizInc)}</td></tr>
              <tr><td>Expenses</td><td className="text-right text-red">{formatCurrency(bizExp)}</td></tr>
              <tr style={{borderTop:'2px solid var(--border)'}}><td className="bold">Net</td><td className={`text-right bold ${bizInc-bizExp>=0?'text-green':'text-red'}`}>{formatCurrency(bizInc-bizExp)}</td></tr>
            </tbody></table>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3>Personal</h3><KindBadge kind="personal" /></div>
          <div className="card-body">
            <table><tbody>
              <tr><td>Income</td><td className="text-right text-green bold">{formatCurrency(persInc)}</td></tr>
              <tr><td>Expenses</td><td className="text-right text-red">{formatCurrency(persExp)}</td></tr>
              <tr style={{borderTop:'2px solid var(--border)'}}><td className="bold">Net</td><td className={`text-right bold ${persInc-persExp>=0?'text-green':'text-red'}`}>{formatCurrency(persInc-persExp)}</td></tr>
            </tbody></table>
          </div>
        </div>
      </div>

      <div className="card mb-24">
        <div className="card-header"><h3>By Category Group</h3></div>
        <div className="table-container">
          <table>
            <thead><tr><th>Group</th><th>Transactions</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {byGroup.map(g=>{
                const s = GROUP_STYLE[g.group]||{}
                return (
                  <tr key={g.group}>
                    <td><span style={{display:'inline-block',padding:'2px 10px',borderRadius:20,background:s.bg,color:s.color,fontSize:'0.8rem'}}>{g.group}</span></td>
                    <td className="text-muted">{g.count}</td>
                    <td className="text-right bold">{formatCurrency(g.total)}</td>
                  </tr>
                )
              })}
              {byGroup.length===0 && <tr><td colSpan={3} style={{padding:'24px',textAlign:'center',color:'var(--text-faint)'}}>No transactions yet — add income or expenses to get started</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Balance Sheet (accounts) ───────────────────────────── */}
      {accounts.length > 0 && (() => {
        const norm   = accounts.map(a=>({...a, ownership:a.ownership||'personal', isLiability:a.isLiability||(a.type==='credit'), countInNetWorth:a.countInNetWorth??true}))
        const assets = norm.filter(a=>!a.isLiability && a.countInNetWorth!==false)
        const liabs  = norm.filter(a=>a.isLiability  && a.countInNetWorth!==false)
        const totalA = assets.reduce((s,a)=>s+Math.abs(Number(a.balance)),0)
        const totalL = liabs.reduce((s,a)=>s+Math.abs(Number(a.balance)),0)
        const netW   = totalA - totalL
        const persA  = assets.filter(a=>a.ownership!=='business').reduce((s,a)=>s+Math.abs(Number(a.balance)),0)
        const bizA   = assets.filter(a=>a.ownership==='business').reduce((s,a)=>s+Math.abs(Number(a.balance)),0)
        const excl   = norm.filter(a=>a.countInNetWorth===false).reduce((s,a)=>s+Math.abs(Number(a.balance)),0)
        const overdue = liabs.filter(a=>a.paymentStatus==='overdue')
        const upcoming = liabs.filter(a=>a.paymentStatus==='upcoming'&&a.dueDate)
          .sort((a,b)=>parseInt(a.dueDate)-parseInt(b.dueDate))
        return (
          <div className="section-grid">
            {/* Left: quick balance sheet */}
            <div className="card">
              <div className="card-header">
                <h3>Balance Sheet</h3>
                <span style={{fontSize:'0.72rem',color:'var(--text-muted)'}}>{accounts.length} accounts</span>
              </div>
              <div className="card-body" style={{padding:0}}>
                {/* Assets */}
                <div style={{padding:'12px 18px',borderBottom:'1px solid var(--border-light)'}}>
                  <div style={{fontSize:'0.65rem',textTransform:'uppercase',letterSpacing:'0.07em',color:'var(--text-muted)',marginBottom:6}}>Assets</div>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                    <span style={{fontSize:'0.82rem',display:'flex',alignItems:'center',gap:6}}>
                      <span style={{width:8,height:8,borderRadius:'50%',background:'#ec4899',display:'inline-block'}}/>Personal
                    </span>
                    <span style={{fontWeight:'bold',color:'var(--green)',fontSize:'0.88rem'}}>{formatCurrency(persA)}</span>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between'}}>
                    <span style={{fontSize:'0.82rem',display:'flex',alignItems:'center',gap:6}}>
                      <span style={{width:8,height:8,borderRadius:'50%',background:'#3b82f6',display:'inline-block'}}/>Business
                    </span>
                    <span style={{fontWeight:'bold',color:'var(--green)',fontSize:'0.88rem'}}>{formatCurrency(bizA)}</span>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',borderTop:'1px solid var(--border-light)',marginTop:8,paddingTop:6}}>
                    <span style={{fontSize:'0.82rem',fontWeight:'bold'}}>Total Assets</span>
                    <span style={{fontWeight:'bold',color:'var(--green)'}}>{formatCurrency(totalA)}</span>
                  </div>
                </div>
                {/* Liabilities */}
                <div style={{padding:'12px 18px',borderBottom:'1px solid var(--border-light)'}}>
                  <div style={{fontSize:'0.65rem',textTransform:'uppercase',letterSpacing:'0.07em',color:'var(--text-muted)',marginBottom:6}}>Liabilities</div>
                  {liabs.map(a=>(
                    <div key={a.id} style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                      <span style={{fontSize:'0.82rem',color:'var(--text-muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'60%'}}>{a.name}</span>
                      <span style={{fontWeight:'bold',color:'var(--red)',fontSize:'0.82rem'}}>{formatCurrency(Math.abs(Number(a.balance)))}</span>
                    </div>
                  ))}
                  {liabs.length===0 && <div style={{fontSize:'0.82rem',color:'var(--text-faint)'}}>No liabilities</div>}
                  <div style={{display:'flex',justifyContent:'space-between',borderTop:'1px solid var(--border-light)',marginTop:8,paddingTop:6}}>
                    <span style={{fontSize:'0.82rem',fontWeight:'bold'}}>Total Liabilities</span>
                    <span style={{fontWeight:'bold',color:'var(--red)'}}>{formatCurrency(totalL)}</span>
                  </div>
                </div>
                {/* Net */}
                <div style={{padding:'14px 18px',background:netW>=0?'#f0fdf4':'#fef2f2',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <span style={{fontWeight:'bold',fontSize:'0.9rem'}}>Net Worth</span>
                    {excl>0 && <div style={{fontSize:'0.68rem',color:'var(--text-muted)',marginTop:1}}>{formatCurrency(excl)} excl. (escrow/held)</div>}
                  </div>
                  <span style={{fontWeight:'bold',fontSize:'1.2rem',color:netW>=0?'var(--green)':'var(--red)'}}>{formatCurrency(netW)}</span>
                </div>
              </div>
            </div>

            {/* Right: upcoming payments */}
            <div className="card">
              <div className="card-header">
                <h3>Upcoming Payments</h3>
                {overdue.length>0 && <span style={{background:'#fef2f2',color:'var(--red)',border:'1px solid #fca5a5',borderRadius:20,padding:'2px 8px',fontSize:'0.68rem',fontWeight:'bold'}}>{overdue.length} overdue</span>}
              </div>
              <div className="card-body" style={{padding:0}}>
                {overdue.map(a=>{
                  const ss=payStatusStyle('overdue')
                  return (
                    <div key={a.id} style={{padding:'10px 18px',borderBottom:'1px solid var(--border-light)',display:'flex',justifyContent:'space-between',alignItems:'center',background:'#fef2f2'}}>
                      <div>
                        <div style={{fontWeight:'bold',fontSize:'0.875rem'}}>{a.name}</div>
                        <div style={{fontSize:'0.72rem',color:'var(--red)'}}>⚠ Overdue{a.dueDate?` — due the ${formatDueDay(a.dueDate)} of each month`:''}</div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontWeight:'bold',color:'var(--red)'}}>{a.minPayment>0?formatCurrency(a.minPayment):'—'}</div>
                        <div style={{fontSize:'0.7rem',color:'var(--text-muted)'}}>min payment</div>
                      </div>
                    </div>
                  )
                })}
                {upcoming.slice(0,5).map(a=>{
                  const soon=isDueSoon(a.dueDate)
                  return (
                    <div key={a.id} style={{padding:'10px 18px',borderBottom:'1px solid var(--border-light)',display:'flex',justifyContent:'space-between',alignItems:'center',background:soon?'#fffbeb':'var(--surface)'}}>
                      <div>
                        <div style={{fontWeight:'bold',fontSize:'0.875rem'}}>{a.name}</div>
                        <div style={{fontSize:'0.72rem',color:soon?'var(--amber)':'var(--text-muted)'}}>{soon?'⏰ Due soon — ':''}{a.dueDate?`${formatDueDay(a.dueDate)} of each month`:''}</div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontWeight:'bold',color:'var(--text)'}}>{a.minPayment>0?formatCurrency(a.minPayment):'—'}</div>
                        <div style={{fontSize:'0.7rem',color:'var(--text-muted)'}}>min payment</div>
                      </div>
                    </div>
                  )
                })}
                {overdue.length===0&&upcoming.length===0&&(
                  <div style={{padding:'28px',textAlign:'center',color:'var(--text-faint)',fontSize:'0.875rem'}}>
                    No upcoming payments — add a liability account to track due dates
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ─── Income ───────────────────────────────────────────────────────────────────
function IncomeTab({ transactions, setTransactions, categories, accounts=[] }) {
  const [adding,        setAdding]        = useState(false)
  const [addingRefund,  setAddingRefund]  = useState(false)
  const [fStatus,       setFStatus]       = useState('all')
  const [fKind,         setFKind]         = useState('all')

  const income   = transactions.filter(t=>t.type==='income'&&t.status!=='pending_review')
  const refunds  = income.filter(t=>t.isRefund)
  const filtered = income
    .filter(t=>fStatus==='all'||(fStatus==='pending'?t.status==='pending':t.status!=='pending'))
    .filter(t=>fKind==='all'||t.spendingType===fKind)
    .sort((a,b)=>b.date.localeCompare(a.date))

  const received      = income.filter(t=>t.status!=='pending'&&!t.isRefund).reduce((s,t)=>s+Number(t.amount),0)
  const pending       = income.filter(t=>t.status==='pending').reduce((s,t)=>s+Number(t.amount),0)
  const totalRefunds  = refunds.reduce((s,t)=>s+Number(t.amount),0)

  const addTxn = t => setTransactions([...transactions, t])
  const del    = id => setTransactions(transactions.filter(t=>t.id!==id))
  const markReceived = id => setTransactions(transactions.map(t=>t.id===id?{...t,status:'cleared'}:t))

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>Income</h2>
        <div className="flex-gap">
          <button className="btn btn-sm"
            style={{borderColor:'#7c3aed',color:'#7c3aed',background:addingRefund?'#f5f3ff':'var(--surface)'}}
            onClick={()=>{setAddingRefund(v=>!v);setAdding(false)}}>
            {addingRefund?'Cancel':'↩ Add Refund'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={()=>{setAdding(v=>!v);setAddingRefund(false)}}>{adding?'Cancel':'+ Add Income'}</button>
        </div>
      </div>

      <div className="metrics-grid mb-24" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
        <div className="metric-card metric-card-income"><div className="metric-label">Total Received</div><div className="metric-value text-green">{formatCurrency(received,true)}</div></div>
        <div className="metric-card metric-card-pending">
          <div className="metric-label">Pending / Expected</div>
          <div className="metric-value text-amber">{formatCurrency(pending,true)}</div>
        </div>
        <div className="metric-card metric-card-net">
          <div className="metric-label">Refunds Received</div>
          <div className="metric-value" style={{color:'var(--purple)'}}>{formatCurrency(totalRefunds,true)}</div>
          <div className="metric-change neutral">{refunds.length} {refunds.length===1?'refund':'refunds'}</div>
        </div>
        <div className="metric-card metric-card-income"><div className="metric-label">Total Pipeline</div><div className="metric-value text-green">{formatCurrency(received+pending+totalRefunds,true)}</div></div>
      </div>

      {/* Refund form */}
      {addingRefund && (
        <div className="card mb-16" style={{borderColor:'#c4b5fd'}}>
          <div className="card-header" style={{background:'#f5f3ff'}}>
            <h3 style={{color:'#7c3aed'}}>↩ Add Refund</h3>
            <span style={{fontSize:'0.72rem',color:'#7c3aed'}}>Amazon returns, store refunds, client reimbursements, vendor credits</span>
          </div>
          <div className="card-body">
            <TxnForm categories={categories} accounts={accounts} onAdd={t=>{addTxn(t);setAddingRefund(false)}} forRefund={true} onCancel={()=>setAddingRefund(false)} />
          </div>
        </div>
      )}

      {adding && <TxnForm categories={categories} accounts={accounts} onAdd={t=>{addTxn(t);setAdding(false)}} defaultGroup="Income" onCancel={()=>setAdding(false)} />}

      {/* Pending highlight */}
      {income.filter(t=>t.status==='pending').length>0 && (
        <div className="card mb-16" style={{borderColor:'var(--amber)'}}>
          <div className="card-header" style={{background:'var(--amber-bg)'}}><h3 style={{color:'var(--amber)'}}>⏳ Pending / Expected Income</h3></div>
          <div className="table-container">
            <table>
              <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Type</th><th className="text-right">Amount</th><th></th></tr></thead>
              <tbody>
                {income.filter(t=>t.status==='pending').sort((a,b)=>b.date.localeCompare(a.date)).map(t=>(
                  <tr key={t.id}>
                    <td className="text-muted text-sm">{formatDate(t.date)}</td>
                    <td className="bold">{t.description}</td>
                    <td><span className="badge badge-gray">{t.category}</span></td>
                    <td><KindBadge kind={t.spendingType} /></td>
                    <td className="text-right bold" style={{color:'var(--amber)'}}>{formatCurrency(t.amount)}</td>
                    <td style={{display:'flex',gap:4}}>
                      <button className="btn btn-sm" style={{color:'var(--green)'}} onClick={()=>markReceived(t.id)}>✓ Mark Received</button>
                      <button className="btn btn-sm btn-danger" onClick={()=>del(t.id)}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header flex-between">
          <h3>All Income ({filtered.length})</h3>
          <div className="flex-gap">
            <select value={fStatus} onChange={e=>setFStatus(e.target.value)} style={{fontSize:'0.8rem',padding:'3px 6px'}}>
              <option value="all">All Status</option><option value="cleared">Received</option><option value="pending">Pending</option>
            </select>
            <select value={fKind} onChange={e=>setFKind(e.target.value)} style={{fontSize:'0.8rem',padding:'3px 6px'}}>
              <option value="all">All Types</option><option value="business">Business</option><option value="personal">Personal</option>
            </select>
          </div>
        </div>
        <div className="table-container">
          <table>
            <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Type</th><th>Status</th><th>Account</th><th className="text-right">Amount</th><th></th></tr></thead>
            <tbody>
              {filtered.map(t=>(
                <tr key={t.id}>
                  <td className="text-muted text-sm">{formatDate(t.date)}</td>
                  <td>
                    {t.isRefund && <span style={{fontSize:'0.68rem',background:'#f5f3ff',color:'#7c3aed',border:'1px solid #c4b5fd',borderRadius:10,padding:'1px 6px',marginRight:6,fontWeight:'bold'}}>↩ Refund</span>}
                    {t.description}
                  </td>
                  <td><span className="badge badge-gray">{t.category}</span></td>
                  <td><KindBadge kind={t.spendingType} /></td>
                  <td>{t.status==='pending'?<span className="badge badge-amber">Pending</span>:<span className="badge badge-green">Received</span>}</td>
                  <td className="text-muted text-sm">{t.account||'—'}</td>
                  <td className="text-right bold" style={{color:t.isRefund?'#7c3aed':'var(--green)'}}>{formatCurrency(t.amount)}</td>
                  <td><button className="btn btn-sm btn-danger" onClick={()=>del(t.id)}>×</button></td>
                </tr>
              ))}
              {filtered.length===0&&<tr><td colSpan={8} style={{padding:'24px',textAlign:'center',color:'var(--text-faint)'}}>No income entries yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Expenses by group ────────────────────────────────────────────────────────
function GroupSection({ groupName, transactions, categories, accounts=[], onAdd, onDelete }) {
  const [open,    setOpen]    = useState(true)
  const [adding,  setAdding]  = useState(false)
  const s      = GROUP_STYLE[groupName]||{}
  const gtxns  = transactions.filter(t=>getGroup(t,categories)===groupName)
  const total  = gtxns.reduce((s,t)=>s+Number(t.amount),0)
  const biz    = gtxns.filter(t=>t.spendingType!=='personal').reduce((s,t)=>s+Number(t.amount),0)
  const pers   = gtxns.filter(t=>t.spendingType==='personal').reduce((s,t)=>s+Number(t.amount),0)

  return (
    <div style={{border:`1px solid ${s.border||'var(--border)'}`,borderRadius:'var(--radius)',marginBottom:12,overflow:'hidden'}}>
      <div onClick={()=>setOpen(!open)} style={{background:s.bg,padding:'12px 16px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontWeight:'bold',color:s.color,fontSize:'0.9rem'}}>{groupName}</span>
          <span className="text-xs text-muted">({gtxns.length})</span>
          {biz>0  && <span className="badge badge-blue"  style={{fontSize:'0.65rem'}}>Biz {formatCurrency(biz,true)}</span>}
          {pers>0 && <span className="badge badge-pink"  style={{fontSize:'0.65rem'}}>Personal {formatCurrency(pers,true)}</span>}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontWeight:'bold',color:s.color,fontSize:'1rem'}}>{formatCurrency(total)}</span>
          <button className="btn btn-sm" style={{fontSize:'0.75rem',color:s.color,borderColor:s.border}} onClick={e=>{e.stopPropagation();setAdding(!adding)}}>+ Add</button>
          <span style={{color:s.color,fontSize:'0.75rem'}}>{open?'▲':'▼'}</span>
        </div>
      </div>
      {open && (
        <div>
          {adding && (
            <div style={{padding:'12px 16px',borderBottom:`1px solid ${s.border||'var(--border)'}`}}>
              <TxnForm categories={categories} accounts={accounts} onAdd={t=>{onAdd(t);setAdding(false)}} defaultGroup={groupName} onCancel={()=>setAdding(false)} />
            </div>
          )}
          {gtxns.length===0 ? (
            <div style={{padding:'20px',textAlign:'center',color:'var(--text-faint)',fontSize:'0.875rem'}}>No entries yet</div>
          ) : (
            <div className="table-container">
              <table>
                <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Type</th><th>Account</th><th className="text-right">Amount</th><th></th></tr></thead>
                <tbody>
                  {[...gtxns].sort((a,b)=>b.date.localeCompare(a.date)).map(t=>(
                    <tr key={t.id}>
                      <td className="text-muted text-sm">{formatDate(t.date)}</td>
                      <td>{t.description}</td>
                      <td><span className="badge badge-gray">{t.category}</span></td>
                      <td><KindBadge kind={t.spendingType} /></td>
                      <td className="text-muted text-sm">{t.account||'—'}</td>
                      <td className="text-right bold text-red">{formatCurrency(t.amount)}</td>
                      <td><button className="btn btn-sm btn-danger" onClick={()=>onDelete(t.id)}>×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ExpensesTab({ transactions, setTransactions, categories, accounts=[] }) {
  const [fKind,   setFKind]   = useState('all')
  const [search,  setSearch]  = useState('')
  const [adding,  setAdding]  = useState(false)

  const shown = transactions.filter(t=>
    t.type!=='income' &&
    t.status!=='pending_review' &&
    (fKind==='all'||t.spendingType===fKind) &&
    (!search||t.description?.toLowerCase().includes(search.toLowerCase())||t.category?.toLowerCase().includes(search.toLowerCase()))
  )
  const totalShown = shown.reduce((s,t)=>s+Number(t.amount),0)

  const addTxn = t => setTransactions([...transactions,t])
  const delTxn = id => setTransactions(transactions.filter(t=>t.id!==id))

  return (
    <div>
      <div className="flex-between mb-16">
        <div>
          <h2>Expenses</h2>
          <div className="text-sm text-muted mt-4">Total showing: <strong className="text-red">{formatCurrency(totalShown)}</strong></div>
        </div>
        <div className="flex-gap">
          <input placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} style={{width:160,padding:'4px 8px'}} />
          <select value={fKind} onChange={e=>setFKind(e.target.value)} style={{fontSize:'0.875rem',padding:'4px 8px'}}>
            <option value="all">All Types</option><option value="business">Business Only</option><option value="personal">Personal Only</option>
          </select>
          <button className="btn btn-primary btn-sm" onClick={()=>setAdding(!adding)}>{adding?'Cancel':'+ Add Expense'}</button>
        </div>
      </div>
      {adding && <TxnForm categories={categories.filter(c=>c.group!=='Income')} accounts={accounts} onAdd={t=>{addTxn(t);setAdding(false)}} onCancel={()=>setAdding(false)} />}
      {GROUP_ORDER.filter(g=>g!=='Income').map(g=>(
        <GroupSection key={g} groupName={g} transactions={shown} categories={categories} accounts={accounts} onAdd={addTxn} onDelete={delTxn} />
      ))}
    </div>
  )
}

// ─── Asset Table (reusable within AccountsTab) ────────────────────────────────
function AssetTable({ accounts, onEdit, onDelete, onRegister }) {
  return (
    <div className="card">
      <div className="table-container">
        <table>
          <thead><tr><th>Account</th><th>Type</th><th>Ownership</th><th className="text-right">Balance</th><th></th></tr></thead>
          <tbody>
            {accounts.map(a=>(
              <tr key={a.id} style={{opacity: a.countInNetWorth===false ? 0.75 : 1}}>
                <td className="bold">
                  {a.name}
                  {a.countInNetWorth===false && (
                    <span style={{marginLeft:6,fontSize:'0.65rem',background:'#f1f5f9',color:'#64748b',border:'1px solid #cbd5e1',borderRadius:10,padding:'1px 6px',fontWeight:'normal'}}>
                      Excluded from net worth
                    </span>
                  )}
                </td>
                <td className="text-muted" style={{fontSize:'0.82rem',textTransform:'capitalize'}}>{(a.type||'other').replace(/_/g,' ')}</td>
                <td>
                  <span style={{
                    background:a.ownership==='business'?'#eff6ff':'#fdf2f8',
                    color:a.ownership==='business'?'var(--blue)':'var(--pink)',
                    border:`1px solid ${a.ownership==='business'?'#93c5fd':'var(--pink-border)'}`,
                    borderRadius:20,padding:'2px 8px',fontSize:'0.65rem',fontWeight:'bold',
                  }}>{a.ownership==='business'?'Business':'Personal'}</span>
                </td>
                <td className="text-right">
                  <div style={{fontWeight:'bold',color: a.countInNetWorth===false ? 'var(--text-muted)' : 'var(--green)'}}>{formatCurrency(Math.abs(Number(a.balance)))}</div>
                  {(()=>{const s=[...(a.balanceHistory||[])].sort((x,y)=>y.date.localeCompare(x.date))[0]; return s?<div style={{fontSize:'0.65rem',color:'var(--text-muted)'}}>as of {formatDate(s.date)}</div>:null})()}
                </td>
                <td style={{display:'flex',gap:4}}>
                  <button className="btn btn-sm" style={{color:'var(--blue)',borderColor:'#93c5fd'}} onClick={()=>onRegister(a)}>📋 Register</button>
                  <button className="btn btn-sm" onClick={()=>onEdit(a)}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={()=>onDelete(a.id)}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Account Register ─────────────────────────────────────────────────────────
function AccountRegister({ account, transactions, setTransactions, categories=[], onUpdateAccount, onBack }) {
  const [showSnapForm, setShowSnapForm] = useState(false)
  const [snapDate,     setSnapDate]     = useState(today())
  const [snapBal,      setSnapBal]      = useState('')
  const [snapNote,     setSnapNote]     = useState('')
  const [reconciling,  setReconciling]  = useState(false)
  const [stmtBal,      setStmtBal]      = useState('')
  const [stmtDate,     setStmtDate]     = useState(today())
  const [editId,       setEditId]       = useState(null)
  const [editDraft,    setEditDraft]    = useState(null)

  const history = [...(account.balanceHistory||[])].sort((a,b)=>a.date.localeCompare(b.date))

  // Transactions linked to this account — exclude pending_review (not yet confirmed)
  const acctTxns = transactions
    .filter(t => (t.accountId===account.id || (!t.accountId && t.account===account.name)) && t.status!=='pending_review')
    .sort((a,b) => a.date.localeCompare(b.date))

  // Running balance: deposits add, expenses subtract (reversed for liabilities)
  const isLiab = !!account.isLiability
  let cum = 0
  const txnsWithRunning = acctTxns.map(t => {
    const dep = t.type==='income'
    const delta = isLiab ? (dep ? -Number(t.amount) : Number(t.amount))
                         : (dep ?  Number(t.amount) : -Number(t.amount))
    cum += delta
    return { ...t, _delta:delta, runningBalance: cum }
  })

  // Cleared balance = sum of reconciled transaction deltas
  const clearedBalance = txnsWithRunning
    .filter(t => t.reconciled)
    .reduce((s,t) => s + t._delta, 0)

  const stmtNum = stmtBal ? parseFloat(stmtBal) : null
  const diff    = stmtNum !== null ? (stmtNum - clearedBalance) : null
  const diffOk  = diff !== null && Math.abs(diff) < 0.005

  function toggleReconcile(id) {
    setTransactions(transactions.map(t => t.id===id ? {...t, reconciled:!t.reconciled} : t))
  }

  function setTxnStatus(id, key) {
    setTransactions(transactions.map(t => t.id===id ? {...t, txnStatus: t.txnStatus===key ? null : key} : t))
  }

  function addSnapshot(e) {
    e.preventDefault()
    const snap = { id:uid(), date:snapDate, balance:parseFloat(snapBal)||0, note:snapNote }
    onUpdateAccount({ ...account, balanceHistory:[...(account.balanceHistory||[]), snap] })
    setSnapBal(''); setSnapNote(''); setShowSnapForm(false)
  }

  function removeSnapshot(id) {
    onUpdateAccount({ ...account, balanceHistory:(account.balanceHistory||[]).filter(s=>s.id!==id) })
  }

  function saveEdit() {
    if (!editDraft) return
    const catRec = categories.find(c=>c.name===editDraft.category)
    const updated = { ...editDraft, group: catRec?.group||editDraft.group, type: catRec?.group==='Income'?'income':'expense' }
    setTransactions(transactions.map(t=>t.id===updated.id?updated:t))
    setEditId(null); setEditDraft(null)
  }

  const reconciledCount = txnsWithRunning.filter(t=>t.reconciled).length

  return (
    <div>
      {/* ── Header ── */}
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20,flexWrap:'wrap'}}>
        <button className="btn btn-sm" onClick={onBack}>← Back to Accounts</button>
        <h2 style={{margin:0}}>{account.name}</h2>
        <span style={{fontSize:'0.8rem',color:'var(--text-muted)',textTransform:'capitalize',background:'var(--surface-hover)',border:'1px solid var(--border)',borderRadius:20,padding:'2px 10px'}}>
          {(account.type||'account').replace(/_/g,' ')}
        </span>
        <span style={{fontSize:'0.88rem',fontWeight:'bold',marginLeft:'auto',color:isLiab?'var(--red)':'var(--green)'}}>
          {isLiab?'Balance Owed: ':'Balance: '}{formatCurrency(Math.abs(Number(account.balance)))}
        </span>
      </div>

      {/* ── Balance History ── */}
      <div className="card mb-20">
        <div className="card-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h3>📅 Balance Snapshots</h3>
          <button className="btn btn-sm btn-primary" onClick={()=>setShowSnapForm(v=>!v)}>
            {showSnapForm?'Cancel':'+ Add Snapshot'}
          </button>
        </div>
        {showSnapForm && (
          <div className="card-body" style={{borderBottom:'1px solid var(--border)'}}>
            <p style={{fontSize:'0.8rem',color:'var(--text-muted)',marginBottom:10}}>
              Record what your bank statement showed on a specific date. This is your audit trail for reconciliation.
            </p>
            <form onSubmit={addSnapshot}>
              <div className="form-row">
                <div className="form-group">
                  <label>Statement Date</label>
                  <input type="date" value={snapDate} onChange={e=>setSnapDate(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Balance on Statement</label>
                  <DollarInput value={snapBal} onChange={e=>setSnapBal(e.target.value)} placeholder="e.g. 4532.18" />
                </div>
                <div className="form-group" style={{gridColumn:'span 2'}}>
                  <label>Note <span style={{fontWeight:'normal',color:'var(--text-muted)'}}>(optional)</span></label>
                  <input placeholder="e.g. Chase statement — May 2025" value={snapNote} onChange={e=>setSnapNote(e.target.value)} />
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-sm" disabled={!snapBal}>Save Snapshot</button>
            </form>
          </div>
        )}
        <div className="table-container">
          <table>
            <thead><tr><th>Date</th><th>Note</th><th className="text-right">Stated Balance</th><th></th></tr></thead>
            <tbody>
              {history.length===0 && (
                <tr><td colSpan={4} style={{padding:'20px',textAlign:'center',color:'var(--text-faint)'}}>
                  No snapshots yet — add one to record your bank statement balance on a given date
                </td></tr>
              )}
              {[...history].reverse().map(s=>(
                <tr key={s.id}>
                  <td style={{fontWeight:'500'}}>{formatDate(s.date)}</td>
                  <td className="text-muted text-sm">{s.note||'—'}</td>
                  <td className="text-right bold" style={{color:isLiab?'var(--red)':'var(--green)'}}>{formatCurrency(s.balance)}</td>
                  <td><button className="btn btn-sm btn-danger" onClick={()=>removeSnapshot(s.id)}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Reconciliation ── */}
      {acctTxns.length > 0 && (
        <div className="card mb-20" style={{borderColor:reconciling?'#93c5fd':'var(--border)'}}>
          <div className="card-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:reconciling?'var(--blue-bg)':''}}>
            <div>
              <h3 style={{color:reconciling?'var(--blue)':'inherit',margin:0}}>🔄 Reconcile Account</h3>
              {reconciledCount>0 && !reconciling && (
                <span style={{fontSize:'0.72rem',color:'var(--green)',marginTop:2,display:'block'}}>
                  {reconciledCount} transaction{reconciledCount!==1?'s':''} marked reconciled
                </span>
              )}
            </div>
            <button className="btn btn-sm" onClick={()=>setReconciling(v=>!v)}
              style={{borderColor:reconciling?'var(--blue)':'var(--border)',color:reconciling?'var(--blue)':'inherit'}}>
              {reconciling?'Close':'Start Reconciliation'}
            </button>
          </div>
          {reconciling && (
            <div className="card-body" style={{borderBottom:'1px solid var(--border)'}}>
              <p style={{fontSize:'0.82rem',color:'var(--text-muted)',marginBottom:14}}>
                Enter your bank statement ending balance and date, then check off each transaction that appears on the statement.
                Your <strong>Cleared Balance</strong> should match the <strong>Statement Balance</strong> when done.
              </p>
              <div className="form-row" style={{alignItems:'end'}}>
                <div className="form-group">
                  <label>Statement Ending Date</label>
                  <input type="date" value={stmtDate} onChange={e=>setStmtDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Statement Ending Balance</label>
                  <DollarInput value={stmtBal} onChange={e=>setStmtBal(e.target.value)} placeholder="From bank statement" />
                </div>
                <div className="form-group">
                  <div style={{padding:'10px 14px',borderRadius:'var(--radius)',border:`1px solid ${diffOk?'#86efac':diff!==null?'#fca5a5':'var(--border)'}`,background:diffOk?'#f0fdf4':diff!==null?'#fef2f2':'var(--surface-hover)'}}>
                    <div style={{fontSize:'0.7rem',color:'var(--text-muted)',marginBottom:4}}>Difference</div>
                    <div style={{fontWeight:'bold',fontSize:'1.1rem',color:diffOk?'var(--green)':diff!==null?'var(--red)':'var(--text-muted)'}}>
                      {diff===null ? '—' : diffOk ? '✓ Balanced!' : formatCurrency(Math.abs(diff))}
                    </div>
                    {diff!==null&&!diffOk&&<div style={{fontSize:'0.7rem',color:'var(--red)',marginTop:2}}>{diff>0?'Need more cleared transactions':'Over-cleared'}</div>}
                  </div>
                </div>
              </div>
              <div style={{fontSize:'0.82rem',color:'var(--text-muted)'}}>
                Cleared Balance: <strong style={{color:'var(--text)'}}>{formatCurrency(clearedBalance)}</strong>
                {' '}·{' '}{reconciledCount} of {acctTxns.length} transactions cleared
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Flagged items summary ── */}
      {(() => {
        const flagged = txnsWithRunning.filter(t=>t.txnStatus)
        if (!flagged.length) return null
        return (
          <div className="card mb-20" style={{borderColor:'#fcd34d'}}>
            <div className="card-header" style={{background:'#fffbeb'}}>
              <h3 style={{color:'#b45309'}}>🚩 Flagged Transactions ({flagged.length})</h3>
              <span style={{fontSize:'0.72rem',color:'#92400e'}}>Review these before finalizing reconciliation</span>
            </div>
            <div style={{padding:'0'}}>
              {Object.entries(TXN_STATUS).map(([key,s])=>{
                const group = flagged.filter(t=>t.txnStatus===key)
                if (!group.length) return null
                return (
                  <div key={key} style={{borderBottom:'1px solid var(--border-light)'}}>
                    <div style={{padding:'8px 16px',background:s.bg,fontSize:'0.72rem',fontWeight:700,color:s.color,borderBottom:`1px solid ${s.border}`}}>
                      {s.icon} {s.label} — {group.length} item{group.length!==1?'s':''}
                    </div>
                    {group.map(t=>(
                      <div key={t.id} style={{display:'flex',alignItems:'center',gap:12,padding:'8px 16px',borderBottom:'1px solid var(--border-light)'}}>
                        <span style={{fontSize:'0.78rem',color:'var(--text-muted)',whiteSpace:'nowrap'}}>{formatDate(t.date)}</span>
                        <span style={{flex:1,fontSize:'0.82rem',fontWeight:500}}>{t.description}</span>
                        <span style={{fontWeight:700,color:t.type==='income'?'var(--green)':'var(--red)',whiteSpace:'nowrap'}}>
                          {t.type==='income'?'+':'−'}{formatCurrency(t.amount)}
                        </span>
                        <button onClick={()=>setTxnStatus(t.id,key)}
                          style={{background:'none',border:'none',cursor:'pointer',fontSize:'0.7rem',color:'var(--text-faint)',padding:'2px 6px',borderRadius:4,border:'1px solid var(--border)'}}>
                          Clear
                        </button>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* ── Transaction Register ── */}
      <div className="card">
        <div className="card-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h3>📋 Transaction Register</h3>
          <span style={{fontSize:'0.8rem',color:'var(--text-muted)'}}>
            {acctTxns.length} transaction{acctTxns.length!==1?'s':''} · Running balance from first to last
          </span>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                {reconciling && <th style={{width:140}}>✓ &nbsp;Status</th>}
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th className="text-right" style={{color:'var(--green)'}}>Deposit (+)</th>
                <th className="text-right" style={{color:'var(--red)'}}>Withdrawal (−)</th>
                <th className="text-right">Running Total</th>
                <th style={{width:36}}></th>
              </tr>
            </thead>
            <tbody>
              {txnsWithRunning.length===0 && (
                <tr><td colSpan={reconciling?7:6} style={{padding:'28px',textAlign:'center',color:'var(--text-faint)'}}>
                  No transactions linked to this account yet.<br/>
                  <span style={{fontSize:'0.82rem'}}>Import a CSV and choose this account, or add transactions from the Income / Expenses tabs and select this account.</span>
                </td></tr>
              )}
              {txnsWithRunning.map(t=>{
                const isDeposit = t.type==='income'
                const greyedOut = reconciling && t.date > stmtDate
                const flagStyle = t.txnStatus ? TXN_STATUS[t.txnStatus] : null
                const isEditing = editId===t.id
                const colCount  = reconciling ? 8 : 7
                return (
                  <>
                    <tr key={t.id} style={{
                      background: isEditing ? '#eff6ff'
                        : flagStyle && !reconciling ? flagStyle.bg
                        : t.reconciled&&reconciling ? '#f0fdf4' : 'transparent',
                      opacity: greyedOut ? 0.45 : 1,
                    }}>
                      {reconciling && (
                        <td>
                          <div style={{display:'flex',alignItems:'center',gap:5}}>
                            <input type="checkbox" checked={!!t.reconciled} onChange={()=>toggleReconcile(t.id)}
                              style={{cursor:'pointer',width:15,height:15,flexShrink:0}} disabled={greyedOut} />
                            {!greyedOut && (
                              <div style={{display:'flex',gap:3}}>
                                {Object.entries(TXN_STATUS).map(([key,s])=>(
                                  <button key={key} title={s.label} onClick={()=>setTxnStatus(t.id,key)}
                                    style={{padding:'2px 5px',borderRadius:4,cursor:'pointer',fontSize:'0.72rem',lineHeight:1,
                                      background:t.txnStatus===key?s.bg:'transparent',
                                      border:`1px solid ${t.txnStatus===key?s.border:'var(--border)'}`,
                                      color:t.txnStatus===key?s.color:'var(--text-faint)'}}>
                                    {s.icon}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      )}
                      <td className="text-sm text-muted" style={{whiteSpace:'nowrap'}}>{formatDate(t.date)}</td>
                      <td>
                        <div style={{fontWeight:'500'}}>{t.description}</div>
                        <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:2}}>
                          {t.reconciled&&!reconciling&&<span style={{fontSize:'0.65rem',color:'var(--green)',background:'#f0fdf4',border:'1px solid #86efac',borderRadius:10,padding:'1px 5px'}}>✓ Reconciled</span>}
                          {flagStyle&&<span style={{fontSize:'0.65rem',color:flagStyle.color,background:flagStyle.bg,border:`1px solid ${flagStyle.border}`,borderRadius:10,padding:'1px 6px',fontWeight:600}}>{flagStyle.icon} {flagStyle.label}</span>}
                          {t.notes&&<span style={{fontSize:'0.65rem',color:'var(--text-muted)',fontStyle:'italic'}}>📝 {t.notes}</span>}
                        </div>
                      </td>
                      <td><span className="badge badge-gray" style={{fontSize:'0.7rem'}}>{t.category||'—'}</span></td>
                      <td className="text-right bold" style={{color:'var(--green)'}}>{isDeposit ? formatCurrency(Number(t.amount)) : ''}</td>
                      <td className="text-right bold" style={{color:'var(--red)'}}>  {!isDeposit ? formatCurrency(Number(t.amount)) : ''}</td>
                      <td className="text-right bold" style={{color:t.runningBalance>=0?'var(--text)':'var(--red)'}}>{formatCurrency(t.runningBalance)}</td>
                      <td style={{textAlign:'center'}}>
                        <button title={isEditing?'Close edit':'Edit transaction'}
                          onClick={()=>{ if(isEditing){setEditId(null);setEditDraft(null)}else{setEditId(t.id);setEditDraft({...t})} }}
                          style={{background:'none',border:'none',cursor:'pointer',fontSize:'0.85rem',padding:'2px 4px',opacity:0.6}}>
                          {isEditing?'✕':'✏️'}
                        </button>
                      </td>
                    </tr>
                    {isEditing && editDraft && (
                      <tr key={t.id+'-edit'} style={{background:'#eff6ff'}}>
                        <td colSpan={colCount} style={{padding:'12px 16px',borderTop:'1px solid #93c5fd'}}>
                          <div style={{display:'flex',flexWrap:'wrap',gap:10,alignItems:'flex-end'}}>
                            <div style={{flex:'1 1 180px'}}>
                              <label style={{fontSize:'0.73rem',color:'var(--text-muted)',display:'block',marginBottom:3}}>Description</label>
                              <input value={editDraft.description||''} onChange={e=>setEditDraft({...editDraft,description:e.target.value})}
                                style={{width:'100%',padding:'5px 8px',borderRadius:'var(--radius)',border:'1px solid #93c5fd',fontSize:'0.83rem',background:'var(--bg)',color:'var(--text)'}} />
                            </div>
                            <div style={{flex:'1 1 180px'}}>
                              <label style={{fontSize:'0.73rem',color:'var(--text-muted)',display:'block',marginBottom:3}}>Category</label>
                              <GroupedCatSelect value={editDraft.category||''} categories={categories} onChange={v=>setEditDraft({...editDraft,category:v})} />
                            </div>
                            <div style={{flex:'1 1 140px'}}>
                              <label style={{fontSize:'0.73rem',color:'var(--text-muted)',display:'block',marginBottom:3}}>Status</label>
                              <select value={editDraft.status||'cleared'} onChange={e=>setEditDraft({...editDraft,status:e.target.value})}
                                style={{width:'100%',padding:'5px 8px',borderRadius:'var(--radius)',border:'1px solid #93c5fd',fontSize:'0.83rem',background:'var(--bg)',color:'var(--text)'}}>
                                <option value="cleared">Cleared</option>
                                <option value="pending">Pending</option>
                                <option value="reconciled">Reconciled</option>
                              </select>
                            </div>
                            <div style={{flex:'1 1 110px'}}>
                              <label style={{fontSize:'0.73rem',color:'var(--text-muted)',display:'block',marginBottom:3}}>Type</label>
                              <select value={editDraft.spendingType||'business'} onChange={e=>setEditDraft({...editDraft,spendingType:e.target.value})}
                                style={{width:'100%',padding:'5px 8px',borderRadius:'var(--radius)',border:'1px solid #93c5fd',fontSize:'0.83rem',background:'var(--bg)',color:'var(--text)'}}>
                                <option value="business">Business</option>
                                <option value="personal">Personal</option>
                              </select>
                            </div>
                            <div style={{flex:'2 1 240px'}}>
                              <label style={{fontSize:'0.73rem',color:'var(--text-muted)',display:'block',marginBottom:3}}>Notes</label>
                              <input value={editDraft.notes||''} onChange={e=>setEditDraft({...editDraft,notes:e.target.value})}
                                placeholder="Add a note…"
                                style={{width:'100%',padding:'5px 8px',borderRadius:'var(--radius)',border:'1px solid #93c5fd',fontSize:'0.83rem',background:'var(--bg)',color:'var(--text)'}} />
                            </div>
                            <div style={{display:'flex',gap:6,flexShrink:0}}>
                              <button className="btn btn-primary btn-sm" onClick={saveEdit}>Save</button>
                              <button className="btn btn-sm" onClick={()=>{setEditId(null);setEditDraft(null)}}>Cancel</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Accounts ─────────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  name:'', balance:'', balanceAsOf:today(), type:'checking', ownership:'personal', isLiability:false,
  creditLimit:'', minPayment:'', dueDate:'', apr:'', paymentStatus:'upcoming',
  countInNetWorth: true,
}
const LIABILITY_TYPES = ['credit_card','loan','student_loan','mortgage','line_of_credit','business_loan','credit']

function AccountsTab({ accounts, setAccounts, transactions=[], setTransactions, categories=[] }) {
  const [filter,   setFilter]   = useState('all')   // all | personal | business
  const [showForm, setShowForm] = useState(false)
  const [editing,  setEdit]     = useState(null)
  const [form,     setForm]     = useState(EMPTY_FORM)
  const [registerAcct, setRegisterAcct] = useState(null)
  const [payModal,     setPayModal]     = useState(null)
  const [payForm,      setPayForm]      = useState({ amount:'', date:today(), method:'Check', note:'' })
  const [editPayModal, setEditPayModal] = useState(null) // { payment, account }
  const [editPayForm,  setEditPayForm]  = useState({ amount:'', date:'', method:'Check', note:'' })

  // Normalise old accounts saved without ownership / isLiability / countInNetWorth
  const norm = accounts.map(a=>({
    ...a,
    ownership:        a.ownership        ?? (a.type==='business_checking'?'business':'personal'),
    isLiability:      a.isLiability      ?? LIABILITY_TYPES.includes(a.type),
    countInNetWorth:  a.countInNetWorth  ?? true,
  }))

  function save(e) {
    e.preventDefault()
    const newBalance = parseFloat(form.balance) || 0
    const asOfDate   = form.balanceAsOf || today()

    // Build updated balance history: add a snapshot if balance or date is set
    function buildHistory(existing) {
      const hist = [...(existing || [])]
      if (form.balance !== '') {
        // Replace any existing snapshot for the same date, otherwise append
        const idx = hist.findIndex(s => s.date === asOfDate)
        const snap = { id: uid(), date: asOfDate, balance: newBalance, note: 'Balance update' }
        if (idx >= 0) hist[idx] = { ...hist[idx], balance: newBalance }
        else hist.push(snap)
      }
      return hist
    }

    const rec = {
      ...form,
      balance:          newBalance,
      creditLimit:      parseFloat(form.creditLimit) || 0,
      minPayment:       parseFloat(form.minPayment)  || 0,
      apr:              form.apr ? parseFloat(form.apr) : '',
      countInNetWorth:  form.ownership !== 'business' ? true : form.countInNetWorth,
    }

    if (editing) {
      setAccounts(accounts.map(a => a.id === editing
        ? { ...a, ...rec, balanceHistory: buildHistory(a.balanceHistory) }
        : a
      ))
      setEdit(null)
    } else {
      setAccounts([...accounts, { ...rec, id: uid(), balanceHistory: buildHistory([]) }])
    }
    setForm(EMPTY_FORM)
    setShowForm(false)
  }

  function startEdit(a) {
    setEdit(a.id)
    // Pre-fill balanceAsOf from the most recent history snapshot, or today
    const hist = [...(a.balanceHistory || [])].sort((x,y) => y.date.localeCompare(x.date))
    const latestDate = hist[0]?.date || today()
    setForm({
      name:a.name, balance:a.balance, balanceAsOf:latestDate,
      type:a.type||'checking',
      ownership:a.ownership||'personal',
      isLiability:a.isLiability??LIABILITY_TYPES.includes(a.type),
      creditLimit:a.creditLimit||'', minPayment:a.minPayment||'',
      dueDate:a.dueDate||'', apr:a.apr||'',
      paymentStatus:a.paymentStatus||'upcoming',
      countInNetWorth: a.countInNetWorth ?? true,
    })
    setShowForm(true)
    window.scrollTo({top:0,behavior:'smooth'})
  }

  // Split and filter
  const all       = filter==='all' ? norm : norm.filter(a=>a.ownership===filter)
  const liabilities    = all.filter(a=>a.isLiability)
  const personalAssets = all.filter(a=>!a.isLiability && a.ownership!=='business')
  const businessAssets = all.filter(a=>!a.isLiability && a.ownership==='business')

  const totalAssets = norm.filter(a=>!a.isLiability && a.countInNetWorth!==false).reduce((s,a)=>s+Math.abs(Number(a.balance)),0)
  const totalLiabs  = norm.filter(a=>a.isLiability  && a.countInNetWorth!==false).reduce((s,a)=>s+Math.abs(Number(a.balance)),0)
  const totalLimit  = norm.filter(a=>a.isLiability&&a.creditLimit).reduce((s,a)=>s+Number(a.creditLimit),0)
  const availCred   = totalLimit - totalLiabs
  const netWorth    = totalAssets - totalLiabs
  const excludedBal = norm.filter(a=>a.countInNetWorth===false).reduce((s,a)=>s+Math.abs(Number(a.balance)),0)

  const del = id => {
    setAccounts(accounts.filter(x=>x.id!==id))
    if (registerAcct?.id===id) setRegisterAcct(null)
  }
  const togglePaid = id => setAccounts(accounts.map(a=>a.id===id?{...a,paymentStatus:a.paymentStatus==='paid'?'upcoming':'paid'}:a))

  function submitPayment(e) {
    e.preventDefault()
    const a = payModal.account
    const amt = parseFloat(payForm.amount)
    if (!amt || amt <= 0) return
    // Reduce the owed balance
    const owed = Math.abs(Number(a.balance))
    const newOwed = Math.max(0, owed - amt)
    const newBalance = Number(a.balance) < 0 ? -newOwed : newOwed
    // Add a transaction record
    const txn = {
      id: uid(),
      date: payForm.date || today(),
      description: `Payment — ${a.name}${payForm.note ? ` (${payForm.note})` : ''}`,
      amount: amt,
      category: 'Credit Card Payment',
      type: 'expense',
      group: 'Expenses',
      status: 'cleared',
      accountId: a.id,
      account: a.name,
      spendingType: a.ownership || 'personal',
      notes: payForm.method,
    }
    setTransactions([...(transactions||[]), txn])
    setAccounts(accounts.map(x => x.id===a.id ? { ...x, balance: newBalance, paymentStatus: 'paid' } : x))
    setPayModal(null)
    setPayForm({ amount:'', date:today(), method:'Check', note:'' })
  }

  function submitEditPayment(e) {
    e.preventDefault()
    const { payment, account } = editPayModal
    const oldAmt = parseFloat(payment.amount) || 0
    const newAmt = parseFloat(editPayForm.amount) || 0
    if (!newAmt || newAmt <= 0) return
    // Adjust account balance: reverse old payment, apply new payment
    const owed = Math.abs(Number(account.balance))
    const restoredOwed = owed + oldAmt        // undo old payment
    const newOwed = Math.max(0, restoredOwed - newAmt)
    const newBalance = Number(account.balance) < 0 ? -newOwed : newOwed
    const updatedTxn = {
      ...payment,
      amount: newAmt,
      date: editPayForm.date || payment.date,
      notes: editPayForm.method,
      description: `Payment — ${account.name}${editPayForm.note ? ` (${editPayForm.note})` : ''}`,
    }
    setTransactions((transactions||[]).map(t => t.id===payment.id ? updatedTxn : t))
    setAccounts(accounts.map(x => x.id===account.id ? { ...x, balance: newBalance } : x))
    setEditPayModal(null)
  }

  function deletePayment(payment, account) {
    // Reverse the payment: add amount back to balance
    const owed = Math.abs(Number(account.balance))
    const restoredOwed = owed + (parseFloat(payment.amount) || 0)
    const newBalance = Number(account.balance) < 0 ? -restoredOwed : restoredOwed
    setTransactions((transactions||[]).filter(t => t.id !== payment.id))
    setAccounts(accounts.map(x => x.id===account.id ? { ...x, balance: newBalance } : x))
  }

  const updateAccount = updated => {
    setAccounts(accounts.map(a=>a.id===updated.id?updated:a))
    if (registerAcct?.id===updated.id) setRegisterAcct(updated)
  }

  // If a register is open, show it instead of the list
  if (registerAcct) {
    return (
      <AccountRegister
        account={registerAcct}
        transactions={transactions}
        setTransactions={setTransactions||(() => {})}
        categories={categories}
        onUpdateAccount={updateAccount}
        onBack={()=>setRegisterAcct(null)}
      />
    )
  }

  return (
    <div>
      {/* ── Page header ──────────────────────────────────────────── */}
      <div className="flex-between mb-16">
        <h2>Accounts &amp; Balance Sheet</h2>
        <button className="btn btn-primary btn-sm" onClick={()=>{setEdit(null);setForm(EMPTY_FORM);setShowForm(v=>!v)}}>
          {showForm&&!editing?'Cancel':'+ Add Account'}
        </button>
      </div>

      {/* ── Summary metrics ──────────────────────────────────────── */}
      <div className="metrics-grid mb-24" style={{gridTemplateColumns:`repeat(${totalLimit>0?4:3},1fr)`}}>
        <div className="metric-card metric-card-income">
          <div className="metric-label">Total Assets</div>
          <div className="metric-value text-green">{formatCurrency(totalAssets,true)}</div>
          <div className="metric-change neutral">{norm.filter(a=>!a.isLiability).length} accounts</div>
        </div>
        <div className="metric-card metric-card-expense">
          <div className="metric-label">Total Liabilities</div>
          <div className="metric-value text-red">{formatCurrency(totalLiabs,true)}</div>
          <div className="metric-change neutral">{norm.filter(a=>a.isLiability).length} accounts</div>
        </div>
        {totalLimit>0 && (
          <div className="metric-card metric-card-blue">
            <div className="metric-label">Available Credit</div>
            <div className="metric-value" style={{color:'var(--blue)'}}>{formatCurrency(Math.max(0,availCred),true)}</div>
            <div className="metric-change neutral">of {formatCurrency(totalLimit)} total limit</div>
          </div>
        )}
        <div className="metric-card metric-card-net">
          <div className="metric-label">Net Worth</div>
          <div className={`metric-value ${netWorth>=0?'text-green':'text-red'}`}>{formatCurrency(netWorth,true)}</div>
          {excludedBal>0 && <div className="metric-change neutral" style={{fontSize:'0.68rem'}}>+{formatCurrency(excludedBal)} excluded (escrow/held)</div>}
        </div>
      </div>

      {/* ── Add / Edit Form ───────────────────────────────────────── */}
      {showForm && (
        <div className="card mb-24">
          <div className="card-header">
            <h3>{editing?'Edit Account':'Add Account'}</h3>
            {editing && <button className="btn btn-sm" onClick={()=>{setEdit(null);setForm(EMPTY_FORM);setShowForm(false)}}>Cancel</button>}
          </div>
          <div className="card-body">
            <form onSubmit={save}>
              <div className="form-row">
                <div className="form-group" style={{gridColumn:'span 2'}}>
                  <label>Account Name</label>
                  <input placeholder="e.g. Chase Sapphire Reserve" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Ownership</label>
                  <select value={form.ownership} onChange={e=>setForm({...form,ownership:e.target.value})}>
                    <option value="personal">Personal</option>
                    <option value="business">Business</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Account Type</label>
                  <select value={form.type} onChange={e=>{
                    const isLiab=LIABILITY_TYPES.includes(e.target.value)
                    setForm({...form,type:e.target.value,isLiability:isLiab})
                  }}>
                    <optgroup label="── Assets ──">
                      <option value="checking">Checking</option>
                      <option value="savings">Savings</option>
                      <option value="investment">Investment / Brokerage</option>
                      <option value="real_estate">Real Estate Asset</option>
                      <option value="cash">Cash</option>
                      <option value="other">Other Asset</option>
                    </optgroup>
                    <optgroup label="── Liabilities ──">
                      <option value="credit_card">Credit Card</option>
                      <option value="loan">Loan (Auto / Personal)</option>
                      <option value="student_loan">Student Loan</option>
                      <option value="mortgage">Mortgage</option>
                      <option value="line_of_credit">Line of Credit</option>
                      <option value="business_loan">Business Loan</option>
                    </optgroup>
                  </select>
                </div>
              </div>

              <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:14}}>
                <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:'0.875rem'}}>
                  <input type="checkbox" checked={form.isLiability} onChange={e=>setForm({...form,isLiability:e.target.checked})} />
                  Track as a liability (money owed — balance counted against net worth)
                </label>
                {form.ownership==='business' && (
                  <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:'0.875rem',marginLeft:2,padding:'8px 12px',background:'#eff6ff',border:'1px solid #93c5fd',borderRadius:'var(--radius)'}}>
                    <input type="checkbox" checked={form.countInNetWorth} onChange={e=>setForm({...form,countInNetWorth:e.target.checked})} />
                    <span>
                      <strong style={{color:'var(--blue)'}}>Count balance toward net worth</strong>
                      <span style={{display:'block',fontSize:'0.72rem',color:'var(--text-muted)',marginTop:1}}>
                        Uncheck for escrow, client-held funds, or accounts that aren't your personal money
                      </span>
                    </span>
                  </label>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>{form.isLiability?'Balance Owed':'Current Balance'}</label>
                  <DollarInput value={form.balance} onChange={e=>setForm({...form,balance:e.target.value})} />
                </div>
                <div className="form-group">
                  <label>As of Date</label>
                  <input type="date" value={form.balanceAsOf} onChange={e=>setForm({...form,balanceAsOf:e.target.value})} />
                  <div style={{fontSize:'0.68rem',color:'var(--text-muted)',marginTop:3}}>When was this balance recorded?</div>
                </div>
                {form.isLiability && <>
                  {['credit_card','line_of_credit','credit'].includes(form.type) && (
                    <div className="form-group">
                      <label>Credit Limit</label>
                      <DollarInput value={form.creditLimit} onChange={e=>setForm({...form,creditLimit:e.target.value})} />
                    </div>
                  )}
                  <div className="form-group">
                    <label>Min. Monthly Payment</label>
                    <DollarInput value={form.minPayment} onChange={e=>setForm({...form,minPayment:e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Payment Due Day <span style={{fontWeight:'normal',color:'var(--text-muted)'}}>(day of month)</span></label>
                    <select value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}>
                      <option value="">— Pick a day —</option>
                      {Array.from({length:31},(_,i)=>i+1).map(d=>(
                        <option key={d} value={d}>{formatDueDay(d)} of each month</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Interest Rate / APR <span style={{color:'var(--text-faint)',fontWeight:'normal'}}>(optional)</span></label>
                    <div style={{display:'flex',alignItems:'stretch'}}>
                      <input type="number" step="0.01" min="0" max="100" placeholder="22.99" value={form.apr}
                        onChange={e=>setForm({...form,apr:e.target.value})}
                        style={{borderRadius:'var(--radius) 0 0 var(--radius)',flex:1}} />
                      <span style={{padding:'7px 8px',background:'var(--surface-hover)',borderRadius:'0 var(--radius) var(--radius) 0',border:'1px solid var(--border)',borderLeft:'none',color:'var(--text-muted)',fontSize:'0.875rem',display:'flex',alignItems:'center'}}>%</span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Payment Status</label>
                    <select value={form.paymentStatus} onChange={e=>setForm({...form,paymentStatus:e.target.value})}>
                      <option value="upcoming">⏳ Upcoming</option>
                      <option value="paid">✓ Paid</option>
                      <option value="overdue">⚠ Overdue</option>
                    </select>
                  </div>
                </>}
              </div>
              <button type="submit" className="btn btn-primary btn-sm">{editing?'Update Account':'Add Account'}</button>
            </form>
          </div>
        </div>
      )}

      {/* ── Filter tabs ───────────────────────────────────────────── */}
      <div style={{display:'flex',gap:6,marginBottom:22}}>
        {[['all','All Accounts'],['personal','🌸 Personal'],['business','💼 Business']].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)} style={{
            padding:'5px 14px',borderRadius:20,fontSize:'0.8rem',cursor:'pointer',transition:'all 0.12s',
            fontWeight:filter===v?'bold':'normal',
            background:filter===v?(v==='business'?'#eff6ff':v==='personal'?'#fdf2f8':'var(--surface-hover)'):'var(--surface)',
            color:filter===v?(v==='business'?'var(--blue)':v==='personal'?'var(--pink)':'var(--text)'):'var(--text-muted)',
            border:`1px solid ${filter===v?(v==='business'?'#93c5fd':v==='personal'?'var(--pink-border)':'var(--border)'):'var(--border)'}`,
          }}>{l}</button>
        ))}
      </div>

      {/* ── Liabilities ───────────────────────────────────────────── */}
      {liabilities.length>0 && (
        <div style={{marginBottom:28}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
            <h3 style={{margin:0}}>💳 Liabilities</h3>
            <span style={{background:'#fef2f2',color:'var(--red)',border:'1px solid #fca5a5',borderRadius:20,padding:'2px 10px',fontSize:'0.72rem',fontWeight:'bold'}}>
              {formatCurrency(liabilities.reduce((s,a)=>s+Math.abs(Number(a.balance)),0))} owed
            </span>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {liabilities.map(a=>{
              const owed   = Math.abs(Number(a.balance))
              const limit  = Number(a.creditLimit)||0
              const avail  = limit>0?Math.max(0,limit-owed):null
              const pct    = limit>0?Math.min(100,(owed/limit)*100):null
              const pctClr = pct>75?'var(--red)':pct>50?'var(--amber)':'var(--green)'
              const ss     = payStatusStyle(a.paymentStatus||'upcoming')
              const soon   = isDueSoon(a.dueDate)
              const latestSnap = [...(a.balanceHistory||[])].sort((x,y)=>y.date.localeCompare(x.date))[0]
              return (
                <div key={a.id} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--radius)',overflow:'hidden',borderLeft:`4px solid ${ss.color}`}}>
                  {/* Card header row */}
                  <div style={{padding:'14px 18px 12px',display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
                    <div style={{flex:1,minWidth:0}}>
                      {/* Name + tags */}
                      <div style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap',marginBottom:6}}>
                        <span style={{fontWeight:'bold',fontSize:'0.95rem'}}>{a.name}</span>
                        <span style={{
                          background:a.ownership==='business'?'#eff6ff':'#fdf2f8',
                          color:a.ownership==='business'?'var(--blue)':'var(--pink)',
                          border:`1px solid ${a.ownership==='business'?'#93c5fd':'var(--pink-border)'}`,
                          borderRadius:20,padding:'1px 8px',fontSize:'0.62rem',fontWeight:'bold',
                        }}>{a.ownership==='business'?'Business':'Personal'}</span>
                        <span style={{background:'var(--surface-hover)',color:'var(--text-muted)',border:'1px solid var(--border)',borderRadius:20,padding:'1px 8px',fontSize:'0.62rem',textTransform:'capitalize'}}>
                          {(a.type||'credit').replace(/_/g,' ')}
                        </span>
                      </div>
                      {/* Balance */}
                      <div style={{display:'flex',alignItems:'baseline',gap:6,marginBottom:4}}>
                        <span style={{fontSize:'1.4rem',fontWeight:'bold',color:'var(--red)'}}>{formatCurrency(owed)}</span>
                        {limit>0&&<span style={{fontSize:'0.8rem',color:'var(--text-muted)'}}>of {formatCurrency(limit)} limit</span>}
                        <span style={{fontSize:'0.8rem',color:'var(--text-muted)'}}>owed</span>
                      </div>
                      {latestSnap&&<div style={{fontSize:'0.68rem',color:'var(--text-muted)',marginBottom:limit>0?6:2}}>as of {formatDate(latestSnap.date)}</div>}
                      {/* Utilization bar */}
                      {pct!==null&&(
                        <div>
                          <div style={{height:8,background:'var(--border)',borderRadius:4,overflow:'hidden'}}>
                            <div style={{width:`${pct}%`,height:'100%',background:pctClr,borderRadius:4,transition:'width 0.4s'}} />
                          </div>
                          <div style={{display:'flex',justifyContent:'space-between',marginTop:3,fontSize:'0.7rem',color:'var(--text-muted)'}}>
                            <span style={{color:pctClr,fontWeight:'bold'}}>{pct.toFixed(0)}% used</span>
                            {avail!==null&&<span><strong style={{color:'var(--green)'}}>{formatCurrency(avail)}</strong> available</span>}
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Status + action buttons */}
                    <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:8,flexShrink:0}}>
                      <span style={{background:ss.bg,color:ss.color,border:`1px solid ${ss.border}`,borderRadius:20,padding:'3px 10px',fontSize:'0.72rem',fontWeight:'bold',whiteSpace:'nowrap'}}>
                        {ss.label}
                      </span>
                      <div style={{display:'flex',gap:4,flexWrap:'wrap',justifyContent:'flex-end'}}>
                        <button className="btn btn-sm" style={{fontSize:'0.75rem',color:'var(--blue)',borderColor:'#93c5fd'}} onClick={()=>setRegisterAcct(a)}>📋 Register</button>
                        <button className="btn btn-sm" onClick={()=>startEdit(a)} style={{fontSize:'0.75rem'}}>Edit</button>
                        <button className="btn btn-sm" onClick={()=>togglePaid(a.id)}
                          style={{fontSize:'0.75rem',color:a.paymentStatus==='paid'?'var(--text-muted)':'var(--green)'}}>
                          {a.paymentStatus==='paid'?'↩ Unpay':'✓ Mark Paid'}
                        </button>
                        <button className="btn btn-sm" onClick={()=>{ setPayModal({account:a}); setPayForm({amount: a.minPayment>0?String(a.minPayment):'', date:today(), method:'Check', note:''}) }}
                          style={{fontSize:'0.75rem',background:'#eff6ff',color:'var(--blue)',border:'1px solid #93c5fd',fontWeight:600}}>
                          💳 Make Payment
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={()=>del(a.id)}>×</button>
                      </div>
                    </div>
                  </div>
                  {/* Detail strip */}
                  <div style={{borderTop:'1px solid var(--border-light)',padding:'8px 18px',background:'var(--bg)',display:'flex',gap:24,flexWrap:'wrap'}}>
                    {a.minPayment>0&&(
                      <div style={{fontSize:'0.78rem'}}>
                        <span style={{color:'var(--text-muted)'}}>Min Payment </span>
                        <strong>{formatCurrency(a.minPayment)}</strong>
                      </div>
                    )}
                    {a.dueDate&&(
                      <div style={{fontSize:'0.78rem'}}>
                        <span style={{color:'var(--text-muted)'}}>Due </span>
                        <strong style={{color:soon?'var(--red)':'var(--text)'}}>{soon?'⚠ ':''}the {formatDueDay(a.dueDate)} of each month</strong>
                      </div>
                    )}
                    {a.apr&&(
                      <div style={{fontSize:'0.78rem'}}>
                        <span style={{color:'var(--text-muted)'}}>APR </span>
                        <strong>{a.apr}%</strong>
                      </div>
                    )}
                    {avail!==null&&(
                      <div style={{fontSize:'0.78rem'}}>
                        <span style={{color:'var(--text-muted)'}}>Available Credit </span>
                        <strong style={{color:'var(--green)'}}>{formatCurrency(avail)}</strong>
                      </div>
                    )}
                  </div>

                  {/* Payment History */}
                  {(()=>{
                    const pmts = (transactions||[])
                      .filter(t => t.accountId===a.id && t.category==='Credit Card Payment')
                      .sort((x,y)=>y.date.localeCompare(x.date))
                    if (!pmts.length) return null
                    return (
                      <div style={{borderTop:'1px solid var(--border-light)',padding:'10px 18px',background:'#f8fafc'}}>
                        <div style={{fontSize:'0.68rem',fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>
                          💳 Payment History ({pmts.length})
                        </div>
                        <div style={{display:'flex',flexDirection:'column',gap:5}}>
                          {pmts.map(p=>(
                            <div key={p.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:'0.8rem',padding:'5px 10px',background:'var(--surface)',borderRadius:7,border:'1px solid var(--border-light)'}}>
                              <div style={{display:'flex',alignItems:'center',gap:10,minWidth:0,flex:1}}>
                                <span style={{color:'var(--green)',fontWeight:700,fontSize:'0.9rem'}}>✓</span>
                                <div style={{minWidth:0,flex:1}}>
                                  <div style={{fontWeight:600,color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.description}</div>
                                  <div style={{fontSize:'0.68rem',color:'var(--text-muted)'}}>{formatDate(p.date)}{p.notes?` · ${p.notes}`:''}</div>
                                </div>
                              </div>
                              <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0,marginLeft:12}}>
                                <span style={{fontWeight:700,color:'var(--green)'}}>−{formatCurrency(p.amount)}</span>
                                <button onClick={()=>{ setEditPayModal({payment:p,account:a}); setEditPayForm({amount:String(p.amount),date:p.date,method:p.notes||'Check',note:''}) }}
                                  style={{background:'none',border:'1px solid var(--border)',borderRadius:5,padding:'2px 8px',fontSize:'0.68rem',cursor:'pointer',color:'var(--text-muted)'}}>Edit</button>
                                <button onClick={()=>{ if(window.confirm('Delete this payment? The balance will be restored.')) deletePayment(p,a) }}
                                  style={{background:'none',border:'1px solid #fca5a5',borderRadius:5,padding:'2px 8px',fontSize:'0.68rem',cursor:'pointer',color:'var(--red)'}}>×</button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div style={{marginTop:8,fontSize:'0.72rem',color:'var(--text-muted)',textAlign:'right'}}>
                          Total paid: <strong style={{color:'var(--green)'}}>{formatCurrency(pmts.reduce((s,p)=>s+p.amount,0))}</strong>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Personal Assets ───────────────────────────────────────── */}
      {personalAssets.length>0&&(
        <div style={{marginBottom:28}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
            <h3 style={{margin:0}}>🌸 Personal Assets</h3>
            <span style={{background:'#fdf2f8',color:'var(--pink)',border:'1px solid var(--pink-border)',borderRadius:20,padding:'2px 10px',fontSize:'0.72rem',fontWeight:'bold'}}>
              {formatCurrency(personalAssets.reduce((s,a)=>s+Math.abs(Number(a.balance)),0))}
            </span>
          </div>
          <AssetTable accounts={personalAssets} onEdit={startEdit} onDelete={del} onRegister={setRegisterAcct} />
        </div>
      )}

      {/* ── Business Assets ───────────────────────────────────────── */}
      {businessAssets.length>0&&(
        <div style={{marginBottom:28}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
            <h3 style={{margin:0}}>💼 Business Assets</h3>
            <span style={{background:'#eff6ff',color:'var(--blue)',border:'1px solid #93c5fd',borderRadius:20,padding:'2px 10px',fontSize:'0.72rem',fontWeight:'bold'}}>
              {formatCurrency(businessAssets.reduce((s,a)=>s+Math.abs(Number(a.balance)),0))}
            </span>
          </div>
          <AssetTable accounts={businessAssets} onEdit={startEdit} onDelete={del} onRegister={setRegisterAcct} />
        </div>
      )}

      {accounts.length===0&&(
        <div style={{textAlign:'center',padding:'48px',color:'var(--text-faint)'}}>
          No accounts yet — click "+ Add Account" to get started
        </div>
      )}

      {/* ── Edit Payment Modal ── */}
      {editPayModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'var(--surface)',borderRadius:14,boxShadow:'0 20px 60px rgba(0,0,0,0.25)',width:'100%',maxWidth:420,overflow:'hidden'}}>
            <div style={{padding:'18px 22px 14px',background:'linear-gradient(135deg,#f0fdf4,#dcfce7)',borderBottom:'1px solid #86efac',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <div style={{fontWeight:700,fontSize:'1rem',color:'var(--green)'}}>✏️ Edit Payment</div>
                <div style={{fontSize:'0.75rem',color:'#16a34a',marginTop:2}}>{editPayModal.account.name}</div>
              </div>
              <button onClick={()=>setEditPayModal(null)} style={{background:'none',border:'none',fontSize:'1.2rem',cursor:'pointer',color:'var(--text-muted)',lineHeight:1}}>×</button>
            </div>
            <form onSubmit={submitEditPayment} style={{padding:'20px 22px',display:'flex',flexDirection:'column',gap:14}}>
              <div>
                <label style={{display:'block',fontSize:'0.75rem',fontWeight:600,color:'var(--text-muted)',marginBottom:5}}>Payment Amount *</label>
                <div style={{position:'relative'}}>
                  <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',fontWeight:600}}>$</span>
                  <input type="number" step="0.01" min="0.01" required autoFocus
                    value={editPayForm.amount}
                    onChange={e=>setEditPayForm({...editPayForm,amount:e.target.value})}
                    style={{width:'100%',paddingLeft:24,fontWeight:700,fontSize:'1.1rem'}} />
                </div>
              </div>
              <div>
                <label style={{display:'block',fontSize:'0.75rem',fontWeight:600,color:'var(--text-muted)',marginBottom:5}}>Payment Date</label>
                <input type="date" value={editPayForm.date} onChange={e=>setEditPayForm({...editPayForm,date:e.target.value})} style={{width:'100%'}} />
              </div>
              <div>
                <label style={{display:'block',fontSize:'0.75rem',fontWeight:600,color:'var(--text-muted)',marginBottom:5}}>Payment Method</label>
                <select value={editPayForm.method} onChange={e=>setEditPayForm({...editPayForm,method:e.target.value})} style={{width:'100%'}}>
                  {['Check','ACH / Bank Transfer','Online Bill Pay','Credit Card','Debit Card','Zelle','Cash','Other'].map(m=>(
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{display:'block',fontSize:'0.75rem',fontWeight:600,color:'var(--text-muted)',marginBottom:5}}>Note (optional)</label>
                <input type="text" placeholder="e.g. March minimum payment" value={editPayForm.note} onChange={e=>setEditPayForm({...editPayForm,note:e.target.value})} style={{width:'100%'}} />
              </div>
              <div style={{display:'flex',gap:10,justifyContent:'flex-end',paddingTop:4}}>
                <button type="button" className="btn btn-sm" onClick={()=>setEditPayModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-sm" style={{background:'var(--green)',color:'#fff',border:'none',fontWeight:700,padding:'7px 20px'}}>
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Make Payment Modal ── */}
      {payModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'var(--surface)',borderRadius:14,boxShadow:'0 20px 60px rgba(0,0,0,0.25)',width:'100%',maxWidth:420,overflow:'hidden'}}>
            {/* Modal header */}
            <div style={{padding:'18px 22px 14px',background:'linear-gradient(135deg,#eff6ff,#dbeafe)',borderBottom:'1px solid #93c5fd',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <div style={{fontWeight:700,fontSize:'1rem',color:'var(--blue)'}}>💳 Make a Payment</div>
                <div style={{fontSize:'0.75rem',color:'#3b82f6',marginTop:2}}>{payModal.account.name} — {formatCurrency(Math.abs(Number(payModal.account.balance)))} owed</div>
              </div>
              <button onClick={()=>setPayModal(null)} style={{background:'none',border:'none',fontSize:'1.2rem',cursor:'pointer',color:'var(--text-muted)',lineHeight:1}}>×</button>
            </div>
            {/* Modal body */}
            <form onSubmit={submitPayment} style={{padding:'20px 22px',display:'flex',flexDirection:'column',gap:14}}>
              {/* Amount */}
              <div>
                <label style={{display:'block',fontSize:'0.75rem',fontWeight:600,color:'var(--text-muted)',marginBottom:5}}>Payment Amount *</label>
                <div style={{position:'relative'}}>
                  <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',fontWeight:600}}>$</span>
                  <input
                    type="number" step="0.01" min="0.01" required autoFocus
                    placeholder="0.00"
                    value={payForm.amount}
                    onChange={e=>setPayForm({...payForm,amount:e.target.value})}
                    style={{width:'100%',paddingLeft:24,fontWeight:700,fontSize:'1.1rem',textAlign:'left'}}
                  />
                </div>
                {payModal.account.minPayment>0&&(
                  <div style={{marginTop:5,display:'flex',gap:8}}>
                    <button type="button" onClick={()=>setPayForm({...payForm,amount:String(payModal.account.minPayment)})}
                      style={{fontSize:'0.68rem',background:'#eff6ff',color:'var(--blue)',border:'1px solid #93c5fd',borderRadius:6,padding:'2px 8px',cursor:'pointer'}}>
                      Min: {formatCurrency(payModal.account.minPayment)}
                    </button>
                    <button type="button" onClick={()=>setPayForm({...payForm,amount:String(Math.abs(Number(payModal.account.balance)))})}
                      style={{fontSize:'0.68rem',background:'#f0fdf4',color:'var(--green)',border:'1px solid #86efac',borderRadius:6,padding:'2px 8px',cursor:'pointer'}}>
                      Full Balance: {formatCurrency(Math.abs(Number(payModal.account.balance)))}
                    </button>
                  </div>
                )}
              </div>
              {/* Date */}
              <div>
                <label style={{display:'block',fontSize:'0.75rem',fontWeight:600,color:'var(--text-muted)',marginBottom:5}}>Payment Date</label>
                <input type="date" value={payForm.date} onChange={e=>setPayForm({...payForm,date:e.target.value})} style={{width:'100%'}} />
              </div>
              {/* Method */}
              <div>
                <label style={{display:'block',fontSize:'0.75rem',fontWeight:600,color:'var(--text-muted)',marginBottom:5}}>Payment Method</label>
                <select value={payForm.method} onChange={e=>setPayForm({...payForm,method:e.target.value})} style={{width:'100%'}}>
                  {['Check','ACH / Bank Transfer','Online Bill Pay','Credit Card','Debit Card','Zelle','Cash','Other'].map(m=>(
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              {/* Note */}
              <div>
                <label style={{display:'block',fontSize:'0.75rem',fontWeight:600,color:'var(--text-muted)',marginBottom:5}}>Note (optional)</label>
                <input type="text" placeholder="e.g. March minimum payment" value={payForm.note} onChange={e=>setPayForm({...payForm,note:e.target.value})} style={{width:'100%'}} />
              </div>
              {/* Actions */}
              <div style={{display:'flex',gap:10,justifyContent:'flex-end',paddingTop:4}}>
                <button type="button" className="btn btn-sm" onClick={()=>setPayModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-sm" style={{background:'var(--blue)',color:'#fff',border:'none',fontWeight:700,padding:'7px 20px'}}>
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Categories ───────────────────────────────────────────────────────────────
function CategoriesTab({ categories, setCategories }) {
  const [form, setForm]    = useState({ name:'', group:'', kind:'business' })
  const [editing, setEdit] = useState(null)
  const [groupErr, setGroupErr] = useState(false)

  function save(e) {
    e.preventDefault()
    if (!form.group) { setGroupErr(true); return }
    setGroupErr(false)
    if (editing) { setCategories(categories.map(c=>c.id===editing?{...c,...form}:c)); setEdit(null) }
    else          { setCategories([...categories,{...form,id:uid()}]) }
    setForm({ name:'',group:'',kind:'business' })
  }

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>Category Manager</h2>
        <button className="btn btn-sm btn-danger" onClick={()=>{if(window.confirm('Reset all categories to defaults?'))setCategories(DEFAULT_CATEGORIES)}}>Reset to Defaults</button>
      </div>
      <div className="card mb-24">
        <div className="card-header"><h3>{editing?'Edit Category':'Add Category'}</h3></div>
        <div className="card-body">
          <form onSubmit={save}>
            <div className="form-row">
              <div className="form-group" style={{gridColumn:'span 2'}}><label>Category Name</label><input placeholder="e.g. Drone Photography" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required /></div>
              <div className="form-group">
                <label>Group <span style={{color:'var(--red)'}}>*</span></label>
                <select value={form.group} onChange={e=>{setForm({...form,group:e.target.value});setGroupErr(false)}}
                  style={{borderColor:groupErr?'var(--red)':''}}>
                  <option value="">— Select Group —</option>
                  {GROUP_ORDER.map(g=><option key={g}>{g}</option>)}
                </select>
                {groupErr&&<span style={{fontSize:'0.73rem',color:'var(--red)'}}>A group is required</span>}
              </div>
              <div className="form-group"><label>Applies To</label><select value={form.kind} onChange={e=>setForm({...form,kind:e.target.value})}><option value="business">Business</option><option value="personal">Personal</option><option value="both">Both</option></select></div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button type="submit" className="btn btn-primary btn-sm">{editing?'Update':'Add Category'}</button>
              {editing&&<button type="button" className="btn btn-sm" onClick={()=>{setEdit(null);setForm({name:'',group:'',kind:'business'});setGroupErr(false)}}>Cancel</button>}
            </div>
          </form>
        </div>
      </div>
      {GROUP_ORDER.map(g=>{
        const cats = categories.filter(c=>c.group===g)
        if (!cats.length) return null
        const s = GROUP_STYLE[g]||{}
        return (
          <div key={g} className="card mb-12">
            <div className="card-header" style={{background:s.bg}}>
              <h3 style={{color:s.color}}>{g}</h3>
              <span className="text-xs text-muted">{cats.length} categories</span>
            </div>
            <div style={{padding:'10px 14px',display:'flex',flexWrap:'wrap',gap:6}}>
              {cats.map(c=>(
                <div key={c.id} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 10px',background:'var(--surface-hover)',border:'1px solid var(--border)',borderRadius:20}}>
                  <span style={{fontSize:'0.8125rem'}}>{c.name}</span>
                  <KindBadge kind={c.kind} />
                  <button onClick={()=>{setEdit(c.id);setForm({name:c.name,group:c.group||'',kind:c.kind});setGroupErr(false)}} style={{background:'none',border:'none',cursor:'pointer',fontSize:'0.7rem',padding:0,color:'var(--text-muted)'}}>✏️</button>
                  <button onClick={()=>setCategories(categories.filter(x=>x.id!==c.id))} style={{background:'none',border:'none',cursor:'pointer',color:'var(--red)',fontSize:'0.8rem',padding:0,lineHeight:1}}>×</button>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Tax ──────────────────────────────────────────────────────────────────────
function TaxTab({ transactions }) {
  const year   = new Date().getFullYear()
  const ytd    = transactions.filter(t=>t.status!=='pending_review'&&new Date(t.date+'T00:00:00').getFullYear()===year)
  const income = ytd.filter(t=>t.type==='income'&&t.status!=='pending').reduce((s,t)=>s+Number(t.amount),0)
  const exp    = ytd.filter(t=>t.type!=='income').reduce((s,t)=>s+Number(t.amount),0)
  const net    = income - exp
  const seTax  = Math.max(0,net*0.9235*0.153)
  const fRate  = net>89075?0.24:net>41775?0.22:0.12
  const fedTax = Math.max(0,net*fRate)
  const qtrly  = (seTax+fedTax)/4

  return (
    <div>
      <h2 className="mb-16">Tax Summary — {year}</h2>
      <div className="metrics-grid">
        <div className="metric-card metric-card-net"><div className="metric-label">YTD Net Income</div><div className={`metric-value ${net>=0?'text-green':'text-red'}`}>{formatCurrency(net,true)}</div></div>
        <div className="metric-card metric-card-expense"><div className="metric-label">Est. SE Tax (15.3%)</div><div className="metric-value">{formatCurrency(seTax,true)}</div><div className="metric-change neutral">on 92.35% of net</div></div>
        <div className="metric-card metric-card-pending"><div className="metric-label">Est. Federal ({(fRate*100).toFixed(0)}% bracket)</div><div className="metric-value">{formatCurrency(fedTax,true)}</div></div>
        <div className="metric-card metric-card-expense"><div className="metric-label">Est. Quarterly Payment</div><div className="metric-value text-red">{formatCurrency(qtrly,true)}</div></div>
      </div>
      <div className="card mt-24">
        <div className="card-header"><h3>Quarterly Schedule</h3></div>
        <div className="table-container">
          <table>
            <thead><tr><th>Quarter</th><th>Due Date</th><th className="text-right">Est. Payment</th><th>Status</th></tr></thead>
            <tbody>
              {[{l:'Q1 (Jan–Mar)',due:'Apr 15'},{l:'Q2 (Apr–Jun)',due:'Jun 15'},{l:'Q3 (Jul–Sep)',due:'Sep 15'},{l:'Q4 (Oct–Dec)',due:'Jan 15'}].map((q,i)=>{
                const current=Math.floor(new Date().getMonth()/3)
                const status=i<current?'Past Due':i===current?'Upcoming':'Future'
                return (
                  <tr key={q.l}>
                    <td>{q.l}</td><td>{q.due}</td>
                    <td className="text-right bold">{formatCurrency(qtrly)}</td>
                    <td><span className={`badge ${status==='Past Due'?'badge-red':status==='Upcoming'?'badge-amber':'badge-gray'}`}>{status}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Shared grouped category select ──────────────────────────────────────────
const NEW_CAT_SENTINEL = '__new__'
const EMPTY_NEW_CAT    = { name:'', group:'Expenses', kind:'business' }

function GroupedCatSelect({ value, categories, onChange, style={} }) {
  const [open,   setOpen]   = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    function handleOut(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleOut)
    return () => document.removeEventListener('mousedown', handleOut)
  }, [])

  const q        = search.toLowerCase().trim()
  const allCats  = categories.filter(c => !q || c.name.toLowerCase().includes(q) || c.group.toLowerCase().includes(q))
  const display  = value===NEW_CAT_SENTINEL ? '＋ New category…' : (value || '— Select —')
  const catRec   = categories.find(c=>c.name===value)
  const dotColor = catRec ? (GROUP_STYLE[catRec.group]?.color||'var(--text-muted)') : null

  function pick(val) { onChange(val); setOpen(false); setSearch('') }

  return (
    <div ref={ref} style={{position:'relative',display:'inline-block',...style}}>
      <button type="button" onClick={()=>setOpen(v=>!v)}
        style={{display:'flex',alignItems:'center',gap:5,fontSize:'0.78rem',padding:'3px 22px 3px 7px',
          borderRadius:'var(--radius)',border:'1px solid var(--border)',background:'var(--bg)',
          color:'var(--text)',cursor:'pointer',textAlign:'left',minWidth:110,maxWidth:170,position:'relative',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
        {dotColor&&<span style={{width:7,height:7,borderRadius:'50%',background:dotColor,flexShrink:0,display:'inline-block'}}/>}
        <span style={{overflow:'hidden',textOverflow:'ellipsis'}}>{display}</span>
        <span style={{position:'absolute',right:5,top:'50%',transform:'translateY(-50%)',fontSize:'0.6rem',color:'var(--text-muted)',pointerEvents:'none'}}>{open?'▲':'▼'}</span>
      </button>

      {open&&(
        <div style={{position:'absolute',top:'calc(100% + 3px)',left:0,zIndex:400,
          background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--radius)',
          boxShadow:'0 6px 20px rgba(0,0,0,0.15)',minWidth:230,maxHeight:300,display:'flex',flexDirection:'column'}}>

          {/* Search box */}
          <div style={{padding:'7px 8px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
            <input autoFocus value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Search categories…"
              style={{width:'100%',padding:'4px 8px',border:'1px solid var(--border)',
                borderRadius:'var(--radius)',fontSize:'0.8rem',background:'var(--bg)',color:'var(--text)'}} />
          </div>

          <div style={{overflowY:'auto',flex:1}}>
            {/* + New category */}
            <div onClick={()=>pick(NEW_CAT_SENTINEL)}
              style={{padding:'7px 12px',fontSize:'0.78rem',fontWeight:700,cursor:'pointer',
                color:'var(--blue)',borderBottom:'1px solid var(--border-light)'}}>
              ＋ New category…
            </div>

            {q
              /* Flat filtered list when searching */
              ? allCats.map(c=>{
                  const cs = GROUP_STYLE[c.group]||{}
                  return (
                    <div key={c.id} onClick={()=>pick(c.name)}
                      style={{padding:'6px 12px',fontSize:'0.78rem',cursor:'pointer',display:'flex',alignItems:'center',gap:7,
                        background:c.name===value?'var(--surface-hover)':'transparent'}}>
                      <span style={{width:7,height:7,borderRadius:'50%',background:cs.color||'var(--text-muted)',flexShrink:0,display:'inline-block'}}/>
                      <span style={{fontWeight:c.name===value?600:'normal',flex:1}}>{c.name}</span>
                      <span style={{fontSize:'0.65rem',color:'var(--text-muted)'}}>{c.group}</span>
                    </div>
                  )
                })
              /* Grouped view when not searching */
              : GROUP_ORDER.map(g=>{
                  const gc = categories.filter(c=>c.group===g)
                  if (!gc.length) return null
                  const gs = GROUP_STYLE[g]||{}
                  return (
                    <div key={g}>
                      <div style={{padding:'5px 12px 3px',fontSize:'0.63rem',fontWeight:700,
                        color:gs.color||'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em',
                        background:'var(--surface-hover)',borderTop:'1px solid var(--border-light)'}}>
                        {g}
                      </div>
                      {gc.map(c=>(
                        <div key={c.id} onClick={()=>pick(c.name)}
                          style={{padding:'6px 12px 6px 18px',fontSize:'0.78rem',cursor:'pointer',
                            background:c.name===value?'var(--surface-hover)':'transparent',
                            fontWeight:c.name===value?600:'normal'}}>
                          {c.name}
                        </div>
                      ))}
                    </div>
                  )
                })
            }
          </div>
        </div>
      )}
    </div>
  )
}

// ─── New-category modal (shared) ──────────────────────────────────────────────
function NewCatModal({ open, form, setForm, onSave, onCancel }) {
  if (!open) return null
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.35)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:24,width:'100%',maxWidth:420,boxShadow:'0 8px 32px rgba(0,0,0,0.18)'}}>
        <h3 style={{margin:'0 0 4px'}}>Add New Category</h3>
        <p style={{fontSize:'0.82rem',color:'var(--text-muted)',marginBottom:16}}>
          Saved to your Categories list and applied to this transaction immediately.
        </p>
        <form onSubmit={onSave}>
          <div className="form-group" style={{marginBottom:12}}>
            <label>Category Name</label>
            <input autoFocus placeholder="e.g. Drone Equipment" value={form.name}
              onChange={e=>setForm({...form,name:e.target.value})} required />
          </div>
          <div className="form-row" style={{marginBottom:16}}>
            <div className="form-group">
              <label>Group</label>
              <select value={form.group} onChange={e=>setForm({...form,group:e.target.value})}>
                {GROUP_ORDER.map(g=><option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Applies To</label>
              <select value={form.kind} onChange={e=>setForm({...form,kind:e.target.value})}>
                <option value="business">Business</option>
                <option value="personal">Personal</option>
                <option value="both">Both</option>
              </select>
            </div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={!form.name.trim()}>Save &amp; Apply</button>
            <button type="button" className="btn btn-sm" onClick={onCancel}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── All Transactions Register ────────────────────────────────────────────────
function TransactionsTab({ transactions, setTransactions, categories, setCategories, accounts=[] }) {
  const [search,  setSearch]  = useState('')
  const [fType,   setFType]   = useState('all')
  const [fAcct,   setFAcct]   = useState('')
  const [fBatch,  setFBatch]  = useState('')
  const [newCatFor,  setNewCatFor]  = useState(null)
  const [newCatForm, setNewCatForm] = useState(EMPTY_NEW_CAT)

  const filtered = [...transactions]
    .filter(t => t.status!=='pending_review')
    .filter(t => fType==='all' || t.type===fType)
    .filter(t => !fAcct || t.accountId===fAcct || t.account===fAcct)
    .filter(t => !fBatch || t.importBatch===fBatch)
    .filter(t => !search ||
      t.description?.toLowerCase().includes(search.toLowerCase()) ||
      t.category?.toLowerCase().includes(search.toLowerCase()) ||
      t.account?.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>b.date.localeCompare(a.date))

  // Only tracked CSV import batches — never include manually-entered transactions
  const batches = (() => {
    const seen=new Set(), result=[]
    ;[...transactions]
      .filter(t => !!t.importBatch)
      .sort((a,b)=>(b.importedAt||'').localeCompare(a.importedAt||''))
      .forEach(t=>{
        if(!seen.has(t.importBatch)){
          seen.add(t.importBatch)
          const batchTxns = transactions.filter(x=>x.importBatch===t.importBatch)
          const acctNames = [...new Set(batchTxns.map(x=>x.account).filter(Boolean))]
          result.push({
            id: t.importBatch,
            txns: batchTxns,
            date: t.importedAt||'',
            acct: acctNames.join(', ')||'',
          })
        }
      })
    return result
  })()

  function deleteOne(id) { setTransactions(transactions.filter(t=>t.id!==id)) }

  function deleteBatch(batchId) {
    const n = transactions.filter(t=>t.importBatch===batchId).length
    if (!window.confirm(`Delete all ${n} imported transactions from this batch? This only removes CSV-imported rows.`)) return
    setTransactions(transactions.filter(t=>t.importBatch!==batchId))
    if (fBatch===batchId) setFBatch('')
  }

  function updateCat(txId, catName) {
    if (catName===NEW_CAT_SENTINEL) { setNewCatFor(txId); setNewCatForm(EMPTY_NEW_CAT); return }
    const cr=categories.find(c=>c.name===catName)
    setTransactions(transactions.map(t=>t.id===txId
      ? {...t,category:catName,group:cr?.group||'Expenses',type:cr?.group==='Income'?'income':'expense'}
      : t
    ))
  }

  function saveNewCat(e) {
    e.preventDefault()
    if (!newCatForm.name.trim()) return
    const nc={...newCatForm,name:newCatForm.name.trim(),id:uid()}
    setCategories([...categories,nc])
    if (newCatFor) updateCat(newCatFor, nc.name)
    setNewCatFor(null); setNewCatForm(EMPTY_NEW_CAT)
  }

  const totalIncome  = filtered.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0)
  const totalExpense = filtered.filter(t=>t.type!=='income').reduce((s,t)=>s+Number(t.amount),0)

  return (
    <div>
      <NewCatModal open={!!newCatFor} form={newCatForm} setForm={setNewCatForm}
        onSave={saveNewCat} onCancel={()=>setNewCatFor(null)} />

      {/* ── Import History ── */}
      <div className="card mb-20">
        <div className="card-header">
          <h3>📦 Import History</h3>
        </div>
        {batches.length === 0 ? (
          <div style={{padding:'14px 16px',color:'var(--text-muted)',fontSize:'0.85rem'}}>
            No CSV imports yet — use the <strong>Import CSV</strong> tab to upload a bank statement.
          </div>
        ) : (
          <div style={{padding:'4px 0'}}>
            {batches.map((b,i)=>{
              const active = fBatch===b.id
              return (
                <div key={b.id} style={{
                  display:'flex',alignItems:'center',gap:12,
                  padding:'8px 16px',
                  borderBottom: i<batches.length-1 ? '1px solid var(--border)' : 'none',
                  background: active ? 'var(--blue-bg)' : 'transparent',
                }}>
                  <span style={{fontSize:'0.82rem',minWidth:90,color:'var(--text-muted)'}}>
                    {b.date ? formatDate(b.date) : '—'}
                  </span>
                  <span style={{fontSize:'0.85rem',flex:1,fontWeight:500}}>
                    {b.acct || '—'}
                  </span>
                  <span style={{fontSize:'0.78rem',color:'var(--text-muted)'}}>
                    {b.txns.length} rows
                  </span>
                  <button className="btn btn-sm" style={{fontSize:'0.72rem',padding:'2px 8px',color:active?'var(--blue)':'inherit',borderColor:active?'var(--blue)':'var(--border)'}}
                    onClick={()=>setFBatch(active?'':b.id)}>
                    {active?'✓ Filtering':'Filter'}
                  </button>
                  <button className="btn btn-sm btn-danger" style={{fontSize:'0.72rem',padding:'2px 8px'}}
                    onClick={()=>deleteBatch(b.id)}>
                    ↩ Undo
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Filters + header ── */}
      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:16}}>
        <h2 style={{margin:0}}>All Transactions</h2>
        <span style={{fontSize:'0.8rem',color:'var(--text-muted)',background:'var(--surface-hover)',border:'1px solid var(--border)',borderRadius:20,padding:'2px 10px'}}>
          {filtered.length} shown
        </span>
        <div style={{marginLeft:'auto',display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          <input placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}
            style={{width:150,padding:'4px 8px',fontSize:'0.82rem'}} />
          <select value={fType} onChange={e=>setFType(e.target.value)} style={{fontSize:'0.82rem',padding:'4px 6px'}}>
            <option value="all">All types</option>
            <option value="income">Income only</option>
            <option value="expense">Expenses only</option>
          </select>
          <select value={fAcct} onChange={e=>setFAcct(e.target.value)} style={{fontSize:'0.82rem',padding:'4px 6px'}}>
            <option value="">All accounts</option>
            {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          {(fBatch||fType!=='all'||fAcct||search)&&(
            <button className="btn btn-sm" onClick={()=>{setFBatch('');setFType('all');setFAcct('');setSearch('')}}>
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ── Totals bar ── */}
      <div style={{display:'flex',gap:16,marginBottom:14,padding:'10px 16px',background:'var(--surface-hover)',borderRadius:'var(--radius)',border:'1px solid var(--border)',flexWrap:'wrap'}}>
        <span style={{fontSize:'0.82rem'}}><span style={{color:'var(--text-muted)'}}>Showing: </span><strong style={{color:'var(--green)'}}>+{formatCurrency(totalIncome)}</strong> income</span>
        <span style={{fontSize:'0.82rem'}}><strong style={{color:'var(--red)'}}>−{formatCurrency(totalExpense)}</strong> expenses</span>
        <span style={{fontSize:'0.82rem',marginLeft:'auto'}}><span style={{color:'var(--text-muted)'}}>Net: </span><strong style={{color:totalIncome-totalExpense>=0?'var(--green)':'var(--red)'}}>{formatCurrency(totalIncome-totalExpense)}</strong></span>
      </div>

      {/* ── Table ── */}
      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Account</th>
                <th>B / P</th>
                <th className="text-right">Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length===0&&(
                <tr><td colSpan={7} style={{padding:'32px',textAlign:'center',color:'var(--text-faint)'}}>
                  No transactions found
                </td></tr>
              )}
              {filtered.map(t=>{
                const isIncome=t.type==='income'
                const catRec=categories.find(c=>c.name===t.category)
                const gs=GROUP_STYLE[catRec?.group]||{}
                const acct=accounts.find(a=>a.id===t.accountId)||null
                return (
                  <tr key={t.id}>
                    <td className="text-sm text-muted" style={{whiteSpace:'nowrap'}}>{formatDate(t.date)}</td>
                    <td style={{maxWidth:200}}>
                      <div style={{fontWeight:'500',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.description}</div>
                      {t.importBatch&&<span style={{fontSize:'0.6rem',color:'var(--text-muted)',background:'var(--surface-hover)',border:'1px solid var(--border)',borderRadius:10,padding:'0 5px'}}>imported</span>}
                    </td>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:4}}>
                        {catRec&&<span style={{width:7,height:7,borderRadius:'50%',background:gs.color||'var(--text-muted)',flexShrink:0,display:'inline-block'}}/>}
                        <GroupedCatSelect value={t.category||'Other'} categories={categories} onChange={v=>updateCat(t.id,v)} />
                      </div>
                      {catRec&&<div style={{fontSize:'0.62rem',color:gs.color||'var(--text-muted)',marginTop:1,marginLeft:11}}>{catRec.group}</div>}
                    </td>
                    <td className="text-sm text-muted">{acct?.name||t.account||'—'}</td>
                    <td><KindBadge kind={t.spendingType} /></td>
                    <td className="text-right bold" style={{color:isIncome?'var(--green)':'var(--red)',whiteSpace:'nowrap'}}>
                      {isIncome?'+':'−'}{formatCurrency(t.amount)}
                    </td>
                    <td>
                      <button className="btn btn-sm btn-danger" onClick={()=>deleteOne(t.id)}>×</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Import CSV ───────────────────────────────────────────────────────────────

function ImportTab({ transactions, setTransactions, categories, setCategories, accounts=[] }) {
  const fileRef = useRef(null)
  const [pending,      setPending]      = useState([])
  const [aiLoad,       setAiLoad]       = useState(false)
  const [aiErr,        setAiErr]        = useState('')
  const [importAcctId, setImportAcctId] = useState('')
  const [lastBatchId,  setLastBatchId]  = useState(null)
  const [newCatFor,    setNewCatFor]    = useState(null)
  const [newCatForm,   setNewCatForm]   = useState(EMPTY_NEW_CAT)


  const importAcct = accounts.find(a=>a.id===importAcctId)

  const [vendorRules] = useLocalStorage('finance_vendor_rules', [])

  // Build payee history map (tier-3 fallback)
  const payeeHistory = {}
  transactions
    .filter(t => t.category && t.category !== 'Other' && t.description)
    .forEach(t => {
      const k = t.description.toLowerCase().trim()
      if (!payeeHistory[k]) payeeHistory[k] = t.category
    })

  function handleCSV(e) {
    const file=e.target.files[0]; if(!file) return
    Papa.parse(file,{header:true,skipEmptyLines:true,complete:({data})=>{
      const parsed=data.map(row=>{
        const keys=Object.keys(row)
        const getCol=(...terms)=>{
          for(const term of terms){
            const k=keys.find(k=>k.toLowerCase().includes(term))
            if(k&&row[k]&&String(row[k]).trim()) return String(row[k]).trim()
          }
          return ''
        }

        // Smarter amount + type detection
        const amtRaw   = getCol('amount','amt')
        const debitRaw = getCol('debit','withdrawal','charge')
        const credRaw  = getCol('credit','deposit')

        let amount=0, type='expense'
        if (amtRaw) {
          // Strip $, commas, handle (50.00) accounting-negative format
          const cleaned = amtRaw.replace(/[$, ]/g,'').replace(/\(([^)]+)\)/,'−$1')
          const n = parseFloat(cleaned.replace('−','-')) || 0
          const isNeg = amtRaw.startsWith('-') || amtRaw.startsWith('(') || n < 0
          amount = Math.abs(n)
          type   = isNeg ? 'expense' : 'income'
        } else if (debitRaw || credRaw) {
          const d=parseFloat(debitRaw?.replace(/[$,]/g,'')||'0')||0
          const c=parseFloat(credRaw?.replace(/[$,]/g,'')||'0')||0
          amount = Math.max(d,c)
          type   = d>0 ? 'expense' : 'income'
        }

        const description = getCol('description','memo','payee','name','narration')
        const hit = matchVendor(description, vendorRules, payeeHistory, categories)
        const rawDate = getCol('date','posted','trans')
        return{
          id:uid(),
          date: normalizeDate(rawDate) || rawDate,
          description,
          amount,
          type: hit?.cat?.group==='Income' ? 'income' : type,
          group: hit?.cat?.group || 'Expenses',
          category: hit?.cat?.name || 'Other',
          spendingType:'business', status:'pending_review',
          account: importAcct?.name||'',
          accountId: importAcctId||'',
          _autoCat: !!hit,
          _matchSource: hit?.source || null,
        }
      }).filter(t=>t.amount>0)
      setPending(parsed)
      setLastBatchId(null)
    }})
    e.target.value=''
  }

  async function aiCategorize() {
    setAiLoad(true);setAiErr('')
    try {
      const results=await categorizeTransactions(pending)
      const map=Object.fromEntries(results.map(r=>[r.index,r.category]))
      setPending(pending.map((t,i)=>{
        const catName=map[i]||t.category
        const catRec=categories.find(c=>c.name===catName)
        return{...t,category:catName,group:catRec?.group||'Expenses',type:catRec?.group==='Income'?'income':'expense'}
      }))
    } catch(err){setAiErr(err.message)}
    setAiLoad(false)
  }

  function handleCatChange(rowIdx, value) {
    if(value===NEW_CAT_SENTINEL){setNewCatFor(rowIdx);setNewCatForm(EMPTY_NEW_CAT);return}
    const cr=categories.find(c=>c.name===value)
    setPending(pending.map((x,j)=>j===rowIdx
      ?{...x,category:value,group:cr?.group||'Expenses',type:cr?.group==='Income'?'income':'expense'}
      :x
    ))
  }

  function saveNewCat(e) {
    e.preventDefault()
    if(!newCatForm.name.trim()) return
    const nc={...newCatForm,name:newCatForm.name.trim(),id:uid()}
    setCategories([...categories,nc])
    if(newCatFor!==null){
      setPending(pending.map((x,j)=>j===newCatFor
        ?{...x,category:nc.name,group:nc.group,type:nc.group==='Income'?'income':'expense'}:x))
    }
    setNewCatFor(null);setNewCatForm(EMPTY_NEW_CAT)
  }

  function doImport() {
    const batchId    = uid()
    const importedAt = today()
    const withMeta   = pending.map(t=>({
      ...t,
      accountId: importAcctId,
      account:   importAcct?.name||t.account,
      importBatch: batchId,
      importedAt,
    }))
    setTransactions([...transactions,...withMeta])
    setLastBatchId(batchId)
    setPending([])
  }

  function undoImport() {
    if(!lastBatchId) return
    setTransactions(transactions.filter(t=>t.importBatch!==lastBatchId))
    setLastBatchId(null)
  }

  const lastBatchCount = lastBatchId
    ? transactions.filter(t=>t.importBatch===lastBatchId).length
    : 0

  return (
    <div>
      <NewCatModal open={newCatFor!==null} form={newCatForm} setForm={setNewCatForm}
        onSave={saveNewCat} onCancel={()=>setNewCatFor(null)} />

      <h2 className="mb-16">Import Bank Statement (CSV)</h2>

      {/* Undo banner */}
      {lastBatchId && lastBatchCount > 0 && (
        <div style={{padding:'10px 16px',background:'#fffbeb',border:'1px solid #fcd34d',borderRadius:'var(--radius)',marginBottom:16,display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:'0.875rem'}}>
          <span>✅ Imported <strong>{lastBatchCount} transactions</strong> — go to <strong>Transactions</strong> tab to review &amp; categorize.</span>
          <button className="btn btn-sm" style={{color:'var(--red)',borderColor:'#fca5a5'}} onClick={undoImport}>
            ↩ Undo import
          </button>
        </div>
      )}

      {/* Step 1 */}
      <div className="card mb-16">
        <div className="card-header"><h3>Step 1 — Choose Account</h3></div>
        <div className="card-body">
          <p style={{fontSize:'0.875rem',color:'var(--text-muted)',marginBottom:12}}>
            Which bank account does this CSV belong to? Linking it lets you track deposits/withdrawals and reconcile your register.
          </p>
          <div className="form-row" style={{maxWidth:480}}>
            <div className="form-group" style={{gridColumn:'span 2'}}>
              <label>Account (optional)</label>
              <select value={importAcctId} onChange={e=>setImportAcctId(e.target.value)}>
                <option value="">— None / Import without account —</option>
                {accounts.map(a=>(
                  <option key={a.id} value={a.id}>{a.name} ({(a.type||'account').replace(/_/g,' ')})</option>
                ))}
              </select>
            </div>
          </div>
          {importAcct&&(
            <div style={{fontSize:'0.82rem',padding:'8px 12px',background:'var(--blue-bg)',border:'1px solid #93c5fd',borderRadius:'var(--radius)',marginTop:8}}>
              ✓ Transactions will be linked to <strong>{importAcct.name}</strong> and visible in its Register.
            </div>
          )}
        </div>
      </div>

      {/* Step 2 */}
      <div className="card">
        <div className="card-header"><h3>Step 2 — Upload CSV</h3></div>
        <div className="card-body">
          <label className="upload-area" htmlFor="csv-upload-fin">
            <input id="csv-upload-fin" type="file" accept=".csv" ref={fileRef} onChange={handleCSV} />
            <div className="text-muted text-sm">Click or drag a bank statement CSV here</div>
            <div className="text-xs text-muted mt-4">Chase, Bank of America, and most bank formats supported · Deposits detected as income, charges as expenses</div>
          </label>

          {pending.length>0&&(
            <div className="mt-16">
              {(() => {
                const customCount  = pending.filter(t=>t._matchSource==='custom').length
                const builtinCount = pending.filter(t=>t._matchSource==='builtin').length
                const historyCount = pending.filter(t=>t._matchSource==='history').length
                const unknownCount = pending.filter(t=>!t._autoCat).length
                return (
                  <div style={{padding:'10px 14px',background:'#eff6ff',border:'1px solid #93c5fd',borderRadius:'var(--radius)',marginBottom:14,fontSize:'0.82rem',display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
                    <span>
                      {importAcct
                        ?<>📂 Ready to import <strong>{pending.length} transactions</strong> into <strong>{importAcct.name}</strong></>
                        :<>📂 <strong>{pending.length} transactions</strong> parsed — review below, then click Import All</>
                      }
                    </span>
                    {customCount>0&&<span style={{fontSize:'0.75rem',background:'#ede9fe',color:'#6d28d9',border:'1px solid #c4b5fd',borderRadius:20,padding:'2px 9px',fontWeight:600}}>⚙️ {customCount} custom rule</span>}
                    {builtinCount>0&&<span style={{fontSize:'0.75rem',background:'#f0fdf4',color:'#166534',border:'1px solid #86efac',borderRadius:20,padding:'2px 9px',fontWeight:600}}>✓ {builtinCount} vendor map</span>}
                    {historyCount>0&&<span style={{fontSize:'0.75rem',background:'#eff6ff',color:'#1e40af',border:'1px solid #93c5fd',borderRadius:20,padding:'2px 9px',fontWeight:600}}>📋 {historyCount} from history</span>}
                    {unknownCount>0&&<span style={{fontSize:'0.75rem',background:'#fef9c3',color:'#854d0e',border:'1px solid #fde047',borderRadius:20,padding:'2px 9px',fontWeight:600}}>❓ {unknownCount} unmatched</span>}
                  </div>
                )
              })()}

              <div className="flex-between mb-10">
                <span className="text-sm bold">{pending.length} rows</span>
                <div className="flex-gap">
                  {aiErr&&<span className="text-xs text-red">{aiErr}</span>}
                  <button className="btn btn-sm" onClick={aiCategorize} disabled={aiLoad}>{aiLoad?'Categorizing…':'✨ AI Categorize'}</button>
                  <button className="btn btn-primary btn-sm" onClick={doImport}>Import All</button>
                  <button className="btn btn-sm btn-danger" onClick={()=>setPending([])}>Clear</button>
                </div>
              </div>

              {/* Group legend */}
              <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:10}}>
                {GROUP_ORDER.map(g=>{const s=GROUP_STYLE[g]||{};return(
                  <span key={g} style={{fontSize:'0.65rem',padding:'2px 8px',borderRadius:20,background:s.bg,color:s.color,border:`1px solid ${s.border||'var(--border)'}`}}>{g}</span>
                )})}
              </div>

              <div className="table-container">
                <table>
                  <thead><tr><th>Date</th><th>Description</th><th className="text-right">Amount</th><th>Category</th><th>B / P</th></tr></thead>
                  <tbody>
                    {pending.map((t,i)=>{
                      const catRec=categories.find(c=>c.name===t.category)
                      const s=GROUP_STYLE[catRec?.group]||{}
                      return(
                        <tr key={t.id} style={{background: t._matchSource==='custom'?'#faf5ff': t._matchSource==='builtin'?'#f0fdf4': t._matchSource==='history'?'#eff6ff': !t._autoCat?'#fefce8':'transparent'}}>
                          <td className="text-sm text-muted" style={{whiteSpace:'nowrap'}}>{formatDate(t.date)}</td>
                          <td style={{maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.description}</td>
                          <td className={`text-right bold ${t.type==='income'?'text-green':'text-red'}`}>
                            {t.type==='income'?'+':'−'}{formatCurrency(t.amount)}
                          </td>
                          <td>
                            <div style={{display:'flex',alignItems:'center',gap:5}}>
                              {catRec&&<span style={{width:8,height:8,borderRadius:'50%',flexShrink:0,background:s.color||'var(--text-muted)',display:'inline-block'}}/>}
                              <GroupedCatSelect value={t.category} categories={categories} onChange={v=>handleCatChange(i,v)} />
                              {t._matchSource==='custom'  &&<span title="Matched by your custom rule"  style={{fontSize:'0.6rem',color:'#6d28d9',background:'#ede9fe',border:'1px solid #c4b5fd',borderRadius:10,padding:'1px 5px',flexShrink:0}}>⚙️ custom</span>}
                              {t._matchSource==='builtin' &&<span title="Matched by built-in vendor map" style={{fontSize:'0.6rem',color:'#166534',background:'#f0fdf4',border:'1px solid #86efac',borderRadius:10,padding:'1px 5px',flexShrink:0}}>✓ vendor</span>}
                              {t._matchSource==='history' &&<span title="Matched from transaction history" style={{fontSize:'0.6rem',color:'#1e40af',background:'#eff6ff',border:'1px solid #93c5fd',borderRadius:10,padding:'1px 5px',flexShrink:0}}>📋 history</span>}
                              {!t._autoCat               &&<span title="No match — please assign a category" style={{fontSize:'0.6rem',color:'#854d0e',background:'#fef9c3',border:'1px solid #fde047',borderRadius:10,padding:'1px 5px',flexShrink:0}}>❓</span>}
                            </div>
                            {catRec&&<div style={{fontSize:'0.62rem',color:s.color||'var(--text-muted)',marginTop:2,marginLeft:13}}>{catRec.group}</div>}
                          </td>
                          <td>
                            <select value={t.spendingType}
                              onChange={e=>setPending(pending.map((x,j)=>j===i?{...x,spendingType:e.target.value}:x))}
                              style={{fontSize:'0.75rem',padding:'2px 4px'}}>
                              <option value="business">Business</option>
                              <option value="personal">Personal</option>
                            </select>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Backup helpers ───────────────────────────────────────────────────────────
function downloadBackup(transactions, accounts, categories) {
  const payload = {
    exportedAt: new Date().toISOString(),
    finance_transactions: transactions,
    finance_accounts:     accounts,
    finance_categories:   categories,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `rlc-finance-backup-${today()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function restoreFromFile(file, setTransactions, setAccounts, setCategories, onDone) {
  const reader = new FileReader()
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result)
      if (data.finance_transactions) setTransactions(data.finance_transactions)
      if (data.finance_accounts)     setAccounts(data.finance_accounts)
      if (data.finance_categories)   setCategories(data.finance_categories)
      onDone(true, `Restored ${(data.finance_transactions||[]).length} transactions, ${(data.finance_accounts||[]).length} accounts.`)
    } catch {
      onDone(false, 'Could not parse backup file — make sure it is an RLC Finance backup JSON.')
    }
  }
  reader.readAsText(file)
}

// ─── Column Resize Hook ───────────────────────────────────────────────────────
function useColResize(storageKey, defaults) {
  const [widths, setWidths] = useState(() => {
    try { const s = localStorage.getItem(storageKey); if (s) return JSON.parse(s) } catch {}
    return defaults
  })
  function startResize(i, e) {
    e.preventDefault()
    const x0 = e.clientX, w0 = widths[i]
    function onMove(ev) {
      const nw = Math.max(30, w0 + ev.clientX - x0)
      setWidths(prev => {
        const next = [...prev]; next[i] = nw
        try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch {}
        return next
      })
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }
  return [widths, startResize]
}

// ─── Pending Review Tab ───────────────────────────────────────────────────────
function PendingReviewTab({ transactions, setTransactions, categories, setCategories }) {
  const [newCatFor,  setNewCatFor]  = useState(null)
  const [newCatForm, setNewCatForm] = useState(EMPTY_NEW_CAT)
  const [colW, startResize] = useColResize('finance_pending_col_widths_v3', [80,88,160,88,145,80,112,100])
  const [descPop, setDescPop] = useState(null) // {id,text,notes,x,y,editing,draftDesc,draftNotes}

  function openDescPop(t, e) {
    if (descPop?.id === t.id) { setDescPop(null); return }
    setDescPop({ id:t.id, text:t.description, notes:t.notes||'', x:e.clientX, y:e.clientY, editing:false, draftDesc:t.description, draftNotes:t.notes||'' })
  }
  function saveDescEdit() {
    setTransactions(transactions.map(t => t.id===descPop.id ? {...t, description:descPop.draftDesc, notes:descPop.draftNotes} : t))
    setDescPop(p => ({...p, text:p.draftDesc, notes:p.draftNotes, editing:false}))
  }

  const pending = transactions
    .filter(t=>t.status==='pending_review')
    .sort((a,b)=>b.date.localeCompare(a.date))

  function confirmOne(id) {
    setTransactions(transactions.map(t=>t.id===id?{...t,status:'cleared'}:t))
  }
  function confirmAll() {
    setTransactions(transactions.map(t=>t.status==='pending_review'?{...t,status:'cleared'}:t))
  }
  function rejectOne(id) {
    if (!window.confirm('Remove this transaction?')) return
    setTransactions(transactions.filter(t=>t.id!==id))
  }
  function handleCatChange(id, value) {
    if (value===NEW_CAT_SENTINEL) { setNewCatFor(id); setNewCatForm(EMPTY_NEW_CAT); return }
    const catRec = categories.find(c=>c.name===value)
    setTransactions(transactions.map(t=>t.id===id
      ? {...t, category:value, group:catRec?.group||'Expenses', type:catRec?.group==='Income'?'income':'expense'}
      : t))
  }
  function setTxnStatus(id, key) {
    setTransactions(transactions.map(t=>t.id===id?{...t,txnStatus:t.txnStatus===key?null:key}:t))
  }
  function saveNewCat(e) {
    e.preventDefault()
    if (!newCatForm.name.trim()) return
    const nc = {...newCatForm, name:newCatForm.name.trim(), id:uid()}
    setCategories([...categories, nc])
    if (newCatFor) handleCatChange(newCatFor, nc.name)
    setNewCatFor(null); setNewCatForm(EMPTY_NEW_CAT)
  }

  const SOURCE_BADGE = {
    custom:  {label:'⚙️ custom',  bg:'#ede9fe',color:'#6d28d9',border:'#c4b5fd'},
    builtin: {label:'✓ vendor',   bg:'#f0fdf4',color:'#166534',border:'#86efac'},
    history: {label:'📋 history', bg:'#eff6ff',color:'#1e40af',border:'#93c5fd'},
  }

  const flagged = pending.filter(t=>t.txnStatus)

  if (pending.length===0) return (
    <div style={{textAlign:'center',padding:'48px 24px',color:'var(--text-muted)'}}>
      <div style={{fontSize:'2rem',marginBottom:12}}>✅</div>
      <div style={{fontWeight:600,marginBottom:6}}>No transactions pending review</div>
      <div style={{fontSize:'0.83rem'}}>Import a CSV — transactions will appear here for review before being posted to the register.</div>
    </div>
  )

  return (
    <div>
      <NewCatModal open={!!newCatFor} form={newCatForm} setForm={setNewCatForm}
        onSave={saveNewCat} onCancel={()=>setNewCatFor(null)} />

      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12,marginBottom:16}}>
        <div>
          <h2 style={{margin:0}}>Pending Review</h2>
          <p style={{fontSize:'0.83rem',color:'var(--text-muted)',margin:'4px 0 0'}}>
            {pending.length} transaction{pending.length!==1?'s':''} waiting — review categories, then confirm to post to the register.
          </p>
        </div>
        <button className="btn btn-primary" onClick={confirmAll}>
          ✅ Confirm All ({pending.length})
        </button>
      </div>

      {/* ── Flagged summary panel ── */}
      {flagged.length>0&&(
        <div className="card mb-20" style={{borderColor:'#fcd34d'}}>
          <div className="card-header" style={{background:'#fffbeb'}}>
            <h3 style={{color:'#b45309'}}>🚩 Flagged Transactions ({flagged.length})</h3>
            <span style={{fontSize:'0.72rem',color:'#92400e'}}>Resolve these before confirming</span>
          </div>
          <div>
            {Object.entries(TXN_STATUS).map(([key,s])=>{
              const group = flagged.filter(t=>t.txnStatus===key)
              if (!group.length) return null
              return (
                <div key={key} style={{borderBottom:'1px solid var(--border-light)'}}>
                  <div style={{padding:'7px 16px',background:s.bg,fontSize:'0.72rem',fontWeight:700,color:s.color,borderBottom:`1px solid ${s.border}`}}>
                    {s.icon} {s.label} — {group.length} item{group.length!==1?'s':''}
                  </div>
                  {group.map(t=>(
                    <div key={t.id} style={{display:'flex',alignItems:'center',gap:12,padding:'8px 16px',borderBottom:'1px solid var(--border-light)'}}>
                      <span style={{fontSize:'0.78rem',color:'var(--text-muted)',whiteSpace:'nowrap'}}>{formatDate(t.date)}</span>
                      <span style={{flex:1,fontSize:'0.82rem',fontWeight:500}}>{t.description}</span>
                      <span style={{fontWeight:700,color:t.type==='income'?'var(--green)':'var(--red)',whiteSpace:'nowrap'}}>
                        {t.type==='income'?'+':'−'}{formatCurrency(t.amount)}
                      </span>
                      <button onClick={()=>setTxnStatus(t.id,key)}
                        style={{background:'none',border:'1px solid var(--border)',cursor:'pointer',fontSize:'0.7rem',color:'var(--text-faint)',padding:'2px 8px',borderRadius:4}}>
                        Clear
                      </button>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {descPop && (
        <>
          <div onClick={()=>setDescPop(null)} style={{position:'fixed',inset:0,zIndex:999}} />
          <div onClick={e=>e.stopPropagation()} style={{
            position:'fixed',
            ...(window.innerWidth <= 768
              ? { top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:'calc(100vw - 32px)', maxWidth:360 }
              : { top: Math.min(descPop.y+10, window.innerHeight-260), left: Math.min(descPop.x, window.innerWidth-340), width:320 }
            ),
            zIndex:1000, background:'var(--bg)',
            border:'1px solid var(--border)',
            borderRadius:'var(--radius-lg)',
            boxShadow:'0 8px 24px rgba(45,27,37,0.14)',
            padding:'16px',
          }}>
            {/* Header */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
              <span style={{fontSize:'0.65rem',fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.07em'}}>Transaction Detail</span>
              <button onClick={()=>setDescPop(null)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-faint)',fontSize:'1rem',lineHeight:1,padding:0}}>✕</button>
            </div>

            {descPop.editing ? (
              /* ── Edit mode ── */
              <>
                <label style={{fontSize:'0.72rem',fontWeight:600,color:'var(--text-muted)',display:'block',marginBottom:4}}>Description</label>
                <textarea
                  autoFocus
                  rows={3}
                  value={descPop.draftDesc}
                  onChange={e=>setDescPop(p=>({...p,draftDesc:e.target.value}))}
                  style={{width:'100%',boxSizing:'border-box',fontSize:'0.84rem',padding:'8px 10px',borderRadius:'var(--radius)',border:'1.5px solid var(--pink)',outline:'none',resize:'vertical',fontFamily:'inherit',lineHeight:1.5}}
                />
                <label style={{fontSize:'0.72rem',fontWeight:600,color:'var(--text-muted)',display:'block',margin:'10px 0 4px'}}>Notes</label>
                <textarea
                  rows={3}
                  value={descPop.draftNotes}
                  onChange={e=>setDescPop(p=>({...p,draftNotes:e.target.value}))}
                  placeholder="Add a note about this transaction..."
                  style={{width:'100%',boxSizing:'border-box',fontSize:'0.84rem',padding:'8px 10px',borderRadius:'var(--radius)',border:'1.5px solid var(--border)',outline:'none',resize:'vertical',fontFamily:'inherit',lineHeight:1.5}}
                />
                <div style={{display:'flex',gap:8,marginTop:12}}>
                  <button className="btn btn-primary btn-sm" style={{flex:1}} onClick={saveDescEdit}>💾 Save</button>
                  <button className="btn btn-sm" onClick={()=>setDescPop(p=>({...p,editing:false,draftDesc:p.text,draftNotes:p.notes}))}>Cancel</button>
                </div>
              </>
            ) : (
              /* ── View mode ── */
              <>
                <label style={{fontSize:'0.72rem',fontWeight:600,color:'var(--text-muted)',display:'block',marginBottom:4}}>Description</label>
                <div style={{fontSize:'0.875rem',color:'var(--text)',lineHeight:1.5,wordBreak:'break-word',marginBottom:10}}>{descPop.text}</div>
                {descPop.notes && (
                  <>
                    <label style={{fontSize:'0.72rem',fontWeight:600,color:'var(--text-muted)',display:'block',marginBottom:4}}>Notes</label>
                    <div style={{fontSize:'0.84rem',color:'var(--text)',lineHeight:1.5,wordBreak:'break-word',background:'var(--surface)',borderRadius:'var(--radius)',padding:'8px 10px',borderLeft:'3px solid var(--pink-soft)'}}>{descPop.notes}</div>
                  </>
                )}
                <button className="btn btn-sm" style={{marginTop:12,width:'100%'}} onClick={()=>setDescPop(p=>({...p,editing:true}))}>
                  ✏️ Edit Description {descPop.notes?'/ Notes':'& Add Notes'}
                </button>
              </>
            )}
          </div>
        </>
      )}

      <div className="table-container">
        <table style={{tableLayout:'fixed',width:'100%',minWidth:colW.reduce((a,b)=>a+b,0)}}>
          <colgroup>{colW.map((w,i)=><col key={i} style={{width:w}}/>)}</colgroup>
          <thead>
            <tr>
              {['Flags','Date','Description','Amount','Category','Match','B / P','Actions'].map((h,i)=>(
                <th key={h}
                  className={[h==='Amount'?'text-right':'', h==='Actions'?'sticky-right':''].join(' ').trim()}
                  style={{position:'relative'}}>
                  {h}
                  {h!=='Actions' && <span className="col-resize-handle" onMouseDown={e=>startResize(i,e)}/>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pending.map(t=>{
              const catRec   = categories.find(c=>c.name===t.category)
              const s        = GROUP_STYLE[catRec?.group]||{}
              const src      = SOURCE_BADGE[t._matchSource]
              const flagStyle = t.txnStatus ? TXN_STATUS[t.txnStatus] : null
              return (
                <tr key={t.id} style={{
                  background: flagStyle ? flagStyle.bg : !t._autoCat ? '#fefce8' : 'transparent'
                }}>
                  <td>
                    <div style={{display:'flex',gap:3}}>
                      {Object.entries(TXN_STATUS).map(([key,fs])=>(
                        <button key={key} title={fs.label} onClick={()=>setTxnStatus(t.id,key)}
                          style={{padding:'3px 6px',borderRadius:4,cursor:'pointer',fontSize:'0.8rem',lineHeight:1,
                            background:t.txnStatus===key?fs.bg:'transparent',
                            border:`1px solid ${t.txnStatus===key?fs.border:'var(--border)'}`,
                            color:t.txnStatus===key?fs.color:'var(--text-faint)'}}>
                          {fs.icon}
                        </button>
                      ))}
                    </div>
                    {flagStyle&&<div style={{fontSize:'0.62rem',color:flagStyle.color,marginTop:3,fontWeight:600}}>{flagStyle.label}</div>}
                  </td>
                  <td className="text-sm text-muted" style={{whiteSpace:'nowrap'}}>{formatDate(t.date)}</td>
                  <td style={{overflow:'hidden',cursor:'pointer'}} onClick={e=>openDescPop(t,e)}>
                    <div style={{display:'flex',alignItems:'center',gap:4}}>
                      <div style={{fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{t.description}</div>
                      {t.notes && <span title={t.notes} style={{fontSize:'0.7rem',flexShrink:0}}>📝</span>}
                    </div>
                    {catRec&&<div style={{fontSize:'0.65rem',color:s.color||'var(--text-muted)',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{catRec.group}</div>}
                  </td>
                  <td className={`text-right bold ${t.type==='income'?'text-green':'text-red'}`}>
                    {t.type==='income'?'+':'−'}{formatCurrency(t.amount)}
                  </td>
                  <td>
                    <div style={{display:'flex',alignItems:'center',gap:5}}>
                      {catRec&&<span style={{width:8,height:8,borderRadius:'50%',flexShrink:0,background:s.color||'var(--text-muted)',display:'inline-block'}}/>}
                      <GroupedCatSelect value={t.category} categories={categories} onChange={v=>handleCatChange(t.id,v)} />
                    </div>
                  </td>
                  <td>
                    {src
                      ? <span style={{fontSize:'0.65rem',background:src.bg,color:src.color,border:`1px solid ${src.border}`,borderRadius:10,padding:'1px 6px',whiteSpace:'nowrap'}}>{src.label}</span>
                      : <span style={{fontSize:'0.65rem',background:'#fef9c3',color:'#854d0e',border:'1px solid #fde047',borderRadius:10,padding:'1px 6px'}}>❓ unmatched</span>
                    }
                  </td>
                  <td>
                    <select value={t.spendingType||'business'}
                      onChange={e=>setTransactions(transactions.map(x=>x.id===t.id?{...x,spendingType:e.target.value}:x))}
                      style={{fontSize:'0.72rem',padding:'3px 4px',borderRadius:'var(--radius)',border:'1px solid var(--border)',background:'var(--bg)',color:'var(--text)',width:'100%'}}>
                      <option value="business">💼 Business</option>
                      <option value="personal">🏠 Personal</option>
                    </select>
                  </td>
                  <td className="sticky-right">
                    <div style={{display:'flex',gap:5}}>
                      <button className="btn btn-sm btn-primary" title="Confirm — post to register" style={{fontSize:'0.7rem',padding:'3px 8px'}}
                        onClick={()=>confirmOne(t.id)}>✅ OK</button>
                      <button className="btn btn-sm btn-danger" title="Remove transaction" style={{fontSize:'0.7rem',padding:'3px 7px'}}
                        onClick={()=>rejectOne(t.id)}>✕</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Vendor Rules Tab ─────────────────────────────────────────────────────────
function VendorRulesTab({ categories }) {
  const [rules, setRules] = useLocalStorage('finance_vendor_rules', [])
  const [contains, setContains] = useState('')
  const [ruleCat,  setRuleCat]  = useState('')
  const [showBuiltin, setShowBuiltin] = useState(false)

  function addRule() {
    const kw = contains.trim()
    if (!kw || !ruleCat) return
    setRules([...rules, { id: uid(), contains: kw, category: ruleCat, enabled: true }])
    setContains('')
    setRuleCat('')
  }

  function deleteRule(id) { setRules(rules.filter(r => r.id !== id)) }
  function toggleRule(id) { setRules(rules.map(r => r.id===id ? {...r, enabled:!r.enabled} : r)) }

  return (
    <div>
      <h2 style={{marginBottom:6}}>Vendor Rules</h2>
      <p style={{fontSize:'0.83rem',color:'var(--text-muted)',marginBottom:20}}>
        When importing CSV bank statements, the system matches each transaction description using these 4 tiers — first match wins.
      </p>

      {/* Priority legend */}
      <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:22}}>
        {[
          {label:'1. Custom Rules',    bg:'#ede9fe',color:'#6d28d9',border:'#c4b5fd',desc:'Your rules below — highest priority'},
          {label:'2. Built-in Map',    bg:'#f0fdf4',color:'#166534',border:'#86efac',desc:'Pre-loaded merchant library'},
          {label:'3. Transaction History',bg:'#eff6ff',color:'#1e40af',border:'#93c5fd',desc:'Previously categorized transactions'},
          {label:'4. Unknown ❓',      bg:'#fef9c3',color:'#854d0e',border:'#fde047',desc:'No match — flagged for manual review'},
        ].map(t=>(
          <div key={t.label} style={{flex:'1 1 180px',background:t.bg,border:`1px solid ${t.border}`,borderRadius:'var(--radius)',padding:'8px 12px'}}>
            <div style={{fontWeight:700,fontSize:'0.8rem',color:t.color}}>{t.label}</div>
            <div style={{fontSize:'0.73rem',color:t.color,opacity:0.85,marginTop:2}}>{t.desc}</div>
          </div>
        ))}
      </div>

      {/* Add custom rule */}
      <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:16,marginBottom:20}}>
        <h3 style={{margin:'0 0 12px',fontSize:'0.9rem'}}>Add Custom Rule</h3>
        <div style={{display:'flex',flexWrap:'wrap',gap:10,alignItems:'flex-end'}}>
          <div style={{flex:'1 1 200px'}}>
            <label style={{fontSize:'0.78rem',color:'var(--text-muted)',display:'block',marginBottom:4}}>Description contains…</label>
            <input value={contains} onChange={e=>setContains(e.target.value)}
              placeholder="e.g. CHEVRON, STARBUCKS…"
              style={{width:'100%',padding:'6px 10px',borderRadius:'var(--radius)',border:'1px solid var(--border)',fontSize:'0.85rem',background:'var(--bg)',color:'var(--text)'}}
              onKeyDown={e=>e.key==='Enter'&&addRule()}
            />
          </div>
          <div style={{flex:'1 1 200px'}}>
            <label style={{fontSize:'0.78rem',color:'var(--text-muted)',display:'block',marginBottom:4}}>Assign to category</label>
            <GroupedCatSelect value={ruleCat} categories={categories} onChange={setRuleCat} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={addRule} disabled={!contains.trim()||!ruleCat}>+ Add Rule</button>
        </div>
      </div>

      {/* Custom rules list */}
      {rules.length===0
        ? <p style={{fontSize:'0.83rem',color:'var(--text-muted)'}}>No custom rules yet. Add one above — they take priority over everything else.</p>
        : (
          <div className="table-container" style={{marginBottom:24}}>
            <table>
              <thead><tr><th>On/Off</th><th>Description Contains</th><th>Category</th><th></th></tr></thead>
              <tbody>
                {rules.map(r=>(
                  <tr key={r.id} style={{opacity:r.enabled===false?0.45:1}}>
                    <td>
                      <input type="checkbox" checked={r.enabled!==false} onChange={()=>toggleRule(r.id)} />
                    </td>
                    <td style={{fontFamily:'monospace',fontSize:'0.85rem'}}>{r.contains}</td>
                    <td>{r.category}</td>
                    <td>
                      <button className="btn btn-sm btn-danger" onClick={()=>deleteRule(r.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }

      {/* Built-in map viewer */}
      <div style={{marginTop:20}}>
        <button className="btn btn-sm" style={{marginBottom:10}} onClick={()=>setShowBuiltin(v=>!v)}>
          {showBuiltin ? '▲ Hide' : '▼ View'} built-in vendor map ({BUILTIN_VENDOR_MAP.length} entries)
        </button>
        {showBuiltin&&(
          <div className="table-container">
            <table>
              <thead><tr><th>Keywords</th><th>Category</th></tr></thead>
              <tbody>
                {BUILTIN_VENDOR_MAP.map((entry,i)=>(
                  <tr key={i}>
                    <td style={{fontSize:'0.75rem',color:'var(--text-muted)'}}>{entry.kw.join(', ')}</td>
                    <td style={{fontSize:'0.8rem',fontWeight:600}}>{entry.category}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Finance Page ─────────────────────────────────────────────────────────────
export default function Finance() {
  const [transactions, setTransactions] = useLocalStorage('finance_transactions', [])
  const [accounts,     setAccounts]     = useLocalStorage('finance_accounts',     DEFAULT_ACCOUNTS)
  const [categories,   setCategories]   = useLocalStorage('finance_categories',   DEFAULT_CATEGORIES)
  const [tab,          setTab]          = useState('overview')
  const [restoreMsg,   setRestoreMsg]   = useState(null)
  const restoreRef = useRef()

  const pendingCount = transactions.filter(t=>t.status==='pending_review').length

  const TABS = [
    {id:'overview',      label:'Overview'      },
    {id:'pending',       label:'Pending Review', count: pendingCount },
    {id:'transactions',  label:'Transactions'  },
    {id:'income',        label:'Income'        },
    {id:'expenses',      label:'Expenses'      },
    {id:'accounts',      label:'Accounts'      },
    {id:'categories',    label:'Categories'    },
    {id:'tax',           label:'Tax'           },
    {id:'import',        label:'Import CSV'    },
    {id:'vendor',        label:'Vendor Rules'  },
  ]

  return (
    <div>
      <div className="page-header" style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
        <div>
          <h1>Finance</h1>
          <p>Income, expenses, accounts &amp; tax — business &amp; personal</p>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexShrink:0}}>
          {restoreMsg && (
            <span style={{fontSize:'0.78rem',color:restoreMsg.ok?'var(--green)':'var(--red)',background:restoreMsg.ok?'var(--green-bg)':'var(--red-bg)',border:`1px solid ${restoreMsg.ok?'#86efac':'#fca5a5'}`,borderRadius:'var(--radius)',padding:'4px 10px'}}>
              {restoreMsg.msg}
            </span>
          )}
          {/* hidden file input for restore */}
          <input ref={restoreRef} type="file" accept=".json" style={{display:'none'}}
            onChange={e=>{
              const f=e.target.files?.[0]; if(!f) return
              restoreFromFile(f, setTransactions, setAccounts, setCategories, (ok, msg)=>{
                setRestoreMsg({ok, msg})
                setTimeout(()=>setRestoreMsg(null), 6000)
              })
              e.target.value=''
            }} />
          <button className="btn btn-sm" style={{fontSize:'0.78rem'}}
            onClick={()=>restoreRef.current?.click()}>
            📂 Restore Backup
          </button>
          <button className="btn btn-sm btn-primary" style={{fontSize:'0.78rem'}}
            onClick={()=>downloadBackup(transactions, accounts, categories)}>
            💾 Save Backup
          </button>
        </div>
      </div>
      <div className="tabs">{TABS.map(t=>(
        <button key={t.id} className={`tab ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}
          style={{position:'relative'}}>
          {t.label}
          {t.count>0&&<span style={{marginLeft:5,background:'var(--red)',color:'#fff',borderRadius:99,fontSize:'0.65rem',fontWeight:700,padding:'1px 6px',verticalAlign:'middle'}}>{t.count}</span>}
        </button>
      ))}</div>
      {tab==='overview'     && <Overview      transactions={transactions} categories={categories} accounts={accounts} />}
      {tab==='pending'      && <PendingReviewTab transactions={transactions} setTransactions={setTransactions} categories={categories} setCategories={setCategories} />}
      {tab==='transactions' && <TransactionsTab transactions={transactions} setTransactions={setTransactions} categories={categories} setCategories={setCategories} accounts={accounts} />}
      {tab==='income'       && <IncomeTab  transactions={transactions} setTransactions={setTransactions} categories={categories} accounts={accounts} />}
      {tab==='expenses'     && <ExpensesTab transactions={transactions} setTransactions={setTransactions} categories={categories} accounts={accounts} />}
      {tab==='accounts'     && <AccountsTab accounts={accounts} setAccounts={setAccounts} transactions={transactions} setTransactions={setTransactions} categories={categories} />}
      {tab==='categories'   && <CategoriesTab categories={categories} setCategories={setCategories} />}
      {tab==='tax'          && <TaxTab transactions={transactions} />}
      {tab==='import'       && <ImportTab transactions={transactions} setTransactions={setTransactions} categories={categories} setCategories={setCategories} accounts={accounts} />}
      {tab==='vendor'       && <VendorRulesTab categories={categories} />}
    </div>
  )
}
