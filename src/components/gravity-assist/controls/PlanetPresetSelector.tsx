import React from 'react';
import { PlanetaryBodyData, PLANETARY_BODIES, AU } from '../../../physics/constants';
import {
  PLANETARY_DATA,
  JUPITER_PRESET,
  SATURN_PRESET,
  EARTH_PRESET,
  MARS_PRESET,
  VENUS_PRESET,
  MERCURY_PRESET,
  URANUS_PRESET,
  NEPTUNE_PRESET,
} from '../../../physics/planetaryData';
import { FlybyScenarioConfig, getEducationalPresets } from '../../../physics/FlybyScenario';
import { ParameterTooltip, UnitBadge } from './ParameterTooltip';
import { Globe, Info, Sparkles, BookOpen } from 'lucide-react';

export interface PlanetPresetSelectorProps {
  selectedPresetId: string;
  isCustomPlanet: boolean;
  onSelectPreset: (presetKey: string) => void;
  onSelectEducationalPreset?: (scenario: FlybyScenarioConfig) => void;
  planetData: {
    name: string;
    massKg: number;
    radiusM: number;
    mu: number;
    semiMajorAxisM: number;
    orbitalSpeedMPerS: number;
    color?: string;
    sourceOrReference?: string;
    modelSimplificationNote?: string;
    ringInnerRadiusM?: number;
    ringOuterRadiusM?: number;
  };
}

const PRIMARY_PRESETS = [
  { key: 'EARTH', label: 'Earth', body: EARTH_PRESET, subtitle: '1.000 AU • Terrestrial' },
  { key: 'MARS', label: 'Mars', body: MARS_PRESET, subtitle: '1.524 AU • Terrestrial' },
  { key: 'JUPITER', label: 'Jupiter', body: JUPITER_PRESET, subtitle: '5.204 AU • Gas Giant (Default)' },
  { key: 'SATURN', label: 'Saturn', body: SATURN_PRESET, subtitle: '9.582 AU • Ringed Giant' },
  { key: 'CUSTOM', label: 'Custom Planet', body: null, subtitle: 'User-Defined Theoretical Body' },
];

const SECONDARY_PRESETS = [
  { key: 'VENUS', label: 'Venus', body: VENUS_PRESET },
  { key: 'MERCURY', label: 'Mercury', body: MERCURY_PRESET },
  { key: 'URANUS', label: 'Uranus', body: URANUS_PRESET },
  { key: 'NEPTUNE', label: 'Neptune', body: NEPTUNE_PRESET },
];

