/**
 * ASTRA - Central Planetary Data & Physical Constants Module
 *
 * All base quantities are strictly in SI units:
 *   - Distance / Length: metres (m)
 *   - Mass: kilograms (kg)
 *   - Time: seconds (s)
 *   - Velocity: metres per second (m/s)
 *   - Gravitational Parameter: m^3 / s^2
 *
 * DOCUMENTATION & REFERENCE SOURCES:
 * 1. CODATA 2018 Recommended Values of the Fundamental Physical Constants:
 *    - Universal Gravitational Constant: G = 6.67430(15)e-11 m^3 / (kg * s^2)
 * 2. IAU / IAG Working Group on Cartographic Coordinates and Rotational Elements (WGCCRE 2015):
 *    - Planetary mean volumetric radii (R_p)
 * 3. NASA Planetary Fact Sheets (Dr. David R. Williams, NASA Goddard Space Flight Center, 2024):
 *    - Planetary masses, standard gravitational parameters (GM), semi-major axes, orbital periods.
 * 4. JPL Solar System Dynamics (SSD) Group / Ephemeris DE440:
 *    - Heliocentric gravitational parameter: MU_SUN = 1.32712440018e20 m^3 / s^2
 *    - Astronomical Unit (AU): Exactly 149,597,870,700 m (IAU 2012 Resolution B2)
 *
 * MODEL ASSUMPTION & SIMPLIFICATION NOTICE:
 * Planetary presets in ASTRA are simplified, educational physical models:
 * - Planets are modeled as spherically symmetric point-mass gravitational sources (J2/J4 zonal harmonics neglected).
 * - Planetary heliocentric orbits are modeled as coplanar circular orbits at mean orbital distance.
 *   This is an engineering and pedagogical approximation; actual interplanetary trajectories
 *   (e.g., Voyager, Cassini, New Horizons) require high-fidelity numerical ephemerides (JPL Horizons / SPICE).
 */

// Fundamental Physical Constants (CODATA 2018)
export const G = 6.6743e-11; // m^3 / (kg * s^2)
export const G_NEWTON = G;

// Astrodynamic Solar & Earth Constants
export const AU = 149597870700.0; // m (IAU 2012 standard astronomical unit)
export const MU_SUN = 1.32712440018e20; // m^3 / s^2 (Standard gravitational parameter of the Sun)
export const SUN_MU = MU_SUN; // Compatibility alias
export const SECONDS_PER_DAY = 86400.0; // s
export const G_0 = 9.80665; // m / s^2 (Standard Earth surface gravity acceleration)

export interface PlanetaryBodyData {
  id: string;
  name: string;
  mu: number; // m^3 / s^2 (Standard gravitational parameter GM)
  radiusM: number; // m (Mean volumetric physical radius)
  semiMajorAxisM: number; // m (Mean heliocentric orbital distance)
  orbitalSpeedMPerS: number; // m/s (Circular orbit speed: sqrt(MU_SUN / semiMajorAxisM))
  massKg: number; // kg
  color: string;
  description: string;
  source: string;
  sourceOrReference?: string;
  isTheoretical?: boolean;
  isSimplifiedModel: boolean;
  modelNotes: string;
  modelSimplificationNote?: string;
  ringInnerRadiusM?: number;
  ringOuterRadiusM?: number;
  customVelocityMPerS?: { x: number; y: number; z: number };

  // Compatibility aliases for older test code
  orbitalRadiusM: number;
  orbitalSpeedMs: number;
}

export type CelestialBody = PlanetaryBodyData;

// Documented Planetary Presets (SI Units)
export const JUPITER_PRESET: PlanetaryBodyData = {
  id: 'JUPITER',
  name: 'Jupiter',
  mu: 1.26686534e17, // m^3 / s^2 (NASA Planetary Fact Sheet / JPL DE440)
  radiusM: 69911000.0, // 69,911 km mean volumetric radius (IAU WGCCRE 2015)
  semiMajorAxisM: 778570000000.0, // 5.204 AU
  orbitalSpeedMPerS: Math.sqrt(MU_SUN / 778570000000.0), // ~13,056 m/s (~13.06 km/s)
  massKg: 1.89813e27, // 1.89813 x 10^26 kg
  color: '#d4a373',
  description:
    'Largest gas giant in the Solar System. Dominant gravitational well for outer-system gravity assists (Pioneer 10/11, Voyager 1/2, Cassini, New Horizons).',
  source: 'NASA Planetary Fact Sheet / JPL DE440 (2024)',
  isSimplifiedModel: true,
  modelNotes: 'Simplified spherical model in circular heliocentric orbit (e=0.0487 neglected).',
  orbitalRadiusM: 778570000000.0,
  orbitalSpeedMs: 13070,
};

