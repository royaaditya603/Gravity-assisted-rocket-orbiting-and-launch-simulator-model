import { describe, it, expect } from 'vitest';
import {
  FlybyScenarioConfig,
  DEFAULT_FLYBY_SCENARIO,
  createScenarioFromPreset,
  syncMassAndMu,
  syncAltitudeAndImpactParameter,
  checkMassMuConsistency,
  checkClosestApproachHazards,
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
import {
  PLANETARY_DATA,
  EARTH_PRESET,
  MARS_PRESET,
  JUPITER_PRESET,
  SATURN_PRESET,
} from '../src/physics/planetaryData';
import {
  toCanonicalPlanet,
  toCanonicalFlybyConfig,
  fromCanonicalFlybyConfig,
} from '../src/physics/contracts';

describe('ASTRA Agent 2: Parameter Configuration Specialist Verification', () => {
  describe('1. Planetary Presets & Documented Physical Data Integrity', () => {
    it('provides all 4 core solar system presets (Earth, Mars, Jupiter, Saturn) and Custom option', () => {
      const presets = ['EARTH', 'MARS', 'JUPITER', 'SATURN', 'CUSTOM'] as const;

      for (const key of presets) {
        const scenario = createScenarioFromPreset(key);
        expect(scenario).toBeDefined();
        expect(scenario.planet.presetId).toBe(key);
        expect(scenario.planet.name).toBeTruthy();
        expect(scenario.planet.massKg).toBeGreaterThan(0);
        expect(scenario.planet.radiusM).toBeGreaterThan(0);
        expect(scenario.planet.mu).toBeGreaterThan(0);

        if (key !== 'CUSTOM') {
          expect(scenario.planet.sourceOrReference).toBeDefined();
          expect(scenario.planet.modelSimplificationNote).toContain('circular');
        }
      }
    });

    it('verifies Earth constants against NASA fact sheet values in SI units', () => {
      expect(EARTH_PRESET.name).toBe('Earth');
      expect(EARTH_PRESET.radiusM).toBe(6371000.0); // 6,371 km
      expect(EARTH_PRESET.massKg).toBeCloseTo(5.9722e24, 20);
      expect(EARTH_PRESET.mu).toBeCloseTo(3.986004418e14, 6);
      expect(EARTH_PRESET.semiMajorAxisM).toBe(AU);
      expect(EARTH_PRESET.sourceOrReference).toContain('WGS-84');
    });

    it('verifies Mars constants against NASA fact sheet values', () => {
      expect(MARS_PRESET.name).toBe('Mars');
      expect(MARS_PRESET.radiusM).toBe(3389500.0); // 3,389.5 km
      expect(MARS_PRESET.massKg).toBeCloseTo(6.4171e23, 19);
      expect(MARS_PRESET.mu).toBeCloseTo(4.282837e13, 6);
      expect(MARS_PRESET.semiMajorAxisM).toBe(227920000000.0);
    });

    it('verifies Jupiter constants (largest gas giant, nominal default)', () => {
      expect(JUPITER_PRESET.name).toBe('Jupiter');
      expect(JUPITER_PRESET.radiusM).toBe(69911000.0); // 69,911 km
      expect(JUPITER_PRESET.massKg).toBeCloseTo(1.89813e27, 22);
      expect(JUPITER_PRESET.mu).toBeCloseTo(1.26686534e17, 10);
      expect(DEFAULT_FLYBY_SCENARIO.planet.name).toBe('Jupiter');
      expect(DEFAULT_FLYBY_SCENARIO.encounter.passType).toBe('TRAILING');
    });

    it('verifies Saturn constants including ring boundaries', () => {
      expect(SATURN_PRESET.name).toBe('Saturn');
      expect(SATURN_PRESET.radiusM).toBe(58232000.0); // 58,232 km
      expect(SATURN_PRESET.ringInnerRadiusM).toBe(74500000.0);
      expect(SATURN_PRESET.ringOuterRadiusM).toBe(136775000.0);
      expect(SATURN_PRESET.massKg).toBeCloseTo(5.6834e26, 21);
    });

    it('computes circular heliocentric orbital speed accurately from semi-major axis', () => {
      // v_circ = sqrt(mu_sun / a)
      const vEarth = computeCircularOrbitalSpeed(AU);
      expect(vEarth).toBeCloseTo(29784.7, 1); // ~29.78 km/s

      const vJupiter = computeCircularOrbitalSpeed(778570000000.0);
      expect(vJupiter).toBeCloseTo(13056.0, 0); // ~13.06 km/s
    });
  });

  describe('2. Custom Planet Configuration & Authority Modes', () => {
    it('automatically calculates mu = G * M by default when mass is authoritative', () => {
      const customMassKg = 4.5e25; // 7.5 Earth masses (super-Earth)
      const synced = syncMassAndMu(customMassKg, 0, 'MASS_AUTHORITATIVE');

      expect(synced.massKg).toBe(customMassKg);
      expect(synced.mu).toBeCloseTo(G_NEWTON * customMassKg, 5);
    });

    it('derives mass M = mu / G when mu is authoritative', () => {
      const customMu = 2.5e15; // m^3 / s^2
      const synced = syncMassAndMu(0, customMu, 'MU_AUTHORITATIVE');

      expect(synced.mu).toBe(customMu);
      expect(synced.massKg).toBeCloseTo(customMu / G_NEWTON, 5);
    });

    it('detects and reports inconsistency when mass and mu contradict Newton G', () => {
      const mass = 5.0e24;
      const mismatchedMu = 1.0e12; // Far lower than G * mass (3.33e14)

      const check = checkMassMuConsistency(mass, mismatchedMu);
      expect(check.isConsistent).toBe(false);
      expect(check.warning).toContain('differ by');
      expect(check.relativeDifference).toBeGreaterThan(0.9);
    });

    it('supports advanced muOverride without breaking canonical mass', () => {
      const scenario = createScenarioFromPreset('EARTH');
      scenario.planet.muOverride = 5.0e14; // Higher gravity well override

      const { config } = scenarioToInitialConditions(scenario);
      expect(config.planet.mu).toBe(5.0e14);
      expect(config.planet.massKg).toBe(scenario.planet.massKg);
    });
  });

  describe('3. Spacecraft & Flyby Controls and Unit Conversions', () => {
    const earth = PLANETARY_BODIES.EARTH;
    const vInf = 11200.0; // 11.2 km/s (typical Earth parabolic/hyperbolic speed)

    it('bi-directionally couples closest-approach altitude and impact parameter', () => {
      const altitudeKm = 3000.0;
      const rpM = earth.radiusM + altitudeKm * 1000.0;
      const expectedBM = FlybyEngine.periapsisToImpactParameter(rpM, vInf, earth.mu);
      const expectedBKm = expectedBM / 1000.0;

      // Mode 1: Edit altitude -> derives impact parameter
      const fromAlt = syncAltitudeAndImpactParameter(
        altitudeKm,
        0,
        'PERIAPSIS_ALTITUDE',
        earth.radiusM,
        vInf,
        earth.mu
      );
      expect(fromAlt.periapsisAltitudeKm).toBe(altitudeKm);
      expect(fromAlt.impactParameterKm).toBeCloseTo(expectedBKm, 2);

      // Mode 2: Edit impact parameter -> derives altitude
      const fromImpact = syncAltitudeAndImpactParameter(
        0,
        expectedBKm,
        'IMPACT_PARAMETER',
        earth.radiusM,
        vInf,
        earth.mu
      );
      expect(fromImpact.impactParameterKm).toBe(expectedBKm);
      expect(fromImpact.periapsisAltitudeKm).toBeCloseTo(altitudeKm, 1);
    });

    it('converts units at the boundary: altitude in km converted to targetPeriapsisM in metres', () => {
      const scenario = createScenarioFromPreset('MARS');
      scenario.encounter.periapsisAltitudeKm = 1500.0; // km
      scenario.encounter.distanceMode = 'PERIAPSIS_ALTITUDE';

      const { config } = scenarioToInitialConditions(scenario);
      const expectedPeriapsisM = scenario.planet.radiusM + 1500.0 * 1000.0;
      expect(config.targetPeriapsisM).toBeCloseTo(expectedPeriapsisM, 1);
    });

    it('proves Trailing (+ΔV) vs Leading (-ΔV) pass orientation inverts heliocentric speed change', () => {
      const scTrailing = createScenarioFromPreset('JUPITER');
      scTrailing.encounter.passType = 'TRAILING';

      const scLeading = createScenarioFromPreset('JUPITER');
      scLeading.encounter.passType = 'LEADING';

      const { config: cTrail } = scenarioToInitialConditions(scTrailing);
      const { config: cLead } = scenarioToInitialConditions(scLeading);

      const resTrail = FlybyEngine.computeAnalytical(cTrail);
      const resLead = FlybyEngine.computeAnalytical(cLead);

      expect(resTrail.deltaVSunSpeedMPerS).toBeGreaterThan(0);
      expect(resLead.deltaVSunSpeedMPerS).toBeLessThan(0);
    });

    it('detects surface collision hazard when altitude <= 0', () => {
      const hazard = checkClosestApproachHazards(-100.0, earth.radiusM);
      expect(hazard.isCollision).toBe(true);
      expect(hazard.isUnrealisticClosestApproach).toBe(true);
      expect(hazard.message).toContain('collision');
    });

    it('warns about dense atmospheric entry when altitude is under 100 km', () => {
      const hazard = checkClosestApproachHazards(60.0, earth.radiusM);
      expect(hazard.isCollision).toBe(false);
      expect(hazard.isUnrealisticClosestApproach).toBe(true);
      expect(hazard.message).toContain('Unrealistic closest approach hazard');
    });
  });

  describe('4. Numerical Mode Initial State Vector Configuration', () => {
    it('converts Cartesian position (km) and velocity (km/s) vectors to SI metres and m/s', () => {
      const scenario = createScenarioFromPreset('EARTH');
      scenario.encounter.customInitialState = {
        enabled: true,
        positionKm: { x: -60000.0, y: 25000.0, z: 0 },
        velocityKmPerS: { x: 10.5, y: -2.0, z: 0 },
      };

      const { config } = scenarioToInitialConditions(scenario);
      expect(config.customInitialState).toBeDefined();
      expect(config.customInitialState?.posPlanetM.x).toBe(-60000000.0);
      expect(config.customInitialState?.posPlanetM.y).toBe(25000000.0);
      expect(config.customInitialState?.velPlanetMPerS.x).toBe(10500.0);
      expect(config.customInitialState?.velPlanetMPerS.y).toBe(-2000.0);
    });

    it('initializes numerical simulation directly at custom initial coordinates', () => {
      const scenario = createScenarioFromPreset('EARTH');
      scenario.advanced.trajectoryMode = 'NUMERICAL_RK4';
      scenario.encounter.customInitialState = {
        enabled: true,
        positionKm: { x: -70000.0, y: 30000.0, z: 0 },
        velocityKmPerS: { x: 11.0, y: 0, z: 0 },
      };

      const { config, options } = scenarioToInitialConditions(scenario);
      const sim = FlybyEngine.runSimulation(config, options);

      expect(sim.trajectory.length).toBeGreaterThan(0);
      const firstPoint = sim.trajectory[0];
      expect(firstPoint.posPlanetM.x).toBeCloseTo(-70000000.0, -2);
      expect(firstPoint.posPlanetM.y).toBeCloseTo(30000000.0, -2);
      expect(firstPoint.velPlanetMPerS.x).toBeCloseTo(11000.0, 1);
    });
  });

  describe('5. Scenario Validation, Persistence & JSON Import/Export', () => {
    it('validates and rejects non-positive or non-finite inputs', () => {
      const base = createScenarioFromPreset('EARTH');

      // Invalid mass
      expect(validateScenario({ ...base, planet: { ...base.planet, massKg: -10 } }).isValid).toBe(false);
      // Invalid radius
      expect(validateScenario({ ...base, planet: { ...base.planet, radiusM: 0 } }).isValid).toBe(false);
      // Invalid v_inf
      expect(validateScenario({ ...base, encounter: { ...base.encounter, vInfSpeedMPerS: 0 } }).isValid).toBe(false);
      // Non-finite altitude
      expect(validateScenario({ ...base, encounter: { ...base.encounter, periapsisAltitudeKm: NaN } }).isValid).toBe(false);
    });

    it('exports scenario to JSON string and imports back with exact fidelity', () => {
      const original = createScenarioFromPreset('SATURN');
      original.name = 'Cassini Ring Experiment';
      original.encounter.periapsisAltitudeKm = 12500.5;
      original.encounter.vInfSpeedMPerS = 8765.4;
      original.encounter.approachAngleDeg = 45;

      const json = exportScenarioToJSON(original);
      expect(typeof json).toBe('string');

      const imported = importScenarioFromJSON(json);
      expect(imported.success).toBe(true);
      expect(imported.scenario).toBeDefined();
      expect(imported.scenario?.name).toBe('Cassini Ring Experiment');
      expect(imported.scenario?.encounter.periapsisAltitudeKm).toBe(12500.5);
      expect(imported.scenario?.encounter.vInfSpeedMPerS).toBe(8765.4);
      expect(imported.scenario?.encounter.approachAngleDeg).toBe(45);
    });

    it('rejects corrupted or syntactically invalid JSON strings gracefully', () => {
      const corrupted = '{"name": "Bad JSON", ... incomplete';
      const result = importScenarioFromJSON(corrupted);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Malformed JSON');
    });

    it('creates an isolated duplicate with a new unique ID', () => {
      const original = createScenarioFromPreset('JUPITER');
      const clone = duplicateScenario(original);

      expect(clone.id).not.toBe(original.id);
      expect(clone.name).toContain('Copy of');
      // Deep copy isolation
      clone.encounter.vInfSpeedMPerS = 30000.0;
      expect(original.encounter.vInfSpeedMPerS).toBe(10000.0);
    });

    it('successfully converts to canonical inter-agent contract types', () => {
      const scenario = createScenarioFromPreset('EARTH');
      const { config } = scenarioToInitialConditions(scenario);

      const canonicalPlanet = toCanonicalPlanet(config.planet);
      expect(canonicalPlanet.name).toBe('Earth');
      expect(canonicalPlanet.radiusM).toBe(6371000.0);

      const canonicalFlyby = toCanonicalFlybyConfig(config, scenario);
      expect(canonicalFlyby.planet.name).toBe('Earth');
      expect(canonicalFlyby.vInfSpeedMPerS).toBe(scenario.encounter.vInfSpeedMPerS);
    });
  });
});
