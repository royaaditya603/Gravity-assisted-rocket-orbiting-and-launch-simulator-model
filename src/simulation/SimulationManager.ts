/**
 * SimulationManager.ts
 * 
 * Unified UI facade and presentation bridge for the simulation engine.
 * 
 * Directs all flight state evolution, numerical stepping, orbit prediction,
 * and force calculations to the authoritative SimulationEngine.
 * Maintains telemetry history buffers and reactive caches for UI components,
 * ensuring zero duplication of physics dynamics.
 */

import { Vector3D } from '../physics/Vector3D';
import { R_EARTH, OrbitClassifier, KeplerianElements } from '../physics';
import { Rocket } from '../physics/Rocket';
import { FlightPhase, ReadonlyTelemetrySnapshot } from './SimulationTypes';
import { SimulationEngine } from './SimulationEngine';
import {
  ScenarioDefinition,
  DEFAULT_LEO_SCENARIO,
  SUBORBITAL_BALLISTIC_SCENARIO,
  EARTH_ESCAPE_SCENARIO,
} from './scenarios/LaunchToOrbit';

export { FlightPhase };

export interface TelemetryPoint {
  timeS: number;
  altitudeKm: number;
  speedMPerS: number;
  accelerationMPerS2: number;
  massTonnes: number;
  specificEnergyMJPerKg: number;
  dynamicPressureKPa: number;
  thrustKN: number;
  phase: FlightPhase;
}

export interface SimulationParams {
  thrustVacuumN: number;
  thrustSeaLevelN: number;
  ispVacuumS: number;
  ispSeaLevelS: number;
  dryMassKg: number;
  propellantMassKg: number;
  burnDurationS: number;
  targetCutoffSpeedMPerS: number;
  pitchAngleDeg: number;
  launchAzimuthDeg: number;
  launchLatitudeDeg: number;
}

export const DEFAULT_SIM_PARAMS: SimulationParams = {
  thrustVacuumN: DEFAULT_LEO_SCENARIO.vehicle.thrustVacuumN,
  thrustSeaLevelN: DEFAULT_LEO_SCENARIO.vehicle.thrustSeaLevelN,
  ispVacuumS: DEFAULT_LEO_SCENARIO.vehicle.ispVacuumS,
  ispSeaLevelS: DEFAULT_LEO_SCENARIO.vehicle.ispSeaLevelS,
  dryMassKg: DEFAULT_LEO_SCENARIO.vehicle.dryMassKg,
  propellantMassKg: DEFAULT_LEO_SCENARIO.vehicle.propellantMassKg,
  burnDurationS: DEFAULT_LEO_SCENARIO.vehicle.burnDurationS,
  targetCutoffSpeedMPerS: DEFAULT_LEO_SCENARIO.guidance.targetCutoffSpeedMPerS,
  pitchAngleDeg: DEFAULT_LEO_SCENARIO.guidance.initialPitchAngleDeg,
  launchAzimuthDeg: DEFAULT_LEO_SCENARIO.guidance.launchAzimuthDeg,
  launchLatitudeDeg: DEFAULT_LEO_SCENARIO.guidance.launchLatitudeDeg,
};

export class SimulationManager {
  // Authoritative physical simulation engine
  public engine: SimulationEngine;

  // Active configuration parameters
  public params: SimulationParams;

  // Mirrored state vectors for 3D viewport and HUD readouts
  public timeS: number = 0.0;
  public position: Vector3D = new Vector3D();
  public velocity: Vector3D = new Vector3D();
  public acceleration: Vector3D = new Vector3D();
  public flightPhase: FlightPhase = FlightPhase.ON_PAD;
  public hasImpacted: boolean = false;
  public isRunning: boolean = false;
  public timeWarp: number = 1.0;
  public dynamicPressurePa: number = 0.0;
  public keplerian: KeplerianElements;

  // Telemetry and Trajectory History Buffers
  public telemetryHistory: TelemetryPoint[] = [];
  public trajectoryHistory: Vector3D[] = [];
  private lastHistorySampleTime: number = -1.0;
  public readonly fixedDt: number = 0.05; // 50 ms

  constructor(params: Partial<SimulationParams> = {}) {
    this.params = { ...DEFAULT_SIM_PARAMS, ...params };
    const scenario = this.buildScenarioDefinition(this.params);
    this.engine = new SimulationEngine(scenario, { fixedTimeStepS: this.fixedDt });
    this.keplerian = OrbitClassifier.analyzeOrbit(new Vector3D(R_EARTH, 0, 0), new Vector3D(0, 0, 0));
    this.reset();
  }

