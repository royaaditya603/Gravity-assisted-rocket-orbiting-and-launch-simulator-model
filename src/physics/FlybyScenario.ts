import { PlanetaryBodyData, PLANETARY_BODIES, G_NEWTON, MU_SUN, AU } from './constants';
import { FlybyEngine, FlybyInitialConditions, FlybyPassType } from './FlybyEngine';
import { Vector3D } from './Vector3D';

export type ConfigurationMode = 'PLANET_PRESET' | 'CUSTOM_PLANET' | 'CUSTOM_FLYBY' | 'ADVANCED_MISSION';
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
    presetId: string; // 'JUPITER' | 'SATURN' | 'EARTH' | 'MARS' | 'CUSTOM' | etc.
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
    customPositionVectorM?: { x: number; y: number; z: number };
    initialPhaseDeg: number;
    color?: string;
    sourceOrReference?: string;
    modelSimplificationNote?: string;
    muOverride?: number; // Optional gravitational parameter override for advanced users
  };

  encounter: {
    vInfSpeedMPerS: number;
    approachAngleDeg: number;
    passType: FlybyPassType;
    distanceMode: EncounterDistanceMode;
    periapsisAltitudeKm: number;
    impactParameterKm: number;
    spacecraftMassKg: number;
    customInitialState?: {
      enabled: boolean;
      positionKm: { x: number; y: number; z: number };
      velocityKmPerS: { x: number; y: number; z: number };
    };
  };

  advanced: {
    timeStepCoeff: number; // default 0.015
    fixedTimeStepS?: number; // optional fixed time step (s)
    numericalTolerance?: number; // optional relative tolerance
    entryDistanceMultiple: number; // default 20
    simulationWindowStartS?: number; // default 0
    simulationDurationS?: number;
    trajectoryMode: 'NUMERICAL_RK4' | 'ANALYTICAL_IDEAL';
  };
}

export const STORAGE_KEY_FLYBY_SCENARIOS = 'ASTRA_FLYBY_SCENARIOS_V1';

/**
 * Checks whether planetary mass and gravitational parameter μ are mutually consistent
 * according to Newton's constant G: μ = G * M.
 */
export function checkMassMuConsistency(
  massKg: number,
  mu: number
): { isConsistent: boolean; relativeDifference: number; warning?: string } {
  if (massKg <= 0 || mu <= 0) {
    return { isConsistent: false, relativeDifference: 1.0, warning: 'Non-positive mass or mu provided.' };
  }
  const derivedMu = G_NEWTON * massKg;
  const relDiff = Math.abs(mu - derivedMu) / mu;
  const isConsistent = relDiff <= 0.005; // Within 0.5% tolerance
  let warning: string | undefined;
  if (!isConsistent) {
    warning = `Warning: Planet mass (${massKg.toExponential(3)} kg) and gravitational parameter μ (${mu.toExponential(3)} m³/s²) differ by ${(relDiff * 100).toFixed(2)}% from G·M. The selected authoritative parameter will govern calculations.`;
  }
  return { isConsistent, relativeDifference: relDiff, warning };
}

/**
 * Assesses collision and unrealistic closest-approach hazards relative to planetary radius.
 */
export function checkClosestApproachHazards(
  periapsisAltitudeKm: number,
  planetRadiusM: number
): {
  isCollision: boolean;
  isUnrealisticClosestApproach: boolean;
  message?: string;
} {
  const planetRadiusKm = planetRadiusM / 1000.0;
  if (periapsisAltitudeKm <= 0) {
    return {
      isCollision: true,
      isUnrealisticClosestApproach: true,
      message: `Direct surface collision hazard: periapsis altitude is ${periapsisAltitudeKm.toFixed(1)} km (inside physical planet radius of ${planetRadiusKm.toLocaleString()} km).`,
    };
  }
  // If altitude is less than 5% of planetary radius or within dense atmospheric envelope
  if (periapsisAltitudeKm < Math.min(100.0, 0.05 * planetRadiusKm)) {
    return {
      isCollision: false,
      isUnrealisticClosestApproach: true,
      message: `Unrealistic closest approach hazard: periapsis altitude (${periapsisAltitudeKm.toFixed(1)} km) is within dense atmospheric boundary or severe tidal shear zone.`,
    };
  }
  return {
    isCollision: false,
    isUnrealisticClosestApproach: false,
  };
}

