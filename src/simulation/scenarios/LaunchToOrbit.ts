/**
 * LaunchToOrbit.ts
 * 
 * Standard Launch-to-Orbit scenario definition and guidance program.
 * 
 * Features:
 * - Geocentric launch site setup at Cape Canaveral (28.5 deg N) with Earth rotational velocity boost.
 * - Multi-regime gravity-turn guidance law with explicit mathematical documentation:
 *   1. Vertical Liftoff: Clears dense lower atmosphere (h < 1 km).
 *   2. Gravity Turn Pitchover Arc: Aerodynamically favorable progressive tilt toward East (1 km <= h < 85 km).
 *   3. Orbital Insertion Arc: Near-horizontal prograde acceleration into Low Earth Orbit (h >= 85 km).
 * - Standard vehicle configurations (Falcon 9 / educational scale).
 */

import { Vector3D } from '../../physics/Vector3D';
import { R_EARTH, OMEGA_EARTH } from '../../physics/constants';
import { VehicleConfig, LaunchScenarioConfig } from '../SimulationTypes';

export interface ScenarioDefinition {
  name: string;
  description: string;
  vehicle: VehicleConfig;
  guidance: LaunchScenarioConfig;
}

/**
 * Standard Cape Canaveral to Low Earth Orbit (LEO) Scenario
 */
export const DEFAULT_LEO_SCENARIO: ScenarioDefinition = {
  name: 'Cape Canaveral to LEO (200 km)',
  description: 'Eastward prograde ascent to Low Earth Orbit utilizing Earth rotation assist.',
  vehicle: {
    dryMassKg: 25000.0,
    propellantMassKg: 400000.0,
    thrustVacuumN: 7600000.0, // 7.6 MN (~Falcon 9 Merlin 1D cluster)
    thrustSeaLevelN: 6800000.0,
    ispVacuumS: 311.0,
    ispSeaLevelS: 282.0,
    crossSectionalAreaM2: 12.0,
    dragCoefficient: 0.35,
    burnDurationS: 165.0,
  },
  guidance: {
    launchLatitudeDeg: 28.5, // Cape Canaveral Space Force Station
    launchAzimuthDeg: 90.0, // Due East (maximum planetary rotation boost)
    initialPitchAngleDeg: 12.0, // Initial pitch kick angle
    pitchOverAltitudeM: 1000.0, // Altitude to initiate pitchover
    targetCutoffSpeedMPerS: 7850.0, // Circular orbital insertion speed at ~200 km
  },
};

/**
 * Suborbital Ballistic Trajectory Scenario (renamed per Review Finding 4)
 */
export const SUBORBITAL_BALLISTIC_SCENARIO: ScenarioDefinition = {
  name: 'Suborbital Ballistic Trajectory',
  description: 'High-altitude suborbital arc with terminal surface re-entry and impact.',
  vehicle: {
    dryMassKg: 30000.0,
    propellantMassKg: 150000.0, // Partial propellant load
    thrustVacuumN: 6500000.0,
    thrustSeaLevelN: 5800000.0,
    ispVacuumS: 300.0,
    ispSeaLevelS: 270.0,
    crossSectionalAreaM2: 12.0,
    dragCoefficient: 0.35,
    burnDurationS: 90.0,
  },
  guidance: {
    launchLatitudeDeg: 28.5,
    launchAzimuthDeg: 90.0,
    initialPitchAngleDeg: 35.0, // High-angle lofted trajectory
    pitchOverAltitudeM: 1000.0,
    targetCutoffSpeedMPerS: 4500.0, // Well below orbital speed
  },
};

/**
 * Earth Escape Trajectory Scenario
 */
export const EARTH_ESCAPE_SCENARIO: ScenarioDefinition = {
  name: 'Earth Escape Trajectory',
  description: 'High-energy burn exceeding Earth escape velocity (v > 11,186 m/s, e > 1.0).',
  vehicle: {
    dryMassKg: 18000.0,
    propellantMassKg: 460000.0,
    thrustVacuumN: 9200000.0,
    thrustSeaLevelN: 8200000.0,
    ispVacuumS: 355.0,
    ispSeaLevelS: 310.0,
    crossSectionalAreaM2: 12.0,
    dragCoefficient: 0.35,
    burnDurationS: 210.0,
  },
  guidance: {
    launchLatitudeDeg: 28.5,
    launchAzimuthDeg: 90.0,
    initialPitchAngleDeg: 10.0,
    pitchOverAltitudeM: 1200.0,
    targetCutoffSpeedMPerS: 11250.0, // Exceeds Earth escape speed
  },
};