  /**
   * Reference to the authoritative rocket instance in the engine
   */
  public get rocket(): Rocket {
    return this.engine.rocketInstance;
  }

  private buildScenarioDefinition(p: SimulationParams): ScenarioDefinition {
    return {
      name: 'Simulation Mission',
      description: 'Parametric mission scenario',
      vehicle: {
        dryMassKg: p.dryMassKg,
        propellantMassKg: p.propellantMassKg,
        thrustVacuumN: p.thrustVacuumN,
        thrustSeaLevelN: p.thrustSeaLevelN,
        ispVacuumS: p.ispVacuumS,
        ispSeaLevelS: p.ispSeaLevelS,
        crossSectionalAreaM2: 12.0,
        dragCoefficient: 0.35,
        burnDurationS: p.burnDurationS,
      },
      guidance: {
        launchLatitudeDeg: p.launchLatitudeDeg,
        launchAzimuthDeg: p.launchAzimuthDeg,
        initialPitchAngleDeg: p.pitchAngleDeg,
        pitchOverAltitudeM: 1000.0,
        targetCutoffSpeedMPerS: p.targetCutoffSpeedMPerS,
      },
    };
  }

  /**
   * Resets the simulation to the initial launch pad state
   */
  public reset(newParams?: Partial<SimulationParams>): void {
    if (newParams) {
      this.params = { ...this.params, ...newParams };
    }
    const scenario = this.buildScenarioDefinition(this.params);
    this.engine.reset(scenario);

    this.telemetryHistory = [];
    this.trajectoryHistory = [];
    this.lastHistorySampleTime = -1.0;

    this.syncStateFromEngine();
    this.recordSample(true);
  }

  /**
   * Starts ignition and transitions from ON_PAD to POWERED_ASCENT
   */
  public startLaunch(): void {
    this.engine.launch();
    this.syncStateFromEngine();
  }

  public pause(): void {
    this.engine.pause();
    this.syncStateFromEngine();
  }

  public resume(): void {
    this.engine.resume();
    this.syncStateFromEngine();
  }

  public setTimeWarp(warp: number): void {
    this.engine.setTimeWarp(warp);
    this.timeWarp = this.engine.config.timeWarp;
  }

  public setThrottle(throttle: number): void {
    this.engine.setThrottle(throttle);
    this.syncStateFromEngine();
  }

  public setAttitude(pitchDeg: number, azimuthDeg: number): void {
    this.engine.setAttitude(pitchDeg, azimuthDeg);
    this.syncStateFromEngine();
  }

  public manualCutoff(): void {
    this.engine.manualCutoff();
    this.syncStateFromEngine();
  }

  /**
   * Advances the simulation by wall-clock interval dtWall
   */
  public update(dtWall: number): void {
    if (!this.isRunning || this.hasImpacted) return;

    this.engine.update(dtWall);
    this.syncStateFromEngine();
    this.recordSample();
  }

  /**
   * Advances single deterministic sub-step
   */
  public subStep(dt: number): void {
    this.engine.subStep(dt);
    this.syncStateFromEngine();
    this.recordSample();
  }

  /**
   * Synchronizes mirrored fields from the authoritative engine state
   */
  private syncStateFromEngine(): void {
    const tel: ReadonlyTelemetrySnapshot = this.engine.getTelemetry();
    this.timeS = tel.timeS;
    this.position.set(tel.position.x, tel.position.y, tel.position.z);
    this.velocity.set(tel.velocity.x, tel.velocity.y, tel.velocity.z);
    
    const accel = this.engine.currentAcceleration;
    this.acceleration.set(accel.x, accel.y, accel.z);

    this.flightPhase = tel.phase;
    this.hasImpacted = tel.hasImpacted;
    this.isRunning = this.engine.isSimulationRunning;
    this.timeWarp = this.engine.config.timeWarp;
    this.dynamicPressurePa = tel.dynamicPressurePa;
    this.keplerian = OrbitClassifier.analyzeOrbit(this.position, this.velocity);
  }

