import { Vector3D, type IVector3D } from './Vector3D';
import { PlanetaryBodyData, PLANETARY_BODIES, MU_SUN } from './constants';
import { CoordinateFrames } from './CoordinateFrames';
import { FlybyDiagnostics, FlybyConvergenceDiagnostics } from './FlybyDiagnostics';

export { Vector3D, type IVector3D };
export type FlybyPassType = 'TRAILING' | 'LEADING';
export type SimulationStatus = 'INITIALIZED' | 'RUNNING' | 'COMPLETED' | 'COLLIDED';
export type ReferenceFrame = 'PLANET_CENTRIC' | 'HELIOCENTRIC';

/**
 * Initial spacecraft state in planet-centric frame
 */
export interface InitialSpacecraftState {
  posPlanetM: Vector3D | IVector3D;
  velPlanetMPerS: Vector3D | IVector3D;
}

/**
 * Configuration parameters for hyperbolic flyby calculations
 */
export interface FlybyInitialConditions {
  planet: PlanetaryBodyData;
  vInfSpeedMPerS: number; // Asymptotic incoming hyperbolic excess speed (m/s)
  approachAngleDeg?: number; // In-plane approach direction (default: 0 degrees, along +X)
  // Encounter distance specification: user can supply target periapsis, impact parameter, or flyby altitude
  targetPeriapsisM?: number;
  impactParameterM?: number;
  flybyAltitudeM?: number;
  passType: FlybyPassType;
  spacecraftMassKg: number;
  // Optional custom kinematics and trajectory modes:
  planetVelocityVectorMPerS?: Vector3D | IVector3D;
  planetInitialPhaseDeg?: number;
  simulationDurationS?: number;
  simulationWindowStartS?: number;
  fixedTimeStepS?: number;
  numericalTolerance?: number;
  customInitialState?: InitialSpacecraftState;
  trajectoryMode?: 'NUMERICAL_RK4' | 'ANALYTICAL_IDEAL';
}

/**
 * Numerical integration and simulation execution options
 */
export interface NumericalIntegrationOptions {
  maxPoints?: number;
  entryDistanceMultiple?: number;
  timeStepCoeff?: number;
  fixedTimeStepS?: number;
  numericalTolerance?: number;
  simulationDurationS?: number;
  simulationWindowStartS?: number;
  trajectoryMode?: 'NUMERICAL_RK4' | 'ANALYTICAL_IDEAL';
}

export interface TrajectoryPoint {
  timeS: number;
  // Planet-relative
  posPlanetM: Vector3D;
  velPlanetMPerS: Vector3D;
  speedPlanetMPerS: number;
  distanceFromCenterM: number;
  altitudeM: number;
  specificEnergyPlanetJPerKg: number;
  gravitationalAccelerationMPerS2: number;
  // Sun-relative
  posSunM: Vector3D;
  velSunMPerS: Vector3D;
  speedSunMPerS: number;
  planetPosSunM: Vector3D;
  planetVelSunMPerS: Vector3D;
  specificEnergySunJPerKg: number;
  kineticEnergyJ: number;
}

export interface FlybyAnalyticalSummary {
  vInfMPerS: number;
  impactParameterM: number;
  periapsisRadiusM: number;
  periapsisAltitudeM: number;
  eccentricity: number;
  semiMajorAxisM: number; // Negative for hyperbola: a = -mu / v_inf^2
  deflectionAngleRad: number;
  deflectionAngleDeg: number;
  vInfMinusMPerS: Vector3D;
  vInfPlusMPerS: Vector3D;

  // Planet-centric vector velocity changes
  deltaVVectorMPerS: Vector3D;
  deltaVVectorMagnitudeMPerS: number;
  deltaVAssistMPerS: Vector3D; // Backward-compatible alias
  deltaVAssistMagnitudeMPerS: number; // Backward-compatible alias

  // Heliocentric analytical asymptotes
  vInSunMPerS: Vector3D;
  vOutSunMPerS: Vector3D;
  vInSunSpeedMPerS: number;
  vOutSunSpeedMPerS: number;

  // Heliocentric velocity and speed changes
  deltaVVectorSunMPerS: Vector3D; // vOutSun - vInSun (identical to planet-centric deltaVVector)
  deltaVSpeedMPerS: number; // |vOutSun| - |vInSun| (scalar speed change)
  deltaVSunSpeedMPerS: number; // Backward-compatible alias

  // Energy quantities
  deltaSpecificEnergyJPerKg: number; // 0.5 * (|vOutSun|² - |vInSun|²)
  deltaKineticEnergyJ: number; // spacecraftMassKg * deltaSpecificEnergyJPerKg
  vPlanetDotDeltaVMPerS2: number; // V_planet · Δv_vector
  energyIdentityDiffJPerKg: number; // |deltaSpecificEnergyJPerKg - vPlanetDotDeltaVMPerS2|

  // Legacy aliases
  deltaKineticEnergyJPerKg: number;
  deltaTotalKineticEnergyJ: number;

  isAcceleration: boolean;
  isPhysicalCollision: boolean;
}

export interface ClosestApproachData {
  timeS: number;
  distanceM: number;
  altitudeM: number;
  speedPlanetMPerS: number;
  speedSunMPerS: number;
  positionPlanetM: Vector3D;
  positionSunM: Vector3D;
}

export interface FlybySimulationResult {
  config: FlybyInitialConditions;
  analytical: FlybyAnalyticalSummary;
  trajectory: TrajectoryPoint[];
  closestApproach: ClosestApproachData;
  numericalDeflectionAngleDeg: number;
  numericalVInfPlusSpeedMPerS: number;
  speedConservationErrorPercent: number;
  deflectionErrorPercent: number;
  status: SimulationStatus;
  collisionDetected: boolean;
  collisionTimeS?: number;
  collisionPositionPlanetM?: Vector3D;
  totalDurationS: number;
  flybyDurationS: number;
  peakGravitationalAccelerationMPerS2: number;
  peakGravitationalAccelerationG0: number;
  sunRelativeDeltaVSpeedMPerS: number;
  sunRelativeDeltaVVectorMPerS: Vector3D;
  sunRelativeDeltaSpecificEnergyJPerKg: number;
  convergenceDiagnostics?: FlybyConvergenceDiagnostics;
}

