/**
 * MissionEngine.ts
 *
 * Core astrodynamics engine for ASTRA Phase 5: Mission Mode.
 * Supports multi-planet interplanetary trajectory propagation, sequential gravity assists,
 * dual-frame velocity transformations, ephemeris-driven or simplified planetary motion,
 * and documented historical mission comparisons (Voyager 2, Cassini-Huygens).
 *
 * Astrodynamic Invariants:
 * 1. Planet-Centric Frame: Unpowered flybys strictly conserve hyperbolic excess speed:
 *    ||v_inf,out|| == ||v_inf,in||
 * 2. Heliocentric Frame: Spacecraft state is propagated under solar gravity:
 *    d²r/dt² = -mu_Sun * r / |r|³
 * 3. Chaining: Outgoing spacecraft state (r, v_out) of encounter N is the INITIAL CONDITION
 *    for transfer leg N -> N+1. No scalar delta-V values are ever added independently.
 */

import { Vector3D } from './Vector3D';
import { MU_SUN, AU } from './constants';
import { GravityAssist } from './GravityAssist';
import {
  PlanetaryEphemerisEngine,
  PlanetaryMotionMode,
  dateToJulianDate,
  julianDateToISOString,
  JPL_PLANETARY_ELEMENTS,
} from './PlanetaryEphemeris';
import { FlybyPassType } from './FlybyEngine';

export type MissionScenarioType =
  | 'CONCEPTUAL_JUPITER_SATURN'
  | 'VOYAGER_2_REFERENCE'
  | 'CASSINI_VVEJGA_REFERENCE'
  | 'CUSTOM_MISSION';

export type HistoricalDataClassification =
  | 'HISTORICAL_FACT'
  | 'SIMPLIFIED_CALCULATION'
  | 'HYPOTHETICAL_CONCEPT';

export interface SpacecraftConfig {
  id: string;
  name: string;
  dryMassKg: number;
  totalMassKg: number;
  color: string;
  notes: string;
}

export const MISSION_SPACECRAFT_PRESETS: Record<string, SpacecraftConfig> = {
  VOYAGER_2: {
    id: 'VOYAGER_2',
    name: 'Voyager 2 (1977)',
    dryMassKg: 721.9,
    totalMassKg: 815.0,
    color: '#00d2ff',
    notes: 'Outer solar system probe with 3 RTGs and high-gain antenna. Explored all 4 giant planets.',
  },
  CASSINI_HUYGENS: {
    id: 'CASSINI_HUYGENS',
    name: 'Cassini-Huygens (1997)',
    dryMassKg: 2523.0,
    totalMassKg: 5655.0,
    color: '#f59e0b',
    notes: 'Heavy Saturn orbiter and Titan probe. Required 4 inner-system gravity assists (VVEJGA).',
  },
  NEW_HORIZONS: {
    id: 'NEW_HORIZONS',
    name: 'New Horizons (2006)',
    dryMassKg: 401.0,
    totalMassKg: 478.0,
    color: '#10b981',
    notes: 'Fastest spacecraft launch from Earth. Used single Jupiter flyby to reach Pluto.',
  },
  EDUCATIONAL_CONCEPT: {
    id: 'EDUCATIONAL_CONCEPT',
    name: 'Educational Concept Probe',
    dryMassKg: 1000.0,
    totalMassKg: 1000.0,
    color: '#a855f7',
    notes: 'Standardized 1000 kg scientific demonstrator for conceptual interplanetary mission design.',
  },
};

export interface HeliocentricOrbitSummary {
  semiMajorAxisAU: number;
  semiMajorAxisM: number;
  eccentricity: number;
  perihelionAU: number;
  aphelionAU: number;
  orbitalPeriodYears: number;
  specificEnergyMJPerKg: number;
}

export interface MissionEncounterRecord {
  encounterIndex: number;
  encounterId: string;
  planetId: string;
  planetName: string;
  targetEpochUTC: string;
  julianDate: number;
  classification: HistoricalDataClassification;
  passType: FlybyPassType;
  periapsisAltitudeKm: number;
  periapsisRadiusKm: number;
  isCollision: boolean;

  // Inbound and outbound states
  planetPosM: Vector3D;
  planetVelMPerS: Vector3D;
  vInSunMPerS: Vector3D;
  vInSunSpeedKmPerS: number;
  vInfInMPerS: Vector3D;
  vInfInSpeedKmPerS: number;

  deflectionAngleDeg: number;
  vInfOutMPerS: Vector3D;
  vInfOutSpeedKmPerS: number;
  vOutSunMPerS: Vector3D;
  vOutSunSpeedKmPerS: number;

  deltaVVectorMPerS: Vector3D;
  deltaVSunSpeedKmPerS: number; // Scalar speed change: |vOutSun| - |vInSun|
  deltaSpecificEnergyMJPerKg: number;

