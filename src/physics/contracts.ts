/**
 * ASTRA - Canonical Astrodynamics Interfaces & Shared Contracts (Phase 2)
 *
 * Authoritative integration contract for the ASTRA Gravity Assist & Orbital Dynamics Simulator.
 *
 * All internal quantities are strictly in SI units:
 *   - Distance / Length: metres (m)
 *   - Mass: kilograms (kg)
 *   - Time: seconds (s)
 *   - Velocity: metres per second (m/s)
 *   - Acceleration: metres per second squared (m/s²)
 *   - Angles: radians (rad) internally (degrees provided for UI boundaries)
 *   - Gravitational parameter: m³/s²
 *   - Energy: Joules (J) / Specific Energy: Joules per kilogram (J/kg)
 *
 * Explicit conversions must be performed at UI boundaries using the UIConverters utilities.
 */

import { Vector3D, type IVector3D } from './Vector3D';
import type { PlanetaryBodyData } from './constants';
import type {
  FlybyInitialConditions,
  TrajectoryPoint,
  FlybySimulationResult,
  FlybyPassType,
  SimulationStatus,
} from './FlybyEngine';
import type { FlybyScenarioConfig } from './FlybyScenario';

// =============================================================================
// 1. CANONICAL INTERFACE: Planet
// =============================================================================

export interface Planet {
  /** Canonical name of the celestial body (e.g., 'Jupiter', 'Earth') */
  readonly name: string;
  /** Planetary mass in kilograms (kg) */
  readonly massKg: number;
  /** Mean physical volumetric radius in metres (m) */
  readonly radiusM: number;
  /** Standard gravitational parameter GM in m³/s² */
  readonly mu: number;
  /** Optional heliocentric orbital semi-major axis in metres (m) */
  readonly semiMajorAxisM?: number;
  /** Optional circular heliocentric orbital speed in metres per second (m/s) */
  readonly orbitalSpeedMPerS?: number;
  /** Optional orbital eccentricity */
  readonly orbitalEccentricity?: number;
  /** Optional orbital period in seconds (s) */
  readonly orbitalPeriodS?: number;
  /** Optional machine identifier or preset ID (e.g., 'JUPITER') */
  readonly id?: string;
  /** Optional hex color code for 3D viewport rendering */
  readonly color?: string;
  /** Optional scientific source and reference metadata */
  readonly source?: string;
  readonly sourceOrReference?: string;
  readonly modelNotes?: string;
  readonly isSimplifiedModel?: boolean;
}

// =============================================================================
// 2. CANONICAL INTERFACE: FlybyConfig
// =============================================================================

export type FlybySide = 'TRAILING' | 'LEADING';

export type GeometryInputMode = 'CLOSEST_APPROACH_ALTITUDE' | 'IMPACT_PARAMETER';

/**
 * Exactly one authoritative geometry input specification.
 * Either closest-approach altitude or impact parameter, strictly defined.
 */
export type AuthoritativeGeometryInput =
  | {
      readonly mode: 'CLOSEST_APPROACH_ALTITUDE';
      /** Closest approach altitude above planetary surface in metres (m) */
      readonly altitudeM: number;
      /** Derived impact parameter for convenience in metres (m) */
      readonly derivedImpactParameterM?: number;
    }
  | {
      readonly mode: 'IMPACT_PARAMETER';
      /** Impact parameter (asymptote offset distance from planet center) in metres (m) */
      readonly impactParameterM: number;
      /** Derived closest approach altitude for convenience in metres (m) */
      readonly derivedAltitudeM?: number;
    };

