import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { GameState, Era } from '../types';

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

export interface TurnAction {
  type:
    | 'open_route'
    | 'close_route'
    | 'adjust_fare'
    | 'adjust_frequency'
    | 'purchase_aircraft'
    | 'sell_aircraft'
    | 'lease_aircraft'
    | 'assign_aircraft'
    | 'take_loan'
    | 'repay_loan'
    | 'set_advertising';
  params: Record<string, any>;
}

export interface GameInfo {
  id: string;
  code: string;
  name: string;
  era: Era;
  difficulty: string;
  gameLength: number;
  status: string;
  maxPlayers: number;
  players: PlayerInfo[];
}

export interface PlayerInfo {
  seatIndex: number;
  airlineName: string;
  isReady: boolean;
  hasSubmittedTurn: boolean;
  isHost: boolean;
  lastSeen: string;
}

export interface ChatMessage {
  id: string;
  senderName: string;
  message: string;
  createdAt: string;
}

export interface RecapEntry {
  seatIndex: number;
  airlineName: string;
  actions: TurnAction[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureSupabase(): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.',
    );
  }
}

function getOrCreatePlayerToken(): string {
  let token = localStorage.getItem('planez_player_token');
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem('planez_player_token', token);
  }
  return token;
}

function generateGameCode(): string {
  // 6 character alphanumeric, uppercase, no ambiguous chars (0/O, 1/I/L)
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)],
  ).join('');
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

export async function createOnlineGame(config: {
  name: string;
  era: number;
  difficulty: string;
  gameLength: number;
  hostAirlineName: string;
  hostColor: string;
  hostHubCityId: string;
}): Promise<{ gameCode: string; gameId: string }> {
  ensureSupabase();

  const gameCode = generateGameCode();
  const playerToken = getOrCreatePlayerToken();

  const initialState: Partial<GameState> = {
    era: config.era as Era,
    difficulty: config.difficulty as any,
    gameLength: config.gameLength,
  };

  const { data: game, error: gameError } = await supabase
    .from('games')
    .insert({
      code: gameCode,
      name: config.name,
      status: 'waiting',
      game_state: initialState,
      host_player_token: playerToken,
      era: config.era,
      difficulty: config.difficulty,
      game_length: config.gameLength,
    })
    .select('id')
    .single();

  if (gameError || !game) {
    throw new Error(`Failed to create game: ${gameError?.message ?? 'unknown error'}`);
  }

  const { error: playerError } = await supabase.from('players').insert({
    game_id: game.id,
    seat_index: 0,
    airline_name: config.hostAirlineName,
    color: config.hostColor,
    hub_city_id: config.hostHubCityId,
    player_token: playerToken,
    is_ready: false,
    has_submitted_turn: false,
    is_host: true,
  });

  if (playerError) {
    throw new Error(`Failed to add host player: ${playerError.message}`);
  }

  return { gameCode, gameId: game.id };
}

export async function joinOnlineGame(
  gameCode: string,
  airlineName: string,
  color: string,
  hubCityId: string,
): Promise<{ gameId: string; seatIndex: number }> {
  ensureSupabase();

  const playerToken = getOrCreatePlayerToken();

  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('id, status')
    .eq('code', gameCode.toUpperCase())
    .single();

  if (gameError || !game) {
    throw new Error('Game not found. Check the game code and try again.');
  }

  if (game.status !== 'waiting') {
    throw new Error('This game is no longer accepting new players.');
  }

  const { data: existingPlayers, error: countError } = await supabase
    .from('players')
    .select('seat_index')
    .eq('game_id', game.id)
    .order('seat_index', { ascending: true });

  if (countError) {
    throw new Error(`Failed to check players: ${countError.message}`);
  }

  if (existingPlayers && existingPlayers.length >= 4) {
    throw new Error('This game is full (maximum 4 players).');
  }

  const takenSeats = new Set(existingPlayers?.map((p) => p.seat_index) ?? []);
  let nextSeat = 0;
  while (takenSeats.has(nextSeat)) {
    nextSeat++;
  }

  const { error: insertError } = await supabase.from('players').insert({
    game_id: game.id,
    seat_index: nextSeat,
    airline_name: airlineName,
    color,
    hub_city_id: hubCityId,
    player_token: playerToken,
    is_ready: false,
    has_submitted_turn: false,
    is_host: false,
  });

  if (insertError) {
    throw new Error(`Failed to join game: ${insertError.message}`);
  }

  return { gameId: game.id, seatIndex: nextSeat };
}

