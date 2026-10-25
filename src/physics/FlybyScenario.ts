import { PlanetaryBodyData, PLANETARY_BODIES, G_NEWTON, MU_SUN } from './constants';
import { FlybyEngine, FlybyInitialConditions, FlybyPassType } from './FlybyEngine';
import { Vector3D } from './Vector3D';

export type ConfigurationMode = 'PLANET_PRESET' | 'CUSTOM_PLANET' | 'CUSTOM_FLYBY';
export type ParameterAuthority = 'MASS_AUTHORITATIVE' | 'MU_AUTHORITATIVE';
export type PlanetVelocityMode = 'CIRCULAR_ORBIT' | 'CUSTOM_VECTOR';
export type EncounterDistanceMode = 'PERIAPSIS_ALTITUDE' | 'IMPACT_PARAMETER';

export interface FlybyScenarioConfig {
  id: string;
  name: string;
  description?: string;
  mode: ConfigurationMode;
  createdAt: string;
  updatedAt: string;
  version: number;

  planet: {
    presetId: string; // 'JUPITER' | 'SATURN' | 'EARTH' | 'VENUS' | 'CUSTOM'
    name: string;
    isTheoretical: boolean;
    massKg: number;
    radiusM: number;
    mu: number; // m^3 / s^2
    authority: ParameterAuthority;
    velocityMode: PlanetVelocityMode;
    semiMajorAxisM: number;
    orbitalSpeedMPerS: number;
    customVelocityVectorMPerS: { x: number; y: number; z: number };
    initialPhaseDeg: number;
    color?: string;
  };

  encounter: {
    vInfSpeedMPerS: number;
    approachAngleDeg: number;
    passType: FlybyPassType;
    distanceMode: EncounterDistanceMode;
    periapsisAltitudeKm: number;
    impactParameterKm: number;
    spacecraftMassKg: number;
  };

  advanced: {
    timeStepCoeff: number; // default 0.015
    entryDistanceMultiple: number; // default 20
    simulationDurationS?: number;
    trajectoryMode: 'NUMERICAL_RK4' | 'ANALYTICAL_IDEAL';
  };
}

export const STORAGE_KEY_FLYBY_SCENARIOS = 'ASTRA_FLYBY_SCENARIOS_V1';

/**
 * Creates a default scenario configuration for a given planetary preset
 */
export function createScenarioFromPreset(
  presetKey: 'JUPITER' | 'SATURN' | 'EARTH' | 'VENUS' = 'JUPITER'
): FlybyScenarioConfig {
  const planet = PLANETARY_BODIES[presetKey] || PLANETARY_BODIES.JUPITER;
  const vInfDefault = presetKey === 'JUPITER' ? 10000.0 : presetKey === 'SATURN' ? 9000.0 : 8000.0;
  const altKmDefault = presetKey === 'JUPITER' ? 45000.0 : presetKey === 'SATURN' ? 35000.0 : 2500.0;

  const rpM = planet.radiusM + altKmDefault * 1000.0;
  const bM = FlybyEngine.periapsisToImpactParameter(rpM, vInfDefault, planet.mu);

  const now = new Date().toISOString();

  return {
    id: `preset-${planet.id.toLowerCase()}-${Date.now()}`,
    name: `${planet.name} Nominal Flyby Scenario`,
    description: `Standard baseline hyperbolic encounter with ${planet.name}.`,
    mode: 'PLANET_PRESET',
    createdAt: now,
    updatedAt: now,
    version: 1,

    planet: {
      presetId: planet.id,
      name: planet.name,
      isTheoretical: false,
      massKg: planet.massKg,
      radiusM: planet.radiusM,
      mu: planet.mu,
      authority: 'MU_AUTHORITATIVE',
      velocityMode: 'CIRCULAR_ORBIT',
      semiMajorAxisM: planet.semiMajorAxisM,
      orbitalSpeedMPerS: planet.orbitalSpeedMPerS,
      customVelocityVectorMPerS: { x: 0, y: planet.orbitalSpeedMPerS, z: 0 },
      initialPhaseDeg: 0,
      color: planet.color,
    },

    encounter: {
      vInfSpeedMPerS: vInfDefault,
      approachAngleDeg: 0,
      passType: 'TRAILING',
      distanceMode: 'PERIAPSIS_ALTITUDE',
      periapsisAltitudeKm: altKmDefault,
      impactParameterKm: bM / 1000.0,
      spacecraftMassKg: 1000.0,
    },

    advanced: {
      timeStepCoeff: 0.015,
      entryDistanceMultiple: 20.0,
      trajectoryMode: 'NUMERICAL_RK4',
    },
  };
}

