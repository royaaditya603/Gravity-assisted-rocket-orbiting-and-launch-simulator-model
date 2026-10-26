import React, { useState } from 'react';
import { X, Flame, Shield, Orbit, Compass, ChevronRight, BookOpen, Atom } from 'lucide-react';

interface PrinciplesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrinciplesDrawer: React.FC<PrinciplesDrawerProps> = ({ isOpen, onClose }) => {
  const [activeChapter, setActiveChapter] = useState<number>(0);

  if (!isOpen) return null;

  const chapters = [
    {
      id: '01',
      title: 'Propulsion Dynamics & Variable-Mass Thrust',
      tag: 'TSIOLKOVSKY PROPULSION',
      icon: <Flame size={16} className="text-amber-400" />,
      equation: 'm(t) · (dv/dt) = T(t) - D(v, h) + m(t) · g(r)',
      subEq: 'dm/dt = -T / (I_sp · g_0)  |  Δv_ideal = I_sp · g_0 · ln(m_0 / m_f)',
      content: `Rocket propulsion is fundamentally an open control-volume momentum exchange. Because the vehicle exhausts reaction mass continuously at exhaust velocity c = I_sp · g_0, its instantaneous mass m(t) declines drastically during ascent (often by 85–92%). Under constant thrust, vehicle acceleration a(t) = T / m(t) rises continuously toward engine burnout. Furthermore, as the vehicle ascends into vacuum, backpressure decreases, causing specific impulse I_sp to transition from sea-level efficiency (~282 s) toward vacuum peak (~311 s).`,
      invariants: [
        'Propellant mass strictly decreases monotonically: dm/dt <= 0',
        'Payload ratio constraint: m_f = m_dry + m_payload',
        'Effective exhaust velocity: c_e = g_0 · I_sp',
      ],
    },
    {
      id: '02',
      title: 'Gravity Gradient & Atmospheric Drag',
      tag: 'BAROMETRIC DECELERATION',
      icon: <Shield size={16} className="text-sky-400" />,
      equation: 'D = ½ · ρ(h) · C_d · A · v_rel²  |  g(r) = -(μ / r³) · r',
      subEq: 'ρ(h) = ρ_0 · exp(-h / H_scale)  |  q = ½ · ρ · v²',
      content: `Liftoff demands a thrust-to-weight ratio TWR > 1.0 (typically 1.25–1.50) to overcome terrestrial gravity. As the rocket accelerates through the denser troposphere, dynamic pressure q = ½ ρ v² rapidly climbs to a severe mechanical peak termed Max-Q (~12–14 km altitude) before exponential barometric thinning overtakes velocity growth. At ~1.5 km, the rocket initiates an optimal gravity turn, tipping its thrust vector slightly downrange to allow terrestrial gravity to naturally curve the trajectory toward the horizontal horizon.`,
      invariants: [
        'Scale height for Earth barometric model: H_scale = 8,500 m',
        'Sensible atmospheric boundary: h_boundary = 100,000 m (Kármán line)',
        'Drag vector strictly opposes vehicle velocity relative to the atmosphere',
      ],
    },
    {
      id: '03',
      title: 'Hamiltonian Coasting & Energy Conservation',
      tag: 'CONSERVATIVE MECHANICS',
      icon: <Atom size={16} className="text-purple-400" />,
      equation: 'ε = v²/2 - μ/r = const  |  h = r × v = const',
      subEq: 'dε/dt = 0 (in vacuum coast)  |  dH(q, p)/dt = 0',
      content: `Following Main Engine Cutoff (MECO) and atmospheric clearance (h >= 100 km), non-conservative aerodynamic drag and chemical thrust vanish. Spacecraft motion transitions into pure Hamiltonian conservative mechanics. The specific mechanical energy ε (Joules per kilogram) and the specific angular momentum vector h (m²/s) remain invariant. In the absence of third-body perturbations, the orbit is permanently confined to a static Keplerian orbital plane with fixed semi-major axis a = -μ / (2ε).`,
      invariants: [
        'Symplectic phase-space area preservation: d(p ∧ q) = 0',
        'Energy drift bounded to < 10⁻⁶ over 100 orbits under Velocity Verlet integration',
        'Angular momentum vector h remains perpendicular to the orbital plane',
      ],
    },
    {
      id: '04',
      title: 'Orbital Insertion & Velocity Thresholds',
      tag: 'KEPLERIAN INSERTION',
      icon: <Orbit size={16} className="text-emerald-400" />,
      equation: 'v_circ = √(μ / r)  |  v_esc = √(2μ / r) = √2 · v_circ',
      subEq: 'v² = μ · (2/r - 1/a)  |  r_p = a(1 - e) >= R_E + 100 km',
      content: `Reaching space altitude is trivial; maintaining orbit requires massive tangential horizontal speed. At 400 km Low Earth Orbit (LEO), circular speed is exactly 7,672.6 m/s (27,621 km/h). If horizontal velocity at cutoff is deficient, the orbital perigee lies deep beneath Earth's surface (r_p < R_E), resulting in a suborbital ballistic trajectory that re-enters the atmosphere. Stable orbital insertion is achieved only when perigee r_p is raised safely above the sensible atmosphere.`,
      invariants: [
        'Elliptic bound state: -μ / (2 R_E) < ε < 0 (0 <= e < 1)',
        'Parabolic escape boundary: ε = 0 (e = 1, v = v_esc)',
        'Hyperbolic unbound state: ε > 0 (e > 1, v > v_esc)',
      ],
    },
    {
      id: '05',
      title: 'Planetary Gravity Assist Maneuvers',
      tag: 'PATCHED CONICS & KINEMATICS',
      icon: <Compass size={16} className="text-cyan-400" />,
      equation: 'sin(δ / 2) = 1 / (1 + r_p · v_∞² / μ_p)  |  Δv = 2 v_∞ / e',
      subEq: 'v_sun,out = V_planet + v_∞,+  |  Δε_sun = V_planet · Δv',
      content: `In the moving rest frame of the encounter planet, a gravity assist is a conservative, unpowered hyperbolic flyby where asymptotic incoming and outgoing speeds are identical: ||v_∞,-|| = ||v_∞,+||. No energy is added in the planet frame. However, transforming into the central Sun-centered (heliocentric) frame reveals that the planet's orbital velocity V_planet exchanges real mechanical momentum with the probe. Crossing behind the planet (trailing pass) boosts heliocentric speed (+ΔV), whereas passing ahead of the planet (leading pass) brakes the spacecraft (-ΔV).`,
      invariants: [
        'Speed conservation in planet frame: ||v_∞,+|| = ||v_∞,-||',
        'Deflection angle strictly bounded: 0 < δ < 180°',
        'Heliocentric energy theorem: Δε_sun = V_p · (v_∞,+ - v_∞,-)',
      ],
    },
  ];