export async function getGameByCode(code: string): Promise<GameInfo | null> {
  ensureSupabase();

  const { data: game, error } = await supabase
    .from('games')
    .select('id, code, name, era, difficulty, game_length, status')
    .eq('code', code.toUpperCase())
    .single();

  if (error || !game) {
    return null;
  }

  const players = await getGamePlayers(game.id);

  return {
    id: game.id,
    code: game.code,
    name: game.name,
    era: game.era as Era,
    difficulty: game.difficulty,
    gameLength: game.game_length,
    status: game.status,
    maxPlayers: 4,
    players,
  };
}

export async function getGamePlayers(gameId: string): Promise<PlayerInfo[]> {
  ensureSupabase();

  const { data: players, error } = await supabase
    .from('players')
    .select('seat_index, airline_name, is_ready, has_submitted_turn, is_host, last_seen')
    .eq('game_id', gameId)
    .order('seat_index', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch players: ${error.message}`);
  }

  return (players ?? []).map((p) => ({
    seatIndex: p.seat_index,
    airlineName: p.airline_name,
    isReady: p.is_ready,
    hasSubmittedTurn: p.has_submitted_turn,
    isHost: p.is_host,
    lastSeen: p.last_seen,
  }));
}

export async function setPlayerReady(gameId: string): Promise<void> {
  ensureSupabase();

  const playerToken = getOrCreatePlayerToken();

  const { error } = await supabase
    .from('players')
    .update({ is_ready: true })
    .eq('game_id', gameId)
    .eq('player_token', playerToken);

  if (error) {
    throw new Error(`Failed to set ready status: ${error.message}`);
  }
}

export async function startOnlineGame(
  gameId: string,
  initialState: GameState,
): Promise<void> {
  ensureSupabase();

  const playerToken = getOrCreatePlayerToken();

  // Verify the caller is the host
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('host_player_token')
    .eq('id', gameId)
    .single();

  if (gameError || !game) {
    throw new Error('Game not found.');
  }

  if (game.host_player_token !== playerToken) {
    throw new Error('Only the host can start the game.');
  }

  const { error } = await supabase
    .from('games')
    .update({
      status: 'in_progress',
      game_state: initialState,
    })
    .eq('id', gameId);

  if (error) {
    throw new Error(`Failed to start game: ${error.message}`);
  }
}

export async function submitTurn(
  gameId: string,
  actions: TurnAction[],
): Promise<void> {
  ensureSupabase();

  const playerToken = getOrCreatePlayerToken();

  // Get current player info
  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('id, seat_index, airline_name')
    .eq('game_id', gameId)
    .eq('player_token', playerToken)
    .single();

  if (playerError || !player) {
    throw new Error('Player not found in this game.');
  }

  // Save turn actions and mark as submitted
  const { error: updateError } = await supabase
    .from('players')
    .update({
      turn_actions: actions,
      has_submitted_turn: true,
    })
    .eq('id', player.id);

  if (updateError) {
    throw new Error(`Failed to submit turn: ${updateError.message}`);
  }

  // Get current game state and turn number
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('game_state, current_turn')
    .eq('id', gameId)
    .single();

  if (gameError || !game) {
    throw new Error('Failed to load game state.');
  }

  // Insert into turn_recaps
  const { error: recapError } = await supabase.from('turn_recaps').insert({
    game_id: gameId,
    turn_number: game.current_turn ?? 1,
    seat_index: player.seat_index,
    airline_name: player.airline_name,
    actions,
  });

  if (recapError) {
    throw new Error(`Failed to save turn recap: ${recapError.message}`);
  }

  // Check if ALL human players have submitted
  const { data: allPlayers, error: allPlayersError } = await supabase
    .from('players')
    .select('has_submitted_turn')
    .eq('game_id', gameId);

  if (allPlayersError || !allPlayers) {
    throw new Error('Failed to check player submissions.');
  }

  const allSubmitted = allPlayers.every((p) => p.has_submitted_turn);

  if (allSubmitted) {
    // Gather all turn actions
    const { data: _playersWithActions, error: actionsError } = await supabase
      .from('players')
      .select('seat_index, turn_actions')
      .eq('game_id', gameId)
      .order('seat_index', { ascending: true });

    if (actionsError) {
      throw new Error(`Failed to gather turn actions: ${actionsError.message}`);
    }

    // Apply all actions to game state
    // NOTE: In a production setup this would be done server-side via an Edge Function.
    // For now the last submitter triggers the advance.
    const currentState: GameState = game.game_state as GameState;
    const nextTurn = (game.current_turn ?? 1) + 1;

    // TODO: Apply each player's actions to currentState and run simulation
    // This is a placeholder — the actual game logic should be applied here.

    const { error: advanceError } = await supabase
      .from('games')
      .update({
        game_state: currentState,
        current_turn: nextTurn,
      })
      .eq('id', gameId);

    if (advanceError) {
      throw new Error(`Failed to advance turn: ${advanceError.message}`);
    }

    // Reset has_submitted_turn for all players
    const { error: resetError } = await supabase
      .from('players')
      .update({
        has_submitted_turn: false,
        turn_actions: null,
      })
      .eq('game_id', gameId);

    if (resetError) {
      throw new Error(`Failed to reset turn submissions: ${resetError.message}`);
    }
  }
}

export async function loadGameState(gameId: string): Promise<GameState> {
  ensureSupabase();

  const { data: game, error } = await supabase
    .from('games')
    .select('game_state')
    .eq('id', gameId)
    .single();

  if (error || !game) {
    throw new Error('Failed to load game state.');
  }

  return game.game_state as GameState;
}

export async function getTurnRecaps(
  gameId: string,
  turnNumber: number,
): Promise<RecapEntry[]> {
  ensureSupabase();

  const { data: recaps, error } = await supabase
    .from('turn_recaps')
    .select('seat_index, airline_name, actions')
    .eq('game_id', gameId)
    .eq('turn_number', turnNumber)
    .order('seat_index', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch turn recaps: ${error.message}`);
  }

  return (recaps ?? []).map((r) => ({
    seatIndex: r.seat_index,
    airlineName: r.airline_name,
    actions: r.actions as TurnAction[],
  }));
}