export interface FlybyConfig {
  /** Planet configuration reference or immutable planet data */
  readonly planet: Planet;
  /** Incoming asymptotic hyperbolic excess speed in metres per second (m/s) */
  readonly vInfSpeedMPerS: number;
  /** Alias for asymptotic speed */
  readonly asymptoticSpeedMPerS?: number;
  /** Incoming in-plane direction angle in degrees */
  readonly approachAngleDeg: number;
  /** Optional 3D orientation unit vector of incoming asymptote */
  readonly incomingDirection?: IVector3D;
  /** Flyby side: 'TRAILING' (speed boost) or 'LEADING' (speed loss / braking) */
  readonly passType: FlybySide;
  /** Exactly one authoritative geometry input: closest-approach altitude or impact parameter */
  readonly geometry: AuthoritativeGeometryInput;
  /** Spacecraft dry + propellant mass in kilograms (kg) */
  readonly spacecraftMassKg: number;
  /** Optional initial states when numerical mode or custom injection is used */
  readonly initialStates?: {
    readonly positionM: IVector3D;
    readonly velocityMPerS: IVector3D;
  };
}

// =============================================================================
// 3. CANONICAL INTERFACE: SimulationSettings
// =============================================================================

export type IntegrationMethod = 'RK4' | 'ANALYTICAL_IDEAL' | 'VERLET' | 'ADAPTIVE_RK45';

export interface SimulationSettings {
  /** Start time of simulation window in seconds (s) */
  readonly startTimeS: number;
  /** End time of simulation window in seconds (s) */
  readonly endTimeS: number;
  /** Total duration in seconds (s) */
  readonly durationS: number;
  /** Numerical integration method */
  readonly method: IntegrationMethod;
  /** Numerical integration tolerance (relative or absolute threshold) */
  readonly numericalTolerance: number;
  /** Configured fixed time step in seconds (s), if applicable */
  readonly fixedTimeStepS?: number;
  /** Dimensionless adaptive step size coefficient */
  readonly timeStepCoeff?: number;
  /** Output sampling settings */
  readonly outputSampling: {
    readonly sampleIntervalS?: number;
    readonly maxOutputSteps?: number;
    readonly entryDistanceMultiple?: number;
  };
}

// =============================================================================
// 4. CANONICAL INTERFACE: TrajectoryState
// =============================================================================

export interface TrajectoryState {
  /** Time from encounter start in seconds (s) */
  readonly timeS: number;
  /** Spacecraft position vector in heliocentric frame (m) */
  readonly spacecraftPositionM: IVector3D;
  /** Spacecraft velocity vector in heliocentric frame (m/s) */
  readonly spacecraftVelocityMPerS: IVector3D;
  /** Planet position vector in heliocentric frame (m) */
  readonly planetPositionM: IVector3D;
  /** Planet velocity vector in heliocentric frame (m/s) */
  readonly planetVelocityMPerS: IVector3D;
  /** Relative position vector in planet-centric frame: r_sc - r_planet (m) */
  readonly relativePositionM: IVector3D;
  /** Relative velocity vector in planet-centric frame: v_sc - v_planet (m/s) */
  readonly relativeVelocityMPerS: IVector3D;
  /** Gravitational acceleration experienced by spacecraft (vector in m/s²) */
  readonly accelerationMPerS2: IVector3D;
  /** Scalar acceleration magnitude in m/s² */
  readonly accelerationMagnitudeMPerS2: number;
  /** Collision status metadata */
  readonly collision: boolean;
  /** Simulation status */
  readonly status: SimulationStatus;
  /** Distance from planet center in metres (m) */
  readonly distanceFromCenterM: number;
  /** Altitude above planetary surface in metres (m) */
  readonly altitudeM: number;
  /** Specific orbital energy in planet frame in J/kg */
  readonly specificEnergyPlanetJPerKg: number;
  /** Specific orbital energy in Sun frame in J/kg */
  readonly specificEnergySunJPerKg: number;
}

// =============================================================================
// 5. CANONICAL INTERFACE: FlybyResult
// =============================================================================

