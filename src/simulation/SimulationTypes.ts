/**
 * SimulationTypes.ts
 * 
 * Strict type definitions and interfaces for the rocket flight mechanics
 * and orbital simulation engine.
 * 
 * All physical quantities strictly use SI units:
 * - Position, altitude, radius: meters [m]
 * - Velocity, speed: meters per second [m/s]
 * - Acceleration: meters per second squared [m/s^2]
 * - Force, thrust, drag: Newtons [N]
 * - Mass: kilograms [kg]
 * - Specific impulse (Isp): seconds [s]
 * - Time: seconds [s]
 * - Energy: Joules [J], Specific energy: Joules per kilogram [J/kg]
 * - Angular momentum: m^2/s
 * - Pressure: Pascals [Pa]
 * - Angles: radians [rad] in mathematical routines, degrees [deg] where explicitly suffixed
 */

import { IVector3D, Vector3D } from '../physics/Vector3D';
import { KeplerianElements, ConicType, EnergyRegime, PeriapsisClearance } from '../physics/OrbitClassifier';

/**
 * Discrete flight phases representing the physical state of the vehicle
 */
export enum FlightPhase {
  /** Stationary on the launch pad at Earth's surface radius */
  ON_PAD = 'ON_PAD',
  /** Engine ignited, propellant depleting, thrust active */
  POWERED_ASCENT = 'POWERED_ASCENT',
  /** Engine cutoff, vehicle coasting under gravity and potential atmospheric drag */
  COASTING = 'COASTING',
  /** Stable closed orbit around Earth with periapsis clearing the atmospheric threshold */
  ORBIT_ACHIEVED = 'ORBIT_ACHIEVED',
  /** Unbounded parabolic or hyperbolic trajectory (positive specific energy) with outward velocity */
  ESCAPE = 'ESCAPE_TRAJECTORY',
  ESCAPE_TRAJECTORY = 'ESCAPE_TRAJECTORY',
  /** Descent through sensible atmosphere with aerodynamic drag */
  ATMOSPHERIC_REENTRY = 'ATMOSPHERIC_REENTRY',
  /** Terminal state following collision with planetary surface; velocity clamped to zero */
  SURFACE_IMPACTED = 'SURFACE_IMPACTED',
}

/**
 * Numerical integration regime currently active
 */
export enum IntegratorRegime {
  /** Adaptive RK4 used for high-gradient powered ascent and atmospheric drag */
  ADAPTIVE_RK4 = 'ADAPTIVE_RK4',
  /** Fixed-step RK4 used for standard non-conservative steps */
  FIXED_RK4 = 'FIXED_RK4',
  /** Symplectic Velocity Verlet used for conservative unpowered Keplerian vacuum coasting */
  SYMPLECTIC_VERLET = 'SYMPLECTIC_VERLET',
}

/**
 * Physical and numerical configuration parameters for the simulation engine
 */
export interface SimulationConfig {
  /** Fixed physical timestep delta_t in seconds (default: 0.05 s = 50 ms) */
  fixedTimeStepS: number;
  /** Maximum number of sub-steps per frame to prevent spiral of death (default: 50) */
  maxSubStepsPerFrame: number;
  /** Simulation time acceleration factor (default: 1.0, range: 0.1 - 100.0) */
  timeWarp: number;
  /** Earth gravitational parameter mu = G * M [m^3/s^2] */
  muEarth: number;
  /** Earth equatorial reference radius [m] */
  radiusEarthM: number;
  /** Atmospheric boundary / cutoff altitude [m] */
  atmosphericCutoffM: number;
  /** Earth rotation angular velocity [rad/s] */
  omegaEarthRadPerS: number;
}

/**
 * Rocket vehicle physical properties and stage configuration
 */
export interface VehicleConfig {
  /** Empty vehicle dry mass [kg] */
  dryMassKg: number;
  /** Usable propellant mass at liftoff [kg] */
  propellantMassKg: number;
  /** Maximum vacuum thrust [N] */
  thrustVacuumN: number;
  /** Maximum sea-level thrust [N] */
  thrustSeaLevelN: number;
  /** Specific impulse in vacuum [s] */
  ispVacuumS: number;
  /** Specific impulse at sea level [s] */
  ispSeaLevelS: number;
  /** Aerodynamic reference cross-sectional area [m^2] */
  crossSectionalAreaM2: number;
  /** Aerodynamic drag coefficient Cd [dimensionless] */
  dragCoefficient: number;
  /** Maximum scheduled burn duration [s] */
  burnDurationS: number;
}

/**
 * Launch site and guidance program configuration
 */
export interface LaunchScenarioConfig {
  /** Launch pad latitude [degrees] (-90 to +90) */
  launchLatitudeDeg: number;
  /** Initial launch azimuth heading [degrees] (0 = North, 90 = East prograde) */
  launchAzimuthDeg: number;
  /** Initial pitch kick angle from vertical [degrees] (0 = straight up, 90 = horizontal) */
  initialPitchAngleDeg: number;
  /** Altitude at which gravity turn initiates [m] */
  pitchOverAltitudeM: number;
  /** Target orbital cutoff speed [m/s] (0 = cutoff governed by burn duration / fuel) */
  targetCutoffSpeedMPerS: number;
}

