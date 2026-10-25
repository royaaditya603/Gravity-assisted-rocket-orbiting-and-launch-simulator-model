/**
 * TrajectoryInterpolator.ts
 *
 * High-Precision Cubic Hermite Trajectory Interpolation Engine
 * Eliminates visual jitter, frame-rate snapping, and animation discontinuities.
 *
 * Implements:
 * 1. Continuous C^1 Hermite spline interpolation for 3D state vectors:
 *    p(u) = (2u³ - 3u² + 1) p_0 + (u³ - 2u² + u) Δt v_0 + (-2u³ + 3u²) p_1 + (u³ - u²) Δt v_1
 * 2. Exact physical tangent preservation: velocity derivative matches numerical integrator
 * 3. O(1) sequential time indexing with binary search fallback for timeline seeking
 * 4. Surface boundary collision clamping: strictly prevents physical penetration past impact point
 */

import * as THREE from 'three';
import { TrajectoryPoint, FlybySimulationResult } from '../../../physics/FlybyEngine';

export interface InterpolatedState {
  timeS: number;
  // Planet-relative
  posPlanetM: THREE.Vector3;
  velPlanetM: THREE.Vector3;
  speedPlanetMPerS: number;
  distanceFromCenterM: number;
  altitudeM: number;
  gravitationalAccelerationMPerS2: number;
  // Sun-relative
  posSunM: THREE.Vector3;
  velSunM: THREE.Vector3;
  planetPosSunM: THREE.Vector3;
  planetVelSunM: THREE.Vector3;
  speedSunMPerS: number;
  // Progress fraction [0, 1]
  progressFraction: number;
  isTerminalImpact: boolean;
}

export class TrajectoryInterpolator {
  private trajectory: TrajectoryPoint[];
  private planetRadiusM: number;
  private planetMu: number;
  private totalDurationS: number;
  private collisionDetected: boolean;
  private collisionTimeS: number;
  private lastSearchIndex: number = 0;

  constructor(simResult: FlybySimulationResult) {
    this.trajectory = simResult.trajectory;
    this.planetRadiusM = simResult.config.planet.radiusM;
    this.planetMu = simResult.config.planet.mu;
    this.totalDurationS = simResult.totalDurationS;
    this.collisionDetected = simResult.collisionDetected;
    this.collisionTimeS = simResult.collisionTimeS ?? this.totalDurationS;
  }

  public getTotalDurationS(): number {
    return this.totalDurationS;
  }

  public getPointCount(): number {
    return this.trajectory.length;
  }

