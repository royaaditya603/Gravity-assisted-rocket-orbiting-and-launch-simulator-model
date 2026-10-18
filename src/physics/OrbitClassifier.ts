import { Vector3D, IVector3D } from './Vector3D';
import { MU_EARTH, R_EARTH, H_ATMOSPHERE } from './constants';

export enum ConicType {
  CIRCULAR = 'CIRCULAR',
  ELLIPTICAL = 'ELLIPTICAL',
  PARABOLIC = 'PARABOLIC',
  HYPERBOLIC = 'HYPERBOLIC',
}

export enum EnergyRegime {
  BOUNDED = 'BOUNDED',                 // epsilon < 0
  PARABOLIC_BOUNDARY = 'PARABOLIC_BOUNDARY', // epsilon ~= 0
  UNBOUNDED = 'UNBOUNDED',             // epsilon > 0
}

export enum PeriapsisClearance {
  SURFACE_INTERSECTING = 'SURFACE_INTERSECTING', // r_p < R_E (intersects solid Earth)
  ATMOSPHERIC_GRAZING = 'ATMOSPHERIC_GRAZING',   // R_E <= r_p < R_E + h_atm
  SPACE_CLEARED = 'SPACE_CLEARED',               // r_p >= R_E + h_atm (pure vacuum)
}

export interface KeplerianElements {
  semiMajorAxisM: number;
  eccentricity: number;
  inclinationRad: number;
  raanRad: number;
  argumentOfPeriapsisRad: number;
  trueAnomalyRad: number;
  periapsisRadiusM: number;
  periapsisAltitudeM: number;
  apoapsisRadiusM: number | null;
  apoapsisAltitudeM: number | null;
  orbitalPeriodS: number | null;
  specificEnergyJPerKg: number;
  specificAngularMomentumM2PerS: number;
  conicType: ConicType;
  energyRegime: EnergyRegime;
  periapsisClearance: PeriapsisClearance;
}

const EPSILON_ECCENTRICITY = 1e-4;
const EPSILON_ENERGY = 1e-3;
const EPSILON_SINGULARITY = 1e-7;

/**
 * Robust Keplerian Orbit Analysis & Trajectory Classification
 */
