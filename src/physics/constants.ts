/**
 * Canonical Astrodynamic & Physical Constants
 * Standard Reference: WGS-84 / IERS Conventions / U.S. Standard Atmosphere 1976
 *
 * UNIFIED REFERENCE RADIUS CONVENTION:
 * Mean Volumetric Earth Radius: R_E = 6,371,000.0 m (6,371.0 km)
 * All orbital altitudes h are measured relative to this reference radius: r = R_E + h.
 */

// Fundamental Physical Constants (CODATA 2018)
export const G_NEWTON = 6.6743e-11; // m^3 / (kg * s^2) (Universal Gravitational Constant)

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

// Solar System Gravitational Parameters & Planetary Reference (IAU / NASA Planetary Fact Sheets)
export const MU_SUN = 1.32712440018e20; // m^3 / s^2 (Standard gravitational parameter of Sun)
export const AU = 149597870700.0; // m (Astronomical Unit)

export interface PlanetaryBodyData {
  id: string;
  name: string;
  mu: number; // m^3 / s^2
  radiusM: number; // m (mean volumetric physical radius)
  semiMajorAxisM: number; // m
  orbitalSpeedMPerS: number; // m/s (circular speed sqrt(mu_Sun / a))
  massKg: number; // kg
  color: string;
  description: string;
  ringInnerRadiusM?: number;
  ringOuterRadiusM?: number;
  isTheoretical?: boolean;
  customVelocityMPerS?: { x: number; y: number; z: number };
}

export const PLANETARY_BODIES: Record<string, PlanetaryBodyData> = {
  JUPITER: {
    id: 'JUPITER',
    name: 'Jupiter',
    mu: 1.26686534e17, // m^3 / s^2 (GM_J)
    radiusM: 69911000.0, // 69,911 km mean volumetric radius
    semiMajorAxisM: 778570000000.0, // 5.204 AU
    orbitalSpeedMPerS: Math.sqrt(1.32712440018e20 / 778570000000.0), // ~13,056 m/s (~13.06 km/s)
    massKg: 1.89813e27,
    color: '#d4a373',
    description: 'Gas giant with immense gravitational well. Primary planetary accelerator for outer solar system missions.',
  },
  SATURN: {
    id: 'SATURN',
    name: 'Saturn',
    mu: 3.7931187e16, // m^3 / s^2 (GM_S)
    radiusM: 58232000.0, // 58,232 km mean volumetric radius
    semiMajorAxisM: 1433530000000.0, // 9.582 AU
    orbitalSpeedMPerS: Math.sqrt(1.32712440018e20 / 1433530000000.0), // ~9,618 m/s (~9.62 km/s)
    massKg: 5.6834e26,
    color: '#e0cda9',
    description: 'Second largest gas giant with prominent rings. Used by Voyager and Cassini for trajectory shaping.',
    ringInnerRadiusM: 74500000.0, // 74,500 km
    ringOuterRadiusM: 136775000.0, // 136,775 km
  },
  EARTH: {
    id: 'EARTH',
    name: 'Earth',
    mu: MU_EARTH,
    radiusM: R_EARTH,
    semiMajorAxisM: AU,
    orbitalSpeedMPerS: Math.sqrt(1.32712440018e20 / AU), // ~29,784 m/s
    massKg: 5.9722e24,
    color: '#4f9fff',
    description: 'Home world and initial launch platform. Often used for resonant flyby assists (e.g. Cassini, Galileo).',
  },
  VENUS: {
    id: 'VENUS',
    name: 'Venus',
    mu: 3.24859e14,
    radiusM: 6051800.0,
    semiMajorAxisM: 108208000000.0, // 0.723 AU
    orbitalSpeedMPerS: Math.sqrt(1.32712440018e20 / 108208000000.0), // ~35,020 m/s
    massKg: 4.8675e24,
    color: '#e6a15c',
    description: 'Dense terrestrial planet used for inner-solar system gravity braking and outbound slingshots.',
  },
  MERCURY: {
    id: 'MERCURY',
    name: 'Mercury',
    mu: 2.2032e13, // m^3 / s^2 (GM_M)
    radiusM: 2439700.0, // 2,439.7 km
    semiMajorAxisM: 57909050000.0, // 0.387 AU
    orbitalSpeedMPerS: Math.sqrt(1.32712440018e20 / 57909050000.0), // ~47,872 m/s
    massKg: 3.3011e23,
    color: '#9e9e9e',
    description: 'Innermost terrestrial planet. High orbital velocity requires massive gravity-braking assist to reach.',
  },
  URANUS: {
    id: 'URANUS',
    name: 'Uranus',
    mu: 5.793939e15, // m^3 / s^2 (GM_U)
    radiusM: 25362000.0, // 25,362 km
    semiMajorAxisM: 2870972000000.0, // 19.191 AU
    orbitalSpeedMPerS: Math.sqrt(1.32712440018e20 / 2870972000000.0), // ~6,799 m/s
    massKg: 8.681e25,
    color: '#70d6ff',
    description: 'Ice giant visited by Voyager 2 in January 1986. Gravity assist accelerated probe toward Neptune.',
    ringInnerRadiusM: 38000000.0,
    ringOuterRadiusM: 51149000.0,
  },
  NEPTUNE: {
    id: 'NEPTUNE',
    name: 'Neptune',
    mu: 6.836529e15, // m^3 / s^2 (GM_N)
    radiusM: 24622000.0, // 24,622 km
    semiMajorAxisM: 4498253000000.0, // 30.069 AU
    orbitalSpeedMPerS: Math.sqrt(1.32712440018e20 / 4498253000000.0), // ~5,431 m/s
    massKg: 1.02413e26,
    color: '#3a86ff',
    description: 'Outermost ice giant. Voyager 2 flew over its north pole in August 1989 for a southward escape.',
  },
};

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
