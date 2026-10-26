import React from 'react';
import { X, Settings, Monitor, Eye, Keyboard, Sparkles, Zap, Shield } from 'lucide-react';
import { GraphicsQuality } from '../gravity-assist/viewport/Flyby3DCanvas';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  graphicsQuality: GraphicsQuality;
  onChangeGraphicsQuality: (quality: GraphicsQuality) => void;
  reducedMotion: boolean;
  onToggleReducedMotion: () => void;
  spacecraftModel: 'PROBE' | 'ROCKET';
  onChangeSpacecraftModel: (model: 'PROBE' | 'ROCKET') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  graphicsQuality,
  onChangeGraphicsQuality,
  reducedMotion,
  onToggleReducedMotion,
  spacecraftModel,
  onChangeSpacecraftModel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-[#080b13] border border-[#1a233a] rounded-xs shadow-2xl flex flex-col font-mono text-neutral-200 select-none overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#1a233a] flex items-center justify-between bg-[#0b0f1a]">
          <div className="flex items-center gap-2.5">
            <Settings size={18} className="text-sky-400" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-white">SIMULATION & GRAPHICS SETTINGS</div>
              <div className="text-[10px] text-neutral-400">HARDWARE PROFILES, ACCESSIBILITY & KEYBOARD SHORTCUTS</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xs hover:bg-[#1a243b] text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {/* Graphics Quality */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Monitor size={14} className="text-sky-400" /> GRAPHICS FIDELITY PRESET
              </span>
              <span className="text-[10px] text-neutral-400 uppercase">ACTIVE: {graphicsQuality}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {(['PERFORMANCE', 'BALANCED', 'HIGH'] as GraphicsQuality[]).map((q) => (
                <button
                  key={q}
                  onClick={() => onChangeGraphicsQuality(q)}
                  className={`p-2.5 rounded-xs border text-left transition-all cursor-pointer ${
                    graphicsQuality === q
                      ? 'bg-[#121c32] border-sky-400 text-white font-bold'
                      : 'bg-[#0b0f1a] border-[#1a233a] text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <div className="text-xs font-bold">{q}</div>
                  <div className="text-[10px] text-neutral-500 pt-0.5">
                    {q === 'HIGH' ? 'DPR 2.0 • Max Stars' : q === 'BALANCED' ? 'DPR 1.5 • Adaptive' : 'DPR 1.0 • Max Speed'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Reduced Motion Toggle */}
          <div className="p-3 bg-[#0b0f1a] border border-[#1a233a] rounded-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Eye size={16} className="text-emerald-400" />
              <div>
                <div className="text-xs font-bold text-white">REDUCED MOTION MODE</div>
                <div className="text-[10px] text-neutral-400">Minimizes camera transitions & continuous UI easing</div>
              </div>
            </div>
            <button
              onClick={onToggleReducedMotion}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                reducedMotion ? 'bg-emerald-500' : 'bg-[#1a233a]'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                  reducedMotion ? 'right-1' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* Spacecraft 3D Model Preference */}
          <div className="space-y-2.5">
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-400" /> SPACECRAFT 3D MODEL
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => onChangeSpacecraftModel('PROBE')}
                className={`p-2.5 rounded-xs border text-left transition-all cursor-pointer ${
                  spacecraftModel === 'PROBE'
                    ? 'bg-[#121c32] border-amber-400 text-white font-bold'
                    : 'bg-[#0b0f1a] border-[#1a233a] text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <div className="text-xs font-bold">DEEP-SPACE PROBE</div>
                <div className="text-[10px] text-neutral-500 pt-0.5">Voyager / Cassini / New Horizons</div>
              </button>
              <button
                onClick={() => onChangeSpacecraftModel('ROCKET')}
                className={`p-2.5 rounded-xs border text-left transition-all cursor-pointer ${
                  spacecraftModel === 'ROCKET'
                    ? 'bg-[#121c32] border-amber-400 text-white font-bold'
                    : 'bg-[#0b0f1a] border-[#1a233a] text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <div className="text-xs font-bold">LAUNCH VEHICLE</div>
                <div className="text-[10px] text-neutral-500 pt-0.5">NASA Ares 1 / Multi-Stage Core</div>
              </button>
            </div>
          </div>

          {/* Keyboard Shortcuts Reference */}
          <div className="space-y-2.5 pt-2 border-t border-[#1a233a]">
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <Keyboard size={14} className="text-purple-400" /> MISSION CONTROL KEYBOARD SHORTCUTS
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-[#090d18] border border-[#162035] rounded-xs flex items-center justify-between">
                <span className="text-neutral-400">Play / Pause</span>
                <kbd className="px-1.5 py-0.5 bg-[#17223b] text-sky-300 rounded text-[11px] font-bold">Space</kbd>
              </div>
              <div className="p-2 bg-[#090d18] border border-[#162035] rounded-xs flex items-center justify-between">
                <span className="text-neutral-400">Reset to Epoch</span>
                <kbd className="px-1.5 py-0.5 bg-[#17223b] text-sky-300 rounded text-[11px] font-bold">R</kbd>
              </div>
              <div className="p-2 bg-[#090d18] border border-[#162035] rounded-xs flex items-center justify-between">
                <span className="text-neutral-400">Step Forward</span>
                <kbd className="px-1.5 py-0.5 bg-[#17223b] text-sky-300 rounded text-[11px] font-bold">→</kbd>
              </div>
              <div className="p-2 bg-[#090d18] border border-[#162035] rounded-xs flex items-center justify-between">
                <span className="text-neutral-400">Step Backward</span>
                <kbd className="px-1.5 py-0.5 bg-[#17223b] text-sky-300 rounded text-[11px] font-bold">←</kbd>
              </div>
              <div className="p-2 bg-[#090d18] border border-[#162035] rounded-xs flex items-center justify-between">
                <span className="text-neutral-400">Camera Views</span>
                <kbd className="px-1.5 py-0.5 bg-[#17223b] text-sky-300 rounded text-[11px] font-bold">1 - 4</kbd>
              </div>
              <div className="p-2 bg-[#090d18] border border-[#162035] rounded-xs flex items-center justify-between">
                <span className="text-neutral-400">Toggle Vectors</span>
                <kbd className="px-1.5 py-0.5 bg-[#17223b] text-sky-300 rounded text-[11px] font-bold">V</kbd>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-[#1a233a] bg-[#0b0f1a] flex items-center justify-between text-[11px] text-neutral-400">
          <div>CLIENT-SIDE PERSISTENT PREFERENCES</div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#1a233a] hover:bg-[#253252] text-white rounded-xs font-bold transition-colors cursor-pointer"
          >
            APPLY & CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
