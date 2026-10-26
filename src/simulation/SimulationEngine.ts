/**
 * SimulationEngine.ts
 * 
 * Headless, deterministic rocket flight mechanics and orbital dynamics simulation engine.
 * 
 * Completely decoupled from presentation and graphics layers (zero Three.js, React, or DOM dependencies).
 * Enforces strict physical flight state transitions, conservative/dissipative regime transitions,
 * immutable telemetry snapshots, and robust user input validation.
 */

import { Vector3D } from '../physics/Vector3D';
import { R_EARTH, MU_EARTH, OMEGA_EARTH, H_ATMOSPHERE, G_0 } from '../physics/constants';
import { Rocket, RocketStageConfig } from '../physics/Rocket';
import { Atmosphere } from '../physics/Atmosphere';
import { OrbitClassifier, KeplerianElements, EnergyRegime, PeriapsisClearance } from '../physics/OrbitClassifier';
import { Integrators, DynamicState } from '../physics/Integrators';
import {
  FlightPhase,
  IntegratorRegime,
  SimulationConfig,
  VehicleConfig,
  LaunchScenarioConfig,
  ReadonlyTelemetrySnapshot,
  UserFlightCommands,
} from './SimulationTypes';
import {
  ScenarioDefinition,
  DEFAULT_LEO_SCENARIO,
  LaunchToOrbitGuidance,
} from './scenarios/LaunchToOrbit';
import { TrajectoryPredictor, TrajectoryPrediction } from './TrajectoryPredictor';

export const DEFAULT_SIM_CONFIG: SimulationConfig = {
  fixedTimeStepS: 0.05, // 50 ms fixed sub-step
  maxSubStepsPerFrame: 50,
  timeWarp: 1.0,
  muEarth: MU_EARTH,
  radiusEarthM: R_EARTH,
  atmosphericCutoffM: H_ATMOSPHERE,
  omegaEarthRadPerS: OMEGA_EARTH,
};

export class SimulationEngine {
  // Configuration
  public readonly config: SimulationConfig;
  public vehicleConfig: VehicleConfig;
  public scenarioConfig: LaunchScenarioConfig;

  // Physical instances
  private rocket: Rocket;

  // Dynamic state (SI units)
  private timeS: number = 0.0;
  private position: Vector3D = new Vector3D();
  private velocity: Vector3D = new Vector3D();
  private acceleration: Vector3D = new Vector3D();
  private thrustForce: Vector3D = new Vector3D();
  private gravityForce: Vector3D = new Vector3D();
  private dragForce: Vector3D = new Vector3D();
  private netForce: Vector3D = new Vector3D();
  private dynamicPressurePa: number = 0.0;

  // Guidance & Attitude
  private pitchDeg: number = 0.0;
  private azimuthDeg: number = 90.0;
  private autoGuidanceEnabled: boolean = true;
  private launchPadPosition: Vector3D = new Vector3D();

  // State machine & Status
  private flightPhase: FlightPhase = FlightPhase.ON_PAD;
  private hasImpacted: boolean = false;
  private isRunning: boolean = false;
  private activeRegime: IntegratorRegime = IntegratorRegime.ADAPTIVE_RK4;

  // Numerical accumulator for wall-clock decoupling
  private accumulator: number = 0.0;

  // Cached Keplerian elements
  private cachedKeplerian: KeplerianElements;

  constructor(
    scenario: ScenarioDefinition = DEFAULT_LEO_SCENARIO,
    customConfig: Partial<SimulationConfig> = {}
  ) {
    this.config = { ...DEFAULT_SIM_CONFIG, ...customConfig };
    this.vehicleConfig = { ...scenario.vehicle };
    this.scenarioConfig = { ...scenario.guidance };

    this.rocket = this.buildRocketInstance(this.vehicleConfig);
    this.cachedKeplerian = OrbitClassifier.analyzeOrbit(
      new Vector3D(this.config.radiusEarthM, 0, 0),
      new Vector3D(0, 0, 0),
      this.config.muEarth
    );

    this.reset();
  }

  private buildRocketInstance(cfg: VehicleConfig): Rocket {
    const stageConfig: RocketStageConfig = {
      dryMassKg: cfg.dryMassKg,
      propellantMassKg: cfg.propellantMassKg,
      thrustVacuumN: cfg.thrustVacuumN,
      thrustSeaLevelN: cfg.thrustSeaLevelN,
      ispVacuumS: cfg.ispVacuumS,
      ispSeaLevelS: cfg.ispSeaLevelS,
      crossSectionalAreaM2: cfg.crossSectionalAreaM2,
      dragCoefficient: cfg.dragCoefficient,
    };
    return new Rocket(stageConfig);
  }

