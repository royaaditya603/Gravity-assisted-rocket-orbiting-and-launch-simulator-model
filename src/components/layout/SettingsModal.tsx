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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white border border-[#DCE3EE] rounded-2xl shadow-2xl flex flex-col font-mono text-[#263247] select-none overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#DCE3EE] flex items-center justify-between bg-[#F8FAFD]">
          <div className="flex items-center gap-2.5">
            <Settings size={18} className="text-[#14426B]" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#263247]">SIMULATION & GRAPHICS SETTINGS</div>
              <div className="text-[10px] text-[#68758A]">HARDWARE PROFILES, ACCESSIBILITY & KEYBOARD SHORTCUTS</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#EEF2F8] text-[#68758A] hover:text-[#263247] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {/* Graphics Quality */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#263247] flex items-center gap-1.5">
                <Monitor size={14} className="text-[#14426B]" /> GRAPHICS FIDELITY PRESET
              </span>
              <span className="text-[10px] text-[#68758A] uppercase font-bold">ACTIVE: {graphicsQuality}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {(['PERFORMANCE', 'BALANCED', 'HIGH'] as GraphicsQuality[]).map((q) => (
                <button
                  key={q}
                  onClick={() => onChangeGraphicsQuality(q)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    graphicsQuality === q
                      ? 'bg-[#A9D4F5] border-[#89C2EE] text-[#14426B] font-bold shadow-xs'
                      : 'bg-white border-[#DCE3EE] text-[#68758A] hover:bg-[#F8FAFD]'
                  }`}
                >
                  <div className="text-xs font-bold">{q}</div>
                  <div className="text-[10px] text-[#68758A] pt-0.5">
                    {q === 'HIGH' ? 'DPR 2.0 • Max Stars' : q === 'BALANCED' ? 'DPR 1.5 • Adaptive' : 'DPR 1.0 • Max Speed'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Reduced Motion Toggle */}
          <div className="p-3 bg-[#F8FAFD] border border-[#DCE3EE] rounded-xl flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <Eye size={16} className="text-[#059669]" />
              <div>
                <div className="text-xs font-bold text-[#263247]">REDUCED MOTION MODE</div>
                <div className="text-[10px] text-[#68758A]">Minimizes camera transitions & continuous UI easing</div>
              </div>
            </div>
            <button
              onClick={onToggleReducedMotion}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer border border-[#DCE3EE] ${
                reducedMotion ? 'bg-[#AEE5D0]' : 'bg-[#EEF2F8]'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform absolute top-0.5 ${
                  reducedMotion ? 'right-1' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* Spacecraft 3D Model Preference */}
          <div className="space-y-2.5">
            <div className="text-xs font-bold text-[#263247] flex items-center gap-1.5">
              <Sparkles size={14} className="text-[#7A3E1D]" /> SPACECRAFT 3D MODEL
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => onChangeSpacecraftModel('PROBE')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  spacecraftModel === 'PROBE'
                    ? 'bg-[#FFD2B8] border-[#F5BCA0] text-[#7A3E1D] font-bold shadow-xs'
                    : 'bg-white border-[#DCE3EE] text-[#68758A] hover:bg-[#F8FAFD]'
                }`}
              >
                <div className="text-xs font-bold">DEEP-SPACE PROBE</div>
                <div className="text-[10px] text-[#68758A] pt-0.5">Voyager / Cassini / New Horizons</div>
              </button>
              <button
                onClick={() => onChangeSpacecraftModel('ROCKET')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  spacecraftModel === 'ROCKET'
                    ? 'bg-[#FFD2B8] border-[#F5BCA0] text-[#7A3E1D] font-bold shadow-xs'
                    : 'bg-white border-[#DCE3EE] text-[#68758A] hover:bg-[#F8FAFD]'
                }`}
              >
                <div className="text-xs font-bold">LAUNCH VEHICLE</div>
                <div className="text-[10px] text-[#68758A] pt-0.5">NASA Ares 1 / Multi-Stage Core</div>
              </button>
            </div>
          </div>

          {/* Keyboard Shortcuts Reference */}
          <div className="space-y-2.5 pt-2 border-t border-[#DCE3EE]">
            <div className="text-xs font-bold text-[#263247] flex items-center gap-1.5">
              <Keyboard size={14} className="text-[#4A347F]" /> MISSION CONTROL KEYBOARD SHORTCUTS
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-[#F8FAFD] border border-[#DCE3EE] rounded-lg flex items-center justify-between">
                <span className="text-[#68758A]">Play / Pause</span>
                <kbd className="px-1.5 py-0.5 bg-white text-[#14426B] border border-[#DCE3EE] rounded text-[11px] font-bold">Space</kbd>
              </div>
              <div className="p-2 bg-[#F8FAFD] border border-[#DCE3EE] rounded-lg flex items-center justify-between">
                <span className="text-[#68758A]">Reset to Epoch</span>
                <kbd className="px-1.5 py-0.5 bg-white text-[#14426B] border border-[#DCE3EE] rounded text-[11px] font-bold">R</kbd>
              </div>
              <div className="p-2 bg-[#F8FAFD] border border-[#DCE3EE] rounded-lg flex items-center justify-between">
                <span className="text-[#68758A]">Step Forward</span>
                <kbd className="px-1.5 py-0.5 bg-white text-[#14426B] border border-[#DCE3EE] rounded text-[11px] font-bold">→</kbd>
              </div>
              <div className="p-2 bg-[#F8FAFD] border border-[#DCE3EE] rounded-lg flex items-center justify-between">
                <span className="text-[#68758A]">Step Backward</span>
                <kbd className="px-1.5 py-0.5 bg-white text-[#14426B] border border-[#DCE3EE] rounded text-[11px] font-bold">←</kbd>
              </div>
              <div className="p-2 bg-[#F8FAFD] border border-[#DCE3EE] rounded-lg flex items-center justify-between">
                <span className="text-[#68758A]">Camera Views</span>
                <kbd className="px-1.5 py-0.5 bg-white text-[#14426B] border border-[#DCE3EE] rounded text-[11px] font-bold">1 - 4</kbd>
              </div>
              <div className="p-2 bg-[#F8FAFD] border border-[#DCE3EE] rounded-lg flex items-center justify-between">
                <span className="text-[#68758A]">Toggle Vectors</span>
                <kbd className="px-1.5 py-0.5 bg-white text-[#14426B] border border-[#DCE3EE] rounded text-[11px] font-bold">V</kbd>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-[#DCE3EE] bg-[#F8FAFD] flex items-center justify-between text-[11px] text-[#68758A]">
          <div>CLIENT-SIDE PERSISTENT PREFERENCES</div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#A9D4F5] hover:bg-[#89C2EE] text-[#14426B] rounded-lg font-bold transition-colors cursor-pointer border border-[#89C2EE]"
          >
            APPLY & CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