  /**
   * Records a telemetry snapshot into the historical buffers
   */
  private recordSample(force: boolean = false): void {
    if (!force && this.timeS - this.lastHistorySampleTime < 0.2) {
      return;
    }
    this.lastHistorySampleTime = this.timeS;

    const tel = this.engine.getTelemetry();
    const point: TelemetryPoint = {
      timeS: Math.round(tel.timeS * 10) / 10,
      altitudeKm: Math.round(tel.altitudeKm * 10) / 10,
      speedMPerS: Math.round(tel.inertialSpeedMPerS),
      accelerationMPerS2: Math.round(tel.accelerationMagnitudeMPerS2 * 10) / 10,
      massTonnes: Math.round((tel.massKg / 1000.0) * 10) / 10,
      specificEnergyMJPerKg: Math.round((tel.specificEnergyJPerKg / 1e6) * 100) / 100,
      dynamicPressureKPa: Math.round((tel.dynamicPressurePa / 1000.0) * 10) / 10,
      thrustKN: Math.round(tel.thrustN / 1000.0),
      phase: tel.phase,
    };

    this.telemetryHistory.push(point);
    this.trajectoryHistory.push(this.position.clone());

    if (this.telemetryHistory.length > 2000) {
      this.telemetryHistory.shift();
    }
    if (this.trajectoryHistory.length > 2000) {
      this.trajectoryHistory.shift();
    }
  }

  /**
   * Generates discrete 3D points representing the osculating Keplerian trajectory spline
   */
  public getOsculatingOrbitPoints(samplesCount: number = 120): Vector3D[] {
    const prediction = this.engine.predictTrajectory(samplesCount);
    return prediction.points;
  }

  /**
   * Applies pre-configured mission presets
   */
  public applyPreset(name: 'LEO_400KM' | 'SUBORBITAL_BALLISTIC' | 'EARTH_ESCAPE'): void {
    if (name === 'LEO_400KM') {
      this.reset({
        thrustVacuumN: 7600000.0,
        thrustSeaLevelN: 6800000.0,
        ispVacuumS: 320.0,
        ispSeaLevelS: 285.0,
        dryMassKg: 22000.0,
        propellantMassKg: 420000.0,
        burnDurationS: 180.0,
        targetCutoffSpeedMPerS: 7850.0,
        pitchAngleDeg: 12.0,
      });
    } else if (name === 'SUBORBITAL_BALLISTIC') {
      this.reset({
        thrustVacuumN: SUBORBITAL_BALLISTIC_SCENARIO.vehicle.thrustVacuumN,
        thrustSeaLevelN: SUBORBITAL_BALLISTIC_SCENARIO.vehicle.thrustSeaLevelN,
        ispVacuumS: SUBORBITAL_BALLISTIC_SCENARIO.vehicle.ispVacuumS,
        ispSeaLevelS: SUBORBITAL_BALLISTIC_SCENARIO.vehicle.ispSeaLevelS,
        dryMassKg: SUBORBITAL_BALLISTIC_SCENARIO.vehicle.dryMassKg,
        propellantMassKg: SUBORBITAL_BALLISTIC_SCENARIO.vehicle.propellantMassKg,
        burnDurationS: SUBORBITAL_BALLISTIC_SCENARIO.vehicle.burnDurationS,
        targetCutoffSpeedMPerS: SUBORBITAL_BALLISTIC_SCENARIO.guidance.targetCutoffSpeedMPerS,
        pitchAngleDeg: SUBORBITAL_BALLISTIC_SCENARIO.guidance.initialPitchAngleDeg,
      });
    } else if (name === 'EARTH_ESCAPE') {
      this.reset({
        thrustVacuumN: EARTH_ESCAPE_SCENARIO.vehicle.thrustVacuumN,
        thrustSeaLevelN: EARTH_ESCAPE_SCENARIO.vehicle.thrustSeaLevelN,
        ispVacuumS: EARTH_ESCAPE_SCENARIO.vehicle.ispVacuumS,
        ispSeaLevelS: EARTH_ESCAPE_SCENARIO.vehicle.ispSeaLevelS,
        dryMassKg: EARTH_ESCAPE_SCENARIO.vehicle.dryMassKg,
        propellantMassKg: EARTH_ESCAPE_SCENARIO.vehicle.propellantMassKg,
        burnDurationS: EARTH_ESCAPE_SCENARIO.vehicle.burnDurationS,
        targetCutoffSpeedMPerS: EARTH_ESCAPE_SCENARIO.guidance.targetCutoffSpeedMPerS,
        pitchAngleDeg: EARTH_ESCAPE_SCENARIO.guidance.initialPitchAngleDeg,
      });
    }
  }
}