export const DEFAULT_FLYBY_SCENARIO = createScenarioFromPreset('JUPITER');

/**
 * Synchronizes mass and gravitational parameter mu based on authority
 */
export function syncMassAndMu(
  massKg: number,
  mu: number,
  authority: ParameterAuthority
): { massKg: number; mu: number } {
  if (authority === 'MASS_AUTHORITATIVE') {
    const derivedMu = massKg > 0 ? G_NEWTON * massKg : 0;
    return { massKg, mu: derivedMu };
  } else {
    const derivedMass = mu > 0 ? mu / G_NEWTON : 0;
    return { massKg: derivedMass, mu };
  }
}

/**
 * Synchronizes periapsis altitude and impact parameter preserving the physical hyperbolic relation
 */
export function syncAltitudeAndImpactParameter(
  altKm: number,
  bKm: number,
  edited: EncounterDistanceMode,
  radiusM: number,
  vInfMPerS: number,
  mu: number
): { periapsisAltitudeKm: number; impactParameterKm: number } {
  if (vInfMPerS <= 0 || mu <= 0 || radiusM <= 0) {
    return { periapsisAltitudeKm: altKm, impactParameterKm: bKm };
  }

  if (edited === 'PERIAPSIS_ALTITUDE') {
    const rpM = radiusM + altKm * 1000.0;
    const bM = rpM > 0 ? FlybyEngine.periapsisToImpactParameter(rpM, vInfMPerS, mu) : 0;
    return {
      periapsisAltitudeKm: altKm,
      impactParameterKm: bM / 1000.0,
    };
  } else {
    const bM = bKm * 1000.0;
    const rpM = bM > 0 ? FlybyEngine.impactParameterToPeriapsis(bM, vInfMPerS, mu) : 0;
    const derivedAltKm = (rpM - radiusM) / 1000.0;
    return {
      periapsisAltitudeKm: derivedAltKm,
      impactParameterKm: bKm,
    };
  }
}

/**
 * Calculates circular orbital speed around the Sun for semi-major axis a (m)
 */
export function computeCircularOrbitalSpeed(semiMajorAxisM: number): number {
  if (semiMajorAxisM <= 0) return 0;
  return Math.sqrt(MU_SUN / semiMajorAxisM);
}

/**
 * Strict Scenario Schema Validation
 */
