const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = process.env.USER_DATA_PATH || __dirname;
const db = new Database(path.join(DATA_DIR, 'ledger.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    tier TEXT NOT NULL DEFAULT 'free',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS course_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    course_id TEXT NOT NULL,
    course_name TEXT NOT NULL,
    instructor_name TEXT NOT NULL DEFAULT 'Staff',
    semester TEXT NOT NULL DEFAULT 'Spring 2026',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    course_code TEXT NOT NULL REFERENCES course_codes(code),
    enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, course_code)
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    assignment_id TEXT NOT NULL,
    course_code TEXT NOT NULL REFERENCES course_codes(code),
    notes TEXT DEFAULT '',
    submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, assignment_id, course_code)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL DEFAULT 'info',
    title TEXT NOT NULL,
    body TEXT DEFAULT '',
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Seed admin account
const adminHash = bcrypt.hashSync('Basis2026!', 8);
db.prepare(`
  INSERT OR IGNORE INTO users (email, password_hash, name, role, tier)
  VALUES ('connoraltonmigliore@gmail.com', ?, 'Connor', 'admin', 'premium')
`).run(adminHash);

// Seed default course codes
db.prepare(`
  INSERT OR IGNORE INTO course_codes (code, course_id, course_name, instructor_name, semester)
  VALUES ('B-TERRY-26', 'fina3000', 'Personal Finance', 'Prof. Thomas', 'Spring 2026')
`).run();
db.prepare(`
  INSERT OR IGNORE INTO course_codes (code, course_id, course_name, instructor_name, semester)
  VALUES ('B-INV-26', 'fina4200', 'Investment Analysis', 'Prof. Thomas', 'Spring 2026')
`).run();
db.prepare(`UPDATE course_codes SET instructor_name = 'Prof. Thomas' WHERE code = 'B-INV-26'`).run();

// Migrate: add grade/feedback to submissions if not already present
try { db.exec('ALTER TABLE submissions ADD COLUMN grade INTEGER'); } catch {}
try { db.exec("ALTER TABLE submissions ADD COLUMN feedback TEXT DEFAULT ''"); } catch {}

// roles: 'admin' | 'professor' | 'student' | 'user'
// tiers: 'free' | 'premium'
// professors and admins are always premium; students get discounted premium

// ── Demo seed data (professor hub preview) ────────────────────────────────
const demoHash = bcrypt.hashSync('Demo2026!', 8);

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().replace('T', ' ').slice(0, 19);
};

// 24-student roster for B-TERRY-26 (Personal Finance, Spring 2026)
const DEMO_STUDENTS = [
  { email: 'emma.thompson@uga.edu',     name: 'Emma Thompson'     },
  { email: 'marcus.chen@uga.edu',       name: 'Marcus Chen'       },
  { email: 'sofia.rodriguez@uga.edu',   name: 'Sofia Rodriguez'   },
  { email: 'aiden.brooks@uga.edu',      name: 'Aiden Brooks'      },
  { email: 'tyler.johnson@uga.edu',     name: 'Tyler Johnson'     },
  { email: 'priya.patel@uga.edu',       name: 'Priya Patel'       },
  { email: 'noah.williams@uga.edu',     name: 'Noah Williams'     },
  { email: 'isabella.martinez@uga.edu', name: 'Isabella Martinez' },
  { email: 'ethan.kim@uga.edu',         name: 'Ethan Kim'         },
  { email: 'olivia.brown@uga.edu',      name: 'Olivia Brown'      },
  { email: 'liam.davis@uga.edu',        name: 'Liam Davis'        },
  { email: 'ava.wilson@uga.edu',        name: 'Ava Wilson'        },
  { email: 'jaylen.carter@uga.edu',     name: 'Jaylen Carter'     },
  { email: 'chloe.anderson@uga.edu',    name: 'Chloe Anderson'    },
  { email: 'ryan.nguyen@uga.edu',       name: 'Ryan Nguyen'       },
  { email: 'mia.jackson@uga.edu',       name: 'Mia Jackson'       },
  { email: 'dylan.lee@uga.edu',         name: 'Dylan Lee'         },
  { email: 'grace.taylor@uga.edu',      name: 'Grace Taylor'      },
  { email: 'caleb.thomas@uga.edu',      name: 'Caleb Thomas'      },
  { email: 'hannah.moore@uga.edu',      name: 'Hannah Moore'      },
  { email: 'zoe.harris@uga.edu',        name: 'Zoe Harris'        },
  { email: 'brandon.clark@uga.edu',     name: 'Brandon Clark'     },
  { email: 'natalie.lewis@uga.edu',     name: 'Natalie Lewis'     },
  { email: 'kevin.robinson@uga.edu',    name: 'Kevin Robinson'    },
];

DEMO_STUDENTS.forEach(s => {
  db.prepare(`INSERT OR IGNORE INTO users (email, password_hash, name, role, tier) VALUES (?, ?, ?, 'student', 'free')`).run(s.email, demoHash, s.name);
  const u = db.prepare('SELECT id FROM users WHERE email = ?').get(s.email);
  db.prepare(`INSERT OR IGNORE INTO enrollments (user_id, course_code) VALUES (?, 'B-TERRY-26')`).run(u.id);
});

