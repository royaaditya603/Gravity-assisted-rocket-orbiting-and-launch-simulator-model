/**
 * Canonical Astrodynamic & Physical Constants
 * Standard Reference: WGS-84 / IERS Conventions / U.S. Standard Atmosphere 1976
 *
 * UNIFIED REFERENCE RADIUS CONVENTION:
 * Mean Volumetric Earth Radius: R_E = 6,371,000.0 m (6,371.0 km)
 * All orbital altitudes h are measured relative to this reference radius: r = R_E + h.
 */

// Earth Gravitational Parameters
export const MU_EARTH = 3.986004418e14; // m^3 / s^2 (Standard gravitational parameter GM)
export const R_EARTH = 6371000.0; // m (Mean volumetric spherical radius: 6,371.0 km)
export const G_0 = 9.80665; // m / s^2 (Standard surface gravitational acceleration)

// Earth Rotation
export const T_SIDEREAL_EARTH = 86164.0905; // s (Nominal Earth sidereal rotation period: 23h 56m 4.0905s)
export const OMEGA_EARTH = (2.0 * Math.PI) / T_SIDEREAL_EARTH; // rad / s (~7.29211505e-5 rad/s)

// Atmospheric Parameters (Isothermal Exponential Hydrostatic Barometric Model)
export const RHO_0 = 1.2250; // kg / m^3 (Sea-level standard atmospheric density at 288.15 K)
export const P_0 = 101325.0; // Pa (Sea-level standard atmospheric pressure)
export const H_SCALE = 8500.0; // m (Density scale height: 8.5 km)
export const H_ATMOSPHERE = 100000.0; // m (100.0 km - Kármán line boundary for aerodynamic drag cutoff)

// Planetary Flyby / Gravity Assist Body Reference (e.g., Moon scale for simulation scenario)
export const MU_MOON = 4.9048695e12; // m^3 / s^2
export const R_MOON = 1737400.0; // m (1,737.4 km)

// Canonical Verification Benchmarks (calculated strictly against R_EARTH = 6,371,000.0 m)
export const BENCHMARKS = {
  SURFACE: {
    altitudeM: 0.0,
    radiusM: R_EARTH,
    circularSpeedMPerS: Math.sqrt(MU_EARTH / R_EARTH), // ~7909.799 m/s
    escapeSpeedMPerS: Math.sqrt((2.0 * MU_EARTH) / R_EARTH), // ~11186.130 m/s
    periodS: 2.0 * Math.PI * Math.sqrt(Math.pow(R_EARTH, 3) / MU_EARTH), // ~5060.837 s (84.35 min)
  },
  LEO_200KM: {
    altitudeM: 200000.0,
    radiusM: R_EARTH + 200000.0, // 6,571,000.0 m
    circularSpeedMPerS: Math.sqrt(MU_EARTH / (R_EARTH + 200000.0)), // ~7788.488 m/s
    escapeSpeedMPerS: Math.sqrt((2.0 * MU_EARTH) / (R_EARTH + 200000.0)), // ~11014.585 m/s
    periodS: 2.0 * Math.PI * Math.sqrt(Math.pow(R_EARTH + 200000.0, 3) / MU_EARTH), // ~5301.000 s (88.35 min)
  },
  LEO_400KM_ISS: {
    altitudeM: 400000.0,
    radiusM: R_EARTH + 400000.0, // 6,771,000.0 m
    circularSpeedMPerS: Math.sqrt(MU_EARTH / (R_EARTH + 400000.0)), // ~7672.599 m/s
    escapeSpeedMPerS: Math.sqrt((2.0 * MU_EARTH) / (R_EARTH + 400000.0)), // ~10850.692 m/s
    periodS: 2.0 * Math.PI * Math.sqrt(Math.pow(R_EARTH + 400000.0, 3) / MU_EARTH), // ~5544.855 s (92.41 min)
  },
  GEO: {
    radiusM: Math.cbrt(MU_EARTH / Math.pow(OMEGA_EARTH, 2)), // 42,164,169.62 m
    altitudeM: Math.cbrt(MU_EARTH / Math.pow(OMEGA_EARTH, 2)) - R_EARTH, // 35,793,169.62 m (35,793.17 km)
    circularSpeedMPerS: Math.sqrt(MU_EARTH / Math.cbrt(MU_EARTH / Math.pow(OMEGA_EARTH, 2))), // ~3074.659 m/s
    escapeSpeedMPerS: Math.sqrt((2.0 * MU_EARTH) / Math.cbrt(MU_EARTH / Math.pow(OMEGA_EARTH, 2))), // ~4348.225 m/s
    periodS: T_SIDEREAL_EARTH, // 86,164.0905 s (1 sidereal day)
  },
} as const;
