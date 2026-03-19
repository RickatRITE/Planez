// ============================================================
// PLANEZ REMAKE — AI OPPONENT ENGINE
// Decides actions for CPU-controlled airlines each turn.
// ============================================================

import type { GameState, Airline, AiPersonality, Route, AircraftType } from '../types';
import { cities, citiesById } from '../data/cities';
import { aircraftTypes } from '../data/aircraft';
import { greatCircleDistance, flightTime } from '../utils/helpers';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_CASH_RESERVE = 5; // millions — AI won't spend below this
const FARE_RAISE_THRESHOLD = 0.85; // load factor above which fares may rise
const FARE_LOWER_THRESHOLD = 0.60; // load factor below which fares drop
const AD_BUDGET_MIN_RATIO = 0.05; // 5% of revenue
const AD_BUDGET_MAX_RATIO = 0.10; // 10% of revenue

// ---------------------------------------------------------------------------
// Helper: score a potential route (0–100)
// ---------------------------------------------------------------------------

export function scoreRoute(
  originId: string,
  destId: string,
  airline: Airline,
  state: GameState,
  personality: AiPersonality,
): number {
  const origin = citiesById[originId];
  const dest = citiesById[destId];
  if (!origin || !dest) return 0;

  const distance = greatCircleDistance(origin.lat, origin.lng, dest.lat, dest.lng);
  if (distance < 200) return 0; // too short to be meaningful

  // Base demand potential from city characteristics
  const combinedPop = origin.population + dest.population;
  const combinedEcon = (origin.economicRating + dest.economicRating) / 2;
  const combinedTourism = (origin.tourismRating + dest.tourismRating) / 2;

  let demandScore = (combinedPop * 0.8 + combinedEcon * 2 + combinedTourism * 1.5);
  // Normalize roughly to 0–50 range
  demandScore = Math.min(demandScore, 50);

  // Competition factor: how many airlines already serve this pair?
  const existingRoutes = state.routes.filter(
    (r) =>
      !r.suspended &&
      ((r.originCityId === originId && r.destinationCityId === destId) ||
        (r.originCityId === destId && r.destinationCityId === originId)),
  );
  const competitorCount = existingRoutes.filter((r) => r.airlineId !== airline.id).length;

  // Hub connectivity bonus: routes from/to hub score higher
  const hubBonus = originId === airline.hubCityId || destId === airline.hubCityId ? 15 : 0;

  // Personality adjustments
  let personalityMod = 0;
  const hubCity = citiesById[airline.hubCityId];

  switch (personality) {
    case 'aggressive':
      // Prefers high-traffic routes even with competition
      personalityMod = demandScore * 0.3;
      // Less penalty for competition
      personalityMod -= competitorCount * 3;
      break;

    case 'conservative':
      // Prefers underserved routes with good margins
      personalityMod = competitorCount === 0 ? 20 : -competitorCount * 8;
      // Bonus for economically strong cities (better margins)
      personalityMod += combinedEcon * 1.5;
      break;

    case 'regional':
      // Strongly prefers routes within the hub's region
      if (hubCity) {
        if (origin.region === hubCity.region && dest.region === hubCity.region) {
          personalityMod = 25;
        } else if (origin.region === hubCity.region || dest.region === hubCity.region) {
          personalityMod = 5;
        } else {
          personalityMod = -20;
        }
      }
      // Prefers shorter distances
      personalityMod += distance < 3000 ? 10 : -5;
      break;

    case 'global':
      // Prefers long-haul international routes
      if (origin.region !== dest.region) {
        personalityMod = 15;
      }
      if (distance > 6000) {
        personalityMod += 15;
      } else if (distance < 2000) {
        personalityMod -= 10;
      }
      break;
  }

  // Competition penalty (general)
  const competitionPenalty = personality === 'aggressive'
    ? competitorCount * 3
    : competitorCount * 6;

  const rawScore = demandScore + hubBonus + personalityMod - competitionPenalty;

  // Add a small random factor (0–8) so the AI isn't perfectly deterministic
  const jitter = Math.random() * 8;

  return Math.max(0, Math.min(100, rawScore + jitter));
}

// ---------------------------------------------------------------------------
// Helper: pick the best aircraft type for a given route
// ---------------------------------------------------------------------------