/**
 * High-Precision Numerical & Analytical Planetary Gravity Assist Engine
 *
 * Implements:
 * 1. Exact 2-body hyperbolic equations of motion: d²r/dt² = - (mu_p / |r|³) r
 * 2. 4th-order Runge-Kutta (RK4) numerical integration with adaptive sub-stepping
 * 3. Analytical impact parameter <-> periapsis distance bi-directional conversions
 * 4. Dual-frame physics: Planet-Centric Rest Frame vs Heliocentric (Sun-Centric) Inertial Frame
 * 5. Analytical vs Numerical verification metrics (deflection angle, energy conservation)
 * 6. High-precision closest-approach interpolation and exact physical radius collision detection
 */
export class FlybyEngine {
  /**
   * Computes eccentricity e from periapsis radius r_p and hyperbolic excess speed v_inf:
   * e = 1 + (r_p * v_inf² / mu)
   */
  static eccentricityFromPeriapsis(rpM: number, vInfMPerS: number, muPlanet: number): number {
    if (muPlanet <= 0) return Infinity; // No gravity -> straight-line unaccelerated motion
    if (vInfMPerS <= 0 || rpM <= 0) return 1.0;
    return 1.0 + (rpM * vInfMPerS * vInfMPerS) / muPlanet;
  }

  /**
   * Computes hyperbolic turning (deflection) angle delta from eccentricity e:
   * delta = 2 * asin(1 / e)
   */
  static deflectionFromEccentricity(e: number): number {
    if (e <= 1.0) return Math.PI; // Parabolic limit / radial plunge 180 deg
    if (!isFinite(e) || e > 1e12) return 0.0; // Straight line motion (zero-gravity limit)
    return 2.0 * Math.asin(1.0 / e);
  }

  /**
   * Computes impact parameter b from eccentricity e, excess speed v_inf, and mu:
   * b = (mu / v_inf²) * sqrt(e² - 1)
   */
  static impactParameterFromEccentricity(e: number, vInfMPerS: number, muPlanet: number): number {
    if (vInfMPerS <= 0 || e <= 1.0) return 0;
    if (muPlanet <= 0 || !isFinite(e)) return 0;
    const charLen = muPlanet / (vInfMPerS * vInfMPerS);
    return charLen * Math.sqrt(e * e - 1.0);
  }

  /**
   * Converts periapsis radius r_p to impact parameter b:
   * e = 1 + (r_p * v_inf² / mu)
   * b = (mu / v_inf²) * sqrt(e² - 1)
   * (Equivalent to b = r_p * sqrt(1 + 2 * mu / (r_p * v_inf²)))
   */
  static periapsisToImpactParameter(rpM: number, vInfMPerS: number, muPlanet: number): number {
    if (rpM <= 0) return 0;
    if (muPlanet <= 0) return rpM; // No gravity -> impact parameter equals closest approach
    if (vInfMPerS <= 0) return rpM;
    const e = FlybyEngine.eccentricityFromPeriapsis(rpM, vInfMPerS, muPlanet);
    return FlybyEngine.impactParameterFromEccentricity(e, vInfMPerS, muPlanet);
  }

  /**
   * Converts impact parameter b to periapsis radius r_p for hyperbolic excess speed v_inf:
   * r_p = - (mu / v_inf²) + sqrt((mu / v_inf²)² + b²)
   */
  static impactParameterToPeriapsis(bM: number, vInfMPerS: number, muPlanet: number): number {
    if (bM <= 0) return 0;
    if (muPlanet <= 0) return bM; // No gravity -> closest approach equals impact parameter
    if (vInfMPerS <= 0) return bM;
    const charLen = muPlanet / (vInfMPerS * vInfMPerS);
    return -charLen + Math.sqrt(charLen * charLen + bM * bM);
  }

