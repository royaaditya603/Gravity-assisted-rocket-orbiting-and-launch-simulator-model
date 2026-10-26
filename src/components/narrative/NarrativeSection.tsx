import React from 'react';
import { Flame, Compass, Moon, Orbit, ArrowUpRight, ShieldCheck } from 'lucide-react';

export const NarrativeSection: React.FC = () => {
  const chapters = [
    {
      num: '01',
      tag: 'PROPULSION DYNAMICS',
      title: 'Launch and Variable-Mass Thrust',
      equation: 'm(t) · dv/dt = T(t) - D(v, h) + m(t)·g(r)',
      subEq: 'dm/dt = -T / (I_sp · g_0),  Δv_ideal = I_sp · g_0 · ln(m_0 / m_f)',
      body: 'Rocket propulsion is an open control-volume momentum exchange. Because the vehicle exhausts reaction mass continuously, its mass m(t) decreases by up to 90%, causing acceleration to steadily increase even under constant thrust. As altitude rises, atmospheric backpressure declines, linearly increasing specific impulse Isp from sea-level towards vacuum efficiency.',
    },
    {
      num: '02',
      tag: 'RESISTANCE & FORCES',
      title: 'Gravity Gradient and Aerodynamic Drag',
      equation: 'g(r) = -(μ / r³) · r,  D = ½ · ρ(h) · C_d · A · v_rel²',
      subEq: 'ρ(h) = ρ_0 · exp(-h / H_scale),  q = ½ · ρ · v²',
      body: 'Liftoff requires a thrust-to-weight ratio TWR > 1.0. As the rocket punches through the troposphere, dynamic pressure q surges to a critical peak called Max-Q before falling off exponentially due to atmospheric thinning. The rocket initiates a continuous gravity turn, arching its velocity vector towards the horizon to build the horizontal speed necessary for orbit.',
    },
    {
      num: '03',
      tag: 'CONSERVATION PHASE',
      title: 'Engine Cutoff and Hamiltonian Coasting',
      equation: 'ε = v²/2 - μ/r = const,  h = r × v = const',
      subEq: 'dε/dt = 0 (in vacuum),  dH(q, p)/dt = 0',
      body: 'Upon Main Engine Cutoff (MECO) and clearance of the sensible atmosphere (h >= 100 km), non-conservative drag and thrust vanish. The dynamics shift into conservative celestial mechanics. Specific mechanical energy ε and specific angular momentum vector h are rigorously conserved, locking the spacecraft into a fixed Keplerian orbital plane.',
    },
    {
      num: '04',
      tag: 'CELESTIAL MECHANICS',
      title: 'Orbital Insertion and Stability',
      equation: 'v_circ = √(μ / r),  v_esc = √(2μ / r) = √2 · v_circ',
      subEq: 'v² = μ · (2/r - 1/a),  r_p = a(1 - e) ≥ R_E + 100km',
      body: 'Getting to space is easy; staying in space requires extreme tangential speed. At 400 km altitude, circular orbit requires exactly 7,672.60 m/s. If horizontal velocity at cutoff is insufficient, perigee remains inside the solid Earth (r_p < R_E), resulting in a suborbital ballistic trajectory. Insertion occurs only when perigee is elevated safely above the atmosphere.',
    },
    {
      num: '05',
      tag: 'THREE-BODY DYNAMICS',
      title: 'Planetary Gravity Assist Maneuvers',
      equation: 'sin(δ/2) = 1 / (1 + r_p · v_inf² / μ_p)',
      subEq: 'Δv_assist = v_inf(+) - v_inf(-),  Δε_central = V_planet · Δv_assist',
      body: 'A gravity assist is not a closed orbit. In the flyby planet\'s moving frame, the encounter is a pure hyperbola where speed is strictly conserved (||v_inf(+)|| = ||v_inf(-)||). However, transforming back to the central sun/planet frame reveals that the planet\'s orbital velocity V_planet exchanges real mechanical energy with the spacecraft, pumping or braking its orbital path without burning fuel.',
    },
  ];

  return (
    <section id="narrative" className="w-full bg-[#F5F7FB] border-b border-[#DCE3EE] py-20 px-4 sm:px-8">
      <div className="max-w-7xl mx-auto flex flex-col gap-16">
        {/* Section Header */}
        <div className="flex flex-col gap-3 max-w-3xl">
          <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#68758A] font-bold">
            [ THE SCIENTIFIC NARRATIVE ]
          </span>
          <h2 className="text-4xl sm:text-6xl font-sans font-black tracking-[-0.03em] uppercase text-[#263247]">
            THE LAWS OF FLIGHT & ORBITAL MECHANICS
          </h2>
          <p className="text-base text-[#475569] leading-relaxed font-normal">
            Every trajectory in this simulator is computed from first principles. Here is the formal mathematics governing
            each phase from liftoff to interplanetary trajectory reshaping.
          </p>
        </div>

        {/* Chapters Stack */}
        <div className="flex flex-col divide-y divide-[#DCE3EE] border-t border-b border-[#DCE3EE]">
          {chapters.map((ch) => (
            <div key={ch.num} className="py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Number & Metadata */}
              <div className="lg:col-span-3 flex flex-col gap-1">
                <span className="text-5xl sm:text-6xl font-sans font-black tracking-tighter text-[#263247]">
                  {ch.num}
                </span>
                <span className="text-[10px] font-mono tracking-widest uppercase text-[#68758A] font-bold">
                  // {ch.tag}
                </span>
              </div>

              {/* Middle Column: Narrative Explanation */}
              <div className="lg:col-span-5 flex flex-col gap-3">
                <h3 className="text-2xl sm:text-3xl font-sans font-bold uppercase text-[#263247] tracking-tight">
                  {ch.title}
                </h3>
                <p className="text-sm text-[#475569] leading-relaxed">
                  {ch.body}
                </p>
              </div>

              {/* Right Column: Mathematical Formalism */}
              <div className="lg:col-span-4 bg-[#EEF2F8] border border-[#DCE3EE] rounded-xl p-4 flex flex-col gap-2 shadow-xs">
                <div className="text-[9px] font-mono tracking-widest uppercase text-[#68758A] font-bold">
                  GOVERNING MATHEMATICAL EQUATION
                </div>
                <div className="font-mono text-xs font-bold text-[#14426B] break-all bg-white p-2.5 border border-[#DCE3EE] rounded-lg shadow-xs">
                  {ch.equation}
                </div>
                <div className="font-mono text-[10px] text-[#475569] pt-1">
                  {ch.subEq}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
