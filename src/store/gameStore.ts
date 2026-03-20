import { create } from 'zustand';
import type {
  GameState,
  Era,
  Difficulty,
  Airline,
  Route,
  OwnedAircraft,
  AircraftOrder,
  FareLevel,
  GamePanel,
  Screen,
  Quarter,
  PlayerType,
  AiPersonality,
  GameEvent,
  SlotAllocation,
} from '../types';
import { citiesById } from '../data/cities';
import { aircraftTypesById } from '../data/aircraft';
import { getEventsForEra } from '../data/events';
import { simulateQuarter } from '../engine/simulation';
import { executeAiTurn } from '../engine/ai';
import { generateId, greatCircleDistance, flightTime } from '../utils/helpers';

// ============================================================
// Store Interface
// ============================================================

interface GameStore extends GameState {
  // Setup
  startNewGame: (
    era: Era,
    difficulty: Difficulty,
    gameLength: number,
    players: Array<{
      name: string;
      color: string;
      hubCityId: string;
      playerType: PlayerType;
      aiPersonality?: AiPersonality;
    }>
  ) => void;

  // Game flow
  dismissNews: () => void;
  endTurn: () => void;
  nextTurn: () => void;

  // Route actions
  openRoute: (originCityId: string, destCityId: string) => void;
  closeRoute: (routeId: string) => void;
  adjustFare: (routeId: string, fareClass: 'economy' | 'business' | 'first', level: FareLevel) => void;
  adjustFrequency: (routeId: string, newFrequency: number) => void;
  suspendRoute: (routeId: string) => void;
  resumeRoute: (routeId: string) => void;
  assignAircraft: (routeId: string, aircraftId: string) => void;

  // Fleet actions
  purchaseAircraft: (typeId: string) => void;
  sellAircraft: (aircraftId: string) => void;
  leaseAircraft: (typeId: string) => void;
  returnLeasedAircraft: (aircraftId: string) => void;

  // Finance actions
  takeLoan: (amount: number) => void;
  repayLoan: (amount: number) => void;
  setAdvertisingBudget: (amount: number) => void;

  // UI actions
  setActivePanel: (panel: GamePanel) => void;
  selectCity: (cityId: string | null) => void;
  selectRoute: (routeId: string | null) => void;
  selectAircraft: (aircraftId: string | null) => void;
  setScreen: (screen: Screen) => void;

  // Getters
  getCurrentAirline: () => Airline;
  getAirlineRoutes: (airlineId: number) => Route[];
  getAirlineAircraft: (airlineId: number) => OwnedAircraft[];
  getAvailableAircraft: (airlineId: number) => OwnedAircraft[];
  getCitySlots: (cityId: string) => SlotAllocation[];
  getCompetitorsOnRoute: (originId: string, destId: string) => Route[];
}

// ============================================================
// Era start years
// ============================================================

const ERA_START_YEARS: Record<Era, number> = {
  1: 1963,
  2: 1975,
  3: 1987,
  4: 2000,
};

// ============================================================
// Default state
// ============================================================

const defaultState: GameState = {
  era: 1,
  difficulty: 'normal',
  gameLength: 20,
  startYear: 1963,
  currentYear: 1963,
  currentQuarter: 1,
  phase: 'setup',
  turnNumber: 0,
  airlines: [],
  routes: [],
  ownedAircraft: [],
  slotAllocations: [],
  activeEvents: [],
  eventLog: [],
  financialHistory: [],
  aircraftOrders: [],
  currentScreen: 'title',
  activePanel: 'map',
  selectedCityId: null,
  selectedRouteId: null,
  selectedAircraftId: null,
  currentPlayerIndex: 0,
  showNews: false,
  newsQueue: [],
};

// ============================================================
// Store
// ============================================================