export class OrbitClassifier {
  /**
   * Extracts osculating Keplerian parameters and classifications from state vector (r, v).
   */
  static analyzeOrbit(
    position: IVector3D,
    velocity: IVector3D,
    mu: number = MU_EARTH,
    refRadiusM: number = R_EARTH
  ): KeplerianElements {
    const rx = position.x;
    const ry = position.y;
    const rz = position.z;
    const r = Math.sqrt(rx * rx + ry * ry + rz * rz);

    const vx = velocity.x;
    const vy = velocity.y;
    const vz = velocity.z;
    const v2 = vx * vx + vy * vy + vz * vz;

    // Specific angular momentum h = r x v
    const hx = ry * vz - rz * vy;
    const hy = rz * vx - rx * vz;
    const hz = rx * vy - ry * vx;
    const h2 = hx * hx + hy * hy + hz * hz;
    const h = Math.sqrt(h2);

    // Specific mechanical energy: epsilon = v^2 / 2 - mu / r
    const specificEnergy = 0.5 * v2 - mu / r;

    // Semi-major axis: a = -mu / (2 * epsilon) (valid when epsilon != 0)
    let a: number;
    if (Math.abs(specificEnergy) < EPSILON_ENERGY) {
      a = Infinity; // Parabolic
    } else {
      a = -mu / (2.0 * specificEnergy);
    }

    // Eccentricity vector: e = ((v^2 - mu/r)r - (r.v)v) / mu
    const rDotV = rx * vx + ry * vy + rz * vz;
    const coeffR = v2 - mu / r;
    const ex = (coeffR * rx - rDotV * vx) / mu;
    const ey = (coeffR * ry - rDotV * vy) / mu;
    const ez = (coeffR * rz - rDotV * vz) / mu;
    const e = Math.sqrt(ex * ex + ey * ey + ez * ez);

    // Semi-latus rectum: p = h^2 / mu
    // Periapsis radius: r_p = p / (1 + e) is universally valid for all conic sections (e >= 0)
    const p = mu > 0 ? h2 / mu : 0.0;
    const periapsisRadiusM = 1.0 + e > 0 ? p / (1.0 + e) : 0.0;
    const periapsisAltitudeM = periapsisRadiusM - refRadiusM;

    // Apoapsis radius: defined strictly for bounded elliptical orbits (e < 1.0)
    let apoapsisRadiusM: number | null = null;
    let apoapsisAltitudeM: number | null = null;
    let orbitalPeriodS: number | null = null;

    if (e < 1.0 - EPSILON_ECCENTRICITY && a > 0) {
      apoapsisRadiusM = a * (1.0 + e);
      apoapsisAltitudeM = apoapsisRadiusM - refRadiusM;
      orbitalPeriodS = 2.0 * Math.PI * Math.sqrt(Math.pow(a, 3) / mu);
    }

    // Inclination: i = acos(h_z / h)
    const inc = h > EPSILON_SINGULARITY
      ? Math.acos(Math.max(-1.0, Math.min(1.0, hz / h)))
      : 0.0;

    // Node line vector: n = K x h = [-hy, hx, 0]
    const nx = -hy;
    const ny = hx;
    const n = Math.sqrt(nx * nx + ny * ny);

    // Right Ascension of Ascending Node (RAAN)
    let raan = 0.0;
    if (n > EPSILON_SINGULARITY) {
      raan = Math.atan2(ny, nx);
      if (raan < 0.0) raan += 2.0 * Math.PI;
    }

    // Argument of Periapsis
    let argP = 0.0;
    if (n > EPSILON_SINGULARITY && e > EPSILON_SINGULARITY) {
      const nDotE = (nx * ex + ny * ey) / (n * e);
      argP = Math.acos(Math.max(-1.0, Math.min(1.0, nDotE)));
      if (ez < 0.0) argP = 2.0 * Math.PI - argP;
    }

    // True Anomaly
    let nu = 0.0;
    if (e > EPSILON_SINGULARITY && r > EPSILON_SINGULARITY) {
      const eDotR = (ex * rx + ey * ry + ez * rz) / (e * r);
      nu = Math.acos(Math.max(-1.0, Math.min(1.0, eDotR)));
      if (rDotV < 0.0) nu = 2.0 * Math.PI - nu;
    }

    // 1. Conic Section Classification
    let conicType: ConicType;
    if (e < EPSILON_ECCENTRICITY) {
      conicType = ConicType.CIRCULAR;
    } else if (e < 1.0 - EPSILON_ECCENTRICITY) {
      conicType = ConicType.ELLIPTICAL;
    } else if (Math.abs(e - 1.0) <= EPSILON_ECCENTRICITY) {
      conicType = ConicType.PARABOLIC;
    } else {
      conicType = ConicType.HYPERBOLIC;
    }

    // 2. Mechanical Energy Classification
    let energyRegime: EnergyRegime;
    if (specificEnergy < -EPSILON_ENERGY) {
      energyRegime = EnergyRegime.BOUNDED;
    } else if (Math.abs(specificEnergy) <= EPSILON_ENERGY) {
      energyRegime = EnergyRegime.PARABOLIC_BOUNDARY;
    } else {
      energyRegime = EnergyRegime.UNBOUNDED;
    }

    // 3. Periapsis Clearance / Surface Intersection Classification
    let periapsisClearance: PeriapsisClearance;
    if (periapsisRadiusM < refRadiusM) {
      periapsisClearance = PeriapsisClearance.SURFACE_INTERSECTING;
    } else if (periapsisRadiusM < refRadiusM + H_ATMOSPHERE) {
      periapsisClearance = PeriapsisClearance.ATMOSPHERIC_GRAZING;
    } else {
      periapsisClearance = PeriapsisClearance.SPACE_CLEARED;
    }

    return {
      semiMajorAxisM: a,
      eccentricity: e,
      inclinationRad: inc,
      raanRad: raan,
      argumentOfPeriapsisRad: argP,
      trueAnomalyRad: nu,
      periapsisRadiusM,
      periapsisAltitudeM,
      apoapsisRadiusM,
      apoapsisAltitudeM,
      orbitalPeriodS,
      specificEnergyJPerKg: specificEnergy,
      specificAngularMomentumM2PerS: h,
      conicType,
      energyRegime,
      periapsisClearance,
    };
  }
}
