import { Vector3D, IVector3D } from './Vector3D';
import { MU_EARTH, R_EARTH, H_ATMOSPHERE } from './constants';
import { Atmosphere } from './Atmosphere';
import { Rocket } from './Rocket';
import { CollisionDetector, CollisionResult } from './CollisionDetector';

export interface DynamicState {
  timeS: number;
  positionM: Vector3D;
  velocityMPerS: Vector3D;
  accelerationMPerS2: Vector3D;
  massKg: number;
  altitudeM: number;
  speedMPerS: number;
  hasImpacted: boolean;
  impactResult?: CollisionResult;
}

export type AccelerationFunction = (
  pos: IVector3D,
  vel: IVector3D,
  mass: number,
  time: number
) => Vector3D;

/**
 * Numerical Integrators Suite
 *
 * SPECIFICATION:
 * 1. Powered & Atmospheric Flight (h < 100 km or Thrust > 0):
 *    - Integrator: Classical 4th-Order Runge-Kutta (RK4) or Adaptive Step-Doubling RK4 (RK4-SD).
 *    - Physical regime: Non-conservative, velocity-dependent aerodynamic drag (v^2) and variable mass.
 * 2. Unpowered Vacuum Orbital Flight (h >= 100 km and Thrust == 0):
 *    - Integrator: Symplectic Velocity Verlet.
 *    - Physical regime: Conservative central-force Hamiltonian; preserves phase-space volume and bounds energy.
 * 3. Aerodynamic Drag Cutoff:
 *    - Evaluated when altitude h < H_ATMOSPHERE (100 km). At h >= 100 km, drag is identically 0.
 * 4. Surface Collision:
 *    - Clamps to exact surface radius R_E with terminal zero velocity (SURFACE_IMPACTED).
 */
export class Integrators {
  /**
   * Computes gravitational acceleration in pure Newtonian field: g = -mu * r / r^3
   */
  static computeGravity(pos: IVector3D, mu: number = MU_EARTH): Vector3D {
    const r2 = pos.x * pos.x + pos.y * pos.y + pos.z * pos.z;
    const r = Math.sqrt(r2);
    if (r <= 0.0) return new Vector3D(0, 0, 0);
    const factor = -mu / (r2 * r);
    return new Vector3D(pos.x * factor, pos.y * factor, pos.z * factor);
  }

  /**
   * Classical Fixed-Step Runge-Kutta 4th Order (RK4) step for general dynamics.
   */
  static stepRK4(
    pos: Vector3D,
    vel: Vector3D,
    mass: number,
    time: number,
    dt: number,
    accelFn: AccelerationFunction
  ): { nextPos: Vector3D; nextVel: Vector3D; accel: Vector3D } {
    // k1
    const a1 = accelFn(pos, vel, mass, time);
    const kv1 = a1;
    const kr1 = vel;

    // k2
    const dt2 = 0.5 * dt;
    const pos2 = new Vector3D(
      pos.x + kr1.x * dt2,
      pos.y + kr1.y * dt2,
      pos.z + kr1.z * dt2
    );
    const vel2 = new Vector3D(
      vel.x + kv1.x * dt2,
      vel.y + kv1.y * dt2,
      vel.z + kv1.z * dt2
    );
    const a2 = accelFn(pos2, vel2, mass, time + dt2);
    const kv2 = a2;
    const kr2 = vel2;

    // k3
    const pos3 = new Vector3D(
      pos.x + kr2.x * dt2,
      pos.y + kr2.y * dt2,
      pos.z + kr2.z * dt2
    );
    const vel3 = new Vector3D(
      vel.x + kv2.x * dt2,
      vel.y + kv2.y * dt2,
      vel.z + kv2.z * dt2
    );
    const a3 = accelFn(pos3, vel3, mass, time + dt2);
    const kv3 = a3;
    const kr3 = vel3;

    // k4
    const pos4 = new Vector3D(
      pos.x + kr3.x * dt,
      pos.y + kr3.y * dt,
      pos.z + kr3.z * dt
    );
    const vel4 = new Vector3D(
      vel.x + kv3.x * dt,
      vel.y + kv3.y * dt,
      vel.z + kv3.z * dt
    );
    const a4 = accelFn(pos4, vel4, mass, time + dt);
    const kv4 = a4;
    const kr4 = vel4;

    const dtSixth = dt / 6.0;
    const nextPos = new Vector3D(
      pos.x + dtSixth * (kr1.x + 2.0 * (kr2.x + kr3.x) + kr4.x),
      pos.y + dtSixth * (kr1.y + 2.0 * (kr2.y + kr3.y) + kr4.y),
      pos.z + dtSixth * (kr1.z + 2.0 * (kr2.z + kr3.z) + kr4.z)
    );
    const nextVel = new Vector3D(
      vel.x + dtSixth * (kv1.x + 2.0 * (kv2.x + kv3.x) + kv4.x),
      vel.y + dtSixth * (kv1.y + 2.0 * (kv2.y + kv3.y) + kv4.y),
      vel.z + dtSixth * (kv1.z + 2.0 * (kv2.z + kv3.z) + kv4.z)
    );

    return { nextPos, nextVel, accel: a1 };
  }

  /**
   * Symplectic Velocity Verlet step for conservative, position-dependent central gravity.
   */
  static stepVelocityVerlet(
    pos: Vector3D,
    vel: Vector3D,
    dt: number,
    mu: number = MU_EARTH
  ): { nextPos: Vector3D; nextVel: Vector3D; accel: Vector3D } {
    const a0 = this.computeGravity(pos, mu);

    const halfDt2 = 0.5 * dt * dt;
    const nextPos = new Vector3D(
      pos.x + vel.x * dt + a0.x * halfDt2,
      pos.y + vel.y * dt + a0.y * halfDt2,
      pos.z + vel.z * dt + a0.z * halfDt2
    );

    const a1 = this.computeGravity(nextPos, mu);

    const halfDt = 0.5 * dt;
    const nextVel = new Vector3D(
      vel.x + (a0.x + a1.x) * halfDt,
      vel.y + (a0.y + a1.y) * halfDt,
      vel.z + (a0.z + a1.z) * halfDt
    );

    return { nextPos, nextVel, accel: a0 };
  }