export function pickAircraftForRoute(
  distance: number,
  demand: number,
  availableTypes: AircraftType[],
  personality?: AiPersonality,
): AircraftType | null {
  // Filter to aircraft that can actually fly the route
  const capable = availableTypes.filter((a) => a.range >= distance);
  if (capable.length === 0) return null;

  // Score each aircraft
  const scored = capable.map((ac) => {
    const totalCapacity = ac.capacity.economy + ac.capacity.business + ac.capacity.first;
    let score = 0;

    // Capacity match: prefer aircraft whose capacity is close to demand
    // but not too small
    const capRatio = totalCapacity / Math.max(demand, 1);
    if (capRatio >= 0.5 && capRatio <= 1.5) {
      score += 30;
    } else if (capRatio > 1.5) {
      score += 15 - Math.min(15, (capRatio - 1.5) * 10);
    } else {
      score += 15;
    }

    // Range efficiency: don't pick a plane with way more range than needed
    const rangeRatio = ac.range / distance;
    if (rangeRatio >= 1 && rangeRatio <= 2) {
      score += 20;
    } else {
      score += 10;
    }

    // Cost efficiency
    score += ac.fuelEfficiency * 2;
    score += ac.reliability * 1.5;

    // Personality adjustments
    if (personality === 'conservative') {
      score += ac.fuelEfficiency * 3;
      score += ac.reliability * 2;
    } else if (personality === 'aggressive') {
      score += totalCapacity * 0.05; // favor bigger planes
    }

    return { aircraft: ac, score };
  });

  // Sort descending by score and return the best
  scored.sort((a, b) => b.score - a.score);
  return scored[0].aircraft;
}

// ---------------------------------------------------------------------------
// Helper: determine the best route to open (or null)
// ---------------------------------------------------------------------------

export function shouldOpenRoute(
  airline: Airline,
  state: GameState,
): { originId: string; destId: string; score: number } | null {
  const personality = airline.aiPersonality ?? 'conservative';

  // Don't open routes if cash is too low
  if (airline.cash < MIN_CASH_RESERVE + 10) return null;

  // Get city ids the airline currently serves
  const servedPairs = new Set<string>();
  const aiRoutes = state.routes.filter((r) => r.airlineId === airline.id);
  for (const route of aiRoutes) {
    const key1 = `${route.originCityId}-${route.destinationCityId}`;
    const key2 = `${route.destinationCityId}-${route.originCityId}`;
    servedPairs.add(key1);
    servedPairs.add(key2);
  }

  // Score all unserved city pairs
  let bestCandidate: { originId: string; destId: string; score: number } | null = null;

  for (let i = 0; i < cities.length; i++) {
    for (let j = i + 1; j < cities.length; j++) {
      const oid = cities[i].id;
      const did = cities[j].id;
      const pairKey = `${oid}-${did}`;
      if (servedPairs.has(pairKey)) continue;

      // At least one endpoint should be the hub or a city we already serve
      const servedCities = new Set<string>();
      servedCities.add(airline.hubCityId);
      for (const r of aiRoutes) {
        servedCities.add(r.originCityId);
        servedCities.add(r.destinationCityId);
      }
      if (!servedCities.has(oid) && !servedCities.has(did)) continue;

      const s = scoreRoute(oid, did, airline, state, personality);
      if (!bestCandidate || s > bestCandidate.score) {
        bestCandidate = { originId: oid, destId: did, score: s };
      }
    }
  }

  // Only open if the score is above a threshold
  if (bestCandidate && bestCandidate.score < 20) return null;

  return bestCandidate;
}

// ---------------------------------------------------------------------------
// Helper: determine which aircraft to buy (or null)
// ---------------------------------------------------------------------------

