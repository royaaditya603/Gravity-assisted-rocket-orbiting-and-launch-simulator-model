import React from 'react';
import { AU } from '../../../physics/constants';
import {
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
import { Globe, Info, BookOpen } from 'lucide-react';

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
    <div className="flex flex-col gap-4 font-mono text-[#263247]">
      {/* 1. Primary Planet Preset Buttons */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Globe size={14} className="text-[#0284C7]" />
            <span className="text-[11px] font-bold text-[#263247] uppercase">
              PLANETARY BODY PRESET SELECTION:
            </span>
            <ParameterTooltip
              title="Planetary Body Presets"
              description="Documented canonical solar system bodies and theoretical custom planet. Masses, radii, and standard gravitational parameters (μ = GM) are sourced from NASA Goddard Fact Sheets and IAU WGCCRE 2015."
              source="NASA / IAU 2015 / JPL DE440"
            />
          </div>
          <span className="text-[10px] text-[#68758A]">
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
                className={`py-2 px-3 text-xs font-bold rounded-xl transition-all border cursor-pointer text-left flex flex-col gap-0.5 ${
                  isSelected
                    ? 'bg-[#A9D4F5] text-[#14426B] border-[#A9D4F5] shadow-xs ring-2 ring-[#A9D4F5]/50'
                    : 'bg-[#F8FAFD] text-[#263247] hover:bg-[#EEF2F8] border-[#DCE3EE]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="uppercase">{p.label}</span>
                  {isSelected && <span className="text-[9px] px-1.5 py-0.2 bg-[#14426B]/15 text-[#14426B] rounded-md font-bold">ACTIVE</span>}
                </div>
                <span className={`text-[9px] font-normal ${isSelected ? 'text-[#14426B]/80' : 'text-[#68758A]'}`}>
                  {p.subtitle}
                </span>
              </button>
            );
          })}
        </div>

        {/* Other Solar System Bodies dropdown/row */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
          <span className="text-[#68758A] text-[10px] font-medium">ADDITIONAL SOLAR SYSTEM BODIES:</span>
          {SECONDARY_PRESETS.map((p) => {
            const isSelected = selectedPresetId === p.key && !isCustomPlanet;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => onSelectPreset(p.key)}
                className={`px-2.5 py-1 rounded-lg border text-[10px] cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-[#A9D4F5] text-[#14426B] font-bold border-[#A9D4F5] shadow-2xs'
                    : 'bg-[#EEF2F8] text-[#68758A] hover:text-[#263247] border-[#DCE3EE]'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Physical Constants Dossier Card */}
      <div className="bg-[#F8FAFD] p-4 rounded-xl border border-[#DCE3EE] flex flex-col gap-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DCE3EE] pb-2">
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full border border-[#DCE3EE]"
              style={{ backgroundColor: planetData.color || '#4f9fff' }}
            />
            <span className="text-xs font-bold text-[#14426B] uppercase">
              {planetData.name} — Physical Constants & Orbital Parameters
            </span>
          </div>
          <span className="text-[10px] text-[#68758A]">
            {planetData.sourceOrReference || 'NASA Planetary Fact Sheet / JPL DE440'}
          </span>
        </div>

        {/* Constants Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
          <div className="bg-white p-2.5 rounded-lg border border-[#DCE3EE] flex flex-col gap-0.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[#68758A] text-[10px]">MASS (M)</span>
              <UnitBadge unit="kg" />
            </div>
            <div className="text-[#263247] font-bold text-[11px] truncate" title={`${planetData.massKg} kg`}>
              {planetData.massKg.toExponential(4)}
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-lg border border-[#DCE3EE] flex flex-col gap-0.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[#68758A] text-[10px]">MEAN RADIUS (R_p)</span>
              <UnitBadge unit="km" />
            </div>
            <div className="text-[#263247] font-bold text-[11px]">
              {(planetData.radiusM / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-lg border border-[#DCE3EE] flex flex-col gap-0.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[#68758A] text-[10px]">GRAV. PARAMETER (μ)</span>
              <UnitBadge unit="m³/s²" />
            </div>
            <div className="text-[#B45309] font-bold text-[11px] truncate" title={`${planetData.mu} m³/s²`}>
              {planetData.mu.toExponential(4)}
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-lg border border-[#DCE3EE] flex flex-col gap-0.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[#68758A] text-[10px]">SEMI-MAJOR AXIS (a)</span>
              <UnitBadge unit="AU" />
            </div>
            <div className="text-[#0284C7] font-bold text-[11px]">
              {(planetData.semiMajorAxisM / AU).toFixed(3)}
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-lg border border-[#DCE3EE] flex flex-col gap-0.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[#68758A] text-[10px]">ORBITAL SPEED (v_orb)</span>
              <UnitBadge unit="km/s" />
            </div>
            <div className="text-[#059669] font-bold text-[11px]">
              {(planetData.orbitalSpeedMPerS / 1000).toFixed(2)}
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-lg border border-[#DCE3EE] flex flex-col gap-0.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[#68758A] text-[10px]">SURFACE GRAVITY (g)</span>
              <UnitBadge unit="m/s²" />
            </div>
            <div className="text-[#7C3AED] font-bold text-[11px]">
              {surfaceGravity}
            </div>
          </div>
        </div>

        {/* Ring Parameters (if applicable) */}
        {planetData.ringInnerRadiusM && planetData.ringOuterRadiusM && (
          <div className="bg-[#FFFBEB] px-3 py-2 rounded-lg border border-[#FDE68A] flex items-center justify-between text-[10px] text-[#92400E]">
            <span>
              <strong>PLANETARY RING SYSTEM:</strong> Inner boundary:{' '}
              {(planetData.ringInnerRadiusM / 1000).toLocaleString()} km • Outer boundary:{' '}
              {(planetData.ringOuterRadiusM / 1000).toLocaleString()} km
            </span>
          </div>
        )}

        {/* Model Simplification Disclaimer */}
        <div className="flex items-start gap-2 bg-white p-3 rounded-lg border border-[#DCE3EE] text-[10px] text-[#68758A] leading-relaxed">
          <Info size={14} className="text-[#0284C7] flex-shrink-0 mt-0.5" />
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
            <BookOpen size={13} className="text-[#0284C7]" />
            <span className="text-[11px] font-bold text-[#263247] uppercase">
              HISTORICAL & EDUCATIONAL FLIGHT SCENARIOS:
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {educationalPresets.map((edu) => (
              <button
                key={edu.id}
                type="button"
                onClick={() => onSelectEducationalPreset(edu)}
                className="bg-white hover:bg-[#F8FAFD] p-3 rounded-xl border border-[#DCE3EE] hover:border-[#A9D4F5] text-left transition-all flex flex-col gap-1 cursor-pointer group shadow-2xs"
              >
                <span className="text-[#14426B] font-bold text-xs group-hover:text-[#0284C7]">
                  {edu.name}
                </span>
                <span className="text-[10px] text-[#68758A] line-clamp-2 leading-relaxed">
                  {edu.description}
                </span>
                <div className="flex items-center justify-between text-[9px] text-[#0284C7] mt-1 pt-1 border-t border-[#DCE3EE]">
                  <span>v_∞: {(edu.encounter.vInfSpeedMPerS / 1000).toFixed(1)} km/s</span>
                  <span className="font-bold text-[#263247]">{edu.encounter.passType}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