  /**
   * Adaptive Step-Doubling RK4 step with local error estimation via Richardson extrapolation.
   */
  static stepAdaptiveRK4(
    pos: Vector3D,
    vel: Vector3D,
    mass: number,
    time: number,
    dt: number,
    accelFn: AccelerationFunction
  ): { nextPos: Vector3D; nextVel: Vector3D; accel: Vector3D; dtUsed: number; error: number } {
    const full = this.stepRK4(pos, vel, mass, time, dt, accelFn);
    const half1 = this.stepRK4(pos, vel, mass, time, 0.5 * dt, accelFn);
    const half2 = this.stepRK4(half1.nextPos, half1.nextVel, mass, time + 0.5 * dt, 0.5 * dt, accelFn);

    const errPos = Vector3D.distance(half2.nextPos, full.nextPos) / 15.0;
    const errVel = Vector3D.distance(half2.nextVel, full.nextVel) / 15.0;
    const err = Math.max(errPos, errVel);

    return {
      nextPos: half2.nextPos,
      nextVel: half2.nextVel,
      accel: full.accel,
      dtUsed: dt,
      error: err,
    };
  }

  /**
   * Full unified simulation step combining Rocket, Atmosphere, Gravity, and Surface Collision.
   */
  static stepUnified(
    pos: Vector3D,
    vel: Vector3D,
    rocket: Rocket,
    time: number,
    dt: number,
    alreadyImpacted: boolean = false,
    useAdaptive: boolean = false
  ): DynamicState {
    const rCurrent = pos.magnitude();
    const altCurrent = rCurrent - R_EARTH;

    // Terminal impacted state: vehicle is at rest on the planetary surface
    if (alreadyImpacted) {
      const surfacePos = pos.clone().normalize().scale(R_EARTH);
      return {
        timeS: time + dt,
        positionM: surfacePos,
        velocityMPerS: new Vector3D(0, 0, 0),
        accelerationMPerS2: new Vector3D(0, 0, 0),
        massKg: rocket.totalMassKg,
        altitudeM: 0.0,
        speedMPerS: 0.0,
        hasImpacted: true,
      };
    }

    // Fuel depletion burn for time step dt
    rocket.burnPropellant(dt, altCurrent);
    const mass = rocket.totalMassKg;

    // Acceleration function closure
    const accelFn: AccelerationFunction = (p, v, m, _t) => {
      const r = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
      const alt = r - R_EARTH;

      // 1. Gravity (Newtonian inverse-square)
      const aGrav = Integrators.computeGravity(p);

      // 2. Thrust acceleration
      const thrustMag = rocket.getThrustMagnitudeAtAltitude(alt);
      const aThrust = m > 0.0 && thrustMag > 0.0
        ? rocket.thrustDirection.clone().scale(thrustMag / m)
        : new Vector3D(0, 0, 0);

      // 3. Aerodynamic drag (strictly disabled at alt >= 100 km)
      const aero = Atmosphere.computeAerodynamics(
        p,
        v,
        m,
        rocket.dragCoefficient,
        rocket.crossSectionalAreaM2,
        true
      );

      return aGrav.add(aThrust).add(aero.dragAccelerationMPerS2);
    };

    let nextPos: Vector3D;
    let nextVel: Vector3D;
    let accel: Vector3D;

    // Regime selection:
    // If in vacuum (alt >= 100 km) and engine is NOT burning, use Symplectic Velocity Verlet
    const isVacuumCoast = altCurrent >= H_ATMOSPHERE && (!rocket.isIgnited || rocket.isFuelDepleted || rocket.throttle <= 0);

    if (isVacuumCoast) {
      const res = this.stepVelocityVerlet(pos, vel, dt);
      nextPos = res.nextPos;
      nextVel = res.nextVel;
      accel = res.accel;
    } else {
      if (useAdaptive) {
        const res = this.stepAdaptiveRK4(pos, vel, mass, time, dt, accelFn);
        nextPos = res.nextPos;
        nextVel = res.nextVel;
        accel = res.accel;
      } else {
        const res = this.stepRK4(pos, vel, mass, time, dt, accelFn);
        nextPos = res.nextPos;
        nextVel = res.nextVel;
        accel = res.accel;
      }
    }

    // Exact surface collision detection
    const collision = CollisionDetector.checkSurfaceCollision(pos, nextPos, R_EARTH);
    if (collision.hasCollided) {
      return {
        timeS: time + dt * collision.impactFraction,
        positionM: collision.impactPositionM,
        velocityMPerS: collision.impactVelocityMPerS, // (0, 0, 0)
        accelerationMPerS2: new Vector3D(0, 0, 0),
        massKg: mass,
        altitudeM: 0.0,
        speedMPerS: 0.0,
        hasImpacted: true,
        impactResult: collision,
      };
    }

    const nextSpeed = nextVel.magnitude();
    const nextAlt = nextPos.magnitude() - R_EARTH;

    return {
      timeS: time + dt,
      positionM: nextPos,
      velocityMPerS: nextVel,
      accelerationMPerS2: accel,
      massKg: mass,
      altitudeM: nextAlt,
      speedMPerS: nextSpeed,
      hasImpacted: false,
    };
  }
}
