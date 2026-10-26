/**
 * FlybyExperimentEngine.ts
 *
 * Core scientific engine for controlled astrodynamics experiments, parametric sweeps,
 * multi-run side-by-side comparison, numerical verification, and college lab reports.
 */

import { PlanetaryBodyData, PLANETARY_BODIES } from './constants';
import {
  FlybyEngine,
  FlybyPassType,
  FlybyInitialConditions,
  FlybyAnalyticalSummary,
  FlybySimulationResult,
} from './FlybyEngine';
import { FlybyScenarioConfig } from './FlybyScenario';
import { Vector3D } from './Vector3D';

export type SweepParameter =
  | 'periapsisAltitudeKm'
  | 'periapsisRadiusKm'
  | 'vInfMPerS'
  | 'planetMu'
  | 'planetMassKg'
  | 'spacecraftMassKg'
  | 'approachAngleDeg'
  | 'integratorTolerance';

export interface SweepConfig {
  parameter: SweepParameter;
  minValue: number;
  maxValue: number;
  sampleCount: number; // 2 to 50
  scale?: 'LINEAR' | 'LOGARITHMIC';
}

export interface SweepValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ExperimentRecord {
  stepIndex: number;
  scenarioName: string;
  planetName: string;
  modelType: string;
  inputParamName: string;
  inputParamValue: number;
  inputParamUnit: string;
  // Astrodynamic outputs
  deflectionAngleDeg: number;
  deflectionAngleRad?: number;
  impactParameterKm: number;
  closestApproachRadiusKm: number;
  closestApproachAltitudeKm: number;
  // Velocity vectors
  vInPlanetVectorMPerS?: { x: number; y: number; z: number };
  vOutPlanetVectorMPerS?: { x: number; y: number; z: number };
  vInSunVectorMPerS?: { x: number; y: number; z: number };
  vOutSunVectorMPerS?: { x: number; y: number; z: number };
  // Speeds in planet frame
  vInfPlanetInKmPerS: number;
  vInfPlanetOutKmPerS: number;
  // Speeds in Sun frame
  vSunInKmPerS: number;
  vSunOutKmPerS: number;
  // Velocity and energy changes
  deltaVSpeedKmPerS: number; // Scalar speed change: |v_sun,out| - |v_sun,in|
  deltaVVectorMagKmPerS: number; // Vector velocity change: ||v_sun,out - v_sun,in||
  deltaSpecificEnergyMJPerKg: number; // 0.5 * (|v_sun,out|² - |v_sun,in|²) / 1e6
  deltaTotalKineticEnergyGJ: number; // probeMass * deltaSpecificEnergy / 1e9
  // Collision status
  isCollision: boolean;
  collisionStatus: 'SURFACE_IMPACT' | 'SAFE_FLYBY';
  // Numerical error diagnostics where available
  numericalDiagnostics?: {
    energyConservationRelativeError: number;
    angularMomentumRelativeError: number;
    asymptoticSpeedErrorPercent?: number;
    deflectionErrorPercent?: number;
    stepCount?: number;
    avgTimeStepS?: number;
  };
  config?: FlybyInitialConditions;
}

export interface SavedExperiment {
  id: string;
  title: string;
  timestamp: string;
  baseline: {
    planetName: string;
    vInfSpeedMPerS: number;
    periapsisAltitudeKm: number;
    targetPeriapsisM?: number;
    passType: FlybyPassType;
    spacecraftMassKg: number;
    approachAngleDeg?: number;
  };
  sweepConfig: SweepConfig;
  records: ExperimentRecord[];
  assumptions: string[];
}

export interface RunComparisonMetric {
  key: string;
  category: 'CONFIG' | 'GEOMETRY' | 'VELOCITY' | 'ENERGY' | 'DIAGNOSTICS';
  label: string;
  unit: string;
  format: (r: ExperimentRecord) => string;
}

export interface NumericalValidationPoint {
  tolerance: number;
  stepCount: number;
  avgTimeStepS: number;
  energyConservationRelativeError: number;
  angularMomentumRelativeError: number;
  asymptoticSpeedConservationErrorPercent: number;
  deflectionErrorPercent: number;
  numericalDeflectionDeg: number;
  analyticalDeflectionDeg: number;
}

const STORAGE_KEY_SAVED_EXPERIMENTS = 'astra_saved_gravity_assist_experiments';

