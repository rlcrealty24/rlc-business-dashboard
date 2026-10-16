// Shared by the Finance page and the statement importer (scripts/finance-import.mjs).
import { uid } from '../utils/formatters.js'
// ─── Built-in Vendor → Category Map ──────────────────────────────────────────
export const BUILTIN_VENDOR_MAP = [
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
export function matchVendor(description, customRules, payeeRules, categories) {
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

export const DEFAULT_CATEGORIES = [
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
