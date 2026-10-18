import { describe, it, expect } from 'vitest';
import {
  OrbitClassifier,
  ConicType,
  EnergyRegime,
  PeriapsisClearance,
} from '../src/physics/OrbitClassifier';
import { Vector3D } from '../src/physics/Vector3D';
import { R_EARTH, MU_EARTH, H_ATMOSPHERE } from '../src/physics/constants';

describe('Decoupled Trajectory & Orbit Classification', () => {
  it('classifies a standard Circular LEO Orbit (h = 400 km)', () => {
    const r = R_EARTH + 400000.0;
    const vCirc = Math.sqrt(MU_EARTH / r);

    const pos = new Vector3D(r, 0, 0);
    const vel = new Vector3D(0, vCirc, 0);

    const analysis = OrbitClassifier.analyzeOrbit(pos, vel);

    expect(analysis.conicType).toBe(ConicType.CIRCULAR);
    expect(analysis.energyRegime).toBe(EnergyRegime.BOUNDED);
    expect(analysis.periapsisClearance).toBe(PeriapsisClearance.SPACE_CLEARED);
    expect(analysis.eccentricity).toBeCloseTo(0.0, 5);
    expect(analysis.periapsisAltitudeM).toBeCloseTo(400000.0, 1);
    expect(analysis.apoapsisAltitudeM).toBeCloseTo(400000.0, 1);
    expect(analysis.orbitalPeriodS).toBeCloseTo(5544.86, 1);
  });

  it('classifies a stable Elliptical Orbit (perigee = 500 km, apogee = 2000 km)', () => {
    const rP = R_EARTH + 500000.0;
    const rA = R_EARTH + 2000000.0;
    const a = (rP + rA) / 2.0;
    const e = (rA - rP) / (rA + rP);
    const vAtPeriapsis = Math.sqrt(MU_EARTH * (2.0 / rP - 1.0 / a));

    const pos = new Vector3D(rP, 0, 0);
    const vel = new Vector3D(0, vAtPeriapsis, 0);

    const analysis = OrbitClassifier.analyzeOrbit(pos, vel);

    expect(analysis.conicType).toBe(ConicType.ELLIPTICAL);
    expect(analysis.energyRegime).toBe(EnergyRegime.BOUNDED);
    expect(analysis.periapsisClearance).toBe(PeriapsisClearance.SPACE_CLEARED);
    expect(analysis.eccentricity).toBeCloseTo(e, 4);
    expect(analysis.periapsisAltitudeM).toBeCloseTo(500000.0, 1);
    expect(analysis.apoapsisAltitudeM).toBeCloseTo(2000000.0, 1);
  });

  it('classifies an Atmospheric Grazing Orbit (perigee = 60 km, apogee = 500 km)', () => {
    const rP = R_EARTH + 60000.0; // 60 km < 100 km
    const rA = R_EARTH + 500000.0;
    const a = (rP + rA) / 2.0;
    const vAtPeriapsis = Math.sqrt(MU_EARTH * (2.0 / rP - 1.0 / a));

    const pos = new Vector3D(rP, 0, 0);
    const vel = new Vector3D(0, vAtPeriapsis, 0);

    const analysis = OrbitClassifier.analyzeOrbit(pos, vel);

    expect(analysis.conicType).toBe(ConicType.ELLIPTICAL);
    expect(analysis.energyRegime).toBe(EnergyRegime.BOUNDED);
    expect(analysis.periapsisClearance).toBe(PeriapsisClearance.ATMOSPHERIC_GRAZING);
    expect(analysis.periapsisAltitudeM).toBeLessThan(H_ATMOSPHERE);
    expect(analysis.periapsisAltitudeM).toBeGreaterThanOrEqual(0.0);
  });

  it('classifies a Suborbital Ballistic Trajectory (e < 1, surface-intersecting)', () => {
    // Launch apogee at 300 km, but horizontal speed insufficient, so perigee inside Earth (e.g., r_p = 3,000 km < 6,371 km)
    const pos = new Vector3D(R_EARTH + 300000.0, 0, 0);
    const vel = new Vector3D(0, 4000.0, 0); // ~4 km/s << circular ~7.7 km/s

    const analysis = OrbitClassifier.analyzeOrbit(pos, vel);

    expect(analysis.conicType).toBe(ConicType.ELLIPTICAL);
    expect(analysis.energyRegime).toBe(EnergyRegime.BOUNDED);
    expect(analysis.periapsisClearance).toBe(PeriapsisClearance.SURFACE_INTERSECTING);
    expect(analysis.periapsisRadiusM).toBeLessThan(R_EARTH);
  });

  it('classifies a Parabolic Escape Trajectory (e = 1.0, space-cleared)', () => {
    const r = R_EARTH + 500000.0;
    const vEsc = Math.sqrt((2.0 * MU_EARTH) / r);

    const pos = new Vector3D(r, 0, 0);
    const vel = new Vector3D(0, vEsc, 0);

    const analysis = OrbitClassifier.analyzeOrbit(pos, vel);

    expect(analysis.conicType).toBe(ConicType.PARABOLIC);
    expect(analysis.energyRegime).toBe(EnergyRegime.PARABOLIC_BOUNDARY);
    expect(analysis.periapsisClearance).toBe(PeriapsisClearance.SPACE_CLEARED);
    expect(analysis.eccentricity).toBeCloseTo(1.0, 4);
    expect(analysis.specificEnergyJPerKg).toBeCloseTo(0.0, 1);
    expect(analysis.apoapsisRadiusM).toBeNull();
    expect(analysis.orbitalPeriodS).toBeNull();
  });

  it('classifies a Parabolic Trajectory that Intersects the Surface (e = 1.0, r_p < R_E)', () => {
    // Exactly parabolic speed: v = v_esc
    const r = R_EARTH + 5000000.0;
    const vEsc = Math.sqrt((2.0 * MU_EARTH) / r);

    // Aimed inward: angle 0.05 rad from radial vector
    const theta = 0.05;
    const pos = new Vector3D(r, 0, 0);
    const vel = new Vector3D(-vEsc * Math.cos(theta), vEsc * Math.sin(theta), 0);

    const analysis = OrbitClassifier.analyzeOrbit(pos, vel);

    expect(analysis.conicType).toBe(ConicType.PARABOLIC);
    expect(analysis.energyRegime).toBe(EnergyRegime.PARABOLIC_BOUNDARY);
    expect(analysis.periapsisClearance).toBe(PeriapsisClearance.SURFACE_INTERSECTING);
    expect(analysis.periapsisRadiusM).toBeLessThan(R_EARTH);
  });

  it('classifies a Hyperbolic Escape Trajectory (e > 1, space-cleared flyby)', () => {
    const rP = R_EARTH + 1000000.0; // 1,000 km altitude flyby
    const vInf = 3000.0; // 3 km/s excess velocity
    const vAtPeriapsis = Math.sqrt(vInf * vInf + (2.0 * MU_EARTH) / rP);

    const pos = new Vector3D(rP, 0, 0);
    const vel = new Vector3D(0, vAtPeriapsis, 0);

    const analysis = OrbitClassifier.analyzeOrbit(pos, vel);

    expect(analysis.conicType).toBe(ConicType.HYPERBOLIC);
    expect(analysis.energyRegime).toBe(EnergyRegime.UNBOUNDED);
    expect(analysis.periapsisClearance).toBe(PeriapsisClearance.SPACE_CLEARED);
    expect(analysis.eccentricity).toBeGreaterThan(1.0);
    expect(analysis.specificEnergyJPerKg).toBeGreaterThan(0.0);
    expect(analysis.apoapsisRadiusM).toBeNull();
    expect(analysis.orbitalPeriodS).toBeNull();
  });

  it('classifies a Hyperbolic Trajectory that Intersects the Surface (e > 1, meteor impact case)', () => {
    // Interstellar or hyperbolic object heading straight into Earth
    const pos = new Vector3D(R_EARTH + 2000000.0, 0, 0);
    const vel = new Vector3D(-15000.0, 500.0, 0); // 15 km/s towards Earth, small transverse speed

    const analysis = OrbitClassifier.analyzeOrbit(pos, vel);

    expect(analysis.conicType).toBe(ConicType.HYPERBOLIC);
    expect(analysis.energyRegime).toBe(EnergyRegime.UNBOUNDED);
    // Crucial: Hyperbolic trajectory intersecting solid Earth!
    expect(analysis.periapsisClearance).toBe(PeriapsisClearance.SURFACE_INTERSECTING);
    expect(analysis.periapsisRadiusM).toBeLessThan(R_EARTH);
  });
});