/**
 * Comprehensive internal dynamic state of the rocket vehicle
 */
export interface VehicleDynamicState {
  /** Inertial position vector from Earth center [m] */
  positionM: Vector3D;
  /** Inertial velocity vector [m/s] */
  velocityMPerS: Vector3D;
  /** Net inertial acceleration vector [m/s^2] */
  accelerationMPerS2: Vector3D;
  /** Current total vehicle mass [kg] */
  totalMassKg: number;
  /** Remaining usable propellant mass [kg] */
  propellantRemainingKg: number;
  /** Engine ignition state */
  isIgnited: boolean;
  /** Engine throttle level [0.0 to 1.0] */
  throttle: number;
  /** Unit thrust pointing vector in ECI coordinates */
  thrustDirection: Vector3D;
  /** Current thrust force vector [N] */
  thrustForceN: Vector3D;
  /** Current gravitational force vector [N] */
  gravityForceN: Vector3D;
  /** Current aerodynamic drag force vector [N] */
  dragForceN: Vector3D;
  /** Current net force vector [N] */
  netForceN: Vector3D;
  /** Local atmospheric dynamic pressure q = 0.5 * rho * v^2 [Pa] */
  dynamicPressurePa: number;
  /** Vehicle pitch angle relative to local vertical [degrees] */
  pitchDeg: number;
  /** Vehicle azimuth heading [degrees] */
  azimuthDeg: number;
  /** Active numerical integrator regime */
  integratorRegime: IntegratorRegime;
}

/**
 * Read-only telemetry snapshot exposed to clients, HUD, and analysis tools
 */
export interface ReadonlyTelemetrySnapshot {
  /** Current simulation elapsed time [s] */
  readonly timeS: number;
  /** True altitude above spherical Earth surface h = ||r|| - R_E [m] */
  readonly altitudeM: number;
  /** True altitude in kilometers [km] */
  readonly altitudeKm: number;
  /** Downrange surface distance traveled from launch pad [km] */
  readonly downrangeKm: number;
  /** Inertial speed magnitude ||v|| [m/s] */
  readonly inertialSpeedMPerS: number;
  /** Radial velocity component (dr/dt) [m/s] */
  readonly radialVelocityMPerS: number;
  /** Tangential velocity component [m/s] */
  readonly tangentialVelocityMPerS: number;
  /** Acceleration magnitude [m/s^2] */
  readonly accelerationMagnitudeMPerS2: number;
  /** Acceleration in g's (a / 9.80665) */
  readonly accelerationG: number;
  /** Total vehicle mass [kg] */
  readonly massKg: number;
  /** Usable propellant remaining [kg] */
  readonly propellantRemainingKg: number;
  /** Propellant remaining percentage [0.0 - 100.0] */
  readonly propellantFractionPercent: number;
  /** Engine throttle level [0.0 - 1.0] */
  readonly throttle: number;
  /** Current thrust magnitude [N] */
  readonly thrustN: number;
  /** Current aerodynamic drag magnitude [N] */
  readonly dragN: number;
  /** Dynamic pressure [Pa] */
  readonly dynamicPressurePa: number;
  /** Specific orbital energy epsilon = v^2/2 - mu/r [J/kg] */
  readonly specificEnergyJPerKg: number;
  /** Specific angular momentum magnitude ||h|| [m^2/s] */
  readonly specificAngularMomentumM2PerS: number;
  /** Orbital eccentricity [dimensionless] */
  readonly eccentricity: number;
  /** Semi-major axis a [m] */
  readonly semiMajorAxisM: number;
  /** Periapsis radius r_p [m] */
  readonly periapsisRadiusM: number;
  /** Apoapsis radius r_a [m] (null for parabolic/hyperbolic) */
  readonly apoapsisRadiusM: number | null;
  /** Periapsis altitude above surface [km] */
  readonly periapsisAltitudeKm: number;
  /** Apoapsis altitude above surface [km] (null for unbounded) */
  readonly apoapsisAltitudeKm: number | null;
  /** Orbital period [s] (null for unbounded trajectories) */
  readonly orbitalPeriodS: number | null;
  /** Orbital inclination [deg] */
  readonly inclinationDeg: number;
  /** Current flight phase */
  readonly phase: FlightPhase;
  /** Conic classification */
  readonly conicType: ConicType;
  /** Energy regime classification */
  readonly energyRegime: EnergyRegime;
  /** Periapsis clearance status */
  readonly periapsisClearance: PeriapsisClearance;
  /** Active numerical integrator regime */
  readonly integratorRegime: IntegratorRegime;
  /** Whether the vehicle has reached a terminal surface impact */
  readonly hasImpacted: boolean;
  /** Position vector clone [m] */
  readonly position: Readonly<IVector3D>;
  /** Velocity vector clone [m/s] */
  readonly velocity: Readonly<IVector3D>;
}

/**
 * User guidance and engine control commands
 */
export interface UserFlightCommands {
  /** Commanded throttle level [0.0 to 1.0] */
  throttle?: number;
  /** Commanded pitch angle from local vertical [degrees, 0 to 90] */
  pitchDeg?: number;
  /** Commanded flight azimuth [degrees, 0 to 360] */
  azimuthDeg?: number;
  /** Commanded manual engine cutoff */
  cutoff?: boolean;
}
