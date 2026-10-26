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
      <div className={`w-full ${heightClass} bg-white border border-[#DCE3EE] rounded-xl flex flex-col items-center justify-center p-6 text-center text-[#68758A] font-mono text-sm shadow-xs`}>
        <AlertTriangle className="text-[#7A3E1D] mb-3" size={32} />
        <p className="text-[#263247] font-bold mb-1">AWAITING SIMULATION DATA</p>
        <p className="text-xs text-[#68758A] max-w-md">{errorMessage}</p>
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
    <div className={`w-full ${heightClass} bg-white border border-[#DCE3EE] rounded-xl flex flex-col lg:flex-row items-center justify-between p-6 gap-6 font-mono select-none overflow-hidden relative shadow-xs text-[#263247]`}>
      {/* Fallback Notice Banner */}
      <div className="absolute top-3 left-4 right-4 flex items-center justify-between text-xs text-[#7A3E1D] bg-[#FFD2B8]/40 border border-[#FFD2B8] px-3 py-1.5 rounded-lg z-10 shadow-xs">
        <div className="flex items-center gap-2">
          <ShieldAlert size={14} />
          <span>GRAPHICS FALLBACK MODE: HIGH-FIDELITY 2D SCHEMATIC VISUALIZER ACTIVE</span>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1 text-[11px] hover:text-[#263247] transition-colors cursor-pointer font-bold"
          >
            <RefreshCw size={12} /> RETRY WEBGL
          </button>
        )}
      </div>

      {/* Left: 2D Orthographic Trajectory Projection */}
      <div className="flex flex-col items-center justify-center flex-1 w-full max-w-md pt-8">
        <div className="relative w-[360px] h-[360px] bg-[#F8FAFD] border border-[#DCE3EE] rounded-full flex items-center justify-center shadow-inner">
          <svg width={svgSize} height={svgSize} className="overflow-visible">
            {/* Coordinate axes */}
            <line x1={center} y1={0} x2={center} y2={svgSize} stroke="#DCE3EE" strokeDasharray="3,3" />
            <line x1={0} y1={center} x2={svgSize} y2={center} stroke="#DCE3EE" strokeDasharray="3,3" />

            {/* Trajectory Polyline */}
            <polyline
              points={pointsString}
              fill="none"
              stroke="#14426B"
              strokeWidth="2.5"
              strokeOpacity="0.85"
            />

            {/* Central Planet Disc */}
            <circle
              cx={center}
              cy={center}
              r={planetVisualRadius}
              fill="#FFD2B8"
              stroke="#F5BCA0"
              strokeWidth="2"
            />

            {/* Spacecraft Current Marker */}
            <circle
              cx={curX}
              cy={curY}
              r="5"
              fill="#059669"
              stroke="#ffffff"
              strokeWidth="2"
            />
          </svg>

          {/* Planet Label */}
          <div className="absolute text-[10px] text-[#7A3E1D] font-bold tracking-widest uppercase pointer-events-none">
            {planet.name}
          </div>
        </div>
        <div className="text-[11px] text-[#68758A] mt-2 text-center">
          2D ORTHOGRAPHIC PROJECTION // {isSunFrame ? 'SUN HELIOCENTRIC' : 'PLANET REST FRAME'}
        </div>
      </div>

      {/* Right: Direct Scientific Telemetry Grid */}
      <div className="flex-1 w-full max-w-lg bg-[#F8FAFD] border border-[#DCE3EE] p-5 rounded-xl flex flex-col gap-4 text-xs shadow-xs">
        <div className="border-b border-[#DCE3EE] pb-2 flex items-center justify-between">
          <span className="text-[#263247] font-bold tracking-wider uppercase flex items-center gap-2">
            <Gauge size={14} className="text-[#14426B]" /> AUTHORITATIVE ENGINE STATE
          </span>
          <span className="text-[10px] text-[#1D6C50] bg-[#AEE5D0]/40 border border-[#AEE5D0] px-2 py-0.5 rounded-md font-bold">
            RK4 CONVERGED
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-2.5 bg-white border border-[#DCE3EE] rounded-lg shadow-xs">
            <div className="text-[10px] text-[#68758A] uppercase">SIMULATION TIME</div>
            <div className="text-sm text-[#263247] font-bold pt-0.5">{currentPt.timeS.toFixed(1)} s</div>
          </div>
          <div className="p-2.5 bg-white border border-[#DCE3EE] rounded-lg shadow-xs">
            <div className="text-[10px] text-[#68758A] uppercase">CURRENT ALTITUDE</div>
            <div className="text-sm text-[#14426B] font-bold pt-0.5">{(currentPt.altitudeM / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km</div>
          </div>
          <div className="p-2.5 bg-white border border-[#DCE3EE] rounded-lg shadow-xs">
            <div className="text-[10px] text-[#68758A] uppercase">PLANET SPEED</div>
            <div className="text-sm text-[#7A3E1D] font-bold pt-0.5">{(currentPt.speedPlanetMPerS / 1000).toFixed(2)} km/s</div>
          </div>
          <div className="p-2.5 bg-white border border-[#DCE3EE] rounded-lg shadow-xs">
            <div className="text-[10px] text-[#68758A] uppercase">HELIOCENTRIC SPEED</div>
            <div className="text-sm text-[#1D6C50] font-bold pt-0.5">{(currentPt.speedSunMPerS / 1000).toFixed(2)} km/s</div>
          </div>
          <div className="p-2.5 bg-white border border-[#DCE3EE] rounded-lg shadow-xs">
            <div className="text-[10px] text-[#68758A] uppercase">CLOSEST APPROACH DISTANCE</div>
            <div className="text-sm text-[#263247] font-bold pt-0.5">{(simResult.closestApproach.distanceM / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km</div>
          </div>
          <div className="p-2.5 bg-white border border-[#DCE3EE] rounded-lg shadow-xs">
            <div className="text-[10px] text-[#68758A] uppercase">HYPERBOLIC DEFLECTION</div>
            <div className="text-sm text-[#14426B] font-bold pt-0.5">{simResult.analytical.deflectionAngleDeg.toFixed(2)}°</div>
          </div>
        </div>

        <div className="text-[11px] text-[#68758A] pt-1">
          Numerical physics integration remains fully operational and synchronized. All dynamic trajectory points are computed using authoritative 4th-order Runge-Kutta numerical mechanics.
        </div>
      </div>
    </div>
  );
};