export const SATURN_PRESET: PlanetaryBodyData = {
  id: 'SATURN',
  name: 'Saturn',
  mu: 3.7931187e16, // m^3 / s^2 (NASA Planetary Fact Sheet)
  radiusM: 58232000.0, // 58,232 km mean volumetric radius
  semiMajorAxisM: 1433530000000.0, // 9.582 AU
  orbitalSpeedMPerS: Math.sqrt(MU_SUN / 1433530000000.0), // ~9,618 m/s (~9.62 km/s)
  massKg: 5.6834e26,
  color: '#e0cda9',
  description:
    'Second largest gas giant with prominent ring system. Used by Voyager 1/2 to reach Uranus, Neptune, and interstellar space.',
  source: 'NASA Planetary Fact Sheet / IAU 2015',
  isSimplifiedModel: true,
  modelNotes: 'Simplified spherical body; ring system modeled from 74,500 km to 136,775 km.',
  ringInnerRadiusM: 74500000.0, // 74,500 km
  ringOuterRadiusM: 136775000.0, // 136,775 km
  orbitalRadiusM: 1433530000000.0,
  orbitalSpeedMs: 9680,
};

export const EARTH_PRESET: PlanetaryBodyData = {
  id: 'EARTH',
  name: 'Earth',
  mu: 3.986004418e14, // m^3 / s^2 (IERS Conventions 2010 / WGS-84 standard GM)
  radiusM: 6371000.0, // 6,371.0 km mean volumetric spherical radius (IUGG / WGS-84)
  semiMajorAxisM: AU, // 1.000 AU (149,597,870.7 km)
  orbitalSpeedMPerS: Math.sqrt(MU_SUN / AU), // ~29,784 m/s (~29.78 km/s)
  massKg: 5.9722e24, // 5.9722 x 10^24 kg
  color: '#4f9fff',
  description:
    'Third terrestrial planet and primary mission launch point. Frequently used for resonant Earth-Earth flyby slingshots (Galileo, Cassini, Rosetta, BepiColombo).',
  source: 'IERS Conventions 2010 / WGS-84 / NASA Fact Sheet',
  isSimplifiedModel: true,
  modelNotes: 'Mean volumetric spherical radius (6,371.0 km). Oblateness (f=1/298.257) neglected.',
  orbitalRadiusM: AU,
  orbitalSpeedMs: 29780,
};

export const MARS_PRESET: PlanetaryBodyData = {
  id: 'MARS',
  name: 'Mars',
  mu: 4.282837e13, // m^3 / s^2 (NASA Planetary Fact Sheet)
  radiusM: 3389500.0, // 3,389.5 km mean volumetric radius
  semiMajorAxisM: 227920000000.0, // 1.524 AU
  orbitalSpeedMPerS: Math.sqrt(MU_SUN / 227920000000.0), // ~24,070 m/s (~24.07 km/s)
  massKg: 6.4171e23, // 6.4171 x 10^23 kg
  color: '#e27b58',
  description:
    'Fourth terrestrial planet. Used by Rosetta (2007) and Dawn (2009) to adjust heliocentric inclination and energy towards the asteroid belt.',
  source: 'NASA Planetary Fact Sheet (2024)',
  isSimplifiedModel: true,
  modelNotes: 'Simplified spherical body in circular orbit (Mars actual orbital eccentricity e=0.0934).',
  orbitalRadiusM: 227920000000.0,
  orbitalSpeedMs: 24070,
};

