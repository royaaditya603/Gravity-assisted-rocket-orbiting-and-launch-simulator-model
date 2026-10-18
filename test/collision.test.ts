import { describe, it, expect } from 'vitest';
import { CollisionDetector } from '../src/physics/CollisionDetector';
import { Vector3D } from '../src/physics/Vector3D';
import { R_EARTH } from '../src/physics/constants';

describe('Planetary Surface Collision Detection', () => {
  it('detects clear flight with no penetration', () => {
    const r0 = new Vector3D(R_EARTH + 100000.0, 0, 0);
    const r1 = new Vector3D(R_EARTH + 100100.0, 500.0, 0);

    const result = CollisionDetector.checkSurfaceCollision(r0, r1, R_EARTH);
    expect(result.hasCollided).toBe(false);
  });

  it('detects exact sub-step surface impact, computes root tau, and sets terminal zero velocity', () => {
    // r0 at altitude +1,000 m (r = 6,372,000 m)
    // r1 penetrating Earth at -1,000 m (r = 6,370,000 m)
    const r0 = new Vector3D(R_EARTH + 1000.0, 0, 0);
    const r1 = new Vector3D(R_EARTH - 1000.0, 0, 0);

    const result = CollisionDetector.checkSurfaceCollision(r0, r1, R_EARTH);
    expect(result.hasCollided).toBe(true);
    expect(result.impactFraction).toBeCloseTo(0.5, 4);

    // Impact position must lie exactly on spherical surface r = R_E
    expect(result.impactPositionM.magnitude()).toBeCloseTo(R_EARTH, 4);
    expect(result.impactPositionM.x).toBeCloseTo(R_EARTH, 4);

    // Terminal velocity at impact must be strictly zero (no artificial surface rotation injected into vehicle velocity)
    expect(result.impactVelocityMPerS.magnitude()).toBe(0.0);
  });

  it('verifies collision timing and position accuracy against a high-resolution small-timestep reference', () => {
    // High-speed incoming trajectory traversing from 20 km altitude to 20 km below surface
    const vY = 3000.0;
    const vX = -4000.0;
    const dt = 10.0; // 10-second coarse step

    const r0 = new Vector3D(R_EARTH + 20000.0, 0, 0);
    const r1 = new Vector3D(r0.x + vX * dt, r0.y + vY * dt, 0);

    // Coarse step collision detection
    const coarseResult = CollisionDetector.checkSurfaceCollision(r0, r1, R_EARTH);
    expect(coarseResult.hasCollided).toBe(true);

    // High-resolution reference (10,000 sub-steps)
    const N = 10000;
    const subDt = dt / N;
    let refPos = r0.clone();
    let refImpactPos: Vector3D | null = null;
    let refImpactTimeFraction = 0.0;

    for (let i = 0; i < N; i++) {
      const nextPos = new Vector3D(
        r0.x + vX * (i + 1) * subDt,
        r0.y + vY * (i + 1) * subDt,
        0
      );
      if (nextPos.magnitude() <= R_EARTH) {
        refImpactTimeFraction = i / N;
        refImpactPos = nextPos.clone().normalize().scale(R_EARTH);
        break;
      }
      refPos = nextPos;
    }

    expect(refImpactPos).not.toBeNull();
    // Timing fraction must agree within fine sub-step tolerance
    expect(coarseResult.impactFraction).toBeCloseTo(refImpactTimeFraction, 2);

    // Impact position must agree within sub-step spatial resolution (< 50 meters over a 50 km step)
    const posDiff = Vector3D.distance(coarseResult.impactPositionM, refImpactPos!);
    expect(posDiff).toBeLessThan(50.0);
  });
});
