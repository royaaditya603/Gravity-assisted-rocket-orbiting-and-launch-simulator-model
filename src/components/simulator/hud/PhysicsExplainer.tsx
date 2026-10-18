import React, { useState } from 'react';
import { SimulationManager } from '../../../simulation/SimulationManager';
import { Info, ChevronRight, BookOpen } from 'lucide-react';

interface PhysicsExplainerProps {
  sim: SimulationManager;
}

export const PhysicsExplainer: React.FC<PhysicsExplainerProps> = ({ sim }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const getExplanation = () => {
    switch (sim.flightPhase) {
      case 'ON_PAD':
        return {
          title: 'Static Pad Equilibrium (Pre-Launch)',
          equation: 'F_net = N + m*g(R_E) = 0, TWR < 1.0',
          text: 'The vehicle rests on the launch pad in static equilibrium. The normal force from Earth counterbalances gravitational attraction. Because Earth rotates eastward at ~465 m/s at the equator, the rocket already carries initial tangential velocity.',
        };
      case 'POWERED_ASCENT':
        return {
          title: 'Variable Mass Powered Ascent',
          equation: 'm(t)*dv/dt = T(t) - D(v, h) + m(t)*g(r)',
          text: 'Thrust exceeds vehicle weight (TWR > 1.0). The rocket is consuming reaction mass via the Tsiolkovsky relation. Aerodynamic drag opposes velocity as dynamic pressure Q rises towards Max-Q. The gravity turn progressively arches the trajectory eastward to build tangential orbital velocity.',
        };
      case 'COASTING':
        return {
          title: 'Unpowered Ballistic Coast (Hamiltonian Conservation)',
          equation: 'epsilon = v^2/2 - mu/r = constant, h = r x v = constant',
          text: 'The main engine has cut off. In the absence of thrust and outside dense atmosphere, the trajectory is governed by conservative Newtonian two-body dynamics. Kinetic energy is exchanged for gravitational potential as the craft approaches apogee.',
        };
      case 'ORBIT_ACHIEVED':
        return {
          title: 'Stable Bounded Keplerian Orbit',
          equation: '0 <= e < 1, r_p >= R_E + 100km, v_circ = sqrt(mu/r)',
          text: 'Orbital insertion complete! Both perigee and apogee lie strictly above the 100 km Kármán line. The gravitational acceleration precisely matches the centripetal acceleration requirement (v^2/r = mu/r^2), creating an indefinite state of free-fall without surface contact.',
        };
      case 'ESCAPE_TRAJECTORY':
        return {
          title: 'Unbounded Hyperbolic Escape',
          equation: 'epsilon > 0, e > 1.0, v_inf = sqrt(v^2 - 2*mu/r)',
          text: 'The vehicle velocity exceeds local escape speed (v_esc = sqrt(2*mu/r)). Total specific mechanical energy is positive. The spacecraft will permanently escape Earth\'s gravitational sphere of influence into heliocentric space with non-zero asymptotic residual velocity v_infinity.',
        };
      case 'ATMOSPHERIC_REENTRY':
        return {
          title: 'Atmospheric Re-entry & Dissipative Aerodynamic Braking',
          equation: 'd(epsilon)/dt = -0.5 * rho(h) * v^3 * C_d * A / m < 0',
          text: 'The trajectory perigee dipped into the sensible atmosphere (< 100 km). Hypersonic interaction with air molecules generates intense aerodynamic drag and heating, non-conservatively draining orbital energy and lowering the apogee.',
        };
      case 'SURFACE_IMPACTED':
        return {
          title: 'Terminal Surface Impact',
          equation: '||r|| <= R_E, v = 0 m/s',
          text: 'The trajectory intersected the solid planetary surface (r_p < R_E) without achieving orbital speed or performing a circularization burn. Kinetic energy was abruptly dissipated on impact.',
        };
      default:
        return {
          title: 'Orbital Mechanics Engine',
          equation: 'm*dv/dt = sum(F)',
          text: 'Continuous numerical integration under validated Newtonian and aerodynamic laws.',
        };
    }
  };

  const current = getExplanation();

  return (
    <div className="absolute bottom-20 left-4 z-20 pointer-events-auto max-w-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#0e1017]/85 backdrop-blur-md border border-[#232733] hover:border-neutral-500 rounded-xs text-[11px] font-mono text-neutral-300 transition-colors shadow-lg"
      >
        <BookOpen size={13} className="text-sky-400" />
        <span>PHYSICS EXPLAINER</span>
        <ChevronRight size={13} className={`transform transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>

      {isOpen && (
        <div className="mt-2 bg-[#0e1017]/95 backdrop-blur-md border border-[#232733] p-3.5 rounded-sm shadow-2xl flex flex-col gap-2 text-xs">
          <div className="flex items-center gap-2 border-b border-[#232733] pb-1.5">
            <Info size={14} className="text-sky-400 shrink-0" />
            <span className="font-mono font-bold text-white uppercase text-[11px]">
              {current.title}
            </span>
          </div>

          <div className="bg-[#141720] p-2 rounded-xs border border-[#1f2433] font-mono text-[10px] text-amber-300">
            {current.equation}
          </div>

          <p className="text-neutral-300 leading-relaxed text-[11px]">
            {current.text}
          </p>
        </div>
      )}
    </div>
  );
};
