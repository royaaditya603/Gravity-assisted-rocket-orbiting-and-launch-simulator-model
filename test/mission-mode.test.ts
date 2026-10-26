/**
 * test/mission-mode.test.ts
 *
 * Comprehensive Phase 5 Verification Test Suite for ASTRA Mission Mode:
 * 1. Simplified circular planetary motion physics & limitations
 * 2. NASA JPL Ephemeris motion model (J2000 secular elements & Kepler solver convergence)
 * 3. Planet-relative speed conservation for unpowered flybys (||v_inf,out|| == ||v_inf,in||)
 * 4. Correct Sun-relative velocity transformations & vector momentum exchange
 * 5. Deflection angle trends (speed and periapsis sensitivity)
 * 6. Collision detection during planetary encounters
 * 7. Numerical convergence & energy conservation of heliocentric transfer propagation
 * 8. Multi-encounter state continuity & unphysicality of scalar delta-V addition
 * 9. Voyager 2 historical reference documentation & classification transparency
 */

import { describe, it, expect } from 'vitest';
import { Vector3D } from '../src/physics/Vector3D';
import { MU_SUN, AU } from '../src/physics/constants';
import {
  PlanetaryEphemerisEngine,
  solveKeplerEquation,
  dateToJulianDate,
  julianDateToISOString,
  JPL_PLANETARY_ELEMENTS,
} from '../src/physics/PlanetaryEphemeris';
import {
  MissionEngine,
} from '../src/physics/MissionEngine';

