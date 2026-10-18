import React, { useState, useEffect, useRef } from 'react';
import { GravityAssist, GravityAssistResult } from '../../physics/GravityAssist';
import { Vector3D } from '../../physics/Vector3D';
import { MU_MOON, R_MOON } from '../../physics/constants';
import { ArrowRight, Compass, ShieldAlert, Sparkles } from 'lucide-react';

export const FlybySandbox: React.FC = () => {
  const [approachSpeed, setApproachSpeed] = useState<number>(2000.0); // 2,000 m/s
  const [flybyAltKm, setFlybyAltKm] = useState<number>(250.0); // 250 km
  const [passType, setPassType] = useState<'TRAILING' | 'LEADING'>('TRAILING');
  const [result, setResult] = useState<GravityAssistResult | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Moving flyby body: Lunar-scale body (mu = 4.90e12, V_p = 1022 m/s orbiting central body)
  const vPlanetMag = 1022.0; // m/s
  const vPlanet = new Vector3D(0, vPlanetMag, 0);

  useEffect(() => {
    const rPeriapsis = R_MOON + flybyAltKm * 1000.0;
    // Spacecraft incoming vector
    const vIn = new Vector3D(approachSpeed * 0.8, approachSpeed * 0.6, 0);
    const res = GravityAssist.computeFlyby(vIn, vPlanet, rPeriapsis, MU_MOON, passType);
    setResult(res);

    // Draw Vector Diagram
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Deep space dark canvas
    ctx.fillStyle = '#08090d';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = '#181b24';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const cx = w * 0.45;
    const cy = h * 0.55;
    const scale = 0.055; // Pixels per m/s

    const drawVector = (vx: number, vy: number, color: string, label: string, startX = cx, startY = cy) => {
      const endX = startX + vx * scale;
      const endY = startY - vy * scale; // Invert Y for canvas

      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2.2;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Arrowhead
      const angle = Math.atan2(endY - startY, endX - startX);
      const headLen = 7;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - headLen * Math.cos(angle - Math.PI / 6), endY - headLen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(endX - headLen * Math.cos(angle + Math.PI / 6), endY - headLen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();

      // Label
      ctx.font = '10px monospace';
      ctx.fillText(label, endX + 6, endY - 4);
    };

    // Draw Planet Origin Circle
    ctx.fillStyle = '#a8b3cf';
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.fillText('MOON / PLANET', cx - 40, cy + 20);

    // Vector 1: Planet velocity V_p (Cyan)
    drawVector(vPlanet.x, vPlanet.y, '#38bdf8', `V_planet (${vPlanetMag.toFixed(0)} m/s)`);

    // Vector 2: Incoming v_inf(-) (Amber)
    drawVector(res.vInfMinusMPerS.x, res.vInfMinusMPerS.y, '#f59e0b', `v_inf(-) in planet frame`);

    // Vector 3: Outgoing v_inf(+) (Emerald)
    drawVector(res.vInfPlusMPerS.x, res.vInfPlusMPerS.y, '#10b981', `v_inf(+) in planet frame`);

    // Vector 4: Delta-V assist (Rose)
    const infMinusEndX = cx + res.vInfMinusMPerS.x * scale;
    const infMinusEndY = cy - res.vInfMinusMPerS.y * scale;
    drawVector(res.deltaVAssistMPerS.x, res.deltaVAssistMPerS.y, '#f43f5e', 'Δv_assist', infMinusEndX, infMinusEndY);
  }, [approachSpeed, flybyAltKm, passType]);

  return (
    <section id="gravity-assist-sandbox" className="w-full bg-[#0c0d12] text-white py-16 px-4 sm:px-8 border-t border-b border-[#222530]">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-amber-400">
              [ 05 // DEDICATED THREE-BODY SCENARIO ]
            </span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-sans font-bold tracking-tight uppercase">
            Planetary Gravity Assist Sandbox
          </h2>
          <p className="text-sm text-neutral-400 max-w-2xl leading-relaxed">
            A gravity assist is <strong>not</strong> an ordinary closed orbit. It requires a moving third body to exchange momentum
            in the central reference frame. Inside the planet's rest frame, the encounter is an unperturbed hyperbola where speed is
            strictly conserved (<span className="text-amber-400 font-mono">||v_inf(+) || = ||v_inf(-)||</span>).
          </p>
        </div>

        {/* Interactive Controls & Diagram Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Controls & Readouts */}
          <div className="lg:col-span-5 bg-[#12141c] border border-[#232736] p-5 rounded-xs flex flex-col gap-4">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-300 border-b border-[#232736] pb-2">
              FLYBY PARAMETERS
            </div>

            {/* Pass Type Toggle */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-mono text-neutral-400 uppercase">Encounter Geometry</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPassType('TRAILING')}
                  className={`py-2 px-3 text-xs font-mono rounded-xs border transition-colors ${
                    passType === 'TRAILING'
                      ? 'bg-amber-500 text-black font-bold border-amber-400'
                      : 'bg-[#181c28] text-neutral-400 border-[#282f42] hover:text-white'
                  }`}
                >
                  TRAILING (ACCEL +)
                </button>
                <button
                  onClick={() => setPassType('LEADING')}
                  className={`py-2 px-3 text-xs font-mono rounded-xs border transition-colors ${
                    passType === 'LEADING'
                      ? 'bg-rose-500 text-white font-bold border-rose-400'
                      : 'bg-[#181c28] text-neutral-400 border-[#282f42] hover:text-white'
                  }`}
                >
                  LEADING (BRAKE -)
                </button>
              </div>
            </div>

            {/* Approach Speed */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-neutral-400">HYPERBOLIC EXCESS (v_inf)</span>
                <span className="text-white font-bold">{approachSpeed.toFixed(0)} m/s</span>
              </div>
              <input
                type="range"
                min="800"
                max="4500"
                step="50"
                value={approachSpeed}
                onChange={(e) => setApproachSpeed(parseFloat(e.target.value))}
                className="w-full accent-amber-500 bg-neutral-800 h-1.5 rounded-sm cursor-pointer"
              />
            </div>

            {/* Periapsis Altitude */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-neutral-400">PERIAPSIS ALTITUDE (hp)</span>
                <span className="text-white font-bold">{flybyAltKm.toFixed(0)} km</span>
              </div>
              <input
                type="range"
                min="50"
                max="1500"
                step="25"
                value={flybyAltKm}
                onChange={(e) => setFlybyAltKm(parseFloat(e.target.value))}
                className="w-full accent-sky-500 bg-neutral-800 h-1.5 rounded-sm cursor-pointer"
              />
            </div>

            {/* Calculated Results Box */}
            {result && (
              <div className="bg-[#181b26] p-4 rounded-xs border border-[#282e42] flex flex-col gap-2.5 text-xs">
                <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 border-b border-[#282e42] pb-1">
                  MOMENTUM & ENERGY CONVERSION
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">Hyperbolic Turning Angle (δ):</span>
                  <span className="font-mono font-bold text-amber-400">{result.deflectionAngleDeg.toFixed(1)}°</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">Planet Rest-Frame Speed:</span>
                  <span className="font-mono font-semibold text-emerald-400">
                    {result.vInfSpeedMPerS.toFixed(0)} m/s (CONSTANT)
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">Net Vector Boost (||Δv||):</span>
                  <span className="font-mono font-bold text-rose-400">
                    {result.deltaVAssistMagnitudeMPerS.toFixed(0)} m/s
                  </span>
                </div>

                <div className="border-t border-[#282e42] pt-2 flex justify-between items-center">
                  <span className="text-neutral-400">Central Frame Speed Change:</span>
                  <span className={`font-mono font-bold text-sm ${result.isAcceleration ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {result.vInCentralSpeedMPerS.toFixed(0)} → {result.vOutCentralSpeedMPerS.toFixed(0)} m/s
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Right: Vector Diagram Canvas */}
          <div className="lg:col-span-7 bg-[#12141c] border border-[#232736] p-4 rounded-xs flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
              <span className="uppercase tracking-wider">HYPERBOLIC ENCOUNTER VECTOR TRIANGLE</span>
              <span className="text-neutral-500">[ 2D PLANE PROJECTION ]</span>
            </div>

            <canvas
              ref={canvasRef}
              width={640}
              height={360}
              className="w-full h-auto rounded-xs border border-[#1f2330]"
            />

            <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-neutral-400 pt-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#38bdf8]" />
                <span>Planet Velocity (V_p)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
                <span>Incoming v_inf(-)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                <span>Outgoing v_inf(+)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f43f5e]" />
                <span>Delta-V Boost</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
