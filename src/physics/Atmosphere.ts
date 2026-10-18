import { Vector3D, IVector3D } from './Vector3D';
import { R_EARTH, RHO_0, P_0, H_SCALE, H_ATMOSPHERE, OMEGA_EARTH } from './constants';

export interface AtmosphereState {
  densityKgM3: number;
  pressurePa: number;
  dynamicPressurePa: number;
  dragForceN: Vector3D;
  dragAccelerationMPerS2: Vector3D;
  relativeVelocityMPerS: Vector3D;
}

/**
 * Atmospheric & Aerodynamic Model
 *
 * MODEL ASSUMPTIONS & KNOWN LIMITATIONS:
 * 1. Isothermal Hydrostatic Atmosphere: Uses an exponential barometric decay with a constant
 *    density scale height (H_scale = 8,500 m).
 * 2. Temperature Layers Neglected: Real planetary atmospheres have tropospheric lapse rates,
 *    stratospheric warming, and thermospheric expansion.
 * 3. Kármán Line Cutoff: At h >= 100,000 m (100 km), atmospheric density is strictly clamped
 *    to 0.0 kg/m^3 and aerodynamic drag is disabled (0.0 N).
 * 4. Atmospheric Co-Rotation: Air mass rotates with Earth's angular velocity vector
 *    omega = (0, 0, OMEGA_EARTH).
 */
export class Atmosphere {
  /**
   * Calculates atmospheric density and pressure at altitude h above reference radius R_E.
   */
  static getProperties(altitudeM: number): { density: number; pressure: number } {
    if (altitudeM >= H_ATMOSPHERE) {
      return { density: 0.0, pressure: 0.0 };
    }
    const clampedAlt = Math.max(0.0, altitudeM);
    const exponent = -clampedAlt / H_SCALE;
    const factor = Math.exp(exponent);
    return {
      density: RHO_0 * factor,
      pressure: P_0 * factor,
    };
  }

  /**
   * Calculates aerodynamic drag force and acceleration on a vehicle.
   */
  static computeAerodynamics(
    position: IVector3D,
    velocity: IVector3D,
    massKg: number,
    cd: number,
    areaM2: number,
    includeCoRotation: boolean = true
  ): AtmosphereState {
    const r = Math.sqrt(position.x * position.x + position.y * position.y + position.z * position.z);
    const altitudeM = r - R_EARTH;

    // Atmospheric wind due to planetary rotation: v_wind = omega x r = [-omega*y, omega*x, 0]
    const vWindX = includeCoRotation ? -OMEGA_EARTH * position.y : 0.0;
    const vWindY = includeCoRotation ? OMEGA_EARTH * position.x : 0.0;
    const vWindZ = 0.0;

    const relVx = velocity.x - vWindX;
    const relVy = velocity.y - vWindY;
    const relVz = velocity.z - vWindZ;
    const relSpeed = Math.sqrt(relVx * relVx + relVy * relVy + relVz * relVz);

    const { density, pressure } = this.getProperties(altitudeM);

    if (density <= 0.0 || relSpeed <= 0.0 || massKg <= 0.0) {
      return {
        densityKgM3: 0.0,
        pressurePa: 0.0,
        dynamicPressurePa: 0.0,
        dragForceN: new Vector3D(0, 0, 0),
        dragAccelerationMPerS2: new Vector3D(0, 0, 0),
        relativeVelocityMPerS: new Vector3D(relVx, relVy, relVz),
      };
    }

    // Dynamic pressure: q = 0.5 * rho * v_rel^2
    const dynamicPressurePa = 0.5 * density * relSpeed * relSpeed;

    // Drag force magnitude: D = q * C_d * A
    // Vector points opposite to relative velocity
    const dragMagnitude = dynamicPressurePa * cd * areaM2;
    const invSpeed = 1.0 / relSpeed;

    const dragForceN = new Vector3D(
      -dragMagnitude * relVx * invSpeed,
      -dragMagnitude * relVy * invSpeed,
      -dragMagnitude * relVz * invSpeed
    );

    const invMass = 1.0 / massKg;
    const dragAccelerationMPerS2 = new Vector3D(
      dragForceN.x * invMass,
      dragForceN.y * invMass,
      dragForceN.z * invMass
    );

    return {
      densityKgM3: density,
      pressurePa: pressure,
      dynamicPressurePa,
      dragForceN,
      dragAccelerationMPerS2,
      relativeVelocityMPerS: new Vector3D(relVx, relVy, relVz),
    };
  }
}
