import { Vector3D, IVector3D } from './Vector3D';
import { R_EARTH } from './constants';

export interface CollisionResult {
  hasCollided: boolean;
  impactFraction: number; // 0.0 to 1.0 (tau)
  impactPositionM: Vector3D;
  impactVelocityMPerS: Vector3D; // Terminal velocity at impact (0, 0, 0)
}

/**
 * Robust Spherical Surface Collision Detector
 *
 * Computes exact geometric collision timing against the solid planetary surface (r = R_E)
 * using quadratic sub-step intersection.
 *
 * A collision occurs IF AND ONLY IF the vehicle penetrates below the surface (r1 < R_E)
 * while moving downward (r1 < r0). Liftoff and outward motion (r1 >= r0) never trigger collision.
 */
export class CollisionDetector {
  /**
   * Tests whether a trajectory step from r0 to r1 penetrates Earth's physical surface.
   * Computes the exact sub-step intersection using quadratic root-finding.
   */
  static checkSurfaceCollision(
    r0: IVector3D,
    r1: IVector3D,
    surfaceRadiusM: number = R_EARTH
  ): CollisionResult {
    const r0MagSq = r0.x * r0.x + r0.y * r0.y + r0.z * r0.z;
    const r1MagSq = r1.x * r1.x + r1.y * r1.y + r1.z * r1.z;
    const surfSq = surfaceRadiusM * surfaceRadiusM;

    // If endpoint r1 is outside/at surface, or vehicle is ascending/moving outward (r1 >= r0), no collision
    if (r1MagSq >= surfSq || r1MagSq >= r0MagSq) {
      return {
        hasCollided: false,
        impactFraction: 1.0,
        impactPositionM: new Vector3D(r1.x, r1.y, r1.z),
        impactVelocityMPerS: new Vector3D(0, 0, 0),
      };
    }

    // Displacement vector: dr = r1 - r0
    const dx = r1.x - r0.x;
    const dy = r1.y - r0.y;
    const dz = r1.z - r0.z;

    const A = dx * dx + dy * dy + dz * dz;
    const B = 2.0 * (r0.x * dx + r0.y * dy + r0.z * dz);
    const C = r0MagSq - surfSq;

    let tau = 1.0;
    if (A > 1e-12) {
      const disc = B * B - 4.0 * A * C;
      if (disc >= 0.0) {
        const sqrtDisc = Math.sqrt(disc);
        const t1 = (-B - sqrtDisc) / (2.0 * A);
        const t2 = (-B + sqrtDisc) / (2.0 * A);

        if (t1 >= 0.0 && t1 <= 1.0) {
          tau = t1;
        } else if (t2 >= 0.0 && t2 <= 1.0) {
          tau = t2;
        } else {
          tau = 0.0;
        }
      } else {
        tau = 0.0;
      }
    } else {
      tau = 0.0;
    }

    tau = Math.max(0.0, Math.min(1.0, tau));

    // Exact intersection position along step ray
    const impactPos = new Vector3D(
      r0.x + tau * dx,
      r0.y + tau * dy,
      r0.z + tau * dz
    );

    // Normalize to exact surface radius to eliminate floating-point truncation
    impactPos.normalize().scale(surfaceRadiusM);

    return {
      hasCollided: true,
      impactFraction: tau,
      impactPositionM: impactPos,
      impactVelocityMPerS: new Vector3D(0, 0, 0), // Terminal impact state: zero velocity
    };
  }
}