  /**
   * Resets simulation state to initial launch pad conditions
   */
  public reset(newScenario?: ScenarioDefinition): void {
    if (newScenario) {
      this.vehicleConfig = { ...newScenario.vehicle };
      this.scenarioConfig = { ...newScenario.guidance };
    }

    this.rocket = this.buildRocketInstance(this.vehicleConfig);
    this.timeS = 0.0;
    this.accumulator = 0.0;
    this.hasImpacted = false;
    this.isRunning = false;
    this.autoGuidanceEnabled = true;

    // Compute pad position and Earth surface rotational velocity
    const pad = LaunchToOrbitGuidance.getInitialLaunchPadState(
      this.scenarioConfig.launchLatitudeDeg
    );
    this.position.copy(pad.positionM);
    this.velocity.copy(pad.velocityMPerS);
    this.launchPadPosition.copy(pad.positionM);

    this.acceleration.set(0, 0, 0);
    this.thrustForce.set(0, 0, 0);
    this.gravityForce.set(0, 0, 0);
    this.dragForce.set(0, 0, 0);
    this.netForce.set(0, 0, 0);
    this.dynamicPressurePa = 0.0;

    this.flightPhase = FlightPhase.ON_PAD;
    this.activeRegime = IntegratorRegime.ADAPTIVE_RK4;

    // Initialize guidance angles
    this.pitchDeg = 0.0;
    this.azimuthDeg = this.scenarioConfig.launchAzimuthDeg;
    this.updateGuidanceThrustVector();

    this.updateOrbitAnalysis();
  }

  /**
   * Starts ignition and transitions from ON_PAD to POWERED_ASCENT
   */
  public launch(): void {
    if (this.flightPhase === FlightPhase.ON_PAD) {
      this.rocket.isIgnited = true;
      this.rocket.throttle = 1.0;
      this.flightPhase = FlightPhase.POWERED_ASCENT;
      this.isRunning = true;
      this.updateGuidanceThrustVector();
    } else {
      this.isRunning = true;
    }
  }

  public pause(): void {
    this.isRunning = false;
  }

  public resume(): void {
    if (!this.hasImpacted) {
      this.isRunning = true;
    }
  }

  public setTimeWarp(warp: number): void {
    if (!Number.isFinite(warp)) return;
    this.config.timeWarp = Math.max(0.1, Math.min(100.0, warp));
  }

  /**
   * Commanded Manual Engine Cutoff (MECO)
   */
  public manualCutoff(): void {
    this.rocket.isIgnited = false;
    this.rocket.throttle = 0.0;
    this.thrustForce.set(0, 0, 0);

    if (this.flightPhase === FlightPhase.POWERED_ASCENT) {
      this.flightPhase = FlightPhase.COASTING;
    }
  }

  /**
   * Set engine throttle with strict bounds clamping [0.0, 1.0] and NaN rejection
   */
  public setThrottle(throttle: number): void {
    if (!Number.isFinite(throttle)) return;
    const clamped = Math.max(0.0, Math.min(1.0, throttle));
    this.rocket.throttle = clamped;
    if (clamped <= 0.0 && this.flightPhase === FlightPhase.POWERED_ASCENT) {
      this.manualCutoff();
    } else if (clamped > 0.0 && (this.flightPhase === FlightPhase.COASTING || this.flightPhase === FlightPhase.POWERED_ASCENT)) {
      if (!this.rocket.isFuelDepleted) {
        this.rocket.isIgnited = true;
        this.flightPhase = FlightPhase.POWERED_ASCENT;
      }
    }
  }

  /**
   * Set vehicle attitude (pitch and azimuth angles in degrees)
   */
  public setAttitude(pitchDeg: number, azimuthDeg: number): void {
    if (!Number.isFinite(pitchDeg) || !Number.isFinite(azimuthDeg)) return;
    this.autoGuidanceEnabled = false;
    this.pitchDeg = Math.max(0.0, Math.min(90.0, pitchDeg));
    this.azimuthDeg = ((azimuthDeg % 360) + 360) % 360;

    // Apply manual orientation to rocket thrust direction
    this.applyAttitudeToThrustVector();
  }

