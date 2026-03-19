// ============================================================
// PLANEZ REMAKE — CORE TYPE DEFINITIONS
// ============================================================

// --- Enums & Literals ---

export type Era = 1 | 2 | 3 | 4;
export type Quarter = 1 | 2 | 3 | 4;
export type Difficulty = 'easy' | 'normal' | 'hard' | 'ruthless';
export type AiPersonality = 'aggressive' | 'conservative' | 'regional' | 'global';
export type FareLevel = 1 | 2 | 3 | 4 | 5; // 1=budget, 5=premium
export type GamePhase = 'setup' | 'news' | 'planning' | 'execution' | 'results';
export type PlayerType = 'human' | 'cpu';
export type Region = 'north_america' | 'south_america' | 'europe' | 'africa' | 'middle_east' | 'asia' | 'oceania';
export type EventCategory = 'economic' | 'industry' | 'world' | 'company';
export type Screen = 'title' | 'setup' | 'lobby' | 'game' | 'results';
export type GamePanel = 'map' | 'routes' | 'fleet' | 'finance' | 'competitors' | 'news';

// --- City ---

export interface City {
  id: string;
  name: string;
  country: string;
  region: Region;
  lat: number;
  lng: number;
  population: number;        // millions
  economicRating: number;    // 1-10
  tourismRating: number;     // 1-10
  airportSlots: number;      // total available
  growthRate: number;        // annual % population growth
  hubCity: boolean;          // can be selected as starting hub
}

// --- Aircraft ---

export interface AircraftType {
  id: string;
  name: string;
  manufacturer: string;
  capacity: { economy: number; business: number; first: number };
  range: number;             // km
  speed: number;             // km/h
  purchasePrice: number;     // millions $
  operatingCostPerHour: number; // thousands $
  maintenanceCostPerQuarter: number; // thousands $
  fuelEfficiency: number;    // 1-10 (10 = most efficient)
  reliability: number;       // 1-10
  noiseRating: number;       // 1-10 (10 = quietest)
  introYear: number;
  retireYear: number;
  imageKey: string;
}

// --- Player / Airline ---

export interface Airline {
  id: number;                // 0-3
  name: string;
  color: string;             // hex
  hubCityId: string;
  playerType: PlayerType;
  aiPersonality?: AiPersonality;
  cash: number;              // millions $
  loans: number;
  reputation: number;        // 0-100
  serviceRating: number;     // 1-5
  advertisingBudget: number; // millions $ per quarter
  actionsRemaining: number;
  actionsPerTurn: number;
  eliminated: boolean;
  eliminatedQuarter?: number;
  bankruptcyQuarters: number; // consecutive quarters with negative net worth
}

// --- Fleet ---

export interface OwnedAircraft {
  id: string;                // unique instance id
  typeId: string;            // references AircraftType.id
  airlineId: number;
  purchaseYear: number;
  purchaseQuarter: Quarter;
  assignedRouteId: string | null;
  isLeased: boolean;
  leaseQuarterlyCost: number;
  condition: number;         // 0-100
  quartersSinceHeavyMaintenance: number;
}

// --- Route ---

export interface Route {
  id: string;
  airlineId: number;
  originCityId: string;
  destinationCityId: string;
  distance: number;          // km
  flightTimeHours: number;
  assignedAircraftId: string | null;
  weeklyFrequency: number;   // flights per week
  fareEconomy: FareLevel;
  fareBusiness: FareLevel;
  fareFirst: FareLevel;
  hasFirstClass: boolean;
  hasBusinessClass: boolean;
  loadFactor: number;        // 0-1
  marketShare: number;       // 0-1
  quarterlyRevenue: number;
  quarterlyCost: number;
  suspended: boolean;
  maturityQuarters: number;  // 0-4, how long the route has been open
  passengersDemand: number;  // per quarter
  passengersCarried: number; // per quarter
}

// --- Slot Allocation ---

export interface SlotAllocation {
  cityId: string;
  airlineId: number;
  slots: number;
}

// --- Events ---

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  effect: EventEffect;
  targetRegion?: Region;
  targetCityId?: string;
  targetAirlineId?: number;
  duration: number;          // quarters
  remainingQuarters: number;
  era?: Era;
  minYear?: number;
  maxYear?: number;
  probability: number;       // 0-1 chance per quarter
  oneTime: boolean;
  triggered: boolean;
}

export interface EventEffect {
  demandMultiplier?: number;        // global or regional
  fuelCostMultiplier?: number;
  maintenanceCostMultiplier?: number;
  reputationChange?: number;
  cashChange?: number;              // millions
  slotsChange?: number;             // for target city
  cityAvailable?: boolean;          // false = city closed
}

// --- Financial Snapshot ---

export interface FinancialReport {
  year: number;
  quarter: Quarter;
  airlineId: number;
  revenue: number;
  fuelCosts: number;
  crewCosts: number;
  maintenanceCosts: number;
  airportFees: number;
  leaseCosts: number;
  loanInterest: number;
  advertisingCosts: number;
  adminCosts: number;
  totalCosts: number;
  profit: number;
  cash: number;
  assets: number;
  liabilities: number;
  netWorth: number;
  stockPrice: number;
  passengersCarried: number;
  routeCount: number;
  fleetSize: number;
}

// --- Game State ---

export interface GameState {
  // Setup
  era: Era;
  difficulty: Difficulty;
  gameLength: number;        // years
  startYear: number;

  // Time
  currentYear: number;
  currentQuarter: Quarter;
  phase: GamePhase;
  turnNumber: number;

  // Entities
  airlines: Airline[];
  routes: Route[];
  ownedAircraft: OwnedAircraft[];
  slotAllocations: SlotAllocation[];

  // Events
  activeEvents: GameEvent[];
  eventLog: { year: number; quarter: Quarter; event: GameEvent }[];

  // History
  financialHistory: FinancialReport[];

  // Pending orders
  aircraftOrders: AircraftOrder[];

  // UI state
  currentScreen: Screen;
  activePanel: GamePanel;
  selectedCityId: string | null;
  selectedRouteId: string | null;
  selectedAircraftId: string | null;
  currentPlayerIndex: number;
  showNews: boolean;
  newsQueue: GameEvent[];
}

export interface AircraftOrder {
  id: string;
  airlineId: number;
  aircraftTypeId: string;
  deliveryQuartersRemaining: number;
  isLease: boolean;
  cost: number;
}

// --- Scoring ---

export interface AirlineScore {
  airlineId: number;
  citiesConnected: number;
  annualPassengers: number;
  annualProfit: number;
  netWorth: number;
  serviceRating: number;
  totalMarketShare: number;
  compositeScore: number;
}
