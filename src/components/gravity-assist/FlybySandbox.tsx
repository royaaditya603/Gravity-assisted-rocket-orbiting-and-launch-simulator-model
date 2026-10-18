import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  FlybyEngine,
  FlybyInitialConditions,
  FlybySimulationResult,
  FlybyPassType,
  ReferenceFrame,
} from '../../physics/FlybyEngine';
import { PLANETARY_BODIES, PlanetaryBodyData } from '../../physics/constants';
import { Flyby3DCanvas, FlybyCameraMode } from './viewport/Flyby3DCanvas';
import { FlybyControlDeck } from './controls/FlybyControlDeck';
import { FlybyTelemetryHUD } from './hud/FlybyTelemetryHUD';
import { FlybyCharts } from './charts/FlybyCharts';
import { FlybyExperiments } from './experiments/FlybyExperiments';
import { FlybyMissions } from './missions/FlybyMissions';
import { Sparkles, Compass, ShieldAlert, Cpu } from 'lucide-react';

export const FlybySandbox: React.FC = () => {
  // Authoritative Initial Conditions State
  const [selectedPlanet, setSelectedPlanet] = useState<PlanetaryBodyData>(PLANETARY_BODIES.JUPITER);
  const [vInfSpeedMPerS, setVInfSpeedMPerS] = useState<number>(10000.0); // 10 km/s default
  const [periapsisAltitudeKm, setPeriapsisAltitudeKm] = useState<number>(45000.0); // 45,000 km altitude
  const [passType, setPassType] = useState<FlybyPassType>('TRAILING');
  const [spacecraftMassKg, setSpacecraftMassKg] = useState<number>(1000.0); // 1,000 kg

  // View & Playback State
  const [referenceFrame, setReferenceFrame] = useState<ReferenceFrame>('PLANET_CENTRIC');
  const [cameraMode, setCameraMode] = useState<FlybyCameraMode>('OVERVIEW');
  const [showVectors, setShowVectors] = useState<boolean>(true);
  const [showTrajectoryTrail, setShowTrajectoryTrail] = useState<boolean>(true);

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(2.0);
  const [currentPlaybackIndex, setCurrentPlaybackIndex] = useState<number>(0);

  // Deterministically compute authoritative simulation result
  const simResult: FlybySimulationResult = useMemo(() => {
    const targetPeriapsisM = selectedPlanet.radiusM + periapsisAltitudeKm * 1000.0;
    const config: FlybyInitialConditions = {
      planet: selectedPlanet,
      vInfSpeedMPerS,
      targetPeriapsisM,
      passType,
      spacecraftMassKg,
      approachAngleDeg: 0,
    };
    return FlybyEngine.runSimulation(config);
  }, [selectedPlanet, vInfSpeedMPerS, periapsisAltitudeKm, passType, spacecraftMassKg]);

  // Reset playback to start whenever physical configuration changes
  useEffect(() => {
    setCurrentPlaybackIndex(0);
  }, [simResult]);

  // Animation frame playback loop
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());

  useEffect(() => {
    if (!isPlaying || !simResult || simResult.trajectory.length === 0) {
      return;
    }

    const stepLoop = (now: number) => {
      const deltaMs = now - lastTimeRef.current;
      lastTimeRef.current = now;

      // Advance index based on playbackSpeed
      // 1000 trajectory points; advance ~ 40 * playbackSpeed points per second
      const pointsToAdvance = Math.max(1, Math.floor((deltaMs / 1000.0) * 45 * playbackSpeed));

      setCurrentPlaybackIndex((prev) => {
        const next = prev + pointsToAdvance;
        if (next >= simResult.trajectory.length) {
          // Loop playback smoothly
          return 0;
        }
        return next;
      });

      animRef.current = requestAnimationFrame(stepLoop);
    };

    lastTimeRef.current = performance.now();
    animRef.current = requestAnimationFrame(stepLoop);

    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, playbackSpeed, simResult]);

  // Playback control callbacks
  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setCurrentPlaybackIndex(0);
  }, []);

  const handleStep = useCallback(() => {
    setIsPlaying(false);
    setCurrentPlaybackIndex((prev) => {
      if (!simResult) return 0;
      return Math.min(prev + 5, simResult.trajectory.length - 1);
    });
  }, [simResult]);

  const handleSeek = useCallback((index: number) => {
    setCurrentPlaybackIndex(index);
  }, []);

  // Preset loader callback for experiments and historical missions
  const handleLoadPreset = useCallback((preset: Partial<FlybyInitialConditions>) => {
    if (preset.planet) setSelectedPlanet(preset.planet);
    if (preset.vInfSpeedMPerS !== undefined) setVInfSpeedMPerS(preset.vInfSpeedMPerS);
    if (preset.passType) setPassType(preset.passType);
    if (preset.spacecraftMassKg !== undefined) setSpacecraftMassKg(preset.spacecraftMassKg);

    if (preset.targetPeriapsisM !== undefined) {
      const p = preset.planet || selectedPlanet;
      const altKm = (preset.targetPeriapsisM - p.radiusM) / 1000.0;
      setPeriapsisAltitudeKm(altKm);
    }

    setIsPlaying(true);
    setCurrentPlaybackIndex(0);
  }, [selectedPlanet]);

  return (
    <section
      id="gravity-assist-sandbox"
      className="w-full bg-[#08090d] text-white py-16 px-4 sm:px-8 border-t border-b border-[#202535]"
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-8">
        {/* Section Header */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-amber-400 font-bold">
              [ 05 // DEDICATED MULTI-PLANET GRAVITY ASSIST ENGINE ]
            </span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-sans font-black tracking-tight uppercase">
            Multi-Planet Gravity Assist Simulator
          </h2>
          <p className="text-sm text-neutral-400 max-w-3xl leading-relaxed">
            A planetary gravity assist is an unperturbed hyperbolic encounter in the planet's rest frame where speed is strictly
            conserved (<span className="text-amber-400 font-mono">||v_∞(+) || = ||v_∞(-)||</span>). When transformed to the
            Sun's heliocentric frame, orbital momentum is exchanged with the moving planet, delivering monumental velocity
            boosts (<span className="text-emerald-400 font-mono">Δv_assist</span>) or high-efficiency gravitational braking.
          </p>
        </div>

        {/* 1. Main 3D Viewport & HUD */}
        <div className="flex flex-col gap-3">
          <Flyby3DCanvas
            simResult={simResult}
            currentPlaybackIndex={currentPlaybackIndex}
            referenceFrame={referenceFrame}
            cameraMode={cameraMode}
            showVectors={showVectors}
            showTrajectoryTrail={showTrajectoryTrail}
            onCameraChange={setCameraMode}
          />

          <FlybyTelemetryHUD
            simResult={simResult}
            currentPlaybackIndex={currentPlaybackIndex}
            referenceFrame={referenceFrame}
          />
        </div>

        {/* 2. Interactive Control Deck */}
        <FlybyControlDeck
          selectedPlanet={selectedPlanet}
          onSelectPlanet={setSelectedPlanet}
          vInfSpeedMPerS={vInfSpeedMPerS}
          onChangeVInf={setVInfSpeedMPerS}
          periapsisAltitudeKm={periapsisAltitudeKm}
          onChangePeriapsisAltitude={setPeriapsisAltitudeKm}
          passType={passType}
          onChangePassType={setPassType}
          spacecraftMassKg={spacecraftMassKg}
          onChangeSpacecraftMass={setSpacecraftMassKg}
          referenceFrame={referenceFrame}
          onChangeReferenceFrame={setReferenceFrame}
          cameraMode={cameraMode}
          onChangeCameraMode={setCameraMode}
          isPlaying={isPlaying}
          onTogglePlay={handleTogglePlay}
          onReset={handleReset}
          onStep={handleStep}
          playbackSpeed={playbackSpeed}
          onChangePlaybackSpeed={setPlaybackSpeed}
          currentStepIndex={currentPlaybackIndex}
          totalSteps={simResult.trajectory.length}
          onSeek={handleSeek}
          showVectors={showVectors}
          onToggleVectors={() => setShowVectors((prev) => !prev)}
          showTrajectoryTrail={showTrajectoryTrail}
          onToggleTrajectoryTrail={() => setShowTrajectoryTrail((prev) => !prev)}
        />

        {/* 3. Real-Time Telemetry & Physics Charts */}
        <FlybyCharts
          simResult={simResult}
          currentPlaybackIndex={currentPlaybackIndex}
          referenceFrame={referenceFrame}
        />

        {/* 4. Controlled Astrodynamics Experiments (A — F) */}
        <FlybyExperiments onLoadPreset={handleLoadPreset} />

        {/* 5. Historical Missions Dossier (Voyager 2, Cassini, Mariner 10) */}
        <FlybyMissions onLoadPreset={handleLoadPreset} />
      </div>
    </section>
  );
};

export default FlybySandbox;