  /**
   * Apply user flight commands
   */
  public applyCommands(commands: UserFlightCommands): void {
    if (commands.cutoff) {
      this.manualCutoff();
      return;
    }
    if (commands.throttle !== undefined) {
      this.setThrottle(commands.throttle);
    }
    if (commands.pitchDeg !== undefined && commands.azimuthDeg !== undefined) {
      this.setAttitude(commands.pitchDeg, commands.azimuthDeg);
    } else if (commands.pitchDeg !== undefined) {
      this.setAttitude(commands.pitchDeg, this.azimuthDeg);
    } else if (commands.azimuthDeg !== undefined) {
      this.setAttitude(this.pitchDeg, commands.azimuthDeg);
    }
  }

  /**
   * Updates thrust vector according to the automated gravity turn guidance law
   */
  private updateGuidanceThrustVector(): void {
    if (!this.autoGuidanceEnabled) {
      this.applyAttitudeToThrustVector();
      return;
    }

    const guidance = LaunchToOrbitGuidance.computeGuidanceThrustVector(
      this.position,
      this.scenarioConfig
    );
    this.pitchDeg = guidance.pitchDeg;
    this.azimuthDeg = guidance.azimuthDeg;
    this.rocket.setThrustDirection(guidance.thrustDirection);
  }

  /**
   * Converts pitch and azimuth to an ECI unit thrust vector
   */
  private applyAttitudeToThrustVector(): void {
    const up = this.position.clone().normalize();
    const zAxis = new Vector3D(0, 0, 1);
    const zProj = up.clone().scale(up.z);
    let north = zAxis.sub(zProj);
    if (north.magnitude() < 1e-6) {
      north = new Vector3D(1, 0, 0);
    } else {
      north.normalize();
    }
    const east = Vector3D.cross(north, up).normalize();

    const pitchRad = (this.pitchDeg * Math.PI) / 180.0;
    const azimuthRad = (this.azimuthDeg * Math.PI) / 180.0;

    const tangentDir = north
      .clone()
      .scale(Math.cos(azimuthRad))
      .addScaled(east, Math.sin(azimuthRad))
      .normalize();

    const thrustDir = up
      .clone()
      .scale(Math.cos(pitchRad))
      .addScaled(tangentDir, Math.sin(pitchRad))
      .normalize();

    this.rocket.setThrustDirection(thrustDir);
  }

  /**
   * Decoupled wall-clock frame update using fixed sub-stepping accumulator
   */
  public update(dtWall: number): void {
    if (!this.isRunning || this.hasImpacted) return;
    if (!Number.isFinite(dtWall) || dtWall <= 0) return;

    // Clamp dtWall to avoid spiral-of-death on frame hitches
    const safeDtWall = Math.min(0.2, dtWall);
    this.accumulator += safeDtWall * this.config.timeWarp;

    const fixedDt = this.config.fixedTimeStepS;
    let stepCount = 0;

    while (this.accumulator >= fixedDt && stepCount < this.config.maxSubStepsPerFrame) {
      this.subStep(fixedDt);
      this.accumulator -= fixedDt;
      stepCount++;
      if (this.hasImpacted) break;
    }

    this.updateOrbitAnalysis();
  }

  /**
   * Single deterministic physical step
   */
  public subStep(dt: number): void {
    if (this.hasImpacted) return;
    if (!Number.isFinite(dt) || dt <= 0) return;

    const altitude = Math.max(0, this.position.magnitude() - this.config.radiusEarthM);

    // 1. Check cutoff conditions during powered flight
    if (this.flightPhase === FlightPhase.POWERED_ASCENT) {
      const speed = this.velocity.magnitude();
      const cutoffSpeed = this.scenarioConfig.targetCutoffSpeedMPerS;

      if (cutoffSpeed > 0 && speed >= cutoffSpeed) {
        this.manualCutoff();
      } else if (this.timeS >= this.vehicleConfig.burnDurationS) {
        this.manualCutoff();
      } else if (this.rocket.isFuelDepleted) {
        this.manualCutoff();
      } else {
        this.updateGuidanceThrustVector();
      }
    }

    // Determine expected integrator regime
    const isBurning = this.rocket.isEngineBurning;
    const inAtmosphere = altitude < this.config.atmosphericCutoffM;
    if (isBurning || inAtmosphere) {
      this.activeRegime = IntegratorRegime.ADAPTIVE_RK4;
    } else {
      this.activeRegime = IntegratorRegime.SYMPLECTIC_VERLET;
    }

    // 2. Step unified physics engine
    const nextState: DynamicState = Integrators.stepUnified(
      this.position,
      this.velocity,
      this.rocket,
      this.timeS,
      dt,
      this.hasImpacted
    );

    this.timeS = nextState.timeS;
    this.position.copy(nextState.positionM);
    this.velocity.copy(nextState.velocityMPerS);
    this.acceleration.copy(nextState.accelerationMPerS2);

    // 3. Compute constituent forces for exact force balance telemetry
    this.computeForces(altitude);

    // 4. Handle terminal surface impact
    if (nextState.hasImpacted) {
      this.hasImpacted = true;
      this.flightPhase = FlightPhase.SURFACE_IMPACTED;
      this.isRunning = false;
      this.velocity.set(0, 0, 0);
      this.acceleration.set(0, 0, 0);
      this.netForce.set(0, 0, 0);
      this.thrustForce.set(0, 0, 0);
      this.dragForce.set(0, 0, 0);
      return;
    }

    // 5. Evaluate Flight Phase State Machine
    this.evaluatePhaseTransitions(altitude);
  }