/**
 * Creates a default scenario configuration for a given planetary preset
 */
export function createScenarioFromPreset(
  presetKey: 'JUPITER' | 'SATURN' | 'EARTH' | 'MARS' | 'CUSTOM' | 'VENUS' | 'MERCURY' | 'URANUS' | 'NEPTUNE' = 'JUPITER'
): FlybyScenarioConfig {
  const planet = PLANETARY_BODIES[presetKey] || PLANETARY_BODIES.JUPITER;

  let vInfDefault = 10000.0;
  let altKmDefault = 45000.0;

  switch (presetKey) {
    case 'JUPITER':
      vInfDefault = 10000.0;
      altKmDefault = 45000.0;
      break;
    case 'SATURN':
      vInfDefault = 9000.0;
      altKmDefault = 35000.0;
      break;
    case 'EARTH':
      vInfDefault = 8000.0;
      altKmDefault = 2500.0;
      break;
    case 'MARS':
      vInfDefault = 5000.0;
      altKmDefault = 1200.0;
      break;
    case 'VENUS':
      vInfDefault = 7500.0;
      altKmDefault = 1500.0;
      break;
    case 'CUSTOM':
      vInfDefault = 10000.0;
      altKmDefault = 15000.0;
      break;
    default:
      vInfDefault = 8000.0;
      altKmDefault = 5000.0;
      break;
  }

  const rpM = planet.radiusM + altKmDefault * 1000.0;
  const bM = FlybyEngine.periapsisToImpactParameter(rpM, vInfDefault, planet.mu);
  const now = new Date().toISOString();

  const isCustom = presetKey === 'CUSTOM';

  return {
    id: `preset-${planet.id.toLowerCase()}-${Date.now()}`,
    name: `${planet.name} Nominal Flyby Scenario`,
    description: `Standard baseline hyperbolic encounter with ${planet.name}.`,
    mode: isCustom ? 'CUSTOM_PLANET' : 'PLANET_PRESET',
    createdAt: now,
    updatedAt: now,
    version: 1,

    planet: {
      presetId: planet.id,
      name: planet.name,
      isTheoretical: planet.isTheoretical ?? false,
      massKg: planet.massKg,
      radiusM: planet.radiusM,
      mu: planet.mu,
      authority: 'MU_AUTHORITATIVE',
      velocityMode: 'CIRCULAR_ORBIT',
      semiMajorAxisM: planet.semiMajorAxisM,
      orbitalSpeedMPerS: planet.orbitalSpeedMPerS,
      customVelocityVectorMPerS: { x: 0, y: planet.orbitalSpeedMPerS, z: 0 },
      customPositionVectorM: { x: planet.semiMajorAxisM, y: 0, z: 0 },
      initialPhaseDeg: 0,
      color: planet.color,
      sourceOrReference: planet.sourceOrReference,
      modelSimplificationNote: planet.modelSimplificationNote,
    },

    encounter: {
      vInfSpeedMPerS: vInfDefault,
      approachAngleDeg: 0,
      passType: 'TRAILING',
      distanceMode: 'PERIAPSIS_ALTITUDE',
      periapsisAltitudeKm: altKmDefault,
      impactParameterKm: bM / 1000.0,
      spacecraftMassKg: 1000.0,
      customInitialState: {
        enabled: false,
        positionKm: { x: -planet.radiusM * 0.02, y: bM / 1000.0, z: 0 },
        velocityKmPerS: { x: vInfDefault / 1000.0, y: 0, z: 0 },
      },
    },

    advanced: {
      timeStepCoeff: 0.015,
      entryDistanceMultiple: 20.0,
      trajectoryMode: 'NUMERICAL_RK4',
      simulationWindowStartS: 0,
    },
  };
}

export const DEFAULT_FLYBY_SCENARIO = createScenarioFromPreset('JUPITER');

/**
 * Educational default scenarios
 */