export class LaunchToOrbitGuidance {
  /**
   * Computes the initial launch pad position and rotational velocity in ECI
   */
  public static getInitialLaunchPadState(latitudeDeg: number): {
    positionM: Vector3D;
    velocityMPerS: Vector3D;
  } {
    const phi = (latitudeDeg * Math.PI) / 180.0;
    // Launch pad position in ECI (assuming t = 0 at prime meridian intersection)
    const pos = new Vector3D(R_EARTH * Math.cos(phi), 0, R_EARTH * Math.sin(phi));
    // Earth rotation tangential velocity: v = omega x r = (-omega * y, omega * x, 0)
    // Here y = 0 initially, so v_y = omega * x
    const vel = new Vector3D(0, OMEGA_EARTH * pos.x, 0);
    return { positionM: pos, velocityMPerS: vel };
  }

  /**
   * Computes the commanded thrust unit vector in ECI using the gravity turn program.
   * 
   * Guidance Law Formulation:
   * 1. Topocentric Local Frame:
   *    - up = r / ||r|| (local vertical zenith)
   *    - north = (0, 0, 1) projected onto local tangent plane
   *    - east = north x up
   * 
   * 2. Programmed Pitch Angle theta_pitch(h):
   *    - h < h_pitchover: theta_pitch = 0 deg (vertical climb)
   *    - h_pitchover <= h < h_insertion:
   *      theta_pitch(h) = theta_init + (theta_max - theta_init) * ((h - h_init) / (h_max - h_init))^gamma
   *      where gamma = 0.65 provides a smooth, progressive gravity turn arc.
   *    - h >= h_insertion: theta_pitch = 88.0 deg (near-horizontal orbital injection)
   * 
   * 3. Direction Vector in ECI:
   *    T_hat = cos(theta_pitch) * up + sin(theta_pitch) * [cos(azimuth) * north + sin(azimuth) * east]
   */
  public static computeGuidanceThrustVector(
    position: Vector3D,
    config: LaunchScenarioConfig
  ): { thrustDirection: Vector3D; pitchDeg: number; azimuthDeg: number } {
    const rMag = position.magnitude();
    const altitudeM = Math.max(0, rMag - R_EARTH);

    // Local topocentric coordinate frame
    const up = position.clone().normalize();
    // North direction on tangent plane
    const zAxis = new Vector3D(0, 0, 1);
    const zProj = up.clone().scale(up.z);
    let north = zAxis.sub(zProj);
    if (north.magnitude() < 1e-6) {
      // Near poles, use arbitrary tangent
      north = new Vector3D(1, 0, 0);
    } else {
      north.normalize();
    }
    const east = Vector3D.cross(north, up).normalize();

    // Guidance pitch calculation
    let pitchDeg: number;
    const hPitchOver = config.pitchOverAltitudeM;
    const hInsertion = 85000.0; // 85 km upper atmosphere boundary

    if (altitudeM < hPitchOver) {
      // Phase 1: Pure vertical liftoff
      pitchDeg = 0.0;
    } else if (altitudeM < hInsertion) {
      // Phase 2: Gravity turn arc
      const progress = Math.min(1.0, (altitudeM - hPitchOver) / (hInsertion - hPitchOver));
      const gamma = 0.65;
      pitchDeg = config.initialPitchAngleDeg + (88.0 - config.initialPitchAngleDeg) * Math.pow(progress, gamma);
    } else {
      // Phase 3: Orbital horizontal injection
      pitchDeg = 88.0;
    }

    const pitchRad = (pitchDeg * Math.PI) / 180.0;
    const azimuthRad = (config.launchAzimuthDeg * Math.PI) / 180.0;

    // Horizon tangent vector based on azimuth
    // azimuth = 0 -> North, azimuth = 90 deg -> East
    const tangentDir = north
      .clone()
      .scale(Math.cos(azimuthRad))
      .addScaled(east, Math.sin(azimuthRad))
      .normalize();

    // Combine vertical and horizontal components
    const thrustDir = up
      .clone()
      .scale(Math.cos(pitchRad))
      .addScaled(tangentDir, Math.sin(pitchRad))
      .normalize();

    return {
      thrustDirection: thrustDir,
      pitchDeg,
      azimuthDeg: config.launchAzimuthDeg,
    };
  }
}