  /**
   * Calculates analytical patched-conic hyperbolic flyby mechanics
   */
  static computeAnalytical(config: FlybyInitialConditions): FlybyAnalyticalSummary {
    const { planet, vInfSpeedMPerS, passType, spacecraftMassKg } = config;
    const muP = planet.mu;
    const Rp = planet.radiusM;

    let rpM = config.targetPeriapsisM;
    let bM = config.impactParameterM;

    if (rpM !== undefined && rpM >= 0) {
      bM = FlybyEngine.periapsisToImpactParameter(rpM, vInfSpeedMPerS, muP);
    } else if (config.flybyAltitudeM !== undefined) {
      rpM = Rp + config.flybyAltitudeM;
      bM = FlybyEngine.periapsisToImpactParameter(rpM, vInfSpeedMPerS, muP);
    } else if (bM !== undefined && bM >= 0) {
      rpM = FlybyEngine.impactParameterToPeriapsis(bM, vInfSpeedMPerS, muP);
    } else {
      // Default to 1.5 planetary radii if unspecified
      rpM = Rp * 1.5;
      bM = FlybyEngine.periapsisToImpactParameter(rpM, vInfSpeedMPerS, muP);
    }

    const hpM = rpM - Rp;
    const isPhysicalCollision = rpM <= Rp;

    let effVInf = vInfSpeedMPerS;
    if (config.customInitialState) {
      const posInit = config.customInitialState.posPlanetM instanceof Vector3D
        ? config.customInitialState.posPlanetM
        : new Vector3D(config.customInitialState.posPlanetM.x, config.customInitialState.posPlanetM.y, config.customInitialState.posPlanetM.z);
      const velInit = config.customInitialState.velPlanetMPerS instanceof Vector3D
        ? config.customInitialState.velPlanetMPerS
        : new Vector3D(config.customInitialState.velPlanetMPerS.x, config.customInitialState.velPlanetMPerS.y, config.customInitialState.velPlanetMPerS.z);
      const r0 = posInit.magnitude();
      const v0 = velInit.magnitude();
      if (r0 > 0 && muP > 0) {
        const specEnergy = 0.5 * v0 * v0 - muP / r0;
        if (specEnergy > 0) {
          effVInf = Math.sqrt(2.0 * specEnergy);
          const hVec = posInit.clone().cross(velInit);
          const hMag = hVec.magnitude();
          const p = (hMag * hMag) / muP;
          const ecc = Math.sqrt(Math.max(1.0, 1.0 + (2.0 * specEnergy * hMag * hMag) / (muP * muP)));
          rpM = p / (1.0 + ecc);
          bM = effVInf > 0 ? hMag / effVInf : bM;
        }
      }
    }

    // Hyperbolic orbital elements
    const charLen = muP > 0 && effVInf > 0 ? muP / (effVInf * effVInf) : 0;
    const eccentricity = FlybyEngine.eccentricityFromPeriapsis(rpM, effVInf, muP);
    const semiMajorAxisM = muP > 0 ? -charLen : -Infinity;

    // Turning angle delta: sin(delta / 2) = 1 / e
    const deltaRad = FlybyEngine.deflectionFromEccentricity(eccentricity);
    const deltaDeg = (deltaRad * 180.0) / Math.PI;

    // Planet velocity in Sun frame:
    // If custom velocity vector specified, use it; otherwise use circular orbital speed along +Y
    const vPlanetSun = config.planetVelocityVectorMPerS
      ? (config.planetVelocityVectorMPerS instanceof Vector3D
          ? config.planetVelocityVectorMPerS.clone()
          : new Vector3D(config.planetVelocityVectorMPerS.x, config.planetVelocityVectorMPerS.y, config.planetVelocityVectorMPerS.z))
      : planet.customVelocityMPerS
      ? new Vector3D(planet.customVelocityMPerS.x, planet.customVelocityMPerS.y, planet.customVelocityMPerS.z)
      : new Vector3D(0, planet.orbitalSpeedMPerS ?? 0, 0);
    const VpMag = vPlanetSun.magnitude();

    // Incoming asymptote vector v_inf(-)
    // By convention, incoming vector travels predominantly in +X direction
    const approachAngleRad = ((config.approachAngleDeg || 0) * Math.PI) / 180.0;
    const cosApp = Math.cos(approachAngleRad);
    const sinApp = Math.sin(approachAngleRad);
    const vInfMinus = new Vector3D(effVInf * cosApp, effVInf * sinApp, 0);

    // In-plane rotation:
    // Trailing pass: Spacecraft passes behind planet, rotated toward planet velocity (+Y)
    // Leading pass: Spacecraft passes ahead of planet, rotated away from planet velocity (-Y)
    const rotSign = passType === 'TRAILING' ? 1.0 : -1.0;
    const turnAngle = rotSign * deltaRad;

    const cosTurn = Math.cos(turnAngle);
    const sinTurn = Math.sin(turnAngle);

    // Rotate vInfMinus in 2D (XY plane)
    const vInfPlus = new Vector3D(
      vInfMinus.x * cosTurn - vInfMinus.y * sinTurn,
      vInfMinus.x * sinTurn + vInfMinus.y * cosTurn,
      0
    );
    // Ensure strict numerical conservation of magnitude
    vInfPlus.normalize().scale(effVInf);

    // Delta-v vector in planet frame (and Sun frame, since V_p cancels)
    const deltaVVector = new Vector3D(
      vInfPlus.x - vInfMinus.x,
      vInfPlus.y - vInfMinus.y,
      vInfPlus.z - vInfMinus.z
    );
    const deltaVVectorMag = deltaVVector.magnitude();

    // Sun-relative velocities
    const vInSun = new Vector3D(
      vPlanetSun.x + vInfMinus.x,
      vPlanetSun.y + vInfMinus.y,
      vPlanetSun.z + vInfMinus.z
    );
    const vOutSun = new Vector3D(
      vPlanetSun.x + vInfPlus.x,
      vPlanetSun.y + vInfPlus.y,
      vPlanetSun.z + vInfPlus.z
    );

    const vInSunSpeed = vInSun.magnitude();
    const vOutSunSpeed = vOutSun.magnitude();
    const deltaVSpeed = vOutSunSpeed - vInSunSpeed;
    const deltaVVectorSun = new Vector3D(
      vOutSun.x - vInSun.x,
      vOutSun.y - vInSun.y,
      vOutSun.z - vInSun.z
    );

    // Specific and total kinetic energy change in Sun frame:
    // Delta_eps = 0.5 * (|v_out|² - |v_in|²)
    const deltaSpecificEnergyJPerKg = 0.5 * (vOutSunSpeed * vOutSunSpeed - vInSunSpeed * vInSunSpeed);
    const deltaKineticEnergyJ = spacecraftMassKg * deltaSpecificEnergyJPerKg;

    // Work done by moving gravitational field: V_planet · Δv
    const vPlanetDotDeltaVMPerS2 = vPlanetSun.dot(deltaVVector);
    const energyIdentityDiffJPerKg = Math.abs(deltaSpecificEnergyJPerKg - vPlanetDotDeltaVMPerS2);

    return {
      vInfMPerS: vInfSpeedMPerS,
      impactParameterM: bM,
      periapsisRadiusM: rpM,
      periapsisAltitudeM: hpM,
      eccentricity,
      semiMajorAxisM,
      deflectionAngleRad: deltaRad,
      deflectionAngleDeg: deltaDeg,
      vInfMinusMPerS: vInfMinus,
      vInfPlusMPerS: vInfPlus,
      deltaVVectorMPerS: deltaVVector,
      deltaVVectorMagnitudeMPerS: deltaVVectorMag,
      deltaVAssistMPerS: deltaVVector, // Backward-compatible alias
      deltaVAssistMagnitudeMPerS: deltaVVectorMag, // Backward-compatible alias
      vInSunMPerS: vInSun,
      vOutSunMPerS: vOutSun,
      vInSunSpeedMPerS: vInSunSpeed,
      vOutSunSpeedMPerS: vOutSunSpeed,
      deltaVVectorSunMPerS: deltaVVectorSun,
      deltaVSpeedMPerS: deltaVSpeed,
      deltaVSunSpeedMPerS: deltaVSpeed, // Backward-compatible alias
      deltaSpecificEnergyJPerKg,
      deltaKineticEnergyJ,
      vPlanetDotDeltaVMPerS2,
      energyIdentityDiffJPerKg,
      deltaKineticEnergyJPerKg: deltaSpecificEnergyJPerKg, // Backward-compatible alias
      deltaTotalKineticEnergyJ: deltaKineticEnergyJ, // Backward-compatible alias
      isAcceleration: deltaVSpeed > 0,
      isPhysicalCollision,
    };
  }

