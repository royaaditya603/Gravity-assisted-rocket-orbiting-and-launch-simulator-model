import { Vector3D, IVector3D } from './Vector3D';
import { G_0, P_0 } from './constants';
import { Atmosphere } from './Atmosphere';

export interface RocketStageConfig {
  dryMassKg: number;
  propellantMassKg: number;
  thrustVacuumN: number;
  thrustSeaLevelN: number;
  ispVacuumS: number;
  ispSeaLevelS: number;
  crossSectionalAreaM2: number;
  dragCoefficient: number;
}

export interface RocketStateSnapshot {
  totalMassKg: number;
  dryMassKg: number;
  propellantRemainingKg: number;
  propellantFraction: number; // 0.0 to 1.0
  thrustForceN: Vector3D;
  thrustMagnitudeN: number;
  ispCurrentS: number;
  massFlowRateKgPerS: number;
  isEngineBurning: boolean;
  isFuelDepleted: boolean;
}

/**
 * Rocket Propulsion & Variable-Mass Dynamics
 *
 * MODEL ASSUMPTIONS & KNOWN LIMITATIONS:
 * 1. Pressure-Based Specific Impulse: Uses linear interpolation between sea-level and vacuum Isp
 *    based on static atmospheric pressure: Isp(P) = Isp_vac - (Isp_vac - Isp_sl) * (P / P_0).
 *    In real rocket engines, nozzle flow separation and oblique shocks create non-linear behavior.
 * 2. Point-Mass Translational Dynamics: Assumes thrust vector passes through instantaneous center of mass.
 * 3. Instantaneous Throttle Response: No turbopump spin-up delay or combustion chamber fill lag.
 */
export class Rocket {
  public dryMassKg: number;
  public propellantRemainingKg: number;
  public readonly initialPropellantMassKg: number;
  public thrustVacuumN: number;
  public thrustSeaLevelN: number;
  public ispVacuumS: number;
  public ispSeaLevelS: number;
  public crossSectionalAreaM2: number;
  public dragCoefficient: number;

  public throttle: number = 1.0; // 0.0 to 1.0
  public isIgnited: boolean = false;
  public thrustDirection: Vector3D = new Vector3D(0, 0, 1); // Normalized unit vector in ECI

  constructor(config: RocketStageConfig) {
    this.dryMassKg = config.dryMassKg;
    this.propellantRemainingKg = config.propellantMassKg;
    this.initialPropellantMassKg = config.propellantMassKg;
    this.thrustVacuumN = config.thrustVacuumN;
    this.thrustSeaLevelN = config.thrustSeaLevelN;
    this.ispVacuumS = config.ispVacuumS;
    this.ispSeaLevelS = config.ispSeaLevelS;
    this.crossSectionalAreaM2 = config.crossSectionalAreaM2;
    this.dragCoefficient = config.dragCoefficient;
  }

  get totalMassKg(): number {
    return this.dryMassKg + this.propellantRemainingKg;
  }

  get isFuelDepleted(): boolean {
    return this.propellantRemainingKg <= 1e-6;
  }

  get isEngineBurning(): boolean {
    return this.isIgnited && !this.isFuelDepleted && this.throttle > 0.0;
  }

  /**
   * Computes effective specific impulse at current altitude h.
   */
  getIspAtAltitude(altitudeM: number): number {
    const { pressure } = Atmosphere.getProperties(altitudeM);
    const pressureRatio = Math.max(0.0, Math.min(1.0, pressure / P_0));
    return this.ispVacuumS - (this.ispVacuumS - this.ispSeaLevelS) * pressureRatio;
  }

  /**
   * Computes available thrust magnitude at current altitude h and throttle setting.
   */
  getThrustMagnitudeAtAltitude(altitudeM: number): number {
    if (!this.isIgnited || this.isFuelDepleted || this.throttle <= 0.0) {
      return 0.0;
    }
    const { pressure } = Atmosphere.getProperties(altitudeM);
    const pressureRatio = Math.max(0.0, Math.min(1.0, pressure / P_0));
    const maxThrust = this.thrustVacuumN - (this.thrustVacuumN - this.thrustSeaLevelN) * pressureRatio;
    return maxThrust * Math.max(0.0, Math.min(1.0, this.throttle));
  }

  /**
   * Computes mass flow rate: dm/dt = T / (Isp * g0)
   */
  getMassFlowRate(altitudeM: number): number {
    const thrust = this.getThrustMagnitudeAtAltitude(altitudeM);
    if (thrust <= 0.0) return 0.0;
    const isp = this.getIspAtAltitude(altitudeM);
    return thrust / (isp * G_0);
  }

  /**
   * Consumes propellant over time interval dt.
   * Clamps propellant mass to 0.0 and cuts engine if depleted.
   */
  burnPropellant(dt: number, altitudeM: number): number {
    if (!this.isIgnited || this.isFuelDepleted || dt <= 0.0) {
      return 0.0;
    }
    const flowRate = this.getMassFlowRate(altitudeM);
    const fuelRequested = flowRate * dt;
    const fuelBurned = Math.min(this.propellantRemainingKg, fuelRequested);

    this.propellantRemainingKg -= fuelBurned;
    if (this.isFuelDepleted) {
      this.propellantRemainingKg = 0.0;
      this.isIgnited = false;
    }
    return fuelBurned;
  }

  /**
   * Sets thrust direction unit vector in ECI.
   */
  setThrustDirection(dir: IVector3D): void {
    this.thrustDirection.copy(dir).normalize();
  }

  /**
   * Returns instantaneous snapshot of propulsion and mass state.
   */
  getSnapshot(altitudeM: number): RocketStateSnapshot {
    const thrustMag = this.getThrustMagnitudeAtAltitude(altitudeM);
    const isp = this.getIspAtAltitude(altitudeM);
    const flowRate = this.getMassFlowRate(altitudeM);
    const thrustForce = this.thrustDirection.clone().scale(thrustMag);

    return {
      totalMassKg: this.totalMassKg,
      dryMassKg: this.dryMassKg,
      propellantRemainingKg: this.propellantRemainingKg,
      propellantFraction: this.initialPropellantMassKg > 0
        ? this.propellantRemainingKg / this.initialPropellantMassKg
        : 0.0,
      thrustForceN: thrustForce,
      thrustMagnitudeN: thrustMag,
      ispCurrentS: isp,
      massFlowRateKgPerS: flowRate,
      isEngineBurning: this.isIgnited && !this.isFuelDepleted && thrustMag > 0.0,
      isFuelDepleted: this.isFuelDepleted,
    };
  }
}
