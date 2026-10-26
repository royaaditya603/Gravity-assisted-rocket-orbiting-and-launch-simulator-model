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
    <div className="bg-[#0b0c13] border border-[#23293d] p-4 rounded-xs flex flex-col gap-3.5 font-mono text-white text-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2234] pb-2">
        <div className="flex items-center gap-2">
          <FolderOpen size={14} className="text-amber-400" />
          <span className="font-bold text-amber-300 uppercase">
            SCENARIO PERSISTENCE & JSON IMPORT / EXPORT
          </span>
        </div>
        {currentScenario && (
          <span className="text-[10px] text-neutral-400">
            ACTIVE SCENARIO: <strong className="text-white">{currentScenario.name}</strong>
          </span>
        )}
      </div>

      {/* Persistence Action Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Save Scenario Input & Button */}
        {onSaveScenario && (
          <div className="flex items-center gap-1">
            <input
              type="text"
              placeholder="Custom scenario name..."
              value={newScenarioName}
              onChange={(e) => setNewScenarioName(e.target.value)}
              className="bg-[#141826] border border-[#283148] px-2.5 py-1 text-xs text-white rounded-xs focus:outline-none focus:border-amber-400 w-48"
            />
            <button
              type="button"
              onClick={() => {
                onSaveScenario(newScenarioName.trim() || undefined);
                setNewScenarioName('');
              }}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xs flex items-center gap-1 cursor-pointer transition-colors"
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
            className="px-2.5 py-1 bg-[#161a29] hover:bg-[#22283e] text-neutral-200 border border-[#28324a] rounded-xs flex items-center gap-1 cursor-pointer transition-colors"
            title="Create an isolated clone of current scenario"
          >
            <Copy size={13} /> DUPLICATE
          </button>
        )}

        {/* Export JSON */}
        {onExportJSON && (
          <button
            type="button"
            onClick={onExportJSON}
            className="px-2.5 py-1 bg-[#161a29] hover:bg-[#22283e] text-neutral-200 border border-[#28324a] rounded-xs flex items-center gap-1 cursor-pointer transition-colors"
            title="Export scenario as downloadable JSON file"
          >
            <Download size={13} /> EXPORT JSON
          </button>
        )}

        {/* Import JSON */}
        {onImportJSON && (
          <label className="px-2.5 py-1 bg-[#161a29] hover:bg-[#22283e] text-neutral-200 border border-[#28324a] rounded-xs flex items-center gap-1 cursor-pointer transition-colors">
            <Upload size={13} /> IMPORT JSON
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        )}

        {/* Restore Last Valid Configuration */}
        {onRestoreLastValid && (
          <button
            type="button"
            onClick={onRestoreLastValid}
            className="px-2.5 py-1 bg-[#161a29] hover:bg-[#22283e] text-amber-300 border border-[#28324a] rounded-xs flex items-center gap-1 cursor-pointer transition-colors"
            title="Discard invalid edits and restore last verified valid configuration"
          >
            <RotateCcw size={13} /> RESTORE LAST VALID
          </button>
        )}

        {/* Reset to Defaults */}
        {onResetToDefaults && (
          <button
            type="button"
            onClick={onResetToDefaults}
            className="px-2.5 py-1 bg-[#161a29] hover:bg-[#22283e] text-neutral-400 hover:text-white border border-[#28324a] rounded-xs cursor-pointer transition-colors ml-auto"
            title="Reset all settings to default Jupiter flyby scenario"
          >
            RESET TO DEFAULTS
          </button>
        )}
      </div>

      {/* Import Feedback */}
      {importError && (
        <div className="text-[11px] text-rose-300 bg-rose-950/50 p-2 rounded-xs border border-rose-800">
          Import Error: {importError}
        </div>
      )}
      {importSuccess && (
        <div className="text-[11px] text-emerald-300 bg-emerald-950/50 p-2 rounded-xs border border-emerald-800 flex items-center gap-1.5">
          <CheckCircle2 size={13} /> Scenario imported successfully!
        </div>
      )}

      {/* Saved Scenarios List from Local Storage */}
      {savedScenarios.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-[#1a1f2e] pt-2.5">
          <span className="text-[10px] text-neutral-500 font-bold uppercase">
            LOCAL STORAGE SAVED SCENARIOS ({savedScenarios.length}):
          </span>

          <div className="flex flex-wrap gap-2">
            {savedScenarios.map((sc) => (
              <div
                key={sc.id}
                className="flex items-center gap-1.5 bg-[#141826] border border-[#252e44] px-2.5 py-1 rounded-xs text-[11px]"
              >
                <button
                  type="button"
                  onClick={() => onLoadScenario && onLoadScenario(sc)}
                  className="text-neutral-300 hover:text-amber-400 font-bold text-left cursor-pointer transition-colors"
                  title={`Load "${sc.name}" (${sc.planet.name})`}
                >
                  {sc.name}
                </button>
                <span className="text-[9px] text-neutral-500">({sc.planet.name})</span>
                {onDeleteScenario && savedScenarios.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onDeleteScenario(sc.id)}
                    className="text-neutral-500 hover:text-rose-400 ml-1 cursor-pointer transition-colors"
                    title="Delete saved scenario from local storage"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