  /**
   * Runs the full numerical simulation of the hyperbolic flyby using RK4
   * with adaptive sub-stepping and dual-frame tracking.
   */
  static runSimulation(
    config: FlybyInitialConditions,
    options?: NumericalIntegrationOptions
  ): FlybySimulationResult {
    const analytical = FlybyEngine.computeAnalytical(config);
    const { planet, vInfSpeedMPerS, passType, spacecraftMassKg } = config;
    const muP = planet.mu;
    const Rp = planet.radiusM;
    const bM = analytical.impactParameterM;
    const rpM = analytical.periapsisRadiusM;

    // Establish start distance: far enough for asymptote to be valid (15 to 25 * rp, or at least 15 * Rp)
    const entryMult = options?.entryDistanceMultiple ?? 20.0;
    let rStart = Math.max(rpM * entryMult, Rp * 15.0);

    // State Initialization:
    let pos: Vector3D;
    let vel: Vector3D;

    if (config.customInitialState) {
      pos = config.customInitialState.posPlanetM instanceof Vector3D
        ? config.customInitialState.posPlanetM.clone()
        : new Vector3D(config.customInitialState.posPlanetM.x, config.customInitialState.posPlanetM.y, config.customInitialState.posPlanetM.z);
      vel = config.customInitialState.velPlanetMPerS instanceof Vector3D
        ? config.customInitialState.velPlanetMPerS.clone()
        : new Vector3D(config.customInitialState.velPlanetMPerS.x, config.customInitialState.velPlanetMPerS.y, config.customInitialState.velPlanetMPerS.z);
      rStart = Math.max(pos.magnitude(), Rp * 15.0);
    } else if (muP <= 0) {
      // Case 1: Zero-Gravity Limit (straight-line unaccelerated motion)
      const appAngleRad = ((config.approachAngleDeg || 0) * Math.PI) / 180.0;
      const cosApp = Math.cos(appAngleRad);
      const sinApp = Math.sin(appAngleRad);
      const offsetSign = passType === 'TRAILING' ? -1.0 : 1.0;
      const offsetDist = bM;
      // Perpendicular offset vector to approach direction
      pos = new Vector3D(
        -rStart * cosApp + offsetSign * offsetDist * (-sinApp),
        -rStart * sinApp + offsetSign * offsetDist * cosApp,
        0
      );
      vel = new Vector3D(vInfSpeedMPerS * cosApp, vInfSpeedMPerS * sinApp, 0);
    } else if (rpM <= 0 || bM <= 0) {
      // Case 2: Zero-Impact-Parameter Limiting Case (direct radial plunge towards planet center)
      const appAngleRad = ((config.approachAngleDeg || 0) * Math.PI) / 180.0;
      const cosApp = Math.cos(appAngleRad);
      const sinApp = Math.sin(appAngleRad);
      pos = new Vector3D(-rStart * cosApp, -rStart * sinApp, 0);
      const vRadial = Math.sqrt(vInfSpeedMPerS * vInfSpeedMPerS + (2.0 * muP) / rStart);
      vel = new Vector3D(vRadial * cosApp, vRadial * sinApp, 0);
    } else {
      // Case 3: Regular Keplerian Hyperbolic State Initialization
      const aHyp = -muP / (vInfSpeedMPerS * vInfSpeedMPerS);
      const eHyp = 1.0 - rpM / aHyp;
      const pHyp = rpM * (1.0 + eHyp);

      // True anomaly at starting distance rStart:
      // r = p / (1 + e * cos(nu)) => cos(nu) = (p / r - 1) / e
      const cosNuStart = Math.max(-1.0, Math.min(1.0, (pHyp / rStart - 1.0) / eHyp));
      const nuStart = -Math.acos(cosNuStart); // Negative because incoming towards periapsis

      // Coordinates in perifocal frame (where periapsis is at nu = 0 along +X):
      let xw = rStart * Math.cos(nuStart);
      let yw = rStart * Math.sin(nuStart);
      let vxw = -Math.sqrt(muP / pHyp) * Math.sin(nuStart);
      let vyw = Math.sqrt(muP / pHyp) * (eHyp + Math.cos(nuStart));

      // For leading pass, invert encounter orientation (clockwise deflection)
      if (passType === 'LEADING') {
        yw = -yw;
        vyw = -vyw;
      }

      // Angle of incoming asymptote in perifocal frame:
      const thetaInf = Math.acos(-1.0 / eHyp);
      const phiIn = passType === 'TRAILING' ? thetaInf - Math.PI / 2.0 : -(thetaInf - Math.PI / 2.0);

      // Approach angle relative to central frame (default: 0 degrees, incoming along +X):
      const appAngleRad = ((config.approachAngleDeg || 0) * Math.PI) / 180.0;
      const rotPsi = appAngleRad - phiIn;

      const cosPsi = Math.cos(rotPsi);
      const sinPsi = Math.sin(rotPsi);

      // Rotate into simulation planet-centric frame
      pos = new Vector3D(
        xw * cosPsi - yw * sinPsi,
        xw * sinPsi + yw * cosPsi,
        0
      );
      vel = new Vector3D(
        vxw * cosPsi - vyw * sinPsi,
        vxw * sinPsi + vyw * cosPsi,
        0
      );
    }

    // Sun frame parameters
    const vPlanetCustom = config.planetVelocityVectorMPerS
      ? (config.planetVelocityVectorMPerS instanceof Vector3D
          ? config.planetVelocityVectorMPerS.clone()
          : new Vector3D(config.planetVelocityVectorMPerS.x, config.planetVelocityVectorMPerS.y, config.planetVelocityVectorMPerS.z))
      : planet.customVelocityMPerS
      ? new Vector3D(planet.customVelocityMPerS.x, planet.customVelocityMPerS.y, planet.customVelocityMPerS.z)
      : undefined;

    const aPlanet = planet.semiMajorAxisM ?? 0;
    const VpMag = vPlanetCustom ? vPlanetCustom.magnitude() : (planet.orbitalSpeedMPerS ?? 0);
    const omegaP = aPlanet > 0 ? VpMag / aPlanet : 0; // Angular rate around Sun (rad/s)
    const initialPhaseRad = ((config.planetInitialPhaseDeg || 0) * Math.PI) / 180.0;

    const getPlanetSunState = (t: number) => {
      if (vPlanetCustom) {
        return {
          pos: new Vector3D(vPlanetCustom.x * t, vPlanetCustom.y * t, vPlanetCustom.z * t),
          vel: vPlanetCustom.clone(),
        };
      }
      const planetAngle = initialPhaseRad + omegaP * t;
      return {
        pos: new Vector3D(
          aPlanet * Math.cos(planetAngle),
          aPlanet * Math.sin(planetAngle),
          0
        ),
        vel: new Vector3D(
          -VpMag * Math.sin(planetAngle),
          VpMag * Math.cos(planetAngle),
          0
        ),
      };
    };

    // Store trajectory samples
    const trajectory: TrajectoryPoint[] = [];
    const maxPoints = options?.maxPoints ?? 1500;

    let timeS = options?.simulationWindowStartS ?? config.simulationWindowStartS ?? 0.0;
    let collisionDetected = false;
    let collisionTimeS: number | undefined;
    let collisionPosition: Vector3D | undefined;

    let minDistance = Infinity;
    let closestApproach: ClosestApproachData = {
      timeS: timeS,
      distanceM: Infinity,
      altitudeM: Infinity,
      speedPlanetMPerS: 0,
      speedSunMPerS: 0,
      positionPlanetM: pos.clone(),
      positionSunM: new Vector3D(0, 0, 0),
    };

    // Total expected flyby time scale ~ 2 * rStart / vInf
    const effectiveVInf = Math.max(100.0, vInfSpeedMPerS);
    const timeScaleApprox = (2.5 * rStart) / effectiveVInf;
    const duration =
      options?.simulationDurationS && options.simulationDurationS > 0
        ? options.simulationDurationS
        : config.simulationDurationS && config.simulationDurationS > 0
        ? config.simulationDurationS
        : timeScaleApprox * 3;
    const maxSimTime = timeS + duration;

    // Numerical step and tolerance controls
    const baseEta = options?.timeStepCoeff ?? 0.015;
    const tol = options?.numericalTolerance ?? config.numericalTolerance;
    const eta = tol && tol > 0 ? Math.max(0.001, Math.min(0.2, baseEta * Math.sqrt(tol * 100))) : baseEta;
    const fixedDt = options?.fixedTimeStepS ?? config.fixedTimeStepS;

    // Helper to evaluate gravitational acceleration in planet frame
    const getAccel = (p: Vector3D): Vector3D => {
      if (muP <= 0) return new Vector3D(0, 0, 0);
      const r = p.magnitude();
      if (r < 1.0) return new Vector3D(0, 0, 0);
      const factor = -muP / (r * r * r);
      return new Vector3D(p.x * factor, p.y * factor, p.z * factor);
    };

    // Helper to compute state in both frames
    const recordPoint = (t: number, p: Vector3D, v: Vector3D) => {
      const dist = p.magnitude();
      const alt = dist - Rp;
      const spdPlanet = v.magnitude();
      const epsPlanet = 0.5 * spdPlanet * spdPlanet - muP / dist;

      // Heliocentric planet state at time t
      const planetSunState = getPlanetSunState(t);
      const planetPosSun = planetSunState.pos;
      const planetVelSun = planetSunState.vel;

      // Spacecraft state in Sun frame
      const posSun = new Vector3D(
        planetPosSun.x + p.x,
        planetPosSun.y + p.y,
        planetPosSun.z + p.z
      );
      const velSun = new Vector3D(
        planetVelSun.x + v.x,
        planetVelSun.y + v.y,
        planetVelSun.z + v.z
      );
      const spdSun = velSun.magnitude();
      const rSun = posSun.magnitude();
      const epsSun = 0.5 * spdSun * spdSun - MU_SUN / rSun;
      const kinEnergy = 0.5 * spacecraftMassKg * spdSun * spdSun;
      const gravAccel = dist > 0 ? muP / (dist * dist) : 0;

      trajectory.push({
        timeS: t,
        posPlanetM: p.clone(),
        velPlanetMPerS: v.clone(),
        speedPlanetMPerS: spdPlanet,
        distanceFromCenterM: dist,
        altitudeM: alt,
        specificEnergyPlanetJPerKg: epsPlanet,
        gravitationalAccelerationMPerS2: gravAccel,
        posSunM: posSun,
        velSunMPerS: velSun,
        speedSunMPerS: spdSun,
        planetPosSunM: planetPosSun,
        planetVelSunMPerS: planetVelSun,
        specificEnergySunJPerKg: epsSun,
        kineticEnergyJ: kinEnergy,
      });

      if (dist < minDistance) {
        minDistance = dist;
        closestApproach = {
          timeS: t,
          distanceM: dist,
          altitudeM: alt,
          speedPlanetMPerS: spdPlanet,
          speedSunMPerS: spdSun,
          positionPlanetM: p.clone(),
          positionSunM: posSun.clone(),
        };
      }
    };

    // Record initial state
    recordPoint(timeS, pos, vel);

    // Numerical integration loop
    let hasRecededPastStart = false;
    let stepCount = 0;
    const maxSteps = 100000;

    while (stepCount < maxSteps && !hasRecededPastStart && timeS < maxSimTime) {
      stepCount++;
      const r = pos.magnitude();

      // Check if already at or inside physical surface
      if (r <= Rp) {
        collisionDetected = true;
        collisionTimeS = timeS;
        collisionPosition = pos.clone().normalize().scale(Rp);
        break;
      }

      // Check if spacecraft has departed past starting distance after passing periapsis
      const rDot = (pos.x * vel.x + pos.y * vel.y + pos.z * vel.z) / r;
      if (rDot > 0 && r >= rStart) {
        hasRecededPastStart = true;
        break;
      }

      // Timestep calculation: fixed step or adaptive step with tolerance scaling
      const vMag = vel.magnitude();
      const dtMin = 0.05; // 50 ms minimum step
      const dtMax = Math.max(1.0, (0.01 * rStart) / effectiveVInf);
      const dt = fixedDt && fixedDt > 0
        ? fixedDt
        : Math.max(dtMin, Math.min(dtMax, (eta * r) / Math.max(vMag, 1.0)));

      // Save previous step state for sub-step refinement and continuous collision detection
      const prevPos = pos.clone();
      const prevVel = vel.clone();
      const prevTimeS = timeS;

      // 4th-Order Runge-Kutta step
      // k1
      const a1 = getAccel(pos);
      const v1 = vel;

      // k2
      const pos2 = new Vector3D(
        pos.x + v1.x * 0.5 * dt,
        pos.y + v1.y * 0.5 * dt,
        pos.z + v1.z * 0.5 * dt
      );
      const vel2 = new Vector3D(
        vel.x + a1.x * 0.5 * dt,
        vel.y + a1.y * 0.5 * dt,
        vel.z + a1.z * 0.5 * dt
      );
      const a2 = getAccel(pos2);

      // k3
      const pos3 = new Vector3D(
        pos.x + vel2.x * 0.5 * dt,
        pos.y + vel2.y * 0.5 * dt,
        pos.z + vel2.z * 0.5 * dt
      );
      const vel3 = new Vector3D(
        vel.x + a2.x * 0.5 * dt,
        vel.y + a2.y * 0.5 * dt,
        vel.z + a2.z * 0.5 * dt
      );
      const a3 = getAccel(pos3);

      // k4
      const pos4 = new Vector3D(
        pos.x + vel3.x * dt,
        pos.y + vel3.y * dt,
        pos.z + vel3.z * dt
      );
      const vel4 = new Vector3D(
        vel.x + a3.x * dt,
        vel.y + a3.y * dt,
        vel.z + a3.z * dt
      );
      const a4 = getAccel(pos4);

      // Proposed next state
      const nextPos = new Vector3D(
        pos.x + (dt / 6.0) * (v1.x + 2.0 * vel2.x + 2.0 * vel3.x + vel4.x),
        pos.y + (dt / 6.0) * (v1.y + 2.0 * vel2.y + 2.0 * vel3.y + vel4.y),
        pos.z + (dt / 6.0) * (v1.z + 2.0 * vel2.z + 2.0 * vel3.z + vel4.z)
      );
      const nextVel = new Vector3D(
        vel.x + (dt / 6.0) * (a1.x + 2.0 * a2.x + 2.0 * a3.x + a4.x),
        vel.y + (dt / 6.0) * (a1.y + 2.0 * a2.y + 2.0 * a3.y + a4.y),
        vel.z + (dt / 6.0) * (a1.z + 2.0 * a2.z + 2.0 * a3.z + a4.z)
      );

      const nextDist = nextPos.magnitude();

      // Continuous sub-step collision detection:
      // Parameterize segment r(tau) = prevPos + tau * deltaR, tau in [0, 1]
      // Solve |r(tau)|² = Rp² => A*tau² + B*tau + C = 0
      const deltaR = new Vector3D(nextPos.x - prevPos.x, nextPos.y - prevPos.y, nextPos.z - prevPos.z);
      const deltaA = deltaR.x * deltaR.x + deltaR.y * deltaR.y + deltaR.z * deltaR.z;
      const deltaB = 2.0 * (prevPos.x * deltaR.x + prevPos.y * deltaR.y + prevPos.z * deltaR.z);
      const deltaC = prevPos.x * prevPos.x + prevPos.y * prevPos.y + prevPos.z * prevPos.z - Rp * Rp;

      let subStepCollision = false;
      let tauCol = 1.0;

      if (nextDist <= Rp || deltaC <= 0) {
        subStepCollision = true;
        const discr = deltaB * deltaB - 4.0 * deltaA * deltaC;
        if (discr >= 0 && deltaA > 1e-12) {
          const root1 = (-deltaB - Math.sqrt(discr)) / (2.0 * deltaA);
          tauCol = Math.max(0.0, Math.min(1.0, root1));
        } else {
          tauCol = 0.5;
        }
      }

      if (subStepCollision) {
        collisionDetected = true;
        collisionTimeS = prevTimeS + tauCol * dt;
        const colPos = new Vector3D(
          prevPos.x + tauCol * deltaR.x,
          prevPos.y + tauCol * deltaR.y,
          prevPos.z + tauCol * deltaR.z
        );
        // Project onto physical surface radius with zero tolerance
        collisionPosition = colPos.normalize().scale(Rp);
        const colVel = new Vector3D(
          prevVel.x + tauCol * (nextVel.x - prevVel.x),
          prevVel.y + tauCol * (nextVel.y - prevVel.y),
          prevVel.z + tauCol * (nextVel.z - prevVel.z)
        );

        pos = collisionPosition.clone();
        vel = colVel;
        timeS = collisionTimeS;

        recordPoint(timeS, pos, vel);
        break;
      }

      // Continuous sub-step closest-approach refinement:
      // At periapsis, radial velocity r · v = 0.
      // If dotPrev <= 0 and dotNext > 0, periapsis occurred inside this step.
      const dotPrev = prevPos.x * prevVel.x + prevPos.y * prevVel.y + prevPos.z * prevVel.z;
      const dotNext = nextPos.x * nextVel.x + nextPos.y * nextVel.y + nextPos.z * nextVel.z;

      if (dotPrev <= 0 && dotNext > 0) {
        const denom = dotNext - dotPrev;
        const tauPeri = denom !== 0 ? Math.max(0.0, Math.min(1.0, -dotPrev / denom)) : 0.5;
        const periPos = new Vector3D(
          prevPos.x + tauPeri * deltaR.x,
          prevPos.y + tauPeri * deltaR.y,
          prevPos.z + tauPeri * deltaR.z
        );
        const periVel = new Vector3D(
          prevVel.x + tauPeri * (nextVel.x - prevVel.x),
          prevVel.y + tauPeri * (nextVel.y - prevVel.y),
          prevVel.z + tauPeri * (nextVel.z - prevVel.z)
        );
        const periDist = periPos.magnitude();

        if (periDist < minDistance) {
          minDistance = periDist;
          const periTime = prevTimeS + tauPeri * dt;
          const periSunState = getPlanetSunState(periTime);
          const periPosSun = new Vector3D(
            periSunState.pos.x + periPos.x,
            periSunState.pos.y + periPos.y,
            periSunState.pos.z + periPos.z
          );
          const periVelSun = new Vector3D(
            periSunState.vel.x + periVel.x,
            periSunState.vel.y + periVel.y,
            periSunState.vel.z + periVel.z
          );

          closestApproach = {
            timeS: periTime,
            distanceM: periDist,
            altitudeM: periDist - Rp,
            speedPlanetMPerS: periVel.magnitude(),
            speedSunMPerS: periVelSun.magnitude(),
            positionPlanetM: periPos.clone(),
            positionSunM: periPosSun,
          };
        }
      } else if (nextDist < minDistance) {
        minDistance = nextDist;
        const nextTime = prevTimeS + dt;
        const nextSunState = getPlanetSunState(nextTime);
        const currentPosSun = new Vector3D(
          nextSunState.pos.x + nextPos.x,
          nextSunState.pos.y + nextPos.y,
          nextSunState.pos.z + nextPos.z
        );
        const currentVelSun = new Vector3D(
          nextSunState.vel.x + nextVel.x,
          nextSunState.vel.y + nextVel.y,
          nextSunState.vel.z + nextVel.z
        );
        closestApproach = {
          timeS: nextTime,
          distanceM: nextDist,
          altitudeM: nextDist - Rp,
          speedPlanetMPerS: nextVel.magnitude(),
          speedSunMPerS: currentVelSun.magnitude(),
          positionPlanetM: nextPos.clone(),
          positionSunM: currentPosSun,
        };
      }

      // Update state for next step
      pos = nextPos;
      vel = nextVel;
      timeS += dt;

      // Sample trajectory at high temporal fidelity
      recordPoint(timeS, pos, vel);
    }

    // Always record final point
    recordPoint(timeS, pos, vel);

    // Compute numerical results
    const lastPoint = trajectory[trajectory.length - 1];
    const initialPoint = trajectory[0];

    // Numerical asymptotic velocity
    // At distance r_final, v_inf_num = sqrt(v_final² - 2 * mu_p / r_final)
    const finalDist = lastPoint.distanceFromCenterM;
    const finalSpeed = lastPoint.speedPlanetMPerS;
    const numVInfPlusSq = finalSpeed * finalSpeed - (2.0 * muP) / finalDist;
    const numVInfPlusSpeed = Math.sqrt(Math.max(0, numVInfPlusSq));

    // Numerical deflection angle:
    // angle between initial incoming asymptote direction and final outgoing asymptote direction
    // Initial velocity direction at rStart vs final velocity direction at rEnd:
    const vInDir = initialPoint.velPlanetMPerS.clone().normalize();
    const vOutDir = lastPoint.velPlanetMPerS.clone().normalize();
    const dotProduct = Math.max(-1.0, Math.min(1.0, vInDir.dot(vOutDir)));
    const numDeltaRad = Math.acos(dotProduct);
    const numDeltaDeg = (numDeltaRad * 180.0) / Math.PI;

    // Error metrics
    const speedConservationErrorPercent =
      vInfSpeedMPerS > 0
        ? Math.abs((numVInfPlusSpeed - vInfSpeedMPerS) / vInfSpeedMPerS) * 100.0
        : 0;
    const deflectionErrorPercent =
      analytical.deflectionAngleDeg > 0
        ? Math.abs((numDeltaDeg - analytical.deflectionAngleDeg) / analytical.deflectionAngleDeg) * 100.0
        : numDeltaDeg;

    let status: SimulationStatus = 'COMPLETED';
    if (collisionDetected) {
      status = 'COLLIDED';
    }

    const diagnostics = FlybyDiagnostics.analyzeTrajectory(
      trajectory,
      muP,
      analytical.deflectionAngleDeg,
      vInfSpeedMPerS
    );

    const firstPt = trajectory[0];
    const lastPt = trajectory[trajectory.length - 1];
    const numDeltaVSpeedSun = lastPt.speedSunMPerS - firstPt.speedSunMPerS;
    const numDeltaVVectorSun = Vector3D.sub(lastPt.velSunMPerS, firstPt.velSunMPerS);
    const numDeltaEpsSun =
      0.5 * (lastPt.speedSunMPerS * lastPt.speedSunMPerS - firstPt.speedSunMPerS * firstPt.speedSunMPerS);

    return {
      config,
      analytical,
      trajectory,
      closestApproach,
      numericalDeflectionAngleDeg: numDeltaDeg,
      numericalVInfPlusSpeedMPerS: numVInfPlusSpeed,
      speedConservationErrorPercent,
      deflectionErrorPercent,
      status,
      collisionDetected,
      collisionTimeS,
      collisionPositionPlanetM: collisionPosition,
      totalDurationS: timeS,
      flybyDurationS: timeS,
      peakGravitationalAccelerationMPerS2: diagnostics.peakGravitationalAccelerationMPerS2,
      peakGravitationalAccelerationG0: diagnostics.peakGravitationalAccelerationG0,
      sunRelativeDeltaVSpeedMPerS: numDeltaVSpeedSun,
      sunRelativeDeltaVVectorMPerS: numDeltaVVectorSun,
      sunRelativeDeltaSpecificEnergyJPerKg: numDeltaEpsSun,
      convergenceDiagnostics: diagnostics,
    };
  }