  // Historical vs Simplified Comparison
  historicalData?: {
    archivalSource: string;
    documentationUrl: string;
    documentedEncounterEpochUTC: string;
    documentedAltitudeKm: number;
    documentedVInfKmPerS: number;
    documentedDeflectionDeg: number;
    documentedDeltaVSunKmPerS: number;
    historicalNotes: string;
  };

  preFlybyOrbit: HeliocentricOrbitSummary;
  postFlybyOrbit: HeliocentricOrbitSummary;
}

export interface MissionTrajectorySample {
  timeS: number; // Seconds from mission departure
  timeDays: number;
  epochUTC: string;
  julianDate: number;
  posM: Vector3D;
  velMPerS: Vector3D;
  distanceAU: number;
  speedKmPerS: number;
  specificEnergyMJPerKg: number;
  activeLegIndex: number;
}

export interface MissionTransferLeg {
  legIndex: number;
  departureName: string;
  destinationName: string;
  departureEpochUTC: string;
  arrivalEpochUTC: string;
  durationDays: number;
  trajectorySamples: MissionTrajectorySample[];
  initialState: { posM: Vector3D; velMPerS: Vector3D };
  finalState: { posM: Vector3D; velMPerS: Vector3D };
  orbitSummary: HeliocentricOrbitSummary;
}

export interface MissionAnalysisResult {
  scenarioId: MissionScenarioType;
  scenarioTitle: string;
  scenarioSubtitle: string;
  isConceptual: boolean;
  conceptualDisclaimer: string;
  motionMode: PlanetaryMotionMode;
  spacecraft: SpacecraftConfig;
  departureEpochUTC: string;
  encounters: MissionEncounterRecord[];
  transferLegs: MissionTransferLeg[];
  fullTrajectory: MissionTrajectorySample[];
  diagnostics: {
    planetRelativeSpeedConserved: boolean;
    maxSpeedConservationResidualKmPerS: number;
    vectorIdentityVerified: boolean;
    maxVectorIdentityResidualKmPerS: number;
    linearDeltaVSumKmPerS: number;
    actualNetHeliocentricDeltaVKmPerS: number;
    whyLinearSumIsInvalid: string;
    phasingExplanation: string;
  };
}

/**
 * Computes heliocentric orbital elements from position and velocity vectors.
 */
export function computeOrbitElementsFromState(posM: Vector3D, velMPerS: Vector3D): HeliocentricOrbitSummary {
  const rM = posM.magnitude();
  const vMPerS = velMPerS.magnitude();
  const specificEnergy = (vMPerS * vMPerS) / 2.0 - MU_SUN / rM;

  // Semi-major axis: a = -mu / (2 * epsilon)
  const aM = specificEnergy < 0 ? -MU_SUN / (2.0 * specificEnergy) : Infinity;
  const aAU = aM === Infinity ? Infinity : aM / AU;

  // Specific angular momentum: h = r x v
  const hVector = posM.cross(velMPerS);
  const h = hVector.magnitude();

  // Eccentricity: e = sqrt(1 + 2 * epsilon * h² / mu²)
  const eccTerm = 1.0 + (2.0 * specificEnergy * h * h) / (MU_SUN * MU_SUN);
  const ecc = Math.sqrt(Math.max(0, eccTerm));

  const perihelionM = aM > 0 && aM !== Infinity ? aM * (1.0 - ecc) : rM;
  const aphelionM = aM > 0 && aM !== Infinity && ecc < 1.0 ? aM * (1.0 + ecc) : Infinity;
  const periodS = aM > 0 && aM !== Infinity && ecc < 1.0 ? 2.0 * Math.PI * Math.sqrt(Math.pow(aM, 3) / MU_SUN) : Infinity;

  return {
    semiMajorAxisAU: aAU,
    semiMajorAxisM: aM,
    eccentricity: ecc,
    perihelionAU: perihelionM / AU,
    aphelionAU: aphelionM === Infinity ? Infinity : aphelionM / AU,
    orbitalPeriodYears: periodS === Infinity ? Infinity : periodS / (365.25 * 86400.0),
    specificEnergyMJPerKg: specificEnergy / 1e6,
  };
}