export function getEducationalPresets(): FlybyScenarioConfig[] {
  const now = new Date().toISOString();

  // 1. Voyager 2 Jupiter Slingshot (1979)
  const v2Jup = createScenarioFromPreset('JUPITER');
  v2Jup.id = 'edu-voyager2-jupiter';
  v2Jup.name = 'Voyager 2: Jupiter Gravity Assist (1979)';
  v2Jup.description = 'Monumental trailing pass behind Jupiter that deflected Voyager 2 outward toward Saturn and the outer planets with massive heliocentric boost.';
  v2Jup.encounter.vInfSpeedMPerS = 10100.0;
  v2Jup.encounter.passType = 'TRAILING';
  v2Jup.encounter.periapsisAltitudeKm = 570000.0;
  const rpV2 = v2Jup.planet.radiusM + 570000.0 * 1000.0;
  v2Jup.encounter.impactParameterKm = FlybyEngine.periapsisToImpactParameter(rpV2, 10100.0, v2Jup.planet.mu) / 1000.0;
  v2Jup.encounter.spacecraftMassKg = 722.0;

  // 2. Cassini Earth Flyby (1999)
  const cassiniEarth = createScenarioFromPreset('EARTH');
  cassiniEarth.id = 'edu-cassini-earth';
  cassiniEarth.name = 'Cassini-Huygens: Earth Resonant Slingshot (1999)';
  cassiniEarth.description = 'Second Earth flyby of Cassini mission providing an orbital pump of ~5.5 km/s to boost the probe into Jupiter transfer orbit.';
  cassiniEarth.encounter.vInfSpeedMPerS = 16000.0;
  cassiniEarth.encounter.passType = 'TRAILING';
  cassiniEarth.encounter.periapsisAltitudeKm = 1171.0;
  const rpCass = cassiniEarth.planet.radiusM + 1171.0 * 1000.0;
  cassiniEarth.encounter.impactParameterKm = FlybyEngine.periapsisToImpactParameter(rpCass, 16000.0, cassiniEarth.planet.mu) / 1000.0;
  cassiniEarth.encounter.spacecraftMassKg = 2150.0;

  // 3. Mars Inbound Braking Assist
  const marsBrake = createScenarioFromPreset('MARS');
  marsBrake.id = 'edu-mars-braking';
  marsBrake.name = 'Mars: Inbound Gravity Braking Assist (Leading Pass)';
  marsBrake.description = 'Leading pass in front of Mars orbital motion vector, shedding heliocentric kinetic energy to drop the orbital perihelion toward Venus or Earth.';
  marsBrake.encounter.vInfSpeedMPerS = 5200.0;
  marsBrake.encounter.passType = 'LEADING';
  marsBrake.encounter.periapsisAltitudeKm = 800.0;
  const rpMars = marsBrake.planet.radiusM + 800.0 * 1000.0;
  marsBrake.encounter.impactParameterKm = FlybyEngine.periapsisToImpactParameter(rpMars, 5200.0, marsBrake.planet.mu) / 1000.0;
  marsBrake.encounter.spacecraftMassKg = 1200.0;

  // 4. Saturn Ring-Grazing Encounter
  const saturnGraze = createScenarioFromPreset('SATURN');
  saturnGraze.id = 'edu-saturn-graze';
  saturnGraze.name = 'Saturn: High-Deflection Ring-Grazing Pass';
  saturnGraze.description = 'Close encounter just above Saturn cloud tops and inside the main ring system, demonstrating high deflection geometry around a ringed gas giant.';
  saturnGraze.encounter.vInfSpeedMPerS = 7800.0;
  saturnGraze.encounter.passType = 'TRAILING';
  saturnGraze.encounter.periapsisAltitudeKm = 8500.0;
  const rpSat = saturnGraze.planet.radiusM + 8500.0 * 1000.0;
  saturnGraze.encounter.impactParameterKm = FlybyEngine.periapsisToImpactParameter(rpSat, 7800.0, saturnGraze.planet.mu) / 1000.0;
  saturnGraze.encounter.spacecraftMassKg = 850.0;

  return [v2Jup, cassiniEarth, marsBrake, saturnGraze];
}

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
    if (p.muOverride !== undefined && (!isFinite(p.muOverride) || p.muOverride <= 0)) {
      errors.push('Gravitational parameter override must be a finite positive number in m³/s².');
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
    if (typeof e.approachAngleDeg !== 'number' || !isFinite(e.approachAngleDeg) || e.approachAngleDeg < -360 || e.approachAngleDeg > 360) {
      errors.push('Approach angle must be a finite number in degrees between -360 and 360.');
    }
    if (e.passType !== 'TRAILING' && e.passType !== 'LEADING') {
      errors.push('Encounter pass type must be either "TRAILING" or "LEADING".');
    }

    if (e.customInitialState && e.customInitialState.enabled) {
      const pInit = e.customInitialState.positionKm;
      const vInit = e.customInitialState.velocityKmPerS;
      if (!pInit || !isFinite(pInit.x) || !isFinite(pInit.y) || !isFinite(pInit.z)) {
        errors.push('Starting position vector must contain finite numbers in km.');
      }
      if (!vInit || !isFinite(vInit.x) || !isFinite(vInit.y) || !isFinite(vInit.z)) {
        errors.push('Initial velocity vector must contain finite numbers in km/s.');
      }
    }
  }

  // Validate Advanced
  if (s.advanced) {
    const a = s.advanced;
    if (typeof a.timeStepCoeff === 'number' && (a.timeStepCoeff <= 0 || a.timeStepCoeff > 0.5)) {
      errors.push('Numerical time-step coefficient must be between 0.001 and 0.5.');
    }
    if (a.fixedTimeStepS !== undefined && (a.fixedTimeStepS <= 0 || !isFinite(a.fixedTimeStepS))) {
      errors.push('Fixed time-step must be a positive finite number of seconds.');
    }
    if (a.numericalTolerance !== undefined && (a.numericalTolerance <= 0 || !isFinite(a.numericalTolerance))) {
      errors.push('Numerical tolerance must be a positive finite number.');
    }
    if (typeof a.entryDistanceMultiple === 'number' && (a.entryDistanceMultiple < 2 || a.entryDistanceMultiple > 100)) {
      errors.push('Entry distance multiple must be between 2 and 100.');
    }
    if (a.simulationDurationS !== undefined && (a.simulationDurationS <= 0 || !isFinite(a.simulationDurationS))) {
      errors.push('Simulation duration must be a positive finite number of seconds.');
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
    fixedTimeStepS?: number;
    numericalTolerance?: number;
    simulationDurationS?: number;
    simulationWindowStartS?: number;
    trajectoryMode?: 'NUMERICAL_RK4' | 'ANALYTICAL_IDEAL';
  };
} {
  const p = scenario.planet;
  const e = scenario.encounter;
  const a = scenario.advanced;

  const effectiveMu = p.muOverride && p.muOverride > 0 ? p.muOverride : p.mu;

  // Build PlanetaryBodyData
  const planetaryData: PlanetaryBodyData = {
    id: p.presetId === 'CUSTOM' ? `CUSTOM_${scenario.id}` : p.presetId,
    name: p.name,
    mu: effectiveMu,
    radiusM: p.radiusM,
    semiMajorAxisM: p.semiMajorAxisM,
    orbitalSpeedMPerS:
      p.velocityMode === 'CIRCULAR_ORBIT'
        ? p.orbitalSpeedMPerS
        : Math.sqrt(p.customVelocityVectorMPerS.x ** 2 + p.customVelocityVectorMPerS.y ** 2 + p.customVelocityVectorMPerS.z ** 2),
    massKg: p.massKg,
    color: p.color || '#4f9fff',
    description: p.isTheoretical ? 'User-defined theoretical planetary body.' : 'Solar system planetary body.',
    isTheoretical: p.isTheoretical,
    customVelocityMPerS: p.velocityMode === 'CUSTOM_VECTOR' ? p.customVelocityVectorMPerS : undefined,
    sourceOrReference: p.sourceOrReference,
    modelSimplificationNote: p.modelSimplificationNote,
  };

  const targetPeriapsisM = p.radiusM + e.periapsisAltitudeKm * 1000.0;
  const impactParameterM = e.impactParameterKm * 1000.0;

  let customInitState: { posPlanetM: Vector3D; velPlanetMPerS: Vector3D } | undefined = undefined;
  if (e.customInitialState && e.customInitialState.enabled) {
    customInitState = {
      posPlanetM: new Vector3D(
        e.customInitialState.positionKm.x * 1000.0,
        e.customInitialState.positionKm.y * 1000.0,
        e.customInitialState.positionKm.z * 1000.0
      ),
      velPlanetMPerS: new Vector3D(
        e.customInitialState.velocityKmPerS.x * 1000.0,
        e.customInitialState.velocityKmPerS.y * 1000.0,
        e.customInitialState.velocityKmPerS.z * 1000.0
      ),
    };
  }

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
    simulationWindowStartS: a.simulationWindowStartS,
    fixedTimeStepS: a.fixedTimeStepS,
    numericalTolerance: a.numericalTolerance,
    customInitialState: customInitState,
    trajectoryMode: a.trajectoryMode,
  };

  const options = {
    timeStepCoeff: a.timeStepCoeff,
    fixedTimeStepS: a.fixedTimeStepS,
    numericalTolerance: a.numericalTolerance,
    entryDistanceMultiple: a.entryDistanceMultiple,
    simulationDurationS: a.simulationDurationS,
    simulationWindowStartS: a.simulationWindowStartS,
    trajectoryMode: a.trajectoryMode,
  };

  return { config, options };
}