  /**
   * Executes a parameter sweep across closest-approach distances (Experiment A)
   */
  static runExperimentA_DistanceSweep(
    planet: PlanetaryBodyData,
    vInfSpeedMPerS: number,
    passType: FlybyPassType,
    rpFactors: number[] = [0.8, 1.05, 1.2, 1.5, 2.0, 3.0, 5.0, 8.0]
  ): Array<{
    rpFactor: number;
    periapsisM: number;
    altitudeKm: number;
    isCollision: boolean;
    deflectionDeg: number;
    deltaVSunSpeedMPerS: number;
    deltaEnergyJPerKg: number;
  }> {
    return rpFactors.map((factor) => {
      const rpM = planet.radiusM * factor;
      const res = FlybyEngine.computeAnalytical({
        planet,
        vInfSpeedMPerS,
        targetPeriapsisM: rpM,
        passType,
        spacecraftMassKg: 1000,
      });
      return {
        rpFactor: factor,
        periapsisM: rpM,
        altitudeKm: (rpM - planet.radiusM) / 1000.0,
        isCollision: res.isPhysicalCollision,
        deflectionDeg: res.deflectionAngleDeg,
        deltaVSunSpeedMPerS: res.deltaVSunSpeedMPerS,
        deltaEnergyJPerKg: res.deltaKineticEnergyJPerKg,
      };
    });
  }

