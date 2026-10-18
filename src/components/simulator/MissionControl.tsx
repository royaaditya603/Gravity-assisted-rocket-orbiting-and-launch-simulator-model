import React, { useState, useEffect } from 'react';
import { SimulationManager } from '../../simulation/SimulationManager';
import { SimulationCanvas } from './viewport/SimulationCanvas';
import { TelemetryHUD } from './hud/TelemetryHUD';
import { ControlDeck } from './controls/ControlDeck';
import { TelemetryCharts } from './charts/TelemetryCharts';
import { PhysicsExplainer } from './hud/PhysicsExplainer';

export const MissionControl: React.FC = () => {
  const [sim] = useState<SimulationManager>(() => new SimulationManager());
  const [cameraMode, setCameraMode] = useState<'CHASE' | 'ORBIT' | 'PAD'>('ORBIT');
  const [isChartsOpen, setIsChartsOpen] = useState<boolean>(false);
  const [, setTick] = useState<number>(0);

  // Sync state update hook
  const handleStateChange = () => {
    setTick((t) => t + 1);
  };

  // Re-render HUD periodically at 20 Hz
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 50);
    return () => clearInterval(timer);
  }, []);

  return (
    <section id="mission-control" className="relative w-full h-[85vh] min-h-[650px] bg-[#06070a] border-t border-b border-[#232733] overflow-hidden select-none">
      {/* 3D WebGL Canvas */}
      <SimulationCanvas sim={sim} cameraMode={cameraMode} />

      {/* Real-time Telemetry HUD (Left) */}
      <TelemetryHUD sim={sim} />

      {/* Real-time Streaming Charts (Top Right) */}
      <TelemetryCharts
        history={sim.telemetryHistory}
        isOpen={isChartsOpen}
        onToggle={() => setIsChartsOpen(!isChartsOpen)}
      />

      {/* Dynamic Physics Explainer (Bottom Left) */}
      <PhysicsExplainer sim={sim} />

      {/* Main Mission Control Deck (Bottom Center) */}
      <ControlDeck
        sim={sim}
        cameraMode={cameraMode}
        setCameraMode={setCameraMode}
        onStateChange={handleStateChange}
      />
    </section>
  );
};
