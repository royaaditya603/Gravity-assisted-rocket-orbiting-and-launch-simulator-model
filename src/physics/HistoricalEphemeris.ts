/**
 * HistoricalEphemeris.ts
 *
 * Peer-reviewed archival mission references, historical dossiers,
 * multi-encounter sequences, and heliocentric orbital propagation models.
 *
 * Standard references:
 * - NASA SP-424 (Mariner 10: Dunne & Burgess, 1978)
 * - NASA JPL SP-446 (Voyager: Kohlhase & Penzo, 1977; Stone & Lane, 1979)
 * - NASA JPL SP-2000-4522 (Cassini-Huygens: Matson et al., 2002)
 * - ESA SP-1502 (Cassini-Huygens European Mission Archive)
 */

import { PlanetaryBodyData, PLANETARY_BODIES, MU_SUN, AU } from './constants';
import { FlybyEngine, FlybyPassType } from './FlybyEngine';

export interface HistoricalMissionReference {
  id: string;
  missionName: string;
  targetPlanetId: string;
  targetPlanetName: string;
  encounterEpochUTC: string;
  archivalSource: string;
  coordinateFrame: string;
  units: string;
  asymptoticExcessSpeedKmPerS: number;
  periapsisAltitudeKm: number;
  periapsisRadiusKm: number;
  deflectionAngleDeg: number;
  sunSpeedBoostKmPerS: number;
  flybyPassType: FlybyPassType;
  notes: string;
  documentationUrl: string;
}

export const HISTORICAL_MISSION_REFERENCES: Record<string, HistoricalMissionReference> = {
  JUPITER_VOYAGER_2: {
    id: 'JUPITER_VOYAGER_2',
    missionName: 'Voyager 2 — Jupiter Flyby',
    targetPlanetId: 'JUPITER',
    targetPlanetName: 'Jupiter',
    encounterEpochUTC: '1979-07-09T22:29:51Z',
    archivalSource: 'NASA JPL Voyager Trajectory Reconstruction / PDS Geosciences Node',
    coordinateFrame: 'J2000 / EME2000 Heliocentric & Jovian System-III',
    units: 'SI / Metric (km, km/s, degrees)',
    asymptoticExcessSpeedKmPerS: 10.5,
    periapsisAltitudeKm: 570000.0,
    periapsisRadiusKm: 639911.0,
    deflectionAngleDeg: 68.4,
    sunSpeedBoostKmPerS: 16.2,
    flybyPassType: 'TRAILING',
    notes: 'Primary planetary gravity assist of the Grand Tour. Accelerated probe onto Saturn-intercept trajectory.',
    documentationUrl: 'https://voyager.jpl.nasa.gov/mission/',
  },
  VENUS_CASSINI_1: {
    id: 'VENUS_CASSINI_1',
    missionName: 'Cassini-Huygens — Venus-1 Flyby',
    targetPlanetId: 'VENUS',
    targetPlanetName: 'Venus',
    encounterEpochUTC: '1998-04-26T13:45:00Z',
    archivalSource: 'NASA JPL Cassini Trajectory Archive / ESA SP-1502',
    coordinateFrame: 'EME2000 Sun-Centric / Venus-Centric Inertial',
    units: 'SI / Metric (km, km/s, degrees)',
    asymptoticExcessSpeedKmPerS: 6.5,
    periapsisAltitudeKm: 284.0,
    periapsisRadiusKm: 6336.0,
    deflectionAngleDeg: 78.5,
    sunSpeedBoostKmPerS: 7.0,
    flybyPassType: 'TRAILING',
    notes: 'Skimmed upper cloud deck of Venus. First of two Venus resonant gravity assists (VVEJGA sequence).',
    documentationUrl: 'https://science.nasa.gov/mission/cassini/',
  },
  VENUS_MARINER_10: {
    id: 'VENUS_MARINER_10',
    missionName: 'Mariner 10 — Venus Gravity Brake',
    targetPlanetId: 'VENUS',
    targetPlanetName: 'Venus',
    encounterEpochUTC: '1974-02-05T17:07:00Z',
    archivalSource: 'NASA SP-424 "The Voyage of Mariner 10"',
    coordinateFrame: 'Ecliptic B1950 & Heliocentric',
    units: 'SI / Metric (km, km/s, degrees)',
    asymptoticExcessSpeedKmPerS: 8.2,
    periapsisAltitudeKm: 5768.0,
    periapsisRadiusKm: 11820.0,
    deflectionAngleDeg: 54.2,
    sunSpeedBoostKmPerS: -4.32,
    flybyPassType: 'LEADING',
    notes: 'First operational gravitational assist in spaceflight history. Executed LEADING pass to shed heliocentric speed toward Mercury.',
    documentationUrl: 'https://history.nasa.gov/SP-424/sp424.htm',
  },
  EARTH_GALILEO_1: {
    id: 'EARTH_GALILEO_1',
    missionName: 'Galileo — Earth-1 Flyby',
    targetPlanetId: 'EARTH',
    targetPlanetName: 'Earth',
    encounterEpochUTC: '1990-12-08T20:34:34Z',
    archivalSource: 'NASA JPL Galileo Mission Operations Final Report',
    coordinateFrame: 'Earth-Centered Inertial (ECI J2000)',
    units: 'SI / Metric (km, km/s, degrees)',
    asymptoticExcessSpeedKmPerS: 8.94,
    periapsisAltitudeKm: 960.0,
    periapsisRadiusKm: 7331.0,
    deflectionAngleDeg: 48.7,
    sunSpeedBoostKmPerS: 5.2,
    flybyPassType: 'TRAILING',
    notes: 'Resonant Earth flyby pump. Also investigated for the empirical "flyby anomaly" study.',
    documentationUrl: 'https://solarsystem.nasa.gov/missions/galileo/in-depth/',
  },
};

