import { describe, it, expect } from 'vitest';
import {
  R_EARTH,
  MU_EARTH,
  T_SIDEREAL_EARTH,
  OMEGA_EARTH,
  BENCHMARKS,
} from '../src/physics/constants';

describe('Astrodynamic Constants & Orbital Benchmarks', () => {
  it('enforces unified Earth mean volumetric radius convention (6,371.0 km)', () => {
    expect(R_EARTH).toBe(6371000.0);
  });

  it('verifies Surface Benchmark calculations', () => {
    const { altitudeM, radiusM, circularSpeedMPerS, escapeSpeedMPerS, periodS } = BENCHMARKS.SURFACE;
    expect(altitudeM).toBe(0.0);
    expect(radiusM).toBe(6371000.0);

    // v_circ = sqrt(mu / r)
    expect(circularSpeedMPerS).toBeCloseTo(7909.80, 1);

    // v_esc = sqrt(2) * v_circ
    expect(escapeSpeedMPerS).toBeCloseTo(Math.SQRT2 * circularSpeedMPerS, 6);
    expect(escapeSpeedMPerS).toBeCloseTo(11186.13, 1);

    // Period = 2*pi*sqrt(r^3 / mu)
    expect(periodS).toBeCloseTo(5060.84, 1); // ~84.35 min
  });

  it('verifies LEO 200 km Benchmark calculations', () => {
    const { altitudeM, radiusM, circularSpeedMPerS, escapeSpeedMPerS, periodS } = BENCHMARKS.LEO_200KM;
    expect(altitudeM).toBe(200000.0);
    expect(radiusM).toBe(6571000.0);

    expect(circularSpeedMPerS).toBeCloseTo(7788.49, 1);
    expect(escapeSpeedMPerS).toBeCloseTo(11014.59, 1);
    expect(periodS).toBeCloseTo(5301.00, 1); // ~88.35 min
  });

  it('verifies LEO 400 km ISS Benchmark calculations', () => {
    const { altitudeM, radiusM, circularSpeedMPerS, escapeSpeedMPerS, periodS } = BENCHMARKS.LEO_400KM_ISS;
    expect(altitudeM).toBe(400000.0);
    expect(radiusM).toBe(6771000.0);

    expect(circularSpeedMPerS).toBeCloseTo(7672.60, 1);
    expect(escapeSpeedMPerS).toBeCloseTo(10850.69, 1);
    expect(periodS).toBeCloseTo(5544.86, 1); // ~92.41 min
  });

  it('verifies Geostationary (GEO) Benchmark calculations against reconciled Earth radius', () => {
    const { altitudeM, radiusM, circularSpeedMPerS, escapeSpeedMPerS, periodS } = BENCHMARKS.GEO;

    // Radius must equal cbrt(mu / omega^2)
    const expectedGeoRadius = Math.cbrt(MU_EARTH / Math.pow(OMEGA_EARTH, 2));
    expect(radiusM).toBeCloseTo(expectedGeoRadius, 1); // ~42,164,170 m

    // Altitude above R_E = 6,371,000 m must be ~35,793,170 m (35,793.17 km)
    expect(altitudeM).toBeCloseTo(expectedGeoRadius - 6371000.0, 1);
    expect(altitudeM).toBeCloseTo(35793169.6, 0);

    expect(circularSpeedMPerS).toBeCloseTo(3074.66, 1);
    expect(escapeSpeedMPerS).toBeCloseTo(4348.23, 1);
    expect(periodS).toBeCloseTo(T_SIDEREAL_EARTH, 4); // 86,164.0905 s (1 sidereal day)
  });
});
