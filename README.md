# PLANEZ — Global Aviation Domination

A modern turn-based airline management strategy game inspired by the classics. Build your aviation empire across 58 real-world cities, manage fleets of historically accurate aircraft, and outmaneuver up to 3 opponents.

**Play now:** https://rickatrite.github.io/Planez/

---

## Features

- **4 playable eras** spanning 1963–2020 (Jet Age, Deregulation, Global Expansion, Modern Challenges)
- **58 cities** across 7 regions with real coordinates, economics, and tourism ratings
- **35+ aircraft types** from the Boeing 707 to the A380, with accurate specs
- **Full economic simulation** — route demand, fare pricing, seasonal effects, market share
- **4 AI personality types** — Aggressive, Conservative, Regional, Global
- **Random events** — oil crises, Olympics, recessions, airport strikes, and more
- **Local multiplayer** — up to 4 players, same screen, hot-seat turns
- **Online multiplayer** — share a 6-character game code, play asynchronously with friends
- **In-game chat** — per-game message board for online matches
- **Turn recaps** — see exactly what your opponents did each quarter

---

## Quick Start (Local Play)

Local play works immediately — no server or account needed.

### Option 1: Play online
Visit https://rickatrite.github.io/Planez/

### Option 2: Run locally
```bash
git clone https://github.com/RickatRITE/Planez.git
cd Planez
npm install
npm run dev
```
Then open http://localhost:5173 in your browser.

Or just double-click **run.bat** on Windows.

---

## Setting Up Online Multiplayer

Online multiplayer uses [Supabase](https://supabase.com) (free tier) as the backend. Follow these steps once to enable it.

### Step 1: Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up (free)
2. Click **New Project**
3. Give it a name (e.g., "planez"), set a database password, choose a region close to you
4. Wait ~30 seconds for the project to provision

### Step 2: Create the database tables

1. In your Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **New Query**
3. Copy the entire contents of [`src/multiplayer/supabaseSchema.sql`](src/multiplayer/supabaseSchema.sql) and paste it into the editor
4. Click **Run** — you should see "Success. No rows returned" for each statement
5. Verify by going to **Table Editor** — you should see 4 tables: `games`, `players`, `chat_messages`, `turn_recaps`

### Step 3: Enable Realtime (for live chat)

1. In your Supabase dashboard, go to **Database → Replication** (or **Realtime** in newer UI)
2. Enable realtime for these tables:
   - `chat_messages`
   - `games`
   - `players`

### Step 4: Get your API keys

1. Go to **Settings → API** (in the Supabase dashboard)
2. Copy these two values:
   - **Project URL** — looks like `https://abcdefg.supabase.co`
   - **anon / public key** — a long string starting with `eyJ...`

### Step 5: Configure the app

#### For local development:
Create a `.env` file in the project root:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...your-key-here
```

#### For GitHub Pages deployment:
1. Go to your GitHub repo → **Settings → Secrets and variables → Actions**
2. Add two **Repository secrets**:
   - Name: `VITE_SUPABASE_URL` — Value: your Project URL
   - Name: `VITE_SUPABASE_ANON_KEY` — Value: your anon key
3. Go to **Actions** and re-run the **Deploy to GitHub Pages** workflow

### Step 6: Play!

1. Open the game and click **Online Multiplayer**
2. Create a game — you'll get a 6-character code (e.g., `A3X7K2`)
3. Text the code to your friends
4. They click **Online Multiplayer → Join Game** and enter the code
5. Once everyone's ready, the host starts the game

---

## How to Play

### Game Flow
1. **Choose an era** — each era has different aircraft available and world events
2. **Pick your hub city** — this is your airline's home base (New York, London, Tokyo, etc.)
3. **Each turn = 1 quarter** — you get a limited number of actions per turn:
   - Open new routes between cities
   - Purchase or lease aircraft
   - Adjust fares (Budget to Premium)
   - Set flight frequency
   - Take or repay loans
   - Set advertising budget
4. **End your turn** — AI opponents take their turns, then the quarter simulates
5. **Review results** — revenue, costs, profit, passengers carried
6. **Repeat** — grow your network, respond to events, outcompete rivals

### Winning
The game ends after the set number of years. The winner has the highest composite score based on:
- Cities connected
- Passengers carried
- Annual profit
- Net worth
- Service quality
- Market share

### Tips
- Start with short/medium routes — they're cheaper and fill up faster
- Match aircraft to route distance — don't put a 747 on a 500km hop
- Watch fuel prices — oil spikes can destroy your margins
- New routes take 4 quarters to reach full demand — be patient
- Keep some cash reserve — opportunities (and crises) come up randomly

---

## Project Structure

```
src/
├── types.ts                    Core TypeScript interfaces
├── data/
│   ├── cities.ts               58 world cities with real coordinates
│   ├── aircraft.ts             35+ historical aircraft (1963-2012)
│   └── events.ts               40+ game events
├── engine/
│   ├── simulation.ts           Quarterly economic simulation
│   └── ai.ts                   AI opponent decision engine
├── store/
│   └── gameStore.ts            Zustand state management
├── multiplayer/
│   ├── supabaseClient.ts       Supabase connection
│   ├── supabaseSchema.sql      Database schema (run in Supabase)
│   └── multiplayerService.ts   Online multiplayer API layer
├── utils/
│   └── helpers.ts              Math, formatting, projections
├── components/
│   ├── map/WorldMap.tsx         Interactive SVG world map
│   ├── panels/                 Route, Fleet, Finance, Competitor panels
│   └── screens/                Title, Setup, Lobby, Game, Chat screens
└── App.tsx                     Root app with screen routing
```

---

## Tech Stack

- **React 18** + **TypeScript** — UI framework
- **Tailwind CSS** — styling
- **Framer Motion** — animations
- **D3.js** — map projections and data visualization
- **Zustand** — state management
- **Supabase** — online multiplayer backend (optional, free tier)
- **Vite** — build tooling
- **GitHub Pages** — hosting (free)

---

## License

This is a fan project for personal/educational use. Not affiliated with Koei Tecmo or the Aerobiz franchise.
