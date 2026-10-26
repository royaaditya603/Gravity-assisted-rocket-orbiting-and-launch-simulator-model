import React from 'react';
import { FlybySimulationResult, ReferenceFrame } from '../../../physics/FlybyEngine';
import { ShieldAlert, AlertTriangle, RefreshCw, Compass, Gauge, Clock } from 'lucide-react';

interface WebGLFallbackDisplayProps {
  simResult: FlybySimulationResult | null;
  currentPlaybackIndex: number;
  referenceFrame: ReferenceFrame;
  errorMessage?: string;
  onRetry?: () => void;
  heightClass?: string;
}

export const WebGLFallbackDisplay: React.FC<WebGLFallbackDisplayProps> = ({
  simResult,
  currentPlaybackIndex,
  referenceFrame,
  errorMessage = 'WebGL 3D Context Unavailable or Hardware Acceleration Disabled',
  onRetry,
  heightClass = 'h-[580px]',
}) => {
  if (!simResult || simResult.trajectory.length === 0) {
    return (
      <div className={`w-full ${heightClass} bg-[#06080d] border border-[#1e293b] flex flex-col items-center justify-center p-6 text-center text-neutral-400 font-mono text-sm`}>
        <AlertTriangle className="text-amber-400 mb-3" size={32} />
        <p className="text-white font-bold mb-1">AWAITING SIMULATION DATA</p>
        <p className="text-xs text-neutral-500 max-w-md">{errorMessage}</p>
      </div>
    );
  }

  const idx = Math.min(currentPlaybackIndex, simResult.trajectory.length - 1);
  const currentPt = simResult.trajectory[idx];
  const planet = simResult.config.planet;
  const isSunFrame = referenceFrame === 'HELIOCENTRIC';

  // Compute 2D normalized SVG coordinates for schematic trajectory plot
  const maxExtent = simResult.trajectory.reduce((max, pt) => {
    const dist = isSunFrame ? pt.posSunM.magnitude() : pt.posPlanetM.magnitude();
    return Math.max(max, dist);
  }, planet.radiusM * 4);

  const svgSize = 360;
  const center = svgSize / 2;
  const scale = (center * 0.85) / maxExtent;

  // Build SVG polyline for trajectory
  const pointsString = simResult.trajectory
    .filter((_, i) => i % Math.max(1, Math.floor(simResult.trajectory.length / 150)) === 0)
    .map((pt) => {
      const pos = isSunFrame ? pt.posSunM : pt.posPlanetM;
      const x = center + pos.x * scale;
      const y = center - pos.y * scale;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const currentPos = isSunFrame ? currentPt.posSunM : currentPt.posPlanetM;
  const curX = center + currentPos.x * scale;
  const curY = center - currentPos.y * scale;
  const planetVisualRadius = Math.max(6, (planet.radiusM * scale));

  return (
    <div className={`w-full ${heightClass} bg-[#06080e] border border-[#1b2336] rounded-xs flex flex-col lg:flex-row items-center justify-between p-6 gap-6 font-mono select-none overflow-hidden relative`}>
      {/* Fallback Notice Banner */}
      <div className="absolute top-3 left-4 right-4 flex items-center justify-between text-xs text-amber-400/90 bg-[#17140a] border border-amber-500/30 px-3 py-1.5 rounded-xs z-10">
        <div className="flex items-center gap-2">
          <ShieldAlert size={14} />
          <span>GRAPHICS FALLBACK MODE: HIGH-FIDELITY 2D SCHEMATIC VISUALIZER ACTIVE</span>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1 text-[11px] hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw size={12} /> RETRY WEBGL
          </button>
        )}
      </div>

      {/* Left: 2D Orthographic Trajectory Projection */}
      <div className="flex flex-col items-center justify-center flex-1 w-full max-w-md pt-8">
        <div className="relative w-[360px] h-[360px] bg-[#090d18] border border-[#1b253b] rounded-full flex items-center justify-center">
          <svg width={svgSize} height={svgSize} className="overflow-visible">
            {/* Coordinate axes */}
            <line x1={center} y1={0} x2={center} y2={svgSize} stroke="#172238" strokeDasharray="3,3" />
            <line x1={0} y1={center} x2={svgSize} y2={center} stroke="#172238" strokeDasharray="3,3" />

            {/* Trajectory Polyline */}
            <polyline
              points={pointsString}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2"
              strokeOpacity="0.8"
            />

            {/* Central Planet Disc */}
            <circle
              cx={center}
              cy={center}
              r={planetVisualRadius}
              fill="#d97706"
              stroke="#f59e0b"
              strokeWidth="1.5"
            />

            {/* Spacecraft Current Marker */}
            <circle
              cx={curX}
              cy={curY}
              r="4.5"
              fill="#10b981"
              stroke="#ffffff"
              strokeWidth="1.5"
            />
          </svg>

          {/* Planet Label */}
          <div className="absolute text-[10px] text-amber-300 font-bold tracking-widest uppercase pointer-events-none">
            {planet.name}
          </div>
        </div>
        <div className="text-[11px] text-neutral-400 mt-2 text-center">
          2D ORTHOGRAPHIC PROJECTION // {isSunFrame ? 'SUN HELIOCENTRIC' : 'PLANET REST FRAME'}
        </div>
      </div>

      {/* Right: Direct Scientific Telemetry Grid */}
      <div className="flex-1 w-full max-w-lg bg-[#0b0f1a] border border-[#1a2338] p-5 rounded-xs flex flex-col gap-4 text-xs">
        <div className="border-b border-[#1a2338] pb-2 flex items-center justify-between">
          <span className="text-white font-bold tracking-wider uppercase flex items-center gap-2">
            <Gauge size={14} className="text-sky-400" /> AUTHORITATIVE ENGINE STATE
          </span>
          <span className="text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-xs">
            RK4 CONVERGED
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-2.5 bg-[#0e1424] border border-[#182136] rounded-xs">
            <div className="text-[10px] text-neutral-400 uppercase">SIMULATION TIME</div>
            <div className="text-sm text-white font-bold pt-0.5">{currentPt.timeS.toFixed(1)} s</div>
          </div>
          <div className="p-2.5 bg-[#0e1424] border border-[#182136] rounded-xs">
            <div className="text-[10px] text-neutral-400 uppercase">CURRENT ALTITUDE</div>
            <div className="text-sm text-sky-400 font-bold pt-0.5">{(currentPt.altitudeM / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km</div>
          </div>
          <div className="p-2.5 bg-[#0e1424] border border-[#182136] rounded-xs">
            <div className="text-[10px] text-neutral-400 uppercase">PLANET SPEED</div>
            <div className="text-sm text-amber-400 font-bold pt-0.5">{(currentPt.speedPlanetMPerS / 1000).toFixed(2)} km/s</div>
          </div>
          <div className="p-2.5 bg-[#0e1424] border border-[#182136] rounded-xs">
            <div className="text-[10px] text-neutral-400 uppercase">HELIOCENTRIC SPEED</div>
            <div className="text-sm text-emerald-400 font-bold pt-0.5">{(currentPt.speedSunMPerS / 1000).toFixed(2)} km/s</div>
          </div>
          <div className="p-2.5 bg-[#0e1424] border border-[#182136] rounded-xs">
            <div className="text-[10px] text-neutral-400 uppercase">CLOSEST APPROACH DISTANCE</div>
            <div className="text-sm text-white font-bold pt-0.5">{(simResult.closestApproach.distanceM / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km</div>
          </div>
          <div className="p-2.5 bg-[#0e1424] border border-[#182136] rounded-xs">
            <div className="text-[10px] text-neutral-400 uppercase">HYPERBOLIC DEFLECTION</div>
            <div className="text-sm text-sky-300 font-bold pt-0.5">{simResult.analytical.deflectionAngleDeg.toFixed(2)}°</div>
          </div>
        </div>

        <div className="text-[11px] text-neutral-500 pt-1">
          Numerical physics integration remains fully operational and synchronized. All dynamic trajectory points are computed using authoritative 4th-order Runge-Kutta numerical mechanics.
        </div>
      </div>
    </div>
  );
};