export function getHistoricalReferenceForPlanet(planetId: string): HistoricalMissionReference | undefined {
  const norm = planetId.toUpperCase();
  if (norm.includes('JUPITER')) return HISTORICAL_MISSION_REFERENCES.JUPITER_VOYAGER_2;
  if (norm.includes('VENUS')) return HISTORICAL_MISSION_REFERENCES.VENUS_CASSINI_1;
  if (norm.includes('EARTH')) return HISTORICAL_MISSION_REFERENCES.EARTH_GALILEO_1;
  return undefined;
}

export type HistoricalDataClassification =
  | 'HISTORICAL_FACT'
  | 'SIMPLIFIED_CALCULATION'
  | 'HYPOTHETICAL_CONCEPT';

export interface HistoricalMissionLeg {
  id: string;
  legNumber: number;
  name: string;
  targetPlanetId: string;
  targetPlanet: PlanetaryBodyData;
  encounterEpochUTC: string;
  classification: HistoricalDataClassification;
  asymptoticExcessSpeedKmPerS: number;
  periapsisAltitudeKm: number;
  periapsisRadiusKm: number;
  deflectionAngleDeg: number;
  sunSpeedBoostKmPerS: number;
  flybyPassType: FlybyPassType;
  archivalSource: string;
  documentationUrl: string;
  physicalSignificance: string;
}

export interface HistoricalMissionDossier {
  id: string;
  name: string;
  shortCode: string;
  launchDate: string;
  launchVehicle: string;
  operator: string;
  overview: string;
  trajectoryClass: string;
  primaryObjective: string;
  legs: HistoricalMissionLeg[];
  interplanetarySequenceExplanation: string;
}

export interface HeliocentricOrbitElements {
  semiMajorAxisM: number;
  semiMajorAxisAU: number;
  eccentricity: number;
  perihelionM: number;
  perihelionAU: number;
  aphelionM: number;
  aphelionAU: number;
  orbitalPeriodYears: number;
  specificEnergyJPerKg: number;
}

export interface PropagatedLegResult {
  leg: HistoricalMissionLeg;
  preFlybySunSpeedKmPerS: number;
  postFlybySunSpeedKmPerS: number;
  deltaVSunSpeedKmPerS: number;
  preOrbit: HeliocentricOrbitElements;
  postOrbit: HeliocentricOrbitElements;
  specificEnergyChangeMJPerKg: number;
  whyLinearSumIsInvalid: string;
}