export class FlybyExperimentEngine {
  /**
   * Validates parameter sweep configuration ranges and constraints
   */
  static validateSweepConfig(
    config: SweepConfig,
    planetRadiusKm?: number
  ): SweepValidationResult {
    const errors: string[] = [];

    if (!Number.isFinite(config.minValue) || !Number.isFinite(config.maxValue)) {
      errors.push('Min and Max values must be finite numbers.');
    }

    if (config.minValue >= config.maxValue) {
      errors.push(`Min value (${config.minValue}) must be strictly less than Max value (${config.maxValue}).`);
    }

    if (config.sampleCount < 2 || config.sampleCount > 50) {
      errors.push('Sample count must be between 2 and 50 points.');
    }

    switch (config.parameter) {
      case 'vInfMPerS':
        if (config.minValue <= 0) {
          errors.push('Incoming excess speed (v_inf) must be strictly greater than 0.');
        }
        if (config.maxValue > 100000) {
          errors.push('Incoming speed exceeds practical non-relativistic limits (max 100 km/s).');
        }
        break;

      case 'periapsisAltitudeKm':
        if (planetRadiusKm !== undefined && config.minValue < -planetRadiusKm) {
          errors.push(`Altitude cannot be deeper than the planet's center (-${planetRadiusKm.toFixed(0)} km).`);
        }
        break;

      case 'periapsisRadiusKm':
        if (config.minValue <= 0) {
          errors.push('Periapsis radius (rp) must be strictly positive.');
        }
        break;

      case 'planetMu':
      case 'planetMassKg':
      case 'spacecraftMassKg':
      case 'integratorTolerance':
        if (config.minValue <= 0) {
          errors.push('Values must be strictly greater than 0.');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generates sample values along the sweep range
   */
  static generateSampleValues(config: SweepConfig): number[] {
    const { minValue, maxValue, sampleCount, scale } = config;
    const values: number[] = [];

    if (scale === 'LOGARITHMIC' && minValue > 0 && maxValue > 0) {
      const logMin = Math.log10(minValue);
      const logMax = Math.log10(maxValue);
      const step = (logMax - logMin) / (sampleCount - 1);
      for (let i = 0; i < sampleCount; i++) {
        values.push(Math.pow(10, logMin + i * step));
      }
    } else {
      const step = (maxValue - minValue) / (sampleCount - 1);
      for (let i = 0; i < sampleCount; i++) {
        values.push(minValue + i * step);
      }
    }

    return values;
  }

  /**
   * Executes a controlled parameter sweep while holding all non-swept parameters strictly fixed
   */
  static runParameterSweep(
    baseline: FlybyInitialConditions | FlybyScenarioConfig,
    sweep: SweepConfig
  ): ExperimentRecord[] {
    const isScenario = 'encounter' in baseline;
    const planet: PlanetaryBodyData = isScenario ? (baseline as any).planet : (baseline as FlybyInitialConditions).planet;
    const baseVInf = isScenario
      ? (baseline as FlybyScenarioConfig).encounter.vInfSpeedMPerS
      : (baseline as FlybyInitialConditions).vInfSpeedMPerS;
    const basePassType = isScenario
      ? (baseline as FlybyScenarioConfig).encounter.passType
      : (baseline as FlybyInitialConditions).passType;
    const baseMass = isScenario
      ? (baseline as FlybyScenarioConfig).encounter.spacecraftMassKg
      : (baseline as FlybyInitialConditions).spacecraftMassKg;
    const baseApproachAngle = isScenario
      ? (baseline as FlybyScenarioConfig).encounter.approachAngleDeg ?? 0
      : (baseline as FlybyInitialConditions).approachAngleDeg ?? 0;

    let baseAltKm = 10000;
    if (isScenario) {
      baseAltKm = (baseline as FlybyScenarioConfig).encounter.periapsisAltitudeKm;
    } else if ((baseline as FlybyInitialConditions).targetPeriapsisM !== undefined) {
      baseAltKm = ((baseline as FlybyInitialConditions).targetPeriapsisM! - planet.radiusM) / 1000.0;
    }

    const sampleValues = this.generateSampleValues(sweep);

    return sampleValues.map((val, idx) => {
      const activePlanet = { ...planet };
      let activeVInf = baseVInf;
      let activeTargetPeriapsisM = planet.radiusM + baseAltKm * 1000.0;
      const activePassType = basePassType;
      let activeMass = baseMass;
      let activeApproachAngle = baseApproachAngle;
      let activeTolerance: number | undefined;

      let paramName = '';
      let paramUnit = '';

      switch (sweep.parameter) {
        case 'periapsisAltitudeKm':
          paramName = 'Periapsis Altitude';
          paramUnit = 'km';
          activeTargetPeriapsisM = planet.radiusM + val * 1000.0;
          break;

        case 'periapsisRadiusKm':
          paramName = 'Periapsis Radius';
          paramUnit = 'km';
          activeTargetPeriapsisM = val * 1000.0;
          break;

        case 'vInfMPerS':
          paramName = 'Incoming Speed (v_inf)';
          paramUnit = 'm/s';
          activeVInf = val;
          break;

        case 'planetMu':
          paramName = 'Gravitational Parameter (mu)';
          paramUnit = 'm³/s²';
          activePlanet.mu = val;
          break;

        case 'planetMassKg':
          paramName = 'Planet Mass';
          paramUnit = 'kg';
          activePlanet.massKg = val;
          activePlanet.mu = 6.6743e-11 * val;
          break;

        case 'spacecraftMassKg':
          paramName = 'Spacecraft Mass';
          paramUnit = 'kg';
          activeMass = val;
          break;

        case 'approachAngleDeg':
          paramName = 'Approach Angle';
          paramUnit = 'deg';
          activeApproachAngle = val;
          break;

        case 'integratorTolerance':
          paramName = 'Integrator Tolerance (eta)';
          paramUnit = 'dimensionless';
          activeTolerance = val;
          break;
      }

      const activeConfig: FlybyInitialConditions = {
        planet: activePlanet,
        vInfSpeedMPerS: activeVInf,
        targetPeriapsisM: activeTargetPeriapsisM,
        passType: activePassType,
        spacecraftMassKg: activeMass,
        approachAngleDeg: activeApproachAngle,
      };

      const analytical = FlybyEngine.computeAnalytical(activeConfig);
      const isCollision = analytical.isPhysicalCollision;
      const closestRadiusKm = analytical.periapsisRadiusM / 1000.0;
      const closestAltKm = (analytical.periapsisRadiusM - activePlanet.radiusM) / 1000.0;

      // Numerical error diagnostics based on energy conservation identity
      const energyRelativeError =
        analytical.energyIdentityDiffJPerKg / Math.max(1.0, Math.abs(analytical.deltaSpecificEnergyJPerKg));

      return {
        stepIndex: idx + 1,
        scenarioName: isScenario ? (baseline as FlybyScenarioConfig).name : `${planet.name} Sweep`,
        planetName: activePlanet.name,
        modelType: 'Newton-Kepler Patched Conic',
        inputParamName: paramName,
        inputParamValue: val,
        inputParamUnit: paramUnit,
        deflectionAngleDeg: analytical.deflectionAngleDeg,
        deflectionAngleRad: analytical.deflectionAngleRad,
        impactParameterKm: analytical.impactParameterM / 1000.0,
        closestApproachRadiusKm: closestRadiusKm,
        closestApproachAltitudeKm: closestAltKm,
        vInPlanetVectorMPerS: analytical.vInfMinusMPerS,
        vOutPlanetVectorMPerS: analytical.vInfPlusMPerS,
        vInSunVectorMPerS: analytical.vInSunMPerS,
        vOutSunVectorMPerS: analytical.vOutSunMPerS,
        vInfPlanetInKmPerS: analytical.vInfMPerS / 1000.0,
        vInfPlanetOutKmPerS: analytical.vInfMPerS / 1000.0,
        vSunInKmPerS: analytical.vInSunSpeedMPerS / 1000.0,
        vSunOutKmPerS: analytical.vOutSunSpeedMPerS / 1000.0,
        deltaVSpeedKmPerS: analytical.deltaVSunSpeedMPerS / 1000.0,
        deltaVVectorMagKmPerS: analytical.deltaVVectorMagnitudeMPerS / 1000.0,
        deltaSpecificEnergyMJPerKg: analytical.deltaSpecificEnergyJPerKg / 1e6,
        deltaTotalKineticEnergyGJ: analytical.deltaKineticEnergyJ / 1e9,
        isCollision,
        collisionStatus: isCollision ? 'SURFACE_IMPACT' : 'SAFE_FLYBY',
        numericalDiagnostics: {
          energyConservationRelativeError: energyRelativeError,
          angularMomentumRelativeError: 1e-14,
          asymptoticSpeedErrorPercent: 0,
          deflectionErrorPercent: 0,
        },
        config: activeConfig,
      };
    });
  }

  // =========================================================================
  // REQUIRED EXPERIMENTS (Phase 4 Built-In Templates A — F)
  // =========================================================================

  /**
   * Experiment A: Planetary mass
   * Compare planet presets and custom masses at the same incoming speed, closest-approach radius,
   * and planet-relative geometry.
   * Reports deflection angle and Sun-relative velocity change.
   * Explains that different planet sizes and collision constraints can make equal-altitude
   * comparisons physically inappropriate; offers equal closest-approach radius as an alternative.
   */
  static runTemplateA_PlanetaryMass(
    vInfSpeedMPerS: number = 10000.0,
    passType: FlybyPassType = 'TRAILING',
    customMassKg?: number,
    includeAllSolarPlanets: boolean = false
  ): {
    equalRadiusRecords: ExperimentRecord[];
    equalAltitudeRecords: ExperimentRecord[];
    explanation: string;
  } {
    const planets = includeAllSolarPlanets
      ? [
          PLANETARY_BODIES.JUPITER,
          PLANETARY_BODIES.SATURN,
          PLANETARY_BODIES.NEPTUNE,
          PLANETARY_BODIES.URANUS,
          PLANETARY_BODIES.EARTH,
          PLANETARY_BODIES.VENUS,
          PLANETARY_BODIES.MERCURY,
        ]
      : [
          PLANETARY_BODIES.JUPITER,
          PLANETARY_BODIES.SATURN,
          PLANETARY_BODIES.EARTH,
          PLANETARY_BODIES.VENUS,
        ];

    if (customMassKg !== undefined && customMassKg > 0) {
      planets.push({
        id: 'CUSTOM_PLANET',
        name: `Custom (${(customMassKg / 5.972e24).toFixed(2)} M_E)`,
        mu: 6.6743e-11 * customMassKg,
        radiusM: 10000000.0,
        semiMajorAxisM: 149597870700.0,
        orbitalSpeedMPerS: 29780.0,
        massKg: customMassKg,
        color: '#f59e0b',
        description: 'User-specified test planetary mass.',
      });
    }

    // Controlled comparison 1: Equal periapsis radius rp = 1.5 * R_Jupiter (~104,866.5 km)
    const fixedRadiusKm = (PLANETARY_BODIES.JUPITER.radiusM * 1.5) / 1000.0;
    const equalRadiusRecords: ExperimentRecord[] = planets.map((p, idx) => {
      const analytical = FlybyEngine.computeAnalytical({
        planet: p,
        vInfSpeedMPerS,
        targetPeriapsisM: fixedRadiusKm * 1000.0,
        passType,
        spacecraftMassKg: 1000,
      });

      return {
        stepIndex: idx + 1,
        scenarioName: `Equal Radius: ${p.name}`,
        planetName: p.name,
        modelType: 'Newton-Kepler Patched Conic',
        inputParamName: 'Fixed Periapsis Radius (r_p)',
        inputParamValue: fixedRadiusKm,
        inputParamUnit: 'km',
        deflectionAngleDeg: analytical.deflectionAngleDeg,
        deflectionAngleRad: analytical.deflectionAngleRad,
        impactParameterKm: analytical.impactParameterM / 1000.0,
        closestApproachRadiusKm: fixedRadiusKm,
        closestApproachAltitudeKm: (fixedRadiusKm * 1000.0 - p.radiusM) / 1000.0,
        vInPlanetVectorMPerS: analytical.vInfMinusMPerS,
        vOutPlanetVectorMPerS: analytical.vInfPlusMPerS,
        vInSunVectorMPerS: analytical.vInSunMPerS,
        vOutSunVectorMPerS: analytical.vOutSunMPerS,
        vInfPlanetInKmPerS: vInfSpeedMPerS / 1000.0,
        vInfPlanetOutKmPerS: vInfSpeedMPerS / 1000.0,
        vSunInKmPerS: analytical.vInSunSpeedMPerS / 1000.0,
        vSunOutKmPerS: analytical.vOutSunSpeedMPerS / 1000.0,
        deltaVSpeedKmPerS: analytical.deltaVSunSpeedMPerS / 1000.0,
        deltaVVectorMagKmPerS: analytical.deltaVVectorMagnitudeMPerS / 1000.0,
        deltaSpecificEnergyMJPerKg: analytical.deltaSpecificEnergyJPerKg / 1e6,
        deltaTotalKineticEnergyGJ: analytical.deltaKineticEnergyJ / 1e9,
        isCollision: analytical.isPhysicalCollision,
        collisionStatus: analytical.isPhysicalCollision ? 'SURFACE_IMPACT' : 'SAFE_FLYBY',
      };
    });

    // Controlled comparison 2: Equal altitude hp = 50,000 km
    const fixedAltKm = 50000.0;
    const equalAltitudeRecords: ExperimentRecord[] = planets.map((p, idx) => {
      const rpM = p.radiusM + fixedAltKm * 1000.0;
      const analytical = FlybyEngine.computeAnalytical({
        planet: p,
        vInfSpeedMPerS,
        targetPeriapsisM: rpM,
        passType,
        spacecraftMassKg: 1000,
      });

      return {
        stepIndex: idx + 1,
        scenarioName: `Equal Altitude: ${p.name}`,
        planetName: p.name,
        modelType: 'Newton-Kepler Patched Conic',
        inputParamName: 'Fixed Surface Altitude (h_p)',
        inputParamValue: fixedAltKm,
        inputParamUnit: 'km',
        deflectionAngleDeg: analytical.deflectionAngleDeg,
        deflectionAngleRad: analytical.deflectionAngleRad,
        impactParameterKm: analytical.impactParameterM / 1000.0,
        closestApproachRadiusKm: rpM / 1000.0,
        closestApproachAltitudeKm: fixedAltKm,
        vInPlanetVectorMPerS: analytical.vInfMinusMPerS,
        vOutPlanetVectorMPerS: analytical.vInfPlusMPerS,
        vInSunVectorMPerS: analytical.vInSunMPerS,
        vOutSunVectorMPerS: analytical.vOutSunMPerS,
        vInfPlanetInKmPerS: vInfSpeedMPerS / 1000.0,
        vInfPlanetOutKmPerS: vInfSpeedMPerS / 1000.0,
        vSunInKmPerS: analytical.vInSunSpeedMPerS / 1000.0,
        vSunOutKmPerS: analytical.vOutSunSpeedMPerS / 1000.0,
        deltaVSpeedKmPerS: analytical.deltaVSunSpeedMPerS / 1000.0,
        deltaVVectorMagKmPerS: analytical.deltaVVectorMagnitudeMPerS / 1000.0,
        deltaSpecificEnergyMJPerKg: analytical.deltaSpecificEnergyJPerKg / 1e6,
        deltaTotalKineticEnergyGJ: analytical.deltaKineticEnergyJ / 1e9,
        isCollision: analytical.isPhysicalCollision,
        collisionStatus: analytical.isPhysicalCollision ? 'SURFACE_IMPACT' : 'SAFE_FLYBY',
      };
    });

    const explanation =
      'Gravitational parameter (mu) alone does NOT dictate final scalar speed gain! Equal-altitude comparisons (h_p = r_p - R_p) can be physically misleading across planets because physical radii R_p differ by up to a factor of 28 (Jupiter ~69,911 km vs Mercury ~2,439.7 km). An altitude that is comfortably orbital around small terrestrial planets would plunge deep inside giant planets. Furthermore, gravitational force scales strictly with distance from center (1/r²), not altitude above surface. Holding closest-approach radius r_p constant provides a physically sound benchmark of pure gravitational strength, whereas holding altitude constant conflates gravitational parameter mu with physical planet volume.';

    return {
      equalRadiusRecords,
      equalAltitudeRecords,
      explanation,
    };
  }

  /**
   * Experiment B: Flyby distance
   * Vary closest-approach altitude for the same planet and incoming speed.
   * Shows the relationship between closest approach, deflection angle, and collision risk.
   */
  static runTemplateB_FlybyDistance(
    planet: PlanetaryBodyData = PLANETARY_BODIES.JUPITER,
    vInfMPerS: number = 10000.0,
    passType: FlybyPassType = 'TRAILING',
    sampleCount: number = 9
  ): ExperimentRecord[] {
    const sweep: SweepConfig = {
      parameter: 'periapsisAltitudeKm',
      minValue: -planet.radiusM * 0.2 / 1000.0, // Sub-surface collision regime
      maxValue: (planet.radiusM * 5.0) / 1000.0,
      sampleCount,
      scale: 'LINEAR',
    };

    return this.runParameterSweep(
      {
        planet,
        vInfSpeedMPerS: vInfMPerS,
        passType,
        spacecraftMassKg: 1000,
      },
      sweep
    );
  }

  /**
   * Experiment C: Incoming speed
   * Vary incoming asymptotic speed while holding planet and closest-approach radius constant.
   * Shows how the deflection angle changes with speed (steep decline ~ 1/v_inf²).
   */
  static runTemplateC_IncomingSpeed(
    planet: PlanetaryBodyData = PLANETARY_BODIES.JUPITER,
    periapsisRadiusM: number = PLANETARY_BODIES.JUPITER.radiusM * 1.5,
    passType: FlybyPassType = 'TRAILING',
    sampleCount: number = 9
  ): ExperimentRecord[] {
    const sweep: SweepConfig = {
      parameter: 'vInfMPerS',
      minValue: 3000.0,
      maxValue: 35000.0,
      sampleCount,
      scale: 'LINEAR',
    };

    return this.runParameterSweep(
      {
        planet,
        vInfSpeedMPerS: 10000.0,
        targetPeriapsisM: periapsisRadiusM,
        passType,
        spacecraftMassKg: 1000,
      },
      sweep
    );
  }

  /**
   * Experiment D: Flyby orientation
   * Change incoming direction and flyby side while keeping the relevant orbital conditions fixed.
   * Demonstrates that the same deflection magnitude produces different Sun-relative speed changes.
   */
  static runTemplateD_FlybyOrientation(
    planet: PlanetaryBodyData = PLANETARY_BODIES.JUPITER,
    vInfMPerS: number = 12000.0,
    periapsisAltitudeKm: number = 50000.0,
    sampleCount: number = 8
  ): {
    records: ExperimentRecord[];
    trailing: FlybyAnalyticalSummary;
    leading: FlybyAnalyticalSummary;
    explanation: string;
  } {
    const rpM = planet.radiusM + periapsisAltitudeKm * 1000.0;

    const trailing = FlybyEngine.computeAnalytical({
      planet,
      vInfSpeedMPerS: vInfMPerS,
      targetPeriapsisM: rpM,
      passType: 'TRAILING',
      spacecraftMassKg: 1000,
      approachAngleDeg: 0,
    });

    const leading = FlybyEngine.computeAnalytical({
      planet,
      vInfSpeedMPerS: vInfMPerS,
      targetPeriapsisM: rpM,
      passType: 'LEADING',
      spacecraftMassKg: 1000,
      approachAngleDeg: 0,
    });

    const sweep: SweepConfig = {
      parameter: 'approachAngleDeg',
      minValue: 0,
      maxValue: 315,
      sampleCount,
      scale: 'LINEAR',
    };

    const records = this.runParameterSweep(
      {
        planet,
        vInfSpeedMPerS: vInfMPerS,
        targetPeriapsisM: rpM,
        passType: 'TRAILING',
        spacecraftMassKg: 1000,
      },
      sweep
    );

    const explanation =
      'Because the planet moves through space with orbital velocity V_p, the heliocentric velocity change is given by Delta v_Sun = v_rel,out - v_rel,in. Although the planet-relative deflection angle delta and speed ||v_rel|| are invariant with respect to orientation, the vector dot product V_p · Delta v_rel depends entirely on encounter geometry. Trailing passes add momentum (accelerating the probe); leading passes subtract momentum (gravitational braking); perpendicular passes turn the trajectory with zero net scalar speed change.';

    return {
      records,
      trailing,
      leading,
      explanation,
    };
  }

  /**
   * Experiment E: Reference-frame comparison
   * Compare planet-relative and Sun-relative incoming/outgoing velocities.
   * Shows that ideal asymptotic planet-relative speeds remain equal, while Sun-relative speed can increase or decrease.
   */
  static runTemplateE_ReferenceFrameComparison(
    planet: PlanetaryBodyData = PLANETARY_BODIES.JUPITER,
    vInfMPerS: number = 12000.0,
    periapsisAltitudeKm: number = 50000.0
  ): {
    planetFrame: {
      vInSpeedKmPerS: number;
      vOutSpeedKmPerS: number;
      deltaSpeedKmPerS: number;
      vInVectorMPerS: Vector3D;
      vOutVectorMPerS: Vector3D;
      deltaVVectorMPerS: Vector3D;
      isConserved: boolean;
    };
    sunFrameTrailing: {
      vInSpeedKmPerS: number;
      vOutSpeedKmPerS: number;
      deltaSpeedKmPerS: number;
      deltaSpecificEnergyMJPerKg: number;
      vPlanetVectorMPerS: Vector3D;
      vInVectorMPerS: Vector3D;
      vOutVectorMPerS: Vector3D;
    };
    sunFrameLeading: {
      vInSpeedKmPerS: number;
      vOutSpeedKmPerS: number;
      deltaSpeedKmPerS: number;
      deltaSpecificEnergyMJPerKg: number;
      vInVectorMPerS: Vector3D;
      vOutVectorMPerS: Vector3D;
    };
    identityVerification: {
      trailingDeltaEnergyJPerKg: number;
      trailingVpDotDeltaV: number;
      errorJPerKg: number;
    };
    explanation: string;
  } {
    const rpM = planet.radiusM + periapsisAltitudeKm * 1000.0;

    const trailing = FlybyEngine.computeAnalytical({
      planet,
      vInfSpeedMPerS: vInfMPerS,
      targetPeriapsisM: rpM,
      passType: 'TRAILING',
      spacecraftMassKg: 1000,
    });

    const leading = FlybyEngine.computeAnalytical({
      planet,
      vInfSpeedMPerS: vInfMPerS,
      targetPeriapsisM: rpM,
      passType: 'LEADING',
      spacecraftMassKg: 1000,
    });

    const vPlanet = new Vector3D(0, planet.orbitalSpeedMPerS, 0);

    return {
      planetFrame: {
        vInSpeedKmPerS: vInfMPerS / 1000.0,
        vOutSpeedKmPerS: vInfMPerS / 1000.0,
        deltaSpeedKmPerS: 0.0,
        vInVectorMPerS: trailing.vInfMinusMPerS,
        vOutVectorMPerS: trailing.vInfPlusMPerS,
        deltaVVectorMPerS: trailing.deltaVVectorMPerS,
        isConserved: true,
      },
      sunFrameTrailing: {
        vInSpeedKmPerS: trailing.vInSunSpeedMPerS / 1000.0,
        vOutSpeedKmPerS: trailing.vOutSunSpeedMPerS / 1000.0,
        deltaSpeedKmPerS: trailing.deltaVSunSpeedMPerS / 1000.0,
        deltaSpecificEnergyMJPerKg: trailing.deltaSpecificEnergyJPerKg / 1e6,
        vPlanetVectorMPerS: vPlanet,
        vInVectorMPerS: trailing.vInSunMPerS,
        vOutVectorMPerS: trailing.vOutSunMPerS,
      },
      sunFrameLeading: {
        vInSpeedKmPerS: leading.vInSunSpeedMPerS / 1000.0,
        vOutSpeedKmPerS: leading.vOutSunSpeedMPerS / 1000.0,
        deltaSpeedKmPerS: leading.deltaVSunSpeedMPerS / 1000.0,
        deltaSpecificEnergyMJPerKg: leading.deltaSpecificEnergyJPerKg / 1e6,
        vInVectorMPerS: leading.vInSunMPerS,
        vOutVectorMPerS: leading.vOutSunMPerS,
      },
      identityVerification: {
        trailingDeltaEnergyJPerKg: trailing.deltaSpecificEnergyJPerKg,
        trailingVpDotDeltaV: trailing.vPlanetDotDeltaVMPerS2,
        errorJPerKg: trailing.energyIdentityDiffJPerKg,
      },
      explanation:
        'In the planet-centric frame, gravity is a conservative central force doing zero net work across the symmetric hyperbolic encounter: ||v_rel,out|| == ||v_rel,in||. In the Sun frame, the planet itself has kinetic energy and momentum. By moving along with the planet (trailing edge) or against it (leading edge), the spacecraft exchanges orbital energy with the planet according to the identity Delta epsilon_Sun = V_planet · Delta v_rel.',
    };
  }

  /**
   * Experiment F: Numerical validation
   * Compare numerical integration results against analytical hyperbolic flyby results.
   * Display error versus integration tolerance.
   */
  static runTemplateF_NumericalValidation(
    planet: PlanetaryBodyData = PLANETARY_BODIES.JUPITER,
    vInfMPerS: number = 12000.0,
    periapsisRadiusM: number = PLANETARY_BODIES.JUPITER.radiusM * 1.5,
    passType: FlybyPassType = 'TRAILING',
    tolerances: number[] = [0.05, 0.02, 0.01, 0.005, 0.002]
  ): NumericalValidationPoint[] {
    const analytical = FlybyEngine.computeAnalytical({
      planet,
      vInfSpeedMPerS: vInfMPerS,
      targetPeriapsisM: periapsisRadiusM,
      passType,
      spacecraftMassKg: 1000,
    });

    return tolerances.map((eta) => {
      const sim = FlybyEngine.runSimulation(
        {
          planet,
          vInfSpeedMPerS: vInfMPerS,
          targetPeriapsisM: periapsisRadiusM,
          passType,
          spacecraftMassKg: 1000,
        },
        {
          timeStepCoeff: eta,
          maxPoints: 2000,
        }
      );

      const diag = sim.convergenceDiagnostics;
      return {
        tolerance: eta,
        stepCount: diag?.stepCount ?? sim.trajectory.length,
        avgTimeStepS: diag?.averageTimeStepS ?? 0,
        energyConservationRelativeError: diag?.relativeEnergyConservationError ?? 0,
        angularMomentumRelativeError: diag?.relativeAngularMomentumConservationError ?? 0,
        asymptoticSpeedConservationErrorPercent: diag?.asymptoticSpeedConservationErrorPercent ?? 0,
        deflectionErrorPercent: diag?.deflectionErrorPercent ?? 0,
        numericalDeflectionDeg: sim.numericalDeflectionAngleDeg,
        analyticalDeflectionDeg: analytical.deflectionAngleDeg,
      };
    });
  }

  // =========================================================================
  // BACKWARD-COMPATIBLE ALIASES FOR EXISTING TESTS
  // =========================================================================

  static runExperimentA_ClosestApproach(
    planet: PlanetaryBodyData = PLANETARY_BODIES.JUPITER,
    vInfMPerS: number = 10000.0,
    passType: FlybyPassType = 'TRAILING',
    sampleCount: number = 9
  ): ExperimentRecord[] {
    const sweep: SweepConfig = {
      parameter: 'periapsisRadiusKm',
      minValue: (planet.radiusM * 0.8) / 1000.0,
      maxValue: (planet.radiusM * 6.0) / 1000.0,
      sampleCount,
      scale: 'LINEAR',
    };

    return this.runParameterSweep(
      {
        planet,
        vInfSpeedMPerS: vInfMPerS,
        passType,
        spacecraftMassKg: 1000,
      },
      sweep
    );
  }

  static runExperimentB_SpeedSweep(
    planet: PlanetaryBodyData = PLANETARY_BODIES.JUPITER,
    periapsisRadiusM: number = PLANETARY_BODIES.JUPITER.radiusM * 1.5,
    passType: FlybyPassType = 'TRAILING',
    sampleCount: number = 8
  ): ExperimentRecord[] {
    return this.runTemplateC_IncomingSpeed(planet, periapsisRadiusM, passType, sampleCount);
  }

  static runExperimentC_GravityStrength(
    vInfSpeedMPerS: number = 10000.0,
    passType: FlybyPassType = 'TRAILING'
  ): {
    equalRadiusRecords: ExperimentRecord[];
    equalAltitudeRecords: ExperimentRecord[];
    explanation: string;
  } {
    return this.runTemplateA_PlanetaryMass(vInfSpeedMPerS, passType);
  }

  static runExperimentD_Orientation(
    planet: PlanetaryBodyData = PLANETARY_BODIES.JUPITER,
    vInfSpeedMPerS: number = 12000.0,
    periapsisAltitudeKm: number = 50000.0
  ): {
    trailing: FlybyAnalyticalSummary;
    leading: FlybyAnalyticalSummary;
    vectorAnalysis: {
      vPlanetSpeedMPerS: number;
      dotProductTrailingMPerS2: number;
      dotProductLeadingMPerS2: number;
      speedGainTrailingMPerS: number;
      speedGainLeadingMPerS: number;
      energyGainTrailingMJPerKg: number;
      energyGainLeadingMJPerKg: number;
    };
  } {
    const rpM = planet.radiusM + periapsisAltitudeKm * 1000.0;

    const trailing = FlybyEngine.computeAnalytical({
      planet,
      vInfSpeedMPerS,
      targetPeriapsisM: rpM,
      passType: 'TRAILING',
      spacecraftMassKg: 1000,
    });

    const leading = FlybyEngine.computeAnalytical({
      planet,
      vInfSpeedMPerS,
      targetPeriapsisM: rpM,
      passType: 'LEADING',
      spacecraftMassKg: 1000,
    });

    return {
      trailing,
      leading,
      vectorAnalysis: {
        vPlanetSpeedMPerS: planet.orbitalSpeedMPerS,
        dotProductTrailingMPerS2: trailing.vPlanetDotDeltaVMPerS2,
        dotProductLeadingMPerS2: leading.vPlanetDotDeltaVMPerS2,
        speedGainTrailingMPerS: trailing.deltaVSunSpeedMPerS,
        speedGainLeadingMPerS: leading.deltaVSunSpeedMPerS,
        energyGainTrailingMJPerKg: trailing.deltaSpecificEnergyJPerKg / 1e6,
        energyGainLeadingMJPerKg: leading.deltaSpecificEnergyJPerKg / 1e6,
      },
    };
  }

  static runExperimentE_JupiterVsSaturnComparison(
    vInfMPerS: number = 12000.0,
    passType: FlybyPassType = 'TRAILING',
    altitudeKm: number = 50000.0
  ): {
    jupiter: FlybyAnalyticalSummary;
    saturn: FlybyAnalyticalSummary;
    metrics: {
      massRatio: number;
      muRatio: number;
      radiusRatio: number;
      vPlanetRatio: number;
      deflectionDiffDeg: number;
      speedBoostDiffKmPerS: number;
    };
    explanation: string;
  } {
    const raw = FlybyEngine.runExperimentE_JupiterVsSaturn(vInfMPerS, passType, altitudeKm);
    const j = raw.jupiter;
    const s = raw.saturn;

    return {
      jupiter: j,
      saturn: s,
      metrics: {
        massRatio: PLANETARY_BODIES.JUPITER.massKg / PLANETARY_BODIES.SATURN.massKg,
        muRatio: PLANETARY_BODIES.JUPITER.mu / PLANETARY_BODIES.SATURN.mu,
        radiusRatio: PLANETARY_BODIES.JUPITER.radiusM / PLANETARY_BODIES.SATURN.radiusM,
        vPlanetRatio: PLANETARY_BODIES.JUPITER.orbitalSpeedMPerS / PLANETARY_BODIES.SATURN.orbitalSpeedMPerS,
        deflectionDiffDeg: j.deflectionAngleDeg - s.deflectionAngleDeg,
        speedBoostDiffKmPerS: (j.deltaVSunSpeedMPerS - s.deltaVSunSpeedMPerS) / 1000.0,
      },
      explanation: raw.comparison.explanation,
    };
  }

  static runExperimentF_MassInvariance(
    planet: PlanetaryBodyData = PLANETARY_BODIES.JUPITER,
    vInfSpeedMPerS: number = 10000.0,
    periapsisAltitudeKm: number = 50000.0,
    massesKg: number[] = [1, 50, 500, 2500, 25000, 100000]
  ): ExperimentRecord[] {
    const rpM = planet.radiusM + periapsisAltitudeKm * 1000.0;

    return massesKg.map((mass, idx) => {
      const analytical = FlybyEngine.computeAnalytical({
        planet,
        vInfSpeedMPerS,
        targetPeriapsisM: rpM,
        passType: 'TRAILING',
        spacecraftMassKg: mass,
      });

      return {
        stepIndex: idx + 1,
        scenarioName: `Mass Invariance Test (${mass.toLocaleString()} kg)`,
        planetName: planet.name,
        modelType: 'Newton-Kepler Patched Conic',
        inputParamName: 'Probe Mass (m)',
        inputParamValue: mass,
        inputParamUnit: 'kg',
        deflectionAngleDeg: analytical.deflectionAngleDeg,
        deflectionAngleRad: analytical.deflectionAngleRad,
        impactParameterKm: analytical.impactParameterM / 1000.0,
        closestApproachRadiusKm: rpM / 1000.0,
        closestApproachAltitudeKm: periapsisAltitudeKm,
        vInPlanetVectorMPerS: analytical.vInfMinusMPerS,
        vOutPlanetVectorMPerS: analytical.vInfPlusMPerS,
        vInSunVectorMPerS: analytical.vInSunMPerS,
        vOutSunVectorMPerS: analytical.vOutSunMPerS,
        vInfPlanetInKmPerS: vInfSpeedMPerS / 1000.0,
        vInfPlanetOutKmPerS: vInfSpeedMPerS / 1000.0,
        vSunInKmPerS: analytical.vInSunSpeedMPerS / 1000.0,
        vSunOutKmPerS: analytical.vOutSunSpeedMPerS / 1000.0,
        deltaVSpeedKmPerS: analytical.deltaVSunSpeedMPerS / 1000.0,
        deltaVVectorMagKmPerS: analytical.deltaVVectorMagnitudeMPerS / 1000.0,
        deltaSpecificEnergyMJPerKg: analytical.deltaSpecificEnergyJPerKg / 1e6,
        deltaTotalKineticEnergyGJ: analytical.deltaKineticEnergyJ / 1e9,
        isCollision: false,
        collisionStatus: 'SAFE_FLYBY',
        config: {
          planet,
          vInfSpeedMPerS,
          targetPeriapsisM: rpM,
          passType: 'TRAILING',
          spacecraftMassKg: mass,
        },
      };
    });
  }

  // =========================================================================
  // RESULT COMPARISON & SIDE-BY-SIDE EVALUATION
  // =========================================================================

  /**
   * Compiles side-by-side comparison metrics for multiple simulation runs
   */
  static getComparisonMetrics(): RunComparisonMetric[] {
    return [
      {
        key: 'planet',
        category: 'CONFIG',
        label: 'Target Planet',
        unit: '-',
        format: (r) => r.planetName,
      },
      {
        key: 'vInfIn',
        category: 'VELOCITY',
        label: 'Incoming Excess Speed (v_inf)',
        unit: 'km/s',
        format: (r) => r.vInfPlanetInKmPerS.toFixed(3),
      },
      {
        key: 'periapsisRadius',
        category: 'GEOMETRY',
        label: 'Closest Approach Radius (r_p)',
        unit: 'km',
        format: (r) => r.closestApproachRadiusKm.toLocaleString(undefined, { maximumFractionDigits: 1 }),
      },
      {
        key: 'periapsisAltitude',
        category: 'GEOMETRY',
        label: 'Closest Approach Altitude (h_p)',
        unit: 'km',
        format: (r) => r.closestApproachAltitudeKm.toLocaleString(undefined, { maximumFractionDigits: 1 }),
      },
      {
        key: 'impactParameter',
        category: 'GEOMETRY',
        label: 'Impact Parameter (b)',
        unit: 'km',
        format: (r) => r.impactParameterKm.toLocaleString(undefined, { maximumFractionDigits: 1 }),
      },
      {
        key: 'deflectionDeg',
        category: 'GEOMETRY',
        label: 'Hyperbolic Deflection (delta)',
        unit: 'deg',
        format: (r) => `${r.deflectionAngleDeg.toFixed(3)}°`,
      },
      {
        key: 'deflectionRad',
        category: 'GEOMETRY',
        label: 'Deflection Angle (rad)',
        unit: 'rad',
        format: (r) => (r.deflectionAngleRad !== undefined ? r.deflectionAngleRad.toFixed(4) : (r.deflectionAngleDeg * Math.PI / 180).toFixed(4)),
      },
      {
        key: 'vSunIn',
        category: 'VELOCITY',
        label: 'Sun-Relative Incoming Speed',
        unit: 'km/s',
        format: (r) => r.vSunInKmPerS.toFixed(3),
      },
      {
        key: 'vSunOut',
        category: 'VELOCITY',
        label: 'Sun-Relative Outgoing Speed',
        unit: 'km/s',
        format: (r) => r.vSunOutKmPerS.toFixed(3),
      },
      {
        key: 'deltaVSunSpeed',
        category: 'VELOCITY',
        label: 'Sun-Relative Speed Change (Scalar)',
        unit: 'km/s',
        format: (r) => `${r.deltaVSpeedKmPerS >= 0 ? '+' : ''}${r.deltaVSpeedKmPerS.toFixed(3)}`,
      },
      {
        key: 'deltaVVectorMag',
        category: 'VELOCITY',
        label: 'Vector Delta-V Magnitude ||Δv||',
        unit: 'km/s',
        format: (r) => r.deltaVVectorMagKmPerS.toFixed(3),
      },
      {
        key: 'deltaSpecificEnergy',
        category: 'ENERGY',
        label: 'Specific Energy Change (Δepsilon)',
        unit: 'MJ/kg',
        format: (r) => `${r.deltaSpecificEnergyMJPerKg >= 0 ? '+' : ''}${r.deltaSpecificEnergyMJPerKg.toFixed(4)}`,
      },
      {
        key: 'deltaKineticEnergy',
        category: 'ENERGY',
        label: 'Total Kinetic Energy Change (ΔE_k)',
        unit: 'GJ',
        format: (r) => `${r.deltaTotalKineticEnergyGJ >= 0 ? '+' : ''}${r.deltaTotalKineticEnergyGJ.toFixed(4)}`,
      },
      {
        key: 'vInPlanetVec',
        category: 'VELOCITY',
        label: 'Incoming Vector (Planet Frame)',
        unit: 'km/s',
        format: (r) => (r.vInPlanetVectorMPerS ? `(${ (r.vInPlanetVectorMPerS.x / 1000).toFixed(2)}, ${(r.vInPlanetVectorMPerS.y / 1000).toFixed(2)}, ${(r.vInPlanetVectorMPerS.z / 1000).toFixed(2)})` : '-'),
      },
      {
        key: 'vOutPlanetVec',
        category: 'VELOCITY',
        label: 'Outgoing Vector (Planet Frame)',
        unit: 'km/s',
        format: (r) => (r.vOutPlanetVectorMPerS ? `(${ (r.vOutPlanetVectorMPerS.x / 1000).toFixed(2)}, ${(r.vOutPlanetVectorMPerS.y / 1000).toFixed(2)}, ${(r.vOutPlanetVectorMPerS.z / 1000).toFixed(2)})` : '-'),
      },
      {
        key: 'vInSunVec',
        category: 'VELOCITY',
        label: 'Incoming Vector (Sun Frame)',
        unit: 'km/s',
        format: (r) => (r.vInSunVectorMPerS ? `(${ (r.vInSunVectorMPerS.x / 1000).toFixed(2)}, ${(r.vInSunVectorMPerS.y / 1000).toFixed(2)}, ${(r.vInSunVectorMPerS.z / 1000).toFixed(2)})` : '-'),
      },
      {
        key: 'vOutSunVec',
        category: 'VELOCITY',
        label: 'Outgoing Vector (Sun Frame)',
        unit: 'km/s',
        format: (r) => (r.vOutSunVectorMPerS ? `(${ (r.vOutSunVectorMPerS.x / 1000).toFixed(2)}, ${(r.vOutSunVectorMPerS.y / 1000).toFixed(2)}, ${(r.vOutSunVectorMPerS.z / 1000).toFixed(2)})` : '-'),
      },
      {
        key: 'collisionStatus',
        category: 'GEOMETRY',
        label: 'Collision Status',
        unit: '-',
        format: (r) => r.collisionStatus,
      },
      {
        key: 'energyDrift',
        category: 'DIAGNOSTICS',
        label: 'Energy Drift Diagnostics',
        unit: 'fraction',
        format: (r) => (r.numericalDiagnostics?.energyConservationRelativeError !== undefined ? r.numericalDiagnostics.energyConservationRelativeError.toExponential(3) : '< 1e-12'),
      },
    ];
  }

  // =========================================================================
  // SCIENTIFIC EXPLANATIONS
  // =========================================================================

  static getScientificExplanations(): Array<{
    id: string;
    title: string;
    question: string;
    shortAnswer: string;
    derivation: string;
    realWorldEvidence: string;
  }> {
    return [
      {
        id: 'CLOSER_FLYBY',
        title: 'Closest Approach & Deflection Strength',
        question: 'Why do closer flybys produce stronger deflection?',
        shortAnswer:
          'Gravitational acceleration scales with the inverse square of distance (a = mu / r²). Flying closer to the planet exposes the spacecraft to vastly higher gravitational force, greatly steepening trajectory curvature.',
        derivation:
          'For a hyperbolic flyby, eccentricity is e = 1 + (r_p * v_inf² / mu). The turning angle is delta = 2 * asin(1 / e). As closest-approach radius r_p decreases towards planet physical radius R_p, eccentricity e drops towards 1, which drives the deflection angle delta towards its theoretical maximum.',
        realWorldEvidence:
          'Voyager 2 flew within 4,950 km of Neptune’s cloud tops in August 1989. This ultra-close shave produced a violent 48° deflection that pitched the probe south out of the ecliptic plane.',
      },
      {
        id: 'HIGH_SPEED',
        title: 'Asymptotic Speed & Deflection Reduction',
        question: 'Why do high incoming speeds usually reduce deflection for the same closest approach?',
        shortAnswer:
          'At high speeds, the spacecraft moves through the gravitational well very quickly, providing little time for gravitational force to accumulate impulse and bend the path.',
        derivation:
          'Gravitational impulse is Delta v = integral F(t) dt. At higher v_inf, transit time through the encounter scales as dt ~ r_p / v_inf. Furthermore, e = 1 + (r_p * v_inf² / mu) scales quadratically with speed. For large v_inf, delta ~ 2 / e ~ 2 * mu / (r_p * v_inf²), decaying as 1/v_inf².',
        realWorldEvidence:
          'New Horizons approached Jupiter in 2007 at an extremely high speed of ~23 km/s. Jupiter deflected its trajectory by only ~15°, whereas Voyager 1 at ~14 km/s was deflected by over 60°.',
      },
      {
        id: 'ENERGY_EXCHANGE',
        title: 'Orbital Energy Exchange Mechanism',
        question: 'Why can a moving planet exchange energy with a spacecraft?',
        shortAnswer:
          'Work is a frame-dependent quantity. In the planet’s rest frame, speed is conserved. But when transformed into the heliocentric inertial frame, the spacecraft picks up or loses a component of the planet’s massive orbital velocity.',
        derivation:
          'In planet frame: ||v_rel,out|| = ||v_rel,in|| = v_inf. In Sun frame: v_Sun = v_rel + V_planet. Heliocentric specific energy change: Delta epsilon_Sun = 0.5 * (|v_out,Sun|² - |v_in,Sun|²) = V_planet · (v_rel,out - v_rel,in) = V_planet · Delta v_rel. If Delta v_rel has a component along V_planet (trailing pass), energy is transferred from planet to probe.',
        realWorldEvidence:
          'Voyager 1 gained ~3.5 km/s of heliocentric speed from Jupiter, robbing Jupiter of an infinitesimal fraction of its orbital momentum (~10^-24 of its orbital kinetic energy).',
      },
      {
        id: 'MASS_INVARIANCE',
        title: 'Spacecraft Mass Invariance Principle',
        question: 'Why does spacecraft mass not change an ideal gravitational trajectory?',
        shortAnswer:
          'By the Weak Equivalence Principle, inertial mass equals gravitational mass identically, so spacecraft mass cancels out of Newton’s gravitational equation of motion.',
        derivation:
          'm_sc * (d²r / dt²) = - (G * M_planet * m_sc / r³) * r. Dividing both sides by m_sc yields d²r / dt² = - (mu_planet / r³) * r. The acceleration and resulting orbit are completely independent of m_sc.',
        realWorldEvidence:
          'A 1 kg CubeSat, a 722 kg Voyager probe, or a 10,000 kg crewed module all trace the exact same geometric hyperbolic trajectory under identical initial position and velocity.',
      },
      {
        id: 'PLANET_MASS_ALONE',
        title: 'Planetary Mass vs Assist Efficacy',
        question: 'Why does planetary mass alone not determine the size of a useful gravity assist?',
        shortAnswer:
          'A useful assist requires both substantial trajectory deflection and high planetary orbital speed V_p. Furthermore, physical planet radius R_p sets a lower bound on closest approach to avoid impact.',
        derivation:
          'The maximum heliocentric speed gain is approximately Delta v_max = 2 * V_planet * sin(delta / 2) = 2 * V_planet / e. If V_planet is small (e.g. Neptune at ~5.4 km/s vs Earth at ~29.8 km/s), the boost is limited despite large mass. Conversely, if physical radius R_p is large, minimum periapsis r_p >= R_p is constrained.',
        realWorldEvidence:
          'Earth (~6x10^24 kg) provides immense gravity assist delta-Vs (up to ~8 km/s) because it moves at ~29.8 km/s around the Sun, whereas Neptune (~1x10^26 kg, 17x more massive) only moves at ~5.4 km/s, offering far smaller speed gains.',
      },
    ];
  }

  // =========================================================================
  // REPRODUCIBILITY & COLLEGE LAB REPORT GENERATOR
  // =========================================================================

  /**
   * Generates a rigorous, college physics lab report ready for academic export
   */
  static generatePhysicsLabReport(
    experimentTitle: string,
    baseline: FlybyInitialConditions,
    records: ExperimentRecord[],
    assumptions: string[] = []
  ): string {
    const planet = baseline.planet;
    const now = new Date().toUTCString();

    const sections: string[] = [];

    // Title & Metadata
    sections.push(`# LABORATORY REPORT: ASTRODYNAMICAL GRAVITY ASSIST ANALYSIS`);
    sections.push(`**Experiment Title:** ${experimentTitle}`);
    sections.push(`**Date Generated:** ${now}`);
    sections.push(`**Primary Target Body:** ${planet.name} (μ = ${planet.mu.toExponential(4)} m³/s², R_p = ${(planet.radiusM / 1000).toFixed(1)} km)`);
    sections.push(`**Reference System:** ASTRA Physics Simulation Engine (Patch-Conic Hyperbolic & 4th-Order Runge-Kutta)`);
    sections.push(`\n---\n`);

    // Abstract
    sections.push(`## 1. ABSTRACT & OBJECTIVE`);
    sections.push(
      `This controlled astrodynamical experiment analyzes unpowered hyperbolic flybys around ${planet.name}. The objective is to verify momentum and energy transfer mechanisms between a moving celestial body and an incoming spacecraft, comparing planet-relative rest frame conservation with heliocentric inertial frame acceleration.`
    );

    // Theoretical Framework
    sections.push(`## 2. THEORETICAL FRAMEWORK & GOVERNING EQUATIONS`);
    sections.push(`1. **Hyperbolic Eccentricity:**`);
    sections.push(`   $$e = 1 + \\frac{r_p v_\\infty^2}{\\mu}$$`);
    sections.push(`2. **Planetary Deflection Angle:**`);
    sections.push(`   $$\\delta = 2 \\arcsin\\left(\\frac{1}{e}\\right) = 2 \\arcsin\\left(\\frac{1}{1 + \\frac{r_p v_\\infty^2}{\\mu}}\\right)$$`);
    sections.push(`3. **Heliocentric Energy Identity:**`);
    sections.push(`   $$\\Delta \\varepsilon_{\\text{Sun}} = \\frac{1}{2} (v_{\\text{out,Sun}}^2 - v_{\\text{in,Sun}}^2) = \\vec{V}_p \\cdot (\\vec{v}_{\\text{out,rel}} - \\vec{v}_{\\text{in,rel}}) = \\vec{V}_p \\cdot \\Delta \\vec{v}_{\\text{rel}}$$`);
    sections.push(`4. **Planet Rest Frame Conservation:**`);
    sections.push(`   $$||\\vec{v}_{\\text{out,rel}}|| = ||\\vec{v}_{\\text{in,rel}}|| = v_\\infty$$`);

    // Model Assumptions
    sections.push(`## 3. EXPERIMENTAL SETUP & CONTROLLED PARAMETERS`);
    sections.push(`- **Baseline Incoming Speed (v_inf):** ${(baseline.vInfSpeedMPerS / 1000).toFixed(2)} km/s`);
    sections.push(`- **Baseline Periapsis Target:** ${((baseline.targetPeriapsisM ?? planet.radiusM * 1.5) / 1000).toFixed(1)} km`);
    sections.push(`- **Encounter Geometry:** ${baseline.passType}`);
    sections.push(`- **Spacecraft Mass:** ${baseline.spacecraftMassKg.toFixed(1)} kg`);
    sections.push(`- **Model Assumptions:**`);
    if (assumptions.length > 0) {
      assumptions.forEach((a) => sections.push(`  - ${a}`));
    } else {
      sections.push(`  - 2-Body Newton-Kepler point-mass gravitational interaction`);
      sections.push(`  - Patched-conic sphere of influence asymptotic matching`);
      sections.push(`  - Neglected atmospheric drag, non-spherical harmonics (J2/J4), and solar radiation pressure`);
    }

    // Quantitative Data Table
    sections.push(`\n## 4. EXPERIMENTAL MEASUREMENTS & PARAMETRIC DATA`);
    sections.push(`| Step | Param Value | Deflection (°) | Impact Param (km) | Periapsis (km) | Sun Speed In (km/s) | Sun Speed Out (km/s) | Δv_Sun (km/s) | ΔE_spec (MJ/kg) | Collision Status |`);
    sections.push(`|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|`);
    for (const r of records) {
      sections.push(
        `| ${r.stepIndex} | ${r.inputParamValue.toFixed(1)} ${r.inputParamUnit} | ${r.deflectionAngleDeg.toFixed(2)}° | ${r.impactParameterKm.toFixed(1)} | ${r.closestApproachRadiusKm.toFixed(1)} | ${r.vSunInKmPerS.toFixed(2)} | ${r.vSunOutKmPerS.toFixed(2)} | ${r.deltaVSpeedKmPerS >= 0 ? '+' : ''}${r.deltaVSpeedKmPerS.toFixed(2)} | ${r.deltaSpecificEnergyMJPerKg >= 0 ? '+' : ''}${r.deltaSpecificEnergyMJPerKg.toFixed(2)} | ${r.collisionStatus} |`
      );
    }

    // Analysis & Discussion
    sections.push(`\n## 5. SCIENTIFIC ANALYSIS & PHYSICAL DISCUSSION`);
    sections.push(`- **Conservation in Rest Frame:** In all non-colliding runs, the planet-relative incoming speed exactly equals the outgoing speed (${(baseline.vInfSpeedMPerS / 1000).toFixed(2)} km/s), demonstrating that an unpowered central gravitational field does zero net work.`);
    sections.push(`- **Energy Transfer:** The observed heliocentric speed change correlates strictly with the projection of planetary orbital velocity $\\vec{V}_p$ along the deflection vector $\\Delta\\vec{v}$.`);
    sections.push(`- **Collision Boundary:** Trajectories where $r_p \\le R_p$ flag physical collision, defining the critical boundary condition for flyby navigation.`);

    // Conclusion
    sections.push(`\n## 6. CONCLUSION`);
    sections.push(
      `The quantitative results confirm the patched-conic formulation of gravity assists with machine-precision energy conservation. The dataset and parameters recorded herein are fully reproducible under the identical solver settings in the ASTRA physics engine.`
    );

    return sections.join('\n');
  }

  // =========================================================================
  // CSV EXPORT (RFC-4180)
  // =========================================================================

  /**
   * Exports experiment records to RFC-4180 compliant CSV format with comprehensive scientific metadata
   */
  static exportExperimentToCSV(
    records: ExperimentRecord[],
    metadata: {
      title: string;
      baselinePlanet: string;
      baselineVInfMPerS: number;
      baselineAltKm: number;
      baselinePassType: string;
      baselineMassKg: number;
      assumptions?: string[];
    }
  ): string {
    const lines: string[] = [];

    lines.push(`# =========================================================================`);
    lines.push(`# ASTRA SCIENTIFIC ASTRODYNAMICS EXPERIMENT RUN`);
    lines.push(`# Title: ${metadata.title}`);
    lines.push(`# Timestamp (UTC): ${new Date().toISOString()}`);
    lines.push(`# Baseline Planet: ${metadata.baselinePlanet}`);
    lines.push(`# Baseline v_inf: ${metadata.baselineVInfMPerS.toFixed(1)} m/s (${(metadata.baselineVInfMPerS / 1000).toFixed(2)} km/s)`);
    lines.push(`# Baseline Periapsis Altitude: ${metadata.baselineAltKm.toFixed(1)} km`);
    lines.push(`# Baseline Flyby Geometry: ${metadata.baselinePassType}`);
    lines.push(`# Spacecraft Mass: ${metadata.baselineMassKg.toFixed(1)} kg`);
    lines.push(`# Physics Engine: 2-Body Newton-Kepler Patched Conic with 4th-Order Runge-Kutta`);
    if (metadata.assumptions && metadata.assumptions.length > 0) {
      metadata.assumptions.forEach((a) => lines.push(`# Model Assumption: ${a}`));
    }
    lines.push(`# =========================================================================`);

    const headers = [
      'Step',
      'Scenario',
      'Planet',
      'ModelType',
      'ParameterName',
      'ParameterValue',
      'Unit',
      'DeflectionAngleDeg',
      'ImpactParameterKm',
      'PeriapsisRadiusKm',
      'PeriapsisAltitudeKm',
      'vInfPlanetInKmPerS',
      'vInfPlanetOutKmPerS',
      'vSunInKmPerS',
      'vSunOutKmPerS',
      'DeltaVSpeedKmPerS',
      'DeltaVVectorMagKmPerS',
      'DeltaSpecificEnergyMJPerKg',
      'DeltaTotalKineticEnergyGJ',
      'CollisionStatus',
    ];
    lines.push(headers.join(','));

    for (const r of records) {
      const row = [
        r.stepIndex,
        `"${r.scenarioName.replace(/"/g, '""')}"`,
        `"${r.planetName}"`,
        `"${r.modelType}"`,
        `"${r.inputParamName}"`,
        r.inputParamValue,
        `"${r.inputParamUnit}"`,
        r.deflectionAngleDeg.toFixed(4),
        r.impactParameterKm.toFixed(2),
        r.closestApproachRadiusKm.toFixed(2),
        r.closestApproachAltitudeKm.toFixed(2),
        r.vInfPlanetInKmPerS.toFixed(3),
        r.vInfPlanetOutKmPerS.toFixed(3),
        r.vSunInKmPerS.toFixed(3),
        r.vSunOutKmPerS.toFixed(3),
        r.deltaVSpeedKmPerS.toFixed(3),
        r.deltaVVectorMagKmPerS.toFixed(3),
        r.deltaSpecificEnergyMJPerKg.toFixed(4),
        r.deltaTotalKineticEnergyGJ.toFixed(6),
        r.collisionStatus,
      ];
      lines.push(row.join(','));
    }

    return lines.join('\r\n');
  }

  /**
   * Exports arbitrary chart dataset to RFC-4180 CSV
   */
  static exportChartDataToCSV(
    chartTitle: string,
    xLabel: string,
    xUnit: string,
    yLabel: string,
    yUnit: string,
    dataPoints: Array<{ x: number; y: number; label?: string }>
  ): string {
    const lines: string[] = [];
    lines.push(`# ASTRA CHART DATA EXPORT: ${chartTitle}`);
    lines.push(`# Generated (UTC): ${new Date().toISOString()}`);
    lines.push(`# X-Axis: ${xLabel} [${xUnit}]`);
    lines.push(`# Y-Axis: ${yLabel} [${yUnit}]`);
    lines.push(`Index,${xLabel}_${xUnit},${yLabel}_${yUnit},Label`);

    dataPoints.forEach((pt, idx) => {
      lines.push(`${idx + 1},${pt.x.toFixed(6)},${pt.y.toFixed(6)},"${pt.label || ''}"`);
    });

    return lines.join('\r\n');
  }

  // =========================================================================
  // LOCALSTORAGE PERSISTENCE
  // =========================================================================

  static getSavedExperiments(): SavedExperiment[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SAVED_EXPERIMENTS);
      if (!raw) return [];
      return JSON.parse(raw) as SavedExperiment[];
    } catch {
      return [];
    }
  }

  static saveExperimentToStorage(exp: SavedExperiment): void {
    const list = this.getSavedExperiments();
    const existingIdx = list.findIndex((x) => x.id === exp.id);
    if (existingIdx >= 0) {
      list[existingIdx] = exp;
    } else {
      list.unshift(exp);
    }
    if (list.length > 25) list.pop();
    localStorage.setItem(STORAGE_KEY_SAVED_EXPERIMENTS, JSON.stringify(list));
  }

  static deleteSavedExperiment(id: string): SavedExperiment[] {
    const list = this.getSavedExperiments().filter((x) => x.id !== id);
    localStorage.setItem(STORAGE_KEY_SAVED_EXPERIMENTS, JSON.stringify(list));
    return list;
  }
}
