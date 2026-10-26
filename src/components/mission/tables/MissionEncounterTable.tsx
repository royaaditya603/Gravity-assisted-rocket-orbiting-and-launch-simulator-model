import React, { useState } from 'react';
import {
  MissionAnalysisResult,
  HistoricalDataClassification,
} from '../../../physics/MissionEngine';
import {
  Table,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Compass,
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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#AEE5D0]/35 border border-[#AEE5D0] text-[#1D6C50]">
            <ShieldCheck size={11} /> HISTORICAL FACT
          </span>
        );
      case 'SIMPLIFIED_CALCULATION':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#A9D4F5]/35 border border-[#A9D4F5] text-[#14426B]">
            <Compass size={11} /> SIMPLIFIED MODEL
          </span>
        );
      case 'HYPOTHETICAL_CONCEPT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#FFD2B8]/40 border border-[#FFD2B8] text-[#7A3E1D]">
            <Sparkles size={11} /> HYPOTHETICAL CONCEPT
          </span>
        );
    }
  };

  return (
    <div className="w-full bg-white border border-[#DCE3EE] p-5 rounded-xl text-[#263247] font-mono flex flex-col gap-4 shadow-xs">
      {/* Table Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE3EE] pb-3">
        <div className="flex items-center gap-2">
          <Table size={16} className="text-[#0284C7]" />
          <span className="font-bold text-xs uppercase tracking-wider text-[#14426B]">
            ENCOUNTER SEQUENCE LEDGER & STATE TRANSFORMATION MATRIX
          </span>
        </div>
        <div className="text-[11px] text-[#68758A]">
          ALL VELOCITY & ENERGY QUANTITIES STRICTLY DERIVED VIA NUMERICAL VECTOR INTEGRATION
        </div>
      </div>

      {/* Responsive Table */}
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#DCE3EE] text-[10px] text-[#68758A] uppercase tracking-wider bg-[#EEF2F8]">
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
          <tbody className="divide-y divide-[#DCE3EE]">
            {mission.encounters.map((enc, idx) => {
              const isExpanded = expandedIndex === idx;

              return (
                <React.Fragment key={enc.encounterId}>
                  <tr
                    onClick={() => onSelectEncounter(idx)}
                    className={`transition-colors cursor-pointer ${
                      selectedEncounterIndex === idx
                        ? 'bg-[#A9D4F5]/25 text-[#14426B] font-semibold'
                        : 'hover:bg-[#F8FAFD] text-[#263247]'
                    }`}
                  >
                    <td className="py-3 px-3 font-bold text-[#0284C7]">{enc.encounterIndex}</td>
                    <td className="py-3 px-3 font-bold text-[#263247] flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
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
                    <td className="py-3 px-3 text-[#68758A]">{enc.targetEpochUTC.slice(0, 10)}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                          enc.passType === 'TRAILING'
                            ? 'bg-[#FFD2B8]/40 text-[#7A3E1D] border border-[#FFD2B8]'
                            : 'bg-[#C9BDF2]/40 text-[#4A347F] border border-[#C9BDF2]'
                        }`}
                      >
                        {enc.passType}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[#263247]">
                      {enc.periapsisAltitudeKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km
                    </td>
                    <td className="py-3 px-3 font-bold text-[#0284C7]">
                      {enc.vInfInSpeedKmPerS.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-[#263247]">{enc.deflectionAngleDeg.toFixed(1)}°</td>
                    <td className="py-3 px-3 text-[#68758A]">{enc.vInSunSpeedKmPerS.toFixed(2)}</td>
                    <td className="py-3 px-3 font-bold text-[#263247]">
                      {enc.vOutSunSpeedKmPerS.toFixed(2)}
                    </td>
                    <td
                      className={`py-3 px-3 font-bold ${
                        enc.deltaVSunSpeedKmPerS >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'
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
                        className="p-1 text-[#68758A] hover:text-[#263247] rounded-md bg-[#EEF2F8] cursor-pointer"
                      >
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    </td>
                  </tr>

                  {/* Expandable Comparison & Diagnostics Panel */}
                  {isExpanded && (
                    <tr className="bg-[#F8FAFD] border-b border-[#DCE3EE]">
                      <td colSpan={12} className="p-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs font-mono">
                          {/* Left Column: Historical Archival Data vs Model Estimate */}
                          <div className="bg-white border border-[#DCE3EE] p-3.5 rounded-xl flex flex-col gap-2 shadow-2xs">
                            <div className="flex items-center justify-between border-b border-[#DCE3EE] pb-2">
                              <span className="font-bold text-[#14426B] uppercase tracking-wider text-[11px]">
                                ARCHIVAL GROUND TRUTH VS. SIMULATED MODEL
                              </span>
                              {enc.historicalData?.documentationUrl && (
                                <a
                                  href={enc.historicalData.documentationUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-[#0284C7] hover:underline flex items-center gap-1 font-semibold"
                                >
                                  <span>SOURCE DOCUMENT</span>
                                  <ExternalLink size={10} />
                                </a>
                              )}
                            </div>

                            {enc.historicalData ? (
                              <div className="flex flex-col gap-2">
                                <div className="text-[11px] text-[#263247]">
                                  <span className="text-[#68758A]">Archival Reference:</span>{' '}
                                  {enc.historicalData.archivalSource}
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-[11px]">
                                  <div className="bg-[#F8FAFD] p-2.5 rounded-lg border border-[#DCE3EE]">
                                    <span className="text-[#68758A] block text-[10px] font-semibold">
                                      HISTORICAL NASA MEASUREMENT
                                    </span>
                                    <div>Epoch: {enc.historicalData.documentedEncounterEpochUTC}</div>
                                    <div>Altitude: {enc.historicalData.documentedAltitudeKm.toLocaleString()} km</div>
                                    <div>v_inf: {enc.historicalData.documentedVInfKmPerS} km/s</div>
                                    <div>Deflection: {enc.historicalData.documentedDeflectionDeg}°</div>
                                    <div className="text-[#059669] font-bold">
                                      Δv Boost: +{enc.historicalData.documentedDeltaVSunKmPerS} km/s
                                    </div>
                                  </div>

                                  <div className="bg-[#F8FAFD] p-2.5 rounded-lg border border-[#DCE3EE]">
                                    <span className="text-[#68758A] block text-[10px] font-semibold">
                                      SIMULATED PATCHED-CONIC MODEL
                                    </span>
                                    <div>Epoch: {enc.targetEpochUTC}</div>
                                    <div>Altitude: {enc.periapsisAltitudeKm.toLocaleString()} km</div>
                                    <div>v_inf: {enc.vInfInSpeedKmPerS.toFixed(2)} km/s</div>
                                    <div>Deflection: {enc.deflectionAngleDeg.toFixed(1)}°</div>
                                    <div className="text-[#0284C7] font-bold">
                                      Δv Boost: {enc.deltaVSunSpeedKmPerS >= 0 ? '+' : ''}
                                      {enc.deltaVSunSpeedKmPerS.toFixed(2)} km/s
                                    </div>
                                  </div>
                                </div>

                                <div className="text-[10px] text-[#68758A] bg-[#F8FAFD] p-2.5 rounded-lg border border-[#DCE3EE] leading-relaxed">
                                  {enc.historicalData.historicalNotes}
                                </div>
                              </div>
                            ) : (
                              <div className="text-[#68758A] text-xs py-2">
                                Educational conceptual leg. No direct historical spacecraft encounter flown.
                              </div>
                            )}
                          </div>

                          {/* Right Column: Heliocentric Orbit Reshaping & State Vectors */}
                          <div className="bg-white border border-[#DCE3EE] p-3.5 rounded-xl flex flex-col gap-2 shadow-2xs">
                            <span className="font-bold text-[#14426B] uppercase tracking-wider text-[11px] border-b border-[#DCE3EE] pb-2">
                              HELIOCENTRIC CONIC ELEMENTS RESHAPING
                            </span>

                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                              <div className="bg-[#F8FAFD] p-2.5 rounded-lg border border-[#DCE3EE]">
                                <span className="text-[#68758A] block text-[10px] font-semibold">PRE-FLYBY ORBIT</span>
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

                              <div className="bg-[#F8FAFD] p-2.5 rounded-lg border border-[#DCE3EE]">
                                <span className="text-[#68758A] block text-[10px] font-semibold">POST-FLYBY ORBIT</span>
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
                                <div className="text-[#B45309] font-bold">
                                  Energy: {enc.postFlybyOrbit.specificEnergyMJPerKg.toFixed(1)} MJ/kg
                                </div>
                              </div>
                            </div>

                            <div className="text-[10px] text-[#68758A] bg-[#F8FAFD] p-2.5 rounded-lg border border-[#DCE3EE] leading-relaxed">
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