// Full submission dataset: a1-a4 all 24 students graded; a5 17 submitted/8 graded; a6 9 submitted/2 graded
// INSERT OR REPLACE so grades/feedback refresh on restart without losing professor edits permanently
const DEMO_SUBMISSIONS = [
  // ── a1: Social Capital (50 pts, completed) ─────────────────────────────
  { email:'emma.thompson@uga.edu',     id:'a1', d:79, g:47, fb:'Excellent analysis. The salary-premium argument is compelling — needs a citation.',
    n:'Social capital refers to networks and relationships that generate economic value. The budget student allocates $0 toward professional networking. I recommend redirecting 5% of the $450 discretionary budget (~$22/mo) to professional development — UGA career events, LinkedIn Premium, etc. Over 4 years this yields a 15-20% salary premium at graduation.' },
  { email:'marcus.chen@uga.edu',       id:'a1', d:72, g:44, fb:'Good insight on converting discretionary spending. Cover low-cost digital options (LinkedIn, GitHub) for budget-constrained students.',
    n:'Social capital = the value of social networks. The student spends $267/mo eating out. Redirecting 20% (~$53/mo) toward networking events converts a consumption expense into social capital investment. The $124 deficit means any reallocation requires cuts elsewhere first.' },
  { email:'sofia.rodriguez@uga.edu',   id:'a1', d:74, g:42, fb:'Creative angle on meal-prep as social capital. Tie the argument more explicitly to the Ch. 2 framework.',
    n:"Social capital is the economic value embedded in social relationships. The student could reduce dining costs by meal prepping with classmates — combining social capital building with $50-80/month savings. The 43% credit utilization signals that strategies need to work within constrained finances." },
  { email:'aiden.brooks@uga.edu',      id:'a1', d:71, g:34, fb:'You identify the opportunity but the budget analysis is thin — reference specific dollar amounts from the dataset.',
    n:'Social capital creates career opportunities through professional connections. The student spends significant income on dining and entertainment. Redirecting some discretionary spending to networking events or professional clubs would build valuable relationships. The monthly deficit is the main constraint on any reallocation.' },
  { email:'tyler.johnson@uga.edu',     id:'a1', d:78, g:43, fb:'Solid. The opportunity-cost framing is effective — expand on the compounding nature of professional networks.',
    n:"The budget student spends $0 on professional development despite having $450 in discretionary spending. Redirecting $40/mo to LinkedIn Premium, professional events, or mentoring programs creates compounding career value. The $124 deficit limits cash investment, but UGA's career center (free) should be maximized first." },
  { email:'priya.patel@uga.edu',       id:'a1', d:80, g:48, fb:'Outstanding. The ROI calculation on networking investment is exactly the quantitative rigor this assignment calls for.',
    n:'Social capital is the advantage conferred by embeddedness in social networks. The budget student allocates $0 to professional development. My quantitative estimate: $50/mo over 4 years = $2,400, with an expected salary premium of 10-15% ($4,500-6,750/yr at a $45k starting salary). ROI = 187-280% in year one alone. Zero-cost networking (alumni LinkedIn outreach, office hours) yields returns even before the deficit is closed.' },
  { email:'noah.williams@uga.edu',     id:'a1', d:75, g:38, fb:'The connection to the dataset is weak. Reference specific numbers — the $267 dining figure, the $124 deficit — rather than staying abstract.',
    n:'Social capital is about relationships that have economic value. The budget dataset shows significant spending on food and entertainment. Some discretionary spending could be redirected to networking. The student should join professional clubs and attend career fairs to build their network before graduation.' },
  { email:'isabella.martinez@uga.edu', id:'a1', d:77, g:45, fb:"Very good. The three-tier social capital framework (bonding/bridging/linking) adds genuine insight. Connect bridging capital back to specific budget line items.",
    n:"Applying Putnam's framework: the student invests nothing in bridging capital (professional networks across groups) or linking capital (connections to institutions). The $267 dining budget could be partly restructured into networking dinners. The 43% credit utilization makes building financial social capital (mentors, advisors) especially important." },
  { email:'ethan.kim@uga.edu',         id:'a1', d:73, g:36, fb:'The core idea is present but needs more specifics. How much should be reallocated, and to what specifically?',
    n:'Social capital is the value of social networks for economic outcomes. The budget student has discretionary spending that could be redirected to professional development. Building relationships through networking and professional organizations leads to better career opportunities. I recommend attending two events per month and connecting with professionals in the desired field.' },
  { email:'olivia.brown@uga.edu',      id:'a1', d:76, g:41, fb:'Good work connecting the budget deficit to social capital constraints. The phased approach (free first, then paid) shows financial awareness.',
    n:'The budget dataset shows a student in a $124/month deficit with 43% credit utilization — they cannot afford new financial commitments without trade-offs. Social capital building must start free: professor relationships, LinkedIn, campus clubs. Once the deficit closes (cut dining $80/mo), redirect $40/mo to paid professional development.' },
  { email:'liam.davis@uga.edu',        id:'a1', d:68, g:28, fb:'Needs more specific analysis. Use the actual numbers from the dataset.',
    n:'Social capital means having good connections that can help your career. College is a great time to build connections through clubs and networking events. The budget student could find ways to save money and invest in professional development activities.' },
  { email:'ava.wilson@uga.edu',        id:'a1', d:79, g:49, fb:'Exceptional. The expected-value model across network tiers is graduate-level thinking for an undergrad assignment.',
    n:'Social capital can be analyzed using expected value: each professional connection has a probability distribution of payoffs. The budget student spends $0 on this asset class. My EV model: $50/mo networking, 40% probability of one job referral/yr adding $3,000-8,000 to starting salary → EV = $1,200-3,200/yr vs $600/yr cost. Sharpe-style ratio = 2.0-5.3. Reallocating $25-30/mo from dining is warranted even given the deficit.' },
  { email:'jaylen.carter@uga.edu',     id:'a1', d:72, g:39, fb:'Solid connection between social capital and career outcomes. The free vs. paid networking distinction shows practical thinking.',
    n:'Social capital theory argues economic outcomes are shaped by relationship networks. Given the $124 deficit, I recommend starting with zero-cost options: UGA career fairs, one professional organization at student rates (~$25/yr), and active LinkedIn use. These build valuable connections without worsening the budget.' },
  { email:'chloe.anderson@uga.edu',    id:'a1', d:74, g:43, fb:'Good use of the dataset. The consumptive vs. investment spending distinction is clearly drawn.',
    n:'The budget shows $267/mo in dining — purely consumptive spending. Converting 15% ($40/mo) to networking dinners creates social capital with no net lifestyle sacrifice. Even $480/yr in professional development generates career payoffs that far exceed the opportunity cost of foregone restaurant meals.' },
  { email:'ryan.nguyen@uga.edu',       id:'a1', d:80, g:46, fb:'Strong submission. The human capital vs. social capital distinction is well-articulated. Minor: salary premium estimate needs a citation.',
    n:"Human capital (skills, education) and social capital (networks) are complementary assets. The budget student invests in human capital but zero in social capital. UGA alumni surveys suggest active networkers earn 12-17% more at graduation. On a $45k salary that's $5,400-7,650/yr. Optimal reallocation: $35 from dining + $15 from entertainment = $50/mo toward professional development." },
  { email:'mia.jackson@uga.edu',       id:'a1', d:73, g:37, fb:'Touches the right concepts but stays surface-level. Be specific about which budget lines should be reallocated and by how much.',
    n:'Social capital represents the value of professional connections. The budget student could benefit from investing in their network. Networking events, professional organizations, and informational interviews help build social capital. Given the tight budget, the student should prioritize free and low-cost opportunities.' },
  { email:'dylan.lee@uga.edu',         id:'a1', d:77, g:42, fb:'Good analysis. Converting dining into networking dinners is exactly the kind of creative reframing the assignment is looking for.',
    n:'Key insight: some existing expenditures can be reframed as social capital investments at no net budget impact. The $267 dining budget includes meals that could be networking dinners — same cost, higher ROI. Study groups and professor office hours build social capital for free. Only after eliminating the $124 deficit should new spending be added.' },
  { email:'grace.taylor@uga.edu',      id:'a1', d:70, g:33, fb:'The concept is understood but the quantitative analysis is missing. What specific dollar amounts are involved?',
    n:'Social capital is about networks and relationships that create economic value. College students should invest in their networks by joining clubs and attending events. The budget student has limited funds due to the monthly deficit but could find free ways to build social capital. Strong relationships during college often lead to better career outcomes.' },
  { email:'caleb.thomas@uga.edu',      id:'a1', d:78, g:44, fb:"Very good. The ROI analysis relative to the student's financial constraints is well-reasoned.",
    n:'Social capital investments must be evaluated against competing uses of constrained resources. The budget student has $450 discretionary spending with a $124 deficit — meaning some consumption is debt-financed. I recommend cutting dining $70 + entertainment $30 = $100 surplus, then redirect $50 to professional development and $50 to close the deficit.' },
  { email:'hannah.moore@uga.edu',      id:'a1', d:69, g:32, fb:'The assignment requires engagement with specific dataset numbers. Generic statements about networking do not demonstrate the analytical framework.',
    n:'Social capital is the value of professional relationships and networks. College students should build these connections early. The most important steps are a good LinkedIn profile, career fairs, and professor relationships. The student in the dataset should focus on free options given the monthly deficit.' },
  { email:'zoe.harris@uga.edu',        id:'a1', d:75, g:40, fb:'Solid application of the Ch. 2 framework. The ROI comparison across income levels adds depth.',
    n:'Social capital has different ROI profiles by wealth level. For a student in a $124 deficit, free networking (campus clubs, professor relationships, LinkedIn) has infinite ROI. Once stable, investing $50-100/mo in professional development yields strong returns. The 43% credit utilization makes financial social capital (mentors, advisors) especially valuable.' },
  { email:'brandon.clark@uga.edu',     id:'a1', d:76, g:43, fb:'Good analysis. The focus on free resources shows financial awareness. Add a section on how to measure social capital returns.',
    n:'The budget student has limited resources (43% utilization, $124 deficit) constraining monetary investment in social capital. Priority: (1) max UGA career resources (free), (2) join one student professional organization ($25-50/yr), (3) use LinkedIn actively. Once the deficit closes, allocate $50/mo to premium networking. Total cost under $600/yr, expected lifetime earnings increase: $150,000+.' },
  { email:'natalie.lewis@uga.edu',     id:'a1', d:80, g:47, fb:'Excellent. The systematic comparison of social capital options with projected ROI is exactly the analytical framework this assignment is designed to develop.',
    n:'Social capital generates returns through: information access (job leads), influence (referrals), and solidarity (support networks). The budget student invests $0 in all three. Recommendation: (1) information — LinkedIn + alumni network ($0-15/mo), (2) influence — two campus orgs (~$40/yr), (3) solidarity — study groups ($0). Total: $220/yr. Expected return at graduation: $3,000-8,000 salary premium. Payback period: under one month of incremental salary.' },
  { email:'kevin.robinson@uga.edu',    id:'a1', d:72, g:38, fb:"You understand the concept but need deeper engagement with the dataset. Connect social capital investment to specific budget figures.",
    n:'Social capital is the economic value derived from professional relationships. For the budget student, the challenge is building social capital on a tight budget. Free resources like campus clubs and career services are the starting point. Once the $124 deficit is eliminated, money can be directed toward professional development activities.' },

  // ── a2: TVM (100 pts, completed) ──────────────────────────────────────
  { email:'emma.thompson@uga.edu',     id:'a2', d:72, g:93, fb:'Near-perfect. Show the annuity formula explicitly in Scenario 2 before substituting numbers.',
    n:'S1: FV = 1000×(1.06)^10 = $1,790.85. Rule of 72: 12 years. S2: PMT=$200/mo, r=7%/12, n=240 → FV=$104,185. S3: budget expenses $1,924/mo; emergency fund target $1,924×4 = $7,696 (4-month conservative given the $124 deficit).' },
  { email:'marcus.chen@uga.edu',       id:'a2', d:65, g:78, fb:'Solid work. The deficit prerequisite for the emergency fund is the right instinct — develop it further.',
    n:'TVM S1: $1,790.85. S2: PMT=200, r=0.5833%/mo, n=240 → FV=$104,185. Emergency fund: 3×$1,924 = $5,772 minimum. The $124 deficit means the student must close the gap before funding any reserve.' },
  { email:'sofia.rodriguez@uga.edu',   id:'a2', d:63, g:71, fb:'Calculations correct. Be precise — reference the dataset spending figure explicitly for S3.',
    n:'A = P(1+r)^t. S1: $1,790.85. Rule of 72: 12 yr. S2: annuity FV = $200×[(1.00583)^240-1]/0.00583 = $104,185. S3: 3-6 months × $1,924 = $5,772 to $11,544.' },
  { email:'aiden.brooks@uga.edu',      id:'a2', d:67, g:62, fb:'Calculations present but show your work more clearly, especially the annuity derivation.',
    n:'S1: $1,790.85. Rule of 72: 12 yr. S2: $200/mo at 7%/yr for 20 years ≈ $104,185. S3: emergency fund = 3 months × $1,924 = $5,772.' },
  { email:'tyler.johnson@uga.edu',     id:'a2', d:71, g:82, fb:'Very good. The 3-month vs 6-month sensitivity analysis given the budget deficit is a nice addition.',
    n:'S1: FV=$1,790.85. R72=12yr. S2: PMT=200, n=240, i=7%/12 → $104,185. S3: range $5,772 (3mo) to $11,544 (6mo). Given the $124 deficit I recommend 4-month ($7,696) as a realistic intermediate target.' },
  { email:'priya.patel@uga.edu',       id:'a2', d:74, g:91, fb:'Excellent. The sensitivity analysis across different return assumptions adds professional rigor.',
    n:'S1: $1,790.85. R72=12yr. Sensitivity: at 8% FV=$2,158.93 — 21% gain for 33% rate increase. S2: annuity FV=$104,185. S3: $1,924/mo expenses → 6-month target $11,544 recommended due to 43% credit utilization fragility.' },
  { email:'noah.williams@uga.edu',     id:'a2', d:68, g:72, fb:'Correct answers. The emergency fund analysis would be stronger with a specific recommendation rather than just the range.',
    n:'S1: $1,790.85. R72=12yr. S2: $104,185. S3: 3-6 months of $1,924/mo = $5,772 to $11,544.' },
  { email:'isabella.martinez@uga.edu', id:'a2', d:72, g:87, fb:'Strong work. Step-by-step formula derivation makes the logic transparent throughout.',
    n:'S1: FV=$1,000(1.06)^10=$1,790.85. R72: 12yr, exact 11.90yr, error 0.8%. S2: FV annuity=$104,185. S3: $1,924 expenses → 4-month target $7,696 for someone with $124 deficit and 43% utilization.' },
  { email:'ethan.kim@uga.edu',         id:'a2', d:65, g:68, fb:"Mostly correct but show full work for the annuity formula — don't just state the answer.",
    n:'S1: $1,790.85. R72: 12yr. S2: $200/mo at 7% for 20 years = $104,185. S3: 3-6 months of expenses = $5,772 to $11,544.' },
  { email:'olivia.brown@uga.edu',      id:'a2', d:70, g:80, fb:'Solid. Good integration of dataset numbers. The deficit-resolution priority note is important.',
    n:'S1: $1,790.85. R72=12yr. S2: $104,185. S3: $5,772 (3mo) after first eliminating the $124 deficit. Full 6-month fund ($11,544) is the long-term target.' },
  { email:'liam.davis@uga.edu',        id:'a2', d:60, g:55, fb:'S1 is correct. Show detailed work for S2 and S3 — the annuity formula and dataset reference are both missing.',
    n:'S1: $1,000 at 6% for 10 years = $1,790.85. R72: 12yr. S2: $200/mo for 20yr at 7% ≈ $104,000. S3: 3-6 months of living expenses.' },
  { email:'ava.wilson@uga.edu',        id:'a2', d:74, g:95, fb:'Outstanding. The lump-sum vs annuity comparison and exact doubling time calculation demonstrate genuine command of TVM.',
    n:'S1: $1,790.85. R72=12yr. Exact: ln(2)/ln(1.06)=11.90yr. S2: $104,185.09. 5-yr version ($200/mo, 60 periods)=$14,333 showing compounding acceleration. S3: 6-month target $11,544 recommended given 43% utilization risk.' },
  { email:'jaylen.carter@uga.edu',     id:'a2', d:66, g:74, fb:"Good work. Correct calculations with clear presentation. Add the Rule of 72 formula derivation to strengthen S1.",
    n:'S1: $1,790.85. R72=12yr (exact 11.9yr). S2: FV=$104,185. S3: 3-month minimum = $5,772.' },
  { email:'chloe.anderson@uga.edu',    id:'a2', d:69, g:83, fb:'Well-structured. The real return analysis (nominal minus inflation) in S1 is excellent additional insight.',
    n:'S1: $1,790.85. R72=12yr. Real FV at 3% inflation: $1,332 in today\'s dollars. S2: $104,185 nominal; real = $57,703 in today\'s purchasing power. S3: HYSA at 5% means the emergency fund earns money while protecting against shocks — fund it.' },
  { email:'ryan.nguyen@uga.edu',       id:'a2', d:74, g:90, fb:'Excellent. The inflation-adjusted analysis and S2 sensitivity table demonstrate strong quantitative skills.',
    n:'S1: $1,790.85. Real rate: 6%-3%=3%, real FV=$1,337. S2: $104,185. Sensitivity: at 8% FV=$118,589; at 6% FV=$91,514. S3: recommend HYSA — at 5% APY the emergency fund itself becomes a productive asset.' },
  { email:'mia.jackson@uga.edu',       id:'a2', d:64, g:69, fb:'Correct calculations. Show the formula derivation before plugging in numbers.',
    n:'S1: $1,790.85. R72=12yr. S2: $200/mo at 7% for 20yr = $104,185. S3: $5,772 to $11,544.' },
  { email:'dylan.lee@uga.edu',         id:'a2', d:70, g:81, fb:'Good. The credit card paydown vs. emergency fund trade-off shows strong financial reasoning.',
    n:'S1: $1,790.85. R72=12yr. S2: $104,185. S3: pay off $580 Visa first (saves 22-29% APR), then fund HYSA emergency reserve.' },
  { email:'grace.taylor@uga.edu',      id:'a2', d:62, g:64, fb:"Correct approach. Reference the dataset's specific spending figure rather than a generic amount.",
    n:'S1: $1,790.85. R72=12yr. S2: $104,185. S3: I recommend starting with $5,000 as an emergency fund target.' },
  { email:'caleb.thomas@uga.edu',      id:'a2', d:72, g:86, fb:'Strong work. The opportunity-cost comparison between emergency fund and credit card paydown is exactly right.',
    n:'S1: $1,790.85. R72=12yr. S2: $104,185. S3: pay off Visa ($580, saves ~$128/yr in interest at 22%) before funding HYSA. Must close $124 deficit first.' },
  { email:'hannah.moore@uga.edu',      id:'a2', d:61, g:61, fb:'Answers mostly right but work is not shown. Always derive the formula before plugging in numbers.',
    n:'S1: $1,790.85. R72=12yr. S2: $104,185. S3: 3-6 months of expenses ≈ $5,772 to $11,544.' },
  { email:'zoe.harris@uga.edu',        id:'a2', d:69, g:76, fb:'Good work. The deficit-as-prerequisite principle is important — develop it further.',
    n:'S1: $1,790.85. R72=12yr. S2: $104,185. S3: target $5,772 (3mo). Prerequisite: eliminate $124 deficit first, then redirect surplus to HYSA.' },
  { email:'brandon.clark@uga.edu',     id:'a2', d:70, g:82, fb:'Well done. The trade-off analysis between emergency fund size and credit utilization shows integrated financial thinking.',
    n:'S1: $1,790.85. R72=12yr. S2: $104,185. S3: pay off $580 Visa (removes 43% utilization, +30 pts score), then build $5,772 HYSA. Timeline: 6-8 months after closing the deficit.' },
  { email:'natalie.lewis@uga.edu',     id:'a2', d:74, g:89, fb:'Outstanding. The opportunity cost of waiting analysis is graduate-level thinking.',
    n:'S1: $1,790.85. Cost of waiting 10 years: $784.53 per $1,000 in foregone growth. S2: $104,185. Starting at 25 instead of 22 reduces FV by $22,830. S3: 4-month target $7,696 — marginal cost of extra month is $1,924 but reduces financial fragility meaningfully.' },
  { email:'kevin.robinson@uga.edu',    id:'a2', d:66, g:71, fb:"Correct calculations. Engage more with the dataset specifics for S3.",
    n:'S1: $1,790.85. R72=12yr. S2: $104,185. S3: approximately $5,700 to $11,400 based on monthly expenses.' },

  // ── a3: Project 1 — Net Worth & Budget (150 pts, completed) ──────────
  { email:'emma.thompson@uga.edu',     id:'a3', d:51, g:138, fb:'Outstanding. Specific, actionable, grounded entirely in dataset numbers. Best submission in the class.',
    n:'Net worth: $4,350-$1,510=$2,840. Budget: 71%/24%/0%. $124 deficit. Credit: 680, 43% util. 6-mo plan: cut dining $100 → close deficit + $24 surplus; $50 to Visa; open HYSA $100/mo.' },
  { email:'marcus.chen@uga.edu',       id:'a3', d:43, g:96, fb:'Strong analysis. Deficit-first prioritization is the right call. Add more specifics to the credit improvement section.',
    n:'Net worth: $2,840. Needs at 71%. $124 deficit. Credit: 680, 43% util. Plan: eliminate deficit by cutting dining/entertainment $124/mo, then $150/mo extra to Visa → 30% utilization, then HYSA $50/mo.' },
  { email:'sofia.rodriguez@uga.edu',   id:'a3', d:45, g:101, fb:'Good work. The 50/30/20 analysis is correct. The 6-month plan needs more specific numbers.',
    n:'Net worth=$2,840. Needs 71% vs 50% target. Credit: 680, 43% util. Plan: reduce dining $80/mo, pay Visa to below $500, open savings account.' },
  { email:'aiden.brooks@uga.edu',      id:'a3', d:40, g:89, fb:'Correct net worth calculation. The plan is general — quantify each step with specific amounts.',
    n:'Net worth=$2,840. $124 deficit is unsustainable. Credit util 43% needs to drop below 30%. Plan: cut dining and entertainment to close deficit, redirect surplus to credit card paydown.' },
  { email:'tyler.johnson@uga.edu',     id:'a3', d:49, g:118, fb:'Very good. The phased timeline (Months 1-2, 3-4, 5-6) adds useful structure.',
    n:'Net worth $2,840. 50/30/20: 71%/24%/-11%. Month 1-2: cut dining $80+entertainment $44 = close $124 deficit. Month 3-4: $100/mo Visa → util 24%. Month 5-6: HYSA $100/mo.' },
  { email:'priya.patel@uga.edu',       id:'a3', d:51, g:136, fb:'Excellent. The credit score improvement model with specific projections is impressive — cite your scoring model source.',
    n:'Net worth $2,840. Budget: 71%/24%/-11%. Credit: FICO 680, 43% util. Paying Visa to $395 (30% of $1,317 limit) → est. +25-35 pts → 705-715. 6-mo: cut dining $100, entertainment $24 → close deficit → $100/mo to Visa → remaining to HYSA.' },
  { email:'noah.williams@uga.edu',     id:'a3', d:44, g:105, fb:'Good analysis. The 6-month plan would benefit from more specific dollar amounts.',
    n:'Net worth $2,840. Needs 71%. Credit: 680, 43% util. Plan: close deficit first by cutting discretionary, then pay down credit card below 30%, then start emergency savings.' },
  { email:'isabella.martinez@uga.edu', id:'a3', d:48, g:129, fb:'Strong submission. The sensitivity analysis showing how small behavior changes compound over 6 months is exactly the dynamic modeling this project calls for.',
    n:'Net worth $2,840. 71%/24%/-11%. Credit: 680, 44% util. 6-mo compound: cut $80 dining → $50 Visa/$30 savings. Month 6: Visa $280 (21% util), savings $180, est. score 700-715.' },
  { email:'ethan.kim@uga.edu',         id:'a3', d:42, g:97, fb:'Correct net worth and 50/30/20 analysis. The 6-month plan needs more specifics on exact cuts.',
    n:'Net worth $2,840. Needs 71%. $124 deficit. Credit: 680, 43% util. Plan: reduce dining and personal care to eliminate deficit, then redirect to credit card.' },
  { email:'olivia.brown@uga.edu',      id:'a3', d:47, g:118, fb:'Good work. The prioritization framework (deficit → credit → savings) is financially sound.',
    n:'Net worth $2,840. 71%/24%/0%. $124 deficit. Priority: close deficit (cut dining $80 + entertainment $44), then $100/mo to Visa (cleared in 6mo, util→0%), then $100/mo HYSA.' },
  { email:'liam.davis@uga.edu',        id:'a3', d:37, g:78, fb:'Net worth correct. The plan is too vague — reference specific numbers from the dataset.',
    n:'Net worth=$2,840. The student is spending more than they earn. Credit 680, util 43%. Plan: cut dining and entertainment to close gap, then pay down credit card, then build emergency fund.' },
  { email:'ava.wilson@uga.edu',        id:'a3', d:51, g:143, fb:'Exceptional. The forward projection showing net worth trajectory under different savings rates is graduate-level financial modeling.',
    n:'Net worth $2,840. 71%/24%/-11%. Deficit compounds: -$1,488/yr without action. 6-mo plan: cut dining $80+entertainment $24 = +$104 surplus. Month 3: $150 Visa + $78 HYSA. Month 6: Visa bal $280 (21% util), score est 710+, HYSA $456. Year 1 net worth: $4,180 (47% increase).' },
  { email:'jaylen.carter@uga.edu',     id:'a3', d:44, g:108, fb:'Well-organized. Short-term (close deficit) vs. long-term (emergency fund) planning is clearly articulated.',
    n:'Net worth $2,840. Needs $777=71% of $1,100 income. Phase 1 (months 1-3): cut dining $80+entertainment $44 to close deficit. Phase 2 (months 4-6): $100/mo Visa, $50/mo savings → util 30%, $300 emergency fund.' },
  { email:'chloe.anderson@uga.edu',    id:'a3', d:46, g:121, fb:'Solid. The credit utilization paydown timeline is correctly calculated.',
    n:'Net worth $2,840. 71%/24%/-11%. Util $580/$1,317=44%. Month 1: cut dining $80+entertainment $44 → close deficit. Month 2-3: $100/mo Visa → $380 balance (29% util). Month 4-6: $50 Visa + $50 HYSA. Score → ~705, $150 emergency savings.' },
  { email:'ryan.nguyen@uga.edu',       id:'a3', d:50, g:133, fb:'Excellent. The Monte Carlo framing for credit score improvement is innovative and well-reasoned.',
    n:'Net worth $2,840. 71%/24%/-11%. Cut dining $80+entertainment $44. Redirect $80 Visa + $44 HYSA/mo. Month 6: Visa $100 (8% util), est score 720-740. Net worth by month 12: ~$4,200.' },
  { email:'mia.jackson@uga.edu',       id:'a3', d:43, g:101, fb:'Good work. Be more specific in the plan — how much goes to each goal each month?',
    n:'Net worth $2,840. 50/30/20 shows overspending on needs. $124 deficit is the main obstacle. Plan: cut spending, pay down credit card, start emergency savings.' },
  { email:'dylan.lee@uga.edu',         id:'a3', d:47, g:116, fb:'Strong submission. The trade-off between paying credit card vs. building emergency fund is well-reasoned.',
    n:'Net worth $2,840. Needs 71%/wants 24%/savings -11%. Trade-off: pay Visa first (saves 22-29% APR = $127-168/yr) vs HYSA (5% on $5,772 = $289/yr). Verdict: pay Visa first — higher guaranteed return, improves credit score.' },
  { email:'grace.taylor@uga.edu',      id:'a3', d:39, g:91, fb:'Correct calculations. A month-by-month breakdown with specific amounts would strengthen the plan.',
    n:'Net worth $2,840. Needs are too high at 71%. $124 deficit. Credit util 43%. Plan: reduce dining and entertainment to close deficit, redirect to credit card paydown.' },
  { email:'caleb.thomas@uga.edu',      id:'a3', d:49, g:128, fb:'Very strong. The behavioral finance angle (commitment devices) is a sophisticated addition.',
    n:'Net worth $2,840. Deficit: -$124/mo = -$1,488/yr compounding. Plan: cut dining $80 → set up automatic $80 Visa payment (commitment device). Month 3: cut entertainment $44 → $50 HYSA. Projected: util 29%, score 705-720, emergency fund $150.' },
  { email:'hannah.moore@uga.edu',      id:'a3', d:38, g:85, fb:'Core analysis is present. Stay grounded in the dataset — specific dollar amounts are required.',
    n:'Net worth $2,840. $124 monthly deficit and 43% credit utilization need to be addressed. Plan: cut spending to eliminate deficit, then pay down credit card, then build savings.' },
  { email:'zoe.harris@uga.edu',        id:'a3', d:46, g:111, fb:'Good analysis with clear prioritization. The compounding deficit note is important — develop it further.',
    n:'Net worth $2,840. 71%/24%/-11%. Each month the deficit adds $124 to liabilities. Month 1-2: cut dining $80+entertainment $44 = +$124. Month 3-4: $100 Visa (bal $380, util 29%), $24 HYSA. Month 5-6: score improves ~25pts, HYSA $72.' },
  { email:'brandon.clark@uga.edu',     id:'a3', d:47, g:116, fb:'Solid. The income augmentation alternative to pure expense cutting is worth including.',
    n:'Net worth $2,840. Options: (A) cut expenses $124/mo, (B) earn $124/mo more (8hr/wk at $16/hr), (C) combination. Recommend C: cut dining $80 + earn $50 extra = +$130/mo surplus. Excess: $100 Visa + $30 HYSA.' },
  { email:'natalie.lewis@uga.edu',     id:'a3', d:51, g:131, fb:'Excellent. The three-scenario comparison (expense-cut vs income-augmentation vs hybrid) is a sophisticated planning framework.',
    n:'Net worth $2,840. Without action: $2,840 - $1,488/yr = $1,352 after year 1. Scenarios: (A) pure expense cut $124, (B) pure income add $130, (C) hybrid $60 cuts + $65 income. Recommend C — most sustainable, builds income habits. Month 6: util 28%, score 710, HYSA $180.' },
  { email:'kevin.robinson@uga.edu',    id:'a3', d:44, g:103, fb:'Good analysis. Show the credit utilization calculation explicitly and add more detail to the improvement plan.',
    n:'Net worth $2,840. Needs 71%, savings -11%. Credit 680, 43% util. Plan: eliminate deficit first by cutting discretionary, redirect surplus to credit card and emergency fund.' },

  // ── a4: Tax Assignment (75 pts, completed) ────────────────────────────
  { email:'emma.thompson@uga.edu',     id:'a4', d:30, g:68, fb:'Strong tax analysis. The TCJA commentary is accurate and well-placed.',
    n:'S1 ($45k): TI=$31,150, tax=$3,518, eff 7.8%, marg 12%. Standard wins by $3,650. S2 ($85k): eff 19.8%, marg 22%. 401k $6k saves $1,320. S3 ($180k): eff 22.3%, marg 24%. Itemized ($28,400) beats standard by $14,550, saves $3,492. TCJA doubled standard deduction, reducing itemizing benefit for middle-income filers.' },
  { email:'marcus.chen@uga.edu',       id:'a4', d:25, g:62, fb:'Good work. Show the full bracket math for S1 — effective rate should be ~7.8%, not higher.',
    n:'S1 ($45k): std deduction $13,850 → TI $31,150. Brackets: 10%×$11k=$1,100, 12%×$20,150=$2,418, total $3,518, eff ~8%. S2 ($85k): eff ~19%, marg 22%, 401k reduces taxes. S3 ($180k): itemized $28,400 > standard → saves ~$3,500.' },
  { email:'sofia.rodriguez@uga.edu',   id:'a4', d:27, g:56, fb:'Effective rates approximately correct. Show full bracket calculations for each scenario.',
    n:'S1 ($45k): eff ~16%, marg 22%, standard deduction better. S2 ($85k): eff ~19%, marg 22%, 401k reduces tax. S3 ($180k): eff ~22%, marg 24%, itemized $28,400 > standard $13,850.' },
  { email:'aiden.brooks@uga.edu',      id:'a4', d:23, g:47, fb:'Show full calculation work for each scenario. Bracket math is the core of this assignment.',
    n:'S1: standard deduction, effective ~16%, marg 22%. S2: effective ~20%, 401k helpful. S3: effective ~22%, itemizing better at this income level.' },
  { email:'tyler.johnson@uga.edu',     id:'a4', d:29, g:63, fb:'Good analysis. Deduction comparison in S3 is clear. Show more bracket detail in S1 and S2.',
    n:'S1 ($45k): TI=$31,150, tax=$3,518, eff 7.8%, marg 12%. Standard wins by $3,650. S2 ($85k): eff 19.8%, 401k saves $4,950 max. S3 ($180k): itemized $28,400 beats standard by $14,550 → saves $3,492.' },
  { email:'priya.patel@uga.edu',       id:'a4', d:30, g:71, fb:'Excellent. The marginal vs. effective rate distinction is clearly demonstrated across all three scenarios.',
    n:'S1: TI=$31,150, tax=$3,518, eff 7.8%, marg 12%. S2: effective 14.3%, marg 22%. 401k max ($22,500) saves $4,950. S3: itemized $28,400 > standard by $14,550 → $3,492 saved. TCJA key insight: doubled standard deduction eliminated itemizing for 90% of filers.' },
  { email:'noah.williams@uga.edu',     id:'a4', d:26, g:56, fb:'Calculation approach is correct. Show more detailed bracket math. S3 recommendation is right.',
    n:'S1: eff ~16%, marg 22%, standard better. S2: eff ~20%, marg 22%, 401k beneficial. S3: itemized $28,400 > standard $13,850 — itemize.' },
  { email:'isabella.martinez@uga.edu', id:'a4', d:28, g:67, fb:'Very solid. The TCJA historical context adds real depth to the deduction comparison.',
    n:'S1: TI=$31,150, tax=$3,518, eff 7.8%, marg 12%. S2: TI=$71,150, eff 14.3%, marg 22%. S3: itemized $28,400 saves $3,492 vs standard. TCJA 2017 doubled standard deduction, eliminating itemizing incentive for ~30M filers.' },
  { email:'ethan.kim@uga.edu',         id:'a4', d:24, g:51, fb:'Approach is correct. Show bracket calculations more clearly.',
    n:'S1 ($45k): standard deduction, eff ~16%, marg 22%. S2 ($85k): eff ~20%, 401k reduces taxes. S3 ($180k): itemized $28,400 > standard → itemize.' },
  { email:'olivia.brown@uga.edu',      id:'a4', d:27, g:62, fb:'Good analysis. Effective vs. marginal rate distinction is clear throughout.',
    n:'S1: TI=$31,150, tax=$3,518, eff 7.8%, marg 12%. Standard better by $3,650. S2: eff 19.8%, marg 22%. $6k 401k saves $1,320. S3: itemized $28,400 saves $3,492 vs standard. Itemize.' },
  { email:'liam.davis@uga.edu',        id:'a4', d:21, g:38, fb:'Show full calculations for each scenario. Generic rate estimates without bracket math do not demonstrate understanding.',
    n:'S1: low income, standard deduction, low tax rate. S2: middle income, 401k helps. S3: high income, probably better to itemize.' },
  { email:'ava.wilson@uga.edu',        id:'a4', d:30, g:72, fb:'Outstanding. The AMT mention is accurate and the after-tax comparison across scenarios is a useful addition.',
    n:'S1: TI=$31,150, tax=$3,518, eff 7.8%, marg 12%. S2: 401k max → TI=$71,150-$22,500=$48,650, net tax $7,167. S3: itemized beats standard by $14,550, saves $3,492. At $180k consider AMT check (threshold ~$81k).' },
  { email:'jaylen.carter@uga.edu',     id:'a4', d:25, g:57, fb:'Correct recommendations. Show more detailed bracket calculations.',
    n:'S1 ($45k): standard $13,850 better, eff ~16%, marg 22%. S2 ($85k): eff ~20%, 401k saves $1,320 at $6k contribution. S3 ($180k): itemized $28,400 > standard $13,850 — itemize.' },
  { email:'chloe.anderson@uga.edu',    id:'a4', d:27, g:64, fb:'Good work with clear bracket math. Effective rate comparison across scenarios is helpful.',
    n:'S1: 10%×$11k+12%×$20,150=$3,518, eff 7.8%, marg 12%. S2: marg 22%, 401k $22,500 saves $4,950. S3: itemized $28,400 saves $3,492.' },
  { email:'ryan.nguyen@uga.edu',       id:'a4', d:29, g:70, fb:'Excellent. The after-tax return on 401k contributions is a nice insight beyond the assignment requirements.',
    n:'S1: $3,518 tax, eff 7.8%. S2: 401k saves $4,950 — after-tax return includes investment gains PLUS $4,950 tax savings. S3: itemized+401k = $8,442 total savings at $180k.' },
  { email:'mia.jackson@uga.edu',       id:'a4', d:23, g:52, fb:'Recommendations correct but need supporting calculations. Show full bracket math.',
    n:'S1: standard deduction, eff ~16%, marg 22%. S2: eff ~20%, 401k helps. S3: itemized $28,400 better, eff ~22%.' },
  { email:'dylan.lee@uga.edu',         id:'a4', d:27, g:62, fb:'Solid analysis. Marginal rate impact of 401k correctly calculated.',
    n:'S1: TI=$31,150, tax=$3,518, eff 7.8%, marg 12%. S2: 22% marg rate. $6k 401k×22%=$1,320 savings. S3: itemized saves $14,550×24%=$3,492. Itemize.' },
  { email:'grace.taylor@uga.edu',      id:'a4', d:22, g:47, fb:'Show bracket calculations in detail. Recommendations are correct but need supporting math.',
    n:'S1: eff ~16%, marg 22%, standard better. S2: eff ~20%, 401k beneficial. S3: itemized ($28,400) > standard ($13,850) — itemize.' },
  { email:'caleb.thomas@uga.edu',      id:'a4', d:28, g:66, fb:'Strong analysis with clear recommendations and supporting math.',
    n:'S1: TI=$31,150, tax=$3,518, eff 7.8%, marg 12%. S2: 401k each $1 saves 22¢. S3: itemized saves $3,492. Combined at $180k: itemize+401k=$8,442 total tax savings.' },
  { email:'hannah.moore@uga.edu',      id:'a4', d:21, g:46, fb:'Correct recommendations. Show full bracket calculations.',
    n:'S1: standard deduction, eff ~16%, marg 22%. S2: 401k reduces taxes. S3: itemized $28,400 > standard.' },
  { email:'zoe.harris@uga.edu',        id:'a4', d:26, g:59, fb:'Good analysis. Double-check S1 effective rate — bracket math gives ~7.8%, not 16%.',
    n:'S1: TI=$31,150, eff ~16%, marg 22%, standard wins. S2: eff ~20%, 401k reduces TI. S3: itemized $28,400 > standard — itemize.' },
  { email:'brandon.clark@uga.edu',     id:'a4', d:27, g:62, fb:'Solid submission with well-organized recommendations.',
    n:'S1: TI=$31,150, tax=$3,518, eff 7.8%, marg 12%. S2: 401k saves 22¢ per dollar. S3: itemized $28,400 saves $3,492 at 24% marg. Itemize.' },
  { email:'natalie.lewis@uga.edu',     id:'a4', d:30, g:69, fb:'Excellent. The multi-year optimization strategy (401k + itemizing + Roth conversion) goes beyond the assignment scope in a good way.',
    n:'S1: $3,518 tax, eff 7.8%. S2: max 401k saves $4,950. Consider Roth at $45k (low bracket) vs traditional at $85k (higher bracket). S3: itemize saves $3,492. Combined: $8,442 savings. HSA if HDHP eligible — triple tax advantage.' },
  { email:'kevin.robinson@uga.edu',    id:'a4', d:24, g:54, fb:'Correct approach. Show detailed bracket calculations to demonstrate mastery.',
    n:'S1 ($45k): standard, eff ~16%, marg 22%. S2 ($85k): eff ~20%, 401k helps. S3 ($180k): eff ~22%, itemized better.' },

  // ── a5: Project 2 — Investment & Mortgage (150 pts, active) ── 17 submitted, 8 graded
  { email:'emma.thompson@uga.edu',     id:'a5', d:10, g:120, fb:'Strong investment analysis. Rent vs. own breakeven is correctly calculated.',
    n:'Amortization: $300k, 6.5%, 30yr → $1,896.20/mo, $382,632 total interest (127% of principal). Rent ($1,600/mo, 3% inflation) vs own (4% appreciation): breakeven yr 8. Portfolio: 5 holdings, exp ratio 0.08%, Sharpe 0.87, 10yr at 8% = $145,200.' },
  { email:'tyler.johnson@uga.edu',     id:'a5', d:8,  g:118, fb:'Well-structured analysis. Portfolio diversification section is thorough.',
    n:'$300k, 6.5%, 30yr: $1,896/mo, $382,632 interest. Rent breakeven at $1,700/mo current: yr 6.5. Portfolio: 70/30 equity/bond, 0.08% exp ratio, 10yr = $145k. Increasing equity to 85% adds ~$23k projected.' },
  { email:'isabella.martinez@uga.edu', id:'a5', d:9,  g:128, fb:'Excellent. The rate scenario comparison is a sophisticated addition.',
    n:'Mortgage: $1,896.20/mo, total $682,632. At 5.5%: $1,703/mo, saves $69,552 over life. Portfolio Sharpe 0.87 vs benchmark 0.72. 85% equity adds ~$19k 10yr expected return but raises max drawdown from 28% to 38%.' },
  { email:'ethan.kim@uga.edu',         id:'a5', d:7,  g:null, fb:null,
    n:'$300k, 6.5%, 30yr: $1,896/mo, $382,632 interest. Rent vs own breakeven ~7-8yr. Portfolio: diversified, low expense ratio, 10yr projection at 8%.' },
  { email:'ava.wilson@uga.edu',        id:'a5', d:11, g:138, fb:'Outstanding. The risk-adjusted return comparison and Monte Carlo framing are graduate-level analysis.',
    n:'Amortization: $1,896.20/mo, $382,632 interest. Extra $200/mo: saves 6yr 4mo and $71,450. ROI vs investing $200/mo at 8% (22yr = $258k): invest wins by $160,570. Sharpe 0.87, max drawdown -31%. Conclusion: invest over accelerated paydown unless risk-averse.' },
  { email:'jaylen.carter@uga.edu',     id:'a5', d:6,  g:null, fb:null,
    n:'Mortgage: $1,896/mo, $382,632 total interest. Portfolio diversified with low expense ratios. 10yr wealth projection at 8% return.' },
  { email:'ryan.nguyen@uga.edu',       id:'a5', d:10, g:126, fb:'Excellent. The rent vs. own sensitivity table across appreciation rates is professional-grade analysis.',
    n:'$1,896.20/mo. Sensitivity: 0% appreciation → own never wins. 2% → breakeven yr 14. 4% → yr 8. 6% → yr 5. If expected appreciation < 3%, renting + investing down payment produces better outcomes.' },
  { email:'dylan.lee@uga.edu',         id:'a5', d:7,  g:null, fb:null,
    n:'$300k, 6.5%, 30yr: $1,896.20/mo, $382,632 interest. Rent vs own depends on local appreciation. Portfolio diversified, low fees.' },
  { email:'caleb.thomas@uga.edu',      id:'a5', d:9,  g:120, fb:'Strong submission. The accelerated payoff vs. invest comparison is well-reasoned.',
    n:'$1,896/mo, $382,632 interest. Extra $300/mo: 22yr term, saves $97,430. vs investing $300/mo at 8% 22yr = $258k. Market wins by $160,570. Sharpe 0.87. Verdict: invest over paydown.' },
  { email:'brandon.clark@uga.edu',     id:'a5', d:7,  g:null, fb:null,
    n:'$300k, 6.5%, 30yr: $1,896.20/mo. Year 1: $19,500 interest vs $3,354 principal. Portfolio diversified, 10yr projection.' },
  { email:'natalie.lewis@uga.edu',     id:'a5', d:10, g:131, fb:'Excellent. The year-by-year amortization breakdown and portfolio risk comparison are both impressive.',
    n:'Amortization: yr 1 84.5% interest, yr 10 76.5%, yr 20 59.5%. Total $382,632 = 127% of principal. Portfolio Sharpe 0.87. At 90/10 equity/bond at age 22: 10yr = $107,946 vs 85/15 = $105,000. Difference $2,946 not worth extra volatility.' },
  { email:'olivia.brown@uga.edu',      id:'a5', d:8,  g:108, fb:'Good analysis. The mortgage section is strong. Portfolio section needs more quantitative analysis.',
    n:'$300k, 6.5%, 30yr: $1,896/mo, $382,632 interest. Rent breakeven: ~yr 8 at $1,600 rent. Portfolio: 0.08% exp ratio, recommend higher equity allocation for long-term returns at age 22.' },
  { email:'zoe.harris@uga.edu',        id:'a5', d:6,  g:null, fb:null,
    n:'$1,896/mo, $382,632 interest. Portfolio diversified with low cost. 10yr projection.' },
  { email:'chloe.anderson@uga.edu',    id:'a5', d:8,  g:null, fb:null,
    n:'Mortgage: $1,896.20/mo, $382,632 total interest. Rent vs own breakeven ~7-8yr. Portfolio low exp ratio, 10yr at 8%.' },
  { email:'sofia.rodriguez@uga.edu',   id:'a5', d:5,  g:null, fb:null,
    n:'$300k, 6.5%, 30yr: $1,896/mo, $382,632 interest. Portfolio diversified. Key insight: start investing early for compound growth.' },
  { email:'marcus.chen@uga.edu',       id:'a5', d:7,  g:null, fb:null,
    n:'$1,896/mo, $382,632 interest. Year 1: $19,500 interest, $3,554 principal. Portfolio 5-fund, 0.08% exp ratio. 10yr at 8% on $50k = $107,946.' },
  { email:'aiden.brooks@uga.edu',      id:'a5', d:4,  g:null, fb:null,
    n:'$300k mortgage, 6.5%, 30yr: ~$1,896/mo. Total interest ~$382k. Portfolio is diversified.' },

  // ── a6: Future Forecasting (150 pts, active) ── 9 submitted, 2 graded
  { email:'emma.thompson@uga.edu',     id:'a6', d:3,  g:null, fb:null,
    n:'30yr forecast at 7%: $500/mo → $1.27M at 65. For $2M: need $787/mo today or $1,543/mo at 30. Insurance gap: disability should cover 60% income ($27k/yr); current $0. Net worth: $2,840 → $245k by 35 → $1.3M by 65.' },
  { email:'priya.patel@uga.edu',       id:'a6', d:2,  g:null, fb:null,
    n:'Retirement target $1.5M (43yr). At 7%: $310/mo now or $1,148/mo at 40. SS covers 34% of $65k target. Life insurance: $500k 20yr term at 22 ≈ $15/mo.' },
  { email:'ava.wilson@uga.edu',        id:'a6', d:4,  g:135, fb:'Outstanding. The Monte Carlo confidence interval approach is professional-grade financial modeling.',
    n:'Monte Carlo: 90th pct = $2.1M, 50th = $1.27M, 10th = $480k at 65. Save $750/mo to hit $1.5M at 50th pct. Insurance: life ($500k term), disability (60% = $27k/yr), umbrella ($1M). Net worth: $2,840 → $67k (30) → $285k (40) → $1.27M (65).' },
  { email:'ryan.nguyen@uga.edu',       id:'a6', d:3,  g:118, fb:'Excellent. The SS replacement rate comparison across income levels is a sophisticated addition.',
    n:'4% SWR: $1M → $40k/yr. For $55k/yr: need $1.375M. At 7%, $450/mo from 22 reaches $1.4M by 65. SS: at $45k income replaces 42%; at $85k only 28% — higher earners need more private savings. Max HSA ($4,150/yr) for triple tax advantage.' },
  { email:'caleb.thomas@uga.edu',      id:'a6', d:2,  g:null, fb:null,
    n:'$600/mo at 7% for 43yr = $1.89M. For $2.5M: need $794/mo. Key insight: every $100/mo at 22 vs 32 produces $142k more at retirement.' },
  { email:'dylan.lee@uga.edu',         id:'a6', d:2,  g:null, fb:null,
    n:'$500/mo at 7% from 22 → $1.27M at 65. Insurance: life and disability. Net worth trajectory: slow growth early, exponential after 40.' },
  { email:'chloe.anderson@uga.edu',    id:'a6', d:1,  g:null, fb:null,
    n:'$500/mo at 7% = $1.27M at 65. For $1.5M: need $590/mo. Insurance: life and disability.' },
  { email:'natalie.lewis@uga.edu',     id:'a6', d:3,  g:null, fb:null,
    n:'Retirement $1.5M at 7%: $310/mo now. Insurance: $500k life + $27k/yr disability. Net worth: $2,840 → $1.5M over 43yr.' },
  { email:'brandon.clark@uga.edu',     id:'a6', d:1,  g:null, fb:null,
    n:'$500/mo at 7% for 43yr = $1.27M. Starting early has massive compounding impact. Insurance: term life and disability recommended.' },
];

DEMO_SUBMISSIONS.forEach(s => {
  const u = db.prepare('SELECT id FROM users WHERE email = ?').get(s.email);
  if (!u) return;
  db.prepare(`
    INSERT OR REPLACE INTO submissions (user_id, assignment_id, course_code, notes, grade, feedback, submitted_at)
    VALUES (?, ?, 'B-TERRY-26', ?, ?, ?, ?)
  `).run(u.id, s.id, s.n, s.g ?? null, s.fb ?? null, daysAgo(s.d));
});

module.exports = db;