/**
 * Detects differences between baseline scenario (e.g. last run) and current draft
 */
export interface ParameterDiff {
  category: 'PLANET' | 'ENCOUNTER' | 'ADVANCED';
  paramKey: string;
  label: string;
  oldValue: any;
  newValue: any;
  formattedOld: string;
  formattedNew: string;
}

export function detectScenarioChanges(
  baseline: FlybyScenarioConfig,
  current: FlybyScenarioConfig
): ParameterDiff[] {
  const diffs: ParameterDiff[] = [];

  // Planet checks
  if (baseline.planet.name !== current.planet.name) {
    diffs.push({
      category: 'PLANET',
      paramKey: 'planet.name',
      label: 'Planet Designation',
      oldValue: baseline.planet.name,
      newValue: current.planet.name,
      formattedOld: baseline.planet.name,
      formattedNew: current.planet.name,
    });
  }
  if (Math.abs(baseline.planet.massKg - current.planet.massKg) > 1e18) {
    diffs.push({
      category: 'PLANET',
      paramKey: 'planet.massKg',
      label: 'Planet Mass',
      oldValue: baseline.planet.massKg,
      newValue: current.planet.massKg,
      formattedOld: `${baseline.planet.massKg.toExponential(3)} kg`,
      formattedNew: `${current.planet.massKg.toExponential(3)} kg`,
    });
  }
  if (Math.abs(baseline.planet.radiusM - current.planet.radiusM) > 10.0) {
    diffs.push({
      category: 'PLANET',
      paramKey: 'planet.radiusM',
      label: 'Planet Radius',
      oldValue: baseline.planet.radiusM,
      newValue: current.planet.radiusM,
      formattedOld: `${(baseline.planet.radiusM / 1000).toLocaleString()} km`,
      formattedNew: `${(current.planet.radiusM / 1000).toLocaleString()} km`,
    });
  }
  if (Math.abs(baseline.planet.mu - current.planet.mu) > 1e8) {
    diffs.push({
      category: 'PLANET',
      paramKey: 'planet.mu',
      label: 'Gravitational Parameter (μ)',
      oldValue: baseline.planet.mu,
      newValue: current.planet.mu,
      formattedOld: `${baseline.planet.mu.toExponential(3)} m³/s²`,
      formattedNew: `${current.planet.mu.toExponential(3)} m³/s²`,
    });
  }
  if (baseline.planet.muOverride !== current.planet.muOverride) {
    diffs.push({
      category: 'PLANET',
      paramKey: 'planet.muOverride',
      label: 'μ Override',
      oldValue: baseline.planet.muOverride,
      newValue: current.planet.muOverride,
      formattedOld: baseline.planet.muOverride ? `${baseline.planet.muOverride.toExponential(3)} m³/s²` : 'None',
      formattedNew: current.planet.muOverride ? `${current.planet.muOverride.toExponential(3)} m³/s²` : 'None',
    });
  }
  if (Math.abs(baseline.planet.semiMajorAxisM - current.planet.semiMajorAxisM) > 1e6) {
    diffs.push({
      category: 'PLANET',
      paramKey: 'planet.semiMajorAxisM',
      label: 'Orbital Semi-Major Axis',
      oldValue: baseline.planet.semiMajorAxisM,
      newValue: current.planet.semiMajorAxisM,
      formattedOld: `${(baseline.planet.semiMajorAxisM / AU).toFixed(2)} AU`,
      formattedNew: `${(current.planet.semiMajorAxisM / AU).toFixed(2)} AU`,
    });
  }

  // Encounter checks
  if (Math.abs(baseline.encounter.vInfSpeedMPerS - current.encounter.vInfSpeedMPerS) > 1.0) {
    diffs.push({
      category: 'ENCOUNTER',
      paramKey: 'encounter.vInfSpeedMPerS',
      label: 'Hyperbolic Excess (v_∞)',
      oldValue: baseline.encounter.vInfSpeedMPerS,
      newValue: current.encounter.vInfSpeedMPerS,
      formattedOld: `${(baseline.encounter.vInfSpeedMPerS / 1000).toFixed(2)} km/s`,
      formattedNew: `${(current.encounter.vInfSpeedMPerS / 1000).toFixed(2)} km/s`,
    });
  }
  if (baseline.encounter.passType !== current.encounter.passType) {
    diffs.push({
      category: 'ENCOUNTER',
      paramKey: 'encounter.passType',
      label: 'Flyby Orientation',
      oldValue: baseline.encounter.passType,
      newValue: current.encounter.passType,
      formattedOld: baseline.encounter.passType,
      formattedNew: current.encounter.passType,
    });
  }
  if (Math.abs(baseline.encounter.periapsisAltitudeKm - current.encounter.periapsisAltitudeKm) > 0.5) {
    diffs.push({
      category: 'ENCOUNTER',
      paramKey: 'encounter.periapsisAltitudeKm',
      label: 'Periapsis Altitude (h_p)',
      oldValue: baseline.encounter.periapsisAltitudeKm,
      newValue: current.encounter.periapsisAltitudeKm,
      formattedOld: `${baseline.encounter.periapsisAltitudeKm.toFixed(1)} km`,
      formattedNew: `${current.encounter.periapsisAltitudeKm.toFixed(1)} km`,
    });
  }
  if (Math.abs(baseline.encounter.impactParameterKm - current.encounter.impactParameterKm) > 0.5) {
    diffs.push({
      category: 'ENCOUNTER',
      paramKey: 'encounter.impactParameterKm',
      label: 'Impact Parameter (b)',
      oldValue: baseline.encounter.impactParameterKm,
      newValue: current.encounter.impactParameterKm,
      formattedOld: `${baseline.encounter.impactParameterKm.toFixed(1)} km`,
      formattedNew: `${current.encounter.impactParameterKm.toFixed(1)} km`,
    });
  }
  if (Math.abs(baseline.encounter.approachAngleDeg - current.encounter.approachAngleDeg) > 0.1) {
    diffs.push({
      category: 'ENCOUNTER',
      paramKey: 'encounter.approachAngleDeg',
      label: 'Approach Angle (θ_app)',
      oldValue: baseline.encounter.approachAngleDeg,
      newValue: current.encounter.approachAngleDeg,
      formattedOld: `${baseline.encounter.approachAngleDeg.toFixed(1)}°`,
      formattedNew: `${current.encounter.approachAngleDeg.toFixed(1)}°`,
    });
  }
  if (Math.abs(baseline.encounter.spacecraftMassKg - current.encounter.spacecraftMassKg) > 1.0) {
    diffs.push({
      category: 'ENCOUNTER',
      paramKey: 'encounter.spacecraftMassKg',
      label: 'Spacecraft Mass',
      oldValue: baseline.encounter.spacecraftMassKg,
      newValue: current.encounter.spacecraftMassKg,
      formattedOld: `${baseline.encounter.spacecraftMassKg.toLocaleString()} kg`,
      formattedNew: `${current.encounter.spacecraftMassKg.toLocaleString()} kg`,
    });
  }

  // Advanced checks
  if (baseline.advanced.trajectoryMode !== current.advanced.trajectoryMode) {
    diffs.push({
      category: 'ADVANCED',
      paramKey: 'advanced.trajectoryMode',
      label: 'Trajectory Model',
      oldValue: baseline.advanced.trajectoryMode,
      newValue: current.advanced.trajectoryMode,
      formattedOld: baseline.advanced.trajectoryMode,
      formattedNew: current.advanced.trajectoryMode,
    });
  }
  if (baseline.advanced.timeStepCoeff !== current.advanced.timeStepCoeff) {
    diffs.push({
      category: 'ADVANCED',
      paramKey: 'advanced.timeStepCoeff',
      label: 'Step Coefficient (η)',
      oldValue: baseline.advanced.timeStepCoeff,
      newValue: current.advanced.timeStepCoeff,
      formattedOld: `${baseline.advanced.timeStepCoeff}`,
      formattedNew: `${current.advanced.timeStepCoeff}`,
    });
  }

  return diffs;
}