describe('Phase 5 — Interplanetary Mission Mode & Ephemeris Verification', () => {
  // 1. Simplified Circular Planetary Motion Mode
  describe('1. Simplified Circular Planetary Motion', () => {
    it('evaluates circular orbital velocity and period strictly matching Keplerian physics', () => {
      const jd = 2451545.0; // J2000.0 epoch
      const earthState = PlanetaryEphemerisEngine.getPlanetState('EARTH', jd, 'SIMPLIFIED');

      const aM = JPL_PLANETARY_ELEMENTS.EARTH.a0 * AU;
      const expectedVCirc = Math.sqrt(MU_SUN / aM);
      const expectedPeriodYears = (2.0 * Math.PI * Math.sqrt(Math.pow(aM, 3) / MU_SUN)) / (365.25 * 86400.0);

      expect(earthState.mode).toBe('SIMPLIFIED');
      expect(earthState.speedMPerS).toBeCloseTo(expectedVCirc, 1);
      expect(earthState.distanceAU).toBeCloseTo(1.0, 3);
      expect(earthState.orbitalElements.eccentricity).toBe(0.0);
      expect(earthState.orbitalElements.inclinationDeg).toBe(0.0);
      expect(expectedPeriodYears).toBeCloseTo(1.0, 2);

      // Verify explicit labeling of assumptions and limitations
      expect(earthState.assumptions.length).toBeGreaterThan(0);
      expect(earthState.limitations.length).toBeGreaterThan(0);
      expect(earthState.sourceCitation).toContain('circular');
    });

    it('evaluates constant radial distance for all planets in simplified mode', () => {
      const planets = ['MERCURY', 'VENUS', 'EARTH', 'MARS', 'JUPITER', 'SATURN', 'URANUS', 'NEPTUNE'];
      const jd1 = 2451545.0;
      const jd2 = 2451545.0 + 1000.0; // 1000 days later

      for (const p of planets) {
        const state1 = PlanetaryEphemerisEngine.getPlanetState(p, jd1, 'SIMPLIFIED');
        const state2 = PlanetaryEphemerisEngine.getPlanetState(p, jd2, 'SIMPLIFIED');
        expect(state1.distanceAU).toBeCloseTo(state2.distanceAU, 5);
        expect(state1.speedMPerS).toBeCloseTo(state2.speedMPerS, 5);
      }
    });
  });

  // 2. Ephemeris Planetary Motion Mode (NASA JPL J2000 Keplerian Elements)
  describe('2. Ephemeris Planetary Motion (NASA JPL J2000)', () => {
    it('solves Kepler equation via Newton-Raphson to machine precision (< 1e-12)', () => {
      const testCases = [
        { M: 0.1, e: 0.05 },
        { M: 1.5, e: 0.205 }, // Mercury-like
        { M: 3.0, e: 0.048 }, // Jupiter-like
        { M: -2.1, e: 0.093 }, // Mars-like
      ];

      for (const tc of testCases) {
        const E = solveKeplerEquation(tc.M, tc.e);
        // Verify M = E - e*sin(E)
        const residual = Math.abs(E - tc.e * Math.sin(E) - tc.M);
        expect(residual).toBeLessThan(1e-12);
      }
    });

    it('calculates realistic eccentric orbits with perihelion and aphelion bounds', () => {
      const jd = 2451545.0;
      const marsState = PlanetaryEphemerisEngine.getPlanetState('MARS', jd, 'EPHEMERIS');

      expect(marsState.mode).toBe('EPHEMERIS');
      expect(marsState.orbitalElements.eccentricity).toBeGreaterThan(0.08); // Real Mars e ~ 0.0934
      expect(marsState.orbitalElements.eccentricity).toBeLessThan(0.10);

      const aAU = marsState.orbitalElements.semiMajorAxisAU;
      const e = marsState.orbitalElements.eccentricity;
      const rMinAU = aAU * (1.0 - e);
      const rMaxAU = aAU * (1.0 + e);

      expect(marsState.distanceAU).toBeGreaterThanOrEqual(rMinAU - 1e-4);
      expect(marsState.distanceAU).toBeLessThanOrEqual(rMaxAU + 1e-4);
      expect(marsState.sourceCitation).toContain('Jet Propulsion Laboratory');
    });

    it('reproduces documented Julian Date and UTC conversion accurately', () => {
      const iso = '1979-07-09T22:29:51Z';
      const jd = dateToJulianDate(iso);
      expect(jd).toBeGreaterThan(2444000.0);
      expect(jd).toBeLessThan(2445000.0);

      const backToIso = julianDateToISOString(jd);
      expect(backToIso.slice(0, 10)).toBe('1979-07-09');
    });
  });

  // 3. Planet-Relative Speed Conservation
  describe('3. Planet-Relative Speed Conservation', () => {
    it('strictly conserves planet-relative hyperbolic excess speed (||v_inf,out|| == ||v_inf,in||)', () => {
      const vInSun = new Vector3D(15000, 32000, 0); // Sun-relative inbound velocity
      const enc = MissionEngine.computeFlybyEncounter(
        'JUPITER',
        '1979-07-09T22:29:51Z',
        vInSun,
        570000.0,
        'TRAILING',
        'EPHEMERIS',
        'HISTORICAL_FACT',
        1,
        'ENC_JUPITER'
      );

      const speedIn = enc.vInfInSpeedKmPerS;
      const speedOut = enc.vInfOutSpeedKmPerS;
      const diff = Math.abs(speedOut - speedIn);

      expect(diff).toBeLessThan(1e-10); // Exact conservation to machine precision
      expect(enc.deflectionAngleDeg).toBeGreaterThan(0);
      expect(enc.isCollision).toBe(false);
    });
  });

  // 4. Sun-Relative Velocity Transformations & Momentum Exchange
  describe('4. Sun-Relative Velocity Transformations', () => {
    it('verifies exact vector velocity relation: v_out,Sun - v_in,Sun == delta_v == v_inf,out - v_inf,in', () => {
      const vInSun = new Vector3D(18000, 28000, 0);
      const enc = MissionEngine.computeFlybyEncounter(
        'JUPITER',
        '1979-07-09T22:29:51Z',
        vInSun,
        570000.0,
        'TRAILING',
        'EPHEMERIS',
        'HISTORICAL_FACT',
        1,
        'ENC_JUPITER'
      );

      const deltaVSunFromOut = enc.vOutSunMPerS.subtract(enc.vInSunMPerS);
      const deltaVFromInf = enc.vInfOutMPerS.subtract(enc.vInfInMPerS);

      expect(deltaVSunFromOut.x).toBeCloseTo(deltaVFromInf.x, 8);
      expect(deltaVSunFromOut.y).toBeCloseTo(deltaVFromInf.y, 8);
      expect(deltaVSunFromOut.z).toBeCloseTo(deltaVFromInf.z, 8);

      // Trailing pass produces positive Sun-relative energy and speed gain
      expect(enc.deltaSpecificEnergyMJPerKg).toBeGreaterThan(0);
    });

    it('leading pass produces lower energy than trailing pass (directional gravity steering)', () => {
      const jd = 2451545.0;
      const jupState = PlanetaryEphemerisEngine.getPlanetState('JUPITER', jd, 'SIMPLIFIED');
      // Inbound spacecraft approaching along transfer ellipse
      const vInSun = jupState.velocityMPerS.clone().add(new Vector3D(6000, 3000, 0));

      const encLeading = MissionEngine.computeFlybyEncounter(
        'JUPITER',
        '2000-01-01T12:00:00Z',
        vInSun,
        570000.0,
        'LEADING',
        'SIMPLIFIED',
        'SIMPLIFIED_CALCULATION',
        1,
        'ENC_JUPITER'
      );

      const encTrailing = MissionEngine.computeFlybyEncounter(
        'JUPITER',
        '2000-01-01T12:00:00Z',
        vInSun,
        570000.0,
        'TRAILING',
        'SIMPLIFIED',
        'SIMPLIFIED_CALCULATION',
        1,
        'ENC_JUPITER'
      );

      expect(encLeading.passType).toBe('LEADING');
      expect(encTrailing.passType).toBe('TRAILING');
      expect(encLeading.deltaSpecificEnergyMJPerKg).toBeLessThan(encTrailing.deltaSpecificEnergyMJPerKg);
      expect(encTrailing.deltaSpecificEnergyMJPerKg).toBeGreaterThan(0);
    });
  });

  // 5. Deflection Angle Trends
  describe('5. Deflection Angle Trends', () => {
    it('verifies deflection angle decreases monotonically with increasing hyperbolic speed', () => {
      const speeds = [5000, 10000, 15000, 20000]; // m/s excess speed
      const angles: number[] = [];

      for (const spd of speeds) {
        const vPlanet = PlanetaryEphemerisEngine.getPlanetState('JUPITER', 2451545.0, 'SIMPLIFIED').velocityMPerS;
        const vIn = vPlanet.add(new Vector3D(spd, 0, 0));
        const enc = MissionEngine.computeFlybyEncounter(
          'JUPITER',
          '2000-01-01T12:00:00Z',
          vIn,
          500000.0,
          'TRAILING',
          'SIMPLIFIED',
          'SIMPLIFIED_CALCULATION',
          1,
          'ENC_JUPITER'
        );
        angles.push(enc.deflectionAngleDeg);
      }

      for (let i = 1; i < angles.length; i++) {
        expect(angles[i]).toBeLessThan(angles[i - 1]);
      }
    });

    it('verifies deflection angle decreases monotonically with increasing periapsis altitude', () => {
      const altitudesKm = [100000, 300000, 600000, 1200000];
      const angles: number[] = [];

      const vPlanet = PlanetaryEphemerisEngine.getPlanetState('JUPITER', 2451545.0, 'SIMPLIFIED').velocityMPerS;
      const vIn = vPlanet.add(new Vector3D(10000, 0, 0));

      for (const alt of altitudesKm) {
        const enc = MissionEngine.computeFlybyEncounter(
          'JUPITER',
          '2000-01-01T12:00:00Z',
          vIn,
          alt,
          'TRAILING',
          'SIMPLIFIED',
          'SIMPLIFIED_CALCULATION',
          1,
          'ENC_JUPITER'
        );
        angles.push(enc.deflectionAngleDeg);
      }

      for (let i = 1; i < angles.length; i++) {
        expect(angles[i]).toBeLessThan(angles[i - 1]);
      }
    });
  });

  // 6. Collision Detection
  describe('6. Collision Detection', () => {
    it('flags physical collision when periapsis altitude is zero or negative', () => {
      const vIn = new Vector3D(20000, 25000, 0);
      const encImpact = MissionEngine.computeFlybyEncounter(
        'JUPITER',
        '2000-01-01T12:00:00Z',
        vIn,
        -5000.0, // Subsurface impact!
        'TRAILING',
        'SIMPLIFIED',
        'SIMPLIFIED_CALCULATION',
        1,
        'ENC_COLLISION'
      );

      expect(encImpact.isCollision).toBe(true);
      expect(encImpact.periapsisRadiusKm).toBeLessThanOrEqual(JPL_PLANETARY_ELEMENTS.JUPITER.physicalRadiusM / 1000.0);
    });
  });

  // 7. Numerical Convergence & Heliocentric Propagation
  describe('7. Numerical Convergence of Heliocentric Leg Propagation', () => {
    it('conserves heliocentric specific orbital energy under solar gravity during interplanetary coast', () => {
      const r0 = new Vector3D(AU, 0, 0);
      const v0 = new Vector3D(0, 35000, 0); // Elliptical transfer orbit
      const durationS = 180 * 86400.0; // 180 days

      const samples = MissionEngine.propagateHeliocentricLeg(r0, v0, durationS, 2451545.0, 1, 200);
      expect(samples.length).toBe(201);

      const initialEps = samples[0].specificEnergyMJPerKg;
      const finalEps = samples[samples.length - 1].specificEnergyMJPerKg;

      // Energy drift across 180 days must be less than 0.001%
      const fractionalDrift = Math.abs(finalEps - initialEps) / Math.abs(initialEps);
      expect(fractionalDrift).toBeLessThan(1e-5);
    });
  });

  // 8. Multi-Encounter Mechanics & Continuity
  describe('8. Multi-Encounter State Continuity & Non-Linear Delta-V Addition', () => {
    it('enforces that outgoing spacecraft state of Encounter 1 is the initial condition of Transfer Leg 2', () => {
      const mission = MissionEngine.runMissionScenario('CONCEPTUAL_JUPITER_SATURN', 'EPHEMERIS', 'VOYAGER_2');

      expect(mission.encounters.length).toBe(2);
      expect(mission.transferLegs.length).toBe(2);

      const jupiterEnc = mission.encounters[0];
      const leg2 = mission.transferLegs[1];

      // ASTRODYNAMIC RULE: Leg 2 initial velocity MUST identically match Jupiter's outgoing Sun-relative velocity
      expect(leg2.initialState.velMPerS.x).toBeCloseTo(jupiterEnc.vOutSunMPerS.x, 6);
      expect(leg2.initialState.velMPerS.y).toBeCloseTo(jupiterEnc.vOutSunMPerS.y, 6);
      expect(leg2.initialState.velMPerS.z).toBeCloseTo(jupiterEnc.vOutSunMPerS.z, 6);

      // Demonstrates why scalar delta-V addition is false:
      const linearSum = mission.diagnostics.linearDeltaVSumKmPerS;
      const actualNet = mission.diagnostics.actualNetHeliocentricDeltaVKmPerS;

      expect(linearSum).toBeGreaterThan(0);
      expect(actualNet).toBeGreaterThan(0);
      // Linear sum of scalar delta-Vs does NOT equal vector resultant
      expect(linearSum).not.toBeCloseTo(actualNet, 1);
      expect(mission.diagnostics.whyLinearSumIsInvalid).toContain('cannot be summed linearly');
    });

    it('marks conceptual educational scenarios clearly with disclaimer', () => {
      const conceptual = MissionEngine.runMissionScenario('CONCEPTUAL_JUPITER_SATURN');
      expect(conceptual.isConceptual).toBe(true);
      expect(conceptual.conceptualDisclaimer).toContain('hypothetical');
    });
  });

  // 9. Real Mission Reference Mode (Voyager 2)
  describe('9. Real Mission Reference Mode (Voyager 2)', () => {
    it('provides documented encounter records for Jupiter, Saturn, Uranus, and Neptune', () => {
      const voyager = MissionEngine.runMissionScenario('VOYAGER_2_REFERENCE', 'EPHEMERIS', 'VOYAGER_2');

      expect(voyager.encounters.length).toBe(4);
      const planetIds = voyager.encounters.map((e) => e.planetId);
      expect(planetIds).toEqual(['JUPITER', 'SATURN', 'URANUS', 'NEPTUNE']);

      // Jupiter historical encounter verification
      const jup = voyager.encounters[0];
      expect(jup.historicalData?.documentedEncounterEpochUTC).toBe('1979-07-09T22:29:51Z');
      expect(jup.historicalData?.documentedAltitudeKm).toBe(570000.0);
      expect(jup.historicalData?.documentedDeflectionDeg).toBeCloseTo(68.4, 1);

      // Saturn historical encounter verification
      const sat = voyager.encounters[1];
      expect(sat.historicalData?.documentedEncounterEpochUTC).toBe('1981-08-26T03:24:05Z');
      expect(sat.historicalData?.documentedAltitudeKm).toBe(101000.0);
      expect(sat.historicalData?.documentedDeflectionDeg).toBeCloseTo(42.1, 1);

      // Uranus encounter verification
      const ura = voyager.encounters[2];
      expect(ura.historicalData?.documentedEncounterEpochUTC).toBe('1986-01-24T17:59:47Z');
      expect(ura.historicalData?.documentedAltitudeKm).toBe(81500.0);

      // Neptune encounter verification
      const nep = voyager.encounters[3];
      expect(nep.historicalData?.documentedEncounterEpochUTC).toBe('1989-08-25T03:56:36Z');
      expect(nep.historicalData?.documentedAltitudeKm).toBe(4950.0);

      // Clearly distinguishes historical data from simplified model calculations
      expect(jup.classification).toBe('HISTORICAL_FACT');
      expect(sat.classification).toBe('HISTORICAL_FACT');
      expect(ura.classification).toBe('SIMPLIFIED_CALCULATION');
      expect(nep.classification).toBe('SIMPLIFIED_CALCULATION');
    });

    it('includes explicit disclaimer that simplified models cannot claim exact historical reproduction without TCMs', () => {
      const voyager = MissionEngine.runMissionScenario('VOYAGER_2_REFERENCE');
      expect(voyager.conceptualDisclaimer).toContain('trajectory correction maneuvers');
    });
  });
});