export function validateScenario(scenario: unknown): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!scenario || typeof scenario !== 'object') {
    return { isValid: false, errors: ['Scenario payload must be a non-null object.'] };
  }

  const s = scenario as Partial<FlybyScenarioConfig>;

  if (!s.name || typeof s.name !== 'string' || s.name.trim().length === 0) {
    errors.push('Scenario name is required.');
  }

  // Validate Planet
  if (!s.planet || typeof s.planet !== 'object') {
    errors.push('Planet configuration object is required.');
  } else {
    const p = s.planet;
    if (!p.name || typeof p.name !== 'string' || p.name.trim().length === 0) {
      errors.push('Planet name is required.');
    }
    if (typeof p.massKg !== 'number' || !isFinite(p.massKg) || p.massKg <= 0) {
      errors.push('Planet mass must be a finite positive number in kg.');
    }
    if (typeof p.radiusM !== 'number' || !isFinite(p.radiusM) || p.radiusM <= 0) {
      errors.push('Planet radius must be a finite positive number in meters.');
    }
    if (typeof p.mu !== 'number' || !isFinite(p.mu) || p.mu <= 0) {
      errors.push('Planet gravitational parameter (mu) must be a finite positive number.');
    }
    if (p.velocityMode === 'CIRCULAR_ORBIT') {
      if (typeof p.semiMajorAxisM !== 'number' || !isFinite(p.semiMajorAxisM) || p.semiMajorAxisM <= 0) {
        errors.push('Orbital semi-major axis must be a positive number in meters.');
      }
    } else if (p.velocityMode === 'CUSTOM_VECTOR') {
      const v = p.customVelocityVectorMPerS;
      if (!v || typeof v.x !== 'number' || typeof v.y !== 'number' || typeof v.z !== 'number' ||
          !isFinite(v.x) || !isFinite(v.y) || !isFinite(v.z)) {
        errors.push('Custom planet velocity vector (x, y, z) must contain valid finite numbers.');
      }
    }
  }

  // Validate Encounter
  if (!s.encounter || typeof s.encounter !== 'object') {
    errors.push('Encounter settings object is required.');
  } else {
    const e = s.encounter;
    if (typeof e.vInfSpeedMPerS !== 'number' || !isFinite(e.vInfSpeedMPerS) || e.vInfSpeedMPerS <= 0) {
      errors.push('Incoming hyperbolic excess speed (v_inf) must be a positive number in m/s.');
    }
    if (typeof e.spacecraftMassKg !== 'number' || !isFinite(e.spacecraftMassKg) || e.spacecraftMassKg <= 0) {
      errors.push('Spacecraft mass must be a positive number in kg.');
    }
    if (typeof e.periapsisAltitudeKm !== 'number' || !isFinite(e.periapsisAltitudeKm)) {
      errors.push('Periapsis altitude must be a finite number in km.');
    }
    if (typeof e.impactParameterKm !== 'number' || !isFinite(e.impactParameterKm) || e.impactParameterKm < 0) {
      errors.push('Impact parameter must be a non-negative finite number in km.');
    }
    if (typeof e.approachAngleDeg !== 'number' || !isFinite(e.approachAngleDeg)) {
      errors.push('Approach angle must be a finite number in degrees.');
    }
    if (e.passType !== 'TRAILING' && e.passType !== 'LEADING') {
      errors.push('Encounter pass type must be either "TRAILING" or "LEADING".');
    }
  }

  // Validate Advanced
  if (s.advanced) {
    const a = s.advanced;
    if (typeof a.timeStepCoeff === 'number' && (a.timeStepCoeff <= 0 || a.timeStepCoeff > 0.5)) {
      errors.push('Numerical time-step coefficient must be between 0.001 and 0.5.');
    }
    if (typeof a.entryDistanceMultiple === 'number' && (a.entryDistanceMultiple < 2 || a.entryDistanceMultiple > 100)) {
      errors.push('Entry distance multiple must be between 2 and 100.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Converts a FlybyScenarioConfig into authoritative FlybyInitialConditions and runner options
 */
export function scenarioToInitialConditions(scenario: FlybyScenarioConfig): {
  config: FlybyInitialConditions;
  options: {
    maxPoints?: number;
    entryDistanceMultiple?: number;
    timeStepCoeff?: number;
    simulationDurationS?: number;
    trajectoryMode?: 'NUMERICAL_RK4' | 'ANALYTICAL_IDEAL';
  };
} {
  const p = scenario.planet;
  const e = scenario.encounter;
  const a = scenario.advanced;

  // Build PlanetaryBodyData
  const planetaryData: PlanetaryBodyData = {
    id: p.presetId === 'CUSTOM' ? `CUSTOM_${scenario.id}` : p.presetId,
    name: p.name,
    mu: p.mu,
    radiusM: p.radiusM,
    semiMajorAxisM: p.semiMajorAxisM,
    orbitalSpeedMPerS: p.velocityMode === 'CIRCULAR_ORBIT' ? p.orbitalSpeedMPerS : Math.sqrt(p.customVelocityVectorMPerS.x ** 2 + p.customVelocityVectorMPerS.y ** 2 + p.customVelocityVectorMPerS.z ** 2),
    massKg: p.massKg,
    color: p.color || '#4f9fff',
    description: p.isTheoretical ? 'User-defined theoretical planetary body.' : 'Solar system planetary body.',
    isTheoretical: p.isTheoretical,
    customVelocityMPerS: p.velocityMode === 'CUSTOM_VECTOR' ? p.customVelocityVectorMPerS : undefined,
  };

  const targetPeriapsisM = p.radiusM + e.periapsisAltitudeKm * 1000.0;
  const impactParameterM = e.impactParameterKm * 1000.0;

  const config: FlybyInitialConditions = {
    planet: planetaryData,
    vInfSpeedMPerS: e.vInfSpeedMPerS,
    approachAngleDeg: e.approachAngleDeg,
    passType: e.passType,
    spacecraftMassKg: e.spacecraftMassKg,
    targetPeriapsisM: e.distanceMode === 'PERIAPSIS_ALTITUDE' ? targetPeriapsisM : undefined,
    impactParameterM: e.distanceMode === 'IMPACT_PARAMETER' ? impactParameterM : undefined,
    planetVelocityVectorMPerS:
      p.velocityMode === 'CUSTOM_VECTOR'
        ? new Vector3D(p.customVelocityVectorMPerS.x, p.customVelocityVectorMPerS.y, p.customVelocityVectorMPerS.z)
        : undefined,
    planetInitialPhaseDeg: p.initialPhaseDeg,
    simulationDurationS: a.simulationDurationS,
    trajectoryMode: a.trajectoryMode,
  };

  const options = {
    timeStepCoeff: a.timeStepCoeff,
    entryDistanceMultiple: a.entryDistanceMultiple,
    simulationDurationS: a.simulationDurationS,
    trajectoryMode: a.trajectoryMode,
  };

  return { config, options };
}

/**
 * Storage Helpers
 */
export function loadSavedScenarios(): FlybyScenarioConfig[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [DEFAULT_FLYBY_SCENARIO];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_FLYBY_SCENARIOS);
    if (!raw) return [DEFAULT_FLYBY_SCENARIO];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.filter((item) => validateScenario(item).isValid);
    }
  } catch (err) {
    console.warn('Failed to parse saved flyby scenarios from localStorage', err);
  }
  return [DEFAULT_FLYBY_SCENARIO];
}