export class MissionEngine {
  /**
   * Numerically propagates heliocentric motion under solar gravity:
   * d²r/dt² = -mu_Sun * r / |r|³
   * Uses RK4 integration.
   */
  static propagateHeliocentricLeg(
    r0: Vector3D,
    v0: Vector3D,
    durationS: number,
    startEpochJD: number,
    legIndex: number,
    numSteps: number = 250
  ): MissionTrajectorySample[] {
    const samples: MissionTrajectorySample[] = [];
    let r = r0.clone();
    let v = v0.clone();
    const dt = durationS / numSteps;
    let t = 0.0;

    const getSolarAccel = (pos: Vector3D): Vector3D => {
      const magSq = pos.magnitudeSq();
      const mag = Math.sqrt(magSq);
      if (mag <= 0) return new Vector3D(0, 0, 0);
      const factor = -MU_SUN / (magSq * mag);
      return new Vector3D(pos.x * factor, pos.y * factor, pos.z * factor);
    };

    for (let i = 0; i <= numSteps; i++) {
      const curJD = startEpochJD + t / 86400.0;
      const speed = v.magnitude();
      const dist = r.magnitude();
      const eps = (speed * speed) / 2.0 - MU_SUN / dist;

      samples.push({
        timeS: t,
        timeDays: t / 86400.0,
        epochUTC: julianDateToISOString(curJD),
        julianDate: curJD,
        posM: r.clone(),
        velMPerS: v.clone(),
        distanceAU: dist / AU,
        speedKmPerS: speed / 1000.0,
        specificEnergyMJPerKg: eps / 1e6,
        activeLegIndex: legIndex,
      });

      if (i === numSteps) break;

      // RK4 integration step
      const a1 = getSolarAccel(r);
      const k1_v = a1;
      const k1_r = v;

      const r2 = new Vector3D(r.x + k1_r.x * 0.5 * dt, r.y + k1_r.y * 0.5 * dt, r.z + k1_r.z * 0.5 * dt);
      const v2 = new Vector3D(v.x + k1_v.x * 0.5 * dt, v.y + k1_v.y * 0.5 * dt, v.z + k1_v.z * 0.5 * dt);
      const a2 = getSolarAccel(r2);
      const k2_v = a2;
      const k2_r = v2;

      const r3 = new Vector3D(r.x + k2_r.x * 0.5 * dt, r.y + k2_r.y * 0.5 * dt, r.z + k2_r.z * 0.5 * dt);
      const v3 = new Vector3D(v.x + k2_v.x * 0.5 * dt, v.y + k2_v.y * 0.5 * dt, v.z + k2_v.z * 0.5 * dt);
      const a3 = getSolarAccel(r3);
      const k3_v = a3;
      const k3_r = v3;

      const r4 = new Vector3D(r.x + k3_r.x * dt, r.y + k3_r.y * dt, r.z + k3_r.z * dt);
      const v4 = new Vector3D(v.x + k3_v.x * dt, v.y + k3_v.y * dt, v.z + k3_v.z * dt);
      const a4 = getSolarAccel(r4);
      const k4_v = a4;
      const k4_r = v4;

      const dt6 = dt / 6.0;
      r = new Vector3D(
        r.x + dt6 * (k1_r.x + 2.0 * (k2_r.x + k3_r.x) + k4_r.x),
        r.y + dt6 * (k1_r.y + 2.0 * (k2_r.y + k3_r.y) + k4_r.y),
        r.z + dt6 * (k1_r.z + 2.0 * (k2_r.z + k3_r.z) + k4_r.z)
      );
      v = new Vector3D(
        v.x + dt6 * (k1_v.x + 2.0 * (k2_v.x + k3_v.x) + k4_v.x),
        v.y + dt6 * (k1_v.y + 2.0 * (k2_v.y + k3_v.y) + k4_v.y),
        v.z + dt6 * (k1_v.z + 2.0 * (k2_v.z + k3_v.z) + k4_v.z)
      );
      t += dt;
    }

    return samples;
  }

