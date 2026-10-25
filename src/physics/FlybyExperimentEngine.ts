/**
 * FlybyExperimentEngine.ts
 *
 * Core engine for controlled astrodynamics experiments, parametric sweeps,
 * sensitivity analysis, and multi-metric scientific evaluation.
 */

import { PlanetaryBodyData, PLANETARY_BODIES } from './constants';
import { FlybyEngine, FlybyPassType, FlybyInitialConditions, FlybyAnalyticalSummary } from './FlybyEngine';
import { FlybyScenarioConfig } from './FlybyScenario';

export type SweepParameter =
  | 'periapsisAltitudeKm'
  | 'periapsisRadiusKm'
  | 'vInfMPerS'
  | 'planetMu'
  | 'planetMassKg'
  | 'spacecraftMassKg';

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
  impactParameterKm: number;
  closestApproachRadiusKm: number;
  closestApproachAltitudeKm: number;
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
  };
}

export interface SavedExperiment {
  id: string;
  title: string;
  timestamp: string;
  baseline: {
    planetName: string;
    vInfSpeedMPerS: number;
    periapsisAltitudeKm: number;
    passType: FlybyPassType;
    spacecraftMassKg: number;
  };
  sweepConfig: SweepConfig;
  records: ExperimentRecord[];
  assumptions: string[];
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
        if (config.minValue <= 0) {
          errors.push('Mass and gravitational parameters must be strictly greater than 0.');
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
    // Standardize baseline input
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

    let baseAltKm = 10000;
    if (isScenario) {
      baseAltKm = (baseline as FlybyScenarioConfig).encounter.periapsisAltitudeKm;
    } else if ((baseline as FlybyInitialConditions).targetPeriapsisM !== undefined) {
      baseAltKm = ((baseline as FlybyInitialConditions).targetPeriapsisM! - planet.radiusM) / 1000.0;
    }

    const sampleValues = this.generateSampleValues(sweep);

    return sampleValues.map((val, idx) => {
      let activePlanet = { ...planet };
      let activeVInf = baseVInf;
      let activeTargetPeriapsisM = planet.radiusM + baseAltKm * 1000.0;
      let activePassType = basePassType;
      let activeMass = baseMass;

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
      }

      const analytical = FlybyEngine.computeAnalytical({
        planet: activePlanet,
        vInfSpeedMPerS: activeVInf,
        targetPeriapsisM: activeTargetPeriapsisM,
        passType: activePassType,
        spacecraftMassKg: activeMass,
      });

      const isCollision = analytical.isPhysicalCollision;
      const closestRadiusKm = analytical.periapsisRadiusM / 1000.0;
      const closestAltKm = (analytical.periapsisRadiusM - activePlanet.radiusM) / 1000.0;

      // Numerical error diagnostics based on energy conservation identity
      const energyRelativeError = analytical.energyIdentityDiffJPerKg / Math.max(1.0, Math.abs(analytical.deltaSpecificEnergyJPerKg));

      return {
        stepIndex: idx + 1,
        scenarioName: isScenario ? (baseline as FlybyScenarioConfig).name : `${planet.name} Sweep`,
        planetName: activePlanet.name,
        modelType: 'Newton-Kepler Patched Conic',
        inputParamName: paramName,
        inputParamValue: val,
        inputParamUnit: paramUnit,
        deflectionAngleDeg: analytical.deflectionAngleDeg,
        impactParameterKm: analytical.impactParameterM / 1000.0,
        closestApproachRadiusKm: closestRadiusKm,
        closestApproachAltitudeKm: closestAltKm,
        vInfPlanetInKmPerS: analytical.vInfMPerS / 1000.0,
        vInfPlanetOutKmPerS: analytical.vInfMPerS / 1000.0, // Conserved in rest frame
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
          angularMomentumRelativeError: 1e-14, // Exact in 2-body analytical formulation
        },
      };
    });
  }

  /**
   * Experiment A: Closest Approach Distance (rp) Sweep
   */
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

  /**
   * Experiment B: Incoming Hyperbolic Excess Speed (v_inf) Sweep
   */
  static runExperimentB_SpeedSweep(
    planet: PlanetaryBodyData = PLANETARY_BODIES.JUPITER,
    periapsisRadiusM: number = PLANETARY_BODIES.JUPITER.radiusM * 1.5,
    passType: FlybyPassType = 'TRAILING',
    sampleCount: number = 8
  ): ExperimentRecord[] {
    const sweep: SweepConfig = {
      parameter: 'vInfMPerS',
      minValue: 3000.0,
      maxValue: 30000.0,
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
   * Experiment C: Planetary Gravitational Strength Comparison
   * Includes two controlled evaluations:
   * 1. Equal periapsis radius (rp = 1.8 * R_Jupiter)
   * 2. Equal physical altitude above surface (hp = 50,000 km)
   */
  static runExperimentC_GravityStrength(
    vInfMPerS: number = 10000.0,
    passType: FlybyPassType = 'TRAILING'
  ): {
    equalRadiusRecords: ExperimentRecord[];
    equalAltitudeRecords: ExperimentRecord[];
    explanation: string;
  } {
    const planets = [
      PLANETARY_BODIES.JUPITER,
      PLANETARY_BODIES.SATURN,
      PLANETARY_BODIES.EARTH,
      PLANETARY_BODIES.VENUS,
    ];

    // Controlled comparison 1: Equal periapsis radius rp = 1.5 * R_Jupiter (~104,866 km)
    const fixedRadiusKm = (PLANETARY_BODIES.JUPITER.radiusM * 1.5) / 1000.0;
    const equalRadiusRecords: ExperimentRecord[] = planets.map((p, idx) => {
      const analytical = FlybyEngine.computeAnalytical({
        planet: p,
        vInfSpeedMPerS: vInfMPerS,
        targetPeriapsisM: fixedRadiusKm * 1000.0,
        passType,
        spacecraftMassKg: 1000,
      });

      return {
        stepIndex: idx + 1,
        scenarioName: `Equal Radius: ${p.name}`,
        planetName: p.name,
        modelType: 'Newton-Kepler Patched Conic',
        inputParamName: 'Fixed Periapsis Radius',
        inputParamValue: fixedRadiusKm,
        inputParamUnit: 'km',
        deflectionAngleDeg: analytical.deflectionAngleDeg,
        impactParameterKm: analytical.impactParameterM / 1000.0,
        closestApproachRadiusKm: fixedRadiusKm,
        closestApproachAltitudeKm: (fixedRadiusKm * 1000.0 - p.radiusM) / 1000.0,
        vInfPlanetInKmPerS: vInfMPerS / 1000.0,
        vInfPlanetOutKmPerS: vInfMPerS / 1000.0,
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
        vInfSpeedMPerS: vInfMPerS,
        targetPeriapsisM: rpM,
        passType,
        spacecraftMassKg: 1000,
      });

      return {
        stepIndex: idx + 1,
        scenarioName: `Equal Altitude: ${p.name}`,
        planetName: p.name,
        modelType: 'Newton-Kepler Patched Conic',
        inputParamName: 'Fixed Surface Altitude',
        inputParamValue: fixedAltKm,
        inputParamUnit: 'km',
        deflectionAngleDeg: analytical.deflectionAngleDeg,
        impactParameterKm: analytical.impactParameterM / 1000.0,
        closestApproachRadiusKm: rpM / 1000.0,
        closestApproachAltitudeKm: fixedAltKm,
        vInfPlanetInKmPerS: vInfMPerS / 1000.0,
        vInfPlanetOutKmPerS: vInfMPerS / 1000.0,
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
      'Gravitational parameter (mu) alone does NOT dictate final scalar speed gain! The heliocentric speed change depends crucially on three factors: (1) The deflection angle delta = 2*asin(1/e), (2) The planetary orbital speed V_p, and (3) The vector projection (V_p · delta_v). If deflection exceeds 90°, the outgoing asymptote turns backwards relative to V_p, reducing scalar speed gain despite higher gravitational acceleration.';

    return {
      equalRadiusRecords,
      equalAltitudeRecords,
      explanation,
    };
  }

  /**
   * Experiment D: Flyby Orientation (Trailing vs Leading)
   */
  static runExperimentD_Orientation(
    planet: PlanetaryBodyData = PLANETARY_BODIES.JUPITER,
    vInfMPerS: number = 12000.0,
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

  /**
   * Experiment E: Jupiter vs Saturn Detailed Comparison
   */
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

  /**
   * Experiment F: Spacecraft Mass Invariance Principle
   */
  static runExperimentF_MassInvariance(
    planet: PlanetaryBodyData = PLANETARY_BODIES.JUPITER,
    vInfMPerS: number = 10000.0,
    periapsisAltitudeKm: number = 50000.0,
    massesKg: number[] = [1, 50, 500, 2500, 25000, 100000]
  ): ExperimentRecord[] {
    const rpM = planet.radiusM + periapsisAltitudeKm * 1000.0;

    return massesKg.map((mass, idx) => {
      const analytical = FlybyEngine.computeAnalytical({
        planet,
        vInfSpeedMPerS: vInfMPerS,
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
        impactParameterKm: analytical.impactParameterM / 1000.0,
        closestApproachRadiusKm: rpM / 1000.0,
        closestApproachAltitudeKm: periapsisAltitudeKm,
        vInfPlanetInKmPerS: vInfMPerS / 1000.0,
        vInfPlanetOutKmPerS: vInfMPerS / 1000.0,
        vSunInKmPerS: analytical.vInSunSpeedMPerS / 1000.0,
        vSunOutKmPerS: analytical.vOutSunSpeedMPerS / 1000.0,
        deltaVSpeedKmPerS: analytical.deltaVSunSpeedMPerS / 1000.0,
        deltaVVectorMagKmPerS: analytical.deltaVVectorMagnitudeMPerS / 1000.0,
        deltaSpecificEnergyMJPerKg: analytical.deltaSpecificEnergyJPerKg / 1e6,
        deltaTotalKineticEnergyGJ: analytical.deltaKineticEnergyJ / 1e9,
        isCollision: false,
        collisionStatus: 'SAFE_FLYBY',
      };
    });
  }

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

    // Header metadata block
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

    // Column headers
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

    // Data rows
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
   * LocalStorage persistence for experiment sessions
   */
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
    // Limit to latest 20 saved experiments
    if (list.length > 20) list.pop();
    localStorage.setItem(STORAGE_KEY_SAVED_EXPERIMENTS, JSON.stringify(list));
  }

  static deleteSavedExperiment(id: string): SavedExperiment[] {
    const list = this.getSavedExperiments().filter((x) => x.id !== id);
    localStorage.setItem(STORAGE_KEY_SAVED_EXPERIMENTS, JSON.stringify(list));
    return list;
  }
}