export const useGameStore = create<GameStore>()((set, get) => ({
  ...defaultState,

  // ----------------------------------------------------------
  // SETUP
  // ----------------------------------------------------------

  startNewGame: (era, difficulty, gameLength, players) => {
    const startYear = ERA_START_YEARS[era];

    const airlines: Airline[] = players.map((p, index) => ({
      id: index,
      name: p.name,
      color: p.color,
      hubCityId: p.hubCityId,
      playerType: p.playerType,
      aiPersonality: p.aiPersonality,
      cash: 200,
      loans: 0,
      reputation: 50,
      serviceRating: 3,
      advertisingBudget: 0,
      actionsRemaining: 5,
      actionsPerTurn: 5,
      eliminated: false,
      bankruptcyQuarters: 0,
    }));

    // Each airline gets 10 slots at their hub city
    const slotAllocations: SlotAllocation[] = players.map((p, index) => ({
      cityId: p.hubCityId,
      airlineId: index,
      slots: 10,
    }));

    // Generate initial events for the era
    const eraEvents = getEventsForEra(era);
    const initialEvents: GameEvent[] = [];
    const newsQueue: GameEvent[] = [];

    for (const event of eraEvents) {
      if (Math.random() < event.probability) {
        const triggered: GameEvent = { ...event, triggered: true, remainingQuarters: event.duration };
        initialEvents.push(triggered);
        newsQueue.push(triggered);
      }
    }

    set({
      era,
      difficulty,
      gameLength,
      startYear,
      currentYear: startYear,
      currentQuarter: 1,
      phase: 'news',
      turnNumber: 1,
      airlines,
      routes: [],
      ownedAircraft: [],
      slotAllocations,
      activeEvents: initialEvents,
      eventLog: initialEvents.map((e) => ({ year: startYear, quarter: 1 as Quarter, event: e })),
      financialHistory: [],
      aircraftOrders: [],
      currentScreen: 'game',
      activePanel: 'map',
      selectedCityId: null,
      selectedRouteId: null,
      selectedAircraftId: null,
      currentPlayerIndex: 0,
      showNews: newsQueue.length > 0,
      newsQueue,
    });
  },

  // ----------------------------------------------------------
  // GAME FLOW
  // ----------------------------------------------------------

  dismissNews: () => {
    set({ phase: 'planning', showNews: false, newsQueue: [] });
  },

  endTurn: () => {
    const state = get();

    // Check if there's another human player who still needs to take their turn this quarter
    const nextHumanIndex = state.airlines.findIndex(
      (a, i) => i > state.currentPlayerIndex && a.playerType === 'human' && !a.eliminated
    );

    if (nextHumanIndex !== -1) {
      // Advance to the next human player's turn
      set({
        currentPlayerIndex: nextHumanIndex,
        activePanel: 'map',
        selectedCityId: null,
        selectedRouteId: null,
        selectedAircraftId: null,
      });
      return;
    }

    // All human players have taken their turn — run AI and simulate

    // Build a mutable snapshot of the full game state for engine functions
    let gameState: GameState = {
      era: state.era,
      difficulty: state.difficulty,
      gameLength: state.gameLength,
      startYear: state.startYear,
      currentYear: state.currentYear,
      currentQuarter: state.currentQuarter,
      phase: state.phase,
      turnNumber: state.turnNumber,
      airlines: state.airlines.map((a) => ({ ...a })),
      routes: state.routes.map((r) => ({ ...r })),
      ownedAircraft: state.ownedAircraft.map((a) => ({ ...a })),
      slotAllocations: state.slotAllocations.map((s) => ({ ...s })),
      activeEvents: state.activeEvents.map((e) => ({ ...e, effect: { ...e.effect } })),
      eventLog: [...state.eventLog],
      financialHistory: [...state.financialHistory],
      aircraftOrders: state.aircraftOrders.map((o) => ({ ...o })),
      currentScreen: state.currentScreen,
      activePanel: state.activePanel,
      selectedCityId: state.selectedCityId,
      selectedRouteId: state.selectedRouteId,
      selectedAircraftId: state.selectedAircraftId,
      currentPlayerIndex: state.currentPlayerIndex,
      showNews: state.showNews,
      newsQueue: [...state.newsQueue],
    };

    // Execute AI turns for all CPU players
    for (const airline of gameState.airlines) {
      if (airline.playerType === 'cpu' && !airline.eliminated) {
        gameState = executeAiTurn(airline, gameState);
      }
    }

    // Run quarter simulation
    gameState = simulateQuarter(gameState);

    // Move to results phase — reset to player 0 so all players see results
    set({
      ...gameState,
      phase: 'results',
      currentPlayerIndex: 0,
    });
  },

  nextTurn: () => {
    const state = get();

    // Advance quarter
    let nextQuarter = ((state.currentQuarter % 4) + 1) as Quarter;
    let nextYear = state.currentYear;
    if (nextQuarter === 1) {
      nextYear += 1;
    }

    // Reset actions for all airlines
    const airlines = state.airlines.map((a) => ({
      ...a,
      actionsRemaining: a.actionsPerTurn,
    }));

    // Generate new events for the new quarter
    const eraEvents = getEventsForEra(state.era);
    const newEvents: GameEvent[] = [];
    const newsQueue: GameEvent[] = [];

    // Decrement remaining quarters on active events, remove expired
    const activeEvents = state.activeEvents
      .map((e) => ({ ...e, effect: { ...e.effect }, remainingQuarters: e.remainingQuarters - 1 }))
      .filter((e) => e.remainingQuarters > 0);

    // Roll for new events
    for (const event of eraEvents) {
      const alreadyActive = activeEvents.some((ae) => ae.id === event.id);
      if (alreadyActive) continue;
      if (event.oneTime && state.eventLog.some((el) => el.event.id === event.id)) continue;
      if (event.minYear && nextYear < event.minYear) continue;
      if (event.maxYear && nextYear > event.maxYear) continue;

      if (Math.random() < event.probability) {
        const triggered: GameEvent = { ...event, effect: { ...event.effect }, triggered: true, remainingQuarters: event.duration };
        newEvents.push(triggered);
        newsQueue.push(triggered);
      }
    }

    const allActiveEvents = [...activeEvents, ...newEvents];
    const newEventLog = [
      ...state.eventLog,
      ...newEvents.map((e) => ({ year: nextYear, quarter: nextQuarter, event: e })),
    ];

    set({
      currentYear: nextYear,
      currentQuarter: nextQuarter,
      phase: 'news',
      turnNumber: state.turnNumber + 1,
      airlines,
      activeEvents: allActiveEvents,
      eventLog: newEventLog,
      currentPlayerIndex: 0,
      showNews: newsQueue.length > 0,
      newsQueue,
    });
  },

  // ----------------------------------------------------------
  // ROUTE ACTIONS
  // ----------------------------------------------------------

  openRoute: (originCityId, destCityId) => {
    set((state) => {
      const airline = state.airlines[state.currentPlayerIndex];
      if (airline.actionsRemaining <= 0) return state;

      const originCity = citiesById[originCityId];
      const destCity = citiesById[destCityId];
      if (!originCity || !destCity) return state;

      const distance = greatCircleDistance(originCity.lat, originCity.lng, destCity.lat, destCity.lng);
      const ftHours = flightTime(distance, 800); // default cruise speed

      const newRoute: Route = {
        id: generateId(),
        airlineId: airline.id,
        originCityId,
        destinationCityId: destCityId,
        distance,
        flightTimeHours: ftHours,
        assignedAircraftId: null,
        weeklyFrequency: 3,
        fareEconomy: 3,
        fareBusiness: 3,
        fareFirst: 3,
        hasFirstClass: true,
        hasBusinessClass: true,
        loadFactor: 0,
        marketShare: 0,
        quarterlyRevenue: 0,
        quarterlyCost: 0,
        suspended: false,
        maturityQuarters: 0,
        passengersDemand: 0,
        passengersCarried: 0,
      };

      // Allocate a slot at destination city
      const existingSlot = state.slotAllocations.find(
        (s) => s.cityId === destCityId && s.airlineId === airline.id
      );
      let slotAllocations: SlotAllocation[];
      if (existingSlot) {
        slotAllocations = state.slotAllocations.map((s) =>
          s.cityId === destCityId && s.airlineId === airline.id
            ? { ...s, slots: s.slots + 1 }
            : { ...s }
        );
      } else {
        slotAllocations = [
          ...state.slotAllocations,
          { cityId: destCityId, airlineId: airline.id, slots: 1 },
        ];
      }

      const airlines = state.airlines.map((a, i) =>
        i === state.currentPlayerIndex
          ? { ...a, actionsRemaining: a.actionsRemaining - 1 }
          : { ...a }
      );

      return {
        routes: [...state.routes, newRoute],
        slotAllocations,
        airlines,
      };
    });
  },

  closeRoute: (routeId) => {
    set((state) => {
      const route = state.routes.find((r) => r.id === routeId);
      if (!route) return state;

      // Free up slot at destination city
      const slotAllocations = state.slotAllocations.map((s) =>
        s.cityId === route.destinationCityId && s.airlineId === route.airlineId
          ? { ...s, slots: Math.max(0, s.slots - 1) }
          : { ...s }
      );

      // Unassign aircraft if any
      const ownedAircraft = state.ownedAircraft.map((a) =>
        a.assignedRouteId === routeId ? { ...a, assignedRouteId: null } : { ...a }
      );

      return {
        routes: state.routes.filter((r) => r.id !== routeId),
        slotAllocations,
        ownedAircraft,
      };
    });
  },

  adjustFare: (routeId, fareClass, level) => {
    set((state) => {
      const airline = state.airlines[state.currentPlayerIndex];
      if (airline.actionsRemaining <= 0) return state;

      const fareKey =
        fareClass === 'economy' ? 'fareEconomy' :
        fareClass === 'business' ? 'fareBusiness' :
        'fareFirst';

      const routes = state.routes.map((r) =>
        r.id === routeId ? { ...r, [fareKey]: level } : { ...r }
      );

      const airlines = state.airlines.map((a, i) =>
        i === state.currentPlayerIndex
          ? { ...a, actionsRemaining: a.actionsRemaining - 1 }
          : { ...a }
      );

      return { routes, airlines };
    });
  },

  adjustFrequency: (routeId, newFrequency) => {
    set((state) => {
      const airline = state.airlines[state.currentPlayerIndex];
      if (airline.actionsRemaining <= 0) return state;

      const routes = state.routes.map((r) =>
        r.id === routeId ? { ...r, weeklyFrequency: newFrequency } : { ...r }
      );

      const airlines = state.airlines.map((a, i) =>
        i === state.currentPlayerIndex
          ? { ...a, actionsRemaining: a.actionsRemaining - 1 }
          : { ...a }
      );

      return { routes, airlines };
    });
  },

  suspendRoute: (routeId) => {
    set((state) => ({
      routes: state.routes.map((r) =>
        r.id === routeId ? { ...r, suspended: true } : { ...r }
      ),
    }));
  },

  resumeRoute: (routeId) => {
    set((state) => ({
      routes: state.routes.map((r) =>
        r.id === routeId ? { ...r, suspended: false } : { ...r }
      ),
    }));
  },

  assignAircraft: (routeId, aircraftId) => {
    set((state) => {
      // Unassign aircraft from any previous route
      const routes = state.routes.map((r) => {
        if (r.id === routeId) return { ...r, assignedAircraftId: aircraftId };
        if (r.assignedAircraftId === aircraftId) return { ...r, assignedAircraftId: null };
        return { ...r };
      });

      const ownedAircraft = state.ownedAircraft.map((a) => {
        if (a.id === aircraftId) return { ...a, assignedRouteId: routeId };
        if (a.assignedRouteId === routeId) return { ...a, assignedRouteId: null };
        return { ...a };
      });

      return { routes, ownedAircraft };
    });
  },

  // ----------------------------------------------------------
  // FLEET ACTIONS
  // ----------------------------------------------------------

  purchaseAircraft: (typeId) => {
    set((state) => {
      const airline = state.airlines[state.currentPlayerIndex];
      if (airline.actionsRemaining <= 0) return state;

      const aircraftType = aircraftTypesById[typeId];
      if (!aircraftType) return state;
      if (airline.cash < aircraftType.purchasePrice) return state;

      const order: AircraftOrder = {
        id: generateId(),
        airlineId: airline.id,
        aircraftTypeId: typeId,
        deliveryQuartersRemaining: 2,
        isLease: false,
        cost: aircraftType.purchasePrice,
      };

      const airlines = state.airlines.map((a, i) =>
        i === state.currentPlayerIndex
          ? { ...a, cash: a.cash - aircraftType.purchasePrice, actionsRemaining: a.actionsRemaining - 1 }
          : { ...a }
      );

      return {
        aircraftOrders: [...state.aircraftOrders, order],
        airlines,
      };
    });
  },

  sellAircraft: (aircraftId) => {
    set((state) => {
      const airline = state.airlines[state.currentPlayerIndex];
      if (airline.actionsRemaining <= 0) return state;

      const aircraft = state.ownedAircraft.find((a) => a.id === aircraftId);
      if (!aircraft) return state;
      if (aircraft.airlineId !== airline.id) return state;

      const aircraftType = aircraftTypesById[aircraft.typeId];
      if (!aircraftType) return state;

      // Calculate depreciated value: lose value over time, sell at 60%
      const ageQuarters =
        (state.currentYear - aircraft.purchaseYear) * 4 +
        (state.currentQuarter - aircraft.purchaseQuarter);
      const depreciationRate = Math.max(0.2, 1 - ageQuarters * 0.01);
      const currentValue = aircraftType.purchasePrice * depreciationRate;
      const salePrice = currentValue * 0.6;

      // Unassign from route if assigned
      const routes = state.routes.map((r) =>
        r.assignedAircraftId === aircraftId ? { ...r, assignedAircraftId: null } : { ...r }
      );

      const airlines = state.airlines.map((a, i) =>
        i === state.currentPlayerIndex
          ? { ...a, cash: a.cash + salePrice, actionsRemaining: a.actionsRemaining - 1 }
          : { ...a }
      );

      return {
        ownedAircraft: state.ownedAircraft.filter((a) => a.id !== aircraftId),
        routes,
        airlines,
      };
    });
  },

  leaseAircraft: (typeId) => {
    set((state) => {
      const airline = state.airlines[state.currentPlayerIndex];
      if (airline.actionsRemaining <= 0) return state;

      const aircraftType = aircraftTypesById[typeId];
      if (!aircraftType) return state;

      const order: AircraftOrder = {
        id: generateId(),
        airlineId: airline.id,
        aircraftTypeId: typeId,
        deliveryQuartersRemaining: 1,
        isLease: true,
        cost: aircraftType.purchasePrice * 0.05, // quarterly lease cost
      };

      const airlines = state.airlines.map((a, i) =>
        i === state.currentPlayerIndex
          ? { ...a, actionsRemaining: a.actionsRemaining - 1 }
          : { ...a }
      );

      return {
        aircraftOrders: [...state.aircraftOrders, order],
        airlines,
      };
    });
  },

  returnLeasedAircraft: (aircraftId) => {
    set((state) => {
      const aircraft = state.ownedAircraft.find((a) => a.id === aircraftId);
      if (!aircraft || !aircraft.isLeased) return state;

      // Unassign from route if assigned
      const routes = state.routes.map((r) =>
        r.assignedAircraftId === aircraftId ? { ...r, assignedAircraftId: null } : { ...r }
      );

      return {
        ownedAircraft: state.ownedAircraft.filter((a) => a.id !== aircraftId),
        routes,
      };
    });
  },

  // ----------------------------------------------------------
  // FINANCE ACTIONS
  // ----------------------------------------------------------

  takeLoan: (amount) => {
    set((state) => {
      const airline = state.airlines[state.currentPlayerIndex];
      if (airline.actionsRemaining <= 0) return state;

      const airlines = state.airlines.map((a, i) =>
        i === state.currentPlayerIndex
          ? { ...a, cash: a.cash + amount, loans: a.loans + amount, actionsRemaining: a.actionsRemaining - 1 }
          : { ...a }
      );

      return { airlines };
    });
  },

  repayLoan: (amount) => {
    set((state) => {
      const airline = state.airlines[state.currentPlayerIndex];
      if (airline.actionsRemaining <= 0) return state;
      if (airline.cash < amount) return state;

      const repayAmount = Math.min(amount, airline.loans);

      const airlines = state.airlines.map((a, i) =>
        i === state.currentPlayerIndex
          ? { ...a, cash: a.cash - repayAmount, loans: a.loans - repayAmount, actionsRemaining: a.actionsRemaining - 1 }
          : { ...a }
      );

      return { airlines };
    });
  },

  setAdvertisingBudget: (amount) => {
    set((state) => {
      const airlines = state.airlines.map((a, i) =>
        i === state.currentPlayerIndex
          ? { ...a, advertisingBudget: amount }
          : { ...a }
      );

      return { airlines };
    });
  },

  // ----------------------------------------------------------
  // UI ACTIONS
  // ----------------------------------------------------------

  setActivePanel: (panel) => {
    set({ activePanel: panel });
  },

  selectCity: (cityId) => {
    set({ selectedCityId: cityId });
  },

  selectRoute: (routeId) => {
    set({ selectedRouteId: routeId });
  },

  selectAircraft: (aircraftId) => {
    set({ selectedAircraftId: aircraftId });
  },

  setScreen: (screen) => {
    set({ currentScreen: screen });
  },

  // ----------------------------------------------------------
  // GETTERS
  // ----------------------------------------------------------

  getCurrentAirline: () => {
    const state = get();
    return state.airlines[state.currentPlayerIndex];
  },

  getAirlineRoutes: (airlineId) => {
    return get().routes.filter((r) => r.airlineId === airlineId);
  },

  getAirlineAircraft: (airlineId) => {
    return get().ownedAircraft.filter((a) => a.airlineId === airlineId);
  },

  getAvailableAircraft: (airlineId) => {
    return get().ownedAircraft.filter(
      (a) => a.airlineId === airlineId && a.assignedRouteId === null
    );
  },

  getCitySlots: (cityId) => {
    return get().slotAllocations.filter((s) => s.cityId === cityId);
  },

  getCompetitorsOnRoute: (originId, destId) => {
    const state = get();
    const currentAirline = state.airlines[state.currentPlayerIndex];
    return state.routes.filter(
      (r) =>
        r.airlineId !== currentAirline.id &&
        ((r.originCityId === originId && r.destinationCityId === destId) ||
          (r.originCityId === destId && r.destinationCityId === originId))
    );
  },
}));