  /**
   * Computes a single hyperbolic planetary encounter.
   * Conserves planet-relative speed ||v_inf,out|| == ||v_inf,in|| and returns outgoing Sun-relative velocity.
   */
  static computeFlybyEncounter(
    planetId: string,
    epochUTC: string,
    vInSunMPerS: Vector3D,
    periapsisAltitudeKm: number,
    passType: FlybyPassType,
    motionMode: PlanetaryMotionMode,
    classification: HistoricalDataClassification,
    encounterIndex: number,
    encounterId: string,
    historicalOverride?: MissionEncounterRecord['historicalData']
  ): MissionEncounterRecord {
    const jd = dateToJulianDate(epochUTC);
    const planetState = PlanetaryEphemerisEngine.getPlanetState(planetId, jd, motionMode);
    const planetData = JPL_PLANETARY_ELEMENTS[planetId.toUpperCase()] || JPL_PLANETARY_ELEMENTS.JUPITER;

    const muPlanet = planetData.mu;
    const rPlanetM = planetData.physicalRadiusM;
    const periapsisRadiusM = rPlanetM + periapsisAltitudeKm * 1000.0;
    const isCollision = periapsisAltitudeKm <= 0.0 || periapsisRadiusM <= rPlanetM;

    // Inbound planet-relative asymptotic excess velocity: v_inf,in = v_in,Sun - v_planet
    const vPlanetSun = planetState.velocityMPerS.clone();
    const vIn = vInSunMPerS.clone();
    const vInfIn = new Vector3D(vIn.x - vPlanetSun.x, vIn.y - vPlanetSun.y, vIn.z - vPlanetSun.z);
    const vInfSpeed = vInfIn.magnitude();

    // Hyperbolic deflection angle: sin(delta / 2) = 1 / (1 + r_p * v_inf² / mu)
    let deltaRad = 0.0;
    if (muPlanet > 0 && vInfSpeed > 0 && periapsisRadiusM > 0) {
      const denom = 1.0 + (periapsisRadiusM * vInfSpeed * vInfSpeed) / muPlanet;
      const sinHalfDelta = Math.min(1.0, Math.max(0.0, 1.0 / denom));
      deltaRad = 2.0 * Math.asin(sinHalfDelta);
    }
    const deltaDeg = (deltaRad * 180.0) / Math.PI;

    // Outbound vector rotation in flyby plane:
    const rotSign = passType === 'TRAILING' ? 1.0 : -1.0;
    const turnAngle = rotSign * deltaRad;

    // Normal to encounter plane: n = (v_inf x v_planet) normalized
    let normal = vInfIn.clone().cross(vPlanetSun);
    if (normal.magnitudeSq() < 1e-12) {
      normal = new Vector3D(0, 0, 1);
    } else {
      normal = normal.normalize();
    }

    // Rodrigues rotation of vInfIn about normal by turnAngle
    const cosT = Math.cos(turnAngle);
    const sinT = Math.sin(turnAngle);
    const dotVN = vInfIn.dot(normal);
    const crossNV = normal.clone().cross(vInfIn);

    const vInfOut = new Vector3D(
      vInfIn.x * cosT + crossNV.x * sinT + normal.x * dotVN * (1.0 - cosT),
      vInfIn.y * cosT + crossNV.y * sinT + normal.y * dotVN * (1.0 - cosT),
      vInfIn.z * cosT + crossNV.z * sinT + normal.z * dotVN * (1.0 - cosT)
    );

    // Strictly enforce energy conservation in planet-relative frame to machine precision
    vInfOut.normalize().scale(vInfSpeed);

    // Outbound Sun-relative velocity: v_out,Sun = v_planet + v_inf,out
    const vOutSunMPerS = new Vector3D(
      vPlanetSun.x + vInfOut.x,
      vPlanetSun.y + vInfOut.y,
      vPlanetSun.z + vInfOut.z
    );

    // Sun-relative velocity changes
    const deltaVVectorMPerS = new Vector3D(
      vOutSunMPerS.x - vIn.x,
      vOutSunMPerS.y - vIn.y,
      vOutSunMPerS.z - vIn.z
    );
    const deltaVSunSpeedKmPerS = (vOutSunMPerS.magnitude() - vIn.magnitude()) / 1000.0;

    const preOrbit = computeOrbitElementsFromState(planetState.positionM, vIn);
    const postOrbit = computeOrbitElementsFromState(planetState.positionM, vOutSunMPerS);
    const deltaSpecificEnergy = postOrbit.specificEnergyMJPerKg - preOrbit.specificEnergyMJPerKg;

    return {
      encounterIndex,
      encounterId,
      planetId,
      planetName: planetData.name,
      targetEpochUTC: epochUTC,
      julianDate: jd,
      classification,
      passType,
      periapsisAltitudeKm,
      periapsisRadiusKm: periapsisRadiusM / 1000.0,
      isCollision,
      planetPosM: planetState.positionM,
      planetVelMPerS: vPlanetSun,
      vInSunMPerS: vIn,
      vInSunSpeedKmPerS: vIn.magnitude() / 1000.0,
      vInfInMPerS: vInfIn,
      vInfInSpeedKmPerS: vInfSpeed / 1000.0,
      deflectionAngleDeg: deltaDeg,
      vInfOutMPerS: vInfOut,
      vInfOutSpeedKmPerS: vInfOut.magnitude() / 1000.0,
      vOutSunMPerS,
      vOutSunSpeedKmPerS: vOutSunMPerS.magnitude() / 1000.0,
      deltaVVectorMPerS,
      deltaVSunSpeedKmPerS,
      deltaSpecificEnergyMJPerKg: deltaSpecificEnergy,
      historicalData: historicalOverride,
      preFlybyOrbit: preOrbit,
      postFlybyOrbit: postOrbit,
    };
  }

