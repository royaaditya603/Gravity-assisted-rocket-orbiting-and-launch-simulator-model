/**
 * TrajectoryPredictor.ts
 * 
 * High-fidelity analytical Keplerian trajectory predictor for osculating orbital paths.
 * 
 * Computes exact conic sections (circular, elliptical, parabolic, hyperbolic) in 3D ECI coordinates
 * from instantaneous position and velocity vectors.
 * 
 * Features:
 * - Robust handling of near-parabolic regimes (e -> 1) without division by zero.
 * - Explicit surface collision detection: flags trajectories that penetrate Earth's surface (rp < R_E).
 * - Exact Euler 3-1-3 orbital plane to ECI frame transformations.
 * - Guaranteed finite, non-NaN coordinate arrays suitable for 3D splines and analysis.
 */

import { Vector3D, IVector3D } from '../physics/Vector3D';
import { R_EARTH, MU_EARTH } from '../physics/constants';
import { OrbitClassifier, KeplerianElements, ConicType, EnergyRegime, PeriapsisClearance } from '../physics/OrbitClassifier';

export interface TrajectoryPrediction {
  /** Array of 3D points along the predicted trajectory in ECI [meters] */
  points: Vector3D[];
  /** Whether the trajectory is a closed periodic orbit (e < 1) */
  isClosed: boolean;
  /** Whether the trajectory intersects the physical surface of Earth (rp < R_E) */
  isSurfaceIntersecting: boolean;
  /** Estimated point of surface impact if trajectory intersects surface [m] */
  surfaceImpactPoint: Vector3D | null;
  /** Periapsis position vector in ECI [m] */
  periapsisPosition: Vector3D;
  /** Apoapsis position vector in ECI [m] (null for unbounded parabolic/hyperbolic) */
  apoapsisPosition: Vector3D | null;
  /** Periapsis altitude above spherical Earth [km] */
  periapsisAltitudeKm: number;
  /** Apoapsis altitude above spherical Earth [km] (null for unbounded) */
  apoapsisAltitudeKm: number | null;
  /** Eccentricity */
  eccentricity: number;
  /** Semi-major axis [m] (negative for hyperbola) */
  semiMajorAxisM: number;
  /** Orbital period [s] (null for unbounded trajectories) */
  orbitalPeriodS: number | null;
  /** Conic section type */
  conicType: ConicType;
  /** Energy regime */
  energyRegime: EnergyRegime;
  /** Clearance classification */
  clearance: PeriapsisClearance;
}

export interface PredictionOptions {
  /** Number of discrete sample points along the path (default: 120) */
  samplesCount?: number;
  /** Planetary central body radius [m] (default: R_EARTH = 6,371,000 m) */
  bodyRadiusM?: number;
  /** Gravitational parameter mu [m^3/s^2] (default: MU_EARTH = 3.986004418e14) */
  mu?: number;
  /** Maximum radial distance for open trajectories [m] (default: 20 * R_EARTH) */
  maxRadialDistanceM?: number;
}