export const PlanetPresetSelector: React.FC<PlanetPresetSelectorProps> = ({
  selectedPresetId,
  isCustomPlanet,
  onSelectPreset,
  onSelectEducationalPreset,
  planetData,
}) => {
  const educationalPresets = React.useMemo(() => getEducationalPresets(), []);

  const surfaceGravity =
    planetData.radiusM > 0
      ? (planetData.mu / (planetData.radiusM * planetData.radiusM)).toFixed(2)
      : '0.00';

  return (
    <div className="flex flex-col gap-4 font-mono text-white">
      {/* 1. Primary Planet Preset Buttons */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Globe size={14} className="text-amber-400" />
            <span className="text-[11px] font-bold text-neutral-300 uppercase">
              PLANETARY BODY PRESET SELECTION:
            </span>
            <ParameterTooltip
              title="Planetary Body Presets"
              description="Documented canonical solar system bodies and theoretical custom planet. Masses, radii, and standard gravitational parameters (μ = GM) are sourced from NASA Goddard Fact Sheets and IAU WGCCRE 2015."
              source="NASA / IAU 2015 / JPL DE440"
            />
          </div>
          <span className="text-[10px] text-neutral-400">
            Source: NASA Planetary Fact Sheets / IAU 2015 WGCCRE
          </span>
        </div>

        {/* Primary 5: Earth, Mars, Jupiter, Saturn, Custom */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {PRIMARY_PRESETS.map((p) => {
            const isSelected =
              p.key === 'CUSTOM'
                ? isCustomPlanet || selectedPresetId === 'CUSTOM'
                : selectedPresetId === p.key && !isCustomPlanet;

            return (
              <button
                key={p.key}
                type="button"
                onClick={() => onSelectPreset(p.key)}
                className={`py-2 px-3 text-xs font-bold rounded-xs transition-all border cursor-pointer text-left flex flex-col gap-0.5 ${
                  isSelected
                    ? 'bg-amber-500 text-black border-amber-400 shadow-md ring-1 ring-amber-400'
                    : 'bg-[#141724] text-neutral-300 hover:text-white hover:bg-[#1a1f30] border-[#252c40]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="uppercase">{p.label}</span>
                  {isSelected && <span className="text-[9px] px-1 bg-black/30 text-black rounded-xs">ACTIVE</span>}
                </div>
                <span className={`text-[9px] font-normal ${isSelected ? 'text-black/80' : 'text-neutral-500'}`}>
                  {p.subtitle}
                </span>
              </button>
            );
          })}
        </div>

        {/* Other Solar System Bodies dropdown/row */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
          <span className="text-neutral-500 text-[10px]">ADDITIONAL SOLAR SYSTEM BODIES:</span>
          {SECONDARY_PRESETS.map((p) => {
            const isSelected = selectedPresetId === p.key && !isCustomPlanet;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => onSelectPreset(p.key)}
                className={`px-2 py-0.5 rounded-xs border text-[10px] cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-amber-500 text-black font-bold border-amber-400'
                    : 'bg-[#10131d] text-neutral-400 hover:text-neutral-200 border-[#1f2538]'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Physical Constants Dossier Card */}
      <div className="bg-[#0b0c13] p-3.5 rounded-xs border border-[#1e2436] flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#181d2c] pb-2">
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full border border-white/20"
              style={{ backgroundColor: planetData.color || '#4f9fff' }}
            />
            <span className="text-xs font-bold text-amber-300 uppercase">
              {planetData.name} — Physical Constants & Orbital Parameters
            </span>
          </div>
          <span className="text-[10px] text-neutral-400">
            {planetData.sourceOrReference || 'NASA Planetary Fact Sheet / JPL DE440'}
          </span>
        </div>

        {/* Constants Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
          <div className="bg-[#121522] p-2 rounded-xs border border-[#1e2336] flex flex-col gap-0.5">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500 text-[10px]">MASS (M)</span>
              <UnitBadge unit="kg" />
            </div>
            <div className="text-white font-bold text-[11px] truncate" title={`${planetData.massKg} kg`}>
              {planetData.massKg.toExponential(4)}
            </div>
          </div>

          <div className="bg-[#121522] p-2 rounded-xs border border-[#1e2336] flex flex-col gap-0.5">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500 text-[10px]">MEAN RADIUS (R_p)</span>
              <UnitBadge unit="km" />
            </div>
            <div className="text-white font-bold text-[11px]">
              {(planetData.radiusM / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </div>
          </div>

          <div className="bg-[#121522] p-2 rounded-xs border border-[#1e2336] flex flex-col gap-0.5">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500 text-[10px]">GRAV. PARAMETER (μ)</span>
              <UnitBadge unit="m³/s²" />
            </div>
            <div className="text-amber-400 font-bold text-[11px] truncate" title={`${planetData.mu} m³/s²`}>
              {planetData.mu.toExponential(4)}
            </div>
          </div>

          <div className="bg-[#121522] p-2 rounded-xs border border-[#1e2336] flex flex-col gap-0.5">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500 text-[10px]">SEMI-MAJOR AXIS (a)</span>
              <UnitBadge unit="AU" />
            </div>
            <div className="text-sky-400 font-bold text-[11px]">
              {(planetData.semiMajorAxisM / AU).toFixed(3)}
            </div>
          </div>

          <div className="bg-[#121522] p-2 rounded-xs border border-[#1e2336] flex flex-col gap-0.5">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500 text-[10px]">ORBITAL SPEED (v_orb)</span>
              <UnitBadge unit="km/s" />
            </div>
            <div className="text-emerald-400 font-bold text-[11px]">
              {(planetData.orbitalSpeedMPerS / 1000).toFixed(2)}
            </div>
          </div>

          <div className="bg-[#121522] p-2 rounded-xs border border-[#1e2336] flex flex-col gap-0.5">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500 text-[10px]">SURFACE GRAVITY (g)</span>
              <UnitBadge unit="m/s²" />
            </div>
            <div className="text-purple-400 font-bold text-[11px]">
              {surfaceGravity}
            </div>
          </div>
        </div>

        {/* Ring Parameters (if applicable) */}
        {planetData.ringInnerRadiusM && planetData.ringOuterRadiusM && (
          <div className="bg-[#101320] px-3 py-1.5 rounded-xs border border-[#20273d] flex items-center justify-between text-[10px] text-yellow-300/90">
            <span>
              <strong>PLANETARY RING SYSTEM:</strong> Inner boundary:{' '}
              {(planetData.ringInnerRadiusM / 1000).toLocaleString()} km • Outer boundary:{' '}
              {(planetData.ringOuterRadiusM / 1000).toLocaleString()} km
            </span>
          </div>
        )}

        {/* Model Simplification Disclaimer */}
        <div className="flex items-start gap-2 bg-[#08090f] p-2.5 rounded-xs border border-[#171a26] text-[10px] text-neutral-400 leading-relaxed">
          <Info size={14} className="text-sky-400 flex-shrink-0 mt-0.5" />
          <span>
            <strong>ENGINEERING SIMPLIFICATION NOTICE:</strong>{' '}
            {planetData.modelSimplificationNote ||
              'Planet is modeled as a spherically symmetric point mass in an unperturbed coplanar circular heliocentric orbit. Oblateness harmonics (J2, J4) and planetary orbital eccentricity are neglected for canonical two-body verification. Actual interplanetary missions require high-fidelity numerical ephemerides (JPL DE440 / Horizons).'}
          </span>
        </div>
      </div>

      {/* 3. Educational Flight Presets Gallery */}
      {onSelectEducationalPreset && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <BookOpen size={13} className="text-sky-400" />
            <span className="text-[11px] font-bold text-neutral-300 uppercase">
              HISTORICAL & EDUCATIONAL FLIGHT SCENARIOS:
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {educationalPresets.map((edu) => (
              <button
                key={edu.id}
                type="button"
                onClick={() => onSelectEducationalPreset(edu)}
                className="bg-[#121524] hover:bg-[#1a1f33] p-2.5 rounded-xs border border-[#242b3e] hover:border-amber-500/50 text-left transition-all flex flex-col gap-1 cursor-pointer group"
              >
                <span className="text-amber-300 font-bold text-xs group-hover:text-amber-200">
                  {edu.name}
                </span>
                <span className="text-[10px] text-neutral-400 line-clamp-2 leading-relaxed">
                  {edu.description}
                </span>
                <div className="flex items-center justify-between text-[9px] text-sky-400 mt-1 pt-1 border-t border-[#1c2234]">
                  <span>v_∞: {(edu.encounter.vInfSpeedMPerS / 1000).toFixed(1)} km/s</span>
                  <span className="font-bold text-neutral-300">{edu.encounter.passType}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
