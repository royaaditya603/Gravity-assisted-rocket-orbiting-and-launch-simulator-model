import React, { useState } from 'react';
import { Info, HelpCircle } from 'lucide-react';

export interface ParameterTooltipProps {
  title: string;
  description: string;
  formula?: string;
  unit?: string;
  source?: string;
}

export const ParameterTooltip: React.FC<ParameterTooltipProps> = ({
  title,
  description,
  formula,
  unit,
  source,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className="text-neutral-400 hover:text-amber-400 focus:outline-none transition-colors p-0.5 cursor-help"
        aria-label={`Help: ${title}`}
      >
        <HelpCircle size={12} />
      </button>

      {isOpen && (
        <div
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-64 bg-[#0d0f17] border border-[#272e42] p-2.5 rounded-xs shadow-xl text-left font-mono pointer-events-none"
        >
          <div className="flex items-center justify-between border-b border-[#1f2538] pb-1 mb-1.5">
            <span className="text-[11px] font-bold text-amber-300">{title}</span>
            {unit && (
              <span className="text-[9px] px-1 py-0.2 bg-[#171b28] text-sky-300 border border-[#2a324b] rounded-xs font-bold">
                {unit}
              </span>
            )}
          </div>
          <p className="text-[10px] text-neutral-300 leading-normal mb-1">{description}</p>
          {formula && (
            <div className="bg-[#141724] border border-[#23293d] p-1 rounded-xs text-[9px] text-amber-400 font-mono mb-1">
              <code>{formula}</code>
            </div>
          )}
          {source && <div className="text-[8px] text-neutral-500 italic">Source: {source}</div>}
        </div>
      )}
    </div>
  );
};

export interface UnitBadgeProps {
  unit: string;
  className?: string;
}

export const UnitBadge: React.FC<UnitBadgeProps> = ({ unit, className = '' }) => (
  <span
    className={`inline-block px-1.5 py-0.5 text-[9px] font-mono font-bold bg-[#151926] text-sky-300 border border-[#262e44] rounded-xs select-none ${className}`}
  >
    {unit}
  </span>
);