export class TrajectoryPredictor {
  /**
   * Predict the osculating trajectory from instantaneous state vectors r and v
   */
  public static predict(
    position: IVector3D,
    velocity: IVector3D,
    options: PredictionOptions = {}
  ): TrajectoryPrediction {
    const samplesCount = options.samplesCount ?? 120;
    const R_body = options.bodyRadiusM ?? R_EARTH;
    const mu = options.mu ?? MU_EARTH;
    const maxRadialDist = options.maxRadialDistanceM ?? R_body * 20.0;

    const rVec = new Vector3D(position.x, position.y, position.z);
    const vVec = new Vector3D(velocity.x, velocity.y, velocity.z);
    const rMag = rVec.magnitude();
    const vMag = vVec.magnitude();

    // Guard against zero position or zero speed
    if (rMag < 1.0 || !Number.isFinite(rMag) || !Number.isFinite(vMag)) {
      return this.createDegeneratePrediction(rVec, R_body);
    }

    // Classify orbit via validated physical analyzer
    const elements: KeplerianElements = OrbitClassifier.analyzeOrbit(rVec, vVec, mu);
    const {
      semiMajorAxisM: a,
      eccentricity: e,
      inclinationRad: inc,
      raanRad: raan,
      argumentOfPeriapsisRad: argP,
      periapsisRadiusM: rp,
      apoapsisRadiusM: ra,
      orbitalPeriodS: period,
      conicType,
      energyRegime,
      periapsisClearance,
    } = elements;

    const isClosed = e < 1.0 - 1e-4 && a > 0;
    const isSurfaceIntersecting = rp < R_body;

    // Semi-latus rectum: p = h^2 / mu = a * (1 - e^2) for ellipse/hyperbola, or rp * (1 + e)
    const hVec = Vector3D.cross(rVec, vVec);
    const hMag = hVec.magnitude();
    const p = hMag > 1e-6 ? (hMag * hMag) / mu : rp * (1.0 + e);

    // Compute basis unit vectors P (periapsis direction) and Q (semi-latus rectum direction) in ECI
    const { P, Q } = this.computePerifocalBasis(inc, raan, argP);

    // Periapsis and Apoapsis vectors in ECI
    const periapsisPos = P.clone().scale(rp);
    const apoapsisPos = isClosed && ra !== null ? P.clone().scale(-ra) : null;

    // Surface impact estimation if trajectory intersects Earth
    let surfaceImpactPoint: Vector3D | null = null;
    let impactTrueAnomalyRad: number | null = null;

    if (isSurfaceIntersecting && p > 0) {
      // r(theta) = p / (1 + e * cos(theta)) = R_body
      // cos(theta_impact) = (p / R_body - 1) / e
      const cosImpact = (p / R_body - 1.0) / (e > 1e-6 ? e : 1.0);
      if (cosImpact >= -1.0 && cosImpact <= 1.0) {
        impactTrueAnomalyRad = Math.acos(cosImpact);
        // Point of impact in perifocal frame (negative true anomaly if descending, positive if ascending)
        const radVel = Vector3D.dot(rVec, vVec) / rMag;
        const thetaImp = radVel < 0 ? -impactTrueAnomalyRad : impactTrueAnomalyRad;
        surfaceImpactPoint = this.perifocalToCartesian(R_body, thetaImp, P, Q);
      }
    }

    const points: Vector3D[] = [];

    if (isClosed) {
      // Bounded Elliptical Orbit: full 360-degree sweep
      for (let i = 0; i <= samplesCount; i++) {
        const theta = (2.0 * Math.PI * i) / samplesCount;
        const denom = 1.0 + e * Math.cos(theta);
        if (Math.abs(denom) < 1e-7) continue;
        const r = p / denom;
        if (r > 0 && Number.isFinite(r)) {
          points.push(this.perifocalToCartesian(r, theta, P, Q));
        }
      }
    } else {
      // Parabolic (e approx 1) or Hyperbolic (e > 1) Orbit
      // Asymptote angle: cos(theta_inf) = -1/e
      let maxTheta: number;
      if (e > 1.0001) {
        const thetaInf = Math.acos(-1.0 / e);
        maxTheta = thetaInf * 0.90; // Stay comfortably inside asymptotes
      } else {
        // Parabola or near-parabola
        maxTheta = Math.PI * 0.70;
      }

      for (let i = -samplesCount / 2; i <= samplesCount / 2; i++) {
        const theta = (maxTheta * i) / (samplesCount / 2);
        const denom = 1.0 + e * Math.cos(theta);
        if (denom <= 1e-5) continue;
        const r = p / denom;
        if (r > 0 && r <= maxRadialDist && Number.isFinite(r)) {
          points.push(this.perifocalToCartesian(r, theta, P, Q));
        }
      }
    }

    return {
      points,
      isClosed,
      isSurfaceIntersecting,
      surfaceImpactPoint,
      periapsisPosition: periapsisPos,
      apoapsisPosition: apoapsisPos,
      periapsisAltitudeKm: (rp - R_body) / 1000.0,
      apoapsisAltitudeKm: isClosed && ra !== null ? (ra - R_body) / 1000.0 : null,
      eccentricity: e,
      semiMajorAxisM: a,
      orbitalPeriodS: period,
      conicType,
      energyRegime,
      clearance: periapsisClearance,
    };
  }

  /**
   * Computes the perifocal reference unit vectors P (periapsis) and Q (in-plane normal to P) in ECI coordinates.
   * Uses standard 3-1-3 Euler angle rotation (RAAN Omega, Inclination i, Argument of Periapsis omega).
   */
  private static computePerifocalBasis(
    incRad: number,
    raanRad: number,
    argPRad: number
  ): { P: Vector3D; Q: Vector3D } {
    const cosO = Math.cos(raanRad);
    const sinO = Math.sin(raanRad);
    const cosW = Math.cos(argPRad);
    const sinW = Math.sin(argPRad);
    const cosI = Math.cos(incRad);
    const sinI = Math.sin(incRad);

    // Vector P: unit vector pointing towards periapsis
    const P = new Vector3D(
      cosO * cosW - sinO * sinW * cosI,
      sinO * cosW + cosO * sinW * cosI,
      sinW * sinI
    );

    // Vector Q: unit vector in orbital plane 90 deg ahead of periapsis (at true anomaly = 90 deg)
    const Q = new Vector3D(
      -cosO * sinW - sinO * cosW * cosI,
      -sinO * sinW + cosO * cosW * cosI,
      cosW * sinI
    );

    return { P: P.normalize(), Q: Q.normalize() };
  }

  /**
   * Converts radial distance r and true anomaly theta to 3D Cartesian coordinates in ECI
   */
  private static perifocalToCartesian(
    r: number,
    theta: number,
    P: Vector3D,
    Q: Vector3D
  ): Vector3D {
    const xp = r * Math.cos(theta);
    const yp = r * Math.sin(theta);
    return new Vector3D(
      xp * P.x + yp * Q.x,
      xp * P.y + yp * Q.y,
      xp * P.z + yp * Q.z
    );
  }

  /**
   * Fallback prediction for degenerate or resting states
   */
  private static createDegeneratePrediction(pos: Vector3D, R_body: number): TrajectoryPrediction {
    const rMag = Math.max(R_body, pos.magnitude());
    return {
      points: [pos.clone()],
      isClosed: false,
      isSurfaceIntersecting: true,
      surfaceImpactPoint: pos.clone(),
      periapsisPosition: pos.clone(),
      apoapsisPosition: null,
      periapsisAltitudeKm: (rMag - R_body) / 1000.0,
      apoapsisAltitudeKm: null,
      eccentricity: 1.0,
      semiMajorAxisM: rMag,
      orbitalPeriodS: null,
      conicType: ConicType.ELLIPTICAL,
      energyRegime: EnergyRegime.BOUNDED,
      clearance: PeriapsisClearance.SURFACE_INTERSECTING,
    };
  }
}
