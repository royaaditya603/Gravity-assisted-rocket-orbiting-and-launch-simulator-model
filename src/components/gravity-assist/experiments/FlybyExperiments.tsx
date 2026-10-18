import React, { useState } from 'react';
import { PlanetaryBodyData, PLANETARY_BODIES } from '../../../physics/constants';
import { FlybyEngine, FlybyPassType, FlybyInitialConditions } from '../../../physics/FlybyEngine';
import { FlaskConical, Play, ArrowRight, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';

interface FlybyExperimentsProps {
  onLoadPreset: (config: Partial<FlybyInitialConditions>) => void;
}

type ExperimentId = 'EXP_A' | 'EXP_B' | 'EXP_C' | 'EXP_D' | 'EXP_E' | 'EXP_F';

export const FlybyExperiments: React.FC<FlybyExperimentsProps> = ({ onLoadPreset }) => {
  const [activeExp, setActiveExp] = useState<ExperimentId>('EXP_A');

  // Experiment A: Distance sweep for Jupiter at v_inf = 10 km/s
  const expAData = FlybyEngine.runExperimentA_DistanceSweep(PLANETARY_BODIES.JUPITER, 10000.0, 'TRAILING');

  // Experiment B: Speed sweep for Jupiter at 1.5 R_J
  const expBData = FlybyEngine.runExperimentB_SpeedSweep(
    PLANETARY_BODIES.JUPITER,
    PLANETARY_BODIES.JUPITER.radiusM * 1.5,
    'TRAILING'
  );

  // Experiment E: Jupiter vs Saturn
  const expEData = FlybyEngine.runExperimentE_JupiterVsSaturn(12000.0, 'TRAILING', 50000.0);

  return (
    <div className="w-full bg-[#10121a] border border-[#222638] p-5 rounded-xs flex flex-col gap-5 text-white">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#222638] pb-3">
        <div className="flex items-center gap-2">
          <FlaskConical size={18} className="text-amber-400" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-neutral-200">
            CONTROLLED ASTRODYNAMICS EXPERIMENTS (SUITE A — F)
          </span>
        </div>
        <span className="text-[10px] font-mono text-neutral-400">
          SELECT EXPERIMENT TO RUN PARAMETER SWEEPS & VERIFY EQUATIONS
        </span>
      </div>

      {/* Experiment Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 font-mono text-[11px]">
        {[
          { id: 'EXP_A', label: 'EXP A: DISTANCE' },
          { id: 'EXP_B', label: 'EXP B: SPEED' },
          { id: 'EXP_C', label: 'EXP C: MASS / μ' },
          { id: 'EXP_D', label: 'EXP D: ORIENTATION' },
          { id: 'EXP_E', label: 'EXP E: JUPITER vs SATURN' },
          { id: 'EXP_F', label: 'EXP F: PROBE MASS' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveExp(tab.id as ExperimentId)}
            className={`py-2 px-2 rounded-xs border text-center transition-colors ${
              activeExp === tab.id
                ? 'bg-amber-500 text-black font-bold border-amber-400 shadow-sm'
                : 'bg-[#161824] text-neutral-400 border-[#252a3d] hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active Experiment View */}
      <div className="bg-[#0b0c12] border border-[#1d212f] p-4 rounded-xs flex flex-col gap-4">
        {/* EXP A: Closest Approach Distance */}
        {activeExp === 'EXP_A' && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-mono text-sm font-bold text-amber-400 uppercase">
                  Experiment A — Closest-Approach Distance (rp) Sweep
                </h4>
                <p className="text-xs text-neutral-400 max-w-2xl leading-relaxed mt-1">
                  Holding planet (Jupiter) and incoming speed (10.0 km/s) constant, we vary periapsis radius from sub-surface
                  (0.8 Rp) to distant flybys (8.0 Rp). Demonstrates turning angle growth (sin(δ/2) = 1/e) and flags collisions.
                </p>
              </div>
              <button
                onClick={() =>
                  onLoadPreset({
                    planet: PLANETARY_BODIES.JUPITER,
                    vInfSpeedMPerS: 10000.0,
                    targetPeriapsisM: PLANETARY_BODIES.JUPITER.radiusM * 1.5,
                    passType: 'TRAILING',
                  })
                }
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-mono font-bold rounded-xs flex items-center gap-1.5 transition-colors"
              >
                <Play size={12} /> LOAD INTO 3D SIMULATOR
              </button>
            </div>

            {/* Sweep Results Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#222838] text-neutral-400 text-[10px] uppercase">
                    <th className="py-2 px-3">PERIAPSIS (rp)</th>
                    <th className="py-2 px-3">ALTITUDE (km)</th>
                    <th className="py-2 px-3">DEFLECTION (δ)</th>
                    <th className="py-2 px-3">SUN ΔV (km/s)</th>
                    <th className="py-2 px-3">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#181d2b]">
                  {expAData.map((row) => (
                    <tr
                      key={row.rpFactor}
                      className={row.isCollision ? 'bg-rose-950/20 text-rose-300' : 'text-neutral-200'}
                    >
                      <td className="py-2 px-3 font-bold">{row.rpFactor.toFixed(2)} R_p</td>
                      <td className="py-2 px-3">{row.altitudeKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km</td>
                      <td className="py-2 px-3 font-semibold text-amber-400">{row.deflectionDeg.toFixed(1)}°</td>
                      <td className="py-2 px-3 text-sky-400">{(row.deltaVSunSpeedMPerS / 1000.0).toFixed(2)} km/s</td>
                      <td className="py-2 px-3">
                        {row.isCollision ? (
                          <span className="px-2 py-0.5 rounded-xs bg-rose-900/60 text-rose-300 border border-rose-600 text-[10px] font-bold">
                            SURFACE IMPACT
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-xs bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px]">
                            SAFE FLYBY
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* EXP B: Speed Sweep */}
        {activeExp === 'EXP_B' && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-mono text-sm font-bold text-amber-400 uppercase">
                  Experiment B — Incoming Excess Speed (v_∞) Sweep
                </h4>
                <p className="text-xs text-neutral-400 max-w-2xl leading-relaxed mt-1">
                  Holding periapsis constant at 1.5 R_J, we increase incoming speed from 3.0 km/s to 25.0 km/s.
                  As v_∞ increases, eccentricity e = 1 + rp·v_∞² / μ surges, causing the deflection angle to sharply decline.
                </p>
              </div>
              <button
                onClick={() =>
                  onLoadPreset({
                    planet: PLANETARY_BODIES.JUPITER,
                    vInfSpeedMPerS: 5000.0,
                    targetPeriapsisM: PLANETARY_BODIES.JUPITER.radiusM * 1.5,
                    passType: 'TRAILING',
                  })
                }
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-mono font-bold rounded-xs flex items-center gap-1.5 transition-colors"
              >
                <Play size={12} /> LOAD INTO 3D SIMULATOR
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#222838] text-neutral-400 text-[10px] uppercase">
                    <th className="py-2 px-3">INCOMING SPEED (v_∞)</th>
                    <th className="py-2 px-3">DEFLECTION ANGLE (δ)</th>
                    <th className="py-2 px-3">SUN BOOST (+ΔV)</th>
                    <th className="py-2 px-3">SPECIFIC ENERGY GAIN (MJ/kg)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#181d2b]">
                  {expBData.map((row) => (
                    <tr key={row.vInfMPerS} className="text-neutral-200">
                      <td className="py-2 px-3 font-bold">{(row.vInfMPerS / 1000.0).toFixed(1)} km/s</td>
                      <td className="py-2 px-3 font-semibold text-amber-400">{row.deflectionDeg.toFixed(1)}°</td>
                      <td className="py-2 px-3 text-sky-400">{(row.deltaVSunSpeedMPerS / 1000.0).toFixed(2)} km/s</td>
                      <td className="py-2 px-3">{(row.deltaEnergyJPerKg / 1e6).toFixed(2)} MJ/kg</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* EXP C: Planetary Mass */}
        {activeExp === 'EXP_C' && (
          <div className="flex flex-col gap-3">
            <h4 className="font-mono text-sm font-bold text-amber-400 uppercase">
              Experiment C — Planetary Gravitational Parameter (μ) Comparison
            </h4>
            <p className="text-xs text-neutral-400 max-w-2xl leading-relaxed">
              Comparing planetary bodies with identical encounter parameters (v_∞ = 10 km/s, rp = 1.8 × Rp).
              Larger standard gravitational parameters produce stronger gravitational wells, higher eccentricities, and vastly greater turning angles.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-1">
              {Object.values(PLANETARY_BODIES).map((p) => {
                const res = FlybyEngine.computeAnalytical({
                  planet: p,
                  vInfSpeedMPerS: 10000.0,
                  targetPeriapsisM: p.radiusM * 1.8,
                  passType: 'TRAILING',
                  spacecraftMassKg: 1000,
                });
                return (
                  <div key={p.id} className="bg-[#141622] border border-[#23283c] p-3 rounded-xs flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="font-mono font-bold text-xs" style={{ color: p.color }}>
                        {p.name.toUpperCase()}
                      </span>
                      <button
                        onClick={() =>
                          onLoadPreset({
                            planet: p,
                            vInfSpeedMPerS: 10000.0,
                            targetPeriapsisM: p.radiusM * 1.8,
                            passType: 'TRAILING',
                          })
                        }
                        className="p-1 bg-[#1e2334] hover:bg-amber-500 hover:text-black rounded-xs text-[10px] font-mono transition-colors"
                      >
                        SIMULATE
                      </button>
                    </div>
                    <div className="text-[11px] font-mono flex flex-col gap-1 text-neutral-300">
                      <div>μ: {p.mu.toExponential(3)} m³/s²</div>
                      <div>Orbital V_p: {(p.orbitalSpeedMPerS / 1000.0).toFixed(1)} km/s</div>
                      <div className="text-amber-400 font-bold">Deflection: {res.deflectionAngleDeg.toFixed(1)}°</div>
                      <div className="text-sky-400 font-bold">Sun ΔV: {(res.deltaVSunSpeedMPerS / 1000.0).toFixed(2)} km/s</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* EXP D: Flyby Orientation */}
        {activeExp === 'EXP_D' && (
          <div className="flex flex-col gap-3">
            <h4 className="font-mono text-sm font-bold text-amber-400 uppercase">
              Experiment D — Flyby Orientation (Trailing vs Leading Pass)
            </h4>
            <p className="text-xs text-neutral-400 max-w-2xl leading-relaxed">
              In the planet's rest frame, both passes conserve speed: ||v_∞(+) || = ||v_∞(-)||.
              However, in the Sun's frame, momentum exchange with the planet's orbital motion creates either dramatic speed increase or planetary braking.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              <div className="bg-[#141622] border border-amber-500/40 p-4 rounded-xs flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-xs font-bold text-amber-400 uppercase">
                    TRAILING PASS (ACCELERATION +)
                  </span>
                  <button
                    onClick={() =>
                      onLoadPreset({
                        planet: PLANETARY_BODIES.JUPITER,
                        vInfSpeedMPerS: 12000.0,
                        targetPeriapsisM: PLANETARY_BODIES.JUPITER.radiusM * 1.5,
                        passType: 'TRAILING',
                      })
                    }
                    className="px-2 py-1 bg-amber-500 text-black text-[10px] font-mono font-bold rounded-xs"
                  >
                    LOAD PRESET
                  </button>
                </div>
                <div className="text-xs text-neutral-300 space-y-1.5 font-mono">
                  <div>• Geometry: Spacecraft passes behind the planet in its orbital wake</div>
                  <div>• Deflection: Rotates toward planet's velocity vector V_p</div>
                  <div className="text-emerald-400 font-bold">• Sun-Relative Velocity: Increases (+ΔV)</div>
                  <div className="text-emerald-400 font-bold">• Kinetic Energy: Gained from planet's orbital momentum</div>
                  <div className="text-neutral-400 text-[10px]">Used by: Voyager 1 & 2, New Horizons (solar system escape)</div>
                </div>
              </div>

              <div className="bg-[#141622] border border-rose-500/40 p-4 rounded-xs flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-xs font-bold text-rose-400 uppercase">
                    LEADING PASS (GRAVITY BRAKE -)
                  </span>
                  <button
                    onClick={() =>
                      onLoadPreset({
                        planet: PLANETARY_BODIES.JUPITER,
                        vInfSpeedMPerS: 12000.0,
                        targetPeriapsisM: PLANETARY_BODIES.JUPITER.radiusM * 1.5,
                        passType: 'LEADING',
                      })
                    }
                    className="px-2 py-1 bg-rose-500 text-white text-[10px] font-mono font-bold rounded-xs"
                  >
                    LOAD PRESET
                  </button>
                </div>
                <div className="text-xs text-neutral-300 space-y-1.5 font-mono">
                  <div>• Geometry: Spacecraft passes in front of the planet in its orbital path</div>
                  <div>• Deflection: Rotates away from planet's velocity vector V_p</div>
                  <div className="text-rose-400 font-bold">• Sun-Relative Velocity: Decreases (-ΔV)</div>
                  <div className="text-rose-400 font-bold">• Kinetic Energy: Deposited into planet; spacecraft drops inward</div>
                  <div className="text-neutral-400 text-[10px]">Used by: MESSENGER, BepiColombo, Parker Solar Probe</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* EXP E: Jupiter vs Saturn */}
        {activeExp === 'EXP_E' && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-mono text-sm font-bold text-amber-400 uppercase">
                  Experiment E — Jupiter versus Saturn Astrodynamic Comparison
                </h4>
                <p className="text-xs text-neutral-400 max-w-2xl leading-relaxed mt-1">
                  Comparing Jupiter and Saturn at matched excess speed (12.0 km/s) and matched surface altitude (50,000 km).
                  {expEData.comparison.explanation}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              {/* Jupiter Card */}
              <div className="bg-[#141622] border border-[#23283c] p-4 rounded-xs flex flex-col gap-2 font-mono text-xs">
                <span className="font-bold text-amber-400">JUPITER (5.20 AU)</span>
                <div>Standard Gravitational Parameter: {PLANETARY_BODIES.JUPITER.mu.toExponential(4)} m³/s²</div>
                <div>Orbital Speed (V_p): {(PLANETARY_BODIES.JUPITER.orbitalSpeedMPerS / 1000.0).toFixed(2)} km/s</div>
                <div>Turning Angle (δ): <strong className="text-amber-400">{expEData.jupiter.deflectionAngleDeg.toFixed(1)}°</strong></div>
                <div>Sun-Frame ΔV: <strong className="text-emerald-400">+{(expEData.jupiter.deltaVSunSpeedMPerS / 1000.0).toFixed(2)} km/s</strong></div>
              </div>

              {/* Saturn Card */}
              <div className="bg-[#141622] border border-[#23283c] p-4 rounded-xs flex flex-col gap-2 font-mono text-xs">
                <span className="font-bold text-[#e0cda9]">SATURN (9.58 AU)</span>
                <div>Standard Gravitational Parameter: {PLANETARY_BODIES.SATURN.mu.toExponential(4)} m³/s²</div>
                <div>Orbital Speed (V_p): {(PLANETARY_BODIES.SATURN.orbitalSpeedMPerS / 1000.0).toFixed(2)} km/s</div>
                <div>Turning Angle (δ): <strong className="text-amber-400">{expEData.saturn.deflectionAngleDeg.toFixed(1)}°</strong></div>
                <div>Sun-Frame ΔV: <strong className="text-emerald-400">+{(expEData.saturn.deltaVSunSpeedMPerS / 1000.0).toFixed(2)} km/s</strong></div>
              </div>
            </div>
          </div>
        )}

        {/* EXP F: Spacecraft Mass */}
        {activeExp === 'EXP_F' && (
          <div className="flex flex-col gap-3">
            <h4 className="font-mono text-sm font-bold text-amber-400 uppercase">
              Experiment F — Spacecraft Mass Invariance Principle
            </h4>
            <p className="text-xs text-neutral-400 max-w-2xl leading-relaxed">
              In Newton's universal gravitation, F = G(M·m)/r² = m·a implies a = -μ/r² r̂.
              The probe's mass m cancels completely from the acceleration equation! Consequently, a 500 kg microsatellite
              and a 50,000 kg crewed transport follow the EXACT identical geometric trajectory, while total kinetic energy
              ΔK = 0.5·m(v_out² - v_in²) scales strictly with mass.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
              {[500, 2500, 25000].map((mass) => {
                const res = FlybyEngine.computeAnalytical({
                  planet: PLANETARY_BODIES.JUPITER,
                  vInfSpeedMPerS: 12000.0,
                  targetPeriapsisM: PLANETARY_BODIES.JUPITER.radiusM * 1.8,
                  passType: 'TRAILING',
                  spacecraftMassKg: mass,
                });
                return (
                  <div key={mass} className="bg-[#141622] border border-[#23283c] p-3 rounded-xs font-mono text-xs flex flex-col gap-2">
                    <span className="font-bold text-white">PROBE MASS: {mass.toLocaleString()} kg</span>
                    <div>Trajectory Periapsis: {(res.periapsisRadiusM / 1000.0).toLocaleString()} km (IDENTICAL)</div>
                    <div>Deflection Angle: {res.deflectionAngleDeg.toFixed(2)}° (IDENTICAL)</div>
                    <div className="text-sky-400">Total ΔK: {(res.deltaTotalKineticEnergyJ / 1e9).toFixed(2)} GJ</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
