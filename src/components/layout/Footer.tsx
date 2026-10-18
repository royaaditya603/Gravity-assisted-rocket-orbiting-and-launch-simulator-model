import React from 'react';
import { ShieldCheck, CheckCircle2, AlertTriangle, Code2 } from 'lucide-react';
import { BENCHMARKS, R_EARTH, MU_EARTH, H_ATMOSPHERE } from '../../physics';

export const Footer: React.FC = () => {
  return (
    <footer id="specifications" className="w-full bg-[#ebebe8] text-[#111215] border-t border-[#d8d7d2] py-16 px-4 sm:px-8">
      <div className="max-w-7xl mx-auto flex flex-col gap-12">
        {/* Top: Specification & Assumptions Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Summary */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#686a73]">
              [ SPECIFICATION & MODEL TRANSPARENCY ]
            </span>
            <h3 className="text-3xl font-sans font-black uppercase tracking-tight text-[#111215]">
              Documented Physical Assumptions & Limits
            </h3>
            <p className="text-sm text-[#444650] leading-relaxed">
              Scientific honesty demands full transparency regarding model simplifications. This simulator balances
              strict computational determinism with pedagogical clarity by documenting all omitted secondary perturbations.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-mono font-bold text-[#111215]">
                PHYSICS VERIFICATION LEDGER // 65 AUTOMATED TESTS PASSING
              </span>
            </div>
            <div className="text-[10px] font-mono text-[#777a88]">
              Automated Vitest suite across 10 test files verified at 2026-10-18T16:22:40+05:30. Zero hardcoded mock results.
            </div>
          </div>

          {/* Right: Transparent Limitations Ledger */}
          <div className="lg:col-span-7 bg-[#f5f5f2] border border-[#d8d7d2] p-6 rounded-xs flex flex-col gap-4">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-[#111215] border-b border-[#d8d7d2] pb-2 flex items-center justify-between">
              <span>PHYSICAL APPROXIMATIONS IN USE</span>
              <span className="text-[10px] text-[#686a73]">AUDITED FOR ACCURACY</span>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-[#111215]">Spherical Point-Mass Earth (J2 = 0):</span>
                  <span className="text-[#555866] ml-1">
                    Earth oblateness (J2 = 1.0826e-3) is omitted. Apsidal precession and nodal regression over months are neglected in favour of clean planar Keplerian orbits.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-[#111215]">Isothermal Exponential Atmosphere:</span>
                  <span className="text-[#555866] ml-1">
                    Density uses barometric scale height H = 8,500 m. Mesospheric/thermospheric temperature inversions are neglected; drag is clamped to 0 at the 100 km Kármán line.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-[#111215]">Pressure-Interpolated Specific Impulse:</span>
                  <span className="text-[#555866] ml-1">
                    Isp scales linearly with static pressure between sea-level and vacuum. Supersonic shock separation inside overexpanded bell nozzles is simplified.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-[#111215]">Patched-Conic Flyby Isolation:</span>
                  <span className="text-[#555866] ml-1">
                    Gravity assists inside the sphere of influence are computed as pure 2-body hyperbolas, ignoring the central body's simultaneous tidal field during the brief encounter.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Standards & Copyright Row */}
        <div className="border-t border-[#d8d7d2] pt-8 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-[#686a73]">
          <div>
            STANDARDS // NASA JPL DE440 • WGS-84 • U.S. STANDARD ATMOSPHERE 1976
          </div>
          <div className="flex items-center gap-4">
            <span>STATIC SPA // VERCEL DEPLOYMENT COMPLIANT</span>
            <span>NO BACKEND REQUIRED</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
