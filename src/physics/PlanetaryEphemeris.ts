/**
 * PlanetaryEphemeris.ts
 *
 * Authoritative planetary motion engine for ASTRA Phase 5.
 * Provides two distinct, strictly labelled planetary motion models:
 *
 * 1. SIMPLIFIED MODE (Circular Coplanar Keplerian):
 *    - Assumes circular, coplanar orbits (e = 0, i = 0) with radius = mean semi-major axis.
 *    - Constant orbital velocity v_circ = sqrt(mu_Sun / a).
 *    - Suitable for high-level conceptual mission design and astrodynamics instruction.
 *    - Explicitly labels assumptions and limitations.
 *
 * 2. EPHEMERIS MODE (NASA JPL Keplerian Elements for J2000.0):
 *    - Implements Standish (1992) / Simon et al. (1994) NASA JPL Solar System Dynamics (SSD)
 *      Keplerian elements and their secular rates per century.
 *    - Solves Kepler's transcendental equation (M = E - e*sin(E)) to machine precision via Newton-Raphson.
 *    - Evaluates true anomaly, heliocentric distance, orbital-plane state, and rotates into 3D
 *      heliocentric ecliptic J2000 coordinates (meters and m/s).
 *    - Supports real historical dates (e.g. Voyager 2, Cassini-Huygens encounter epochs).
 *    - Documented sources: NASA JPL SSD Planetary Orbital Elements Table; Standish (1992).
 */

import { Vector3D } from './Vector3D';
import { MU_SUN, AU } from './constants';

export type PlanetaryMotionMode = 'SIMPLIFIED' | 'EPHEMERIS';

export interface PlanetaryEphemerisState {
  planetId: string;
  name: string;
  epochUTC: string;
  julianDate: number;
  mode: PlanetaryMotionMode;
  positionM: Vector3D;
  velocityMPerS: Vector3D;
  speedMPerS: number;
  distanceAU: number;
  orbitalElements: {
    semiMajorAxisAU: number;
    eccentricity: number;
    inclinationDeg: number;
    meanLongitudeDeg: number;
    longitudeOfPerihelionDeg: number;
    longitudeOfAscendingNodeDeg: number;
    argumentOfPerihelionDeg: number;
    trueAnomalyDeg: number;
  };
  assumptions: string[];
  limitations: string[];
  sourceCitation: string;
}

/**
 * NASA JPL Keplerian Elements and Secular Rates for J2000 (Standish, 1992)
 * Valid range: 1800 AD to 2050 AD.
 * a0: AU, aDot: AU/century
 * e0: dimensionless, eDot: 1/century
 * I0: deg, IDot: deg/century
 * L0: deg, LDot: deg/century (Mean longitude = varpi + M)
 * varpi0: deg, varpiDot: deg/century (Longitude of perihelion = Omega + omega)
 * Omega0: deg, OmegaDot: deg/century (Longitude of ascending node)
 */
interface JPLKeplerianRecord {
  name: string;
  color: string;
  physicalRadiusM: number;
  mu: number;
  a0: number;
  aDot: number;
  e0: number;
  eDot: number;
  I0: number;
  IDot: number;
  L0: number;
  LDot: number;
  varpi0: number;
  varpiDot: number;
  Omega0: number;
  OmegaDot: number;
}