export interface ClosestApproachSummary {
  readonly timeS: number;
  readonly distanceM: number;
  readonly altitudeM: number;
  readonly speedPlanetMPerS: number;
  readonly speedSunMPerS: number;
  readonly positionPlanetM: IVector3D;
  readonly positionSunM: IVector3D;
}

export interface EnergyDiagnosticsSummary {
  /** Heliocentric specific energy change: 0.5 * (||v_out||² - ||v_in||²) in J/kg */
  readonly deltaSpecificEnergyJPerKg: number;
  /** Total spacecraft orbital kinetic energy change in Joules (J) */
  readonly deltaKineticEnergyJ: number;
  /** Work-energy theorem verification: V_planet · Δv_vector in J/kg */
  readonly vPlanetDotDeltaVMPerS2: number;
  /** Work-energy residual error: |Δε - V_planet · Δv| in J/kg */
  readonly energyIdentityDiffJPerKg: number;
  /** Relative specific energy drift across numerical trajectory: |E_final - E_initial| / |E_initial| */
  readonly relativeEnergyConservationError: number;
}

export interface NumericalErrorDiagnosticsSummary {
  /** Speed conservation error percentage: | ||v_out|| - ||v_in|| | / ||v_in|| * 100% */
  readonly speedConservationErrorPercent: number;
  /** Deflection angle error percentage compared to analytical Keplerian prediction */
  readonly deflectionErrorPercent: number;
  /** Relative angular momentum conservation error */
  readonly relativeAngularMomentumConservationError: number;
  /** Total integration sub-steps executed */
  readonly stepCount: number;
}

export interface FlybyResult {
  /** Canonical configuration used for the simulation */
  readonly config: FlybyConfig;
  /** Incoming asymptotic relative velocity vector v_inf(-) in m/s */
  readonly vInfMinusMPerS: IVector3D;
  /** Outgoing asymptotic relative velocity vector v_inf(+) in m/s */
  readonly vInfPlusMPerS: IVector3D;
  /** Incoming heliocentric velocity vector v_in,Sun in m/s */
  readonly vInSunMPerS: IVector3D;
  /** Outgoing heliocentric velocity vector v_out,Sun in m/s */
  readonly vOutSunMPerS: IVector3D;
  /** Deflection angle in radians */
  readonly deflectionAngleRad: number;
  /** Deflection angle in degrees */
  readonly deflectionAngleDeg: number;
  /** Closest approach (periapsis) state */
  readonly closestApproach: ClosestApproachSummary;
  /** Impact parameter in metres (m) */
  readonly impactParameterM: number;
  /** Planet-relative speed change: ||v_inf(+)|| - ||v_inf(-)|| (identically 0 in pure 2-body physics) */
  readonly relativeSpeedChangeMPerS: number;
  /** Sun-relative scalar speed change: ||v_out,Sun|| - ||v_in,Sun|| in m/s */
  readonly sunRelativeDeltaVSpeedMPerS: number;
  /** Sun-relative vector velocity change: v_out,Sun - v_in,Sun in m/s */
  readonly sunRelativeDeltaVVectorMPerS: IVector3D;
  /** Vector velocity change magnitude in m/s */
  readonly deltaVVectorMagnitudeMPerS: number;
  /** Energy diagnostics */
  readonly energyDiagnostics: EnergyDiagnosticsSummary;
  /** Numerical error diagnostics */
  readonly numericalErrorDiagnostics: NumericalErrorDiagnosticsSummary;
  /** Validity and collision status */
  readonly isValid: boolean;
  readonly collisionDetected: boolean;
  readonly collisionTimeS?: number;
  readonly status: SimulationStatus;
  /** Sampled trajectory states */
  readonly trajectory: readonly TrajectoryState[];
}

// =============================================================================
// 6. UI CONVERTERS & BOUNDARY CONVERSION HELPERS
// =============================================================================

export class UIConverters {
  /** Metres to kilometres */
  static mToKm(m: number): number {
    return m / 1000.0;
  }

