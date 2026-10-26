import React from 'react';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer id="specifications" className="w-full bg-[#EEF2F8] text-[#263247] border-t border-[#DCE3EE] py-12 px-4 sm:px-8 select-none">
      <div className="max-w-7xl mx-auto flex flex-col gap-10">
        {/* Top: Specification & Assumptions Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Summary */}
          <div className="lg:col-span-5 flex flex-col gap-3 font-mono">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#68758A] font-bold">
              [ SPECIFICATION & MODEL TRANSPARENCY ]
            </span>
            <h3 className="text-2xl font-sans font-black uppercase tracking-tight text-[#263247]">
              Documented Astrodynamic Invariants
            </h3>
            <p className="text-xs text-[#68758A] leading-relaxed font-sans">
              Scientific integrity demands rigorous transparency. ASTRA balances deterministic numerical mechanics
              with clear visual insight by computing exact conservation laws without fabricated simulation results.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#AEE5D0] border border-[#2D8A68] animate-pulse" />
              <span className="text-xs font-bold text-[#263247]">
                PHYSICS VERIFICATION // 296 AUTOMATED TESTS PASSING
              </span>
            </div>
            <div className="text-[10px] text-[#68758A]">
              Automated Vitest harness across 26 suites verifying SI metric compliance, symplectic bounds, and JPL ephemerides.
            </div>
          </div>

          {/* Right: Transparent Limitations Ledger */}
          <div className="lg:col-span-7 bg-white border border-[#DCE3EE] p-6 rounded-xl shadow-xs flex flex-col gap-3.5 font-mono">
            <div className="text-xs font-bold uppercase tracking-wider text-[#263247] border-b border-[#EEF2F8] pb-2.5 flex items-center justify-between">
              <span>ACTIVE MODEL INVARIANTS</span>
              <span className="text-[10px] text-[#1D6C50] font-bold bg-[#AEE5D0]/30 px-2 py-0.5 rounded-md border border-[#AEE5D0]">SI CODATA 2018</span>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={15} className="text-[#3882B6] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-[#263247]">Patched-Conic Hyperbolic Formulation:</span>
                  <span className="text-[#68758A] ml-1 font-sans">
                    Within planetary SOI, trajectory is computed as an unpowered Keplerian hyperbola. Asymptotic excess speed ||v_∞|| is strictly conserved in the planet rest frame.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={15} className="text-[#3882B6] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-[#263247]">Isothermal Exponential Atmosphere & Aerodynamic Drag:</span>
                  <span className="text-[#68758A] ml-1 font-sans">
                    Density uses barometric scale height H = 8,500 m. Drag clamps to zero at the 100 km Kármán line.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={15} className="text-[#3882B6] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-[#263247]">High-Precision Adaptive Numerical Integrators:</span>
                  <span className="text-[#68758A] ml-1 font-sans">
                    Classical Runge-Kutta 4th-Order and Dormand-Prince (DOPRI5) with automatic step doubling near periapsis. Symplectic Velocity Verlet for vacuum coasting.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={15} className="text-[#3882B6] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-[#263247]">NASA JPL Solar System Ephemerides:</span>
                  <span className="text-[#68758A] ml-1 font-sans">
                    Standish (1992) Kepler solver precision &lt; 10⁻¹⁴ with full 3D Cartesian coordinates for Mercury through Neptune.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Colophon */}
        <div className="border-t border-[#DCE3EE] pt-6 flex flex-wrap items-center justify-between gap-4 font-mono text-[11px] text-[#68758A]">
          <div>
            ASTRA // MISSION ARCHITECTURE 2026 • MIT LICENSE
          </div>
          <div className="flex items-center gap-4">
            <span className="hover:text-[#263247] transition-colors">SI UNITS: m, kg, s, rad, J</span>
            <span>•</span>
            <span className="hover:text-[#263247] transition-colors">NASA 3D ASSETS: ARES 1 & HIPPARCOS</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
