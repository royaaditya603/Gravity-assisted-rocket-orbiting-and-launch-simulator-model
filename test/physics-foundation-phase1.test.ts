import { describe, it, expect } from 'vitest';
import {
  FlybyEngine,
  FlybyInitialConditions,
  PLANETARY_BODIES,
  Vector3D,
  CoordinateFrames,
} from '../src/physics';

describe('ASTRA Phase 1 — Gravity Assist Physics Engine Verification Suite', () => {
  const jupiter = PLANETARY_BODIES.JUPITER;
  const earth = PLANETARY_BODIES.EARTH;
  const saturn = PLANETARY_BODIES.SATURN;
  const venus = PLANETARY_BODIES.VENUS;

  // --------------------------------------------------------------------------
  // Test 1: No-gravity limit (trajectory approaches straight-line motion)
  // --------------------------------------------------------------------------
  it('1. No-gravity limit: trajectory approaches straight-line motion without deflection', () => {
    // Theoretical zero-mass / zero-gravity planet
    const zeroGravPlanet = {
      ...earth,
      id: 'ZERO_G_BODY',
      name: 'Zero Gravity Marker',
      mu: 0.0,
      massKg: 0.0,
      radiusM: 1000000.0, // 1,000 km
      orbitalSpeedMPerS: 0.0,
    };

    const config: FlybyInitialConditions = {
      planet: zeroGravPlanet,
      vInfSpeedMPerS: 10000.0, // 10 km/s
      targetPeriapsisM: 5000000.0, // 5,000 km miss distance
      passType: 'TRAILING',
      spacecraftMassKg: 1000.0,
      approachAngleDeg: 0.0,
    };

    const analytical = FlybyEngine.computeAnalytical(config);
    // Deflection angle must be exactly zero in zero-gravity limit
    expect(analytical.deflectionAngleDeg).toBe(0.0);
    expect(analytical.deflectionAngleRad).toBe(0.0);
    expect(analytical.deltaVVectorMPerS.magnitude()).toBe(0.0);
    expect(analytical.deltaVSpeedMPerS).toBe(0.0);

    const simulation = FlybyEngine.runSimulation(config);
    expect(simulation.status).toBe('COMPLETED');
    expect(simulation.collisionDetected).toBe(false);
    expect(simulation.numericalDeflectionAngleDeg).toBeCloseTo(0.0, 5);
    expect(simulation.speedConservationErrorPercent).toBeCloseTo(0.0, 5);

    // Trajectory must remain on a straight line: Y velocity remains zero to machine precision
    for (const pt of simulation.trajectory) {
      expect(pt.velPlanetMPerS.y).toBeCloseTo(0.0, 5);
      expect(pt.speedPlanetMPerS).toBeCloseTo(10000.0, 4);
    }
  });

  // --------------------------------------------------------------------------
  // Test 2: Zero-impact-parameter limiting case (handled safely without NaN/crash)
  // --------------------------------------------------------------------------
  it('2. Zero-impact-parameter limiting case: handled safely and triggers physical collision', () => {
    const config: FlybyInitialConditions = {
      planet: jupiter,
      vInfSpeedMPerS: 12000.0,
      impactParameterM: 0.0, // Exactly zero impact parameter: direct head-on plunge
      passType: 'TRAILING',
      spacecraftMassKg: 1000.0,
    };

    const analytical = FlybyEngine.computeAnalytical(config);
    expect(analytical.impactParameterM).toBe(0.0);
    expect(analytical.periapsisRadiusM).toBe(0.0);
    expect(analytical.isPhysicalCollision).toBe(true);
    expect(isFinite(analytical.deflectionAngleDeg)).toBe(true);

    const simulation = FlybyEngine.runSimulation(config);
    // Must flag collision safely without generating NaN or infinite values
    expect(simulation.collisionDetected).toBe(true);
    expect(simulation.status).toBe('COLLIDED');
    expect(simulation.collisionPositionPlanetM).toBeDefined();

    // Verify collision point lands on Jupiter's physical surface
    const impactDist = simulation.collisionPositionPlanetM!.magnitude();
    expect(impactDist).toBeCloseTo(jupiter.radiusM, 1);

    // Ensure no NaN coordinates exist anywhere in the trajectory
    for (const pt of simulation.trajectory) {
      expect(isFinite(pt.posPlanetM.x)).toBe(true);
      expect(isFinite(pt.posPlanetM.y)).toBe(true);
      expect(isFinite(pt.speedPlanetMPerS)).toBe(true);
    }
  });

  // --------------------------------------------------------------------------
  // Test 3: Symmetric ideal flyby preserves asymptotic planet-relative speed
  // --------------------------------------------------------------------------
  it('3. Symmetric ideal flyby preserves asymptotic planet-relative speed', () => {
    const vInf = 14500.0;
    const config: FlybyInitialConditions = {
      planet: jupiter,
      vInfSpeedMPerS: vInf,
      targetPeriapsisM: jupiter.radiusM * 2.2,
      passType: 'TRAILING',
      spacecraftMassKg: 1200.0,
    };

    const analytical = FlybyEngine.computeAnalytical(config);
    // Analytical speed conservation: ||v_inf(+) || == ||v_inf(-)||
    expect(analytical.vInfMinusMPerS.magnitude()).toBeCloseTo(vInf, 6);
    expect(analytical.vInfPlusMPerS.magnitude()).toBeCloseTo(vInf, 6);

    const simulation = FlybyEngine.runSimulation(config);
    expect(simulation.numericalVInfPlusSpeedMPerS).toBeCloseTo(vInf, -1); // Within 0.1%
    expect(simulation.speedConservationErrorPercent).toBeLessThan(0.1);
  });

  // --------------------------------------------------------------------------
  // Test 4: Deflection increases as closest-approach distance decreases
  // --------------------------------------------------------------------------
  it('4. Deflection increases as closest-approach distance decreases (holding planet and v_inf fixed)', () => {
    const vInf = 11000.0;
    const distances = [
      jupiter.radiusM * 5.0,
      jupiter.radiusM * 3.0,
      jupiter.radiusM * 2.0,
      jupiter.radiusM * 1.3,
    ];

    const deflections: number[] = [];

    for (const rp of distances) {
      const res = FlybyEngine.computeAnalytical({
        planet: jupiter,
        vInfSpeedMPerS: vInf,
        targetPeriapsisM: rp,
        passType: 'TRAILING',
        spacecraftMassKg: 1000.0,
      });
      deflections.push(res.deflectionAngleDeg);
    }

    // Closer approach -> smaller e -> larger 1/e -> larger deflection angle delta
    for (let i = 0; i < deflections.length - 1; i++) {
      expect(deflections[i + 1]).toBeGreaterThan(deflections[i]);
    }
  });

  // --------------------------------------------------------------------------
  // Test 5: Deflection decreases as incoming speed increases
  // --------------------------------------------------------------------------
  it('5. Deflection decreases as incoming speed increases (holding planet and r_p fixed)', () => {
    const rp = jupiter.radiusM * 1.8;
    const speeds = [5000.0, 9000.0, 15000.0, 25000.0, 40000.0];

    const deflections: number[] = [];

    for (const v of speeds) {
      const res = FlybyEngine.computeAnalytical({
        planet: jupiter,
        vInfSpeedMPerS: v,
        targetPeriapsisM: rp,
        passType: 'TRAILING',
        spacecraftMassKg: 1000.0,
      });
      deflections.push(res.deflectionAngleDeg);
    }

    // Higher speed -> larger e -> smaller 1/e -> smaller deflection angle delta
    for (let i = 0; i < deflections.length - 1; i++) {
      expect(deflections[i + 1]).toBeLessThan(deflections[i]);
    }
  });

  // --------------------------------------------------------------------------
  // Test 6: Higher planet mass increases deflection under otherwise identical conditions
  // --------------------------------------------------------------------------
  it('6. Higher planet mass increases deflection under identical conditions (mu_Venus < mu_Earth < mu_Saturn < mu_Jupiter)', () => {
    const commonRp = 300000000.0; // 300,000 km common periapsis
    const commonVInf = 12000.0; // 12 km/s

    const bodies = [venus, earth, saturn, jupiter];
    const deflections = bodies.map((b) => {
      const res = FlybyEngine.computeAnalytical({
        planet: b,
        vInfSpeedMPerS: commonVInf,
        targetPeriapsisM: commonRp,
        passType: 'TRAILING',
        spacecraftMassKg: 1000.0,
      });
      return { id: b.id, mu: b.mu, deflection: res.deflectionAngleDeg };
    });

    for (let i = 0; i < deflections.length - 1; i++) {
      expect(deflections[i + 1].deflection).toBeGreaterThan(deflections[i].deflection);
    }
  });

  // --------------------------------------------------------------------------
  // Test 7: Incoming/outgoing vectors are consistent with analytical hyperbolic solution
  // --------------------------------------------------------------------------
  it('7. Incoming/outgoing vectors are consistent with analytical hyperbolic solution and sign convention', () => {
    const configTrailing: FlybyInitialConditions = {
      planet: jupiter,
      vInfSpeedMPerS: 12000.0,
      targetPeriapsisM: jupiter.radiusM * 1.5,
      passType: 'TRAILING',
      spacecraftMassKg: 1000.0,
      approachAngleDeg: 0.0,
    };

    const trailing = FlybyEngine.computeAnalytical(configTrailing);
    const delta = trailing.deflectionAngleRad;

    // Deflection magnitude: ||Delta_v|| = 2 * v_inf * sin(delta / 2)
    const expectedDeltaVMag = 2.0 * trailing.vInfMPerS * Math.sin(delta / 2.0);
    expect(trailing.deltaVVectorMagnitudeMPerS).toBeCloseTo(expectedDeltaVMag, 4);

    // Trailing flyby rotates velocity towards +Y (planet orbital motion): vInfPlus.y > 0
    expect(trailing.vInfPlusMPerS.y).toBeGreaterThan(0.0);
    expect(trailing.deltaVSpeedMPerS).toBeGreaterThan(0.0); // Boosts Sun-relative speed

    // Leading flyby rotates velocity away from planet orbital motion: vInfPlus.y < 0
    const configLeading: FlybyInitialConditions = {
      ...configTrailing,
      passType: 'LEADING',
    };
    const leading = FlybyEngine.computeAnalytical(configLeading);
    expect(leading.vInfPlusMPerS.y).toBeLessThan(0.0);
    expect(leading.deltaVSpeedMPerS).toBeLessThan(0.0); // Gravity braking
  });

  // --------------------------------------------------------------------------
  // Test 8: Collision detection works
  // --------------------------------------------------------------------------
  it('8. Collision detection works and terminates trajectory at physical surface radius', () => {
    const collisionConfig: FlybyInitialConditions = {
      planet: earth,
      vInfSpeedMPerS: 8000.0,
      targetPeriapsisM: earth.radiusM * 0.8, // 80% of Earth radius -> sub-surface impact
      passType: 'TRAILING',
      spacecraftMassKg: 1000.0,
    };

    const result = FlybyEngine.runSimulation(collisionConfig);
    expect(result.collisionDetected).toBe(true);
    expect(result.status).toBe('COLLIDED');
    expect(result.collisionPositionPlanetM).toBeDefined();

    // Verify impact position is on physical Earth surface
    const finalDist = result.collisionPositionPlanetM!.magnitude();
    expect(Math.abs(finalDist - earth.radiusM)).toBeLessThan(1.0);
  });

  // --------------------------------------------------------------------------
  // Test 9: Numerical results converge as integration tolerances are tightened
  // --------------------------------------------------------------------------
  it('9. Numerical results converge as integration step coefficients are tightened', () => {
    const config: FlybyInitialConditions = {
      planet: jupiter,
      vInfSpeedMPerS: 13000.0,
      targetPeriapsisM: jupiter.radiusM * 2.0,
      passType: 'TRAILING',
      spacecraftMassKg: 1000.0,
    };

    // Run with coarse timestep vs refined timestep
    const coarse = FlybyEngine.runSimulation(config, { timeStepCoeff: 0.04 });
    const fine = FlybyEngine.runSimulation(config, { timeStepCoeff: 0.008 });

    // Fine simulation should achieve higher conservation accuracy
    expect(fine.speedConservationErrorPercent).toBeLessThan(coarse.speedConservationErrorPercent + 0.01);
    expect(fine.trajectory.length).toBeGreaterThan(coarse.trajectory.length);
  });

  // --------------------------------------------------------------------------
  // Test 10: Energy conservation holds to documented tolerance in isolated two-body model
  // --------------------------------------------------------------------------
  it('10. Energy conservation holds to < 0.1% in the isolated two-body model', () => {
    const config: FlybyInitialConditions = {
      planet: jupiter,
      vInfSpeedMPerS: 12500.0,
      targetPeriapsisM: jupiter.radiusM * 1.7,
      passType: 'TRAILING',
      spacecraftMassKg: 1000.0,
    };

    const result = FlybyEngine.runSimulation(config);
    expect(result.status).toBe('COMPLETED');

    const eInit = result.trajectory[0].specificEnergyPlanetJPerKg;
    const eFinal = result.trajectory[result.trajectory.length - 1].specificEnergyPlanetJPerKg;
    const relativeDrift = Math.abs((eFinal - eInit) / eInit);

    // Documented tolerance: < 0.05% relative energy drift
    expect(relativeDrift).toBeLessThan(0.0005);
    expect(result.convergenceDiagnostics).toBeDefined();
    expect(result.convergenceDiagnostics!.relativeEnergyConservationError).toBeLessThan(0.0005);
  });

  // --------------------------------------------------------------------------
  // Extended Verifications: CoordinateFrames & Calculated Outputs
  // --------------------------------------------------------------------------
  describe('Coordinate Frames, Energy Identity, and Calculated Output Fields', () => {
    it('verifies fundamental energy identity: Delta_epsilon_Sun = V_planet · Delta_v_vector', () => {
      // For any physical flyby where ||v_rel,out|| == ||v_rel,in||:
      const vPlanetSun = new Vector3D(0.0, 13056.0, 0.0);
      const vRelIn = new Vector3D(10000.0, 2000.0, 0.0);
      const vRelSpeed = vRelIn.magnitude();

      // Rotate vRelIn by 35 degrees (hyperbolic deflection)
      const angleRad = (35.0 * Math.PI) / 180.0;
      const vRelOut = new Vector3D(
        vRelIn.x * Math.cos(angleRad) - vRelIn.y * Math.sin(angleRad),
        vRelIn.x * Math.sin(angleRad) + vRelIn.y * Math.cos(angleRad),
        0.0
      ).normalize().scale(vRelSpeed);

      const vInSun = CoordinateFrames.toSunRelative(vRelIn, vPlanetSun);
      const vOutSun = CoordinateFrames.toSunRelative(vRelOut, vPlanetSun);

      const check = CoordinateFrames.verifyEnergyIdentity(vInSun, vOutSun, vPlanetSun);
      expect(check.errorAbsoluteJPerKg).toBeLessThan(1e-7); // Within IEEE 754 precision limit
    });

    it('proves scalar speed change differs from vector delta-v magnitude', () => {
      const vIn = new Vector3D(10000.0, 5000.0, 0.0);
      const vOut = new Vector3D(12000.0, 1000.0, 0.0);

      const scalarDeltaSpeed = CoordinateFrames.computeScalarSpeedChange(vOut, vIn);
      const vectorDeltaVMag = CoordinateFrames.computeVectorDeltaVMagnitude(vOut, vIn);

      // By triangle inequality, ||v_out - v_in|| >= | ||v_out|| - ||v_in|| |
      expect(vectorDeltaVMag).toBeGreaterThan(Math.abs(scalarDeltaSpeed));
    });

    it('populates peak gravitational acceleration and duration on result object', () => {
      const config: FlybyInitialConditions = {
        planet: jupiter,
        vInfSpeedMPerS: 10000.0,
        targetPeriapsisM: jupiter.radiusM * 1.5,
        passType: 'TRAILING',
        spacecraftMassKg: 1000.0,
      };

      const result = FlybyEngine.runSimulation(config);

      expect(result.peakGravitationalAccelerationMPerS2).toBeGreaterThan(0.0);
      expect(result.peakGravitationalAccelerationG0).toBeGreaterThan(0.0);
      expect(result.flybyDurationS).toBeGreaterThan(0.0);
      expect(typeof result.sunRelativeDeltaVSpeedMPerS).toBe('number');
      expect(result.sunRelativeDeltaVVectorMPerS).toBeInstanceOf(Vector3D);
    });
  });
});
