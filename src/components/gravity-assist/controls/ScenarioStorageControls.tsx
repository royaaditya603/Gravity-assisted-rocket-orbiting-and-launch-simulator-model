import React, { useState } from 'react';
import { FlybyScenarioConfig } from '../../../physics/FlybyScenario';
import { FolderOpen, Save, Copy, Download, Upload, RotateCcw, Trash2, CheckCircle2 } from 'lucide-react';

export interface ScenarioStorageControlsProps {
  currentScenario?: FlybyScenarioConfig;
  savedScenarios: FlybyScenarioConfig[];
  onSaveScenario?: (name?: string) => void;
  onLoadScenario?: (scenario: FlybyScenarioConfig) => void;
  onDuplicateScenario?: () => void;
  onDeleteScenario?: (id: string) => void;
  onExportJSON?: () => void;
  onImportJSON?: (jsonStr: string) => void;
  onResetToDefaults?: () => void;
  onRestoreLastValid?: () => void;
}

export const ScenarioStorageControls: React.FC<ScenarioStorageControlsProps> = ({
  currentScenario,
  savedScenarios,
  onSaveScenario,
  onLoadScenario,
  onDuplicateScenario,
  onDeleteScenario,
  onExportJSON,
  onImportJSON,
  onResetToDefaults,
  onRestoreLastValid,
}) => {
  const [newScenarioName, setNewScenarioName] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<boolean>(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string' && onImportJSON) {
        try {
          onImportJSON(content);
          setImportError(null);
          setImportSuccess(true);
          setTimeout(() => setImportSuccess(false), 3000);
        } catch (err: any) {
          setImportError(err?.message || 'Failed to parse JSON scenario.');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="bg-[#F8FAFD] border border-[#DCE3EE] p-4 rounded-xl flex flex-col gap-3.5 font-mono text-[#263247] text-xs shadow-2xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DCE3EE] pb-2">
        <div className="flex items-center gap-2">
          <FolderOpen size={14} className="text-[#0284C7]" />
          <span className="font-bold text-[#14426B] uppercase">
            SCENARIO PERSISTENCE & JSON IMPORT / EXPORT
          </span>
        </div>
        {currentScenario && (
          <span className="text-[10px] text-[#68758A]">
            ACTIVE SCENARIO: <strong className="text-[#263247]">{currentScenario.name}</strong>
          </span>
        )}
      </div>

      {/* Persistence Action Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Save Scenario Input & Button */}
        {onSaveScenario && (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder="Custom scenario name..."
              value={newScenarioName}
              onChange={(e) => setNewScenarioName(e.target.value)}
              className="bg-white border border-[#DCE3EE] px-2.5 py-1 text-xs text-[#263247] rounded-lg focus:outline-none focus:border-[#0284C7] w-48 shadow-2xs"
            />
            <button
              type="button"
              onClick={() => {
                onSaveScenario(newScenarioName.trim() || undefined);
                setNewScenarioName('');
              }}
              className="px-3 py-1 bg-[#AEE5D0] hover:bg-[#97dbc1] text-[#1D6C50] border border-[#AEE5D0] font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
            >
              <Save size={13} /> SAVE
            </button>
          </div>
        )}

        {/* Duplicate */}
        {onDuplicateScenario && (
          <button
            type="button"
            onClick={onDuplicateScenario}
            className="px-2.5 py-1 bg-white hover:bg-[#EEF2F8] text-[#263247] border border-[#DCE3EE] rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
            title="Duplicate current configuration to a new scenario"
          >
            <Copy size={12} /> DUPLICATE
          </button>
        )}

        {/* Export JSON */}
        {onExportJSON && (
          <button
            type="button"
            onClick={onExportJSON}
            className="px-2.5 py-1 bg-white hover:bg-[#EEF2F8] text-[#14426B] border border-[#DCE3EE] rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-2xs font-medium"
            title="Export scenario as JSON download"
          >
            <Download size={12} /> EXPORT JSON
          </button>
        )}

        {/* Import JSON file */}
        {onImportJSON && (
          <label className="px-2.5 py-1 bg-white hover:bg-[#EEF2F8] text-[#14426B] border border-[#DCE3EE] rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-2xs font-medium">
            <Upload size={12} /> IMPORT JSON
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        )}

        {/* Reset to Defaults */}
        {onResetToDefaults && (
          <button
            type="button"
            onClick={onResetToDefaults}
            className="px-2.5 py-1 bg-white hover:bg-[#EEF2F8] text-[#B45309] border border-[#DCE3EE] rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
            title="Reset active scenario to factory defaults"
          >
            <RotateCcw size={12} /> RESET DEFAULTS
          </button>
        )}

        {/* Restore Last Valid */}
        {onRestoreLastValid && (
          <button
            type="button"
            onClick={onRestoreLastValid}
            className="px-2.5 py-1 bg-white hover:bg-[#EEF2F8] text-[#059669] border border-[#DCE3EE] rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
            title="Restore last validated configuration"
          >
            <CheckCircle2 size={12} /> RESTORE VALID
          </button>
        )}
      </div>

      {/* Success / Error Messages */}
      {importSuccess && (
        <div className="p-2 bg-[#AEE5D0]/30 border border-[#AEE5D0] rounded-lg text-[#1D6C50] text-[11px] flex items-center gap-1.5">
          <CheckCircle2 size={13} /> Successfully imported scenario from JSON file.
        </div>
      )}

      {importError && (
        <div className="p-2 bg-[#FEE2E2] border border-[#FCA5A5] rounded-lg text-[#991B1B] text-[11px]">
          {importError}
        </div>
      )}

      {/* Saved Scenarios List */}
      <div className="flex flex-col gap-2 pt-1 border-t border-[#DCE3EE]">
        <span className="text-[10px] text-[#68758A] font-bold uppercase">
          SAVED LOCAL SCENARIOS ({savedScenarios.length}):
        </span>

        {savedScenarios.length === 0 ? (
          <div className="text-[11px] text-[#94A3B8] italic py-1">
            No saved scenarios found in local storage. Click "Save" above to bookmark current configurations.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {savedScenarios.map((sc) => (
              <div
                key={sc.id}
                className="bg-white border border-[#DCE3EE] p-2.5 rounded-lg flex items-center justify-between gap-2 shadow-2xs hover:border-[#A9D4F5] transition-all"
              >
                <div
                  onClick={() => onLoadScenario && onLoadScenario(sc)}
                  className="flex flex-col flex-1 cursor-pointer truncate"
                >
                  <span className="font-bold text-xs text-[#263247] truncate hover:text-[#0284C7]">
                    {sc.name}
                  </span>
                  <span className="text-[9px] text-[#68758A]">
                    {sc.planet.name} • v_∞: {(sc.encounter.vInfSpeedMPerS / 1000).toFixed(1)} km/s • {sc.encounter.passType}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {onLoadScenario && (
                    <button
                      type="button"
                      onClick={() => onLoadScenario(sc)}
                      className="px-2 py-0.5 bg-[#EEF2F8] hover:bg-[#E2E8F0] text-[#0284C7] rounded-md text-[10px] font-bold cursor-pointer"
                    >
                      LOAD
                    </button>
                  )}
                  {onDeleteScenario && (
                    <button
                      type="button"
                      onClick={() => onDeleteScenario(sc.id)}
                      className="p-1 hover:bg-[#FEE2E2] text-[#94A3B8] hover:text-[#DC2626] rounded-md cursor-pointer transition-colors"
                      title="Delete saved scenario"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