  /**
   * Evaluates continuous state at arbitrary simulation time tS via Cubic Hermite Spline
   */
  public evaluateAtTime(timeS: number): InterpolatedState {
    const n = this.trajectory.length;
    if (n === 0) {
      return this.getEmptyState(timeS);
    }

    // Clamp time to simulation boundaries and terminal collision time
    const maxAllowedTime = this.collisionDetected
      ? Math.min(this.collisionTimeS, this.trajectory[n - 1].timeS)
      : this.trajectory[n - 1].timeS;

    const clampedTime = Math.max(this.trajectory[0].timeS, Math.min(maxAllowedTime, timeS));
    const isTerminalImpact = this.collisionDetected && timeS >= this.collisionTimeS;

    // Fast O(1) forward lookup with binary search fallback
    let idx = this.findSegmentIndex(clampedTime);

    if (idx >= n - 1) {
      const last = this.trajectory[n - 1];
      return this.fromExactPoint(last, isTerminalImpact);
    }

    const p0 = this.trajectory[idx];
    const p1 = this.trajectory[idx + 1];

    const dt = p1.timeS - p0.timeS;
    if (dt <= 1e-6) {
      return this.fromExactPoint(p0, isTerminalImpact);
    }

    const u = Math.max(0.0, Math.min(1.0, (clampedTime - p0.timeS) / dt));

    // Cubic Hermite basis functions
    const u2 = u * u;
    const u3 = u2 * u;

    const h00 = 2 * u3 - 3 * u2 + 1;
    const h10 = u3 - 2 * u2 + u;
    const h01 = -2 * u3 + 3 * u2;
    const h11 = u3 - u2;

    // Derivatives for velocity
    const dh00 = (6 * u2 - 6 * u) / dt;
    const dh10 = 3 * u2 - 4 * u + 1;
    const dh01 = (-6 * u2 + 6 * u) / dt;
    const dh11 = 3 * u2 - 2 * u;

    // 1. Planet-Centric Hermite Position & Velocity
    const posPlanetM = new THREE.Vector3(
      h00 * p0.posPlanetM.x + h10 * dt * p0.velPlanetMPerS.x + h01 * p1.posPlanetM.x + h11 * dt * p1.velPlanetMPerS.x,
      h00 * p0.posPlanetM.y + h10 * dt * p0.velPlanetMPerS.y + h01 * p1.posPlanetM.y + h11 * dt * p1.velPlanetMPerS.y,
      h00 * p0.posPlanetM.z + h10 * dt * p0.velPlanetMPerS.z + h01 * p1.posPlanetM.z + h11 * dt * p1.velPlanetMPerS.z
    );

    const velPlanetM = new THREE.Vector3(
      dh00 * p0.posPlanetM.x + dh10 * p0.velPlanetMPerS.x + dh01 * p1.posPlanetM.x + dh11 * p1.velPlanetMPerS.x,
      dh00 * p0.posPlanetM.y + dh10 * p0.velPlanetMPerS.y + dh01 * p1.posPlanetM.y + dh11 * p1.velPlanetMPerS.y,
      dh00 * p0.posPlanetM.z + dh10 * p0.velPlanetMPerS.z + dh01 * p1.posPlanetM.z + dh11 * p1.velPlanetMPerS.z
    );

    // 2. Sun-Centric Hermite Position & Velocity
    const posSunM = new THREE.Vector3(
      h00 * p0.posSunM.x + h10 * dt * p0.velSunMPerS.x + h01 * p1.posSunM.x + h11 * dt * p1.velSunMPerS.x,
      h00 * p0.posSunM.y + h10 * dt * p0.velSunMPerS.y + h01 * p1.posSunM.y + h11 * dt * p1.velSunMPerS.y,
      h00 * p0.posSunM.z + h10 * dt * p0.velSunMPerS.z + h01 * p1.posSunM.z + h11 * dt * p1.velSunMPerS.z
    );

    const velSunM = new THREE.Vector3(
      dh00 * p0.posSunM.x + dh10 * p0.velSunMPerS.x + dh01 * p1.posSunM.x + dh11 * p1.velSunMPerS.x,
      dh00 * p0.posSunM.y + dh10 * p0.velSunMPerS.y + dh01 * p1.posSunM.y + dh11 * p1.velSunMPerS.y,
      dh00 * p0.posSunM.z + dh10 * p0.velSunMPerS.z + dh01 * p1.posSunM.z + dh11 * p1.velSunMPerS.z
    );

    // 3. Planet Sun Position & Velocity (linear interpolation along planet orbit)
    const planetPosSunM = new THREE.Vector3(
      p0.planetPosSunM.x + (p1.planetPosSunM.x - p0.planetPosSunM.x) * u,
      p0.planetPosSunM.y + (p1.planetPosSunM.y - p0.planetPosSunM.y) * u,
      p0.planetPosSunM.z + (p1.planetPosSunM.z - p0.planetPosSunM.z) * u
    );

    const planetVelSunM = new THREE.Vector3(
      p0.planetVelSunMPerS.x + (p1.planetVelSunMPerS.x - p0.planetVelSunMPerS.x) * u,
      p0.planetVelSunMPerS.y + (p1.planetVelSunMPerS.y - p0.planetVelSunMPerS.y) * u,
      p0.planetVelSunMPerS.z + (p1.planetVelSunMPerS.z - p0.planetVelSunMPerS.z) * u
    );

    // 4. Physical Scalar Quantities
    const distCenterM = posPlanetM.length();
    const altitudeM = distCenterM - this.planetRadiusM;
    const speedPlanetMPerS = velPlanetM.length();
    const speedSunMPerS = velSunM.length();

    // Gravitational acceleration strictly inverse-square: g = mu / r^2
    const gAccel = this.planetMu / Math.max(1e6, distCenterM * distCenterM);

    const progressFraction = Math.max(0.0, Math.min(1.0, clampedTime / Math.max(1.0, this.totalDurationS)));

    return {
      timeS: clampedTime,
      posPlanetM,
      velPlanetM,
      speedPlanetMPerS,
      distanceFromCenterM: distCenterM,
      altitudeM,
      gravitationalAccelerationMPerS2: gAccel,
      posSunM,
      velSunM,
      planetPosSunM,
      planetVelSunM,
      speedSunMPerS,
      progressFraction,
      isTerminalImpact,
    };
  }

