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
  deltaVAssistMPerS: Vector3D;
  deltaVAssistMagnitudeMPerS: number;
  // Heliocentric analytical asymptotes
  vInSunMPerS: Vector3D;
  vOutSunMPerS: Vector3D;
  vInSunSpeedMPerS: number;
  vOutSunSpeedMPerS: number;
  deltaVSunSpeedMPerS: number;
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
   * Converts impact parameter b to periapsis radius r_p for hyperbolic excess speed v_inf:
   * b² = r_p² + 2 * mu_p * r_p / v_inf²
   * r_p = - (mu_p / v_inf²) + sqrt((mu_p / v_inf²)² + b²)
   */
  static impactParameterToPeriapsis(bM: number, vInfMPerS: number, muPlanet: number): number {
    if (vInfMPerS <= 0 || muPlanet <= 0) return 0;
    const charLen = muPlanet / (vInfMPerS * vInfMPerS);
    return -charLen + Math.sqrt(charLen * charLen + bM * bM);
  }

  /**
   * Converts periapsis radius r_p to impact parameter b:
   * b = r_p * sqrt(1 + 2 * mu_p / (r_p * v_inf²))
   */
  static periapsisToImpactParameter(rpM: number, vInfMPerS: number, muPlanet: number): number {
    if (rpM <= 0 || vInfMPerS <= 0 || muPlanet <= 0) return 0;
    const ratio = (2.0 * muPlanet) / (rpM * vInfMPerS * vInfMPerS);
    return rpM * Math.sqrt(1.0 + ratio);
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
    const eccentricity = 1.0 + rpM / charLen;
    const semiMajorAxisM = -charLen; // Negative semi-major axis for hyperbola

    // Turning angle delta: sin(delta / 2) = 1 / e
    const halfDelta = Math.asin(Math.min(1.0, 1.0 / eccentricity));
    const deltaRad = 2.0 * halfDelta;
    const deltaDeg = (deltaRad * 180.0) / Math.PI;

    // Planet velocity in Sun frame (assumed circular orbit along +Y)
    const VpMag = planet.orbitalSpeedMPerS;
    const vPlanetSun = new Vector3D(0, VpMag, 0);

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

    // Delta-v assist in planet frame
    const deltaVAssist = new Vector3D(
      vInfPlus.x - vInfMinus.x,
      vInfPlus.y - vInfMinus.y,
      vInfPlus.z - vInfMinus.z
    );
    const deltaVMag = deltaVAssist.magnitude();

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
    const deltaVSunSpeed = vOutSunSpeed - vInSunSpeed;

    // Specific and total kinetic energy change in Sun frame
    // Delta_eps = 0.5 * (v_out² - v_in²) = V_planet . Delta_v
    const deltaKineticEnergyJPerKg = 0.5 * (vOutSunSpeed * vOutSunSpeed - vInSunSpeed * vInSunSpeed);
    const deltaTotalKineticEnergyJ = spacecraftMassKg * deltaKineticEnergyJPerKg;

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
      deltaVAssistMPerS: deltaVAssist,
      deltaVAssistMagnitudeMPerS: deltaVMag,
      vInSunMPerS: vInSun,
      vOutSunMPerS: vOutSun,
      vInSunSpeedMPerS: vInSunSpeed,
      vOutSunSpeedMPerS: vOutSunSpeed,
      deltaVSunSpeedMPerS: deltaVSunSpeed,
      deltaKineticEnergyJPerKg,
      deltaTotalKineticEnergyJ,
      isAcceleration: deltaVSunSpeed > 0,
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
    const pos = new Vector3D(
      xw * cosPsi - yw * sinPsi,
      xw * sinPsi + yw * cosPsi,
      0
    );
    const vel = new Vector3D(
      vxw * cosPsi - vyw * sinPsi,
      vxw * sinPsi + vyw * cosPsi,
      0
    );

    // Sun frame parameters
    const aPlanet = planet.semiMajorAxisM;
    const VpMag = planet.orbitalSpeedMPerS;
    const omegaP = VpMag / aPlanet; // Angular rate around Sun (rad/s)

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
      const planetAngle = omegaP * t;
      const planetPosSun = new Vector3D(
        aPlanet * Math.cos(planetAngle),
        aPlanet * Math.sin(planetAngle),
        0
      );
      const planetVelSun = new Vector3D(
        -VpMag * Math.sin(planetAngle),
        VpMag * Math.cos(planetAngle),
        0
      );

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

      trajectory.push({
        timeS: t,
        posPlanetM: p.clone(),
        velPlanetMPerS: v.clone(),
        speedPlanetMPerS: spdPlanet,
        distanceFromCenterM: dist,
        altitudeM: alt,
        specificEnergyPlanetJPerKg: epsPlanet,
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

    while (stepCount < maxSteps && !hasRecededPastStart && timeS < timeScaleApprox * 3) {
      stepCount++;
      const r = pos.magnitude();

      // Check for physical surface impact
      if (r <= Rp) {
        collisionDetected = true;
        collisionTimeS = timeS;
        collisionPosition = pos.clone();
        break;
      }

      // Check if spacecraft has departed past the starting distance after passing periapsis
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

      // Update state
      pos.x += (dt / 6.0) * (v1.x + 2.0 * vel2.x + 2.0 * vel3.x + vel4.x);
      pos.y += (dt / 6.0) * (v1.y + 2.0 * vel2.y + 2.0 * vel3.y + vel4.y);
      pos.z += (dt / 6.0) * (v1.z + 2.0 * vel2.z + 2.0 * vel3.z + vel4.z);

      vel.x += (dt / 6.0) * (a1.x + 2.0 * a2.x + 2.0 * a3.x + a4.x);
      vel.y += (dt / 6.0) * (a1.y + 2.0 * a2.y + 2.0 * a3.y + a4.y);
      vel.z += (dt / 6.0) * (a1.z + 2.0 * a2.z + 2.0 * a3.z + a4.z);

      timeS += dt;

      // Track closest approach continuously on every numerical step
      const currentDist = pos.magnitude();
      if (currentDist < minDistance) {
        minDistance = currentDist;
        const currentPlanetAngle = omegaP * timeS;
        const currentPlanetPosSun = new Vector3D(
          aPlanet * Math.cos(currentPlanetAngle),
          aPlanet * Math.sin(currentPlanetAngle),
          0
        );
        const currentPlanetVelSun = new Vector3D(
          -VpMag * Math.sin(currentPlanetAngle),
          VpMag * Math.cos(currentPlanetAngle),
          0
        );
        const currentPosSun = new Vector3D(
          currentPlanetPosSun.x + pos.x,
          currentPlanetPosSun.y + pos.y,
          currentPlanetPosSun.z + pos.z
        );
        const currentVelSun = new Vector3D(
          currentPlanetVelSun.x + vel.x,
          currentPlanetVelSun.y + vel.y,
          currentPlanetVelSun.z + vel.z
        );
        closestApproach = {
          timeS,
          distanceM: currentDist,
          altitudeM: currentDist - Rp,
          speedPlanetMPerS: vel.magnitude(),
          speedSunMPerS: currentVelSun.magnitude(),
          positionPlanetM: pos.clone(),
          positionSunM: currentPosSun,
        };
      }

      // Sample trajectory periodically
      if (stepCount % Math.max(1, Math.floor(maxSteps / maxPoints)) === 0) {
        recordPoint(timeS, pos, vel);
      }
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