  /**
   * Computes individual forces acting on the vehicle for force-balance telemetry
   */
  private computeForces(altitudeM: number): void {
    const r = this.position.magnitude();
    const mass = this.rocket.totalMassKg;

    // Gravity: F_g = - (mu * m / r^3) * r
    const gMagnitude = (this.config.muEarth * mass) / (r * r);
    const rHat = this.position.clone().normalize();
    this.gravityForce = rHat.scale(-gMagnitude);

    // Thrust: F_T = T * T_hat
    const thrustMagnitude = this.rocket.getThrustMagnitudeAtAltitude(altitudeM);
    this.thrustForce = this.rocket.thrustDirection.clone().scale(thrustMagnitude);

    // Aerodynamics
    const aero = Atmosphere.computeAerodynamics(
      this.position,
      this.velocity,
      mass,
      this.rocket.dragCoefficient,
      this.rocket.crossSectionalAreaM2,
      true
    );
    this.dynamicPressurePa = aero.dynamicPressurePa;
    this.dragForce = aero.dragForceN;

    // Net Force: F_net = F_T + F_g + F_drag
    this.netForce = this.thrustForce.clone().add(this.gravityForce).add(this.dragForce);
  }

  /**
   * Evaluates state machine transitions between flight phases
   */
  private evaluatePhaseTransitions(altitudeM: number): void {
    this.updateOrbitAnalysis();
    const { energyRegime, periapsisClearance, eccentricity: e } = this.cachedKeplerian;
    const r = this.position.magnitude();
    const radialVelocity = Vector3D.dot(this.position, this.velocity) / r;

    switch (this.flightPhase) {
      case FlightPhase.COASTING:
        // Escape condition: unbounded specific energy and outward motion
        if (energyRegime === EnergyRegime.UNBOUNDED && radialVelocity > 0) {
          this.flightPhase = FlightPhase.ESCAPE_TRAJECTORY;
        }
        // Orbit achieved: bounded ellipse with periapsis clearing atmosphere threshold
        else if (
          periapsisClearance === PeriapsisClearance.SPACE_CLEARED &&
          e < 1.0 - 1e-4
        ) {
          this.flightPhase = FlightPhase.ORBIT_ACHIEVED;
        }
        // Atmospheric reentry: descending through atmosphere (< 100 km)
        else if (altitudeM < this.config.atmosphericCutoffM && radialVelocity < 0) {
          this.flightPhase = FlightPhase.ATMOSPHERIC_REENTRY;
        }
        break;

      case FlightPhase.ORBIT_ACHIEVED:
        // If orbit decays through drag or perturbation into the atmosphere
        if (
          periapsisClearance !== PeriapsisClearance.SPACE_CLEARED ||
          altitudeM < this.config.atmosphericCutoffM
        ) {
          this.flightPhase = altitudeM < this.config.atmosphericCutoffM && radialVelocity < 0
            ? FlightPhase.ATMOSPHERIC_REENTRY
            : FlightPhase.COASTING;
        }
        break;

      default:
        break;
    }
  }

  private updateOrbitAnalysis(): void {
    this.cachedKeplerian = OrbitClassifier.analyzeOrbit(
      this.position,
      this.velocity,
      this.config.muEarth
    );
  }

  /**
   * Downrange surface distance traveled from launch pad [km]
   */
  public getDownrangeDistanceKm(): number {
    const padNorm = this.launchPadPosition.clone().normalize();
    const posNorm = this.position.clone().normalize();
    const cosAngle = Math.max(-1.0, Math.min(1.0, Vector3D.dot(padNorm, posNorm)));
    const centralAngleRad = Math.acos(cosAngle);
    return (this.config.radiusEarthM * centralAngleRad) / 1000.0;
  }

