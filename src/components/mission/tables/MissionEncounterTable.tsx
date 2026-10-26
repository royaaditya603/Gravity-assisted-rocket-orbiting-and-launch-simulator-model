import React, { useState } from 'react';
import {
  MissionAnalysisResult,
  MissionEncounterRecord,
  HistoricalDataClassification,
} from '../../../physics/MissionEngine';
import {
  Table,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Compass,
  ArrowRight,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

interface MissionEncounterTableProps {
  mission: MissionAnalysisResult;
  selectedEncounterIndex: number | null;
  onSelectEncounter: (index: number | null) => void;
}

export const MissionEncounterTable: React.FC<MissionEncounterTableProps> = ({
  mission,
  selectedEncounterIndex,
  onSelectEncounter,
}) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const getBadge = (cls: HistoricalDataClassification) => {
    switch (cls) {
      case 'HISTORICAL_FACT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[10px] font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-300">
            <ShieldCheck size={11} /> HISTORICAL FACT
          </span>
        );
      case 'SIMPLIFIED_CALCULATION':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[10px] font-bold bg-sky-950/80 border border-sky-500/50 text-sky-300">
            <Compass size={11} /> SIMPLIFIED MODEL
          </span>
        );
      case 'HYPOTHETICAL_CONCEPT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[10px] font-bold bg-amber-950/80 border border-amber-500/50 text-amber-300">
            <Sparkles size={11} /> HYPOTHETICAL CONCEPT
          </span>
        );
    }
  };

  return (
    <div className="w-full bg-[#0d0f17] border border-[#222538] p-4 rounded-xs text-white font-mono flex flex-col gap-4">
      {/* Table Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2436] pb-3">
        <div className="flex items-center gap-2">
          <Table size={16} className="text-cyan-400" />
          <span className="font-bold text-xs uppercase tracking-wider text-neutral-200">
            ENCOUNTER SEQUENCE LEDGER & STATE TRANSFORMATION MATRIX
          </span>
        </div>
        <div className="text-[11px] text-neutral-400">
          ALL VELOCITY & ENERGY QUANTITIES STRICTLY DERIVED VIA NUMERICAL VECTOR INTEGRATION
        </div>
      </div>

      {/* Responsive Table */}
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#22273a] text-[10px] text-neutral-400 uppercase tracking-wider bg-[#131622]">
              <th className="py-2.5 px-3">#</th>
              <th className="py-2.5 px-3">TARGET BODY</th>
              <th className="py-2.5 px-3">EPOCH (UTC)</th>
              <th className="py-2.5 px-3">PASS</th>
              <th className="py-2.5 px-3">ALTITUDE (h_p)</th>
              <th className="py-2.5 px-3">v_inf (km/s)</th>
              <th className="py-2.5 px-3">DEFLECTION (δ)</th>
              <th className="py-2.5 px-3">v_in,Sun (km/s)</th>
              <th className="py-2.5 px-3">v_out,Sun (km/s)</th>
              <th className="py-2.5 px-3">Δv_Sun (km/s)</th>
              <th className="py-2.5 px-3">CLASSIFICATION</th>
              <th className="py-2.5 px-3 text-right">DETAILS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1b2030]">
            {mission.encounters.map((enc, idx) => {
              const isExpanded = expandedIndex === idx;

              return (
                <React.Fragment key={enc.encounterId}>
                  <tr
                    onClick={() => onSelectEncounter(idx)}
                    className={`transition-colors cursor-pointer ${
                      selectedEncounterIndex === idx
                        ? 'bg-[#181d2e] text-white'
                        : 'hover:bg-[#131724] text-neutral-300'
                    }`}
                  >
                    <td className="py-3 px-3 font-bold text-cyan-400">{enc.encounterIndex}</td>
                    <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor:
                            enc.planetId === 'JUPITER'
                              ? '#d4a373'
                              : enc.planetId === 'SATURN'
                              ? '#e0cda9'
                              : enc.planetId === 'URANUS'
                              ? '#88d3d5'
                              : '#4b70dd',
                        }}
                      />
                      <span>{enc.planetName}</span>
                    </td>
                    <td className="py-3 px-3 text-neutral-300">{enc.targetEpochUTC.slice(0, 10)}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-xs font-bold ${
                          enc.passType === 'TRAILING'
                            ? 'bg-amber-950/60 text-amber-300 border border-amber-600/40'
                            : 'bg-indigo-950/60 text-indigo-300 border border-indigo-600/40'
                        }`}
                      >
                        {enc.passType}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-neutral-300">
                      {enc.periapsisAltitudeKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km
                    </td>
                    <td className="py-3 px-3 font-bold text-cyan-300">
                      {enc.vInfInSpeedKmPerS.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-neutral-200">{enc.deflectionAngleDeg.toFixed(1)}°</td>
                    <td className="py-3 px-3 text-neutral-400">{enc.vInSunSpeedKmPerS.toFixed(2)}</td>
                    <td className="py-3 px-3 font-bold text-white">
                      {enc.vOutSunSpeedKmPerS.toFixed(2)}
                    </td>
                    <td
                      className={`py-3 px-3 font-bold ${
                        enc.deltaVSunSpeedKmPerS >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {enc.deltaVSunSpeedKmPerS >= 0 ? '+' : ''}
                      {enc.deltaVSunSpeedKmPerS.toFixed(2)}
                    </td>
                    <td className="py-3 px-3">{getBadge(enc.classification)}</td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedIndex(isExpanded ? null : idx);
                        }}
                        className="p-1 text-neutral-400 hover:text-white rounded-xs bg-[#1a1f30]"
                      >
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    </td>
                  </tr>

                  {/* Expandable Comparison & Diagnostics Panel */}
                  {isExpanded && (
                    <tr className="bg-[#10131e] border-b border-[#22273a]">
                      <td colSpan={12} className="p-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs font-mono">
                          {/* Left Column: Historical Archival Data vs Model Estimate */}
                          <div className="bg-[#141826] border border-[#252c42] p-3 rounded-xs flex flex-col gap-2">
                            <div className="flex items-center justify-between border-b border-[#232a3f] pb-2">
                              <span className="font-bold text-cyan-300 uppercase tracking-wider text-[11px]">
                                ARCHIVAL GROUND TRUTH VS. SIMULATED MODEL
                              </span>
                              {enc.historicalData?.documentationUrl && (
                                <a
                                  href={enc.historicalData.documentationUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1"
                                >
                                  <span>SOURCE DOCUMENT</span>
                                  <ExternalLink size={10} />
                                </a>
                              )}
                            </div>

                            {enc.historicalData ? (
                              <div className="flex flex-col gap-2">
                                <div className="text-[11px] text-neutral-300">
                                  <span className="text-neutral-500">Archival Reference:</span>{' '}
                                  {enc.historicalData.archivalSource}
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-[11px]">
                                  <div className="bg-[#181d2e] p-2 rounded-xs border border-[#273047]">
                                    <span className="text-neutral-500 block text-[10px]">
                                      HISTORICAL NASA MEASUREMENT
                                    </span>
                                    <div>Epoch: {enc.historicalData.documentedEncounterEpochUTC}</div>
                                    <div>Altitude: {enc.historicalData.documentedAltitudeKm.toLocaleString()} km</div>
                                    <div>v_inf: {enc.historicalData.documentedVInfKmPerS} km/s</div>
                                    <div>Deflection: {enc.historicalData.documentedDeflectionDeg}°</div>
                                    <div className="text-emerald-400 font-bold">
                                      Δv Boost: +{enc.historicalData.documentedDeltaVSunKmPerS} km/s
                                    </div>
                                  </div>

                                  <div className="bg-[#181d2e] p-2 rounded-xs border border-[#273047]">
                                    <span className="text-neutral-500 block text-[10px]">
                                      SIMULATED PATCHED-CONIC MODEL
                                    </span>
                                    <div>Epoch: {enc.targetEpochUTC}</div>
                                    <div>Altitude: {enc.periapsisAltitudeKm.toLocaleString()} km</div>
                                    <div>v_inf: {enc.vInfInSpeedKmPerS.toFixed(2)} km/s</div>
                                    <div>Deflection: {enc.deflectionAngleDeg.toFixed(1)}°</div>
                                    <div className="text-cyan-400 font-bold">
                                      Δv Boost: {enc.deltaVSunSpeedKmPerS >= 0 ? '+' : ''}
                                      {enc.deltaVSunSpeedKmPerS.toFixed(2)} km/s
                                    </div>
                                  </div>
                                </div>

                                <div className="text-[10px] text-neutral-400 bg-[#161a29] p-2 rounded-xs border border-[#232a3f]">
                                  {enc.historicalData.historicalNotes}
                                </div>
                              </div>
                            ) : (
                              <div className="text-neutral-400 text-xs py-2">
                                Educational conceptual leg. No direct historical spacecraft encounter flown.
                              </div>
                            )}
                          </div>

                          {/* Right Column: Heliocentric Orbit Reshaping & State Vectors */}
                          <div className="bg-[#141826] border border-[#252c42] p-3 rounded-xs flex flex-col gap-2">
                            <span className="font-bold text-amber-300 uppercase tracking-wider text-[11px] border-b border-[#232a3f] pb-2">
                              HELIOCENTRIC CONIC ELEMENTS RESHAPING
                            </span>

                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                              <div className="bg-[#181d2e] p-2 rounded-xs border border-[#273047]">
                                <span className="text-neutral-500 block text-[10px]">PRE-FLYBY ORBIT</span>
                                <div>a: {enc.preFlybyOrbit.semiMajorAxisAU.toFixed(3)} AU</div>
                                <div>e: {enc.preFlybyOrbit.eccentricity.toFixed(3)}</div>
                                <div>Perihelion: {enc.preFlybyOrbit.perihelionAU.toFixed(2)} AU</div>
                                <div>
                                  Aphelion:{' '}
                                  {enc.preFlybyOrbit.aphelionAU === Infinity
                                    ? 'Escape (∞)'
                                    : `${enc.preFlybyOrbit.aphelionAU.toFixed(2)} AU`}
                                </div>
                                <div>Energy: {enc.preFlybyOrbit.specificEnergyMJPerKg.toFixed(1)} MJ/kg</div>
                              </div>

                              <div className="bg-[#181d2e] p-2 rounded-xs border border-[#273047]">
                                <span className="text-neutral-500 block text-[10px]">POST-FLYBY ORBIT</span>
                                <div>
                                  a:{' '}
                                  {enc.postFlybyOrbit.semiMajorAxisAU === Infinity
                                    ? 'Hyperbolic'
                                    : `${enc.postFlybyOrbit.semiMajorAxisAU.toFixed(3)} AU`}
                                </div>
                                <div>e: {enc.postFlybyOrbit.eccentricity.toFixed(3)}</div>
                                <div>Perihelion: {enc.postFlybyOrbit.perihelionAU.toFixed(2)} AU</div>
                                <div>
                                  Aphelion:{' '}
                                  {enc.postFlybyOrbit.aphelionAU === Infinity
                                    ? 'Escape (∞)'
                                    : `${enc.postFlybyOrbit.aphelionAU.toFixed(2)} AU`}
                                </div>
                                <div className="text-amber-300 font-bold">
                                  Energy: {enc.postFlybyOrbit.specificEnergyMJPerKg.toFixed(1)} MJ/kg
                                </div>
                              </div>
                            </div>

                            <div className="text-[10px] text-neutral-400 bg-[#161a29] p-2 rounded-xs border border-[#232a3f]">
                              Specific Orbital Energy Gain: ΔE = +{enc.deltaSpecificEnergyMJPerKg.toFixed(2)} MJ/kg.
                              Transformed elliptical orbit into high-aphelion trans-planetary transfer.
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