  /** Kilometres to metres */
  static kmToM(km: number): number {
    return km * 1000.0;
  }

  /** Metres per second to kilometres per second */
  static mPerSToKmPerS(mps: number): number {
    return mps / 1000.0;
  }

  /** Kilometres per second to metres per second */
  static kmPerSToMPerS(kmps: number): number {
    return kmps * 1000.0;
  }

  /** Radians to degrees */
  static radToDeg(rad: number): number {
    return (rad * 180.0) / Math.PI;
  }

  /** Degrees to radians */
  static degToRad(deg: number): number {
    return (deg * Math.PI) / 180.0;
  }

  /** Kilograms to metric tonnes */
  static kgToTonnes(kg: number): number {
    return kg / 1000.0;
  }

  /** Metric tonnes to kilograms */
  static tonnesToKg(tonnes: number): number {
    return tonnes * 1000.0;
  }

  /** Joules to megajoules */
  static jToMj(j: number): number {
    return j / 1e6;
  }

  /** Joules per kilogram to megajoules per kilogram */
  static jPerKgToMjPerKg(jPerKg: number): number {
    return jPerKg / 1e6;
  }

  /** Format speed in km/s with fixed decimals */
  static formatSpeedKmS(mps: number, decimals = 2): string {
    return `${(mps / 1000.0).toFixed(decimals)} km/s`;
  }

  /** Format distance in km with locale formatting */
  static formatDistanceKm(m: number, decimals = 0): string {
    const km = m / 1000.0;
    return `${km.toLocaleString(undefined, { maximumFractionDigits: decimals })} km`;
  }

  /** Format angle in degrees */
  static formatAngleDeg(radOrDeg: number, isRad = false, decimals = 2): string {
    const deg = isRad ? UIConverters.radToDeg(radOrDeg) : radOrDeg;
    return `${deg.toFixed(decimals)}°`;
  }

  /** Format specific energy in MJ/kg */
  static formatSpecificEnergy(jPerKg: number, decimals = 3): string {
    return `${(jPerKg / 1e6).toFixed(decimals)} MJ/kg`;
  }
}

// =============================================================================
// 7. BIDIRECTIONAL ADAPTERS & BRIDGES
// =============================================================================

/**
 * Converts a PlanetaryBodyData object to the canonical Planet interface.
 */
export function toCanonicalPlanet(body: PlanetaryBodyData): Planet {
  const src = body.source || body.sourceOrReference;
  const notes = body.modelNotes || body.modelSimplificationNote;
  return {
    name: body.name,
    massKg: body.massKg,
    radiusM: body.radiusM,
    mu: body.mu,
    semiMajorAxisM: body.semiMajorAxisM,
    orbitalSpeedMPerS: body.orbitalSpeedMPerS,
    id: body.id,
    color: body.color,
    source: src,
    sourceOrReference: src,
    modelNotes: notes,
    isSimplifiedModel: body.isSimplifiedModel ?? true,
  };
}

/**
 * Converts a FlybyInitialConditions (or FlybyScenarioConfig) to canonical FlybyConfig.
 */
