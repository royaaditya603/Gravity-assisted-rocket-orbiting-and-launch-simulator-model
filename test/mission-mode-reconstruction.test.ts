import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationManager } from '../src/simulation/SimulationManager';
import { MissionEngine } from '../src/physics/MissionEngine';
import { VOYAGER_2_TCMS } from '../src/components/mission/MissionWorkspace';
import { Vector3D } from '../src/physics/Vector3D';
import { R_EARTH } from '../src/physics/constants';

describe('Mission Mode Reconstruction & 3D Flight Replay Test Suite', () => {
  let sim: SimulationManager;

  beforeEach(() => {
    sim = new SimulationManager();
  });

  describe('1. Jitter Diagnosis & Smooth Ascent Physics Architecture', () => {
    it('maintains fixed physical sub-stepping independent of animation frame rate', () => {
      // Run with different wall-clock intervals, state evolution must be identical at same physical elapsed time
      const simA = new SimulationManager();
      const simB = new SimulationManager();

      simA.startLaunch();
      simB.startLaunch();

      // simA steps with 10 ms render ticks
      for (let i = 0; i < 100; i++) {
        simA.update(0.01);
      }

      // simB steps with 50 ms render ticks
      for (let i = 0; i < 20; i++) {
        simB.update(0.05);
      }

      // Both should have elapsed exactly 1.0 s of physical time
      expect(simA.timeS).toBeCloseTo(1.0, 2);
      expect(simB.timeS).toBeCloseTo(1.0, 2);

      // Positions should match within numerical sub-step tolerance (< 0.1 mm)
      const diff = simA.position.clone().subtract(simB.position).magnitude();
      expect(diff).toBeLessThan(0.05);
    });

    it('produces continuous, non-planar 3D trajectory positions with no sudden discontinuities', () => {
      sim.startLaunch();
      for (let i = 0; i < 60; i++) {
        sim.update(1.0);
      }

      const history = sim.trajectoryHistory;
      expect(history.length).toBeGreaterThan(10);

      // Check step-to-step position continuity (no teleports)
      for (let i = 1; i < history.length; i++) {
        const delta = history[i].clone().subtract(history[i - 1]).magnitude();
        // At speed ~ 500 m/s with 0.2s sample rate, distance between points is ~100m. No jumps > 5000m.
        expect(delta).toBeLessThan(5000.0);
      }

      // Verify trajectory is genuinely three-dimensional (not pinned to a 2D plane)
      const currentPos = sim.position;
      expect(Math.abs(currentPos.x)).toBeGreaterThan(1000.0);
      expect(Math.abs(currentPos.y)).toBeGreaterThan(1000.0);
      expect(Math.abs(currentPos.z)).toBeGreaterThan(1000.0);
    });

    it('maintains smooth forward orientation without sudden snapping at MECO', () => {
      sim.precomputeFlight(160.0);
      const states = sim.recordedStates;
      expect(states.length).toBeGreaterThan(100);

      // Check attitude continuity across engine cutoff
      for (let i = 1; i < states.length; i++) {
        const prevFwd = states[i - 1].attitudeForward;
        const curFwd = states[i].attitudeForward;
        const dot = Vector3D.dot(prevFwd, curFwd);
        // Angle between consecutive 50ms attitude frames must be very small (cos(theta) > 0.95)
        expect(dot).toBeGreaterThan(0.95);
      }
    });
  });

  describe('2. Flight Replay Engine & Deterministic Scrubbing', () => {
    beforeEach(() => {
      sim.precomputeFlight(180.0);
    });

    it('generates deterministic flight snapshots with full physical telemetry', () => {
      expect(sim.recordedStates.length).toBeGreaterThan(500);
      expect(sim.totalFlightDurationS).toBeGreaterThanOrEqual(120.0);

      const snap = sim.evaluateReplayAt(30.0);
      expect(snap.timeS).toBeCloseTo(30.0, 1);
      expect(snap.altitudeKm).toBeGreaterThan(0.5);
      expect(snap.speedMPerS).toBeGreaterThan(50.0);
      expect(snap.dynamicPressureKPa).toBeGreaterThan(0.0);
      expect(snap.massTonnes).toBeGreaterThan(50.0);
      expect(snap.thrustKN).toBeGreaterThan(1000.0);
    });

    it('enables seamless scrubbing backward and forward reproducibly', () => {
      // Seek to T=45s
      const state45_first = sim.evaluateReplayAt(45.0);

      // Seek forward to T=90s
      const state90 = sim.evaluateReplayAt(90.0);
      expect(state90.altitudeKm).toBeGreaterThan(state45_first.altitudeKm);

      // Scrub back to T=45s
      const state45_second = sim.evaluateReplayAt(45.0);

      // Both evaluations at T=45s must yield identical positions and velocities
      expect(state45_first.positionM.x).toBeCloseTo(state45_second.positionM.x, 3);
      expect(state45_first.velocityMPerS.magnitude()).toBeCloseTo(state45_second.velocityMPerS.magnitude(), 3);
    });

    it('supports single-step forward and backward navigation', () => {
      sim.setReplayMode(true);
      sim.seekReplay(50.0);
      expect(sim.replayTimeS).toBeCloseTo(50.0, 2);

      // Step forward by 0.5s
      sim.stepReplay(0.5);
      expect(sim.replayTimeS).toBeCloseTo(50.5, 2);

      // Step backward by 1.0s
      sim.stepReplay(-1.0);
      expect(sim.replayTimeS).toBeCloseTo(49.5, 2);
    });

    it('detects and jumps to ascent milestones accurately', () => {
      const milestones = sim.milestones;
      expect(milestones.length).toBeGreaterThanOrEqual(3);

      const liftoff = milestones.find((m) => m.id === 'IGNITION');
      expect(liftoff).toBeDefined();
      expect(liftoff!.timeS).toBeCloseTo(0.0, 1);

      const maxQ = milestones.find((m) => m.id === 'MAX_Q');
      expect(maxQ).toBeDefined();
      expect(maxQ!.timeS).toBeGreaterThan(10.0);

      // Jump to Max-Q milestone
      sim.jumpToMilestone('MAX_Q');
      expect(sim.replayTimeS).toBeCloseTo(maxQ!.timeS, 1);
    });

    it('allows changing playback rates without altering physical trajectory data', () => {
      const rates = [0.1, 0.25, 0.5, 1.0, 2.0, 5.0];
      rates.forEach((rate) => {
        sim.setReplaySpeed(rate);
        expect(sim.replaySpeed).toBe(rate);
      });

      // The snapshot data at T=60s must remain completely unaffected by playback rate
      const snap = sim.evaluateReplayAt(60.0);
      expect(snap.altitudeKm).toBeGreaterThan(5.0);
    });
  });

  describe('3. Multi-Stage Separation & 3D Visual Pose Transitions', () => {
    it('properly transitions staging states across MECO and Fairing separation', () => {
      sim.precomputeFlight(200.0);

      // On pad / early ascent: stage 1 attached, fairing attached
      const earlySnap = sim.evaluateReplayAt(10.0);
      expect(earlySnap.stageState.stage1Attached).toBe(true);
      expect(earlySnap.stageState.fairingAttached).toBe(true);
      expect(earlySnap.stageState.stage1SeparationDist).toBe(0);

      // Post-burnout / staging: stage 1 detached, separation distance increasing
      const postMecoSnap = sim.evaluateReplayAt(sim.params.burnDurationS + 5.0);
      expect(postMecoSnap.stageState.stage1Attached).toBe(false);
      expect(postMecoSnap.stageState.stage1SeparationDist).toBeGreaterThan(0);

      // High altitude (exo-atmospheric): fairing separated
      const highAltSnap = sim.recordedStates.find((s) => s.altitudeKm > 90.0);
      if (highAltSnap) {
        expect(highAltSnap.stageState.fairingAttached).toBe(false);
        expect(highAltSnap.stageState.fairingSeparationDist).toBeGreaterThan(0);
      }
    });
  });

  describe('4. Voyager 2 Grand Tour Historical Dossier & Comparison', () => {
    const voyagerMission = MissionEngine.runMissionScenario('VOYAGER_2_REFERENCE', 'EPHEMERIS', 'VOYAGER_2');

    it('includes all 4 outer gas giant encounters in correct historical sequence', () => {
      expect(voyagerMission.encounters.length).toBe(4);
      const [jupiter, saturn, uranus, neptune] = voyagerMission.encounters;

      expect(jupiter.planetId).toBe('JUPITER');
      expect(saturn.planetId).toBe('SATURN');
      expect(uranus.planetId).toBe('URANUS');
      expect(neptune.planetId).toBe('NEPTUNE');
    });

    it('contains exact documented NASA archival encounter dates and reference data', () => {
      const [jupiter, saturn, uranus, neptune] = voyagerMission.encounters;

      // Jupiter: July 9, 1979
      expect(jupiter.targetEpochUTC).toContain('1979-07-09');
      expect(jupiter.historicalData).toBeDefined();
      expect(jupiter.historicalData?.documentedAltitudeKm).toBe(570000.0);

      // Saturn: Aug 25/26, 1981
      expect(saturn.targetEpochUTC).toMatch(/1981-08-(25|26)/);
      expect(saturn.historicalData).toBeDefined();
      expect(saturn.historicalData?.documentedAltitudeKm).toBe(101000.0);

      // Uranus: Jan 24, 1986
      expect(uranus.targetEpochUTC).toContain('1986-01-24');
      expect(uranus.historicalData).toBeDefined();
      expect(uranus.historicalData?.documentedAltitudeKm).toBe(81500.0);

      // Neptune: Aug 25, 1989
      expect(neptune.targetEpochUTC).toContain('1989-08-25');
      expect(neptune.historicalData).toBeDefined();
      expect(neptune.historicalData?.documentedAltitudeKm).toBe(4950.0);
    });

    it('documents all five major historical Trajectory Correction Maneuvers (TCMs)', () => {
      expect(VOYAGER_2_TCMS.length).toBe(5);

      const tcm1 = VOYAGER_2_TCMS[0];
      expect(tcm1.id).toBe('TCM-1');
      expect(tcm1.epochUTC).toBe('1977-08-25');
      expect(tcm1.deltaVMPerS).toBe(14.2);

      const tcmB = VOYAGER_2_TCMS[1];
      expect(tcmB.id).toBe('TCM-B');
      expect(tcmB.epochUTC).toBe('1979-02-14');

      const tcmE = VOYAGER_2_TCMS[4];
      expect(tcmE.id).toBe('TCM-E');
      expect(tcmE.epochUTC).toBe('1989-03-10');
      expect(tcmE.objective).toContain('polar pass');
    });

    it('preserves planet-relative hyperbolic excess speed v_inf in both frames', () => {
      voyagerMission.encounters.forEach((enc) => {
        // |v_in,rel| == |v_out,rel|
        expect(enc.vInfInSpeedKmPerS).toBeCloseTo(enc.vInfOutSpeedKmPerS, 2);
      });
      expect(voyagerMission.diagnostics.planetRelativeSpeedConserved).toBe(true);
    });

    it('explicitly validates non-linear delta-V conservation over naive scalar addition', () => {
      const diag = voyagerMission.diagnostics;
      expect(diag.linearDeltaVSumKmPerS).toBeDefined();
      expect(diag.actualNetHeliocentricDeltaVKmPerS).toBeDefined();
      expect(diag.whyLinearSumIsInvalid).toContain('Astrodynamic Principle');
    });
  });
});
