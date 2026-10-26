import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

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
        className="text-[#68758A] hover:text-[#0284C7] focus:outline-none transition-colors p-0.5 cursor-help"
        aria-label={`Help: ${title}`}
      >
        <HelpCircle size={12} />
      </button>

      {isOpen && (
        <div
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-64 bg-white border border-[#DCE3EE] p-3 rounded-xl shadow-lg text-left font-mono pointer-events-none text-[#263247]"
        >
          <div className="flex items-center justify-between border-b border-[#DCE3EE] pb-1.5 mb-1.5">
            <span className="text-[11px] font-bold text-[#14426B]">{title}</span>
            {unit && (
              <span className="text-[9px] px-1.5 py-0.5 bg-[#EEF2F8] text-[#0284C7] border border-[#DCE3EE] rounded-md font-bold">
                {unit}
              </span>
            )}
          </div>
          <p className="text-[10px] text-[#68758A] leading-normal mb-1.5">{description}</p>
          {formula && (
            <div className="bg-[#F8FAFD] border border-[#DCE3EE] p-1.5 rounded-md text-[9px] text-[#B45309] font-mono mb-1">
              <code>{formula}</code>
            </div>
          )}
          {source && <div className="text-[8px] text-[#94A3B8] italic">Source: {source}</div>}
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
    className={`inline-block px-1.5 py-0.5 text-[9px] font-mono font-bold bg-[#EEF2F8] text-[#14426B] border border-[#DCE3EE] rounded-md select-none ${className}`}
  >
    {unit}
  </span>
);