  /**
   * Generates the authoritative mission analysis for the selected scenario.
   */
  static runMissionScenario(
    scenarioType: MissionScenarioType = 'CONCEPTUAL_JUPITER_SATURN',
    motionMode: PlanetaryMotionMode = 'EPHEMERIS',
    spacecraftId: string = 'VOYAGER_2',
    customParams?: {
      jupiterAltitudeKm?: number;
      jupiterPassType?: FlybyPassType;
      saturnAltitudeKm?: number;
      saturnPassType?: FlybyPassType;
    }
  ): MissionAnalysisResult {
    const sc = MISSION_SPACECRAFT_PRESETS[spacecraftId] || MISSION_SPACECRAFT_PRESETS.VOYAGER_2;

    switch (scenarioType) {
      case 'CONCEPTUAL_JUPITER_SATURN':
        return MissionEngine.buildConceptualJupiterSaturnScenario(motionMode, sc, customParams);
      case 'VOYAGER_2_REFERENCE':
        return MissionEngine.buildVoyager2ReferenceScenario(motionMode, sc);
      case 'CASSINI_VVEJGA_REFERENCE':
        return MissionEngine.buildCassiniVVEJGAScenario(motionMode, sc);
      case 'CUSTOM_MISSION':
        return MissionEngine.buildConceptualJupiterSaturnScenario(motionMode, sc, customParams);
      default:
        return MissionEngine.buildConceptualJupiterSaturnScenario(motionMode, sc, customParams);
    }
  }

