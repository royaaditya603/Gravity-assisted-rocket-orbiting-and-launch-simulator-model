import { describe, it, expect } from 'vitest';
import { FlybyEngine, FlybyInitialConditions, FlybySimulationResult } from '../src/physics/FlybyEngine';
import { DEFAULT_FLYBY_SCENARIO, scenarioToInitialConditions } from '../src/physics/FlybyScenario';
import { PLANETARY_BODIES } from '../src/physics/constants';

describe('Sun Frame Auto-Fitting & Approach Angle (Theta) Context Suite', () => {
  const baseConfig = scenarioToInitialConditions(DEFAULT_FLYBY_SCENARIO).config;

  describe('1. Sun Frame Trajectory Bounds Calculation Across Theta Sweeps', () => {
    // Test across extreme approach angles: -90°, -45°, 0°, +45°, +90°
    const testAngles = [-90.0, -60.0, -30.0, 0.0, 30.0, 60.0, 90.0];

    testAngles.forEach((theta) => {
      it(`calculates bounded Sun Frame trajectory coordinates for theta = ${theta}° without NaNs or infinities`, () => {
        const config: FlybyInitialConditions = {
          ...baseConfig,
          approachAngleDeg: theta,
        };
        const sim = FlybyEngine.runSimulation(config);

        expect(sim.status).toBe('COMPLETED');
        expect(sim.trajectory.length).toBeGreaterThan(50);

        const originPlanetSun = sim.trajectory[0].planetPosSunM;
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        sim.trajectory.forEach((pt) => {
          const scX = pt.posSunM.x - originPlanetSun.x;
          const scY = pt.posSunM.y - originPlanetSun.y;

          expect(Number.isFinite(scX)).toBe(true);
          expect(Number.isFinite(scY)).toBe(true);

          if (scX < minX) minX = scX;
          if (scX > maxX) maxX = scX;
          if (scY < minY) minY = scY;
          if (scY > maxY) maxY = scY;
        });

        const spanX = maxX - minX;
        const spanY = maxY - minY;

        expect(spanX).toBeGreaterThan(0);
        expect(spanY).toBeGreaterThan(0);

        // Simulated canvas view transforms with 30% padding
        const cw = 700;
        const ch = 520;
        const paddedSpanX = spanX * 1.30;
        const paddedSpanY = spanY * 1.30;
        const scale = Math.min(cw / paddedSpanX, ch / paddedSpanY);
        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;

        const toScreenX = (wx: number) => cw / 2 + (wx - midX) * scale;
        const toScreenY = (wy: number) => ch / 2 - (wy - midY) * scale;

        // Verify that EVERY point along the trajectory lies within the canvas bounds with padding!
        sim.trajectory.forEach((pt) => {
          const scX = pt.posSunM.x - originPlanetSun.x;
          const scY = pt.posSunM.y - originPlanetSun.y;
          const sx = toScreenX(scX);
          const sy = toScreenY(scY);

          expect(sx).toBeGreaterThanOrEqual(20);
          expect(sx).toBeLessThanOrEqual(cw - 20);
          expect(sy).toBeGreaterThanOrEqual(20);
          expect(sy).toBeLessThanOrEqual(ch - 20);
        });
      });
    });
  });

  describe('2. Physical Model Definition of Theta Convention', () => {
    it('confirms theta is the in-plane approach direction angle relative to +X axis', () => {
      const theta0 = FlybyEngine.runSimulation({ ...baseConfig, approachAngleDeg: 0 });
      const theta90 = FlybyEngine.runSimulation({ ...baseConfig, approachAngleDeg: 90 });

      // When theta = 0, vInfMinus is aligned along +X: (vInf, 0, 0)
      expect(theta0.analytical.vInfMinusMPerS.x).toBeGreaterThan(0);
      expect(theta0.analytical.vInfMinusMPerS.y).toBeCloseTo(0, 3);

      // When theta = 90, vInfMinus is aligned along +Y: (0, vInf, 0)
      expect(theta90.analytical.vInfMinusMPerS.x).toBeCloseTo(0, 3);
      expect(theta90.analytical.vInfMinusMPerS.y).toBeGreaterThan(0);
    });

    it('produces physically consistent heliocentric velocity asymptotes and Delta-V', () => {
      const sim = FlybyEngine.runSimulation(baseConfig);
      const v0 = sim.config.planet.orbitalSpeedMPerS ?? 0;
      const vInfMinus = sim.analytical.vInfMinusMPerS;
      const vInfPlus = sim.analytical.vInfPlusMPerS;

      // Heliocentric asymptotes: v_sun = v_planet + v_inf
      expect(sim.analytical.vInSunMPerS.x).toBeCloseTo(vInfMinus.x, 3);
      expect(sim.analytical.vInSunMPerS.y).toBeCloseTo(v0 + vInfMinus.y, 3);

      expect(sim.analytical.vOutSunMPerS.x).toBeCloseTo(vInfPlus.x, 3);
      expect(sim.analytical.vOutSunMPerS.y).toBeCloseTo(v0 + vInfPlus.y, 3);

      // Speed change Delta-V: |vOutSun| - |vInSun|
      const expectedDeltaV = sim.analytical.vOutSunSpeedMPerS - sim.analytical.vInSunSpeedMPerS;
      expect(sim.analytical.deltaVSunSpeedMPerS).toBeCloseTo(expectedDeltaV, 5);
    });
  });

  describe('3. Extreme & Degenerate Parameter Resilience', () => {
    it('handles extreme impact parameters without plot breaking or division by zero', () => {
      const jupiterR = PLANETARY_BODIES.JUPITER.radiusM;
      const grazing = FlybyEngine.runSimulation({ ...baseConfig, impactParameterM: jupiterR * 1.05 });
      const distant = FlybyEngine.runSimulation({ ...baseConfig, impactParameterM: jupiterR * 25.0 });

      expect(grazing.status).toBe('COMPLETED');
      expect(distant.status).toBe('COMPLETED');
      expect(distant.trajectory.length).toBeGreaterThan(20);
    });

    it('handles extreme velocities from 1.5 km/s up to 60 km/s', () => {
      const slow = FlybyEngine.runSimulation({ ...baseConfig, vInfSpeedMPerS: 1500 });
      const fast = FlybyEngine.runSimulation({ ...baseConfig, vInfSpeedMPerS: 60000 });

      expect(slow.status).toBe('COMPLETED');
      expect(fast.status).toBe('COMPLETED');
      expect(slow.analytical.deflectionAngleDeg).toBeGreaterThan(fast.analytical.deflectionAngleDeg);
    });
  });
});
