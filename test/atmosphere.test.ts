import { describe, it, expect } from 'vitest';
import { Atmosphere } from '../src/physics/Atmosphere';
import { Vector3D } from '../src/physics/Vector3D';
import { R_EARTH, RHO_0, P_0, H_SCALE, H_ATMOSPHERE } from '../src/physics/constants';

describe('Atmosphere & Aerodynamic Drag Model', () => {
  it('evaluates barometric density and pressure correctly', () => {
    // Sea level (h = 0)
    const seaLevel = Atmosphere.getProperties(0.0);
    expect(seaLevel.density).toBeCloseTo(RHO_0, 4);
    expect(seaLevel.pressure).toBeCloseTo(P_0, 1);

    // Scale height (h = 8,500 m): density should drop by factor of 1/e
    const scaleHeight = Atmosphere.getProperties(H_SCALE);
    expect(scaleHeight.density).toBeCloseTo(RHO_0 / Math.E, 4);
    expect(scaleHeight.pressure).toBeCloseTo(P_0 / Math.E, 1);

    // Strict Kármán line cutoff (h >= 100 km): density and pressure must be 0
    const karman = Atmosphere.getProperties(H_ATMOSPHERE);
    expect(karman.density).toBe(0.0);
    expect(karman.pressure).toBe(0.0);

    const space = Atmosphere.getProperties(400000.0);
    expect(space.density).toBe(0.0);
    expect(space.pressure).toBe(0.0);
  });

  it('computes drag opposing velocity and dynamic pressure q', () => {
    const pos = new Vector3D(R_EARTH + 10000.0, 0, 0); // 10 km altitude
    const vel = new Vector3D(0, 1000.0, 0); // 1,000 m/s eastward
    const massKg = 50000.0;
    const cd = 0.4;
    const areaM2 = 10.0;

    const aero = Atmosphere.computeAerodynamics(pos, vel, massKg, cd, areaM2, false);

    expect(aero.densityKgM3).toBeGreaterThan(0.0);
    expect(aero.dynamicPressurePa).toBeCloseTo(0.5 * aero.densityKgM3 * 1000.0 * 1000.0, 1);

    // Drag force must oppose velocity vector: vy > 0 => Fy < 0
    expect(aero.dragForceN.y).toBeLessThan(0.0);
    expect(aero.dragAccelerationMPerS2.y).toBeLessThan(0.0);
  });

  it('verifies vehicle crossing the 100 km Kármán line threshold', () => {
    const massKg = 10000.0;
    const cd = 0.3;
    const areaM2 = 10.0;
    const vel = new Vector3D(0, 7800.0, 0);

    // 1. Immediately below cutoff (h = 99,990 m)
    const posBelow = new Vector3D(R_EARTH + 99990.0, 0, 0);
    const aeroBelow = Atmosphere.computeAerodynamics(posBelow, vel, massKg, cd, areaM2, false);
    expect(aeroBelow.densityKgM3).toBeGreaterThan(0.0);
    expect(aeroBelow.dragForceN.magnitude()).toBeGreaterThan(0.0);

    // 2. Exactly at cutoff (h = 100,000 m)
    const posAt = new Vector3D(R_EARTH + 100000.0, 0, 0);
    const aeroAt = Atmosphere.computeAerodynamics(posAt, vel, massKg, cd, areaM2, false);
    expect(aeroAt.densityKgM3).toBe(0.0);
    expect(aeroAt.dragForceN.magnitude()).toBe(0.0);

    // 3. Above cutoff in vacuum (h = 100,010 m)
    const posAbove = new Vector3D(R_EARTH + 100010.0, 0, 0);
    const aeroAbove = Atmosphere.computeAerodynamics(posAbove, vel, massKg, cd, areaM2, false);
    expect(aeroAbove.densityKgM3).toBe(0.0);
    expect(aeroAbove.dragForceN.magnitude()).toBe(0.0);
  });
});