export async function sendChatMessage(
  gameId: string,
  message: string,
): Promise<void> {
  ensureSupabase();

  const playerToken = getOrCreatePlayerToken();

  // Look up the player's airline name
  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('airline_name')
    .eq('game_id', gameId)
    .eq('player_token', playerToken)
    .single();

  if (playerError || !player) {
    throw new Error('Player not found in this game.');
  }

  const { error } = await supabase.from('chat_messages').insert({
    game_id: gameId,
    sender_name: player.airline_name,
    message,
    player_token: playerToken,
  });

  if (error) {
    throw new Error(`Failed to send chat message: ${error.message}`);
  }
}

export async function getChatMessages(gameId: string): Promise<ChatMessage[]> {
  ensureSupabase();

  const { data: messages, error } = await supabase
    .from('chat_messages')
    .select('id, sender_name, message, created_at')
    .eq('game_id', gameId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch chat messages: ${error.message}`);
  }

  return (messages ?? []).map((m) => ({
    id: m.id,
    senderName: m.sender_name,
    message: m.message,
    createdAt: m.created_at,
  }));
}

export function subscribeToChatMessages(
  gameId: string,
  callback: (msg: ChatMessage) => void,
): () => void {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase is not configured. Chat subscription disabled.');
    return () => {};
  }

  const channel = supabase
    .channel(`chat:${gameId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `game_id=eq.${gameId}`,
      },
      (payload) => {
        const row = payload.new as any;
        callback({
          id: row.id,
          senderName: row.sender_name,
          message: row.message,
          createdAt: row.created_at,
        });
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToGameUpdates(
  gameId: string,
  callback: (game: any) => void,
): () => void {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase is not configured. Game subscription disabled.');
    return () => {};
  }

  const channel = supabase
    .channel(`game:${gameId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameId}`,
      },
      (payload) => {
        callback(payload.new);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToPlayerUpdates(
  gameId: string,
  callback: (players: any[]) => void,
): () => void {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase is not configured. Player subscription disabled.');
    return () => {};
  }

  const channel = supabase
    .channel(`players:${gameId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'players',
        filter: `game_id=eq.${gameId}`,
      },
      async () => {
        // Re-fetch all players on any change to return the full list
        try {
          const players = await getGamePlayers(gameId);
          callback(players);
        } catch {
          // Silently ignore fetch errors in subscription callbacks
        }
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