export function shouldBuyAircraft(
  airline: Airline,
  state: GameState,
): AircraftType | null {
  const personality = airline.aiPersonality ?? 'conservative';

  // Check for routes without assigned aircraft
  const unassignedRoutes = state.routes.filter(
    (r) => r.airlineId === airline.id && !r.suspended && r.assignedAircraftId === null,
  );

  // Also check for routes with high load factors that could use more capacity
  const overloadedRoutes = state.routes.filter(
    (r) => r.airlineId === airline.id && !r.suspended && r.loadFactor > 0.9,
  );

  const targetRoutes = unassignedRoutes.length > 0 ? unassignedRoutes : overloadedRoutes;
  if (targetRoutes.length === 0) return null;

  // Pick the most important route to serve
  const targetRoute = targetRoutes.reduce((best, r) =>
    r.passengersDemand > best.passengersDemand ? r : best,
  );

  // Filter aircraft available in the current era/year
  const available = aircraftTypes.filter(
    (ac) => ac.introYear <= state.currentYear && ac.retireYear >= state.currentYear,
  );
  if (available.length === 0) return null;

  // Check if the airline can afford it
  const affordable = available.filter(
    (ac) => ac.purchasePrice < airline.cash - MIN_CASH_RESERVE,
  );
  if (affordable.length === 0) return null;

  return pickAircraftForRoute(
    targetRoute.distance,
    targetRoute.passengersDemand,
    affordable,
    personality,
  );
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function executeAiTurn(airline: Airline, state: GameState): GameState {
  if (airline.playerType !== 'cpu' || airline.eliminated) return state;

  const personality = airline.aiPersonality ?? 'conservative';
  let newState = deepCloneState(state);
  let actionsLeft = airline.actionsRemaining;

  // ── 1. Try to open a new route ─────────────────────────────────────────
  if (actionsLeft > 0) {
    const routeCandidate = shouldOpenRoute(airline, newState);
    if (routeCandidate) {
      const origin = citiesById[routeCandidate.originId];
      const dest = citiesById[routeCandidate.destId];
      if (origin && dest) {
        const distance = greatCircleDistance(origin.lat, origin.lng, dest.lat, dest.lng);
        const avgSpeed = 850; // reasonable cruise speed estimate
        const fTime = flightTime(distance, avgSpeed);

        // Estimate demand from city characteristics
        const estimatedDemand = Math.round(
          (origin.population + dest.population) *
            ((origin.economicRating + dest.economicRating) / 20) *
            500,
        );

        const newRoute: Route = {
          id: `ai_route_${airline.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          airlineId: airline.id,
          originCityId: routeCandidate.originId,
          destinationCityId: routeCandidate.destId,
          distance: Math.round(distance),
          flightTimeHours: Math.round(fTime * 10) / 10,
          assignedAircraftId: null,
          weeklyFrequency: 7,
          fareEconomy: 3 as Route['fareEconomy'],
          fareBusiness: 3 as Route['fareBusiness'],
          fareFirst: 3 as Route['fareFirst'],
          hasFirstClass: distance > 5000,
          hasBusinessClass: distance > 2000,
          loadFactor: 0,
          marketShare: 0,
          quarterlyRevenue: 0,
          quarterlyCost: 0,
          suspended: false,
          maturityQuarters: 0,
          passengersDemand: estimatedDemand,
          passengersCarried: 0,
        };

        newState = {
          ...newState,
          routes: [...newState.routes, newRoute],
        };
        actionsLeft--;
      }
    }
  }

  // ── 2. Purchase aircraft ───────────────────────────────────────────────
  if (actionsLeft > 0) {
    const aircraftToBuy = shouldBuyAircraft(airline, newState);
    if (aircraftToBuy) {
      const aiAirline = newState.airlines.find((a) => a.id === airline.id);
      if (aiAirline && aiAirline.cash >= aircraftToBuy.purchasePrice + MIN_CASH_RESERVE) {
        // Find an unassigned route to pair with
        const unassignedRoute = newState.routes.find(
          (r) => r.airlineId === airline.id && !r.suspended && r.assignedAircraftId === null,
        );

        const aircraftId = `ai_ac_${airline.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

        const newAircraft = {
          id: aircraftId,
          typeId: aircraftToBuy.id,
          airlineId: airline.id,
          purchaseYear: newState.currentYear,
          purchaseQuarter: newState.currentQuarter,
          assignedRouteId: unassignedRoute ? unassignedRoute.id : null,
          isLeased: false,
          leaseQuarterlyCost: 0,
          condition: 100,
          quartersSinceHeavyMaintenance: 0,
        };

        // Update the airline's cash
        const updatedAirlines = newState.airlines.map((a) =>
          a.id === airline.id
            ? { ...a, cash: a.cash - aircraftToBuy.purchasePrice }
            : a,
        );

        // If assigning to a route, update that route
        const updatedRoutes = unassignedRoute
          ? newState.routes.map((r) =>
              r.id === unassignedRoute.id
                ? { ...r, assignedAircraftId: aircraftId }
                : r,
            )
          : newState.routes;

        newState = {
          ...newState,
          airlines: updatedAirlines,
          routes: updatedRoutes,
          ownedAircraft: [...newState.ownedAircraft, newAircraft],
        };
        actionsLeft--;
      }
    }
  }

  // ── 3. Adjust fares ────────────────────────────────────────────────────
  if (actionsLeft > 0) {
    let fareChanged = false;
    const updatedRoutes = newState.routes.map((r) => {
      if (r.airlineId !== airline.id || r.suspended) return r;

      let newFareEcon = r.fareEconomy;
      let newFareBiz = r.fareBusiness;
      let newFareFirst = r.fareFirst;

      if (r.loadFactor > FARE_RAISE_THRESHOLD) {
        // High demand — consider raising fares
        if (newFareEcon < 5) {
          newFareEcon = (newFareEcon + 1) as Route['fareEconomy'];
          fareChanged = true;
        }
        if (r.hasBusinessClass && newFareBiz < 5) {
          newFareBiz = (newFareBiz + 1) as Route['fareBusiness'];
        }
        if (r.hasFirstClass && newFareFirst < 5) {
          newFareFirst = (newFareFirst + 1) as Route['fareFirst'];
        }
      } else if (r.loadFactor < FARE_LOWER_THRESHOLD) {
        // Low demand — lower fares
        if (newFareEcon > 1) {
          newFareEcon = (newFareEcon - 1) as Route['fareEconomy'];
          fareChanged = true;
        }
        if (r.hasBusinessClass && newFareBiz > 1) {
          newFareBiz = (newFareBiz - 1) as Route['fareBusiness'];
        }
        if (r.hasFirstClass && newFareFirst > 1) {
          newFareFirst = (newFareFirst - 1) as Route['fareFirst'];
        }
      }

      // Aggressive personality: undercut competitors on competitive routes
      if (personality === 'aggressive' && !fareChanged) {
        const competitors = newState.routes.filter(
          (cr) =>
            cr.airlineId !== airline.id &&
            !cr.suspended &&
            ((cr.originCityId === r.originCityId && cr.destinationCityId === r.destinationCityId) ||
              (cr.originCityId === r.destinationCityId && cr.destinationCityId === r.originCityId)),
        );
        if (competitors.length > 0 && newFareEcon > 1 && Math.random() < 0.4) {
          newFareEcon = (newFareEcon - 1) as Route['fareEconomy'];
          fareChanged = true;
        }
      }

      return {
        ...r,
        fareEconomy: newFareEcon,
        fareBusiness: newFareBiz,
        fareFirst: newFareFirst,
      };
    });

    if (fareChanged) {
      newState = { ...newState, routes: updatedRoutes };
      actionsLeft--;
    }
  }

  // ── 4. Adjust advertising budget ───────────────────────────────────────
  if (actionsLeft > 0) {
    const aiRoutes = newState.routes.filter(
      (r) => r.airlineId === airline.id && !r.suspended,
    );
    const totalRevenue = aiRoutes.reduce((sum, r) => sum + r.quarterlyRevenue, 0);

    if (totalRevenue > 0) {
      // Scale ad budget between 5–10% of revenue
      const targetRatio = personality === 'aggressive'
        ? AD_BUDGET_MAX_RATIO
        : personality === 'conservative'
          ? AD_BUDGET_MIN_RATIO
          : (AD_BUDGET_MIN_RATIO + AD_BUDGET_MAX_RATIO) / 2;

      const newBudget = Math.round(totalRevenue * targetRatio * 10) / 10;
      const currentAirline = newState.airlines.find((a) => a.id === airline.id);

      if (currentAirline && Math.abs(currentAirline.advertisingBudget - newBudget) > 0.5) {
        newState = {
          ...newState,
          airlines: newState.airlines.map((a) =>
            a.id === airline.id ? { ...a, advertisingBudget: newBudget } : a,
          ),
        };
        actionsLeft--;
      }
    }
  }

  // ── Update actions remaining ───────────────────────────────────────────
  newState = {
    ...newState,
    airlines: newState.airlines.map((a) =>
      a.id === airline.id ? { ...a, actionsRemaining: actionsLeft } : a,
    ),
  };

  return newState;
}

// ---------------------------------------------------------------------------
// Deep-clone helper (simple structured clone for pure-ish state handling)
// ---------------------------------------------------------------------------

function deepCloneState(state: GameState): GameState {
  return {
    ...state,
    airlines: state.airlines.map((a) => ({ ...a })),
    routes: state.routes.map((r) => ({ ...r })),
    ownedAircraft: state.ownedAircraft.map((a) => ({ ...a })),
    slotAllocations: state.slotAllocations.map((s) => ({ ...s })),
    activeEvents: state.activeEvents.map((e) => ({ ...e, effect: { ...e.effect } })),
    eventLog: [...state.eventLog],
    financialHistory: [...state.financialHistory],
    aircraftOrders: state.aircraftOrders.map((o) => ({ ...o })),
    newsQueue: [...state.newsQueue],
  };
}