  /**
   * Executes a parameter sweep across incoming hyperbolic excess speeds (Experiment B)
   */
  static runExperimentB_SpeedSweep(
    planet: PlanetaryBodyData,
    rpM: number,
    passType: FlybyPassType,
    speedsMPerS: number[] = [3000, 5000, 8000, 12000, 16000, 20000, 25000]
  ): Array<{
    vInfMPerS: number;
    deflectionDeg: number;
    deltaVSunSpeedMPerS: number;
    deltaEnergyJPerKg: number;
  }> {
    return speedsMPerS.map((vInf) => {
      const res = FlybyEngine.computeAnalytical({
        planet,
        vInfSpeedMPerS: vInf,
        targetPeriapsisM: rpM,
        passType,
        spacecraftMassKg: 1000,
      });
      return {
        vInfMPerS: vInf,
        deflectionDeg: res.deflectionAngleDeg,
        deltaVSunSpeedMPerS: res.deltaVSunSpeedMPerS,
        deltaEnergyJPerKg: res.deltaKineticEnergyJPerKg,
      };
    });
  }

  /**
   * Executes a comparative analysis between Jupiter and Saturn under matched or natural conditions (Experiment E)
   */
  static runExperimentE_JupiterVsSaturn(
    vInfSpeedMPerS: number,
    passType: FlybyPassType,
    altitudeKm: number = 50000 // 50,000 km altitude above physical surface
  ): {
    jupiter: FlybyAnalyticalSummary;
    saturn: FlybyAnalyticalSummary;
    comparison: {
      muRatio: number;
      deflectionDiffDeg: number;
      deltaVSunDiffMPerS: number;
      explanation: string;
    };
  } {
    const jupRes = FlybyEngine.computeAnalytical({
      planet: PLANETARY_BODIES.JUPITER,
      vInfSpeedMPerS,
      targetPeriapsisM: PLANETARY_BODIES.JUPITER.radiusM + altitudeKm * 1000.0,
      passType,
      spacecraftMassKg: 1000,
    });

    const satRes = FlybyEngine.computeAnalytical({
      planet: PLANETARY_BODIES.SATURN,
      vInfSpeedMPerS,
      targetPeriapsisM: PLANETARY_BODIES.SATURN.radiusM + altitudeKm * 1000.0,
      passType,
      spacecraftMassKg: 1000,
    });

    return {
      jupiter: jupRes,
      saturn: satRes,
      comparison: {
        muRatio: PLANETARY_BODIES.JUPITER.mu / PLANETARY_BODIES.SATURN.mu,
        deflectionDiffDeg: jupRes.deflectionAngleDeg - satRes.deflectionAngleDeg,
        deltaVSunDiffMPerS: jupRes.deltaVSunSpeedMPerS - satRes.deltaVSunSpeedMPerS,
        explanation:
          'Jupiter has ~3.34x the standard gravitational parameter of Saturn and higher orbital speed (~13.06 km/s vs ~9.62 km/s). Consequently, for identical hyperbolic excess speeds and surface altitudes, Jupiter delivers significantly larger deflection angles and Sun-relative velocity boosts.',
      },
    };
  }

