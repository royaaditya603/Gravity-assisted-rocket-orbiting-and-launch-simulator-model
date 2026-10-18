import React from 'react';
import { FlybyInitialConditions } from '../../../physics/FlybyEngine';
import { PLANETARY_BODIES } from '../../../physics/constants';
import { Compass, ExternalLink, Play, Sparkles, BookOpen } from 'lucide-react';

interface FlybyMissionsProps {
  onLoadPreset: (config: Partial<FlybyInitialConditions>) => void;
}

export const FlybyMissions: React.FC<FlybyMissionsProps> = ({ onLoadPreset }) => {
  const missions = [
    {
      id: 'VOYAGER_2_JUPITER',
      name: 'Voyager 2 — Jupiter Grand Tour Accelerator',
      encounterDate: 'July 9, 1979',
      targetPlanet: PLANETARY_BODIES.JUPITER,
      vInfMPerS: 10500.0,
      altitudeKm: 570000.0, // Closest approach ~640,000 km from center
      passType: 'TRAILING' as const,
      description:
        'Exploiting a once-every-175-year planetary alignment, Voyager 2 flew past Jupiter on a trailing trajectory, gaining ~16 km/s in heliocentric velocity to fling it toward Saturn, Uranus, and Neptune.',
      significance: 'Shortened transit time to Neptune from ~30 years to under 12 years.',
      citation: 'NASA JPL Voyager Mission Status & Ephemeris Archives',
      citationUrl: 'https://voyager.jpl.nasa.gov/mission/',
    },
    {
      id: 'CASSINI_VENUS',
      name: 'Cassini — Venus Resonant Gravity Assist',
      encounterDate: 'April 26, 1998',
      targetPlanet: PLANETARY_BODIES.VENUS,
      vInfMPerS: 6500.0,
      altitudeKm: 284.0, // Extremely close periapsis: 284 km above Venus clouds
      passType: 'TRAILING' as const,
      description:
        'Part of the famous VVEJGA (Venus-Venus-Earth-Jupiter Gravity Assist) sequence. Cassini skimmed Venus at just 284 km altitude to pump orbital energy for its eventual 5.6-tonne voyage to Saturn.',
      significance: 'Allowed launching the heaviest interplanetary flagship probe using a Titan IVB rocket.',
      citation: 'NASA JPL Cassini-Huygens Mission Trajectory Overview',
      citationUrl: 'https://science.nasa.gov/mission/cassini/',
    },
    {
      id: 'MARINER_10_VENUS',
      name: 'Mariner 10 — First Interplanetary Gravity Brake',
      encounterDate: 'February 5, 1974',
      targetPlanet: PLANETARY_BODIES.VENUS,
      vInfMPerS: 8200.0,
      altitudeKm: 5768.0,
      passType: 'LEADING' as const, // Leading pass to brake toward Sun
      description:
        'The historic first spacecraft to use planetary gravity assist in space exploration. Mariner 10 executed a LEADING pass in front of Venus to brake its Sun-relative velocity and drop into an orbit resonant with Mercury.',
      significance: 'First demonstration of gravity-assist steering; visited Mercury 3 distinct times.',
      citation: 'NASA SP-424: The Voyage of Mariner 10',
      citationUrl: 'https://history.nasa.gov/SP-424/sp424.htm',
    },
  ];

  return (
    <div className="w-full bg-[#10121a] border border-[#222638] p-5 rounded-xs flex flex-col gap-5 text-white">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#222638] pb-3">
        <div className="flex items-center gap-2">
          <BookOpen size={18} className="text-sky-400" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-neutral-200">
            HISTORICAL MISSION DOSSIER & MULTI-PLANET PRESETS
          </span>
        </div>
        <span className="text-[10px] font-mono text-neutral-400">
          GROUND TRUTH ARCHIVAL ENCOUNTERS (EDUCATIONAL APPROXIMATIONS)
        </span>
      </div>

      {/* Mission Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {missions.map((m) => (
          <div
            key={m.id}
            className="bg-[#141622] border border-[#23283c] p-4 rounded-xs flex flex-col justify-between gap-4"
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 border-b border-[#23283c] pb-2">
                <span className="text-[10px] font-mono text-amber-400 font-bold tracking-wider">
                  {m.encounterDate}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded-xs text-[9px] font-mono font-bold ${
                    m.passType === 'TRAILING'
                      ? 'bg-amber-950 text-amber-300 border border-amber-700'
                      : 'bg-rose-950 text-rose-300 border border-rose-700'
                  }`}
                >
                  {m.passType}
                </span>
              </div>

              <h4 className="font-mono text-xs font-bold text-white uppercase leading-snug">
                {m.name}
              </h4>

              <p className="text-xs text-neutral-300 leading-relaxed font-sans">
                {m.description}
              </p>

              <div className="bg-[#0b0c12] p-2.5 rounded-xs border border-[#1b1e2c] flex flex-col gap-1 text-[11px] font-mono text-neutral-400">
                <div>
                  TARGET: <strong className="text-white">{m.targetPlanet.name}</strong>
                </div>
                <div>
                  v_∞: <strong className="text-amber-400">{(m.vInfMPerS / 1000).toFixed(1)} km/s</strong>
                </div>
                <div>
                  PERIAPSIS ALT: <strong className="text-sky-400">{m.altitudeKm.toLocaleString()} km</strong>
                </div>
                <div className="text-[10px] text-emerald-400 pt-1 border-t border-[#1b1e2c]">
                  {m.significance}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#23283c]">
              <a
                href={m.citationUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] font-mono text-neutral-400 hover:text-white flex items-center gap-1 transition-colors"
              >
                <span>NASA CITATION</span>
                <ExternalLink size={10} />
              </a>

              <button
                onClick={() =>
                  onLoadPreset({
                    planet: m.targetPlanet,
                    vInfSpeedMPerS: m.vInfMPerS,
                    targetPeriapsisM: m.targetPlanet.radiusM + m.altitudeKm * 1000.0,
                    passType: m.passType,
                  })
                }
                className="px-2.5 py-1 bg-sky-500 hover:bg-sky-400 text-black text-[10px] font-mono font-bold rounded-xs flex items-center gap-1 transition-colors"
              >
                <Play size={10} /> SIMULATE PRESET
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Methodological Clarification Banner */}
      <div className="p-3 bg-[#0c0d14] rounded-xs border border-[#1c2030] text-[11px] font-mono text-neutral-400 leading-relaxed">
        <strong>EDUCATIONAL SCOPE NOTICE:</strong> These historical configurations model the local patched-conic hyperbolic flyby
        inside each planet's sphere of influence using exact 2-body Newton-Kepler mechanics. Continuous multi-year interplanetary
        ephemerides (e.g. SPICE kernels, full N-body relativistic perturbation solvers) are decoupled to isolate and verify
        the fundamental physics of momentum exchange.
      </div>
    </div>
  );
};
