import { Vector3D, IVector3D } from './Vector3D';

/**
 * Coordinate Frames & Astrodynamic Transformations for ASTRA
 *
 * Explicitly distinguishes and converts between:
 * 1. Planet-Centric Rest Frame (Non-inertial planet rest frame during encounter)
 *    - Origin: Center of mass of the target planet
 *    - Relative velocity: v_rel = v_sc - v_planet
 *    - Energy theorem: In the restricted 2-body approximation with no external work,
 *      speed at infinity is strictly conserved: ||v_inf,minus|| = ||v_inf,plus||.
 *      The encounter purely rotates the relative velocity vector by deflection angle delta.
 *
 * 2. Sun-Centric (Heliocentric) Frame (Primary inertial reference frame of the solar system)
 *    - Origin: Center of the Sun (or parent star)
 *    - Inertial velocity: v_sc,Sun = v_rel + v_planet
 *    - Energy theorem: The spacecraft's Sun-relative specific energy changes by:
 *      delta_epsilon_Sun = 0.5 * (||v_out,Sun||^2 - ||v_in,Sun||^2) = V_planet · Delta_v_vector.
 *      Depending on encounter geometry (trailing vs. leading), Sun-relative speed can
 *      increase (gravity assist / slingshot) or decrease (gravity braking).
 *
 * CRITICAL ASTRODYNAMICS DISTINCTION:
 * - Scalar speed change: Delta_v_speed = ||v_out|| - ||v_in|| (can be positive, zero, or negative)
 * - Vector velocity change magnitude: ||Delta_v_vector|| = ||v_out - v_in|| (always >= 0)
 * These two quantities are fundamentally distinct and must never be conflated.
 */
export class CoordinateFrames {
  /**
   * Transforms velocity from Sun-relative (heliocentric) frame to planet-relative frame:
   * v_rel = v_sc,Sun - v_planet,Sun
   */
  static toPlanetRelative(vScSun: IVector3D, vPlanetSun: IVector3D): Vector3D {
    return new Vector3D(
      vScSun.x - vPlanetSun.x,
      vScSun.y - vPlanetSun.y,
      vScSun.z - vPlanetSun.z
    );
  }

  /**
   * Transforms velocity from planet-relative frame to Sun-relative (heliocentric) frame:
   * v_sc,Sun = v_rel + v_planet,Sun
   */
  static toSunRelative(vRel: IVector3D, vPlanetSun: IVector3D): Vector3D {
    return new Vector3D(
      vRel.x + vPlanetSun.x,
      vRel.y + vPlanetSun.y,
      vRel.z + vPlanetSun.z
    );
  }

  /**
   * Computes vector velocity change:
   * Delta_v_vector = v_out - v_in
   * (Invariant between planet frame and Sun frame when planet velocity is constant)
   */
  static computeVectorVelocityChange(vOut: IVector3D, vIn: IVector3D): Vector3D {
    return new Vector3D(
      vOut.x - vIn.x,
      vOut.y - vIn.y,
      vOut.z - vIn.z
    );
  }

  /**
   * Computes magnitude of vector velocity change:
   * ||Delta_v_vector|| = ||v_out - v_in||
   */
  static computeVectorDeltaVMagnitude(vOut: IVector3D, vIn: IVector3D): number {
    const dv = CoordinateFrames.computeVectorVelocityChange(vOut, vIn);
    return dv.magnitude();
  }

  /**
   * Computes scalar speed change:
   * Delta_v_speed = ||v_out|| - ||v_in||
   */
  static computeScalarSpeedChange(vOut: IVector3D, vIn: IVector3D): number {
    const spdOut = Math.sqrt(vOut.x * vOut.x + vOut.y * vOut.y + vOut.z * vOut.z);
    const spdIn = Math.sqrt(vIn.x * vIn.x + vIn.y * vIn.y + vIn.z * vIn.z);
    return spdOut - spdIn;
  }

  /**
   * Specific kinetic energy:
   * epsilon_k = 0.5 * ||v||^2  (J/kg or m^2/s^2)
   */
  static computeSpecificKineticEnergy(v: IVector3D): number {
    return 0.5 * (v.x * v.x + v.y * v.y + v.z * v.z);
  }

  /**
   * Total kinetic energy:
   * K = 0.5 * m * ||v||^2  (Joules)
   */
  static computeKineticEnergy(massKg: number, v: IVector3D): number {
    return 0.5 * massKg * (v.x * v.x + v.y * v.y + v.z * v.z);
  }

  /**
   * Evaluates the fundamental gravity assist energy identity:
   * delta_epsilon = 0.5 * (||v_out,Sun||^2 - ||v_in,Sun||^2)
   * work = V_planet · Delta_v_vector
   * Returns { deltaEnergy, workDoneByPlanet, errorAbsolute, errorRelative }
   */
  static verifyEnergyIdentity(
    vInSun: IVector3D,
    vOutSun: IVector3D,
    vPlanetSun: IVector3D
  ): {
    deltaSpecificEnergyJPerKg: number;
    workDoneByPlanetJPerKg: number;
    errorAbsoluteJPerKg: number;
  } {
    const epsIn = CoordinateFrames.computeSpecificKineticEnergy(vInSun);
    const epsOut = CoordinateFrames.computeSpecificKineticEnergy(vOutSun);
    const deltaEps = epsOut - epsIn;

    const deltaV = CoordinateFrames.computeVectorVelocityChange(vOutSun, vInSun);
    const work = vPlanetSun.x * deltaV.x + vPlanetSun.y * deltaV.y + vPlanetSun.z * deltaV.z;

    return {
      deltaSpecificEnergyJPerKg: deltaEps,
      workDoneByPlanetJPerKg: work,
      errorAbsoluteJPerKg: Math.abs(deltaEps - work),
    };
  }

  // --- Display Units Conversion Utilities (SI to/from common engineering units) ---

  static metersToKilometers(m: number): number {
    return m / 1000.0;
  }

  static kilometersToMeters(km: number): number {
    return km * 1000.0;
  }

  static metersPerSecondToKmPerSecond(mps: number): number {
    return mps / 1000.0;
  }

  static kmPerSecondToMetersPerSecond(kmps: number): number {
    return kmps * 1000.0;
  }

  static secondsToDays(s: number): number {
    return s / 86400.0;
  }

  static daysToSeconds(days: number): number {
    return days * 86400.0;
  }

  static radiansToDegrees(rad: number): number {
    return (rad * 180.0) / Math.PI;
  }

  static degreesToRadians(deg: number): number {
    return (deg * Math.PI) / 180.0;
  }
}