  /**
   * Generate an immutable, read-only telemetry snapshot
   */
  public getTelemetry(): ReadonlyTelemetrySnapshot {
    const rMag = this.position.magnitude();
    const altM = Math.max(0, rMag - this.config.radiusEarthM);
    const speed = this.velocity.magnitude();
    const radialVel = rMag > 0 ? Vector3D.dot(this.position, this.velocity) / rMag : 0;
    const tangentialVel = Math.sqrt(Math.max(0, speed * speed - radialVel * radialVel));
    const accelMag = this.acceleration.magnitude();

    const kep = this.cachedKeplerian;
    const initialProp = this.rocket.initialPropellantMassKg;
    const propRemaining = this.rocket.propellantRemainingKg;
    const propPercent = initialProp > 0 ? (propRemaining / initialProp) * 100.0 : 0.0;

    return Object.freeze({
      timeS: this.timeS,
      altitudeM: altM,
      altitudeKm: altM / 1000.0,
      downrangeKm: this.getDownrangeDistanceKm(),
      inertialSpeedMPerS: speed,
      radialVelocityMPerS: radialVel,
      tangentialVelocityMPerS: tangentialVel,
      accelerationMagnitudeMPerS2: accelMag,
      accelerationG: accelMag / G_0,
      massKg: this.rocket.totalMassKg,
      propellantRemainingKg: propRemaining,
      propellantFractionPercent: propPercent,
      throttle: this.rocket.throttle,
      thrustN: this.thrustForce.magnitude(),
      dragN: this.dragForce.magnitude(),
      dynamicPressurePa: this.dynamicPressurePa,
      specificEnergyJPerKg: kep.specificEnergyJPerKg,
      specificAngularMomentumM2PerS: kep.specificAngularMomentumM2PerS,
      eccentricity: kep.eccentricity,
      semiMajorAxisM: kep.semiMajorAxisM,
      periapsisRadiusM: kep.periapsisRadiusM,
      apoapsisRadiusM: kep.apoapsisRadiusM,
      periapsisAltitudeKm: (kep.periapsisRadiusM - this.config.radiusEarthM) / 1000.0,
      apoapsisAltitudeKm: kep.apoapsisRadiusM !== null
        ? (kep.apoapsisRadiusM - this.config.radiusEarthM) / 1000.0
        : null,
      orbitalPeriodS: kep.orbitalPeriodS,
      inclinationDeg: (kep.inclinationRad * 180.0) / Math.PI,
      phase: this.flightPhase,
      conicType: kep.conicType,
      energyRegime: kep.energyRegime,
      periapsisClearance: kep.periapsisClearance,
      integratorRegime: this.activeRegime,
      hasImpacted: this.hasImpacted,
      // Immutable vector representations (cloned)
      position: Object.freeze({ x: this.position.x, y: this.position.y, z: this.position.z }),
      velocity: Object.freeze({ x: this.velocity.x, y: this.velocity.y, z: this.velocity.z }),
    });
  }

  /**
   * Predicts osculating trajectory from instantaneous state
   */
  public predictTrajectory(samplesCount: number = 120): TrajectoryPrediction {
    return TrajectoryPredictor.predict(this.position, this.velocity, {
      samplesCount,
      bodyRadiusM: this.config.radiusEarthM,
      mu: this.config.muEarth,
    });
  }

  // Getters for integration compatibility
  public get currentPosition(): Vector3D {
    return this.position.clone();
  }

  public get currentVelocity(): Vector3D {
    return this.velocity.clone();
  }

  public get currentAcceleration(): Vector3D {
    return this.acceleration.clone();
  }

  public get currentFlightPhase(): FlightPhase {
    return this.flightPhase;
  }

  public get isSimulationRunning(): boolean {
    return this.isRunning;
  }

  public get rocketInstance(): Rocket {
    return this.rocket;
  }

  public get thrustForceVector(): Vector3D {
    return this.thrustForce.clone();
  }

  public get gravityForceVector(): Vector3D {
    return this.gravityForce.clone();
  }

  public get dragForceVector(): Vector3D {
    return this.dragForce.clone();
  }

  public get currentDynamicPressurePa(): number {
    return this.dynamicPressurePa;
  }

  public get currentTimeS(): number {
    return this.timeS;
  }

  public get hasLandedOrImpacted(): boolean {
    return this.hasImpacted;
  }
}
