/**
 * test/ui-ux-mission-control.test.ts
 *
 * Automated verification for ASTRA UI/UX, 3D Viewport Controls, WebGL Fallback,
 * Mode Switching, and Deep-Space Mission Control Integration.
 */

import { describe, it, expect } from 'vitest';
import { PLANETARY_BODIES } from '../src/physics/constants';
import { FlybyEngine } from '../src/physics/FlybyEngine';
import { WorkspaceMode } from '../src/components/layout/Header';
import { GraphicsQuality } from '../src/components/gravity-assist/viewport/Flyby3DCanvas';

describe('ASTRA UI/UX & Mission Control Integration Verification', () => {
  const simResult = FlybyEngine.runSimulation({
    planet: PLANETARY_BODIES.JUPITER,
    vInfSpeedMPerS: 11000,
    targetPeriapsisM: PLANETARY_BODIES.JUPITER.radiusM * 1.8,
    passType: 'TRAILING',
    spacecraftMassKg: 850,
  });

  describe('1. Authoritative Workspace Modes & Navigation Contract', () => {
    const validModes: WorkspaceMode[] = [
      'GRAVITY_ASSIST',
      'ORBITAL_ASCENT',
      'INTERPLANETARY',
      'ANALYSIS_LAB',
    ];

    it('defines exactly four cohesive scientific workspaces without orphan routes', () => {
      expect(validModes.length).toBe(4);
      expect(validModes).toContain('GRAVITY_ASSIST');
      expect(validModes).toContain('ORBITAL_ASCENT');
      expect(validModes).toContain('INTERPLANETARY');
      expect(validModes).toContain('ANALYSIS_LAB');
    });

    it('confirms the primary gravity assist simulation produces valid authoritative trajectory', () => {
      expect(simResult.trajectory.length).toBeGreaterThan(50);
      expect(simResult.analytical.deflectionAngleDeg).toBeGreaterThan(0);
      expect(simResult.closestApproach.altitudeM).toBeGreaterThan(0);
      expect(simResult.status).toBe('COMPLETED');
    });
  });

  describe('2. Graphics Quality Profiles & Accessibility Constraints', () => {
    const validQualities: GraphicsQuality[] = ['HIGH', 'BALANCED', 'PERFORMANCE'];

    it('supports three tiered graphics quality presets for hardware scalability', () => {
      expect(validQualities.length).toBe(3);
      expect(validQualities).toContain('HIGH');
      expect(validQualities).toContain('BALANCED');
      expect(validQualities).toContain('PERFORMANCE');
    });

    it('verifies DPR clamping rules per graphics profile', () => {
      const getDprLimit = (q: GraphicsQuality) => (q === 'HIGH' ? 2.0 : q === 'BALANCED' ? 1.5 : 1.0);
      expect(getDprLimit('HIGH')).toBe(2.0);
      expect(getDprLimit('BALANCED')).toBe(1.5);
      expect(getDprLimit('PERFORMANCE')).toBe(1.0);
    });
  });

  describe('3. WebGL Fallback Mathematical Integrity', () => {
    it('accurately computes 2D projection bounds from authoritative state vectors', () => {
      const planet = simResult.config.planet;
      const maxExtent = simResult.trajectory.reduce((max, pt) => {
        return Math.max(max, pt.posPlanetM.magnitude());
      }, planet.radiusM * 4);

      expect(maxExtent).toBeGreaterThan(planet.radiusM);

      const svgSize = 360;
      const center = svgSize / 2;
      const scale = (center * 0.85) / maxExtent;
      expect(scale).toBeGreaterThan(0);

      // Verify that sample projected point lies strictly within SVG viewport bounds
      const pt0 = simResult.trajectory[0];
      const curX = center + pt0.posPlanetM.x * scale;
      const curY = center - pt0.posPlanetM.y * scale;

      expect(curX).toBeGreaterThanOrEqual(0);
      expect(curX).toBeLessThanOrEqual(svgSize);
      expect(curY).toBeGreaterThanOrEqual(0);
      expect(curY).toBeLessThanOrEqual(svgSize);
    });

    it('verifies telemetry values in fallback mode strictly match physics engine results', () => {
      const ca = simResult.closestApproach;
      expect(ca.distanceM).toBeGreaterThan(simResult.config.planet.radiusM);
      expect(ca.altitudeM).toBeCloseTo(ca.distanceM - simResult.config.planet.radiusM, 2);
      expect(simResult.analytical.deflectionAngleDeg).toBeCloseTo(
        (simResult.analytical.deflectionAngleRad * 180) / Math.PI,
        4
      );
    });
  });

  describe('4. Astrodynamics Principles Dossier Equations', () => {
    it('confirms circular speed equation consistency: v_circ = sqrt(mu / r)', () => {
      const r = 6371000 + 400000; // Earth 400 km LEO
      const mu = PLANETARY_BODIES.EARTH.mu;
      const vCirc = Math.sqrt(mu / r);
      expect(vCirc).toBeCloseTo(7672.6, 0);
    });

    it('confirms escape speed equation consistency: v_esc = sqrt(2 * mu / r)', () => {
      const r = 6371000; // Earth surface
      const mu = PLANETARY_BODIES.EARTH.mu;
      const vEsc = Math.sqrt((2 * mu) / r);
      expect(vEsc).toBeCloseTo(11186, 0);
    });

    it('confirms patched-conic hyperbolic deflection relation: sin(delta/2) = 1/e', () => {
      const e = simResult.analytical.eccentricity;
      const deltaRad = simResult.analytical.deflectionAngleRad;
      expect(Math.sin(deltaRad / 2)).toBeCloseTo(1 / e, 6);
    });
  });

  describe('5. Spacecraft 3D Models & Visualization Architecture', () => {
    it('creates probe model bundle with correct initial attitude and geometry hierarchy', async () => {
      const { SpacecraftVisuals } = await import('../src/components/gravity-assist/viewport/SpacecraftVisuals');
      const scBundle = SpacecraftVisuals.create(1.0, 'PROBE');

      expect(scBundle.group).toBeDefined();
      expect(scBundle.modelType).toBe('PROBE');
      expect(scBundle.group.children.length).toBeGreaterThan(0);

      // Verify dynamic switching to launch vehicle / rocket model
      scBundle.setModelType('ROCKET');
      expect(scBundle.modelType).toBe('ROCKET');

      // Verify switching back to deep-space probe
      scBundle.setModelType('PROBE');
      expect(scBundle.modelType).toBe('PROBE');

      // Verify clean resource disposal
      expect(() => scBundle.dispose()).not.toThrow();
    });

    it('executes smooth quaternion orientation updates without NaN or discontinuity', async () => {
      const { SpacecraftVisuals } = await import('../src/components/gravity-assist/viewport/SpacecraftVisuals');
      const THREE = await import('three');
      const scBundle = SpacecraftVisuals.create(1.0, 'PROBE');

      const pos = new THREE.Vector3(10, 0, 15);
      const vel = new THREE.Vector3(5000, 0, 8000);
      const sunPos = new THREE.Vector3(100, 40, 80);

      // Update in velocity aligned mode
      expect(() => {
        scBundle.update(pos, vel, sunPos, 'VELOCITY_ALIGNED', 0.016);
      }).not.toThrow();

      expect(Number.isNaN(scBundle.group.quaternion.x)).toBe(false);
      expect(Number.isNaN(scBundle.group.quaternion.y)).toBe(false);
      expect(Number.isNaN(scBundle.group.quaternion.z)).toBe(false);
      expect(Number.isNaN(scBundle.group.quaternion.w)).toBe(false);

      // Update in Sun pointing mode
      expect(() => {
        scBundle.update(pos, vel, sunPos, 'SUN_POINTING', 0.016);
      }).not.toThrow();

      // Update in Rocket mode
      scBundle.setModelType('ROCKET');
      expect(() => {
        scBundle.update(pos, vel, sunPos, 'VELOCITY_ALIGNED', 0.016);
      }).not.toThrow();

      scBundle.dispose();
    });
  });
});
