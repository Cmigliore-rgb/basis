// Generates realistic Athens, GA demo data with today-relative dates.
// Never use real personal financial data here — this file may be shown publicly.

function d(daysAgo) {
  const dt = new Date();
  dt.setDate(dt.getDate() - daysAgo);
  return dt.toISOString().split('T')[0];
}

let _txnId = 1;
const tid = () => `demo_txn_${String(_txnId++).padStart(4, '0')}`;

const CHECKING  = 'demo_chk_001';
const SAVINGS   = 'demo_sav_001';
const CREDIT    = 'demo_cc_001';
const BROKERAGE = 'demo_brok_001';

function getDummyData() {
  _txnId = 1; // reset so IDs are stable per call

  // ── Accounts ─────────────────────────────────────────────────────────────
  const accounts = [
    {
      account_id: CHECKING,
      name: 'Total Checking',
      type: 'depository',
      subtype: 'checking',
      balances: { current: 3240.17, available: 3240.17, iso_currency_code: 'USD' },
      institution_name: 'Chase',
    },
    {
      account_id: SAVINGS,
      name: 'Premier Savings',
      type: 'depository',
      subtype: 'savings',
      balances: { current: 5800.00, available: 5800.00, iso_currency_code: 'USD' },
      institution_name: 'Chase',
    },
    {
      account_id: CREDIT,
      name: 'Quicksilver Cash Rewards',
      type: 'credit',
      subtype: 'credit card',
      balances: { current: 748.32, available: 4251.68, limit: 5000.00, iso_currency_code: 'USD' },
      institution_name: 'Capital One',
    },
    {
      account_id: BROKERAGE,
      name: 'Individual Brokerage',
      type: 'investment',
      subtype: 'brokerage',
      balances: { current: 7831.90, available: null, iso_currency_code: 'USD' },
      institution_name: 'Fidelity',
    },
  ];

  // ── Transactions (90 days, Athens GA) ────────────────────────────────────
  // Positive amount = debit/expense. Negative amount = credit/income.
  const transactions = [
    // ── Income / transfers in ──────────────────────────────────────────────
    { transaction_id: tid(), account_id: CHECKING, name: 'UGA Research Stipend',          amount: -1250.00, date: d(86), category: ['Transfer', 'Credit'], personal_finance_category: { primary: 'TRANSFER_IN' }, pending: false },
    { transaction_id: tid(), account_id: CHECKING, name: 'UGA Research Stipend',          amount: -1250.00, date: d(56), category: ['Transfer', 'Credit'], personal_finance_category: { primary: 'TRANSFER_IN' }, pending: false },
    { transaction_id: tid(), account_id: CHECKING, name: 'UGA Research Stipend',          amount: -1250.00, date: d(26), category: ['Transfer', 'Credit'], personal_finance_category: { primary: 'TRANSFER_IN' }, pending: false },
    { transaction_id: tid(), account_id: CHECKING, name: 'Venmo Payment Received',        amount:   -40.00, date: d(18), category: ['Transfer', 'Credit'], personal_finance_category: { primary: 'TRANSFER_IN' }, pending: false },

    // ── Rent ───────────────────────────────────────────────────────────────
    { transaction_id: tid(), account_id: CHECKING, name: 'Athens Housing — Apt 4B',       amount:  875.00, date: d(87), category: ['Payment', 'Rent'], personal_finance_category: { primary: 'RENT_AND_UTILITIES' }, pending: false },
    { transaction_id: tid(), account_id: CHECKING, name: 'Athens Housing — Apt 4B',       amount:  875.00, date: d(57), category: ['Payment', 'Rent'], personal_finance_category: { primary: 'RENT_AND_UTILITIES' }, pending: false },
    { transaction_id: tid(), account_id: CHECKING, name: 'Athens Housing — Apt 4B',       amount:  875.00, date: d(27), category: ['Payment', 'Rent'], personal_finance_category: { primary: 'RENT_AND_UTILITIES' }, pending: false },

    // ── Utilities ──────────────────────────────────────────────────────────
    { transaction_id: tid(), account_id: CHECKING, name: 'Georgia Power',                 amount:   72.45, date: d(83), category: ['Service', 'Utilities'], personal_finance_category: { primary: 'RENT_AND_UTILITIES' }, pending: false },
    { transaction_id: tid(), account_id: CHECKING, name: 'Georgia Power',                 amount:   58.20, date: d(53), category: ['Service', 'Utilities'], personal_finance_category: { primary: 'RENT_AND_UTILITIES' }, pending: false },
    { transaction_id: tid(), account_id: CHECKING, name: 'Georgia Power',                 amount:   44.88, date: d(23), category: ['Service', 'Utilities'], personal_finance_category: { primary: 'RENT_AND_UTILITIES' }, pending: false },
    { transaction_id: tid(), account_id: CHECKING, name: 'Charter Spectrum Internet',     amount:   59.99, date: d(82), category: ['Service', 'Internet'], personal_finance_category: { primary: 'RENT_AND_UTILITIES' }, pending: false },
    { transaction_id: tid(), account_id: CHECKING, name: 'Charter Spectrum Internet',     amount:   59.99, date: d(52), category: ['Service', 'Internet'], personal_finance_category: { primary: 'RENT_AND_UTILITIES' }, pending: false },
    { transaction_id: tid(), account_id: CHECKING, name: 'Charter Spectrum Internet',     amount:   59.99, date: d(22), category: ['Service', 'Internet'], personal_finance_category: { primary: 'RENT_AND_UTILITIES' }, pending: false },

    // ── Phone ──────────────────────────────────────────────────────────────
    { transaction_id: tid(), account_id: CREDIT,   name: 'AT&T Mobile Services',          amount:   65.00, date: d(85), category: ['Service', 'Telecommunication Services'], personal_finance_category: { primary: 'RENT_AND_UTILITIES' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: 'AT&T Mobile Services',          amount:   65.00, date: d(55), category: ['Service', 'Telecommunication Services'], personal_finance_category: { primary: 'RENT_AND_UTILITIES' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: 'AT&T Mobile Services',          amount:   65.00, date: d(25), category: ['Service', 'Telecommunication Services'], personal_finance_category: { primary: 'RENT_AND_UTILITIES' }, pending: false },

    // ── Subscriptions ──────────────────────────────────────────────────────
    { transaction_id: tid(), account_id: CREDIT,   name: 'Netflix',                       amount:   15.49, date: d(80), category: ['Service', 'Entertainment'], personal_finance_category: { primary: 'ENTERTAINMENT' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: 'Netflix',                       amount:   15.49, date: d(50), category: ['Service', 'Entertainment'], personal_finance_category: { primary: 'ENTERTAINMENT' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: 'Netflix',                       amount:   15.49, date: d(20), category: ['Service', 'Entertainment'], personal_finance_category: { primary: 'ENTERTAINMENT' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: 'Spotify Premium',               amount:   10.99, date: d(79), category: ['Service', 'Entertainment'], personal_finance_category: { primary: 'ENTERTAINMENT' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: 'Spotify Premium',               amount:   10.99, date: d(49), category: ['Service', 'Entertainment'], personal_finance_category: { primary: 'ENTERTAINMENT' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: 'Spotify Premium',               amount:   10.99, date: d(19), category: ['Service', 'Entertainment'], personal_finance_category: { primary: 'ENTERTAINMENT' }, pending: false },

    // ── Groceries ─────────────────────────────────────────────────────────
    { transaction_id: tid(), account_id: CREDIT,   name: 'Kroger #0841 — Alps Rd',        amount:   67.23, date: d(81), category: ['Shops', 'Supermarkets and Groceries'], personal_finance_category: { primary: 'GROCERIES' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: 'Ingles Markets #022',           amount:   43.18, date: d(74), category: ['Shops', 'Supermarkets and Groceries'], personal_finance_category: { primary: 'GROCERIES' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: 'Kroger #0841 — Alps Rd',        amount:   54.76, date: d(45), category: ['Shops', 'Supermarkets and Groceries'], personal_finance_category: { primary: 'GROCERIES' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: 'Publix Super Markets',          amount:   38.92, date: d(31), category: ['Shops', 'Supermarkets and Groceries'], personal_finance_category: { primary: 'GROCERIES' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: 'Ingles Markets #022',           amount:   61.47, date: d(15), category: ['Shops', 'Supermarkets and Groceries'], personal_finance_category: { primary: 'GROCERIES' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: 'Kroger #0841 — Alps Rd',        amount:   48.23, date: d(7),  category: ['Shops', 'Supermarkets and Groceries'], personal_finance_category: { primary: 'GROCERIES' }, pending: false },

    // ── Restaurants / Food (Athens-specific) ──────────────────────────────
    { transaction_id: tid(), account_id: CREDIT,   name: "Zaxby's — Atlanta Hwy",         amount:   11.47, date: d(78), category: ['Food and Drink', 'Restaurants', 'Fast Food'], personal_finance_category: { primary: 'FOOD_AND_DRINK' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: "Jittery Joe's Coffee",          amount:    6.50, date: d(76), category: ['Food and Drink', 'Coffee Shop'], personal_finance_category: { primary: 'FOOD_AND_DRINK' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: 'Waffle House #1219',            amount:    9.75, date: d(70), category: ['Food and Drink', 'Restaurants'], personal_finance_category: { primary: 'FOOD_AND_DRINK' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: "Raising Cane's — College Ave",  amount:   13.20, date: d(47), category: ['Food and Drink', 'Restaurants', 'Fast Food'], personal_finance_category: { primary: 'FOOD_AND_DRINK' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: "Jittery Joe's Coffee",          amount:    5.75, date: d(43), category: ['Food and Drink', 'Coffee Shop'], personal_finance_category: { primary: 'FOOD_AND_DRINK' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: "Zaxby's — Atlanta Hwy",         amount:   12.83, date: d(39), category: ['Food and Drink', 'Restaurants', 'Fast Food'], personal_finance_category: { primary: 'FOOD_AND_DRINK' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: 'Last Resort Grill',             amount:   47.50, date: d(33), category: ['Food and Drink', 'Restaurants'], personal_finance_category: { primary: 'FOOD_AND_DRINK' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: "Chick-fil-A — Prince Ave",      amount:    8.45, date: d(28), category: ['Food and Drink', 'Restaurants', 'Fast Food'], personal_finance_category: { primary: 'FOOD_AND_DRINK' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: "Zaxby's — Atlanta Hwy",         amount:   10.99, date: d(19), category: ['Food and Drink', 'Restaurants', 'Fast Food'], personal_finance_category: { primary: 'FOOD_AND_DRINK' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: "Jittery Joe's Coffee",          amount:    7.25, date: d(18), category: ['Food and Drink', 'Coffee Shop'], personal_finance_category: { primary: 'FOOD_AND_DRINK' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: "Chick-fil-A — Prince Ave",      amount:    9.85, date: d(16), category: ['Food and Drink', 'Restaurants', 'Fast Food'], personal_finance_category: { primary: 'FOOD_AND_DRINK' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: 'Five Guys — Atlanta Hwy',       amount:   16.75, date: d(13), category: ['Food and Drink', 'Restaurants'], personal_finance_category: { primary: 'FOOD_AND_DRINK' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: 'Panda Express — Alps Rd',       amount:   11.50, date: d(11), category: ['Food and Drink', 'Restaurants', 'Fast Food'], personal_finance_category: { primary: 'FOOD_AND_DRINK' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: 'Waffle House #1219',            amount:   11.25, date: d(6),  category: ['Food and Drink', 'Restaurants'], personal_finance_category: { primary: 'FOOD_AND_DRINK' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: 'Starbucks — Milledge Ave',      amount:    8.75, date: d(5),  category: ['Food and Drink', 'Coffee Shop'], personal_finance_category: { primary: 'FOOD_AND_DRINK' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: "Zaxby's — Atlanta Hwy",         amount:   13.47, date: d(3),  category: ['Food and Drink', 'Restaurants', 'Fast Food'], personal_finance_category: { primary: 'FOOD_AND_DRINK' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: "Jittery Joe's Coffee",          amount:    6.25, date: d(2),  category: ['Food and Drink', 'Coffee Shop'], personal_finance_category: { primary: 'FOOD_AND_DRINK' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: "McDonald's — Atlanta Hwy",      amount:    7.83, date: d(1),  category: ['Food and Drink', 'Restaurants', 'Fast Food'], personal_finance_category: { primary: 'FOOD_AND_DRINK' }, pending: false },

    // ── General Merchandise ────────────────────────────────────────────────
    { transaction_id: tid(), account_id: CREDIT,   name: 'Walmart Supercenter — Atlanta Hwy', amount:  89.44, date: d(63), category: ['Shops', 'Department Stores'], personal_finance_category: { primary: 'GENERAL_MERCHANDISE' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: 'Target — Atlanta Hwy',          amount:  112.67, date: d(51), category: ['Shops', 'Department Stores'], personal_finance_category: { primary: 'GENERAL_MERCHANDISE' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: 'Walmart Supercenter — Atlanta Hwy', amount:  76.33, date: d(21), category: ['Shops', 'Department Stores'], personal_finance_category: { primary: 'GENERAL_MERCHANDISE' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: 'Target — Atlanta Hwy',          amount:   64.50, date: d(4),  category: ['Shops', 'Department Stores'], personal_finance_category: { primary: 'GENERAL_MERCHANDISE' }, pending: false },

    // ── Transportation ────────────────────────────────────────────────────
    { transaction_id: tid(), account_id: CREDIT,   name: 'Shell — Commerce Rd',           amount:   48.32, date: d(72), category: ['Travel', 'Gas Stations'], personal_finance_category: { primary: 'TRANSPORTATION' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: 'Shell — Commerce Rd',           amount:   51.18, date: d(41), category: ['Travel', 'Gas Stations'], personal_finance_category: { primary: 'TRANSPORTATION' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: 'Uber',                          amount:   14.50, date: d(14), category: ['Travel', 'Taxi'], personal_finance_category: { primary: 'TRANSPORTATION' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: 'Shell — Commerce Rd',           amount:   45.67, date: d(12), category: ['Travel', 'Gas Stations'], personal_finance_category: { primary: 'TRANSPORTATION' }, pending: false },
    { transaction_id: tid(), account_id: CREDIT,   name: 'Uber',                          amount:   22.00, date: d(8),  category: ['Travel', 'Taxi'], personal_finance_category: { primary: 'TRANSPORTATION' }, pending: false },

    // ── Entertainment ─────────────────────────────────────────────────────
    { transaction_id: tid(), account_id: CREDIT,   name: 'Creature Comforts Brewing',     amount:   28.50, date: d(8),  category: ['Food and Drink', 'Bar'], personal_finance_category: { primary: 'ENTERTAINMENT' }, pending: false },

    // ── Credit card payment ───────────────────────────────────────────────
    { transaction_id: tid(), account_id: CHECKING, name: 'Capital One Payment',           amount: -550.00, date: d(60), category: ['Transfer', 'Credit Card'], personal_finance_category: { primary: 'LOAN_PAYMENTS' }, pending: false },
    { transaction_id: tid(), account_id: CHECKING, name: 'Capital One Payment',           amount: -600.00, date: d(30), category: ['Transfer', 'Credit Card'], personal_finance_category: { primary: 'LOAN_PAYMENTS' }, pending: false },
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  // ── Securities ────────────────────────────────────────────────────────────
  const securities = [
    { security_id: 'demo_sec_aapl',  name: 'Apple Inc',                          ticker_symbol: 'AAPL',  type: 'equity', close_price: 189.50, iso_currency_code: 'USD' },
    { security_id: 'demo_sec_vti',   name: 'Vanguard Total Stock Market ETF',    ticker_symbol: 'VTI',   type: 'etf',    close_price: 243.20, iso_currency_code: 'USD' },
    { security_id: 'demo_sec_spy',   name: 'SPDR S&P 500 ETF Trust',             ticker_symbol: 'SPY',   type: 'etf',    close_price: 557.00, iso_currency_code: 'USD' },
    { security_id: 'demo_sec_schd',  name: 'Schwab US Dividend Equity ETF',      ticker_symbol: 'SCHD',  type: 'etf',    close_price: 79.00,  iso_currency_code: 'USD' },
  ];

  // ── Holdings ──────────────────────────────────────────────────────────────
  const holdings = [
    { account_id: BROKERAGE, security_id: 'demo_sec_aapl',  quantity:  5, institution_value:  947.50, institution_price: 189.50, cost_basis:  820.00, security: securities.find(s => s.security_id === 'demo_sec_aapl')  },
    { account_id: BROKERAGE, security_id: 'demo_sec_vti',   quantity: 12, institution_value: 2918.40, institution_price: 243.20, cost_basis: 2640.00, security: securities.find(s => s.security_id === 'demo_sec_vti')   },
    { account_id: BROKERAGE, security_id: 'demo_sec_spy',   quantity:  4, institution_value: 2228.00, institution_price: 557.00, cost_basis: 2040.00, security: securities.find(s => s.security_id === 'demo_sec_spy')   },
    { account_id: BROKERAGE, security_id: 'demo_sec_schd',  quantity: 22, institution_value: 1738.00, institution_price:  79.00, cost_basis: 1540.00, security: securities.find(s => s.security_id === 'demo_sec_schd')  },
  ];

  return { accounts, transactions, holdings, securities };
}

module.exports = getDummyData;