export function saveScenario(scenario: FlybyScenarioConfig): void {
  if (typeof window === 'undefined' || !window.localStorage) return;

  const validation = validateScenario(scenario);
  if (!validation.isValid) {
    throw new Error(`Cannot save invalid scenario: ${validation.errors.join('; ')}`);
  }

  const existing = loadSavedScenarios();
  const index = existing.findIndex((s) => s.id === scenario.id);
  const updatedScenario = { ...scenario, updatedAt: new Date().toISOString() };

  if (index >= 0) {
    existing[index] = updatedScenario;
  } else {
    existing.unshift(updatedScenario);
  }

  window.localStorage.setItem(STORAGE_KEY_FLYBY_SCENARIOS, JSON.stringify(existing));
}

export function deleteScenario(scenarioId: string): FlybyScenarioConfig[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];

  const existing = loadSavedScenarios();
  const filtered = existing.filter((s) => s.id !== scenarioId);
  window.localStorage.setItem(STORAGE_KEY_FLYBY_SCENARIOS, JSON.stringify(filtered));
  return filtered;
}

export function duplicateScenario(scenario: FlybyScenarioConfig): FlybyScenarioConfig {
  const now = new Date().toISOString();
  return {
    ...scenario,
    id: `custom-scenario-${Date.now()}`,
    name: `Copy of ${scenario.name}`,
    createdAt: now,
    updatedAt: now,
  };
}

export function exportScenarioToJSON(scenario: FlybyScenarioConfig): string {
  return JSON.stringify(scenario, null, 2);
}

export function importScenarioFromJSON(jsonString: string): {
  success: boolean;
  scenario?: FlybyScenarioConfig;
  error?: string;
} {
  try {
    const parsed = JSON.parse(jsonString);
    const validation = validateScenario(parsed);
    if (!validation.isValid) {
      return {
        success: false,
        error: `Import validation failed: ${validation.errors.join(' ')}`,
      };
    }
    // Assign new ID to avoid clashing with existing items
    const imported: FlybyScenarioConfig = {
      ...parsed,
      id: `imported-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    return { success: true, scenario: imported };
  } catch (err) {
    return {
      success: false,
      error: `Malformed JSON string: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
