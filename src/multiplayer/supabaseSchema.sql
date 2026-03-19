-- Run this in your Supabase SQL Editor (supabase.com -> your project -> SQL Editor)

-- ============================================================================
-- TABLES
-- ============================================================================

CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(8) UNIQUE NOT NULL,
  name VARCHAR(100),
  era SMALLINT NOT NULL,
  difficulty VARCHAR(20) NOT NULL,
  game_length INT NOT NULL,
  state JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'waiting',
  current_turn INT DEFAULT 0,
  host_player_token UUID NOT NULL,
  max_players SMALLINT DEFAULT 4,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  player_token UUID NOT NULL,
  seat_index SMALLINT NOT NULL,
  airline_name VARCHAR(100),
  is_ready BOOLEAN DEFAULT false,
  has_submitted_turn BOOLEAN DEFAULT false,
  turn_actions JSONB,
  last_seen TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (game_id, seat_index),
  UNIQUE (game_id, player_token)
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  player_token UUID NOT NULL,
  sender_name VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE turn_recaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  turn_number INT NOT NULL,
  seat_index SMALLINT NOT NULL,
  actions JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (game_id, turn_number, seat_index)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_games_code ON games(code);
CREATE INDEX idx_players_game_id ON players(game_id);
CREATE INDEX idx_chat_messages_game_id ON chat_messages(game_id);
CREATE INDEX idx_turn_recaps_game_id_turn ON turn_recaps(game_id, turn_number);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Since we use anon key without Supabase Auth, we create permissive policies
-- that allow all operations. Security relies on needing the game code to find
-- a game, and player_token validation is handled in application logic.

ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE turn_recaps ENABLE ROW LEVEL SECURITY;

-- Games: allow all operations
CREATE POLICY "Allow all access to games" ON games
  FOR ALL USING (true) WITH CHECK (true);

-- Players: allow all operations
CREATE POLICY "Allow all access to players" ON players
  FOR ALL USING (true) WITH CHECK (true);

-- Chat messages: allow all operations
CREATE POLICY "Allow all access to chat_messages" ON chat_messages
  FOR ALL USING (true) WITH CHECK (true);

-- Turn recaps: allow all operations
CREATE POLICY "Allow all access to turn_recaps" ON turn_recaps
  FOR ALL USING (true) WITH CHECK (true);
