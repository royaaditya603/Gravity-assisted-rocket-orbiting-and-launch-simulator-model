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
    ON_PAD: { text: 'text-[#68758A]', bg: 'bg-[#EEF2F8]', border: 'border-[#DCE3EE]' },
    POWERED_ASCENT: { text: 'text-[#7A3E1D]', bg: 'bg-[#FFD2B8]', border: 'border-[#F5BCA0]' },
    COASTING: { text: 'text-[#14426B]', bg: 'bg-[#A9D4F5]', border: 'border-[#89C2EE]' },
    ORBIT_ACHIEVED: { text: 'text-[#1D6C50]', bg: 'bg-[#AEE5D0]', border: 'border-[#95D9BF]' },
    ESCAPE_TRAJECTORY: { text: 'text-[#4A347F]', bg: 'bg-[#C9BDF2]', border: 'border-[#B2A4DE]' },
    ATMOSPHERIC_REENTRY: { text: 'text-[#7A3E1D]', bg: 'bg-[#FFD2B8]', border: 'border-[#F5BCA0]' },
    SURFACE_IMPACTED: { text: 'text-[#83263E]', bg: 'bg-[#F2B9C6]', border: 'border-[#E89EAE]' },
  };

  const currentBadge = phaseColors[sim.flightPhase] || phaseColors.ON_PAD;

  return (
    <div className="absolute top-4 left-4 z-20 pointer-events-none flex flex-col gap-2 max-w-sm sm:max-w-md">
      {/* Top Header Card */}
      <div className="bg-white/95 backdrop-blur-md border border-[#DCE3EE] p-3 rounded-xl pointer-events-auto shadow-lg text-[#263247]">
        <div className="flex items-center justify-between border-b border-[#DCE3EE] pb-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#059669] animate-pulse" />
            <span className="text-[10px] font-mono tracking-widest uppercase text-[#68758A]">
              TELEMETRY BUS // ECI 2026
            </span>
          </div>
          <span className="text-xs font-mono font-bold text-[#263247]">
            T+ {sim.timeS.toFixed(1)}s
          </span>
        </div>

        {/* Flight Phase Badge */}
        <div className="mb-3">
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-bold uppercase tracking-wider rounded-lg border ${currentBadge.bg} ${currentBadge.text} ${currentBadge.border}`}
          >
            <span>STATUS:</span>
            <span>{sim.flightPhase.replace('_', ' ')}</span>
          </div>
        </div>

        {/* Primary Gauges Grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#68758A]">Altitude</div>
            <div className="font-mono-telemetry font-bold text-[#263247] text-base">
              {altKm >= 1000 ? altKm.toFixed(0) : altKm.toFixed(1)} <span className="text-xs text-[#68758A] font-normal">km</span>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#68758A]">Speed (Inertial)</div>
            <div className="font-mono-telemetry font-bold text-[#263247] text-base">
              {speed.toFixed(0)} <span className="text-xs text-[#68758A] font-normal">m/s</span>{' '}
              <span className="text-[10px] text-[#68758A] font-normal">(M{mach.toFixed(1)})</span>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#68758A]">Acceleration</div>
            <div className="font-mono-telemetry font-bold text-[#263247] text-sm">
              {accel.toFixed(1)} <span className="text-[10px] text-[#68758A] font-normal">m/s²</span>{' '}
              <span className="text-[10px] text-[#7A3E1D] font-normal font-bold">({gForce.toFixed(1)} G)</span>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#68758A]">Vehicle Mass</div>
            <div className="font-mono-telemetry font-bold text-[#263247] text-sm">
              {massTonnes.toFixed(1)} <span className="text-[10px] text-[#68758A] font-normal">t</span>{' '}
              <span className="text-[10px] text-[#14426B] font-normal font-bold">({propPercent.toFixed(0)}% fuel)</span>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#68758A]">Specific Energy</div>
            <div className="font-mono-telemetry font-bold text-[#263247] text-sm">
              {specificEnergyMJ >= 0 ? `+${specificEnergyMJ.toFixed(2)}` : specificEnergyMJ.toFixed(2)}{' '}
              <span className="text-[10px] text-[#68758A] font-normal">MJ/kg</span>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#68758A]">Dynamic Pressure Q</div>
            <div className="font-mono-telemetry font-bold text-[#263247] text-sm">
              {dynamicPressureKPa.toFixed(1)}{' '}
              <span className="text-[10px] text-[#68758A] font-normal">kPa</span>
            </div>
          </div>

          <div className="col-span-2 border-t border-[#DCE3EE] pt-2 mt-1 grid grid-cols-3 gap-2">
            <div>
              <div className="text-[9px] font-mono uppercase text-[#68758A]">Perigee (hp)</div>
              <div className="font-mono-telemetry font-semibold text-[#263247] text-xs">
                {periapsisKm.toFixed(0)} km
              </div>
            </div>
            <div>
              <div className="text-[9px] font-mono uppercase text-[#68758A]">Apogee (ha)</div>
              <div className="font-mono-telemetry font-semibold text-[#263247] text-xs">
                {apoapsisKm !== null ? `${apoapsisKm.toFixed(0)} km` : 'ESCAPE'}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-mono uppercase text-[#68758A]">Eccentricity (e)</div>
              <div className="font-mono-telemetry font-semibold text-[#263247] text-xs">
                {ecc.toFixed(3)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