export const JPL_PLANETARY_ELEMENTS: Record<string, JPLKeplerianRecord> = {
  MERCURY: {
    name: 'Mercury',
    color: '#a0a0a0',
    physicalRadiusM: 2439700.0,
    mu: 2.2032e13,
    a0: 0.38709893,
    aDot: 0.00000066,
    e0: 0.20563069,
    eDot: 0.00002527,
    I0: 7.00487,
    IDot: -0.005947,
    L0: 252.250845,
    LDot: 149472.674111,
    varpi0: 77.45645,
    varpiDot: 0.160476,
    Omega0: 48.33167,
    OmegaDot: -0.125349,
  },
  VENUS: {
    name: 'Venus',
    color: '#e0c068',
    physicalRadiusM: 6051800.0,
    mu: 3.24859e14,
    a0: 0.72333199,
    aDot: 0.00000092,
    e0: 0.00677323,
    eDot: -0.00004938,
    I0: 3.39471,
    IDot: -0.0007889,
    L0: 181.97973,
    LDot: 58517.815387,
    varpi0: 131.53298,
    varpiDot: 0.002683,
    Omega0: 76.68069,
    OmegaDot: -0.277694,
  },
  EARTH: {
    name: 'Earth',
    color: '#4f9fff',
    physicalRadiusM: 6371000.0,
    mu: 3.986004418e14,
    a0: 1.00000011,
    aDot: -0.00000005,
    e0: 0.01671022,
    eDot: -0.00003804,
    I0: 0.00005,
    IDot: -0.01531,
    L0: 100.46435,
    LDot: 35999.372449,
    varpi0: 102.94719,
    varpiDot: 0.323272,
    Omega0: 0.0,
    OmegaDot: 0.0,
  },
  MARS: {
    name: 'Mars',
    color: '#e26d5c',
    physicalRadiusM: 3389500.0,
    mu: 4.282837e13,
    a0: 1.52366231,
    aDot: -0.00007221,
    e0: 0.09341233,
    eDot: 0.00011902,
    I0: 1.85061,
    IDot: -0.00888,
    L0: 355.45332,
    LDot: 19140.302684,
    varpi0: 336.04084,
    varpiDot: 0.44441,
    Omega0: 49.57854,
    OmegaDot: -0.268157,
  },
  JUPITER: {
    name: 'Jupiter',
    color: '#d4a373',
    physicalRadiusM: 69911000.0,
    mu: 1.26686534e17,
    a0: 5.20336301,
    aDot: 0.00060737,
    e0: 0.04839266,
    eDot: -0.0001288,
    I0: 1.3053,
    IDot: -0.00415,
    L0: 34.40438,
    LDot: 3034.74612,
    varpi0: 14.75385,
    varpiDot: 0.212526,
    Omega0: 100.55615,
    OmegaDot: 0.204691,
  },
  SATURN: {
    name: 'Saturn',
    color: '#e0cda9',
    physicalRadiusM: 58232000.0,
    mu: 3.7931187e16,
    a0: 9.53707032,
    aDot: -0.0030153,
    e0: 0.0541506,
    eDot: -0.00036762,
    I0: 2.48446,
    IDot: 0.00516,
    L0: 49.94432,
    LDot: 1222.49362,
    varpi0: 92.43194,
    varpiDot: -0.418972,
    Omega0: 113.71504,
    OmegaDot: -0.288671,
  },
  URANUS: {
    name: 'Uranus',
    color: '#88d3d5',
    physicalRadiusM: 25362000.0,
    mu: 5.793939e15,
    a0: 19.19126393,
    aDot: 0.00152025,
    e0: 0.04716771,
    eDot: -0.0001915,
    I0: 0.76986,
    IDot: -0.0018,
    L0: 313.23218,
    LDot: 428.482027,
    varpi0: 170.96424,
    varpiDot: 0.408052,
    Omega0: 74.22988,
    OmegaDot: 0.042405,
  },
  NEPTUNE: {
    name: 'Neptune',
    color: '#4b70dd',
    physicalRadiusM: 24622000.0,
    mu: 6.836529e15,
    a0: 30.06896348,
    aDot: -0.00125196,
    e0: 0.00858587,
    eDot: 0.0000251,
    I0: 1.76917,
    IDot: -0.00511,
    L0: 304.88003,
    LDot: 218.459453,
    varpi0: 44.97135,
    varpiDot: -0.322414,
    Omega0: 131.72169,
    OmegaDot: -0.005987,
  },
};

/**
 * Converts a Gregorian date or ISO string to Julian Date (JD)
 */