/**
 * Parameter Sensitivity Sweep Analysis Engine
 */
export type SensitivityVariable =
  | 'V_INF'
  | 'PERIAPSIS_ALTITUDE'
  | 'IMPACT_PARAMETER'
  | 'APPROACH_ANGLE'
  | 'PLANET_MASS'
  | 'SPACECRAFT_MASS';

export interface SensitivityPoint {
  parameterValue: number;
  periapsisAltitudeKm: number;
  impactParameterKm: number;
  deflectionAngleDeg: number;
  deltaVSunSpeedKmPerS: number;
  deltaVVectorMagnitudeKmPerS: number;
  maxSpeedPlanetKmPerS: number;
  vOutSunSpeedKmPerS: number;
  deltaKineticEnergyMJ: number;
  isCollision: boolean;
}

export interface SensitivitySweepResult {
  variable: SensitivityVariable;
  variableLabel: string;
  unit: string;
  baselineValue: number;
  points: SensitivityPoint[];
}

/**
 * Sweeps a single parameter without mutating the baseline scenario.
 */
export function runSensitivitySweep(
  baseScenario: FlybyScenarioConfig,
  variable: SensitivityVariable,
  minVal: number,
  maxVal: number,
  steps: number = 15
): SensitivitySweepResult {
  const points: SensitivityPoint[] = [];
  const safeSteps = Math.max(2, Math.min(50, steps));
  const stepSize = (maxVal - minVal) / (safeSteps - 1);

  let variableLabel = '';
  let unit = '';
  let baselineValue = 0;

  switch (variable) {
    case 'V_INF':
      variableLabel = 'Hyperbolic Excess (v_∞)';
      unit = 'km/s';
      baselineValue = baseScenario.encounter.vInfSpeedMPerS / 1000.0;
      break;
    case 'PERIAPSIS_ALTITUDE':
      variableLabel = 'Periapsis Altitude (h_p)';
      unit = 'km';
      baselineValue = baseScenario.encounter.periapsisAltitudeKm;
      break;
    case 'IMPACT_PARAMETER':
      variableLabel = 'Impact Parameter (b)';
      unit = 'km';
      baselineValue = baseScenario.encounter.impactParameterKm;
      break;
    case 'APPROACH_ANGLE':
      variableLabel = 'Approach Angle (θ_app)';
      unit = 'deg';
      baselineValue = baseScenario.encounter.approachAngleDeg;
      break;
    case 'PLANET_MASS':
      variableLabel = 'Planet Mass';
      unit = 'kg';
      baselineValue = baseScenario.planet.massKg;
      break;
    case 'SPACECRAFT_MASS':
      variableLabel = 'Spacecraft Mass';
      unit = 'kg';
      baselineValue = baseScenario.encounter.spacecraftMassKg;
      break;
  }

  for (let i = 0; i < safeSteps; i++) {
    const val = minVal + i * stepSize;
    // Deep clone scenario to avoid silently mutating anything
    const cloned: FlybyScenarioConfig = JSON.parse(JSON.stringify(baseScenario));

    if (variable === 'V_INF') {
      cloned.encounter.vInfSpeedMPerS = val * 1000.0;
      // Resync impact parameter
      const synced = syncAltitudeAndImpactParameter(
        cloned.encounter.periapsisAltitudeKm,
        cloned.encounter.impactParameterKm,
        cloned.encounter.distanceMode,
        cloned.planet.radiusM,
        cloned.encounter.vInfSpeedMPerS,
        cloned.planet.mu
      );
      cloned.encounter.impactParameterKm = synced.impactParameterKm;
    } else if (variable === 'PERIAPSIS_ALTITUDE') {
      cloned.encounter.periapsisAltitudeKm = val;
      const synced = syncAltitudeAndImpactParameter(
        val,
        cloned.encounter.impactParameterKm,
        'PERIAPSIS_ALTITUDE',
        cloned.planet.radiusM,
        cloned.encounter.vInfSpeedMPerS,
        cloned.planet.mu
      );
      cloned.encounter.impactParameterKm = synced.impactParameterKm;
    } else if (variable === 'IMPACT_PARAMETER') {
      cloned.encounter.impactParameterKm = val;
      const synced = syncAltitudeAndImpactParameter(
        cloned.encounter.periapsisAltitudeKm,
        val,
        'IMPACT_PARAMETER',
        cloned.planet.radiusM,
        cloned.encounter.vInfSpeedMPerS,
        cloned.planet.mu
      );
      cloned.encounter.periapsisAltitudeKm = synced.periapsisAltitudeKm;
    } else if (variable === 'APPROACH_ANGLE') {
      cloned.encounter.approachAngleDeg = val;
    } else if (variable === 'PLANET_MASS') {
      cloned.planet.massKg = val;
      const synced = syncMassAndMu(val, cloned.planet.mu, 'MASS_AUTHORITATIVE');
      cloned.planet.mu = synced.mu;
      // Resync impact parameter
      const distSynced = syncAltitudeAndImpactParameter(
        cloned.encounter.periapsisAltitudeKm,
        cloned.encounter.impactParameterKm,
        cloned.encounter.distanceMode,
        cloned.planet.radiusM,
        cloned.encounter.vInfSpeedMPerS,
        cloned.planet.mu
      );
      cloned.encounter.impactParameterKm = distSynced.impactParameterKm;
    } else if (variable === 'SPACECRAFT_MASS') {
      cloned.encounter.spacecraftMassKg = val;
    }

    const { config } = scenarioToInitialConditions(cloned);
    const analytical = FlybyEngine.computeAnalytical(config);
    const rpM = analytical.periapsisRadiusM;
    const isCol = analytical.isPhysicalCollision;
    const vPeriMPerS = rpM > 0 ? Math.sqrt(config.vInfSpeedMPerS ** 2 + (2.0 * config.planet.mu) / rpM) : 0;

    points.push({
      parameterValue: val,
      periapsisAltitudeKm: analytical.periapsisAltitudeM / 1000.0,
      impactParameterKm: analytical.impactParameterM / 1000.0,
      deflectionAngleDeg: analytical.deflectionAngleDeg,
      deltaVSunSpeedKmPerS: analytical.deltaVSunSpeedMPerS / 1000.0,
      deltaVVectorMagnitudeKmPerS: analytical.deltaVVectorMagnitudeMPerS / 1000.0,
      maxSpeedPlanetKmPerS: vPeriMPerS / 1000.0,
      vOutSunSpeedKmPerS: analytical.vOutSunSpeedMPerS / 1000.0,
      deltaKineticEnergyMJ: analytical.deltaKineticEnergyJ / 1e6,
      isCollision: isCol,
    });
  }

  return {
    variable,
    variableLabel,
    unit,
    baselineValue,
    points,
  };
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
      const valid = parsed.filter((item) => validateScenario(item).isValid);
      return valid.length > 0 ? valid : [DEFAULT_FLYBY_SCENARIO];
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
    ...JSON.parse(JSON.stringify(scenario)),
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
