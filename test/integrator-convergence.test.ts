import { describe, it, expect } from 'vitest';
import { Integrators } from '../src/physics/Integrators';
import { Vector3D } from '../src/physics/Vector3D';
import { R_EARTH, MU_EARTH } from '../src/physics/constants';

describe('Numerical Integrator Verification & Timestep Convergence', () => {
  const r0 = R_EARTH + 400000.0; // 400 km LEO
  const v0 = Math.sqrt(MU_EARTH / r0); // Circular speed ~7672.60 m/s
  const omega0 = v0 / r0;
  const period = (2.0 * Math.PI) / omega0; // ~5544.86 s

  it('demonstrates RK4 timestep convergence (global error decreases with smaller dt)', () => {
    const testDurationS = 300.0; // 300 seconds test span

    // Analytical solution for circular orbit in xy-plane:
    // x(t) = r0 * cos(omega0 * t), y(t) = r0 * sin(omega0 * t)
    const exactX = r0 * Math.cos(omega0 * testDurationS);
    const exactY = r0 * Math.sin(omega0 * testDurationS);
    const exactPos = new Vector3D(exactX, exactY, 0);

    const timesteps = [8.0, 4.0, 2.0, 1.0];
    const errors: number[] = [];

    const accelFn = (p: { x: number; y: number; z: number }) => Integrators.computeGravity(p);

    for (const dt of timesteps) {
      let pos = new Vector3D(r0, 0, 0);
      let vel = new Vector3D(0, v0, 0);
      const steps = Math.round(testDurationS / dt);

      for (let s = 0; s < steps; s++) {
        const res = Integrators.stepRK4(pos, vel, 1.0, s * dt, dt, accelFn);
        pos = res.nextPos;
        vel = res.nextVel;
      }

      const err = Vector3D.distance(pos, exactPos);
      errors.push(err);
    }

    // Verify monotonic convergence: each halving of dt must reduce error by order of magnitude (O(dt^4))
    for (let i = 0; i < errors.length - 1; i++) {
      expect(errors[i + 1]).toBeLessThan(errors[i]);
      // With 4th-order method, error reduction ratio is approximately 2^4 = 16
      const ratio = errors[i] / errors[i + 1];
      expect(ratio).toBeGreaterThan(8.0);
    }
  });

  it('validates Energy Conservation in unpowered vacuum orbit', () => {
    let posVerlet = new Vector3D(r0, 0, 0);
    let velVerlet = new Vector3D(0, v0, 0);
    const dt = 0.5; // 0.5s step
    const steps = Math.round(period / dt); // 1 full orbit

    const e0 = 0.5 * velVerlet.magnitudeSq() - MU_EARTH / posVerlet.magnitude();

    let maxRelativeEnergyDrift = 0.0;

    for (let s = 0; s < steps; s++) {
      const res = Integrators.stepVelocityVerlet(posVerlet, velVerlet, dt);
      posVerlet = res.nextPos;
      velVerlet = res.nextVel;

      const eCurrent = 0.5 * velVerlet.magnitudeSq() - MU_EARTH / posVerlet.magnitude();
      const drift = Math.abs((eCurrent - e0) / e0);
      if (drift > maxRelativeEnergyDrift) {
        maxRelativeEnergyDrift = drift;
      }
    }

    // Velocity Verlet should bound energy oscillation tightly across the orbit
    expect(maxRelativeEnergyDrift).toBeLessThan(1e-5);
  });

  it('validates Specific Angular Momentum Vector Conservation', () => {
    let pos = new Vector3D(r0, 0, 0);
    let vel = new Vector3D(0, v0, 0);
    const dt = 1.0;
    const steps = 1000;

    const h0 = Vector3D.cross(pos, vel);
    const h0Mag = h0.magnitude();

    for (let s = 0; s < steps; s++) {
      const res = Integrators.stepVelocityVerlet(pos, vel, dt);
      pos = res.nextPos;
      vel = res.nextVel;

      const hCurrent = Vector3D.cross(pos, vel);
      const hDiff = Vector3D.sub(hCurrent, h0).magnitude();
      const relativeHDiff = hDiff / h0Mag;

      // Central gravity exerts zero torque: angular momentum must be conserved to machine precision
      expect(relativeHDiff).toBeLessThan(1e-12);
    }
  });

  it('validates Kepler Third Law Period Closure', () => {
    let pos = new Vector3D(r0, 0, 0);
    let vel = new Vector3D(0, v0, 0);
    const dt = 0.1;
    let time = 0.0;
    let prevY = 0.0;
    let completedPeriod = 0.0;

    // Run until craft completes 1 orbit and crosses y=0 with vy > 0
    for (let s = 0; s < 70000; s++) {
      const res = Integrators.stepVelocityVerlet(pos, vel, dt);
      time += dt;

      if (s > 100 && prevY < 0.0 && res.nextPos.y >= 0.0) {
        // Interpolate exact crossing
        const fraction = -prevY / (res.nextPos.y - prevY);
        completedPeriod = time - dt + fraction * dt;
        break;
      }
      prevY = res.nextPos.y;
      pos = res.nextPos;
      vel = res.nextVel;
    }

    // Numerical period must match analytical period 2*pi*sqrt(r^3/mu) to < 0.01%
    const expectedPeriod = 2.0 * Math.PI * Math.sqrt(Math.pow(r0, 3) / MU_EARTH);
    expect(completedPeriod).toBeCloseTo(expectedPeriod, 1);
    const relativeError = Math.abs(completedPeriod - expectedPeriod) / expectedPeriod;
    expect(relativeError).toBeLessThan(1e-4);
  });
});