  /**
   * Computes gravitational acceleration vector in planet-centric frame:
   * a_rel = -mu * r / |r|^3
   */
  static computeGravitationalAcceleration(r: IVector3D, mu: number): Vector3D {
    return computeGravitationalAcceleration(r, mu);
  }

  /**
   * Converts flyby altitude to periapsis radius:
   * rp = planetRadius + flybyAltitude
   */
  static periapsisFromAltitude(planetRadiusM: number, flybyAltitudeM: number): number {
    return computePeriapsisFromAltitude(planetRadiusM, flybyAltitudeM);
  }

  /**
   * Converts periapsis radius to flyby altitude:
   * flybyAltitude = rp - planetRadius
   */
  static altitudeFromPeriapsis(planetRadiusM: number, rpM: number): number {
    return computeAltitudeFromPeriapsis(planetRadiusM, rpM);
  }

  /**
   * Transforms velocity from Sun-relative frame to planet-relative frame:
   * v_rel = v_spacecraft - v_planet
   */
  static toPlanetRelativeVelocity(vSpacecraft: IVector3D, vPlanet: IVector3D): Vector3D {
    return toPlanetRelativeVelocity(vSpacecraft, vPlanet);
  }

  /**
   * Transforms velocity from planet-relative frame to Sun-relative frame:
   * v_sun = v_rel + v_planet
   */
  static toSunRelativeVelocity(vRel: IVector3D, vPlanet: IVector3D): Vector3D {
    return toSunRelativeVelocity(vRel, vPlanet);
  }
}

