import { describe, it, expect } from 'vitest';
import {
  createScenarioFromPreset,
  syncMassAndMu,
  syncAltitudeAndImpactParameter,
  validateScenario,
  scenarioToInitialConditions,
  exportScenarioToJSON,
  importScenarioFromJSON,
  duplicateScenario,
  FlybyScenarioConfig,
} from '../src/physics/FlybyScenario';
import { FlybyEngine } from '../src/physics/FlybyEngine';
import { PLANETARY_BODIES, G_NEWTON } from '../src/physics/constants';

describe('FlybyScenario - Custom Planet, Flyby Settings & Scenario Configuration', () => {
  describe('1. Preset Loading and Physical Constant Integrity', () => {
    it('loads verified physical constants for all supported planets (Jupiter, Saturn, Earth, Venus)', () => {
      const presets = ['JUPITER', 'SATURN', 'EARTH', 'VENUS'] as const;

      for (const pKey of presets) {
        const scenario = createScenarioFromPreset(pKey);
        const refPlanet = PLANETARY_BODIES[pKey];

        expect(scenario.mode).toBe('PLANET_PRESET');
        expect(scenario.planet.presetId).toBe(pKey);
        expect(scenario.planet.name).toBe(refPlanet.name);
        expect(scenario.planet.radiusM).toBe(refPlanet.radiusM);
        expect(scenario.planet.mu).toBe(refPlanet.mu);
        expect(scenario.planet.massKg).toBe(refPlanet.massKg);
        expect(scenario.planet.isTheoretical).toBe(false);

        // Verification of schema validation on loaded preset
        const validation = validateScenario(scenario);
        expect(validation.isValid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      }
    });
  });

  describe('2. Custom Planet Mass & Gravitational Parameter Authority', () => {
    it('derives mu from mass when mass is authoritative: mu = G * M', () => {
      const customMassKg = 3.0e26; // theoretical super-planet
      const synced = syncMassAndMu(customMassKg, 0, 'MASS_AUTHORITATIVE');

      expect(synced.massKg).toBe(customMassKg);
      expect(synced.mu).toBeCloseTo(G_NEWTON * customMassKg, 5);
      expect(synced.mu).toBeGreaterThan(0);
    });

    it('derives mass from mu when mu is authoritative: M = mu / G', () => {
      const customMu = 5.0e16;
      const synced = syncMassAndMu(0, customMu, 'MU_AUTHORITATIVE');

      expect(synced.mu).toBe(customMu);
      expect(synced.massKg).toBeCloseTo(customMu / G_NEWTON, 5);
      expect(synced.massKg).toBeGreaterThan(0);
    });
  });

  describe('3. Bi-directional Synchronization: Periapsis Altitude and Impact Parameter', () => {
    const jupiter = PLANETARY_BODIES.JUPITER;
    const vInf = 12000.0;

    it('calculates impact parameter b from periapsis altitude hp preserving physics', () => {
      const altKm = 50000.0;
      const synced = syncAltitudeAndImpactParameter(
        altKm,
        0,
        'PERIAPSIS_ALTITUDE',
        jupiter.radiusM,
        vInf,
        jupiter.mu
      );

      expect(synced.periapsisAltitudeKm).toBe(altKm);
      const expectedRp = jupiter.radiusM + altKm * 1000.0;
      const expectedB = FlybyEngine.periapsisToImpactParameter(expectedRp, vInf, jupiter.mu);
      expect(synced.impactParameterKm).toBeCloseTo(expectedB / 1000.0, 3);
    });

    it('calculates periapsis altitude hp from impact parameter b preserving physics', () => {
      const originalAltKm = 65000.0;
      const originalRp = jupiter.radiusM + originalAltKm * 1000.0;
      const bKm = FlybyEngine.periapsisToImpactParameter(originalRp, vInf, jupiter.mu) / 1000.0;

      const synced = syncAltitudeAndImpactParameter(
        0,
        bKm,
        'IMPACT_PARAMETER',
        jupiter.radiusM,
        vInf,
        jupiter.mu
      );

      expect(synced.impactParameterKm).toBe(bKm);
      expect(synced.periapsisAltitudeKm).toBeCloseTo(originalAltKm, 1);
    });
  });

  describe('4. Strict Schema Validation & Import Rejection of Malformed Data', () => {
    it('rejects scenarios with non-positive mass, radius, or mu', () => {
      const base = createScenarioFromPreset('EARTH');

      const negativeMass = { ...base, planet: { ...base.planet, massKg: -500 } };
      expect(validateScenario(negativeMass).isValid).toBe(false);
      expect(validateScenario(negativeMass).errors[0]).toContain('Planet mass');

      const zeroRadius = { ...base, planet: { ...base.planet, radiusM: 0 } };
      expect(validateScenario(zeroRadius).isValid).toBe(false);
      expect(validateScenario(zeroRadius).errors[0]).toContain('Planet radius');

      const nanMu = { ...base, planet: { ...base.planet, mu: NaN } };
      expect(validateScenario(nanMu).isValid).toBe(false);
      expect(validateScenario(nanMu).errors[0]).toContain('gravitational parameter');
    });

    it('rejects scenarios with invalid incoming excess speeds or negative spacecraft mass', () => {
      const base = createScenarioFromPreset('JUPITER');

      const zeroSpeed = { ...base, encounter: { ...base.encounter, vInfSpeedMPerS: 0 } };
      expect(validateScenario(zeroSpeed).isValid).toBe(false);

      const negProbeMass = { ...base, encounter: { ...base.encounter, spacecraftMassKg: -100 } };
      expect(validateScenario(negProbeMass).isValid).toBe(false);
    });

    it('safely rejects corrupted or non-JSON payloads during import', () => {
      const corruptedString = '{ "name": "Broken", "planet": ... invalid syntax';
      const result = importScenarioFromJSON(corruptedString);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Malformed JSON');
    });

    it('successfully round-trips a scenario through JSON export and import', () => {
      const original = createScenarioFromPreset('SATURN');
      original.name = 'Cassini Deep Encounter Custom';
      original.encounter.periapsisAltitudeKm = 12000.0;
      original.encounter.vInfSpeedMPerS = 8500.0;

      const exportedJson = exportScenarioToJSON(original);
      const importResult = importScenarioFromJSON(exportedJson);

      expect(importResult.success).toBe(true);
      expect(importResult.scenario).toBeDefined();

      const imported = importResult.scenario!;
      expect(imported.name).toBe(original.name);
      expect(imported.encounter.periapsisAltitudeKm).toBe(original.encounter.periapsisAltitudeKm);
      expect(imported.encounter.vInfSpeedMPerS).toBe(original.encounter.vInfSpeedMPerS);
      expect(imported.planet.radiusM).toBe(original.planet.radiusM);
    });
  });

  describe('5. Physical Influence of Scenario Inputs on Actual Simulation Outputs', () => {
    it('confirms editing custom planet mass and mu directly alters deflection angle and delta-v', () => {
      const scenarioLight = createScenarioFromPreset('JUPITER');
      scenarioLight.planet.massKg = 1.0e26;
      scenarioLight.planet.mu = G_NEWTON * 1.0e26;

      const scenarioHeavy = createScenarioFromPreset('JUPITER');
      scenarioHeavy.planet.massKg = 3.0e27;
      scenarioHeavy.planet.mu = G_NEWTON * 3.0e27;

      const { config: configLight } = scenarioToInitialConditions(scenarioLight);
      const { config: configHeavy } = scenarioToInitialConditions(scenarioHeavy);

      const simLight = FlybyEngine.runSimulation(configLight);
      const simHeavy = FlybyEngine.runSimulation(configHeavy);

      // Higher planetary mass produces significantly larger deflection angle and vector delta-V
      expect(simHeavy.analytical.deflectionAngleDeg).toBeGreaterThan(simLight.analytical.deflectionAngleDeg);
      expect(simHeavy.analytical.deltaVVectorMagnitudeMPerS).toBeGreaterThan(simLight.analytical.deltaVVectorMagnitudeMPerS);
    });

    it('confirms editing approach angle rotates incoming velocity vector and alters heliocentric gain', () => {
      const scenario0 = createScenarioFromPreset('JUPITER');
      scenario0.encounter.approachAngleDeg = 0; // Along +X

      const scenario45 = createScenarioFromPreset('JUPITER');
      scenario45.encounter.approachAngleDeg = 45; // 45 degrees in-plane

      const { config: config0 } = scenarioToInitialConditions(scenario0);
      const { config: config45 } = scenarioToInitialConditions(scenario45);

      const sim0 = FlybyEngine.runSimulation(config0);
      const sim45 = FlybyEngine.runSimulation(config45);

      // Incoming velocity directions differ
      expect(sim0.analytical.vInfMinusMPerS.x).toBeCloseTo(config0.vInfSpeedMPerS, 3);
      expect(sim0.analytical.vInfMinusMPerS.y).toBeCloseTo(0, 3);

      expect(sim45.analytical.vInfMinusMPerS.x).toBeCloseTo(config45.vInfSpeedMPerS * Math.cos(Math.PI / 4), 3);
      expect(sim45.analytical.vInfMinusMPerS.y).toBeCloseTo(config45.vInfSpeedMPerS * Math.sin(Math.PI / 4), 3);

      // Heliocentric net speeds differ because V_planet · Delta_v depends on geometry
      expect(sim0.analytical.deltaVSunSpeedMPerS).not.toEqual(sim45.analytical.deltaVSunSpeedMPerS);
    });

    it('confirms custom planet velocity vector alters heliocentric encounter speed and kinetic energy exchange', () => {
      const scenarioDefault = createScenarioFromPreset('EARTH'); // ~29.78 km/s along +Y

      const scenarioSlow = createScenarioFromPreset('EARTH');
      scenarioSlow.planet.velocityMode = 'CUSTOM_VECTOR';
      scenarioSlow.planet.customVelocityVectorMPerS = { x: 0, y: 10000.0, z: 0 }; // 10 km/s along +Y

      const { config: confDef } = scenarioToInitialConditions(scenarioDefault);
      const { config: confSlow } = scenarioToInitialConditions(scenarioSlow);

      const resDef = FlybyEngine.computeAnalytical(confDef);
      const resSlow = FlybyEngine.computeAnalytical(confSlow);

      // In planet frame, deflection is identical because mu and rp and vInf are identical
      expect(resDef.deflectionAngleDeg).toBeCloseTo(resSlow.deflectionAngleDeg, 5);

      // In Sun frame, energy exchange Delta_eps = V_planet · Delta_v is proportional to V_planet
      expect(resDef.deltaSpecificEnergyJPerKg).toBeGreaterThan(resSlow.deltaSpecificEnergyJPerKg);
    });
  });

  describe('6. Duplication and Last Valid Configuration Restoration', () => {
    it('duplicates a scenario with a unique ID and cloned properties', () => {
      const source = createScenarioFromPreset('VENUS');
      source.name = 'Venus Low Flyby';

      const copy = duplicateScenario(source);

      expect(copy.id).not.toBe(source.id);
      expect(copy.name).toBe('Copy of Venus Low Flyby');
      expect(copy.planet.radiusM).toBe(source.planet.radiusM);
      expect(copy.encounter.vInfSpeedMPerS).toBe(source.encounter.vInfSpeedMPerS);
    });
  });
});
