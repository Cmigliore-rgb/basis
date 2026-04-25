# Ledger

A personal finance dashboard built with React and Node.js. Connects to real bank accounts and investment brokerages to give a unified view of your financial life.

## Features

- **Banking** — Live account balances and transaction history via Plaid and Teller
- **Investments** — Portfolio holdings, P&L, and a live options chain with Black-Scholes Greeks
- **Budgeting** — Month-to-date spending by category with custom limits
- **Trends** — Spending over time with category breakdowns
- **Subscriptions** — Auto-detected recurring charges
- **Goals** — Savings goal tracker linked to real account balances
- **News Feed** — Market news from WSJ, Bloomberg, and Yahoo Finance
- **Market Overview** — S&P 500 chart, Fear & Greed Index, live tickers (indices + most active stocks)
- **AI Assistant** — Chat with your financial data powered by Groq
- **Learn** — Interactive financial education covering markets, options Greeks, and personal finance

## Tech Stack

- **Frontend**: React 18, Vite
- **Backend**: Node.js, Express
- **Data**: Plaid API, Teller API, Yahoo Finance, CNN Fear & Greed
- **AI**: Groq (LLaMA 3)

## Setup

### Prerequisites

- Node.js 18+
- A [Plaid](https://plaid.com) account (free sandbox available)
- A [Teller](https://teller.io) account + mTLS certificate
- A [Groq](https://console.groq.com) API key (free)

### Installation

```bash
# Install all dependencies
npm install
cd backend && npm install
cd ../frontend && npm install
```

### Configuration

Copy `backend/.env.example` to `backend/.env` and fill in your credentials:

```bash
cp backend/.env.example backend/.env
```

For Teller, download your `certificate.pem` and `private_key.pem` from the Teller dashboard and place them in `backend/`.

### Running

```bash
# From the root — starts both backend and frontend concurrently
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## License

MIT