// ============================================================================
// Pure Calculation Functions & Functional API
// ============================================================================

/**
 * Computes gravitational acceleration vector in planet-centric frame:
 * a_rel = -mu * r / |r|^3
 *
 * @param r - Spacecraft position relative to planet center (m)
 * @param mu - Planetary gravitational parameter G * M (m^3/s^2)
 */
export function computeGravitationalAcceleration(r: IVector3D, mu: number): Vector3D {
  const r2 = r.x * r.x + r.y * r.y + r.z * r.z;
  const rMag = Math.sqrt(r2);
  if (rMag <= 0 || mu <= 0) return new Vector3D(0, 0, 0);
  const factor = -mu / (r2 * rMag);
  const ax = r.x === 0 ? 0 : r.x * factor;
  const ay = r.y === 0 ? 0 : r.y * factor;
  const az = r.z === 0 ? 0 : r.z * factor;
  return new Vector3D(ax, ay, az);
}

/**
 * Computes hyperbolic eccentricity from periapsis radius and hyperbolic excess speed:
 * e = 1 + rp * vinfinity^2 / mu
 */
export function computeHyperbolicEccentricity(rpM: number, vInfinityMPerS: number, muPlanet: number): number {
  return FlybyEngine.eccentricityFromPeriapsis(rpM, vInfinityMPerS, muPlanet);
}

/**
 * Computes hyperbolic deflection angle from eccentricity:
 * delta = 2 * asin(1 / e)
 */
export function computeDeflectionAngle(eccentricity: number): number {
  return FlybyEngine.deflectionFromEccentricity(eccentricity);
}

/**
 * Computes impact parameter b from eccentricity:
 * b = (mu / vinfinity^2) * sqrt(e^2 - 1)
 */
export function computeImpactParameter(eccentricity: number, vInfinityMPerS: number, muPlanet: number): number {
  return FlybyEngine.impactParameterFromEccentricity(eccentricity, vInfinityMPerS, muPlanet);
}

/**
 * Converts impact parameter b to closest-approach periapsis radius rp:
 * rp = -(mu / vinfinity^2) + sqrt((mu / vinfinity^2)^2 + b^2)
 */
export function computePeriapsisFromImpactParameter(bM: number, vInfinityMPerS: number, muPlanet: number): number {
  return FlybyEngine.impactParameterToPeriapsis(bM, vInfinityMPerS, muPlanet);
}

/**
 * Converts flyby altitude to closest-approach periapsis radius:
 * rp = planetRadius + flybyAltitude
 */
export function computePeriapsisFromAltitude(planetRadiusM: number, flybyAltitudeM: number): number {
  return planetRadiusM + flybyAltitudeM;
}

/**
 * Converts closest-approach periapsis radius to flyby altitude:
 * flybyAltitude = rp - planetRadius
 */
export function computeAltitudeFromPeriapsis(planetRadiusM: number, rpM: number): number {
  return rpM - planetRadiusM;
}

/**
 * Transforms spacecraft velocity from Sun-centric frame to planet-relative frame:
 * v_rel = v_spacecraft - v_planet
 */
export function toPlanetRelativeVelocity(vSpacecraft: IVector3D, vPlanet: IVector3D): Vector3D {
  return CoordinateFrames.toPlanetRelative(vSpacecraft, vPlanet);
}

/**
 * Transforms spacecraft velocity from planet-relative frame to Sun-centric frame:
 * v_sun = v_rel + v_planet
 */
export function toSunRelativeVelocity(vRel: IVector3D, vPlanet: IVector3D): Vector3D {
  return CoordinateFrames.toSunRelative(vRel, vPlanet);
}

/**
 * Pure calculation function for analytical patched-conic hyperbolic flyby mechanics
 */
export function computeFlybyAnalytical(
  config: FlybyInitialConditions
): FlybyAnalyticalSummary {
  return FlybyEngine.computeAnalytical(config);
}

/**
 * Pure calculation function for time-dependent numerical flyby trajectory simulation
 */
export function simulateFlybyTrajectory(
  config: FlybyInitialConditions,
  options?: NumericalIntegrationOptions
): FlybySimulationResult {
  return FlybyEngine.runSimulation(config, options);
}