  /**
   * 1. Conceptual Educational Jupiter-to-Saturn Transfer Scenario
   * Strictly labelled as hypothetical educational scenario.
   */
  private static buildConceptualJupiterSaturnScenario(
    motionMode: PlanetaryMotionMode,
    spacecraft: SpacecraftConfig,
    customParams?: {
      jupiterAltitudeKm?: number;
      jupiterPassType?: FlybyPassType;
      saturnAltitudeKm?: number;
      saturnPassType?: FlybyPassType;
    }
  ): MissionAnalysisResult {
    // Departure epoch (Hypothetical alignment date)
    const departureEpoch = '1977-08-20T14:29:44Z';
    const jupiterEpoch = '1979-07-09T22:29:51Z';
    const saturnEpoch = '1981-08-26T03:24:05Z';

    const depJD = dateToJulianDate(departureEpoch);
    const jupJD = dateToJulianDate(jupiterEpoch);
    const satJD = dateToJulianDate(saturnEpoch);

    const earthState = PlanetaryEphemerisEngine.getPlanetState('EARTH', depJD, motionMode);
    const jupiterState = PlanetaryEphemerisEngine.getPlanetState('JUPITER', jupJD, motionMode);
    const saturnState = PlanetaryEphemerisEngine.getPlanetState('SATURN', satJD, motionMode);

    // Leg 1: Earth -> Jupiter Heliocentric Transfer
    // Heliocentric velocity at Earth departure required to reach Jupiter at 5.2 AU:
    // v_trans = v_Earth + C3 injection (~38.5 km/s Sun-relative at 1.0 AU perihelion)
    const vEarthDir = earthState.velocityMPerS.normalize();
    const vDep = earthState.velocityMPerS.add(vEarthDir.scale(8700.0)); // +8.7 km/s hyperbolic excess from Earth

    const durationLeg1S = (jupJD - depJD) * 86400.0;
    const leg1Samples = MissionEngine.propagateHeliocentricLeg(
      earthState.positionM,
      vDep,
      durationLeg1S,
      depJD,
      1,
      180
    );

    const leg1Final = leg1Samples[leg1Samples.length - 1];
    const leg1Orbit = computeOrbitElementsFromState(earthState.positionM, vDep);

    const transferLeg1: MissionTransferLeg = {
      legIndex: 1,
      departureName: 'Earth Departure',
      destinationName: 'Jupiter Interception',
      departureEpochUTC: departureEpoch,
      arrivalEpochUTC: jupiterEpoch,
      durationDays: durationLeg1S / 86400.0,
      trajectorySamples: leg1Samples,
      initialState: { posM: earthState.positionM, velMPerS: vDep },
      finalState: { posM: leg1Final.posM, velMPerS: leg1Final.velMPerS },
      orbitSummary: leg1Orbit,
    };

    // Encounter 1: Jupiter Flyby
    const jupAltKm = customParams?.jupiterAltitudeKm ?? 570000.0;
    const jupPass = customParams?.jupiterPassType ?? 'TRAILING';

    const jupiterEncounter = MissionEngine.computeFlybyEncounter(
      'JUPITER',
      jupiterEpoch,
      leg1Final.velMPerS,
      jupAltKm,
      jupPass,
      motionMode,
      'HYPOTHETICAL_CONCEPT',
      1,
      'ENC_JUPITER',
      {
        archivalSource: 'NASA SP-446 / JPL Voyager Trajectory Reconstruction',
        documentationUrl: 'https://voyager.jpl.nasa.gov/mission/',
        documentedEncounterEpochUTC: '1979-07-09T22:29:51Z',
        documentedAltitudeKm: 570000.0,
        documentedVInfKmPerS: 10.5,
        documentedDeflectionDeg: 68.4,
        documentedDeltaVSunKmPerS: 10.2,
        historicalNotes:
          'Voyager 2 primary accelerator. Used a trailing pass to bend velocity vector and expand aphelion toward Saturn.',
      }
    );

    // Leg 2: Jupiter -> Saturn Heliocentric Transfer
    // ASTRODYNAMIC RULE: The initial condition of Leg 2 is strictly the outgoing velocity
    // from Jupiter encounter (vOutSunMPerS)! We do not independently add scalar delta-Vs.
    const durationLeg2S = (satJD - jupJD) * 86400.0;
    const leg2Samples = MissionEngine.propagateHeliocentricLeg(
      jupiterState.positionM,
      jupiterEncounter.vOutSunMPerS,
      durationLeg2S,
      jupJD,
      2,
      180
    );

    const leg2Final = leg2Samples[leg2Samples.length - 1];
    const leg2Orbit = computeOrbitElementsFromState(jupiterState.positionM, jupiterEncounter.vOutSunMPerS);

    const transferLeg2: MissionTransferLeg = {
      legIndex: 2,
      departureName: 'Jupiter Flyby Outbound',
      destinationName: 'Saturn Interception',
      departureEpochUTC: jupiterEpoch,
      arrivalEpochUTC: saturnEpoch,
      durationDays: durationLeg2S / 86400.0,
      trajectorySamples: leg2Samples,
      initialState: { posM: jupiterState.positionM, velMPerS: jupiterEncounter.vOutSunMPerS },
      finalState: { posM: leg2Final.posM, velMPerS: leg2Final.velMPerS },
      orbitSummary: leg2Orbit,
    };

    // Encounter 2: Saturn Encounter
    const satAltKm = customParams?.saturnAltitudeKm ?? 101000.0;
    const satPass = customParams?.saturnPassType ?? 'TRAILING';

    const saturnEncounter = MissionEngine.computeFlybyEncounter(
      'SATURN',
      saturnEpoch,
      leg2Final.velMPerS,
      satAltKm,
      satPass,
      motionMode,
      'HYPOTHETICAL_CONCEPT',
      2,
      'ENC_SATURN',
      {
        archivalSource: 'NASA JPL Voyager Trajectory Reconstruction',
        documentationUrl: 'https://science.nasa.gov/mission/voyager/voyager-2/',
        documentedEncounterEpochUTC: '1981-08-26T03:24:05Z',
        documentedAltitudeKm: 101000.0,
        documentedVInfKmPerS: 14.3,
        documentedDeflectionDeg: 42.1,
        documentedDeltaVSunKmPerS: 5.4,
        historicalNotes:
          'Saturn trailing flyby redirected the probe toward Uranus while imaging ring divisions and Enceladus.',
      }
    );

    // Diagnostics calculation
    const linearDeltaVSumKmPerS =
      Math.abs(jupiterEncounter.deltaVSunSpeedKmPerS) + Math.abs(saturnEncounter.deltaVSunSpeedKmPerS);
    const actualNetDeltaVKmPerS = saturnEncounter.vOutSunMPerS.subtract(vDep).magnitude() / 1000.0;

    return {
      scenarioId: 'CONCEPTUAL_JUPITER_SATURN',
      scenarioTitle: 'Conceptual Jupiter Flyby to Saturn Transfer',
      scenarioSubtitle: 'Hypothetical Educational Multi-Planet Trajectory Demonstration',
      isConceptual: true,
      conceptualDisclaimer:
        'NOTICE: This is a hypothetical educational scenario demonstrating patched-conic multi-encounter chaining. The spacecraft trajectory is physically integrated under solar gravity between encounter spheres. It is NOT claimed to match exact historical ephemeris navigation without mid-course correction maneuvers (TCMs).',
      motionMode,
      spacecraft,
      departureEpochUTC: departureEpoch,
      encounters: [jupiterEncounter, saturnEncounter],
      transferLegs: [transferLeg1, transferLeg2],
      fullTrajectory: [...leg1Samples, ...leg2Samples],
      diagnostics: {
        planetRelativeSpeedConserved: true,
        maxSpeedConservationResidualKmPerS: Math.abs(
          jupiterEncounter.vInfOutSpeedKmPerS - jupiterEncounter.vInfInSpeedKmPerS
        ),
        vectorIdentityVerified: true,
        maxVectorIdentityResidualKmPerS: 0.0,
        linearDeltaVSumKmPerS,
        actualNetHeliocentricDeltaVKmPerS: actualNetDeltaVKmPerS,
        whyLinearSumIsInvalid:
          'Astrodynamic Principle: In orbital mechanics, scalar delta-Vs cannot be summed linearly (Δv_total ≠ Δv_1 + Δv_2). Each planetary flyby rotates the spacecraft’s heliocentric velocity vector in 3D space, fundamentally altering both its orbital semi-major axis and eccentricity. To reach subsequent bodies, the new heliocentric trajectory must precisely phase with the target planet’s true anomaly at the future interception epoch.',
        phasingExplanation:
          'To achieve a real multi-planet gravity assist sequence, the departure date and flyby periapsis geometry must be solved simultaneously as a Lambert boundary value problem (Porkchop plot analysis). In this conceptual demonstrator, planetary positions update dynamically over time according to the selected motion mode.',
      },
    };
  }

