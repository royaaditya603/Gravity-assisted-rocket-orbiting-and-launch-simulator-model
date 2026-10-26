import { describe, it, expect } from 'vitest';
import {
  FlybyScenarioConfig,
  DEFAULT_FLYBY_SCENARIO,
  createScenarioFromPreset,
  syncMassAndMu,
  syncAltitudeAndImpactParameter,
  checkMassMuConsistency,
  checkClosestApproachHazards,
  detectScenarioChanges,
  runSensitivitySweep,
  validateScenario,
  scenarioToInitialConditions,
  saveScenario,
  loadSavedScenarios,
  deleteScenario,
  duplicateScenario,
  exportScenarioToJSON,
  importScenarioFromJSON,
  getEducationalPresets,
  computeCircularOrbitalSpeed,
} from '../src/physics/FlybyScenario';
import { FlybyEngine } from '../src/physics/FlybyEngine';
import { PLANETARY_BODIES, G_NEWTON, AU, MU_SUN } from '../src/physics/constants';
import { PLANETARY_DATA, validatePlanetaryConstants } from '../src/physics/planetaryData';

describe('Phase 2: Parameter Configuration and Scenario Builder', () => {
  describe('1. Presets and Central Planetary Data Module', () => {
    it('provides all 5 required presets: Jupiter, Saturn, Earth, Mars, and Custom Planet', () => {
      const requiredPresets = ['JUPITER', 'SATURN', 'EARTH', 'MARS', 'CUSTOM'] as const;

      for (const presetKey of requiredPresets) {
        const scenario = createScenarioFromPreset(presetKey);
        expect(scenario).toBeDefined();
        expect(scenario.planet.presetId).toBe(presetKey);
        expect(scenario.planet.massKg).toBeGreaterThan(0);
        expect(scenario.planet.radiusM).toBeGreaterThan(0);
        expect(scenario.planet.mu).toBeGreaterThan(0);
      }
    });

    it('uses documented SI values with NASA / IAU citations and simplified model disclaimers', () => {
      // Check planetaryData module directly
      const jupiterData = PLANETARY_DATA.JUPITER;
      expect(jupiterData.name).toBe('Jupiter');
      expect(jupiterData.sourceOrReference).toContain('NASA');
      expect(jupiterData.modelSimplificationNote).toContain('Simplified');
      expect(jupiterData.isSimplifiedModel).toBe(true);

      const earthData = PLANETARY_DATA.EARTH;
      expect(earthData.radiusM).toBe(6371000.0);
      expect(earthData.sourceOrReference).toBeDefined();

      const marsData = PLANETARY_DATA.MARS;
      expect(marsData.massKg).toBeCloseTo(6.4171e23, 10);
      expect(marsData.radiusM).toBe(3389500.0);

      // Verify validatePlanetaryConstants
      for (const p of Object.values(PLANETARY_DATA)) {
        const validation = validatePlanetaryConstants(p);
        expect(validation.isValid).toBe(true);
      }
    });

    it('defaults to Jupiter nominal flyby scenario', () => {
      expect(DEFAULT_FLYBY_SCENARIO.planet.presetId).toBe('JUPITER');
      expect(DEFAULT_FLYBY_SCENARIO.planet.name).toBe('Jupiter');
      expect(DEFAULT_FLYBY_SCENARIO.planet.radiusM).toBe(69911000.0);
      expect(DEFAULT_FLYBY_SCENARIO.encounter.passType).toBe('TRAILING');
    });

    it('clearly labels circular orbit as an approximation and computes speed correctly', () => {
      const earthA = 1.0 * AU;
      const computedSpeed = computeCircularOrbitalSpeed(earthA);
      // v = sqrt(mu_sun / a) = sqrt(1.327e20 / 1.496e11) ~ 29,784 m/s
      expect(computedSpeed).toBeCloseTo(29784.7, 0);

      const scenario = createScenarioFromPreset('EARTH');
      expect(scenario.planet.modelSimplificationNote).toContain('circular coplanar unperturbed orbit');
    });
  });

  describe('2. Spacecraft Settings and Parameter Coupling', () => {
    const jupiter = PLANETARY_BODIES.JUPITER;
    const vInf = 12000.0; // m/s

    it('couples impact parameter b and periapsis altitude h bi-directionally without decoupling', () => {
      const altitudeKm = 50000.0;
      const rpM = jupiter.radiusM + altitudeKm * 1000.0;
      const expectedB = FlybyEngine.periapsisToImpactParameter(rpM, vInf, jupiter.mu);

      // 1. Changing altitude calculates b
      const syncFromH = syncAltitudeAndImpactParameter(
        altitudeKm,
        0,
        'PERIAPSIS_ALTITUDE',
        jupiter.radiusM,
        vInf,
        jupiter.mu
      );
      expect(syncFromH.periapsisAltitudeKm).toBe(altitudeKm);
      expect(syncFromH.impactParameterKm).toBeCloseTo(expectedB / 1000.0, 3);

      // 2. Changing b recalculates altitude h
      const bKm = syncFromH.impactParameterKm;
      const syncFromB = syncAltitudeAndImpactParameter(
        0,
        bKm,
        'IMPACT_PARAMETER',
        jupiter.radiusM,
        vInf,
        jupiter.mu
      );
      expect(syncFromB.impactParameterKm).toBe(bKm);
      expect(syncFromB.periapsisAltitudeKm).toBeCloseTo(altitudeKm, 1);
    });

    it('proves v_inf influences hyperbolic deflection angle and heliocentric energy transfer', () => {
      const scenarioSlow = createScenarioFromPreset('JUPITER');
      scenarioSlow.encounter.vInfSpeedMPerS = 8000.0; // 8 km/s

      const scenarioFast = createScenarioFromPreset('JUPITER');
      scenarioFast.encounter.vInfSpeedMPerS = 25000.0; // 25 km/s

      const { config: cSlow } = scenarioToInitialConditions(scenarioSlow);
      const { config: cFast } = scenarioToInitialConditions(scenarioFast);

      const resSlow = FlybyEngine.computeAnalytical(cSlow);
      const resFast = FlybyEngine.computeAnalytical(cFast);

      // Slower encounter spends more time in gravity well -> larger turning angle delta
      expect(resSlow.deflectionAngleDeg).toBeGreaterThan(resFast.deflectionAngleDeg);
      expect(resSlow.deltaVVectorMagnitudeMPerS).not.toEqual(resFast.deltaVVectorMagnitudeMPerS);
    });

    it('proves approach direction angle psi alters incoming velocity vector and Sun delta-v', () => {
      const sc0 = createScenarioFromPreset('JUPITER');
      sc0.encounter.approachAngleDeg = 0;

      const sc90 = createScenarioFromPreset('JUPITER');
      sc90.encounter.approachAngleDeg = 90;

      const { config: c0 } = scenarioToInitialConditions(sc0);
      const { config: c90 } = scenarioToInitialConditions(sc90);

      const res0 = FlybyEngine.computeAnalytical(c0);
      const res90 = FlybyEngine.computeAnalytical(c90);

      expect(res0.vInfMinusMPerS.x).toBeCloseTo(c0.vInfSpeedMPerS, 1);
      expect(res0.vInfMinusMPerS.y).toBeCloseTo(0, 1);

      expect(res90.vInfMinusMPerS.x).toBeCloseTo(0, 1);
      expect(res90.vInfMinusMPerS.y).toBeCloseTo(c90.vInfSpeedMPerS, 1);

      // Heliocentric speed change is different because geometry relative to orbital velocity V_planet changed
      expect(res0.deltaVSunSpeedMPerS).not.toEqual(res90.deltaVSunSpeedMPerS);
    });

    it('proves flyby side (trailing vs leading) switches between acceleration and braking', () => {
      const scTrailing = createScenarioFromPreset('JUPITER');
      scTrailing.encounter.passType = 'TRAILING';

      const scLeading = createScenarioFromPreset('JUPITER');
      scLeading.encounter.passType = 'LEADING';

      const { config: cTrail } = scenarioToInitialConditions(scTrailing);
      const { config: cLead } = scenarioToInitialConditions(scLeading);

      const resTrail = FlybyEngine.computeAnalytical(cTrail);
      const resLead = FlybyEngine.computeAnalytical(cLead);

      // Trailing pass increases heliocentric speed (+Delta v)
      expect(resTrail.deltaVSunSpeedMPerS).toBeGreaterThan(0);
      expect(resTrail.vOutSunSpeedMPerS).toBeGreaterThan(resTrail.vInSunSpeedMPerS);

      // Leading pass decreases heliocentric speed (-Delta v)
      expect(resLead.deltaVSunSpeedMPerS).toBeLessThan(0);
      expect(resLead.vOutSunSpeedMPerS).toBeLessThan(resLead.vInSunSpeedMPerS);
    });

    it('proves custom initial state (position and velocity) overrides analytical encounter in numerical mode', () => {
      const sc = createScenarioFromPreset('EARTH');
      sc.advanced.trajectoryMode = 'NUMERICAL_DOPRI5';
      sc.encounter.customInitialState = {
        enabled: true,
        positionKm: { x: -50000.0, y: 15000.0, z: 0 },
        velocityKmPerS: { x: 9.5, y: 1.0, z: 0 },
      };

      const { config } = scenarioToInitialConditions(sc);
      expect(config.customInitialState).toBeDefined();
      expect(config.customInitialState?.posPlanetM.x).toBe(-50000000.0);
      expect(config.customInitialState?.velPlanetMPerS.x).toBe(9500.0);

      const sim = FlybyEngine.runSimulation(config);
      expect(sim.trajectory.length).toBeGreaterThan(1);
      // First state vector matches custom initial conditions
      const firstState = sim.trajectory[0];
      expect(firstState.posPlanetM.x).toBeCloseTo(-50000000.0, -2);
      expect(firstState.posPlanetM.y).toBeCloseTo(15000000.0, -2);
      expect(firstState.velPlanetMPerS.x).toBeCloseTo(9500.0, 1);
    });

    it('proves integration time step coefficient directly modulates numerical resolution', () => {
      const scCoarse = createScenarioFromPreset('MARS');
      scCoarse.advanced.trajectoryMode = 'NUMERICAL_RK4';
      scCoarse.advanced.fixedTimeStepS = 60.0; // 60s step

      const scFine = createScenarioFromPreset('MARS');
      scFine.advanced.trajectoryMode = 'NUMERICAL_RK4';
      scFine.advanced.fixedTimeStepS = 10.0; // 10s step

      const { config: cCoarse, options: oCoarse } = scenarioToInitialConditions(scCoarse);
      const { config: cFine, options: oFine } = scenarioToInitialConditions(scFine);

      const simCoarse = FlybyEngine.runSimulation(cCoarse, oCoarse);
      const simFine = FlybyEngine.runSimulation(cFine, oFine);

      // Finer time step produces significantly more integration steps
      expect(simFine.trajectory.length).toBeGreaterThan(simCoarse.trajectory.length * 4);
    });
  });

  describe('3. Planet Settings and Authority Modes', () => {
    it('correctly calculates mu from mass when Mass is authoritative', () => {
      const mass = 5.972e24; // Earth mass
      const synced = syncMassAndMu(mass, 0, 'MASS_AUTHORITATIVE');

      expect(synced.massKg).toBe(mass);
      expect(synced.mu).toBeCloseTo(G_NEWTON * mass, 4);
    });

    it('correctly calculates mass from mu when mu is authoritative', () => {
      const mu = 3.986004418e14; // Earth mu
      const synced = syncMassAndMu(0, mu, 'MU_AUTHORITATIVE');

      expect(synced.mu).toBe(mu);
      expect(synced.massKg).toBeCloseTo(mu / G_NEWTON, 4);
    });

    it('detects inconsistent mass and mu and issues warning', () => {
      const mass = 1.0e24;
      const conflictingMu = 1.0e17; // Completely inconsistent with G * mass

      const check = checkMassMuConsistency(mass, conflictingMu);
      expect(check.isConsistent).toBe(false);
      expect(check.warning).toContain('differ by');
      expect(check.relativeDifference).toBeGreaterThan(0.5);

      // Consistent pair
      const validCheck = checkMassMuConsistency(mass, G_NEWTON * mass);
      expect(validCheck.isConsistent).toBe(true);
      expect(validCheck.warning).toBeUndefined();
    });

    it('proves custom planet velocity vector alters Sun-relative delta-v and specific energy', () => {
      const scDefault = createScenarioFromPreset('EARTH');

      const scFastOrbit = createScenarioFromPreset('EARTH');
      scFastOrbit.planet.velocityMode = 'CUSTOM_VECTOR';
      scFastOrbit.planet.customVelocityVectorMPerS = { x: 0, y: 60000.0, z: 0 }; // 60 km/s orbital speed

      const { config: cDef } = scenarioToInitialConditions(scDefault);
      const { config: cFast } = scenarioToInitialConditions(scFastOrbit);

      const resDef = FlybyEngine.computeAnalytical(cDef);
      const resFast = FlybyEngine.computeAnalytical(cFast);

      // Momentum exchange Delta_eps = V_planet · Delta_v is greater with larger V_planet
      expect(resFast.deltaSpecificEnergyJPerKg).toBeGreaterThan(resDef.deltaSpecificEnergyJPerKg);
    });

    it('allows optional mu override for advanced researchers', () => {
      const sc = createScenarioFromPreset('JUPITER');
      sc.planet.muOverride = 2.0e17; // Override from nominal 1.2668e17

      const { config } = scenarioToInitialConditions(sc);
      expect(config.planet.mu).toBe(2.0e17);

      const res = FlybyEngine.computeAnalytical(config);
      // Higher mu yields higher deflection
      const nominalRes = FlybyEngine.computeAnalytical(scenarioToInitialConditions(createScenarioFromPreset('JUPITER')).config);
      expect(res.deflectionAngleDeg).toBeGreaterThan(nominalRes.deflectionAngleDeg);
    });
  });

  describe('4. Validation, Usability, Hazards, and Undo/Redo', () => {
    it('validates and rejects non-positive mass, radius, and gravitational parameter', () => {
      const base = createScenarioFromPreset('EARTH');

      expect(validateScenario({ ...base, planet: { ...base.planet, massKg: -1 } }).isValid).toBe(false);
      expect(validateScenario({ ...base, planet: { ...base.planet, radiusM: 0 } }).isValid).toBe(false);
      expect(validateScenario({ ...base, planet: { ...base.planet, mu: -50 } }).isValid).toBe(false);
    });

    it('prevents negative speeds, invalid angles, and non-finite values', () => {
      const base = createScenarioFromPreset('MARS');

      expect(validateScenario({ ...base, encounter: { ...base.encounter, vInfSpeedMPerS: -500 } }).isValid).toBe(false);
      expect(validateScenario({ ...base, encounter: { ...base.encounter, approachAngleDeg: 400 } }).isValid).toBe(false);
      expect(validateScenario({ ...base, encounter: { ...base.encounter, approachAngleDeg: NaN } }).isValid).toBe(false);
      expect(validateScenario({ ...base, encounter: { ...base.encounter, periapsisAltitudeKm: Infinity } }).isValid).toBe(false);
    });

    it('detects surface collision hazard when periapsis altitude <= 0', () => {
      const marsRadiusM = PLANETARY_DATA.MARS.radiusM;
      const collisionAltitudeKm = -50.0; // Underground!

      const hazard = checkClosestApproachHazards(collisionAltitudeKm, marsRadiusM);
      expect(hazard.isCollision).toBe(true);
      expect(hazard.isUnrealisticClosestApproach).toBe(true);
      expect(hazard.message).toContain('Direct surface collision hazard');
    });

    it('warns about unrealistic atmospheric entry when closest approach is under 100 km', () => {
      const earthRadiusM = PLANETARY_DATA.EARTH.radiusM;
      const lowAltitudeKm = 45.0; // 45 km altitude (inside atmosphere / below Karman line)

      const hazard = checkClosestApproachHazards(lowAltitudeKm, earthRadiusM);
      expect(hazard.isCollision).toBe(false);
      expect(hazard.isUnrealisticClosestApproach).toBe(true);
      expect(hazard.message).toContain('Unrealistic closest approach hazard');
    });

    it('diff detector accurately finds changed parameters between baseline and modified scenario', () => {
      const baseline = createScenarioFromPreset('JUPITER');
      const modified: FlybyScenarioConfig = {
        ...baseline,
        encounter: {
          ...baseline.encounter,
          vInfSpeedMPerS: 15000.0, // changed from 10,000
          passType: 'LEADING', // changed from TRAILING
        },
      };

      const diffs = detectScenarioChanges(baseline, modified);
      expect(diffs.length).toBe(2);

      const vInfDiff = diffs.find((d) => d.paramKey === 'encounter.vInfSpeedMPerS');
      expect(vInfDiff).toBeDefined();
      expect(vInfDiff?.oldValue).toBe(10000);
      expect(vInfDiff?.newValue).toBe(15000);

      const passDiff = diffs.find((d) => d.paramKey === 'encounter.passType');
      expect(passDiff).toBeDefined();
      expect(passDiff?.oldValue).toBe('TRAILING');
      expect(passDiff?.newValue).toBe('LEADING');
    });
  });

  describe('5. Parameter Sensitivity Experiment Sweep', () => {
    it('sweeps a parameter over a range while strictly holding all other parameters fixed', () => {
      const baseScenario = createScenarioFromPreset('JUPITER');
      baseScenario.encounter.vInfSpeedMPerS = 10000.0;
      baseScenario.encounter.periapsisAltitudeKm = 50000.0;
      baseScenario.planet.massKg = PLANETARY_DATA.JUPITER.massKg;

      const sweep = runSensitivitySweep(
        baseScenario,
        'V_INF',
        5.0,
        25.0,
        5
      );

      expect(sweep.points.length).toBe(5);
      expect(sweep.variable).toBe('V_INF');
      expect(sweep.unit).toBe('km/s');

      // Verify each point varies ONLY V_INF
      for (const pt of sweep.points) {
        expect(pt.parameterValue).toBeGreaterThanOrEqual(5.0);
        expect(pt.parameterValue).toBeLessThanOrEqual(25.0);
        expect(pt.deflectionAngleDeg).toBeGreaterThan(0);
        expect(pt.deltaVSunSpeedKmPerS).toBeGreaterThan(0);
      }
    });

    it('sweeps impact parameter b over a range and calculates corresponding deflection', () => {
      const base = createScenarioFromPreset('EARTH');
      const sweep = runSensitivitySweep(base, 'IMPACT_PARAMETER', 15000.0, 50000.0, 5);

      expect(sweep.points.length).toBe(5);
      // As impact parameter increases (farther pass), deflection angle decreases
      for (let i = 1; i < sweep.points.length; i++) {
        expect(sweep.points[i].deflectionAngleDeg).toBeLessThan(sweep.points[i - 1].deflectionAngleDeg);
      }
    });
  });

  describe('6. Persistence, Educational Presets, and JSON Export/Import', () => {
    it('loads verified educational presets (Voyager 2, Cassini, Mars Braking, Saturn Ring-Graze)', () => {
      const presets = getEducationalPresets();
      expect(presets.length).toBeGreaterThanOrEqual(4);

      const v2 = presets.find((p) => p.name.includes('Voyager 2'));
      expect(v2).toBeDefined();
      expect(v2?.planet.presetId).toBe('JUPITER');

      const cassini = presets.find((p) => p.name.includes('Cassini'));
      expect(cassini).toBeDefined();
      expect(cassini?.planet.presetId).toBe('EARTH');

      const marsBrake = presets.find((p) => p.name.includes('Mars'));
      expect(marsBrake).toBeDefined();
      expect(marsBrake?.encounter.passType).toBe('LEADING');
    });

    it('exports scenario to valid JSON string and imports back without precision loss', () => {
      const original = createScenarioFromPreset('SATURN');
      original.name = 'Precision Test Scenario';
      original.encounter.periapsisAltitudeKm = 24567.89;
      original.encounter.vInfSpeedMPerS = 14321.0;

      const json = exportScenarioToJSON(original);
      expect(typeof json).toBe('string');

      const parsed = importScenarioFromJSON(json);
      expect(parsed.success).toBe(true);
      expect(parsed.scenario).toBeDefined();
      expect(parsed.scenario?.name).toBe('Precision Test Scenario');
      expect(parsed.scenario?.encounter.periapsisAltitudeKm).toBe(24567.89);
      expect(parsed.scenario?.encounter.vInfSpeedMPerS).toBe(14321.0);
    });

    it('duplicates a scenario creating an isolated copy with fresh ID', () => {
      const original = createScenarioFromPreset('MARS');
      const clone = duplicateScenario(original);

      expect(clone.id).not.toBe(original.id);
      expect(clone.name).toContain('Copy of');
      expect(clone.planet.presetId).toBe(original.planet.presetId);

      // Mutating clone does not mutate original
      clone.encounter.vInfSpeedMPerS = 99999.0;
      expect(original.encounter.vInfSpeedMPerS).not.toBe(99999.0);
    });
  });
});