  const current = chapters[activeChapter];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-2xl h-full bg-[#080b13] border-l border-[#1a233a] shadow-2xl flex flex-col font-mono text-neutral-200 select-none">
        {/* Header */}
        <div className="p-4 border-b border-[#1a233a] flex items-center justify-between bg-[#0b0f1a]">
          <div className="flex items-center gap-2.5">
            <BookOpen size={18} className="text-cyan-400" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-white">ASTRODYNAMICS PRINCIPLES DOSSIER</div>
              <div className="text-[10px] text-neutral-400">FIRST-PRINCIPLES MATHEMATICAL DERIVATIONS & GOVERNING EQUATIONS</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xs hover:bg-[#1a243b] text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Chapter Tabs */}
        <div className="flex border-b border-[#1a233a] bg-[#070912] overflow-x-auto text-[11px]">
          {chapters.map((ch, idx) => (
            <button
              key={ch.id}
              onClick={() => setActiveChapter(idx)}
              className={`px-3.5 py-2.5 whitespace-nowrap border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeChapter === idx
                  ? 'border-cyan-400 text-white font-bold bg-[#0d1322]'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-[#090e1b]'
              }`}
            >
              <span>{ch.id}</span>
              <span className="hidden sm:inline">{ch.tag}</span>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 tracking-widest uppercase mb-1">
              {current.icon}
              <span>CHAPTER {current.id} // {current.tag}</span>
            </div>
            <h2 className="text-xl font-sans font-black text-white tracking-tight">{current.title}</h2>
          </div>

          {/* Governing Equations Box */}
          <div className="bg-[#0b101c] border border-[#1b253b] p-4 rounded-xs flex flex-col gap-2">
            <div className="text-[10px] text-neutral-400 uppercase tracking-widest">GOVERNING EQUATIONS</div>
            <div className="text-sm font-bold text-cyan-300 font-mono tracking-wide py-1 border-b border-[#162035]">
              {current.equation}
            </div>
            <div className="text-xs text-neutral-300 font-mono pt-1">
              {current.subEq}
            </div>
          </div>

          {/* Scientific Derivation Body */}
          <div className="text-xs sm:text-sm text-neutral-300 leading-relaxed font-sans space-y-3">
            <p>{current.content}</p>
          </div>

          {/* Mathematical Invariants & Constraints */}
          <div className="bg-[#090d18] border border-[#182136] p-4 rounded-xs">
            <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2.5">
              PHYSICAL INVARIANTS & INTEGRATION CONSTRAINTS
            </div>
            <ul className="space-y-2 text-xs text-neutral-300">
              {current.invariants.map((inv, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <ChevronRight size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span>{inv}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-[#1a233a] bg-[#070a12] flex items-center justify-between text-[11px] text-neutral-400">
          <div>ASTRA VERSION 2.0 // SI METRIC COMPLIANT</div>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-[#1a233a] hover:bg-[#253252] text-white rounded-xs font-bold transition-colors cursor-pointer"
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
};
