import { Vector3D, IVector3D } from './Vector3D';
import { PlanetaryBodyData, PLANETARY_BODIES, MU_SUN } from './constants';

export type FlybyPassType = 'TRAILING' | 'LEADING';
export type SimulationStatus = 'INITIALIZED' | 'RUNNING' | 'COMPLETED' | 'COLLIDED';
export type ReferenceFrame = 'PLANET_CENTRIC' | 'HELIOCENTRIC';

export interface FlybyInitialConditions {
  planet: PlanetaryBodyData;
  vInfSpeedMPerS: number; // Asymptotic incoming hyperbolic excess speed (m/s)
  approachAngleDeg?: number; // In-plane approach direction (default: 0 degrees, along +X)
  // Encounter distance specification: user can supply either target periapsis or impact parameter
  targetPeriapsisM?: number;
  impactParameterM?: number;
  passType: FlybyPassType;
  spacecraftMassKg: number;
  // Optional custom kinematics and trajectory modes:
  planetVelocityVectorMPerS?: Vector3D;
  planetInitialPhaseDeg?: number;
  simulationDurationS?: number;
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
    if (vInfMPerS <= 0 || muPlanet <= 0 || rpM <= 0) return 1.0;
    return 1.0 + (rpM * vInfMPerS * vInfMPerS) / muPlanet;
  }

  /**
   * Computes hyperbolic turning (deflection) angle delta from eccentricity e:
   * delta = 2 * asin(1 / e)
   */
  static deflectionFromEccentricity(e: number): number {
    if (e <= 1.0) return Math.PI; // Parabolic limit / maximum deflection
    return 2.0 * Math.asin(1.0 / e);
  }

  /**
   * Computes impact parameter b from eccentricity e, excess speed v_inf, and mu:
   * b = (mu / v_inf²) * sqrt(e² - 1)
   */
  static impactParameterFromEccentricity(e: number, vInfMPerS: number, muPlanet: number): number {
    if (vInfMPerS <= 0 || muPlanet <= 0 || e <= 1.0) return 0;
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
    if (rpM <= 0 || vInfMPerS <= 0 || muPlanet <= 0) return 0;
    const e = FlybyEngine.eccentricityFromPeriapsis(rpM, vInfMPerS, muPlanet);
    return FlybyEngine.impactParameterFromEccentricity(e, vInfMPerS, muPlanet);
  }

  /**
   * Converts impact parameter b to periapsis radius r_p for hyperbolic excess speed v_inf:
   * r_p = - (mu / v_inf²) + sqrt((mu / v_inf²)² + b²)
   */
  static impactParameterToPeriapsis(bM: number, vInfMPerS: number, muPlanet: number): number {
    if (vInfMPerS <= 0 || muPlanet <= 0 || bM <= 0) return 0;
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

    if (rpM !== undefined && rpM > 0) {
      bM = FlybyEngine.periapsisToImpactParameter(rpM, vInfSpeedMPerS, muP);
    } else if (bM !== undefined && bM > 0) {
      rpM = FlybyEngine.impactParameterToPeriapsis(bM, vInfSpeedMPerS, muP);
    } else {
      // Default to 1.5 planetary radii if unspecified
      rpM = Rp * 1.5;
      bM = FlybyEngine.periapsisToImpactParameter(rpM, vInfSpeedMPerS, muP);
    }

    const hpM = rpM - Rp;
    const isPhysicalCollision = rpM <= Rp;

    // Hyperbolic orbital elements
    const charLen = muP / (vInfSpeedMPerS * vInfSpeedMPerS);
    const eccentricity = FlybyEngine.eccentricityFromPeriapsis(rpM, vInfSpeedMPerS, muP);
    const semiMajorAxisM = -charLen; // Negative semi-major axis for hyperbola

    // Turning angle delta: sin(delta / 2) = 1 / e
    const deltaRad = FlybyEngine.deflectionFromEccentricity(eccentricity);
    const deltaDeg = (deltaRad * 180.0) / Math.PI;

    // Planet velocity in Sun frame:
    // If custom velocity vector specified, use it; otherwise use circular orbital speed along +Y
    const vPlanetSun = config.planetVelocityVectorMPerS
      ? config.planetVelocityVectorMPerS.clone()
      : planet.customVelocityMPerS
      ? new Vector3D(planet.customVelocityMPerS.x, planet.customVelocityMPerS.y, planet.customVelocityMPerS.z)
      : new Vector3D(0, planet.orbitalSpeedMPerS, 0);
    const VpMag = vPlanetSun.magnitude();

    // Incoming asymptote vector v_inf(-)
    // By convention, incoming vector travels predominantly in +X direction
    const approachAngleRad = ((config.approachAngleDeg || 0) * Math.PI) / 180.0;
    const cosApp = Math.cos(approachAngleRad);
    const sinApp = Math.sin(approachAngleRad);
    const vInfMinus = new Vector3D(vInfSpeedMPerS * cosApp, vInfSpeedMPerS * sinApp, 0);

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
    vInfPlus.normalize().scale(vInfSpeedMPerS);

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
    options?: {
      maxPoints?: number;
      entryDistanceMultiple?: number;
      timeStepCoeff?: number;
      simulationDurationS?: number;
      trajectoryMode?: 'NUMERICAL_RK4' | 'ANALYTICAL_IDEAL';
    }
  ): FlybySimulationResult {
    const analytical = FlybyEngine.computeAnalytical(config);
    const { planet, vInfSpeedMPerS, passType, spacecraftMassKg } = config;
    const muP = planet.mu;
    const Rp = planet.radiusM;
    const bM = analytical.impactParameterM;
    const rpM = analytical.periapsisRadiusM;

    // Establish start distance: far enough for asymptote to be valid (15 to 25 * rp, or at least 15 * Rp)
    const entryMult = options?.entryDistanceMultiple ?? 20.0;
    const rStart = Math.max(rpM * entryMult, Rp * 15.0);

    // Exact Keplerian Hyperbolic State Initialization:
    // Semi-major axis (negative): a = -mu_p / v_inf²
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
    let pos = new Vector3D(
      xw * cosPsi - yw * sinPsi,
      xw * sinPsi + yw * cosPsi,
      0
    );
    let vel = new Vector3D(
      vxw * cosPsi - vyw * sinPsi,
      vxw * sinPsi + vyw * cosPsi,
      0
    );

    // Sun frame parameters
    const vPlanetCustom = config.planetVelocityVectorMPerS
      ? config.planetVelocityVectorMPerS.clone()
      : planet.customVelocityMPerS
      ? new Vector3D(planet.customVelocityMPerS.x, planet.customVelocityMPerS.y, planet.customVelocityMPerS.z)
      : undefined;

    const aPlanet = planet.semiMajorAxisM;
    const VpMag = vPlanetCustom ? vPlanetCustom.magnitude() : planet.orbitalSpeedMPerS;
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

    let timeS = 0.0;
    let collisionDetected = false;
    let collisionTimeS: number | undefined;
    let collisionPosition: Vector3D | undefined;

    let minDistance = Infinity;
    let closestApproach: ClosestApproachData = {
      timeS: 0,
      distanceM: Infinity,
      altitudeM: Infinity,
      speedPlanetMPerS: 0,
      speedSunMPerS: 0,
      positionPlanetM: pos.clone(),
      positionSunM: new Vector3D(0, 0, 0),
    };

    // Total expected flyby time scale ~ 2 * rStart / vInf
    const timeScaleApprox = (2.5 * rStart) / vInfSpeedMPerS;
    const maxSimTime =
      options?.simulationDurationS && options.simulationDurationS > 0
        ? options.simulationDurationS
        : timeScaleApprox * 3;
    // Step coefficient: smaller near periapsis
    const eta = options?.timeStepCoeff ?? 0.015;

    // Helper to evaluate gravitational acceleration in planet frame
    const getAccel = (p: Vector3D): Vector3D => {
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

      // Adaptive timestep: dt proportional to r / v, clamped to safe bounds
      const vMag = vel.magnitude();
      const dtMin = 0.05; // 50 ms minimum step
      const dtMax = Math.max(1.0, (0.01 * rStart) / vInfSpeedMPerS);
      const dt = Math.max(dtMin, Math.min(dtMax, (eta * r) / Math.max(vMag, 1.0)));

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
      Math.abs((numVInfPlusSpeed - vInfSpeedMPerS) / vInfSpeedMPerS) * 100.0;
    const deflectionErrorPercent =
      Math.abs((numDeltaDeg - analytical.deflectionAngleDeg) / analytical.deflectionAngleDeg) * 100.0;

    let status: SimulationStatus = 'COMPLETED';
    if (collisionDetected) {
      status = 'COLLIDED';
    }

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
}