export function toCanonicalFlybyConfig(
  init: FlybyInitialConditions,
  scenario?: FlybyScenarioConfig
): FlybyConfig {
  const planet = toCanonicalPlanet(init.planet);
  const isAltitudeAuthoritative =
    scenario?.encounter.distanceMode === 'PERIAPSIS_ALTITUDE' ||
    init.targetPeriapsisM !== undefined;

  const altitudeM =
    init.targetPeriapsisM !== undefined
      ? init.targetPeriapsisM - planet.radiusM
      : scenario !== undefined
        ? scenario.encounter.periapsisAltitudeKm * 1000.0
        : 0;

  const impactParameterM =
    init.impactParameterM !== undefined
      ? init.impactParameterM
      : scenario !== undefined
        ? scenario.encounter.impactParameterKm * 1000.0
        : 0;

  const geometry: AuthoritativeGeometryInput = isAltitudeAuthoritative
    ? {
        mode: 'CLOSEST_APPROACH_ALTITUDE',
        altitudeM,
        derivedImpactParameterM: impactParameterM,
      }
    : {
        mode: 'IMPACT_PARAMETER',
        impactParameterM,
        derivedAltitudeM: altitudeM,
      };

  return {
    planet,
    vInfSpeedMPerS: init.vInfSpeedMPerS,
    asymptoticSpeedMPerS: init.vInfSpeedMPerS,
    approachAngleDeg: init.approachAngleDeg ?? scenario?.encounter.approachAngleDeg ?? 0,
    passType: init.passType,
    geometry,
    spacecraftMassKg: init.spacecraftMassKg,
    initialStates: init.customInitialState
      ? {
          positionM: init.customInitialState.posPlanetM,
          velocityMPerS: init.customInitialState.velPlanetMPerS,
        }
      : undefined,
  };
}

/**
 * Converts canonical FlybyConfig to FlybyInitialConditions for engine execution.
 */
export function fromCanonicalFlybyConfig(config: FlybyConfig): FlybyInitialConditions {
  const planetData: PlanetaryBodyData = {
    id: config.planet.id || config.planet.name.toUpperCase(),
    name: config.planet.name,
    mu: config.planet.mu,
    radiusM: config.planet.radiusM,
    semiMajorAxisM: config.planet.semiMajorAxisM ?? 0,
    orbitalSpeedMPerS: config.planet.orbitalSpeedMPerS ?? 0,
    massKg: config.planet.massKg,
    color: config.planet.color || '#ffffff',
    description: '',
    source: config.planet.source || '',
    isSimplifiedModel: config.planet.isSimplifiedModel ?? true,
    modelNotes: config.planet.modelNotes || '',
    orbitalRadiusM: config.planet.semiMajorAxisM ?? 0,
    orbitalSpeedMs: config.planet.orbitalSpeedMPerS ?? 0,
  };

  const isAlt = config.geometry.mode === 'CLOSEST_APPROACH_ALTITUDE';
  const targetPeriapsisM = isAlt
    ? config.planet.radiusM + config.geometry.altitudeM
    : undefined;
  const impactParameterM = !isAlt ? config.geometry.impactParameterM : undefined;

  return {
    planet: planetData,
    vInfSpeedMPerS: config.vInfSpeedMPerS,
    approachAngleDeg: config.approachAngleDeg,
    targetPeriapsisM,
    impactParameterM,
    passType: config.passType,
    spacecraftMassKg: config.spacecraftMassKg,
    customInitialState: config.initialStates
      ? {
          posPlanetM: new Vector3D(
            config.initialStates.positionM.x,
            config.initialStates.positionM.y,
            config.initialStates.positionM.z
          ),
          velPlanetMPerS: new Vector3D(
            config.initialStates.velocityMPerS.x,
            config.initialStates.velocityMPerS.y,
            config.initialStates.velocityMPerS.z
          ),
        }
      : undefined,
  };
}

/**
 * Converts a TrajectoryPoint to the canonical TrajectoryState interface.
 */
export function toCanonicalTrajectoryState(
  point: TrajectoryPoint,
  collision = false,
  status: SimulationStatus = 'COMPLETED'
): TrajectoryState {
  // Radial direction from spacecraft to planet
  const rMag = point.distanceFromCenterM;
  const accelMag = point.gravitationalAccelerationMPerS2;
  const accelDir =
    rMag > 0
      ? new Vector3D(
          -point.posPlanetM.x / rMag,
          -point.posPlanetM.y / rMag,
          -point.posPlanetM.z / rMag
        )
      : new Vector3D(0, 0, 0);

  return {
    timeS: point.timeS,
    spacecraftPositionM: point.posSunM,
    spacecraftVelocityMPerS: point.velSunMPerS,
    planetPositionM: point.planetPosSunM,
    planetVelocityMPerS: point.planetVelSunMPerS,
    relativePositionM: point.posPlanetM,
    relativeVelocityMPerS: point.velPlanetMPerS,
    accelerationMPerS2: accelDir.scale(accelMag),
    accelerationMagnitudeMPerS2: accelMag,
    collision,
    status,
    distanceFromCenterM: point.distanceFromCenterM,
    altitudeM: point.altitudeM,
    specificEnergyPlanetJPerKg: point.specificEnergyPlanetJPerKg,
    specificEnergySunJPerKg: point.specificEnergySunJPerKg,
  };
}

