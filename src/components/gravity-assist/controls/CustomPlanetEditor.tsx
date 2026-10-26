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
import { Sliders, AlertTriangle, ShieldCheck, HelpCircle, Compass, Zap, Info } from 'lucide-react';

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
    <div className="bg-[#0c0e17] border border-[#23293d] p-4 rounded-xs flex flex-col gap-4 font-mono text-white">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2234] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-purple-500 ring-2 ring-purple-400/40" />
          <span className="text-xs font-bold text-purple-300 uppercase">
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
            className={`px-2 py-0.5 rounded-xs text-[10px] font-bold border transition-colors cursor-pointer ${
              showAdvancedOverrides
                ? 'bg-purple-900/60 text-purple-200 border-purple-500'
                : 'bg-[#141724] text-neutral-400 hover:text-white border-[#272f44]'
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
            <label className="text-neutral-400 font-bold uppercase text-[10px]">
              PLANET NAME
            </label>
            <span className="text-[9px] text-neutral-500">Display label</span>
          </div>
          <input
            type="text"
            value={planet.name}
            onChange={(e) => {
              const name = e.target.value;
              onChangePlanet((prev: any) => ({
                ...prev,
                name,
                isTheoretical: true,
              }));
            }}
            placeholder="e.g., Kepler-186f, Super-Jupiter"
            className="bg-[#141826] border border-[#283148] px-2.5 py-1.5 rounded-xs text-white focus:outline-none focus:border-purple-400"
          />
          <span className="text-[9px] text-neutral-500">Theoretical / Exoplanet identifier</span>
        </div>

        {/* 2. Planet Mass */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <label className="text-neutral-400 font-bold uppercase text-[10px]">
                PLANET MASS (M)
              </label>
              <ParameterTooltip
                title="Planet Mass"
                description="Total physical mass of the planet in kilograms. In mass-authoritative mode, standard gravitational parameter μ is automatically computed as μ = G · M."
                unit="kg"
                formula="μ = 6.6743e-11 · M"
              />
            </div>
            <UnitBadge unit="kg" />
          </div>
          <input
            type="text"
            value={rawMassInput}
            onChange={(e) => {
              const strVal = e.target.value;
              setRawMassInput(strVal);
              const m = parseFloat(strVal);
              if (!isNaN(m) && m > 0) {
                onChangePlanet((prev: any) => {
                  const synced = syncMassAndMu(m, prev.mu, prev.authority || 'MASS_AUTHORITATIVE');
                  return {
                    ...prev,
                    massKg: synced.massKg,
                    mu: prev.authority === 'MU_AUTHORITATIVE' ? prev.mu : synced.mu,
                    isTheoretical: true,
                  };
                });
              }
            }}
            placeholder="e.g. 5.972e24 or 1.898e27"
            className="bg-[#141826] border border-[#283148] px-2.5 py-1.5 rounded-xs text-white focus:outline-none focus:border-purple-400"
          />
          <div className="flex items-center justify-between text-[9px] text-neutral-400">
            <span>Earth: 5.972e24 kg</span>
            <span>Jupiter: 1.898e27 kg</span>
          </div>
        </div>

        {/* 3. Mean Radius */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <label className="text-neutral-400 font-bold uppercase text-[10px]">
                MEAN RADIUS (R_p)
              </label>
              <ParameterTooltip
                title="Mean Reference Radius"
                description="Mean volumetric spherical radius of the planet in kilometres. Closest-approach periapsis altitude is measured relative to this surface (r_p = R_p + h_p). Sub-surface passes (h_p <= 0) cause collisions."
                unit="km"
              />
            </div>
            <UnitBadge unit="km" />
          </div>
          <input
            type="number"
            step="100"
            min="100"
            value={radiusKm}
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
            className="bg-[#141826] border border-[#283148] px-2.5 py-1.5 rounded-xs text-white focus:outline-none focus:border-purple-400"
          />
          <div className="flex items-center justify-between text-[9px] text-neutral-400">
            <span>Mars: 3,389 km</span>
            <span>Earth: 6,371 km</span>
          </div>
        </div>
      </div>

      {/* Automatically Calculated Gravitational Parameter Display */}
      <div className="bg-[#111420] p-3 rounded-xs border border-[#1e2436] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-neutral-400 font-bold uppercase">
              STANDARD GRAVITATIONAL PARAMETER (μ = G · M):
            </span>
            <UnitBadge unit="m³/s²" />
          </div>
          <div className="text-amber-400 font-bold text-sm">
            {planet.mu.toExponential(5)} m³/s²
          </div>
          <span className="text-[9px] text-neutral-500">
            Computed via Newton's G (6.67430 × 10⁻¹¹ m³/(kg·s²))
          </span>
        </div>

        {/* Physical Characteristics Pill Badges */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-[#161a29] px-2.5 py-1 rounded-xs border border-[#252c42] flex flex-col text-right">
            <span className="text-[9px] text-neutral-400">SURFACE GRAVITY</span>
            <span className="text-purple-300 font-bold text-[11px]">
              {surfaceGravityMPerS2.toFixed(2)} m/s² ({surfaceGravityG.toFixed(2)} g)
            </span>
          </div>
          <div className="bg-[#161a29] px-2.5 py-1 rounded-xs border border-[#252c42] flex flex-col text-right">
            <span className="text-[9px] text-neutral-400">ESCAPE SPEED</span>
            <span className="text-sky-300 font-bold text-[11px]">
              {escapeVelocityKmPerS.toFixed(2)} km/s
            </span>
          </div>
          <div className="bg-[#161a29] px-2.5 py-1 rounded-xs border border-[#252c42] flex flex-col text-right">
            <span className="text-[9px] text-neutral-400">MEAN DENSITY</span>
            <span className="text-emerald-300 font-bold text-[11px]">
              {(densityKgM3 / 1000).toFixed(2)} g/cm³
            </span>
          </div>
        </div>
      </div>

      {/* Validation Errors & Inconsistency Warnings */}
      {validationErrors.length > 0 && (
        <div className="p-2.5 bg-rose-950/60 border border-rose-600/70 rounded-xs flex flex-col gap-1 text-xs text-rose-200">
          <div className="flex items-center gap-1.5 font-bold text-rose-300">
            <AlertTriangle size={14} className="text-rose-400" />
            <span>INVALID CUSTOM PLANET CONFIGURATION:</span>
          </div>
          <ul className="list-disc list-inside text-[11px] text-rose-300/90 pl-1">
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {!consistency.isConsistent && consistency.warning && (
        <div className="p-2.5 bg-amber-950/60 border border-amber-600/60 rounded-xs flex items-center gap-2 text-amber-200 text-xs">
          <AlertTriangle size={14} className="text-amber-400 flex-shrink-0" />
          <span>{consistency.warning}</span>
        </div>
      )}

      {/* Advanced Overrides Disclosure Section */}
      {showAdvancedOverrides && (
        <div className="bg-[#080a10] p-3.5 rounded-xs border border-[#1d2334] flex flex-col gap-3.5 text-xs">
          <div className="flex items-center justify-between border-b border-[#181d2c] pb-1.5">
            <span className="text-[11px] font-bold text-purple-300 uppercase flex items-center gap-1.5">
              <Sliders size={13} /> ADVANCED GRAVITATIONAL PARAMETER & ORBITAL OVERRIDES
            </span>
            <span className="text-[9px] text-neutral-500">For astrodynamic calibration & research</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Authority Mode Toggle */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-neutral-400 font-bold uppercase">
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
                  className={`py-1 px-1.5 rounded-xs text-[10px] font-bold border transition-colors cursor-pointer ${
                    planet.authority === 'MASS_AUTHORITATIVE'
                      ? 'bg-amber-500 text-black border-amber-400'
                      : 'bg-[#141724] text-neutral-400 border-[#242c40]'
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
                  className={`py-1 px-1.5 rounded-xs text-[10px] font-bold border transition-colors cursor-pointer ${
                    planet.authority === 'MU_AUTHORITATIVE'
                      ? 'bg-sky-500 text-black border-sky-400'
                      : 'bg-[#141724] text-neutral-400 border-[#242c40]'
                  }`}
                >
                  GRAV. PARAM (μ)
                </button>
              </div>
              <span className="text-[9px] text-neutral-500">
                {planet.authority === 'MASS_AUTHORITATIVE'
                  ? 'μ derived automatically from M'
                  : 'M derived automatically from μ'}
              </span>
            </div>

            {/* Direct mu Override */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">
                  MANUAL μ OVERRIDE (m³/s²)
                </label>
                <UnitBadge unit="m³/s²" />
              </div>
              <input
                type="text"
                placeholder="Leave blank for nominal GM"
                value={planet.muOverride !== undefined ? planet.muOverride.toExponential(4) : ''}
                onChange={(e) => {
                  const val = e.target.value.trim() ? parseFloat(e.target.value) : undefined;
                  onChangePlanet((prev: any) => ({
                    ...prev,
                    muOverride: val && !isNaN(val) && val > 0 ? val : undefined,
                  }));
                }}
                className="bg-[#141826] border border-[#283148] px-2 py-1 rounded-xs text-white"
              />
              <span className="text-[9px] text-neutral-500">Overrides nominal gravitational parameter</span>
            </div>

            {/* Heliocentric Orbital Radius (AU) */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-neutral-400 font-bold uppercase">
                  ORBITAL DISTANCE (SEMI-MAJOR AXIS)
                </label>
                <UnitBadge unit="AU" />
              </div>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="100"
                value={(planet.semiMajorAxisM / AU).toFixed(3)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val > 0) {
                    const aM = val * AU;
                    const spd = computeCircularOrbitalSpeed(aM);
                    onChangePlanet((prev: any) => ({
                      ...prev,
                      semiMajorAxisM: aM,
                      orbitalSpeedMPerS: spd,
                      customVelocityVectorMPerS: { x: 0, y: spd, z: 0 },
                    }));
                  }
                }}
                className="bg-[#141826] border border-[#283148] px-2 py-1 rounded-xs text-white"
              />
              <span className="text-[9px] text-emerald-400">
                Circular speed: {(planet.orbitalSpeedMPerS / 1000).toFixed(2)} km/s
              </span>
            </div>
          </div>

          {/* Model Assumptions / Custom Notes */}
          <div className="flex flex-col gap-1 border-t border-[#181d2c] pt-2">
            <label className="text-[10px] text-neutral-400 font-bold uppercase">
              MODEL ASSUMPTIONS & SOURCE ANNOTATION
            </label>
            <input
              type="text"
              value={planet.sourceOrReference || ''}
              onChange={(e) => {
                const text = e.target.value;
                onChangePlanet((prev: any) => ({
                  ...prev,
                  sourceOrReference: text,
                }));
              }}
              placeholder="e.g., Theoretical ocean-world model, unperturbed circular heliocentric orbit."
              className="bg-[#141826] border border-[#283148] px-2.5 py-1 text-[11px] rounded-xs text-white"
            />
          </div>
        </div>
      )}
    </div>
  );
};