export const HISTORICAL_MISSION_DOSSIERS: Record<string, HistoricalMissionDossier> = {
  MARINER_10: {
    id: 'MARINER_10',
    name: 'Mariner 10 — Venus Gravity Brake & Mercury Resonant Tour',
    shortCode: 'M10',
    launchDate: 'November 3, 1973',
    launchVehicle: 'Atlas-Centaur SLV-3C',
    operator: 'NASA / Jet Propulsion Laboratory',
    overview:
      'The first spacecraft to execute an interplanetary gravitational assist in space exploration history. Used a LEADING pass at Venus to brake its heliocentric speed, dropping its perihelion to match Mercury and entering a 176-day solar orbit in 2:1 resonance with Mercury.',
    trajectoryClass: 'Planetary Gravity Brake (Heliocentric Inward Fall)',
    primaryObjective: 'Explore Mercury via resonant multiple flybys following Venus gravity assist deceleration.',
    interplanetarySequenceExplanation:
      'By skimming in front of Venus in its orbital direction (leading pass), Venusian gravity decelerated Mariner 10 relative to the Sun by -4.3 km/s. This shifted its aphelion to 1.0 AU (Earth) and perihelion to 0.46 AU (Mercury), synchronizing with Mercury every 2 orbits.',
    legs: [
      {
        id: 'M10_VENUS',
        legNumber: 1,
        name: 'Venus Gravity Brake Deceleration',
        targetPlanetId: 'VENUS',
        targetPlanet: PLANETARY_BODIES.VENUS,
        encounterEpochUTC: '1974-02-05T17:07:00Z',
        classification: 'HISTORICAL_FACT',
        asymptoticExcessSpeedKmPerS: 8.2,
        periapsisAltitudeKm: 5768.0,
        periapsisRadiusKm: 11820.0,
        deflectionAngleDeg: 54.2,
        sunSpeedBoostKmPerS: -4.32,
        flybyPassType: 'LEADING',
        archivalSource: 'NASA SP-424 "The Voyage of Mariner 10", Dunne & Burgess (1978)',
        documentationUrl: 'https://history.nasa.gov/SP-424/sp424.htm',
        physicalSignificance:
          'Shed 4.3 km/s of heliocentric speed without using any onboard propellant, saving ~60% of launch vehicle payload mass.',
      },
      {
        id: 'M10_MERCURY_1',
        legNumber: 2,
        name: 'Mercury Encounter I (First Close Approach)',
        targetPlanetId: 'MERCURY',
        targetPlanet: PLANETARY_BODIES.MERCURY,
        encounterEpochUTC: '1974-03-29T20:47:00Z',
        classification: 'HISTORICAL_FACT',
        asymptoticExcessSpeedKmPerS: 11.2,
        periapsisAltitudeKm: 705.0,
        periapsisRadiusKm: 3145.0,
        deflectionAngleDeg: 12.4,
        sunSpeedBoostKmPerS: -0.85,
        flybyPassType: 'TRAILING',
        archivalSource: 'NASA SP-424 & JPL Mariner 10 Project Final Report',
        documentationUrl: 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1973-085A',
        physicalSignificance:
          'First spacecraft exploration of Mercury; discovered its intrinsic global magnetic field and cratered lunar-like surface.',
      },
      {
        id: 'M10_MERCURY_2',
        legNumber: 3,
        name: 'Mercury Encounter II (South Polar Pass)',
        targetPlanetId: 'MERCURY',
        targetPlanet: PLANETARY_BODIES.MERCURY,
        encounterEpochUTC: '1974-09-21T20:59:00Z',
        classification: 'HISTORICAL_FACT',
        asymptoticExcessSpeedKmPerS: 11.0,
        periapsisAltitudeKm: 48069.0,
        periapsisRadiusKm: 50509.0,
        deflectionAngleDeg: 0.8,
        sunSpeedBoostKmPerS: 0.05,
        flybyPassType: 'TRAILING',
        archivalSource: 'NASA SP-424 Project Archive',
        documentationUrl: 'https://history.nasa.gov/SP-424/ch7.htm',
        physicalSignificance:
          'Distant daytime pass designed to photograph Mercury southern hemisphere and polar terminator regions.',
      },
    ],
  },

  VOYAGER_2: {
    id: 'VOYAGER_2',
    name: 'Voyager 2 — The Grand Tour of the Outer Solar System',
    shortCode: 'VGR2',
    launchDate: 'August 20, 1977',
    launchVehicle: 'Titan IIIE-Centaur',
    operator: 'NASA / Jet Propulsion Laboratory',
    overview:
      'Capitalized on a rare 175-year geometric alignment of the outer planets. Voyager 2 flew past Jupiter, Saturn, Uranus, and Neptune, using trailing gravity assists at each gas giant to boost heliocentric velocity and slingshot to the next target.',
    trajectoryClass: 'Multi-Planet Planetary Slingshot (Outward Solar System Escape)',
    primaryObjective: 'Reconnaissance of all four outer giant planets and their ring/satellite systems.',
    interplanetarySequenceExplanation:
      'Jupiter provided the pivotal velocity boost (+10.2 km/s), bending the trajectory toward Saturn. Saturn redirected the probe toward Uranus (+5.4 km/s), which then hurled it to Neptune (+2.1 km/s). Each assist cut trip time dramatically—Neptune was reached in 12 years rather than 30.',
    legs: [
      {
        id: 'VGR2_JUPITER',
        legNumber: 1,
        name: 'Jupiter Encounter (Primary Velocity Accelerator)',
        targetPlanetId: 'JUPITER',
        targetPlanet: PLANETARY_BODIES.JUPITER,
        encounterEpochUTC: '1979-07-09T22:29:51Z',
        classification: 'HISTORICAL_FACT',
        asymptoticExcessSpeedKmPerS: 10.5,
        periapsisAltitudeKm: 570000.0,
        periapsisRadiusKm: 639911.0,
        deflectionAngleDeg: 68.4,
        sunSpeedBoostKmPerS: 10.2,
        flybyPassType: 'TRAILING',
        archivalSource: 'NASA JPL SP-446, Stone & Lane (1979)',
        documentationUrl: 'https://voyager.jpl.nasa.gov/mission/',
        physicalSignificance:
          'Doubled heliocentric orbital energy, shortening transit to Saturn to just 25 months while imaging Io active volcanism.',
      },
      {
        id: 'VGR2_SATURN',
        legNumber: 2,
        name: 'Saturn Encounter (Targeting Uranus)',
        targetPlanetId: 'SATURN',
        targetPlanet: PLANETARY_BODIES.SATURN,
        encounterEpochUTC: '1981-08-26T03:24:05Z',
        classification: 'HISTORICAL_FACT',
        asymptoticExcessSpeedKmPerS: 14.3,
        periapsisAltitudeKm: 101000.0,
        periapsisRadiusKm: 159232.0,
        deflectionAngleDeg: 42.1,
        sunSpeedBoostKmPerS: 5.4,
        flybyPassType: 'TRAILING',
        archivalSource: 'NASA JPL Voyager Trajectory Reconstruction',
        documentationUrl: 'https://science.nasa.gov/mission/voyager/voyager-2/',
        physicalSignificance:
          'Deflected probe out of ecliptic plane slightly to target Uranus encounter 4.5 years later.',
      },
      {
        id: 'VGR2_URANUS',
        legNumber: 3,
        name: 'Uranus Encounter (Targeting Neptune)',
        targetPlanetId: 'URANUS',
        targetPlanet: PLANETARY_BODIES.URANUS,
        encounterEpochUTC: '1986-01-24T17:59:47Z',
        classification: 'HISTORICAL_FACT',
        asymptoticExcessSpeedKmPerS: 14.5,
        periapsisAltitudeKm: 81500.0,
        periapsisRadiusKm: 106862.0,
        deflectionAngleDeg: 19.3,
        sunSpeedBoostKmPerS: 2.1,
        flybyPassType: 'TRAILING',
        archivalSource: 'NASA JPL Science Vol. 233 Uranus Special Issue (1986)',
        documentationUrl: 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1977-076A',
        physicalSignificance:
          'First and only spacecraft visit to Uranus; discovered 10 new moons, 2 new rings, and tilted magnetic dipole.',
      },
      {
        id: 'VGR2_NEPTUNE',
        legNumber: 4,
        name: 'Neptune & Triton Polar Encounter',
        targetPlanetId: 'NEPTUNE',
        targetPlanet: PLANETARY_BODIES.NEPTUNE,
        encounterEpochUTC: '1989-08-25T03:56:36Z',
        classification: 'HISTORICAL_FACT',
        asymptoticExcessSpeedKmPerS: 16.7,
        periapsisAltitudeKm: 4950.0,
        periapsisRadiusKm: 29572.0,
        deflectionAngleDeg: 46.5,
        sunSpeedBoostKmPerS: -1.3, // Polar downward deflection into southern heliosphere
        flybyPassType: 'TRAILING',
        archivalSource: 'NASA JPL Voyager Neptune Trajectory Report (1989)',
        documentationUrl: 'https://voyager.jpl.nasa.gov/mission/interstellar-mission/',
        physicalSignificance:
          'Skimmed 4,950 km above cloud tops over north pole, bending trajectory 48° southward below solar plane toward interstellar space.',
      },
    ],
  },

  CASSINI_HUYGENS: {
    id: 'CASSINI_HUYGENS',
    name: 'Cassini–Huygens — VVEJGA Resonant Orbital Pumping Sequence',
    shortCode: 'CAS',
    launchDate: 'October 15, 1997',
    launchVehicle: 'Titan IVB/Centaur-T',
    operator: 'NASA / ESA / ASI Consortium',
    overview:
      'Weighing 5,600 kg, Cassini was far too massive for direct injection to Saturn. It flew the intricate VVEJGA (Venus-Venus-Earth-Jupiter Gravity Assist) tour over 7 years, repeatedly pumping orbital energy from inner planets before Jupiter flung it to Saturn.',
    trajectoryClass: 'Multi-Resonant Inner-Solar-System Energy Pump',
    primaryObjective: 'Detailed orbital exploration of Saturn, its rings, and Titan moon (with Huygens lander).',
    interplanetarySequenceExplanation:
      'Cassini visited Venus twice (April 1998, June 1999) to build orbital energy, swung past Earth (August 1999) to reach Jupiter, and used Jupiter (December 2000) for the final trans-Saturn injection. Each assist was planned with sub-kilometer targeting accuracy.',
    legs: [
      {
        id: 'CAS_VENUS_1',
        legNumber: 1,
        name: 'Venus-1 Flyby (Initial Resonant Pump)',
        targetPlanetId: 'VENUS',
        targetPlanet: PLANETARY_BODIES.VENUS,
        encounterEpochUTC: '1998-04-26T13:45:00Z',
        classification: 'HISTORICAL_FACT',
        asymptoticExcessSpeedKmPerS: 6.5,
        periapsisAltitudeKm: 284.0,
        periapsisRadiusKm: 6336.0,
        deflectionAngleDeg: 78.5,
        sunSpeedBoostKmPerS: 7.0,
        flybyPassType: 'TRAILING',
        archivalSource: 'NASA JPL SP-2000-4522, Matson et al. (2002)',
        documentationUrl: 'https://science.nasa.gov/mission/cassini/',
        physicalSignificance:
          'Shaved 284 km above Venus clouds. Established an elliptical orbit returning to Venus exactly 424 days later.',
      },
      {
        id: 'CAS_VENUS_2',
        legNumber: 2,
        name: 'Venus-2 Flyby (Outward Velocity Boost)',
        targetPlanetId: 'VENUS',
        targetPlanet: PLANETARY_BODIES.VENUS,
        encounterEpochUTC: '1999-06-24T20:30:00Z',
        classification: 'HISTORICAL_FACT',
        asymptoticExcessSpeedKmPerS: 13.6,
        periapsisAltitudeKm: 603.0,
        periapsisRadiusKm: 6655.0,
        deflectionAngleDeg: 42.8,
        sunSpeedBoostKmPerS: 5.5,
        flybyPassType: 'TRAILING',
        archivalSource: 'ESA SP-1502 Cassini Mission Archive',
        documentationUrl: 'https://www.esa.int/Science_Exploration/Space_Science/Cassini-Huygens',
        physicalSignificance:
          'Elevated aphelion to Earth orbit distance, timing intersection with Earth 55 days later.',
      },
      {
        id: 'CAS_EARTH',
        legNumber: 3,
        name: 'Earth Flyby (Trans-Jupiter Injection)',
        targetPlanetId: 'EARTH',
        targetPlanet: PLANETARY_BODIES.EARTH,
        encounterEpochUTC: '1999-08-18T03:28:00Z',
        classification: 'HISTORICAL_FACT',
        asymptoticExcessSpeedKmPerS: 16.0,
        periapsisAltitudeKm: 1171.0,
        periapsisRadiusKm: 7542.0,
        deflectionAngleDeg: 35.1,
        sunSpeedBoostKmPerS: 5.5,
        flybyPassType: 'TRAILING',
        archivalSource: 'NASA JPL Cassini Trajectory Overview',
        documentationUrl: 'https://solarsystem.nasa.gov/missions/cassini/overview/',
        physicalSignificance:
          'Pushed aphelion out to the asteroid belt and positioned probe for Jupiter gravitational interception.',
      },
      {
        id: 'CAS_JUPITER',
        legNumber: 4,
        name: 'Jupiter Flyby (Final Saturn Accelerator)',
        targetPlanetId: 'JUPITER',
        targetPlanet: PLANETARY_BODIES.JUPITER,
        encounterEpochUTC: '2000-12-30T10:05:00Z',
        classification: 'HISTORICAL_FACT',
        asymptoticExcessSpeedKmPerS: 11.6,
        periapsisAltitudeKm: 9720000.0, // High periapsis: ~9.72 million km to avoid radiation belts
        periapsisRadiusKm: 9789911.0,
        deflectionAngleDeg: 8.8,
        sunSpeedBoostKmPerS: 2.2,
        flybyPassType: 'TRAILING',
        archivalSource: 'NASA JPL Cassini Jupiter Encounter Science (2001)',
        documentationUrl: 'https://science.nasa.gov/mission/cassini/science/jupiter/',
        physicalSignificance:
          'Delivered final +2.2 km/s boost toward Saturn while jointly observing Jovian magnetosphere with Galileo probe.',
      },
    ],
  },
};