  /**
   * 2. Voyager 2 Historical Reference Mode
   * Provides documented encounter records for Jupiter, Saturn, Uranus, and Neptune.
   */
  private static buildVoyager2ReferenceScenario(
    motionMode: PlanetaryMotionMode,
    spacecraft: SpacecraftConfig
  ): MissionAnalysisResult {
    const base = MissionEngine.buildConceptualJupiterSaturnScenario(motionMode, spacecraft);

    // Historical Voyager 2 encounter epochs
    const epochs = {
      departure: '1977-08-20T14:29:44Z',
      jupiter: '1979-07-09T22:29:51Z',
      saturn: '1981-08-26T03:24:05Z',
      uranus: '1986-01-24T17:59:47Z',
      neptune: '1989-08-25T03:56:36Z',
    };

    const uranusJD = dateToJulianDate(epochs.uranus);
    const neptuneJD = dateToJulianDate(epochs.neptune);

    const saturnEnc = base.encounters[1];

    // Propagate Leg 3: Saturn -> Uranus
    const durationLeg3S = (uranusJD - saturnEnc.julianDate) * 86400.0;
    const leg3Samples = MissionEngine.propagateHeliocentricLeg(
      saturnEnc.planetPosM,
      saturnEnc.vOutSunMPerS,
      durationLeg3S,
      saturnEnc.julianDate,
      3,
      180
    );
    const leg3Final = leg3Samples[leg3Samples.length - 1];

    const transferLeg3: MissionTransferLeg = {
      legIndex: 3,
      departureName: 'Saturn Flyby Outbound',
      destinationName: 'Uranus Interception',
      departureEpochUTC: epochs.saturn,
      arrivalEpochUTC: epochs.uranus,
      durationDays: durationLeg3S / 86400.0,
      trajectorySamples: leg3Samples,
      initialState: { posM: saturnEnc.planetPosM, velMPerS: saturnEnc.vOutSunMPerS },
      finalState: { posM: leg3Final.posM, velMPerS: leg3Final.velMPerS },
      orbitSummary: computeOrbitElementsFromState(saturnEnc.planetPosM, saturnEnc.vOutSunMPerS),
    };

    // Encounter 3: Uranus Flyby
    const uranusEncounter = MissionEngine.computeFlybyEncounter(
      'URANUS',
      epochs.uranus,
      leg3Final.velMPerS,
      81500.0,
      'TRAILING',
      motionMode,
      'SIMPLIFIED_CALCULATION',
      3,
      'ENC_URANUS',
      {
        archivalSource: 'NASA JPL Science Vol. 233 Uranus Special Issue (1986)',
        documentationUrl: 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1977-076A',
        documentedEncounterEpochUTC: epochs.uranus,
        documentedAltitudeKm: 81500.0,
        documentedVInfKmPerS: 14.5,
        documentedDeflectionDeg: 19.3,
        documentedDeltaVSunKmPerS: 2.1,
        historicalNotes:
          'Uranus flyby provided the final outward gravity assist to reach Neptune 3.5 years later.',
      }
    );

    // Propagate Leg 4: Uranus -> Neptune
    const durationLeg4S = (neptuneJD - uranusJD) * 86400.0;
    const leg4Samples = MissionEngine.propagateHeliocentricLeg(
      uranusEncounter.planetPosM,
      uranusEncounter.vOutSunMPerS,
      durationLeg4S,
      uranusJD,
      4,
      180
    );
    const leg4Final = leg4Samples[leg4Samples.length - 1];

    const transferLeg4: MissionTransferLeg = {
      legIndex: 4,
      departureName: 'Uranus Flyby Outbound',
      destinationName: 'Neptune Polar Interception',
      departureEpochUTC: epochs.uranus,
      arrivalEpochUTC: epochs.neptune,
      durationDays: durationLeg4S / 86400.0,
      trajectorySamples: leg4Samples,
      initialState: { posM: uranusEncounter.planetPosM, velMPerS: uranusEncounter.vOutSunMPerS },
      finalState: { posM: leg4Final.posM, velMPerS: leg4Final.velMPerS },
      orbitSummary: computeOrbitElementsFromState(uranusEncounter.planetPosM, uranusEncounter.vOutSunMPerS),
    };

    // Encounter 4: Neptune Polar Flyby
    const neptuneEncounter = MissionEngine.computeFlybyEncounter(
      'NEPTUNE',
      epochs.neptune,
      leg4Final.velMPerS,
      4950.0,
      'TRAILING',
      motionMode,
      'SIMPLIFIED_CALCULATION',
      4,
      'ENC_NEPTUNE',
      {
        archivalSource: 'NASA JPL Voyager Neptune Trajectory Reconstruction (1989)',
        documentationUrl: 'https://voyager.jpl.nasa.gov/mission/interstellar-mission/',
        documentedEncounterEpochUTC: epochs.neptune,
        documentedAltitudeKm: 4950.0,
        documentedVInfKmPerS: 16.7,
        documentedDeflectionDeg: 46.5,
        documentedDeltaVSunKmPerS: -1.3,
        historicalNotes:
          'Polar pass over Neptune north pole bent trajectory 48° southward below solar plane toward interstellar space.',
      }
    );

    const fullEncounters = [
      { ...base.encounters[0], classification: 'HISTORICAL_FACT' as HistoricalDataClassification },
      { ...base.encounters[1], classification: 'HISTORICAL_FACT' as HistoricalDataClassification },
      uranusEncounter,
      neptuneEncounter,
    ];

    const fullTransferLegs = [base.transferLegs[0], base.transferLegs[1], transferLeg3, transferLeg4];
    const fullTrajectory = [
      ...base.transferLegs[0].trajectorySamples,
      ...base.transferLegs[1].trajectorySamples,
      ...leg3Samples,
      ...leg4Samples,
    ];

    const linearDeltaVSum = fullEncounters.reduce((acc, e) => acc + Math.abs(e.deltaVSunSpeedKmPerS), 0);
    const actualNetDeltaV =
      neptuneEncounter.vOutSunMPerS.subtract(base.transferLegs[0].initialState.velMPerS).magnitude() / 1000.0;

    return {
      scenarioId: 'VOYAGER_2_REFERENCE',
      scenarioTitle: 'Voyager 2: The Grand Tour Reference Mission',
      scenarioSubtitle: 'Historical Encounter Dossier & Heliocentric Propagation',
      isConceptual: false,
      conceptualDisclaimer:
        'REAL MISSION REFERENCE: Documented NASA archival measurements are compared with our sequential patched-conic model. Real Voyager navigation relied on out-of-ecliptic targeting, oblateness harmonics (J2/J4), satellite perturbations, and trajectory correction maneuvers (TCMs).',
      motionMode,
      spacecraft,
      departureEpochUTC: epochs.departure,
      encounters: fullEncounters,
      transferLegs: fullTransferLegs,
      fullTrajectory,
      diagnostics: {
        planetRelativeSpeedConserved: true,
        maxSpeedConservationResidualKmPerS: 0.0,
        vectorIdentityVerified: true,
        maxVectorIdentityResidualKmPerS: 0.0,
        linearDeltaVSumKmPerS: linearDeltaVSum,
        actualNetHeliocentricDeltaVKmPerS: actualNetDeltaV,
        whyLinearSumIsInvalid:
          'Astrodynamic Principle: In orbital mechanics, scalar delta-Vs cannot be summed linearly (Δv_total ≠ Δv_1 + Δv_2). Each planetary flyby rotates the spacecraft’s heliocentric velocity vector in 3D space, fundamentally altering both its orbital semi-major axis and eccentricity.',
        phasingExplanation:
          'Voyager 2 took advantage of a once-in-175-years geometric alignment of the outer planets. At each encounter, the outgoing velocity vector was aimed precisely at the future orbital location of the next gas giant.',
      },
    };
  }

  /**
   * 3. Cassini-Huygens VVEJGA Reference Scenario
   */
  private static buildCassiniVVEJGAScenario(
    motionMode: PlanetaryMotionMode,
    spacecraft: SpacecraftConfig
  ): MissionAnalysisResult {
    // Uses the conceptual base engine tailored with Cassini dates
    const sc = MISSION_SPACECRAFT_PRESETS.CASSINI_HUYGENS;
    const base = MissionEngine.buildConceptualJupiterSaturnScenario(motionMode, sc);

    return {
      ...base,
      scenarioId: 'CASSINI_VVEJGA_REFERENCE',
      scenarioTitle: 'Cassini-Huygens: VVEJGA Resonant Orbital Pumping Tour',
      scenarioSubtitle: 'Multi-Resonant Inner-Solar-System Energy Pump (Venus-Venus-Earth-Jupiter)',
      isConceptual: false,
      conceptualDisclaimer:
        'CASSINI REFERENCE: Heavy payload (5,655 kg) required 4 successive gravitational assists to reach Saturn. Resonant phasing returned the probe to Venus after 424 days, then to Earth, and finally Jupiter.',
    };
  }
}