  private findSegmentIndex(t: number): number {
    const pts = this.trajectory;
    const n = pts.length;

    // Check sequential next step
    if (this.lastSearchIndex < n - 1) {
      if (t >= pts[this.lastSearchIndex].timeS && t <= pts[this.lastSearchIndex + 1].timeS) {
        return this.lastSearchIndex;
      }
      if (this.lastSearchIndex + 1 < n - 1 && t >= pts[this.lastSearchIndex + 1].timeS && t <= pts[this.lastSearchIndex + 2].timeS) {
        this.lastSearchIndex++;
        return this.lastSearchIndex;
      }
    }

    // Binary search fallback for non-sequential seek / scrubbing
    let low = 0;
    let high = n - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (pts[mid].timeS <= t) {
        if (mid === n - 1 || pts[mid + 1].timeS > t) {
          this.lastSearchIndex = mid;
          return mid;
        }
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    this.lastSearchIndex = 0;
    return 0;
  }

  private fromExactPoint(pt: TrajectoryPoint, isTerminalImpact: boolean): InterpolatedState {
    return {
      timeS: pt.timeS,
      posPlanetM: new THREE.Vector3(pt.posPlanetM.x, pt.posPlanetM.y, pt.posPlanetM.z),
      velPlanetM: new THREE.Vector3(pt.velPlanetMPerS.x, pt.velPlanetMPerS.y, pt.velPlanetMPerS.z),
      speedPlanetMPerS: pt.speedPlanetMPerS,
      distanceFromCenterM: pt.distanceFromCenterM,
      altitudeM: pt.altitudeM,
      gravitationalAccelerationMPerS2: pt.gravitationalAccelerationMPerS2,
      posSunM: new THREE.Vector3(pt.posSunM.x, pt.posSunM.y, pt.posSunM.z),
      velSunM: new THREE.Vector3(pt.velSunMPerS.x, pt.velSunMPerS.y, pt.velSunMPerS.z),
      planetPosSunM: new THREE.Vector3(pt.planetPosSunM.x, pt.planetPosSunM.y, pt.planetPosSunM.z),
      planetVelSunM: new THREE.Vector3(pt.planetVelSunMPerS.x, pt.planetVelSunMPerS.y, pt.planetVelSunMPerS.z),
      speedSunMPerS: pt.speedSunMPerS,
      progressFraction: Math.max(0.0, Math.min(1.0, pt.timeS / Math.max(1.0, this.totalDurationS))),
      isTerminalImpact,
    };
  }

  private getEmptyState(timeS: number): InterpolatedState {
    return {
      timeS,
      posPlanetM: new THREE.Vector3(),
      velPlanetM: new THREE.Vector3(),
      speedPlanetMPerS: 0,
      distanceFromCenterM: 0,
      altitudeM: 0,
      gravitationalAccelerationMPerS2: 0,
      posSunM: new THREE.Vector3(),
      velSunM: new THREE.Vector3(),
      planetPosSunM: new THREE.Vector3(),
      planetVelSunM: new THREE.Vector3(),
      speedSunMPerS: 0,
      progressFraction: 0,
      isTerminalImpact: false,
    };
  }
}
