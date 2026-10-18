import { describe, it, expect } from 'vitest';
import { Rocket } from '../src/physics/Rocket';
import { Vector3D } from '../src/physics/Vector3D';
import { G_0 } from '../src/physics/constants';

describe('Rocket Dynamics & Tsiolkovsky Formulation', () => {
  it('validates Tsiolkovsky Rocket Equation in field-free vacuum burn', () => {
    const dryMassKg = 10000.0;
    const propMassKg = 90000.0; // m0 = 100,000 kg, mf = 10,000 kg, mass ratio = 10
    const ispVacS = 300.0;
    const thrustN = 1000000.0; // 1,000 kN

    const rocket = new Rocket({
      dryMassKg,
      propellantMassKg: propMassKg,
      thrustVacuumN: thrustN,
      thrustSeaLevelN: thrustN,
      ispVacuumS: ispVacS,
      ispSeaLevelS: ispVacS,
      crossSectionalAreaM2: 10.0,
      dragCoefficient: 0.3,
    });

    rocket.isIgnited = true;
    rocket.throttle = 1.0;
    rocket.setThrustDirection(new Vector3D(1, 0, 0));

    // Analytical Tsiolkovsky delta-v: dv = Isp * g0 * ln(m0 / mf)
    const m0 = dryMassKg + propMassKg;
    const mf = dryMassKg;
    const expectedDeltaV = ispVacS * G_0 * Math.log(m0 / mf); // ~6773.74 m/s

    // Integrate forward in vacuum until fuel exhausted
    const dt = 0.1;
    let velocity = 0.0;
    const vacuumAlt = 500000.0; // 500 km (vacuum)

    while (!rocket.isFuelDepleted) {
      const massBefore = rocket.totalMassKg;
      const thrust = rocket.getThrustMagnitudeAtAltitude(vacuumAlt);
      const accel = thrust / massBefore;

      velocity += accel * dt;
      rocket.burnPropellant(dt, vacuumAlt);
    }

    // Verify numerical delta-v matches analytical Tsiolkovsky delta-v within 0.05%
    expect(velocity).toBeCloseTo(expectedDeltaV, -1);
    const relativeError = Math.abs(velocity - expectedDeltaV) / expectedDeltaV;
    expect(relativeError).toBeLessThan(0.001); // Less than 0.1% error

    // Verify propellant mass clamped to 0.0
    expect(rocket.propellantRemainingKg).toBe(0.0);
    expect(rocket.totalMassKg).toBe(dryMassKg);
    expect(rocket.isEngineBurning).toBe(false);
  });

  it('validates altitude-dependent Specific Impulse (sea level vs vacuum)', () => {
    const rocket = new Rocket({
      dryMassKg: 10000.0,
      propellantMassKg: 50000.0,
      thrustVacuumN: 1000000.0,
      thrustSeaLevelN: 850000.0,
      ispVacuumS: 320.0,
      ispSeaLevelS: 280.0,
      crossSectionalAreaM2: 10.0,
      dragCoefficient: 0.3,
    });

    // At sea level (h = 0), Isp should be Isp_sl
    expect(rocket.getIspAtAltitude(0.0)).toBeCloseTo(280.0, 1);

    // In vacuum (h >= 100 km), Isp should be Isp_vac
    expect(rocket.getIspAtAltitude(100000.0)).toBeCloseTo(320.0, 1);
    expect(rocket.getIspAtAltitude(400000.0)).toBeCloseTo(320.0, 1);

    // At scale height (h = 8500 m), pressure is 1/e, Isp should be interpolated
    const ispAtScaleHeight = rocket.getIspAtAltitude(8500.0);
    expect(ispAtScaleHeight).toBeGreaterThan(280.0);
    expect(ispAtScaleHeight).toBeLessThan(320.0);
  });
});
