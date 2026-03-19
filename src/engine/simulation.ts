// ============================================================
// PLANEZ REMAKE — CORE SIMULATION ENGINE
// ============================================================
// Pure functions: take state, return new state/values.

import type {
  GameState,
  Airline,
  Route,
  Quarter,
  FinancialReport,
  GameEvent,
  OwnedAircraft,
} from '../types';
import { citiesById } from '../data/cities';
import { aircraftTypesById } from '../data/aircraft';
import { gameEvents } from '../data/events';

// --- Constants ---

const SEASONAL_MULTIPLIERS: Record<Quarter, number> = {
  1: 0.85,
  2: 0.95,
  3: 1.15,
  4: 1.05,
};

const LOAN_ANNUAL_RATE = 0.08;
const ADMIN_COST_PER_AIRCRAFT_QUARTER = 0.5; // millions
const WEEKS_PER_QUARTER = 13;

// ============================================================
// 1. simulateQuarter — Main entry point
// ============================================================

export function simulateQuarter(state: GameState): GameState {
  let next = structuredClone(state);

  // Step 1: Process aircraft deliveries
  next = processDeliveries(next);

  // Step 2-3: Calculate route demand and financials
  next.routes = next.routes.map((route) => {
    if (route.suspended || !route.assignedAircraftId) return route;

    const demand = calculateRouteDemand(route, next);
    const aircraft = next.ownedAircraft.find(
      (a) => a.id === route.assignedAircraftId
    );
    const aircraftType = aircraft
      ? aircraftTypesById[aircraft.typeId]
      : undefined;
    const totalCapacity = aircraftType
      ? (aircraftType.capacity.economy +
          (route.hasBusinessClass ? aircraftType.capacity.business : 0) +
          (route.hasFirstClass ? aircraftType.capacity.first : 0)) *
        route.weeklyFrequency *
        WEEKS_PER_QUARTER
      : 0;
    const passengersCarried = Math.min(demand, totalCapacity);
    const loadFactor = totalCapacity > 0 ? passengersCarried / totalCapacity : 0;

    const { revenue, cost } = calculateRouteFinancials(
      { ...route, passengersDemand: demand, passengersCarried, loadFactor },
      demand,
      next
    );

    return {
      ...route,
      passengersDemand: demand,
      passengersCarried,
      loadFactor,
      quarterlyRevenue: revenue,
      quarterlyCost: cost,
      maturityQuarters: Math.min(route.maturityQuarters + 1, 4),
    };
  });

  // Step 4-5: Update airline financials, cash, and bankruptcy
  next.airlines = next.airlines.map((airline) => {
    if (airline.eliminated) return airline;

    const airlineRoutes = next.routes.filter(
      (r) => r.airlineId === airline.id
    );
    const airlineAircraft = next.ownedAircraft.filter(
      (a) => a.airlineId === airline.id
    );

    const report = calculateAirlineFinancials(
      airline,
      airlineRoutes,
      airlineAircraft,
      next
    );

    next.financialHistory.push(report);

    const updatedAirline: Airline = {
      ...airline,
      cash: report.cash,
    };

    return checkBankruptcy(updatedAirline, report.netWorth);
  });

  // Step 6: Process active events (decrement, remove expired)
  next.activeEvents = next.activeEvents
    .map((evt) => ({
      ...evt,
      remainingQuarters: evt.remainingQuarters - 1,
    }))
    .filter((evt) => evt.remainingQuarters > 0);

  // Step 7: Trigger new random events
  const { newEvents } = processEvents(next);
  for (const evt of newEvents) {
    next.activeEvents.push(evt);
    next.eventLog.push({
      year: next.currentYear,
      quarter: next.currentQuarter,
      event: evt,
    });
    next.newsQueue.push(evt);
  }

  // Step 8: Update city growth (quarterly fraction of annual growth)
  // Cities are reference data; we don't mutate them here, but population
  // changes are tracked through citiesById being mutable module-level state
  // in a real implementation. For a pure approach, we skip direct mutation
  // and let city populations grow implicitly through demand calculations.

  // Step 9: Financial reports were generated in step 4.

  // Step 10: Advance time
  const { year, quarter } = advanceTime(next);
  next.currentYear = year;
  next.currentQuarter = quarter;
  next.turnNumber += 1;

  // Reset actions for all airlines
  next.airlines = next.airlines.map((a) =>
    a.eliminated ? a : { ...a, actionsRemaining: a.actionsPerTurn }
  );

  return next;
}

// ============================================================
// Internal: Process aircraft deliveries
// ============================================================

