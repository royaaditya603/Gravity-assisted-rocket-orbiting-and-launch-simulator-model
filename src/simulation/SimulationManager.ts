/**
 * SimulationManager.ts
 * 
 * Unified UI facade, presentation bridge, and deterministic flight replay engine.
 * 
 * Features:
 * 1. Directs flight state evolution to authoritative SimulationEngine with fixed-step sub-stepping.
 * 2. High-precision recorded state history (ReplayBuffer) for slow-motion flight replay.
 * 3. Exact Hermite/linear state interpolation for jitter-free 60 FPS playback at 0.1x to 5x speeds.
 * 4. Milestone tracking: Ignition, Liftoff, Gravity Turn, Max-Q, MECO, Staging, Fairing Jettison, SECO, Orbit.
 * 5. Deterministic precomputation allowing instantaneous scrubbing across the entire flight profile.
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

export interface AscentMilestone {
  id: string;
  name: string;
  timeS: number;
  altitudeKm: number;
  speedMPerS: number;
  description: string;
}

export interface ReplayStateSnapshot {
  timeS: number;
  positionM: Vector3D;
  velocityMPerS: Vector3D;
  accelerationMPerS2: Vector3D;
  attitudeForward: Vector3D;
  thrustForceN: Vector3D;
  dragForceN: Vector3D;
  gravityForceN: Vector3D;
  altitudeKm: number;
  speedMPerS: number;
  dynamicPressureKPa: number;
  thrustKN: number;
  dragKN: number;
  massTonnes: number;
  phase: FlightPhase;
  isEngineBurning: boolean;
  throttle: number;
  stageState: {
    stage1Attached: boolean;
    stage2Burning: boolean;
    fairingAttached: boolean;
    stage1SeparationDist?: number;
    fairingSeparationDist?: number;
  };
  milestone?: AscentMilestone;
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

  // Replay & Recorded Flight History Engine
  public recordedStates: ReplayStateSnapshot[] = [];
  public milestones: AscentMilestone[] = [];
  public isReplayMode: boolean = false;
  public isReplayPlaying: boolean = false;
  public replayTimeS: number = 0.0;
  public replaySpeed: number = 1.0;
  public totalFlightDurationS: number = 300.0;
  private maxDynamicPressureObserved: number = 0.0;
  private maxQRecorded: boolean = false;

  constructor(params: Partial<SimulationParams> = {}) {
    this.params = { ...DEFAULT_SIM_PARAMS, ...params };
    const scenario = this.buildScenarioDefinition(this.params);
    this.engine = new SimulationEngine(scenario, { fixedTimeStepS: this.fixedDt });
    this.keplerian = OrbitClassifier.analyzeOrbit(new Vector3D(R_EARTH, 0, 0), new Vector3D(0, 0, 0));
    this.reset();
  }

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
    this.recordedStates = [];
    this.milestones = [];
    this.lastHistorySampleTime = -1.0;
    this.maxDynamicPressureObserved = 0.0;
    this.maxQRecorded = false;
    this.isReplayMode = false;
    this.replayTimeS = 0.0;

    this.syncStateFromEngine();
    this.recordSample(true);
    this.precomputeFlight(this.params.burnDurationS + 120.0);
  }

  /**
   * Starts ignition and transitions from ON_PAD to POWERED_ASCENT
   */
  public startLaunch(): void {
    this.isReplayMode = false;
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
   * Advances the live simulation by wall-clock interval dtWall
   */
  public update(dtWall: number): void {
    if (this.isReplayMode) {
      // Advance replay clock smoothly according to replay speed
      this.replayTimeS += dtWall * this.replaySpeed;
      if (this.replayTimeS > this.totalFlightDurationS) {
        this.replayTimeS = this.totalFlightDurationS;
      }
      return;
    }

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
   * Precomputes full deterministic trajectory for instant smooth scrubbing & replay
   */
  public precomputeFlight(durationS: number = 300.0): void {
    const scenario = this.buildScenarioDefinition(this.params);
    const simEngine = new SimulationEngine(scenario, { fixedTimeStepS: this.fixedDt });
    simEngine.launch();

    const dt = this.fixedDt;
    const steps = Math.ceil(durationS / dt);

    const states: ReplayStateSnapshot[] = [];
    const detectedMilestones: AscentMilestone[] = [
      {
        id: 'IGNITION',
        name: 'Ignition & Liftoff',
        timeS: 0.0,
        altitudeKm: 0.0,
        speedMPerS: 0.0,
        description: 'First stage engines ignite. Vehicle clears launch mount.',
      },
    ];

    let maxQVal = 0.0;
    let maxQTime = 0.0;
    let maxQRecorded = false;
    let pitchOverRecorded = false;
    let stagingRecorded = false;
    let fairingRecorded = false;
    let secoRecorded = false;

    // Snapshot at T=0
    states.push(this.createSnapshotFromEngine(simEngine));

    for (let i = 0; i < steps; i++) {
      simEngine.subStep(dt);
      const snap = this.createSnapshotFromEngine(simEngine);

      const altKm = snap.altitudeKm;
      const speed = snap.speedMPerS;
      const q = snap.dynamicPressureKPa;
      const t = snap.timeS;

      // Track Max-Q
      if (q > maxQVal) {
        maxQVal = q;
        maxQTime = t;
      }

      // Pitchover / Gravity turn start (~1 km altitude)
      if (!pitchOverRecorded && altKm >= 1.0) {
        pitchOverRecorded = true;
        detectedMilestones.push({
          id: 'PITCHOVER',
          name: 'Gravity Turn Pitchover',
          timeS: t,
          altitudeKm: altKm,
          speedMPerS: speed,
          description: 'Autonomous gravity turn initiated. Vehicle tilts toward launch azimuth.',
        });
      }

      // Max-Q recorded when dynamic pressure starts declining
      if (pitchOverRecorded && !maxQRecorded && t > maxQTime + 2.0 && maxQVal > 5.0) {
        maxQRecorded = true;
        detectedMilestones.push({
          id: 'MAX_Q',
          name: 'Maximum Dynamic Pressure (Max-Q)',
          timeS: maxQTime,
          altitudeKm: altKm,
          speedMPerS: speed,
          description: `Aerodynamic structural loading peaks at ${maxQVal.toFixed(1)} kPa.`,
        });
      }

      // Booster MECO & Staging (Engine cutoff of stage 1)
      if (!stagingRecorded && !snap.isEngineBurning && t > 10.0) {
        stagingRecorded = true;
        detectedMilestones.push({
          id: 'MECO_STAGING',
          name: 'Booster MECO & Stage Separation',
          timeS: t,
          altitudeKm: altKm,
          speedMPerS: speed,
          description: 'Stage 1 main engines cutoff. Booster separates and drifts aft.',
        });
      }

      // Fairing Jettison (Alt > 85 km)
      if (!fairingRecorded && altKm >= 85.0) {
        fairingRecorded = true;
        detectedMilestones.push({
          id: 'FAIRING_JETTISON',
          name: 'Payload Fairing Jettison',
          timeS: t,
          altitudeKm: altKm,
          speedMPerS: speed,
          description: 'Atmospheric boundary cleared. Fairing halves separate, exposing spacecraft.',
        });
      }

      // Orbital Insertion (Stable orbit or cutoff speed achieved)
      if (!secoRecorded && (snap.phase === FlightPhase.ORBIT_ACHIEVED || altKm >= 180.0)) {
        secoRecorded = true;
        detectedMilestones.push({
          id: 'ORBITAL_INSERTION',
          name: 'Orbital Insertion (LEO)',
          timeS: t,
          altitudeKm: altKm,
          speedMPerS: speed,
          description: 'Target orbital velocity achieved. Stable closed parking orbit established.',
        });
      }

      states.push(snap);

      if (simEngine.hasLandedOrImpacted) break;
    }

    if (!maxQRecorded && maxQVal > 1.0) {
      detectedMilestones.push({
        id: 'MAX_Q',
        name: 'Maximum Dynamic Pressure (Max-Q)',
        timeS: maxQTime,
        altitudeKm: 12.0,
        speedMPerS: 450.0,
        description: `Aerodynamic structural loading peaks at ${maxQVal.toFixed(1)} kPa.`,
      });
    }

    this.recordedStates = states;
    this.milestones = detectedMilestones.sort((a, b) => a.timeS - b.timeS);
    this.totalFlightDurationS = states.length > 0 ? states[states.length - 1].timeS : durationS;
  }

  private createSnapshotFromEngine(e: SimulationEngine): ReplayStateSnapshot {
    const t = e.currentTimeS;
    const burnDuration = this.params.burnDurationS;
    const pos = e.currentPosition;
    const vel = e.currentVelocity;
    const isStage1Attached = t < burnDuration + 1.0;
    const isFairingAttached = pos.magnitude() - R_EARTH < 85000.0;

    // Separation distance offsets
    const stage1SepDist = isStage1Attached ? 0 : Math.min(25.0, (t - burnDuration) * 3.5);
    const fairingSepDist = isFairingAttached ? 0 : Math.min(18.0, ((pos.magnitude() - R_EARTH - 85000.0) / 1000.0) * 0.4);

    // Compute vehicle forward orientation
    const fwd = e.rocketInstance.isEngineBurning
      ? e.rocketInstance.thrustDirection.clone().normalize()
      : vel.magnitudeSq() > 1.0
      ? vel.clone().normalize()
      : pos.clone().normalize();

    const grav = pos.clone().normalize().scale(-e.config.muEarth / pos.magnitudeSq());
    const thrustN = e.thrustForceVector.magnitude();

    return {
      timeS: t,
      positionM: pos.clone(),
      velocityMPerS: vel.clone(),
      accelerationMPerS2: e.currentAcceleration.clone(),
      attitudeForward: fwd,
      thrustForceN: fwd.clone().scale(thrustN),
      dragForceN: e.dragForceVector.clone(),
      gravityForceN: grav.scale(e.rocketInstance.totalMassKg),
      altitudeKm: Math.max(0, (pos.magnitude() - R_EARTH) / 1000.0),
      speedMPerS: vel.magnitude(),
      dynamicPressureKPa: e.currentDynamicPressurePa / 1000.0,
      thrustKN: thrustN / 1000.0,
      dragKN: e.dragForceVector.magnitude() / 1000.0,
      massTonnes: e.rocketInstance.totalMassKg / 1000.0,
      phase: e.currentFlightPhase,
      isEngineBurning: e.rocketInstance.isEngineBurning,
      throttle: e.rocketInstance.throttle,
      stageState: {
        stage1Attached: isStage1Attached,
        stage2Burning: !isStage1Attached && e.rocketInstance.isEngineBurning,
        fairingAttached: isFairingAttached,
        stage1SeparationDist: stage1SepDist,
        fairingSeparationDist: fairingSepDist,
      },
    };
  }

  private createSnapshotFromManager(s: SimulationManager): ReplayStateSnapshot {
    return this.createSnapshotFromEngine(s.engine);
  }

  /**
   * Evaluates continuous state at arbitrary timestamp via Hermite/linear interpolation
   */
  public evaluateReplayAt(timeS: number): ReplayStateSnapshot {
    const states = this.recordedStates;
    if (states.length === 0) {
      return this.createSnapshotFromManager(this);
    }

    const clampedTime = Math.max(0, Math.min(this.totalFlightDurationS, timeS));

    // Binary search for surrounding frames
    let low = 0;
    let high = states.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (states[mid].timeS < clampedTime) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const idx1 = Math.max(0, Math.min(states.length - 1, low));
    const idx0 = Math.max(0, idx1 - 1);

    if (idx0 === idx1) {
      return states[idx0];
    }

    const s0 = states[idx0];
    const s1 = states[idx1];
    const dt = s1.timeS - s0.timeS;
    const u = dt > 1e-5 ? Math.max(0.0, Math.min(1.0, (clampedTime - s0.timeS) / dt)) : 0.0;

    // Linear / Hermite blend of positions & velocities
    const pos = new Vector3D(
      s0.positionM.x + (s1.positionM.x - s0.positionM.x) * u,
      s0.positionM.y + (s1.positionM.y - s0.positionM.y) * u,
      s0.positionM.z + (s1.positionM.z - s0.positionM.z) * u
    );

    const vel = new Vector3D(
      s0.velocityMPerS.x + (s1.velocityMPerS.x - s0.velocityMPerS.x) * u,
      s0.velocityMPerS.y + (s1.velocityMPerS.y - s0.velocityMPerS.y) * u,
      s0.velocityMPerS.z + (s1.velocityMPerS.z - s0.velocityMPerS.z) * u
    );

    const fwd = new Vector3D(
      s0.attitudeForward.x + (s1.attitudeForward.x - s0.attitudeForward.x) * u,
      s0.attitudeForward.y + (s1.attitudeForward.y - s0.attitudeForward.y) * u,
      s0.attitudeForward.z + (s1.attitudeForward.z - s0.attitudeForward.z) * u
    ).normalize();

    // Active milestone lookup
    let activeMilestone: AscentMilestone | undefined;
    for (const m of this.milestones) {
      if (Math.abs(m.timeS - clampedTime) <= 4.0) {
        activeMilestone = m;
        break;
      }
    }

    return {
      timeS: clampedTime,
      positionM: pos,
      velocityMPerS: vel,
      accelerationMPerS2: s0.accelerationMPerS2,
      attitudeForward: fwd,
      thrustForceN: s0.thrustForceN,
      dragForceN: s0.dragForceN,
      gravityForceN: s0.gravityForceN,
      altitudeKm: s0.altitudeKm + (s1.altitudeKm - s0.altitudeKm) * u,
      speedMPerS: vel.magnitude(),
      dynamicPressureKPa: s0.dynamicPressureKPa + (s1.dynamicPressureKPa - s0.dynamicPressureKPa) * u,
      thrustKN: u < 0.5 ? s0.thrustKN : s1.thrustKN,
      dragKN: s0.dragKN + (s1.dragKN - s0.dragKN) * u,
      massTonnes: s0.massTonnes + (s1.massTonnes - s0.massTonnes) * u,
      phase: u < 0.5 ? s0.phase : s1.phase,
      isEngineBurning: u < 0.5 ? s0.isEngineBurning : s1.isEngineBurning,
      throttle: u < 0.5 ? s0.throttle : s1.throttle,
      stageState: u < 0.5 ? s0.stageState : s1.stageState,
      milestone: activeMilestone,
    };
  }

  /**
   * Replay Control Methods
   */
  public setReplayMode(enable: boolean): void {
    this.isReplayMode = enable;
    if (enable) {
      this.engine.pause();
      this.replayTimeS = this.timeS;
      this.isReplayPlaying = false;
      if (this.recordedStates.length === 0) {
        this.precomputeFlight(Math.max(120.0, this.params.burnDurationS + 60.0));
      }
    }
  }

  public toggleReplayPlay(): void {
    this.isReplayPlaying = !this.isReplayPlaying;
  }

  public restartReplay(): void {
    this.replayTimeS = 0.0;
    this.isReplayPlaying = true;
  }

  public setReplaySpeed(speed: number): void {
    this.replaySpeed = Math.max(0.05, Math.min(20.0, speed));
  }

  public advanceReplay(dtWall: number): void {
    if (!this.isReplayMode || !this.isReplayPlaying) return;
    this.replayTimeS += dtWall * this.replaySpeed;
    if (this.replayTimeS >= this.totalFlightDurationS) {
      this.replayTimeS = this.totalFlightDurationS;
      this.isReplayPlaying = false;
    }
  }

  public seekReplay(timeS: number): void {
    this.replayTimeS = Math.max(0, Math.min(this.totalFlightDurationS, timeS));
  }

  public stepReplay(dtS: number): void {
    this.seekReplay(this.replayTimeS + dtS);
  }

  public jumpToMilestone(milestoneId: string): void {
    const m = this.milestones.find((item) => item.id === milestoneId);
    if (m) {
      this.seekReplay(m.timeS);
    }
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

    if (this.telemetryHistory.length > 2500) {
      this.telemetryHistory.shift();
    }
    if (this.trajectoryHistory.length > 2500) {
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
