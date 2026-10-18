import React from 'react';
import { SimulationManager, FlightPhase } from '../../../simulation/SimulationManager';
import { R_EARTH } from '../../../physics';

interface TelemetryHUDProps {
  sim: SimulationManager;
}

export const TelemetryHUD: React.FC<TelemetryHUDProps> = ({ sim }) => {
  const r = sim.position.magnitude();
  const altKm = Math.max(0, (r - R_EARTH) / 1000.0);
  const speed = sim.velocity.magnitude();
  const mach = speed / 340.0;
  const accel = sim.acceleration.magnitude();
  const gForce = accel / 9.80665;
  const massTonnes = sim.rocket.totalMassKg / 1000.0;
  const propTonnes = sim.rocket.propellantRemainingKg / 1000.0;
  const propPercent = sim.rocket.initialPropellantMassKg > 0
    ? (sim.rocket.propellantRemainingKg / sim.rocket.initialPropellantMassKg) * 100.0
    : 0.0;
  const specificEnergyMJ = sim.keplerian.specificEnergyJPerKg / 1e6;
  const dynamicPressureKPa = sim.dynamicPressurePa / 1000.0;
  const ecc = sim.keplerian.eccentricity;
  const periapsisKm = sim.keplerian.periapsisAltitudeM / 1000.0;
  const apoapsisKm = sim.keplerian.apoapsisAltitudeM !== null
    ? sim.keplerian.apoapsisAltitudeM / 1000.0
    : null;

  const phaseColors: Record<FlightPhase, { text: string; bg: string; border: string }> = {
    ON_PAD: { text: 'text-neutral-400', bg: 'bg-neutral-800/40', border: 'border-neutral-700' },
    POWERED_ASCENT: { text: 'text-amber-400', bg: 'bg-amber-950/40', border: 'border-amber-700/60' },
    COASTING: { text: 'text-sky-400', bg: 'bg-sky-950/40', border: 'border-sky-700/60' },
    ORBIT_ACHIEVED: { text: 'text-emerald-400', bg: 'bg-emerald-950/40', border: 'border-emerald-700/60' },
    ESCAPE_TRAJECTORY: { text: 'text-purple-400', bg: 'bg-purple-950/40', border: 'border-purple-700/60' },
    ATMOSPHERIC_REENTRY: { text: 'text-orange-400', bg: 'bg-orange-950/40', border: 'border-orange-700/60' },
    SURFACE_IMPACTED: { text: 'text-rose-400', bg: 'bg-rose-950/40', border: 'border-rose-700/60' },
  };

  const currentBadge = phaseColors[sim.flightPhase] || phaseColors.ON_PAD;

  return (
    <div className="absolute top-4 left-4 z-20 pointer-events-none flex flex-col gap-2 max-w-sm sm:max-w-md">
      {/* Top Header Card */}
      <div className="bg-[#0e1017]/85 backdrop-blur-md border border-[#232733] p-3 rounded-sm pointer-events-auto shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#232733] pb-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-mono tracking-widest uppercase text-neutral-400">
              TELEMETRY BUS // ECI 2026
            </span>
          </div>
          <span className="text-xs font-mono font-bold text-neutral-300">
            T+ {sim.timeS.toFixed(1)}s
          </span>
        </div>

        {/* Flight Phase Badge */}
        <div className="mb-3">
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-bold uppercase tracking-wider rounded-xs border ${currentBadge.bg} ${currentBadge.text} ${currentBadge.border}`}
          >
            <span>STATUS:</span>
            <span>{sim.flightPhase.replace('_', ' ')}</span>
          </div>
        </div>

        {/* Primary Gauges Grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">Altitude</div>
            <div className="font-mono-telemetry font-bold text-white text-base">
              {altKm >= 1000 ? altKm.toFixed(0) : altKm.toFixed(1)} <span className="text-xs text-neutral-400 font-normal">km</span>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">Speed (Inertial)</div>
            <div className="font-mono-telemetry font-bold text-white text-base">
              {speed.toFixed(0)} <span className="text-xs text-neutral-400 font-normal">m/s</span>{' '}
              <span className="text-[10px] text-neutral-500 font-normal">(M{mach.toFixed(1)})</span>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">Acceleration</div>
            <div className="font-mono-telemetry font-bold text-white text-sm">
              {accel.toFixed(1)} <span className="text-[10px] text-neutral-400 font-normal">m/s²</span>{' '}
              <span className="text-[10px] text-amber-400 font-normal">({gForce.toFixed(1)} G)</span>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">Vehicle Mass</div>
            <div className="font-mono-telemetry font-bold text-white text-sm">
              {massTonnes.toFixed(1)} <span className="text-[10px] text-neutral-400 font-normal">t</span>{' '}
              <span className="text-[10px] text-sky-400 font-normal">({propPercent.toFixed(0)}% fuel)</span>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">Specific Energy</div>
            <div className="font-mono-telemetry font-bold text-white text-sm">
              {specificEnergyMJ >= 0 ? `+${specificEnergyMJ.toFixed(2)}` : specificEnergyMJ.toFixed(2)}{' '}
              <span className="text-[10px] text-neutral-400 font-normal">MJ/kg</span>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">Dynamic Pressure Q</div>
            <div className="font-mono-telemetry font-bold text-white text-sm">
              {dynamicPressureKPa.toFixed(1)}{' '}
              <span className="text-[10px] text-neutral-400 font-normal">kPa</span>
            </div>
          </div>

          <div className="col-span-2 border-t border-[#232733] pt-2 mt-1 grid grid-cols-3 gap-2">
            <div>
              <div className="text-[9px] font-mono uppercase text-neutral-500">Perigee (hp)</div>
              <div className="font-mono-telemetry font-semibold text-neutral-200 text-xs">
                {periapsisKm.toFixed(0)} km
              </div>
            </div>
            <div>
              <div className="text-[9px] font-mono uppercase text-neutral-500">Apogee (ha)</div>
              <div className="font-mono-telemetry font-semibold text-neutral-200 text-xs">
                {apoapsisKm !== null ? `${apoapsisKm.toFixed(0)} km` : 'ESCAPE'}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-mono uppercase text-neutral-500">Eccentricity (e)</div>
              <div className="font-mono-telemetry font-semibold text-neutral-200 text-xs">
                {ecc.toFixed(3)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