export const VENUS_PRESET: PlanetaryBodyData = {
  id: 'VENUS',
  name: 'Venus',
  mu: 3.24859e14, // m^3 / s^2 (NASA Planetary Fact Sheet)
  radiusM: 6051800.0, // 6,051.8 km mean radius
  semiMajorAxisM: 108208000000.0, // 0.723 AU
  orbitalSpeedMPerS: Math.sqrt(MU_SUN / 108208000000.0), // ~35,020 m/s
  massKg: 4.8675e24,
  color: '#e6a15c',
  description:
    'Dense terrestrial planet used for multiple inner-solar system gravity braking assists (MESSENGER, Parker Solar Probe, BepiColombo).',
  source: 'NASA Planetary Fact Sheet',
  isSimplifiedModel: true,
  modelNotes: 'Near-circular orbit (e=0.0067); atmospheric drag boundary not modeled in outer patched conic.',
  orbitalRadiusM: 108208000000.0,
  orbitalSpeedMs: 35020,
};

export const MERCURY_PRESET: PlanetaryBodyData = {
  id: 'MERCURY',
  name: 'Mercury',
  mu: 2.2032e13,
  radiusM: 2439700.0,
  semiMajorAxisM: 57909050000.0, // 0.387 AU
  orbitalSpeedMPerS: Math.sqrt(MU_SUN / 57909050000.0), // ~47,872 m/s
  massKg: 3.3011e23,
  color: '#9e9e9e',
  description: 'Innermost terrestrial planet with high orbital speed requiring multiple gravity braking encounters.',
  source: 'NASA Planetary Fact Sheet',
  isSimplifiedModel: true,
  modelNotes: 'Eccentric orbit (e=0.2056) simplified to circular mean distance.',
  orbitalRadiusM: 57909050000.0,
  orbitalSpeedMs: 47360,
};

export const URANUS_PRESET: PlanetaryBodyData = {
  id: 'URANUS',
  name: 'Uranus',
  mu: 5.793939e15,
  radiusM: 25362000.0,
  semiMajorAxisM: 2870972000000.0, // 19.191 AU
  orbitalSpeedMPerS: Math.sqrt(MU_SUN / 2870972000000.0), // ~6,799 m/s
  massKg: 8.681e25,
  color: '#70d6ff',
  description: 'Ice giant visited by Voyager 2 in January 1986, redirecting the trajectory onward to Neptune.',
  source: 'NASA Planetary Fact Sheet',
  isSimplifiedModel: true,
  modelNotes: 'Simplified spherical model in circular orbit.',
  ringInnerRadiusM: 38000000.0,
  ringOuterRadiusM: 51149000.0,
  orbitalRadiusM: 2870972000000.0,
  orbitalSpeedMs: 6800,
};

export const NEPTUNE_PRESET: PlanetaryBodyData = {
  id: 'NEPTUNE',
  name: 'Neptune',
  mu: 6.836529e15,
  radiusM: 24622000.0,
  semiMajorAxisM: 4498253000000.0, // 30.069 AU
  orbitalSpeedMPerS: Math.sqrt(MU_SUN / 4498253000000.0), // ~5,431 m/s
  massKg: 1.02413e26,
  color: '#3a86ff',
  description: 'Outermost ice giant visited by Voyager 2 in August 1989 for a southward trajectory out of the ecliptic.',
  source: 'NASA Planetary Fact Sheet',
  isSimplifiedModel: true,
  modelNotes: 'Simplified spherical model in circular orbit.',
  orbitalRadiusM: 4498253000000.0,
  orbitalSpeedMs: 5430,
};

/**
 * Creates a custom theoretical celestial body with verified physical consistency.
 */
export function createCustomPlanet(params: {
  name: string;
  massKg?: number;
  radiusM: number;
  mu?: number;
  semiMajorAxisM?: number;
  orbitalSpeedMPerS?: number;
  color?: string;
  description?: string;
}): PlanetaryBodyData {
  const radiusM = Math.max(1000.0, params.radiusM);
  let massKg = params.massKg ?? 0;
  let mu = params.mu ?? 0;

  if (mu > 0 && massKg <= 0) {
    massKg = mu / G;
  } else if (massKg > 0 && mu <= 0) {
    mu = massKg * G;
  } else if (massKg <= 0 && mu <= 0) {
    massKg = 1.0e25;
    mu = massKg * G;
  }

  const semiMajorAxisM = params.semiMajorAxisM && params.semiMajorAxisM > 0 ? params.semiMajorAxisM : AU * 2.0;
  const orbitalSpeed = params.orbitalSpeedMPerS && params.orbitalSpeedMPerS > 0
    ? params.orbitalSpeedMPerS
    : Math.sqrt(MU_SUN / semiMajorAxisM);

  return {
    id: `CUSTOM_${Date.now()}`,
    name: params.name || 'Custom Theoretical Planet',
    mu,
    radiusM,
    semiMajorAxisM,
    orbitalSpeedMPerS: orbitalSpeed,
    massKg,
    color: params.color || '#9333ea',
    description: params.description || 'User-configured custom theoretical planetary body.',
    source: 'Custom User Configuration / Newtonian Two-Body Model',
    isTheoretical: true,
    isSimplifiedModel: true,
    modelNotes: 'User-defined theoretical mass and radius for exploratory astrodynamic simulations.',
    orbitalRadiusM: semiMajorAxisM,
    orbitalSpeedMs: orbitalSpeed,
  };
}

