import React, { useState, useMemo } from 'react';
import { G_NEWTON, AU, MU_SUN } from '../../../physics/constants';
import {
  ParameterAuthority,
  PlanetVelocityMode,
  syncMassAndMu,
  checkMassMuConsistency,
  computeCircularOrbitalSpeed,
} from '../../../physics/FlybyScenario';
import { ParameterTooltip, UnitBadge } from './ParameterTooltip';
import { Sliders, AlertTriangle } from 'lucide-react';

export interface CustomPlanetEditorProps {
  planet: {
    name: string;
    massKg: number;
    radiusM: number;
    mu: number;
    authority: ParameterAuthority;
    velocityMode: PlanetVelocityMode;
    semiMajorAxisM: number;
    orbitalSpeedMPerS: number;
    customVelocityVectorMPerS: { x: number; y: number; z: number };
    color?: string;
    sourceOrReference?: string;
    modelSimplificationNote?: string;
    muOverride?: number;
  };
  onChangePlanet: (updater: (prev: any) => any) => void;
}

export const CustomPlanetEditor: React.FC<CustomPlanetEditorProps> = ({
  planet,
  onChangePlanet,
}) => {
  const [showAdvancedOverrides, setShowAdvancedOverrides] = useState(false);
  const [rawMassInput, setRawMassInput] = useState<string>(() => planet.massKg.toExponential(4));

  // Keep local string input in sync if authoritative massKg changed from outside
  React.useEffect(() => {
    if (parseFloat(rawMassInput) !== planet.massKg) {
      setRawMassInput(planet.massKg.toExponential(4));
    }
  }, [planet.massKg]);

  // Derived Physical Characteristics
  const radiusKm = planet.radiusM / 1000.0;
  const volumeM3 = (4.0 / 3.0) * Math.PI * Math.pow(planet.radiusM, 3);
  const densityKgM3 = volumeM3 > 0 ? planet.massKg / volumeM3 : 0;
  const surfaceGravityMPerS2 =
    planet.radiusM > 0 ? planet.mu / (planet.radiusM * planet.radiusM) : 0;
  const surfaceGravityG = surfaceGravityMPerS2 / 9.80665;
  const escapeVelocityKmPerS =
    planet.radiusM > 0 ? Math.sqrt((2.0 * planet.mu) / planet.radiusM) / 1000.0 : 0;

  // Consistency check
  const consistency = useMemo(() => {
    return checkMassMuConsistency(planet.massKg, planet.mu);
  }, [planet.massKg, planet.mu]);

  // Validation errors
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!planet.name || planet.name.trim().length === 0) {
      errors.push('Planet name cannot be empty.');
    }
    if (isNaN(planet.massKg) || planet.massKg <= 0) {
      errors.push('Mass must be a positive finite number (e.g. 5.972e24 kg).');
    }
    if (isNaN(planet.radiusM) || planet.radiusM <= 0) {
      errors.push('Radius must be a positive finite number (e.g. 6,371 km).');
    }
    if (isNaN(planet.mu) || planet.mu <= 0) {
      errors.push('Gravitational parameter (μ) must be positive.');
    }
    return errors;
  }, [planet.name, planet.massKg, planet.radiusM, planet.mu]);

  return (
    <div className="bg-[#F8FAFD] border border-[#DCE3EE] p-4 rounded-xl flex flex-col gap-4 font-mono text-[#263247] shadow-2xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DCE3EE] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#C9BDF2] ring-2 ring-[#C9BDF2]/50" />
          <span className="text-xs font-bold text-[#4A347F] uppercase">
            CUSTOM PLANET CONFIGURATION & PHYSICAL ATTRIBUTES
          </span>
          <ParameterTooltip
            title="Custom Planet Model"
            description="Create a custom or exoplanetary body with customized mass, radius, and standard gravitational parameter. Physics calculations synchronize μ = G·M and derive surface gravity, escape velocity, and density."
            formula="μ = G · M,  g = μ / R²,  v_esc = √(2μ / R)"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAdvancedOverrides((prev) => !prev)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer shadow-2xs ${
              showAdvancedOverrides
                ? 'bg-[#C9BDF2]/40 text-[#4A347F] border-[#C9BDF2]'
                : 'bg-white text-[#68758A] hover:text-[#263247] border-[#DCE3EE]'
            }`}
          >
            {showAdvancedOverrides ? 'HIDE ADVANCED OVERRIDES' : 'ADVANCED μ OVERRIDE & ORBIT'}
          </button>
        </div>
      </div>

      {/* Primary 3 Parameters: Name, Mass, Radius */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
        {/* 1. Planet Name */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[#68758A] font-bold uppercase text-[10px]">
              PLANET NAME
            </label>
            <span className="text-[9px] text-[#94A3B8]">Display label</span>
          </div>
          <input
            type="text"
            value={planet.name}
            onChange={(e) => {
              const name = e.target.value;
              onChangePlanet((prev: any) => ({ ...prev, name, isTheoretical: true }));
            }}
            placeholder="e.g. Kepler-22b"
            className="bg-white border border-[#DCE3EE] px-2.5 py-1.5 rounded-lg text-[#263247] focus:outline-none focus:border-[#0284C7] shadow-2xs font-medium"
          />
        </div>

        {/* 2. Planet Mass */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <label className="text-[#68758A] font-bold uppercase text-[10px]">
                MASS (M)
              </label>
              <ParameterTooltip
                title="Mass vs μ Coupling"
                description="Mass M couples to μ through Newton's constant G. Changes automatically update standard gravitational parameter."
                unit="kg"
                formula="μ = G · M"
              />
            </div>
            <UnitBadge unit="kg" />
          </div>
          <input
            type="text"
            value={rawMassInput}
            onChange={(e) => {
              setRawMassInput(e.target.value);
              const val = parseFloat(e.target.value);
              if (!isNaN(val) && val > 0) {
                onChangePlanet((prev: any) => {
                  const synced = syncMassAndMu(val, 0, 'MASS_AUTHORITATIVE');
                  return {
                    ...prev,
                    massKg: val,
                    mu: synced.mu,
                    isTheoretical: true,
                  };
                });
              }
            }}
            placeholder="5.972e24"
            className="bg-white border border-[#DCE3EE] px-2.5 py-1.5 rounded-lg text-[#14426B] font-bold focus:outline-none focus:border-[#0284C7] shadow-2xs"
          />
          <div className="flex items-center justify-between text-[9px] text-[#68758A]">
            <span>Earth: 5.972e24 kg</span>
            <span>Jupiter: 1.898e27 kg</span>
          </div>
        </div>

        {/* 3. Physical Radius */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <label className="text-[#68758A] font-bold uppercase text-[10px]">
                PHYSICAL RADIUS (R_p)
              </label>
              <ParameterTooltip
                title="Physical Surface Radius"
                description="Spherical body physical radius. Defines the surface boundary for collision detection and surface gravity."
                unit="km"
              />
            </div>
            <UnitBadge unit="km" />
          </div>
          <input
            type="number"
            step="100"
            min="10"
            value={radiusKm.toFixed(0)}
            onChange={(e) => {
              const rKm = parseFloat(e.target.value);
              if (!isNaN(rKm) && rKm > 0) {
                onChangePlanet((prev: any) => ({
                  ...prev,
                  radiusM: rKm * 1000.0,
                  isTheoretical: true,
                }));
              }
            }}
            className="bg-white border border-[#DCE3EE] px-2.5 py-1.5 rounded-lg text-[#263247] focus:outline-none focus:border-[#0284C7] shadow-2xs font-medium"
          />
          <div className="flex items-center justify-between text-[9px] text-[#68758A]">
            <span>Mars: 3,389 km</span>
            <span>Earth: 6,371 km</span>
          </div>
        </div>
      </div>

      {/* Automatically Calculated Gravitational Parameter Display */}
      <div className="bg-white p-3.5 rounded-xl border border-[#DCE3EE] flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#68758A] font-bold uppercase">
              STANDARD GRAVITATIONAL PARAMETER (μ = G · M):
            </span>
            <UnitBadge unit="m³/s²" />
          </div>
          <div className="text-[#B45309] font-bold text-sm">
            {planet.mu.toExponential(5)} m³/s²
          </div>
          <span className="text-[9px] text-[#94A3B8]">
            Computed via Newton's G (6.67430 × 10⁻¹¹ m³/(kg·s²))
          </span>
        </div>

        {/* Physical Characteristics Pill Badges */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-[#F8FAFD] px-3 py-1.5 rounded-lg border border-[#DCE3EE] flex flex-col text-right">
            <span className="text-[9px] text-[#68758A]">SURFACE GRAVITY</span>
            <span className="text-[#7C3AED] font-bold text-[11px]">
              {surfaceGravityMPerS2.toFixed(2)} m/s² ({surfaceGravityG.toFixed(2)} g)
            </span>
          </div>
          <div className="bg-[#F8FAFD] px-3 py-1.5 rounded-lg border border-[#DCE3EE] flex flex-col text-right">
            <span className="text-[9px] text-[#68758A]">ESCAPE SPEED</span>
            <span className="text-[#0284C7] font-bold text-[11px]">
              {escapeVelocityKmPerS.toFixed(2)} km/s
            </span>
          </div>
          <div className="bg-[#F8FAFD] px-3 py-1.5 rounded-lg border border-[#DCE3EE] flex flex-col text-right">
            <span className="text-[9px] text-[#68758A]">MEAN DENSITY</span>
            <span className="text-[#059669] font-bold text-[11px]">
              {(densityKgM3 / 1000).toFixed(2)} g/cm³
            </span>
          </div>
        </div>
      </div>

      {/* Validation Errors & Inconsistency Warnings */}
      {validationErrors.length > 0 && (
        <div className="p-3 bg-[#FEE2E2] border border-[#FCA5A5] rounded-xl flex flex-col gap-1 text-xs text-[#991B1B]">
          <div className="flex items-center gap-1.5 font-bold text-[#991B1B]">
            <AlertTriangle size={14} className="text-[#DC2626]" />
            <span>INVALID CUSTOM PLANET CONFIGURATION:</span>
          </div>
          <ul className="list-disc list-inside text-[11px] text-[#991B1B]/90 pl-1">
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {!consistency.isConsistent && consistency.warning && (
        <div className="p-3 bg-[#FEF3C7] border border-[#FCD34D] rounded-xl flex items-center gap-2 text-[#92400E] text-xs">
          <AlertTriangle size={14} className="text-[#D97706] flex-shrink-0" />
          <span>{consistency.warning}</span>
        </div>
      )}

      {/* Advanced Overrides Disclosure Section */}
      {showAdvancedOverrides && (
        <div className="bg-white p-4 rounded-xl border border-[#DCE3EE] flex flex-col gap-3.5 text-xs shadow-2xs">
          <div className="flex items-center justify-between border-b border-[#DCE3EE] pb-1.5">
            <span className="text-[11px] font-bold text-[#4A347F] uppercase flex items-center gap-1.5">
              <Sliders size={13} /> ADVANCED GRAVITATIONAL PARAMETER & ORBITAL OVERRIDES
            </span>
            <span className="text-[9px] text-[#94A3B8]">For astrodynamic calibration & research</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Authority Mode Toggle */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#68758A] font-bold uppercase">
                AUTHORITATIVE VALUE
              </label>
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    onChangePlanet((prev: any) => ({
                      ...prev,
                      authority: 'MASS_AUTHORITATIVE',
                      mu: G_NEWTON * prev.massKg,
                    }));
                  }}
                  className={`py-1 px-1.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                    planet.authority === 'MASS_AUTHORITATIVE'
                      ? 'bg-[#FFD2B8] text-[#7A3E1D] border-[#FFD2B8]'
                      : 'bg-[#F8FAFD] text-[#68758A] border-[#DCE3EE]'
                  }`}
                >
                  MASS (M)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChangePlanet((prev: any) => ({
                      ...prev,
                      authority: 'MU_AUTHORITATIVE',
                      massKg: prev.mu / G_NEWTON,
                    }));
                  }}
                  className={`py-1 px-1.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                    planet.authority === 'MU_AUTHORITATIVE'
                      ? 'bg-[#A9D4F5] text-[#14426B] border-[#A9D4F5]'
                      : 'bg-[#F8FAFD] text-[#68758A] border-[#DCE3EE]'
                  }`}
                >
                  GRAV. PARAM (μ)
                </button>
              </div>
              <span className="text-[9px] text-[#94A3B8]">
                {planet.authority === 'MASS_AUTHORITATIVE'
                  ? 'μ derived automatically from M'
                  : 'M derived automatically from μ'}
              </span>
            </div>

            {/* Semi-major axis */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-[#68758A] font-bold uppercase">
                  SEMI-MAJOR AXIS (a)
                </label>
                <UnitBadge unit="AU" />
              </div>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={(planet.semiMajorAxisM / AU).toFixed(3)}
                onChange={(e) => {
                  const auVal = parseFloat(e.target.value);
                  if (!isNaN(auVal) && auVal > 0) {
                    const smaM = auVal * AU;
                    const vOrb = computeCircularOrbitalSpeed(smaM);
                    onChangePlanet((prev: any) => ({
                      ...prev,
                      semiMajorAxisM: smaM,
                      orbitalSpeedMPerS: vOrb,
                    }));
                  }
                }}
                className="bg-[#F8FAFD] border border-[#DCE3EE] px-2 py-1 rounded-lg text-[#263247]"
              />
            </div>

            {/* Circular orbital speed */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-[#68758A] font-bold uppercase">
                  ORBITAL SPEED (v_orb)
                </label>
                <UnitBadge unit="km/s" />
              </div>
              <input
                type="number"
                step="0.5"
                min="0.1"
                value={(planet.orbitalSpeedMPerS / 1000).toFixed(2)}
                onChange={(e) => {
                  const spdKm = parseFloat(e.target.value);
                  if (!isNaN(spdKm) && spdKm > 0) {
                    onChangePlanet((prev: any) => ({
                      ...prev,
                      orbitalSpeedMPerS: spdKm * 1000.0,
                    }));
                  }
                }}
                className="bg-[#F8FAFD] border border-[#DCE3EE] px-2 py-1 rounded-lg text-[#059669] font-bold"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