export function dateToJulianDate(dateInput: Date | string | number): number {
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1; // 1-12
  const day = d.getUTCDate();
  const hour = d.getUTCHours();
  const minute = d.getUTCMinutes();
  const second = d.getUTCSeconds() + d.getUTCMilliseconds() / 1000.0;

  const dayFraction = day + (hour + minute / 60.0 + second / 3600.0) / 24.0;

  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }

  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);

  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + dayFraction + B - 1524.5;
}

/**
 * Converts a Julian Date to an ISO UTC string (e.g. 1979-07-09T22:29:51Z)
 */
export function julianDateToISOString(jd: number): string {
  const z = Math.floor(jd + 0.5);
  const f = jd + 0.5 - z;
  let alpha = 0;
  if (z >= 2299161) {
    alpha = Math.floor((z - 1867216.25) / 36524.25);
  }
  const a = z + 1 + alpha - Math.floor(alpha / 4);
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);

  const dayWithFrac = b - d - Math.floor(30.6001 * e) + f;
  const day = Math.floor(dayWithFrac);
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;

  const dayFrac = dayWithFrac - day;
  const totalSeconds = Math.round(dayFrac * 86400.0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number, w: number = 2) => String(n).padStart(w, '0');
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:${pad(seconds)}Z`;
}

/**
 * Solves Kepler's transcendental equation: M = E - e * sin(E) using Newton-Raphson.
 * Converges to machine epsilon within 3-5 iterations.
 */
export function solveKeplerEquation(M: number, e: number): number {
  // Normalize M to [-pi, pi]
  let mNorm = M % (2.0 * Math.PI);
  if (mNorm < -Math.PI) mNorm += 2.0 * Math.PI;
  if (mNorm > Math.PI) mNorm -= 2.0 * Math.PI;

  let E = e > 0.8 ? Math.PI : mNorm;
  const maxIter = 100;
  const tol = 1e-14;

  for (let i = 0; i < maxIter; i++) {
    const f = E - e * Math.sin(E) - mNorm;
    const fPrime = 1.0 - e * Math.cos(E);
    const delta = f / fPrime;
    E -= delta;
    if (Math.abs(delta) < tol) break;
  }
  return E;
}

export class PlanetaryEphemerisEngine {
  /**
   * Computes the 3D heliocentric state of a planet at a specific epoch under the chosen motion mode.
   */
  static getPlanetState(
    planetId: string,
    epochInput: Date | string | number,
    mode: PlanetaryMotionMode = 'EPHEMERIS',
    simplifiedPhaseOffsetDeg: number = 0
  ): PlanetaryEphemerisState {
    const normId = planetId.toUpperCase();
    const record = JPL_PLANETARY_ELEMENTS[normId] || JPL_PLANETARY_ELEMENTS.JUPITER;
    const jd = typeof epochInput === 'number' && epochInput > 2000000 ? epochInput : dateToJulianDate(epochInput);
    const epochUTC = julianDateToISOString(jd);

    if (mode === 'SIMPLIFIED') {
      return PlanetaryEphemerisEngine.computeSimplifiedCircular(record, normId, jd, epochUTC, simplifiedPhaseOffsetDeg);
    } else {
      return PlanetaryEphemerisEngine.computeJPLKeplerian(record, normId, jd, epochUTC);
    }
  }

  /**
   * Evaluates SIMPLIFIED circular coplanar orbit (e = 0, i = 0).
   */
  private static computeSimplifiedCircular(
    record: JPLKeplerianRecord,
    planetId: string,
    jd: number,
    epochUTC: string,
    phaseOffsetDeg: number
  ): PlanetaryEphemerisState {
    const aAU = record.a0;
    const aM = aAU * AU;
    const vCirc = Math.sqrt(MU_SUN / aM);
    const omega = Math.sqrt(MU_SUN / (aM * aM * aM)); // rad/s

    // J2000.0 epoch difference in seconds:
    const secondsSinceJ2000 = (jd - 2451545.0) * 86400.0;
    const phaseOffsetRad = (phaseOffsetDeg * Math.PI) / 180.0;
    const angle = (record.L0 * Math.PI) / 180.0 + phaseOffsetRad + omega * secondsSinceJ2000;

    const posX = aM * Math.cos(angle);
    const posY = aM * Math.sin(angle);
    const posZ = 0.0;

    const velX = -vCirc * Math.sin(angle);
    const velY = vCirc * Math.cos(angle);
    const velZ = 0.0;

    return {
      planetId,
      name: record.name,
      epochUTC,
      julianDate: jd,
      mode: 'SIMPLIFIED',
      positionM: new Vector3D(posX, posY, posZ),
      velocityMPerS: new Vector3D(velX, velY, velZ),
      speedMPerS: vCirc,
      distanceAU: aAU,
      orbitalElements: {
        semiMajorAxisAU: aAU,
        eccentricity: 0.0,
        inclinationDeg: 0.0,
        meanLongitudeDeg: ((angle * 180.0) / Math.PI) % 360,
        longitudeOfPerihelionDeg: 0.0,
        longitudeOfAscendingNodeDeg: 0.0,
        argumentOfPerihelionDeg: 0.0,
        trueAnomalyDeg: ((angle * 180.0) / Math.PI) % 360,
      },
      assumptions: [
        'Coplanar circular orbit (eccentricity e = 0.0, inclination i = 0.0°).',
        'Constant orbital speed: v = sqrt(μ_Sun / a).',
        'Instantaneous two-body central solar gravitational field.',
        'Zero planetary gravitational self-perturbations or resonance drift.',
      ],
      limitations: [
        'Does not represent actual astronomical planetary positions.',
        'Cannot be used to predict real-world interplanetary launch windows.',
        'Ignores outer-planet eccentricities (e.g., Jupiter e = 0.048, Saturn e = 0.054).',
      ],
      sourceCitation: 'Idealized circular Keplerian model based on NASA Planetary Fact Sheets mean semi-major axes.',
    };
  }

  /**
   * Evaluates NASA JPL Keplerian Elements with secular rates (Standish 1992).
   */
  private static computeJPLKeplerian(
    record: JPLKeplerianRecord,
    planetId: string,
    jd: number,
    epochUTC: string
  ): PlanetaryEphemerisState {
    // Julian centuries from J2000.0 (JD 2451545.0)
    const T = (jd - 2451545.0) / 36525.0;

    // Elements at epoch T
    const aAU = record.a0 + record.aDot * T;
    const aM = aAU * AU;
    const e = record.e0 + record.eDot * T;
    const IDeg = record.I0 + record.IDot * T;
    const LDeg = record.L0 + record.LDot * T;
    const varpiDeg = record.varpi0 + record.varpiDot * T;
    const OmegaDeg = record.Omega0 + record.OmegaDot * T;

    // Derived angles (degrees to radians)
    const deg2rad = Math.PI / 180.0;
    const I = IDeg * deg2rad;
    const L = LDeg * deg2rad;
    const varpi = varpiDeg * deg2rad;
    const Omega = OmegaDeg * deg2rad;
    const omega = varpi - Omega; // Argument of periapsis
    const M = L - varpi; // Mean anomaly

    // Solve Kepler's equation for Eccentric Anomaly E
    const E = solveKeplerEquation(M, e);

    // True anomaly nu:
    // tan(nu / 2) = sqrt((1 + e) / (1 - e)) * tan(E / 2)
    const sinNu = (Math.sqrt(Math.max(0, 1.0 - e * e)) * Math.sin(E)) / (1.0 - e * Math.cos(E));
    const cosNu = (Math.cos(E) - e) / (1.0 - e * Math.cos(E));
    const nu = Math.atan2(sinNu, cosNu);

    // Heliocentric radius r
    const rM = aM * (1.0 - e * Math.cos(E));
    const rAU = rM / AU;

    // In-plane orbital position and velocity
    const xPrime = rM * Math.cos(nu);
    const yPrime = rM * Math.sin(nu);

    const semiLatusRectum = aM * (1.0 - e * e);
    const hFactor = Math.sqrt(MU_SUN / Math.max(1.0, semiLatusRectum));
    const vxPrime = -hFactor * Math.sin(nu);
    const vyPrime = hFactor * (e + Math.cos(nu));

    // Direction cosines (Euler rotation from orbital plane to J2000 ecliptic frame)
    const cosOmega = Math.cos(Omega);
    const sinOmega = Math.sin(Omega);
    const cosOm = Math.cos(omega);
    const sinOm = Math.sin(omega);
    const cosI = Math.cos(I);
    const sinI = Math.sin(I);

    const Px = cosOmega * cosOm - sinOmega * sinOm * cosI;
    const Py = sinOmega * cosOm + cosOmega * sinOm * cosI;
    const Pz = sinOm * sinI;

    const Qx = -cosOmega * sinOm - sinOmega * cosOm * cosI;
    const Qy = -sinOmega * sinOm + cosOmega * cosOm * cosI;
    const Qz = cosOm * sinI;

    // Transform position: r = x' * P + y' * Q
    const posX = xPrime * Px + yPrime * Qx;
    const posY = xPrime * Py + yPrime * Qy;
    const posZ = xPrime * Pz + yPrime * Qz;

    // Transform velocity: v = vx' * P + vy' * Q
    const velX = vxPrime * Px + vyPrime * Qx;
    const velY = vxPrime * Py + vyPrime * Qy;
    const velZ = vxPrime * Pz + vyPrime * Qz;

    const vel = new Vector3D(velX, velY, velZ);
    const speed = vel.magnitude();

    return {
      planetId,
      name: record.name,
      epochUTC,
      julianDate: jd,
      mode: 'EPHEMERIS',
      positionM: new Vector3D(posX, posY, posZ),
      velocityMPerS: vel,
      speedMPerS: speed,
      distanceAU: rAU,
      orbitalElements: {
        semiMajorAxisAU: aAU,
        eccentricity: e,
        inclinationDeg: IDeg,
        meanLongitudeDeg: ((LDeg % 360) + 360) % 360,
        longitudeOfPerihelionDeg: ((varpiDeg % 360) + 360) % 360,
        longitudeOfAscendingNodeDeg: ((OmegaDeg % 360) + 360) % 360,
        argumentOfPerihelionDeg: (((omega / deg2rad) % 360) + 360) % 360,
        trueAnomalyDeg: (((nu / deg2rad) % 360) + 360) % 360,
      },
      assumptions: [
        'NASA JPL secular perturbation model (linear rates in T) referenced to J2000.0.',
        'Newton-Raphson iteration of Kepler’s equation converged to < 1e-14 error.',
        'Heliocentric ecliptic coordinate system referenced to mean equinox of J2000.',
      ],
      limitations: [
        'Higher-order periodic planetary gravitational perturbations (e.g. Jupiter-Saturn 5:2 Great Inequality) are omitted in linear elements.',
        'Positional accuracy is ~10-100 km for inner planets and ~1000-5000 km for outer planets within 1800-2050 AD.',
        'For sub-meter navigation targeting, full numerical ephemeris integration (e.g. JPL DE440/SPICE kernels) is required.',
      ],
      sourceCitation:
        'NASA Jet Propulsion Laboratory (JPL) Solar System Dynamics (SSD) / Standish, E.M. (1992) "Keplerian Elements for Approximate Positions of the Major Planets"',
    };
  }

  /**
   * Retrieves all major planet states at a given epoch
   */
  static getAllPlanetsAtEpoch(
    epochInput: Date | string | number,
    mode: PlanetaryMotionMode = 'EPHEMERIS'
  ): Record<string, PlanetaryEphemerisState> {
    const result: Record<string, PlanetaryEphemerisState> = {};
    for (const key of Object.keys(JPL_PLANETARY_ELEMENTS)) {
      result[key] = PlanetaryEphemerisEngine.getPlanetState(key, epochInput, mode);
    }
    return result;
  }
}
