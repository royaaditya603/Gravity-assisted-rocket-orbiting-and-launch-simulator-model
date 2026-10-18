import { describe, it, expect } from 'vitest';
import { GravityAssist } from '../src/physics/GravityAssist';
import { Vector3D } from '../src/physics/Vector3D';
import { MU_MOON, R_MOON } from '../src/physics/constants';

describe('Patched-Conic Planetary Gravity Assist Mechanics', () => {
  // Let flyby body be Moon-like: mu = 4.9048695e12 m^3/s^2, orbiting at V_planet = 1,022 m/s along +y
  const muPlanet = MU_MOON;
  const rPeriapsis = R_MOON + 100000.0; // 100 km lunar altitude
  const vPlanet = new Vector3D(0, 1022.0, 0);

  it('proves energy conservation in planet rest frame: ||v_inf(+) || == ||v_inf(-)||', () => {
    // Spacecraft approaching with incoming central velocity
    const vInCentral = new Vector3D(1500.0, 200.0, 0);

    const result = GravityAssist.computeFlyby(vInCentral, vPlanet, rPeriapsis, muPlanet, 'TRAILING');

    // In planet frame, incoming speed must equal outgoing speed exactly
    expect(result.vInfPlusMPerS.magnitude()).toBeCloseTo(result.vInfMinusMPerS.magnitude(), 6);
    expect(result.vInfPlusMPerS.magnitude()).toBeCloseTo(result.vInfSpeedMPerS, 6);
  });

  it('validates analytical hyperbolic turning angle formula: sin(delta/2) = 1 / (1 + r_p * v_inf^2 / mu_p)', () => {
    const vInCentral = new Vector3D(1200.0, 500.0, 0);
    const result = GravityAssist.computeFlyby(vInCentral, vPlanet, rPeriapsis, muPlanet, 'TRAILING');

    const vInf = result.vInfSpeedMPerS;
    const eHyp = 1.0 + (rPeriapsis * vInf * vInf) / muPlanet;
    const expectedDelta = 2.0 * Math.asin(1.0 / eHyp);

    expect(result.deflectionAngleRad).toBeCloseTo(expectedDelta, 6);
  });

  it('verifies Trailing Flyby delivers net orbital energy and speed gain in Central Frame', () => {
    // Trailing pass: spacecraft passes behind the planet
    const vInCentral = new Vector3D(1500.0, 300.0, 0);
    const result = GravityAssist.computeFlyby(vInCentral, vPlanet, rPeriapsis, muPlanet, 'TRAILING');

    // Specific kinetic energy in central frame must increase
    expect(result.isAcceleration).toBe(true);
    expect(result.deltaSpecificEnergyJPerKg).toBeGreaterThan(0.0);
    expect(result.vOutCentralSpeedMPerS).toBeGreaterThan(result.vInCentralSpeedMPerS);

    // Delta-v vector magnitude must equal 2 * v_inf * sin(delta / 2)
    const expectedDeltaVMag = 2.0 * result.vInfSpeedMPerS * Math.sin(result.deflectionAngleRad / 2.0);
    expect(result.deltaVAssistMagnitudeMPerS).toBeCloseTo(expectedDeltaVMag, 4);
  });

  it('verifies Leading Flyby causes gravity braking (net energy loss in Central Frame)', () => {
    // Leading pass: spacecraft passes in front of the planet
    const vInCentral = new Vector3D(1500.0, 800.0, 0);
    const result = GravityAssist.computeFlyby(vInCentral, vPlanet, rPeriapsis, muPlanet, 'LEADING');

    // Specific kinetic energy in central frame must decrease (gravity braking)
    expect(result.isAcceleration).toBe(false);
    expect(result.deltaSpecificEnergyJPerKg).toBeLessThan(0.0);
    expect(result.vOutCentralSpeedMPerS).toBeLessThan(result.vInCentralSpeedMPerS);
  });
});