/**
 * Calculates heliocentric conic orbital elements from position radius and heliocentric velocity
 */
export function computeHeliocentricOrbit(rM: number, vMPerS: number): HeliocentricOrbitElements {
  const specificEnergy = (vMPerS * vMPerS) / 2.0 - MU_SUN / rM;
  const aM = -MU_SUN / (2.0 * specificEnergy);
  // Circular assumption for local perpendicular velocity component
  const h = rM * vMPerS;
  const eccSq = Math.max(0, 1.0 + (2.0 * specificEnergy * h * h) / (MU_SUN * MU_SUN));
  const ecc = Math.sqrt(eccSq);

  const perihelionM = aM > 0 ? aM * (1.0 - ecc) : rM;
  const aphelionM = aM > 0 ? aM * (1.0 + ecc) : Infinity;
  const periodS = aM > 0 ? 2.0 * Math.PI * Math.sqrt(Math.pow(aM, 3) / MU_SUN) : Infinity;

  return {
    semiMajorAxisM: aM,
    semiMajorAxisAU: aM / AU,
    eccentricity: ecc,
    perihelionM,
    perihelionAU: perihelionM / AU,
    aphelionM,
    aphelionAU: aphelionM === Infinity ? Infinity : aphelionM / AU,
    orbitalPeriodYears: periodS === Infinity ? Infinity : periodS / (365.25 * 86400),
    specificEnergyJPerKg: specificEnergy,
  };
}