function processDeliveries(state: GameState): GameState {
  const next = { ...state };
  const deliveredOrders: string[] = [];
  const newAircraft: OwnedAircraft[] = [];

  next.aircraftOrders = next.aircraftOrders.map((order) => {
    const updated = {
      ...order,
      deliveryQuartersRemaining: order.deliveryQuartersRemaining - 1,
    };

    if (updated.deliveryQuartersRemaining <= 0) {
      deliveredOrders.push(order.id);

      const owned: OwnedAircraft = {
        id: `aircraft-${order.airlineId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        typeId: order.aircraftTypeId,
        airlineId: order.airlineId,
        purchaseYear: state.currentYear,
        purchaseQuarter: state.currentQuarter,
        assignedRouteId: null,
        isLeased: order.isLease,
        leaseQuarterlyCost: order.isLease ? order.cost : 0,
        condition: 100,
        quartersSinceHeavyMaintenance: 0,
      };

      newAircraft.push(owned);
    }

    return updated;
  });

  next.aircraftOrders = next.aircraftOrders.filter(
    (o) => !deliveredOrders.includes(o.id)
  );
  next.ownedAircraft = [...next.ownedAircraft, ...newAircraft];

  return next;
}

// ============================================================
// 2. calculateRouteDemand
// ============================================================

export function calculateRouteDemand(
  route: Route,
  state: GameState
): number {
  const cityA = citiesById[route.originCityId];
  const cityB = citiesById[route.destinationCityId];

  if (!cityA || !cityB) return 0;

  const popProduct = Math.sqrt(cityA.population * cityB.population);

  // Business demand
  const businessDemand =
    Math.sqrt(cityA.economicRating * cityB.economicRating) * popProduct * 800;

  // Leisure demand
  const leisureDemand =
    Math.max(cityA.tourismRating, cityB.tourismRating) * popProduct * 400;

  let totalDemand = businessDemand + leisureDemand;

  // Seasonal multiplier
  totalDemand *= SEASONAL_MULTIPLIERS[state.currentQuarter];

  // Event multipliers
  for (const evt of state.activeEvents) {
    if (evt.effect.demandMultiplier != null) {
      // Check if event applies (global, regional, or city-specific)
      const isGlobal =
        !evt.targetRegion && !evt.targetCityId && !evt.targetAirlineId;
      const isRegional =
        evt.targetRegion &&
        (cityA.region === evt.targetRegion ||
          cityB.region === evt.targetRegion);
      const isCitySpecific =
        evt.targetCityId &&
        (route.originCityId === evt.targetCityId ||
          route.destinationCityId === evt.targetCityId);

      if (isGlobal || isRegional || isCitySpecific) {
        totalDemand *= evt.effect.demandMultiplier;
      }
    }
  }

  // Route maturity factor: 25% per quarter, max 100% at 4 quarters
  const maturityFactor = Math.min(route.maturityQuarters * 0.25, 1.0);
  totalDemand *= maturityFactor;

  // Fare elasticity: average fare level across classes, baseline is 3
  const avgFare = computeAverageFare(route);
  // Elasticity: demand scales inversely with fare — lower fares boost demand
  // At fare 1 (cheapest): multiplier ~1.4, at fare 3: 1.0, at fare 5: ~0.7
  const fareMultiplier = 1.0 + (3 - avgFare) * 0.2;
  totalDemand *= fareMultiplier;

  return Math.max(0, Math.round(totalDemand));
}

function computeAverageFare(route: Route): number {
  let totalWeight = 1; // economy always counts
  let totalFare = route.fareEconomy;

  if (route.hasBusinessClass) {
    totalFare += route.fareBusiness;
    totalWeight += 1;
  }
  if (route.hasFirstClass) {
    totalFare += route.fareFirst;
    totalWeight += 1;
  }

  return totalFare / totalWeight;
}

// ============================================================
// 3. calculateRouteFinancials
// ============================================================

export function calculateRouteFinancials(
  route: Route,
  demand: number,
  state: GameState
): { revenue: number; cost: number } {
  const aircraft = state.ownedAircraft.find(
    (a) => a.id === route.assignedAircraftId
  );

  if (!aircraft) {
    return { revenue: 0, cost: 0 };
  }

  const aircraftType = aircraftTypesById[aircraft.typeId];
  if (!aircraftType) {
    return { revenue: 0, cost: 0 };
  }

  const totalCapacity =
    (aircraftType.capacity.economy +
      (route.hasBusinessClass ? aircraftType.capacity.business : 0) +
      (route.hasFirstClass ? aircraftType.capacity.first : 0)) *
    route.weeklyFrequency *
    WEEKS_PER_QUARTER;

  const passengers = Math.min(demand, totalCapacity);

  // --- Revenue ---
  // Base ticket price scales with distance: ~$0.10 per km baseline
  const baseTicketPrice = route.distance * 0.1;

  // Fare-level adjustments: each fare level is a multiplier on the base price
  const economyPrice = baseTicketPrice * (0.6 + route.fareEconomy * 0.1);
  const businessPrice = baseTicketPrice * (1.0 + route.fareBusiness * 0.2);
  const firstPrice = baseTicketPrice * (1.5 + route.fareFirst * 0.3);

  // Approximate passenger split by class
  const totalSeatsPerFlight =
    aircraftType.capacity.economy +
    (route.hasBusinessClass ? aircraftType.capacity.business : 0) +
    (route.hasFirstClass ? aircraftType.capacity.first : 0);

  const economyShare =
    totalSeatsPerFlight > 0
      ? aircraftType.capacity.economy / totalSeatsPerFlight
      : 1;
  const businessShare =
    route.hasBusinessClass && totalSeatsPerFlight > 0
      ? aircraftType.capacity.business / totalSeatsPerFlight
      : 0;
  const firstShare =
    route.hasFirstClass && totalSeatsPerFlight > 0
      ? aircraftType.capacity.first / totalSeatsPerFlight
      : 0;

  const avgTicketPrice =
    economyPrice * economyShare +
    businessPrice * businessShare +
    firstPrice * firstShare;

  // Revenue in millions
  const revenue = (passengers * avgTicketPrice) / 1_000_000;

  // --- Costs ---
  const totalFlights = route.weeklyFrequency * WEEKS_PER_QUARTER;
  const totalFlightHours = totalFlights * route.flightTimeHours * 2; // round trip

  // Operating cost (thousands per hour -> millions)
  const operatingCost =
    (totalFlightHours * aircraftType.operatingCostPerHour) / 1_000;

  // Fuel cost — affected by events
  let fuelMultiplier = 1.0;
  for (const evt of state.activeEvents) {
    if (evt.effect.fuelCostMultiplier != null) {
      fuelMultiplier *= evt.effect.fuelCostMultiplier;
    }
  }
  // Fuel cost based on hours and efficiency (lower efficiency = higher cost)
  const baseFuelCost =
    (totalFlightHours * (11 - aircraftType.fuelEfficiency) * 0.5) / 1_000;
  const fuelCost = baseFuelCost * fuelMultiplier;

  // Airport fees — based on number of flights and distance
  const airportFees = (totalFlights * 2 * 0.005 * route.distance) / 1_000; // millions

  const cost = operatingCost + fuelCost + airportFees;

  return {
    revenue: Math.round(revenue * 100) / 100,
    cost: Math.round(cost * 100) / 100,
  };
}

// ============================================================
// 4. calculateAirlineFinancials
// ============================================================

export function calculateAirlineFinancials(
  airline: Airline,
  routes: Route[],
  aircraft: OwnedAircraft[],
  state: GameState
): FinancialReport {
  // Route-level revenue and costs
  const totalRevenue = routes.reduce(
    (sum, r) => sum + (r.quarterlyRevenue ?? 0),
    0
  );
  const routeCosts = routes.reduce(
    (sum, r) => sum + (r.quarterlyCost ?? 0),
    0
  );

  // Split costs for reporting
  // Approximate fuel as 40% of route costs, rest is crew/operating
  const fuelCosts = routeCosts * 0.4;
  const crewCosts = routeCosts * 0.3;
  const airportFees = routeCosts * 0.3;

  // Maintenance costs
  let maintenanceMultiplier = 1.0;
  for (const evt of state.activeEvents) {
    if (
      evt.effect.maintenanceCostMultiplier != null &&
      (!evt.targetAirlineId || evt.targetAirlineId === airline.id)
    ) {
      maintenanceMultiplier *= evt.effect.maintenanceCostMultiplier;
    }
  }

  const maintenanceCosts =
    aircraft.reduce((sum, a) => {
      const type = aircraftTypesById[a.typeId];
      return sum + (type ? type.maintenanceCostPerQuarter / 1_000 : 0);
    }, 0) * maintenanceMultiplier;

  // Lease payments
  const leaseCosts = aircraft
    .filter((a) => a.isLeased)
    .reduce((sum, a) => sum + a.leaseQuarterlyCost, 0);

  // Loan interest (quarterly)
  const loanInterest = airline.loans * (LOAN_ANNUAL_RATE / 4);

  // Advertising
  const advertisingCosts = airline.advertisingBudget;

  // Admin overhead
  const adminCosts = aircraft.length * ADMIN_COST_PER_AIRCRAFT_QUARTER;

  const totalCosts =
    routeCosts +
    maintenanceCosts +
    leaseCosts +
    loanInterest +
    advertisingCosts +
    adminCosts;

  const profit = totalRevenue - totalCosts;
  const cash = airline.cash + profit;

  // Assets: cash + fleet value
  const fleetValue = aircraft.reduce((sum, a) => {
    const type = aircraftTypesById[a.typeId];
    if (!type || a.isLeased) return sum;
    // Depreciate: lose 5% per year from purchase
    const age =
      (state.currentYear - a.purchaseYear) * 4 +
      (state.currentQuarter - a.purchaseQuarter);
    const depreciationFactor = Math.max(0.2, 1 - age * 0.0125); // 5% per year = 1.25% per quarter
    return sum + type.purchasePrice * depreciationFactor;
  }, 0);

  const assets = Math.max(0, cash) + fleetValue;
  const liabilities = airline.loans + (cash < 0 ? Math.abs(cash) : 0);
  const netWorth = assets - liabilities;

  // Stock price: rough proxy
  const stockPrice = Math.max(0.1, netWorth * 2 + profit * 8);

  const passengersCarried = routes.reduce(
    (sum, r) => sum + (r.passengersCarried ?? 0),
    0
  );

  const activeRoutes = routes.filter((r) => !r.suspended);

  return {
    year: state.currentYear,
    quarter: state.currentQuarter,
    airlineId: airline.id,
    revenue: round2(totalRevenue),
    fuelCosts: round2(fuelCosts),
    crewCosts: round2(crewCosts),
    maintenanceCosts: round2(maintenanceCosts),
    airportFees: round2(airportFees),
    leaseCosts: round2(leaseCosts),
    loanInterest: round2(loanInterest),
    advertisingCosts: round2(advertisingCosts),
    adminCosts: round2(adminCosts),
    totalCosts: round2(totalCosts),
    profit: round2(profit),
    cash: round2(cash),
    assets: round2(assets),
    liabilities: round2(liabilities),
    netWorth: round2(netWorth),
    stockPrice: round2(stockPrice),
    passengersCarried,
    routeCount: activeRoutes.length,
    fleetSize: aircraft.length,
  };
}

// ============================================================
// 5. processEvents
// ============================================================

export function processEvents(
  state: GameState
): { newEvents: GameEvent[]; expiredEvents: GameEvent[] } {
  const newEvents: GameEvent[] = [];
  const expiredEvents: GameEvent[] = [];

  // Identify expired events (already decremented in simulateQuarter)
  // This function is called after decrementing, so expired are those at 0.

  // Check potential events from the pool
  // We import events lazily to avoid circular deps; they live in state.activeEvents
  // plus we can reference a master events list. For simplicity, we use a dynamic
  // import approach — the caller should provide the event pool on the state or
  // we generate inline.

  // Build set of currently active event IDs
  const activeIds = new Set(state.activeEvents.map((e) => e.id));

  // We dynamically import the events pool. Since this is a pure function,
  // we reference the events module at the top. For now, we inline a check
  // against a well-known set of event templates.
  try {
    for (const template of gameEvents as GameEvent[]) {
      // Skip if already active or if it's one-time and already triggered
      if (activeIds.has(template.id)) continue;
      if (template.oneTime && template.triggered) continue;

      // Check era/year constraints
      if (template.minYear && state.currentYear < template.minYear) continue;
      if (template.maxYear && state.currentYear > template.maxYear) continue;

      // Roll probability
      if (Math.random() < template.probability) {
        const triggered: GameEvent = {
          ...template,
          remainingQuarters: template.duration,
          triggered: true,
        };
        newEvents.push(triggered);
      }
    }
  } catch {
    // If events data is unavailable, skip event generation
  }

  return { newEvents, expiredEvents };
}

// ============================================================
// 6. checkBankruptcy
// ============================================================

export function checkBankruptcy(
  airline: Airline,
  netWorth: number
): Airline {
  if (netWorth < 0) {
    const bankruptcyQuarters = airline.bankruptcyQuarters + 1;
    return {
      ...airline,
      bankruptcyQuarters,
      eliminated: bankruptcyQuarters >= 4,
    };
  }

  return {
    ...airline,
    bankruptcyQuarters: 0,
  };
}

// ============================================================
// 7. advanceTime
// ============================================================

export function advanceTime(
  state: GameState
): { year: number; quarter: Quarter } {
  const q = state.currentQuarter + 1;
  if (q > 4) {
    return { year: state.currentYear + 1, quarter: 1 };
  }
  return { year: state.currentYear, quarter: q as Quarter };
}

// ============================================================
// Utility
// ============================================================

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
