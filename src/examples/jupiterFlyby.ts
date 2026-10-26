/**
 * ASTRA - Gravity Assist & Orbital Dynamics Simulator
 * Example Jupiter Flyby Scenario Demonstration
 *
 * Demonstrates:
 * 1. Physical Model: Newtonian point-mass gravity, restricted two-body encounter.
 * 2. Coordinate Frames: Planet-Relative vs Sun-Relative velocity vectors.
 * 3. Analytical vs Numerical trajectory integration.
 * 4. Energy Conservation and Gravitational Deflection Mechanics.
 * 5. Trailing-edge (acceleration) vs Leading-edge (deceleration) encounters.
 */

import {
  FlybyEngine,
  FlybyInitialConditions,
  PLANETARY_BODIES,
  CoordinateFrames,
  Vector3D,
} from '../physics/index.js';

function formatKm(m: number): string {
  return `${(m / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })} km`;
}

function formatKmS(ms: number): string {
  return `${(ms / 1000).toFixed(3)} km/s`;
}

function formatVectorKmS(v: Vector3D): string {
  return `[${(v.x / 1000).toFixed(2)}, ${(v.y / 1000).toFixed(2)}, ${(v.z / 1000).toFixed(2)}] km/s`;
}

export function runJupiterFlybyDemo(): void {
  console.log('='.repeat(80));
  console.log('ASTRA — Gravity Assist & Orbital Dynamics Simulator (Phase 1 Physics Engine)');
  console.log('EXAMPLE SCENARIO: JUPITER GRAVITY ASSIST (VOYAGER-CLASS TRAJECTORY)');
  console.log('='.repeat(80));

  const jupiter = PLANETARY_BODIES.JUPITER;

  // Configuration for Trailing-Edge Encounter (Prograde Acceleration)
  const vInfSpeed = 12000.0; // 12 km/s asymptotic relative speed
  const periapsisRadius = jupiter.radiusM * 5.0; // 5 Jupiter radii (~349,555 km)
  const altitude = periapsisRadius - jupiter.radiusM;

  const configTrailing: FlybyInitialConditions = {
    planet: jupiter,
    vInfSpeedMPerS: vInfSpeed,
    targetPeriapsisM: periapsisRadius,
    passType: 'TRAILING',
    spacecraftMassKg: 1000.0,
    approachAngleDeg: 0.0,
  };

  console.log('\n--- 1. CELESTIAL BODY & ENCOUNTER PARAMETERS ---');
  console.log(`Planet:                   ${jupiter.name}`);
  console.log(`Mass:                     ${jupiter.massKg.toExponential(4)} kg`);
  console.log(`Standard Grav. Parameter: ${jupiter.mu.toExponential(4)} m^3/s^2`);
  console.log(`Physical Radius (R_p):    ${formatKm(jupiter.radiusM)}`);
  console.log(`Jupiter Heliocentric Spd: ${formatKmS(jupiter.orbitalSpeedMPerS)}`);
  console.log(`Incoming Speed (v_inf):   ${formatKmS(vInfSpeed)}`);
  console.log(`Periapsis Radius (r_p):   ${formatKm(periapsisRadius)} (5.00 R_J)`);
  console.log(`Periapsis Altitude (h):   ${formatKm(altitude)}`);

  // Analytical Calculation
  const analytical = FlybyEngine.computeAnalytical(configTrailing);

  console.log('\n--- 2. ANALYTICAL HYPERBOLIC REFERENCE SOLUTION ---');
  console.log(`Hyperbolic Eccentricity (e):       ${analytical.eccentricity.toFixed(4)}`);
  console.log(`Deflection Angle (delta):          ${analytical.deflectionAngleDeg.toFixed(2)} deg (${analytical.deflectionAngleRad.toFixed(4)} rad)`);
  console.log(`Closest-Approach Radius (r_p):     ${formatKm(analytical.periapsisRadiusM)}`);
  console.log(`Impact Parameter at Infinity (b):  ${formatKm(analytical.impactParameterM)}`);
  console.log(`  * Note: b and r_p are distinct! b = r_p * sqrt(1 + 2*mu/(r_p*v_inf^2))`);
  console.log(`Semi-major Axis (a = -mu/v_inf^2): ${formatKm(analytical.semiMajorAxisM)}`);

  console.log('\n--- 3. COORDINATE FRAMES COMPARISON ---');
  console.log('A. PLANET-RELATIVE REST FRAME (F_P):');
  console.log(`   v_rel,in:   ${formatVectorKmS(analytical.vInfMinusMPerS)} (Speed: ${formatKmS(analytical.vInfMinusMPerS.magnitude())})`);
  console.log(`   v_rel,out:  ${formatVectorKmS(analytical.vInfPlusMPerS)} (Speed: ${formatKmS(analytical.vInfPlusMPerS.magnitude())})`);
  console.log(`   Speed Invariance: ||v_rel,out|| == ||v_rel,in|| = ${formatKmS(analytical.vInfMPerS)} (strictly conserved)`);
  console.log(`   Vector Delta-v:  ${formatVectorKmS(analytical.deltaVVectorMPerS)} (||Delta_v|| = ${formatKmS(analytical.deltaVVectorMagnitudeMPerS)})`);

  console.log('\nB. HELIOCENTRIC / SUN-RELATIVE FRAME (F_S):');
  console.log(`   Planet Orbital Velocity (V_p):   ${formatVectorKmS(new Vector3D(0, jupiter.orbitalSpeedMPerS, 0))}`);
  console.log(`   v_Sun,in:                        ${formatVectorKmS(analytical.vInSunMPerS)} (Speed: ${formatKmS(analytical.vInSunSpeedMPerS)})`);
  console.log(`   v_Sun,out:                       ${formatVectorKmS(analytical.vOutSunMPerS)} (Speed: ${formatKmS(analytical.vOutSunSpeedMPerS)})`);
  console.log(`   Sun-Relative Speed Change:       ${analytical.deltaVSpeedMPerS >= 0 ? '+' : ''}${formatKmS(analytical.deltaVSpeedMPerS)}`);
  console.log(`   Vector Delta-V Magnitude:        ${formatKmS(analytical.deltaVVectorMagnitudeMPerS)}`);
  console.log(`   Delta Specific Kinetic Energy:   ${(analytical.deltaSpecificEnergyJPerKg / 1e6).toFixed(3)} MJ/kg (or (km/s)^2)`);
  console.log(`   Identity V_p · Delta_v_rel:      ${(analytical.deltaSpecificEnergyJPerKg / 1e6).toFixed(3)} MJ/kg (exact match)`);

  // Numerical Simulation
  console.log('\n--- 4. NUMERICAL RUNGE-KUTTA (RK4) TRAJECTORY INTEGRATION ---');
  const sim = FlybyEngine.runSimulation(configTrailing);

  console.log(`Simulation Status:                 ${sim.status}`);
  console.log(`Collision Detected:                ${sim.collisionDetected}`);
  console.log(`Total Simulated Time:              ${(sim.totalDurationS / 86400).toFixed(2)} days (${sim.totalDurationS.toFixed(0)} s)`);
  console.log(`Recorded Trajectory Points:        ${sim.trajectory.length}`);
  console.log(`Numerical Periapsis Reached:       ${formatKm(sim.closestApproach.distanceM)}`);
  console.log(`Numerical Deflection Angle:        ${sim.numericalDeflectionAngleDeg.toFixed(2)} deg`);
  console.log(`Analytical Deflection Angle:       ${analytical.deflectionAngleDeg.toFixed(2)} deg`);
  console.log(`Deflection Discrepancy:            ${Math.abs(sim.numericalDeflectionAngleDeg - analytical.deflectionAngleDeg).toFixed(4)} deg`);
  console.log(`Speed Conservation Error:          ${sim.speedConservationErrorPercent.toFixed(6)}%`);
  console.log(`Peak Gravitational Acceleration:   ${sim.peakGravitationalAccelerationMPerS2?.toFixed(2)} m/s^2 (${sim.peakGravitationalAccelerationG0?.toFixed(2)} g)`);
  if (sim.convergenceDiagnostics) {
    console.log(`Relative Energy Conservation Err:  ${(sim.convergenceDiagnostics.relativeEnergyConservationError * 100).toExponential(3)}%`);
  }

  // Trailing vs Leading Comparison
  console.log('\n--- 5. COMPARISON: TRAILING PASS (ACCELERATION) VS LEADING PASS (DECELERATION) ---');
  const configLeading: FlybyInitialConditions = {
    ...configTrailing,
    passType: 'LEADING',
  };
  const leadingAnalytical = FlybyEngine.computeAnalytical(configLeading);

  console.log(`Trailing Pass (Behind Planet): Sun Speed ${formatKmS(analytical.vInSunSpeedMPerS)} -> ${formatKmS(analytical.vOutSunSpeedMPerS)} (Change: +${formatKmS(analytical.deltaVSpeedMPerS)})`);
  console.log(`Leading Pass  (Ahead of Planet): Sun Speed ${formatKmS(leadingAnalytical.vInSunSpeedMPerS)} -> ${formatKmS(leadingAnalytical.vOutSunSpeedMPerS)} (Change: ${formatKmS(leadingAnalytical.deltaVSpeedMPerS)})`);
  console.log('CRITICAL PRINCIPLE: Gravity assists DO NOT always increase speed!');
  console.log('Passing ahead of the planet slows down heliocentric motion (e.g. Parker Solar Probe, MESSENGER).');

  console.log('\n' + '='.repeat(80));
  console.log('DEMO RUN COMPLETED SUCCESSFULLY.');
  console.log('='.repeat(80));
}

// Run if executed directly
runJupiterFlybyDemo();