// Backward-compatible alias
export const createCustomBody = createCustomPlanet;

export const PLANETARY_BODIES: Record<string, PlanetaryBodyData> = {
  JUPITER: JUPITER_PRESET,
  SATURN: SATURN_PRESET,
  EARTH: EARTH_PRESET,
  MARS: MARS_PRESET,
  VENUS: VENUS_PRESET,
  MERCURY: MERCURY_PRESET,
  URANUS: URANUS_PRESET,
  NEPTUNE: NEPTUNE_PRESET,

  // Lowercase keys
  jupiter: JUPITER_PRESET,
  saturn: SATURN_PRESET,
  earth: EARTH_PRESET,
  mars: MARS_PRESET,
  venus: VENUS_PRESET,
  mercury: MERCURY_PRESET,
  uranus: URANUS_PRESET,
  neptune: NEPTUNE_PRESET,
};

// Canonical export alias for central planetary data module
export const PLANETARY_DATA = PLANETARY_BODIES;

// Populate compatibility fields
for (const b of Object.values(PLANETARY_BODIES)) {
  if (!b.sourceOrReference) b.sourceOrReference = b.source;
  if (!b.modelSimplificationNote) b.modelSimplificationNote = b.modelNotes;
}

/**
 * Validates physical planetary parameters ensuring positive finite values.
 */
export function validatePlanetaryConstants(planet: {
  massKg: number;
  radiusM: number;
  mu: number;
}): { isValid: boolean; warnings: string[]; errors: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof planet.massKg !== 'number' || !isFinite(planet.massKg) || planet.massKg <= 0) {
    errors.push('Planet mass must be a finite positive number in kg.');
  }
  if (typeof planet.radiusM !== 'number' || !isFinite(planet.radiusM) || planet.radiusM <= 0) {
    errors.push('Planet mean radius must be a finite positive number in metres.');
  }
  if (typeof planet.mu !== 'number' || !isFinite(planet.mu) || planet.mu <= 0) {
    errors.push('Planet gravitational parameter (mu) must be a finite positive number.');
  }

  // Check physical density realism if mass and radius are valid
  if (errors.length === 0) {
    const volumeM3 = (4.0 / 3.0) * Math.PI * Math.pow(planet.radiusM, 3);
    const meanDensityKgPerM3 = planet.massKg / volumeM3;

    // Density of gas giant Saturn is ~687 kg/m^3; Osmium is ~22,590 kg/m^3
    if (meanDensityKgPerM3 < 300) {
      warnings.push(`Low mean planetary density (${meanDensityKgPerM3.toFixed(0)} kg/m³). Body is lighter than gaseous hydrogen/helium structures.`);
    } else if (meanDensityKgPerM3 > 30000) {
      warnings.push(`High mean planetary density (${meanDensityKgPerM3.toFixed(0)} kg/m³). Body exceeds compressed metallic iron/osmium cores.`);
    }

    // Consistency check between mass and mu
    const expectedMu = planet.massKg * G;
    const muDiscrepancyRel = Math.abs(planet.mu - expectedMu) / expectedMu;
    if (muDiscrepancyRel > 0.05) {
      warnings.push(
        `Discrepancy between mass (${planet.massKg.toExponential(3)} kg) and gravitational parameter mu (${planet.mu.toExponential(3)} m³/s²) is ${(muDiscrepancyRel * 100).toFixed(1)}%. Ensure authoritative parameter choice is intended.`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}