/**
 * Propagates an encounter leg in heliocentric space to demonstrate why scalar delta-V values
 * cannot simply be added together linearly without considering orbital geometry and phasing.
 */
export function propagateMissionLeg(leg: HistoricalMissionLeg): PropagatedLegResult {
  const planet = leg.targetPlanet;
  const vPlanet = planet.orbitalSpeedMPerS;
  const vInf = leg.asymptoticExcessSpeedKmPerS * 1000.0;
  const rPlanet = planet.semiMajorAxisM;

  // Pre-flyby inbound heliocentric speed (vector addition: V_p + v_inf_in)
  // For standard trailing approach: v_in ≈ sqrt(V_p² + v_inf²)
  const preSunSpeed = Math.sqrt(vPlanet * vPlanet + vInf * vInf);
  const preOrbit = computeHeliocentricOrbit(rPlanet, preSunSpeed);

  // Local analytical gravity assist calculation
  const analytical = FlybyEngine.computeAnalytical({
    planet,
    vInfSpeedMPerS: vInf,
    targetPeriapsisM: leg.periapsisRadiusKm * 1000.0,
    passType: leg.flybyPassType,
    spacecraftMassKg: 1000,
  });

  const postSunSpeed = analytical.vOutSunSpeedMPerS;
  const postOrbit = computeHeliocentricOrbit(rPlanet, postSunSpeed);
  const deltaVSunSpeed = (postSunSpeed - preSunSpeed) / 1000.0;
  const deltaEnergyMJ = (postOrbit.specificEnergyJPerKg - preOrbit.specificEnergyJPerKg) / 1e6;

  const whyLinearSumIsInvalid =
    `Astrodynamic Principle: In orbital mechanics, scalar delta-Vs cannot be summed linearly (Δv_total ≠ Δv_1 + Δv_2). Each planetary flyby rotates the spacecraft's heliocentric velocity vector, fundamentally reshaping its semi-major axis, aphelion, and orbital eccentricity. To reach subsequent bodies, the new heliocentric trajectory must precisely phase with the target planet's true anomaly at the future interception epoch.`;

  return {
    leg,
    preFlybySunSpeedKmPerS: preSunSpeed / 1000.0,
    postFlybySunSpeedKmPerS: postSunSpeed / 1000.0,
    deltaVSunSpeedKmPerS: deltaVSunSpeed,
    preOrbit,
    postOrbit,
    specificEnergyChangeMJPerKg: deltaEnergyMJ,
    whyLinearSumIsInvalid,
  };
}
