import { describe, it, expect } from 'vitest';
import { SimulationManager } from '../src/simulation/SimulationManager';
import { SimulationEngine } from '../src/simulation/SimulationEngine';
import { R_EARTH } from '../src/physics/constants';

describe('SimulationManager Orchestration and Facade Integration', () => {
  it('initializes vehicle on launch pad at surface radius with surface rotation velocity', () => {
    const sim = new SimulationManager();
    expect(sim.flightPhase).toBe('ON_PAD');
    expect(sim.position.magnitude()).toBeCloseTo(R_EARTH, 1);
    expect(sim.hasImpacted).toBe(false);
    expect(sim.velocity.magnitude()).toBeGreaterThan(0.0); // Surface rotation velocity
  });

  it('unifies with SimulationEngine as the single authoritative physical backend', () => {
    const sim = new SimulationManager();
    expect(sim.engine).toBeInstanceOf(SimulationEngine);

    // Verify state mirrored from engine
    const engineTel = sim.engine.getTelemetry();
    expect(sim.position.x).toBe(engineTel.position.x);
    expect(sim.position.y).toBe(engineTel.position.y);
    expect(sim.position.z).toBe(engineTel.position.z);
    expect(sim.rocket).toBe(sim.engine.rocketInstance);
  });

  it('ignites engine and transitions to POWERED_ASCENT', () => {
    const sim = new SimulationManager();
    sim.startLaunch();
    expect(sim.flightPhase).toBe('POWERED_ASCENT');
    expect(sim.isRunning).toBe(true);
    expect(sim.rocket.isEngineBurning).toBe(true);

    // Step forward 10 seconds
    for (let i = 0; i < 200; i++) {
      sim.subStep(0.05);
    }

    expect(sim.timeS).toBeCloseTo(10.0, 1);
    expect(sim.position.magnitude()).toBeGreaterThan(R_EARTH);
    expect(sim.rocket.propellantRemainingKg).toBeLessThan(sim.rocket.initialPropellantMassKg);
  });

  it('switches to COASTING on manual engine cutoff', () => {
    const sim = new SimulationManager();
    sim.startLaunch();
    for (let i = 0; i < 50; i++) {
      sim.subStep(0.05);
    }
    sim.manualCutoff();
    expect(sim.flightPhase).toBe('COASTING');
    expect(sim.rocket.isEngineBurning).toBe(false);
  });

  it('correctly applies the Suborbital Ballistic Trajectory preset (renamed)', () => {
    const sim = new SimulationManager();
    sim.applyPreset('SUBORBITAL_BALLISTIC');
    expect(sim.params.targetCutoffSpeedMPerS).toBe(4500.0);
    expect(sim.params.propellantMassKg).toBe(150000.0);
    expect(sim.flightPhase).toBe('ON_PAD');
  });

  it('generates continuous osculating orbit spline points without NaNs via TrajectoryPredictor', () => {
    const sim = new SimulationManager();
    const points = sim.getOsculatingOrbitPoints(60);
    expect(points.length).toBeGreaterThan(10);
    for (const p of points) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
      expect(Number.isFinite(p.z)).toBe(true);
    }
  });

  it('verifies parameter commit affects physical trajectory evolution', () => {
    // Low thrust sim
    const simLow = new SimulationManager({ thrustVacuumN: 6000000.0, thrustSeaLevelN: 5400000.0 });
    simLow.startLaunch();
    for (let i = 0; i < 100; i++) {
      simLow.subStep(0.05);
    }

    // High thrust sim
    const simHigh = new SimulationManager({ thrustVacuumN: 12000000.0, thrustSeaLevelN: 10800000.0 });
    simHigh.startLaunch();
    for (let i = 0; i < 100; i++) {
      simHigh.subStep(0.05);
    }

    // High thrust must achieve higher velocity and altitude at T = 5s
    expect(simHigh.velocity.magnitude()).toBeGreaterThan(simLow.velocity.magnitude());
    expect(simHigh.position.magnitude()).toBeGreaterThan(simLow.position.magnitude());
  });

  it('verifies pause and resume control halts and restarts simulation time', () => {
    const sim = new SimulationManager();
    sim.startLaunch();
    sim.update(0.1);
    const tBefore = sim.timeS;
    expect(tBefore).toBeGreaterThan(0.0);

    // Pause
    sim.pause();
    expect(sim.isRunning).toBe(false);
    sim.update(0.1);
    expect(sim.timeS).toBe(tBefore);

    // Resume
    sim.resume();
    expect(sim.isRunning).toBe(true);
    sim.update(0.1);
    expect(sim.timeS).toBeGreaterThan(tBefore);
  });

  it('verifies reset restores initial conditions and clears histories', () => {
    const sim = new SimulationManager();
    sim.startLaunch();
    for (let i = 0; i < 50; i++) {
      sim.subStep(0.05);
    }
    expect(sim.telemetryHistory.length).toBeGreaterThan(1);
    expect(sim.trajectoryHistory.length).toBeGreaterThan(1);
    expect(sim.timeS).toBeGreaterThan(2.0);

    // Reset
    sim.reset();
    expect(sim.timeS).toBe(0.0);
    expect(sim.flightPhase).toBe('ON_PAD');
    expect(sim.hasImpacted).toBe(false);
    expect(sim.isRunning).toBe(false);
    expect(sim.telemetryHistory.length).toBe(1); // Only initial t=0 sample
    expect(sim.trajectoryHistory.length).toBe(1);
    expect(sim.position.magnitude()).toBeCloseTo(R_EARTH, 1);
  });
});