/**
 * Converts a FlybySimulationResult to the canonical FlybyResult interface.
 */
export function toCanonicalFlybyResult(result: FlybySimulationResult): FlybyResult {
  const canonicalConfig = toCanonicalFlybyConfig(result.config);
  const trajectoryStates: TrajectoryState[] = result.trajectory.map((pt) =>
    toCanonicalTrajectoryState(pt, result.collisionDetected, result.status)
  );

  const diag = result.convergenceDiagnostics;

  return {
    config: canonicalConfig,
    vInfMinusMPerS: result.analytical.vInfMinusMPerS,
    vInfPlusMPerS: result.analytical.vInfPlusMPerS,
    vInSunMPerS: result.analytical.vInSunMPerS,
    vOutSunMPerS: result.analytical.vOutSunMPerS,
    deflectionAngleRad: result.analytical.deflectionAngleRad,
    deflectionAngleDeg: result.analytical.deflectionAngleDeg,
    closestApproach: {
      timeS: result.closestApproach.timeS,
      distanceM: result.closestApproach.distanceM,
      altitudeM: result.closestApproach.altitudeM,
      speedPlanetMPerS: result.closestApproach.speedPlanetMPerS,
      speedSunMPerS: result.closestApproach.speedSunMPerS,
      positionPlanetM: result.closestApproach.positionPlanetM,
      positionSunM: result.closestApproach.positionSunM,
    },
    impactParameterM: result.analytical.impactParameterM,
    relativeSpeedChangeMPerS:
      result.analytical.vInfPlusMPerS.magnitude() - result.analytical.vInfMinusMPerS.magnitude(),
    sunRelativeDeltaVSpeedMPerS: result.analytical.deltaVSunSpeedMPerS,
    sunRelativeDeltaVVectorMPerS: result.analytical.deltaVVectorSunMPerS,
    deltaVVectorMagnitudeMPerS: result.analytical.deltaVVectorMagnitudeMPerS,
    energyDiagnostics: {
      deltaSpecificEnergyJPerKg: result.analytical.deltaSpecificEnergyJPerKg,
      deltaKineticEnergyJ: result.analytical.deltaKineticEnergyJ,
      vPlanetDotDeltaVMPerS2: result.analytical.vPlanetDotDeltaVMPerS2,
      energyIdentityDiffJPerKg: result.analytical.energyIdentityDiffJPerKg,
      relativeEnergyConservationError: diag?.relativeEnergyConservationError ?? 0,
    },
    numericalErrorDiagnostics: {
      speedConservationErrorPercent:
        diag?.asymptoticSpeedConservationErrorPercent ?? result.speedConservationErrorPercent,
      deflectionErrorPercent: diag?.deflectionErrorPercent ?? result.deflectionErrorPercent,
      relativeAngularMomentumConservationError: diag?.relativeAngularMomentumConservationError ?? 0,
      stepCount: diag?.stepCount ?? result.trajectory.length,
    },
    isValid: result.status !== 'COLLIDED' && !result.collisionDetected,
    collisionDetected: result.collisionDetected,
    collisionTimeS: result.collisionTimeS,
    status: result.status,
    trajectory: trajectoryStates,
  };
}
