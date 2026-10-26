import { Vector3D } from './Vector3D';
import { TrajectoryPoint } from './FlybyEngine';

export interface FlybyConvergenceDiagnostics {
  /** Relative specific energy drift across the trajectory: |E_final - E_initial| / |E_initial| */
  relativeEnergyConservationError: number;
  /** Relative specific angular momentum drift: ||h_final - h_initial|| / ||h_initial|| */
  relativeAngularMomentumConservationError: number;
  /** Percent deviation between asymptotic excess speed and final outgoing speed */
  asymptoticSpeedConservationErrorPercent: number;
  /** Percent deviation between analytical deflection angle and numerical integration deflection angle */
  deflectionErrorPercent: number;
  /** Peak gravitational acceleration experienced in m/s^2 */
  peakGravitationalAccelerationMPerS2: number;
  /** Peak gravitational acceleration in standard Earth G's (g_0 = 9.80665 m/s^2) */
  peakGravitationalAccelerationG0: number;
  /** Number of adaptive integration steps performed */
  stepCount: number;
  /** Average integration timestep in seconds */
  averageTimeStepS: number;
  /** Minimum integration timestep in seconds */
  minTimeStepS: number;
  /** Maximum integration timestep in seconds */
  maxTimeStepS: number;
}

/**
 * Astrodynamic Diagnostics and Verification Utilities for Flybys
 */
export class FlybyDiagnostics {
  /**
   * Computes comprehensive numerical diagnostics across a simulated trajectory
   */
  static analyzeTrajectory(
    trajectory: TrajectoryPoint[],
    muPlanet: number,
    analyticalDeflectionDeg: number,
    vInfSpeedMPerS: number
  ): FlybyConvergenceDiagnostics {
    if (trajectory.length === 0) {
      return {
        relativeEnergyConservationError: 0,
        relativeAngularMomentumConservationError: 0,
        asymptoticSpeedConservationErrorPercent: 0,
        deflectionErrorPercent: 0,
        peakGravitationalAccelerationMPerS2: 0,
        peakGravitationalAccelerationG0: 0,
        stepCount: 0,
        averageTimeStepS: 0,
        minTimeStepS: 0,
        maxTimeStepS: 0,
      };
    }

    const first = trajectory[0];
    const last = trajectory[trajectory.length - 1];

    // 1. Specific Energy Conservation
    const eInit = first.specificEnergyPlanetJPerKg;
    const eFinal = last.specificEnergyPlanetJPerKg;
    const relativeEnergyError = Math.abs(eInit) > 1e-6 ? Math.abs((eFinal - eInit) / eInit) : 0;

    // 2. Angular Momentum Conservation: h = r x v
    const hInit = Vector3D.cross(first.posPlanetM, first.velPlanetMPerS);
    const hFinal = Vector3D.cross(last.posPlanetM, last.velPlanetMPerS);
    const hInitMag = hInit.magnitude();
    const hDiffMag = Vector3D.sub(hFinal, hInit).magnitude();
    const relativeHError = hInitMag > 1e-6 ? hDiffMag / hInitMag : 0;

    // 3. Asymptotic speed conservation
    const finalDist = last.distanceFromCenterM;
    const finalSpeed = last.speedPlanetMPerS;
    const numVInfPlusSq = finalSpeed * finalSpeed - (2.0 * muPlanet) / Math.max(1.0, finalDist);
    const numVInfPlus = Math.sqrt(Math.max(0, numVInfPlusSq));
    const speedConservationErrorPercent =
      vInfSpeedMPerS > 0 ? (Math.abs(numVInfPlus - vInfSpeedMPerS) / vInfSpeedMPerS) * 100.0 : 0;

    // 4. Deflection angle calculation
    const vInDir = first.velPlanetMPerS.clone().normalize();
    const vOutDir = last.velPlanetMPerS.clone().normalize();
    const dot = Math.max(-1.0, Math.min(1.0, vInDir.dot(vOutDir)));
    const numDeltaDeg = (Math.acos(dot) * 180.0) / Math.PI;
    const deflectionErrorPercent =
      analyticalDeflectionDeg > 0
        ? (Math.abs(numDeltaDeg - analyticalDeflectionDeg) / analyticalDeflectionDeg) * 100.0
        : numDeltaDeg;

    // 5. Peak Acceleration and Timestep statistics
    let peakAccel = 0;
    let minDt = Infinity;
    let maxDt = 0;
    let totalDt = 0;

    for (let i = 0; i < trajectory.length; i++) {
      const pt = trajectory[i];
      if (pt.gravitationalAccelerationMPerS2 > peakAccel) {
        peakAccel = pt.gravitationalAccelerationMPerS2;
      }
      if (i > 0) {
        const dt = pt.timeS - trajectory[i - 1].timeS;
        if (dt < minDt) minDt = dt;
        if (dt > maxDt) maxDt = dt;
        totalDt += dt;
      }
    }

    const stepCount = trajectory.length - 1;
    const avgDt = stepCount > 0 ? totalDt / stepCount : 0;

    return {
      relativeEnergyConservationError: relativeEnergyError,
      relativeAngularMomentumConservationError: relativeHError,
      asymptoticSpeedConservationErrorPercent: speedConservationErrorPercent,
      deflectionErrorPercent,
      peakGravitationalAccelerationMPerS2: peakAccel,
      peakGravitationalAccelerationG0: peakAccel / 9.80665,
      stepCount,
      averageTimeStepS: avgDt,
      minTimeStepS: isFinite(minDt) ? minDt : 0,
      maxTimeStepS: maxDt,
    };
  }
}
