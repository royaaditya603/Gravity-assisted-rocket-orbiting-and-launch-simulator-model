import { Vector3D, IVector3D } from './Vector3D';

export interface GravityAssistResult {
  vInfMinusMPerS: Vector3D;
  vInfPlusMPerS: Vector3D;
  vInfSpeedMPerS: number;
  deflectionAngleRad: number;
  deflectionAngleDeg: number;
  deltaVAssistMPerS: Vector3D;
  deltaVAssistMagnitudeMPerS: number;
  vOutCentralMPerS: Vector3D;
  vOutCentralSpeedMPerS: number;
  vInCentralSpeedMPerS: number;
  specificEnergyInitialJPerKg: number;
  specificEnergyFinalJPerKg: number;
  deltaSpecificEnergyJPerKg: number;
  isAcceleration: boolean;
}

/**
 * Patched-Conic Planetary Gravity Assist Mechanics
 *
 * MODEL ASSUMPTIONS & KNOWN LIMITATIONS:
 * 1. Patched-Conic Approximation: Treats the flyby as an unperturbed 2-body hyperbolic encounter
 *    inside the planet's Sphere of Influence (SOI). It neglects the simultaneous gravitational field
 *    of the central body during the flyby.
 * 2. Instantaneous Conic Patching: The asymptotic excess velocities v_inf are assumed to patch
 *    cleanly at the SOI boundary.
 * 3. Point-Mass Spherical Planet: Planetary oblateness and atmospheric drag during flyby are neglected
 *    (periapsis distance r_p must remain above the planet's physical radius and atmosphere).
 */
export class GravityAssist {
  /**
   * Computes patched-conic hyperbolic flyby vector mechanics.
   *
   * @param vInCentral - Spacecraft incoming velocity vector in central (parent) frame (m/s)
   * @param vPlanetCentral - Flyby planet velocity vector in central frame (m/s)
   * @param periapsisRadiusM - Closest approach distance to planet center r_p (m)
   * @param muPlanet - Standard gravitational parameter of flyby planet (m^3/s^2)
   * @param passType - 'TRAILING' (behind planet, energy gain) or 'LEADING' (in front, energy loss)
   */
  static computeFlyby(
    vInCentral: IVector3D,
    vPlanetCentral: IVector3D,
    periapsisRadiusM: number,
    muPlanet: number,
    passType: 'TRAILING' | 'LEADING' = 'TRAILING'
  ): GravityAssistResult {
    // 1. Transform to planet-centric reference frame: v_inf(-) = v_in - V_planet
    const vInfMinus = new Vector3D(
      vInCentral.x - vPlanetCentral.x,
      vInCentral.y - vPlanetCentral.y,
      vInCentral.z - vPlanetCentral.z
    );
    const vInfSpeed = vInfMinus.magnitude();

    if (vInfSpeed <= 0.0 || periapsisRadiusM <= 0.0 || muPlanet <= 0.0) {
      const zero = new Vector3D(0, 0, 0);
      return {
        vInfMinusMPerS: zero,
        vInfPlusMPerS: zero,
        vInfSpeedMPerS: 0,
        deflectionAngleRad: 0,
        deflectionAngleDeg: 0,
        deltaVAssistMPerS: zero,
        deltaVAssistMagnitudeMPerS: 0,
        vOutCentralMPerS: new Vector3D(vInCentral.x, vInCentral.y, vInCentral.z),
        vOutCentralSpeedMPerS: Vector3D.dot(vInCentral, vInCentral),
        vInCentralSpeedMPerS: Vector3D.dot(vInCentral, vInCentral),
        specificEnergyInitialJPerKg: 0,
        specificEnergyFinalJPerKg: 0,
        deltaSpecificEnergyJPerKg: 0,
        isAcceleration: false,
      };
    }

    // 2. Hyperbolic turning angle: sin(delta / 2) = 1 / (1 + r_p * v_inf^2 / mu_p)
    const eHyperbola = 1.0 + (periapsisRadiusM * vInfSpeed * vInfSpeed) / muPlanet;
    const halfDelta = Math.asin(Math.min(1.0, 1.0 / eHyperbola));
    const deltaRad = 2.0 * halfDelta;
    const deltaDeg = (deltaRad * 180.0) / Math.PI;

    // 3. Construct encounter plane normal vector
    // Vector perpendicular to vInfMinus and planet velocity V_p
    let normal = Vector3D.cross(vInfMinus, vPlanetCentral);
    if (normal.magnitudeSq() < 1e-12) {
      // Degenerate parallel alignment, pick arbitrary perpendicular vector
      normal = new Vector3D(0, 0, 1).cross(vInfMinus);
      if (normal.magnitudeSq() < 1e-12) {
        normal = new Vector3D(0, 1, 0).cross(vInfMinus);
      }
    }
    normal.normalize();

    // Sign of rotation: Trailing pass rotates towards planet velocity vector
    const rotationSign = passType === 'TRAILING' ? 1.0 : -1.0;
    const angle = rotationSign * deltaRad;

    // Rodrigues rotation formula to rotate vInfMinus around normal by angle
    // v_rot = v * cos(theta) + (k x v) * sin(theta) + k * (k . v) * (1 - cos(theta))
    const cosTheta = Math.cos(angle);
    const sinTheta = Math.sin(angle);
    const kCrossV = Vector3D.cross(normal, vInfMinus);
    const kDotV = normal.dot(vInfMinus);

    const vInfPlus = new Vector3D(
      vInfMinus.x * cosTheta + kCrossV.x * sinTheta + normal.x * kDotV * (1.0 - cosTheta),
      vInfMinus.y * cosTheta + kCrossV.y * sinTheta + normal.y * kDotV * (1.0 - cosTheta),
      vInfMinus.z * cosTheta + kCrossV.z * sinTheta + normal.z * kDotV * (1.0 - cosTheta)
    );

    // Speed in planet rest frame is strictly conserved: ||vInfPlus|| == ||vInfMinus||
    vInfPlus.normalize().scale(vInfSpeed);

    // 4. Net velocity change in planet frame: Delta_v = vInfPlus - vInfMinus
    const deltaV = new Vector3D(
      vInfPlus.x - vInfMinus.x,
      vInfPlus.y - vInfMinus.y,
      vInfPlus.z - vInfMinus.z
    );
    const deltaVMag = deltaV.magnitude();

    // 5. Transform back to central (parent) frame: v_out = V_planet + vInfPlus
    const vOutCentral = new Vector3D(
      vPlanetCentral.x + vInfPlus.x,
      vPlanetCentral.y + vInfPlus.y,
      vPlanetCentral.z + vInfPlus.z
    );

    const vInSpeed = Math.sqrt(
      vInCentral.x * vInCentral.x + vInCentral.y * vInCentral.y + vInCentral.z * vInCentral.z
    );
    const vOutSpeed = vOutCentral.magnitude();

    // Specific kinetic energy change in parent frame: 0.5 * (vOut^2 - vIn^2) = V_planet . Delta_v
    const energyInit = 0.5 * vInSpeed * vInSpeed;
    const energyFinal = 0.5 * vOutSpeed * vOutSpeed;
    const deltaEnergy = energyFinal - energyInit;

    return {
      vInfMinusMPerS: vInfMinus,
      vInfPlusMPerS: vInfPlus,
      vInfSpeedMPerS: vInfSpeed,
      deflectionAngleRad: deltaRad,
      deflectionAngleDeg: deltaDeg,
      deltaVAssistMPerS: deltaV,
      deltaVAssistMagnitudeMPerS: deltaVMag,
      vOutCentralMPerS: vOutCentral,
      vOutCentralSpeedMPerS: vOutSpeed,
      vInCentralSpeedMPerS: vInSpeed,
      specificEnergyInitialJPerKg: energyInit,
      specificEnergyFinalJPerKg: energyFinal,
      deltaSpecificEnergyJPerKg: deltaEnergy,
      isAcceleration: deltaEnergy > 0.0,
    };
  }
}
