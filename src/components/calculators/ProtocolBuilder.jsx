import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Paperclip, Loader2, Sparkles, ChevronRight, ChevronLeft,
  Plus, Trash2, Check, BookOpen, Pencil,
  AlertTriangle, Info, Snowflake,
  Thermometer, Hand, Timer, Skull, Microscope, TestTube2,
  Ban, PencilLine, ListPlus, Clock3, X,
} from 'lucide-react';
import { InvokeLLM } from '@/api/gemini';
import { hasExplicitProtocolStructure, parseProtocolText } from '@/lib/protocolTextParser';
import { getStepDuration, inferUnit, renderVariableText, replaceNumericValue } from '@/lib/protocolVariables';

// ─── File reader ──────────────────────────────────────────────────────────────
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsText(file);
  });
}

// ─── Fallback: rough manual parse ────────────────────────────────────────────
function parseStepsFromText(raw) {
  return parseProtocolText(raw);
}

// ─── Step progress bar ────────────────────────────────────────────────────────
const WIZARD_STEPS = ['Protocol input', 'Edit steps', 'Preview & save'];

const STEP_MARKERS = [
  { value: null, Icon: Ban, label: 'No icon' },
  { value: 'warning', Icon: AlertTriangle, label: 'Warning' },
  { value: 'ice', Icon: Snowflake, label: 'On Ice' },
  { value: 'temp', Icon: Thermometer, label: 'Temperatuur' },
  { value: 'gloves', Icon: Hand, label: 'Gloves' },
  { value: 'timer', Icon: Timer, label: 'Timer' },
  { value: 'toxic', Icon: Skull, label: 'Toxic' },
  { value: 'fume hood', Icon: Microscope, label: 'Fume Hood' },
  { value: 'sterile', Icon: TestTube2, label: 'Sterile Work' },
];

function InlineVariableText({ text, variables = [], values = {}, onValueChange }) {
  if (!text) return text;
  const byId = Object.fromEntries(variables.map(variable => [variable.id, variable]));
  return text.split(/(\{\{[\w-]+\}\})/g).map((part, index) => {
    const match = part.match(/^\{\{([\w-]+)\}\}$/);
    if (!match) return part;
    const variable = byId[match[1]];
    if (!variable) return part;
    const value = String(values[variable.id] ?? variable.default ?? '');
    return (
      <input
        key={`${variable.id}-${index}`}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={event => onValueChange?.(variable.id, event.target.value)}
        onClick={event => event.stopPropagation()}
        aria-label={variable.label}
        title={variable.label}
        className="mx-1 inline-block h-7 rounded-md border border-teal-300 bg-white px-1.5 text-center text-sm font-semibold text-teal-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200 dark:border-teal-700 dark:bg-slate-950 dark:text-teal-300"
        style={{ width: `${Math.max(3.5, Math.min(9, value.length + 2))}ch` }}
      />
    );
  });
}

function StepBar({ current }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {WIZARD_STEPS.map((label, i) => (
        <div key={i} className="flex items-center gap-2 flex-1">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors
            ${i < current ? 'bg-teal-600 text-white' : i === current ? 'bg-teal-600 text-white ring-4 ring-teal-200 dark:ring-teal-900' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
            {i < current ? <Check className="w-3.5 h-3.5" /> : i + 1}
          </div>
          <span className={`text-xs font-medium hidden sm:inline ${i === current ? 'text-teal-700 dark:text-teal-400' : 'text-slate-400'}`}>{label}</span>
          {i < WIZARD_STEPS.length - 1 && <div className={`h-0.5 flex-1 rounded ${i < current ? 'bg-teal-600' : 'bg-slate-200 dark:bg-slate-700'}`} />}
        </div>
      ))}
    </div>
  );
}

// ─── Fully expanded step editor ───────────────────────────────────────────────
function StepsPreview({ steps, variables = [], onChange, onMakeVariable, onUpdateVariable, onRemoveVariable }) {
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingTextIndex, setEditingTextIndex] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [numberSelection, setNumberSelection] = useState(null);
  const [variablePickerIndex, setVariablePickerIndex] = useState(null);
  const actionCount = steps.filter(s => !s.isSection).length;
  let visibleStepNumber = 0;

  const selectNumber = (event, stepIndex, target = 'text', substepIndex = null) => {
    if (!onMakeVariable) return;
    const selection = window.getSelection();
    const value = selection?.toString().trim();
    if (!value || !/^[+-]?\d+(?:[.,]\d+)?$/.test(value) || selection.rangeCount === 0) {
      setNumberSelection(null);
      return;
    }
    const range = selection.getRangeAt(0);
    if (!event.currentTarget.contains(range.commonAncestorContainer)) return;
    const rect = range.getBoundingClientRect();
    setNumberSelection({
      stepIndex,
      target,
      substepIndex,
      value,
      left: Math.min(rect.left, window.innerWidth - 170),
      top: Math.max(8, rect.top - 44),
    });
  };

  const updateMarker = (index, special) => {
    onChange?.(steps.map((step, i) => i === index ? { ...step, special } : step));
    setNumberSelection(null);
  };

  const editableText = text => text.replace(/\{\{([\w-]+)\}\}/g, (match, id) => {
    const variable = variables.find(item => item.id === id);
    return variable ? `⟦${variable.label}⟧` : match;
  });

  const saveEditedText = index => {
    let template = editingText;
    for (const variable of variables) {
      template = template.split(`⟦${variable.label}⟧`).join(`{{${variable.id}}}`);
    }
    onChange?.(steps.map((item, itemIndex) => itemIndex === index ? { ...item, text: template } : item));
    setEditingTextIndex(null);
  };

  const removeStep = index => {
    onChange?.(steps.filter((_, itemIndex) => itemIndex !== index));
    setEditingIndex(null);
    setEditingTextIndex(null);
  };

  const addStepBelow = index => {
    const next = [...steps];
    next.splice(index + 1, 0, {
      text: 'New protocol step',
      special: null,
      isSection: false,
      substeps: [],
      note: null,
    });
    onChange?.(next);
    setEditingIndex(index + 1);
    setEditingTextIndex(index + 1);
    setEditingText('New protocol step');
  };

  const variableCandidates = step => {
    const candidates = [];
    const collect = (text, target, substepIndex = null) => {
      if (!text) return;
      for (const match of text.matchAll(/(?<![\w{])([+-]?\d+(?:[.,]\d+)?)(?![\w}])/g)) {
        const value = match[1];
        if (!candidates.some(candidate => candidate.value === value)) {
          candidates.push({ value, target, substepIndex });
        }
      }
    };
    collect(step.text, 'text');
    (step.substeps || []).forEach((substep, index) => collect(substep, 'substep', index));
    collect(step.note, 'note');
    return candidates;
  };

  return (
    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
        Steps detected: <span className="text-teal-600 dark:text-teal-400">{actionCount}</span>
      </p>
      {onChange && (
        <p className="mb-2 text-[10px] text-slate-400">Click a step to edit its text, icon, or variables.</p>
      )}
      <div className="space-y-1">
        {steps.map((s, i) => {
          const actualIndex = i;
          if (!s.isSection) visibleStepNumber++;
          const stepTemplate = [s.text, ...(s.substeps || []), s.note || ''].join(' ');
          const linkedVariables = variables.filter(variable => stepTemplate.includes(`{{${variable.id}}}`));
          const selectedMarker = STEP_MARKERS.find(marker => marker.value === s.special);
          const selectedStyle = s.special ? SPECIAL_STYLES[s.special] : null;
          return (
          <div
            key={i}
            className={`rounded-lg border bg-slate-100 px-2 py-1.5 transition-colors dark:bg-slate-800 ${
              s.isSection
                ? 'border-slate-200 dark:border-slate-700'
                : editingIndex === actualIndex
                  ? 'border-teal-400 ring-1 ring-teal-200 dark:border-teal-700 dark:ring-teal-900'
                  : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
            }`}
            onClick={() => {
              if (window.getSelection()?.toString()) return;
              if (!s.isSection) setEditingIndex(editingIndex === actualIndex ? null : actualIndex);
            }}
          >
          <div className="flex gap-2 items-start">
            {s.isSection ? (
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5">§</span>
            ) : (
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500 w-4 flex-shrink-0 mt-0.5">{visibleStepNumber}.</span>
            )}
            <div className="flex-1 min-w-0">
              {editingTextIndex === actualIndex ? (
                <div className="space-y-1.5" onClick={event => event.stopPropagation()}>
                  <textarea
                    value={editingText}
                    onChange={event => setEditingText(event.target.value)}
                    rows={3}
                    autoFocus
                    className="w-full resize-y rounded-md border border-teal-300 bg-white p-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-200 dark:border-teal-700 dark:bg-slate-950 dark:text-slate-200"
                  />
                  <div className="flex gap-1">
                    <button type="button" onClick={() => saveEditedText(actualIndex)} className="flex items-center gap-1 rounded-md bg-teal-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-teal-700">
                      <Check className="h-3 w-3" /> Save
                    </button>
                    <button type="button" onClick={() => setEditingTextIndex(null)} className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[10px] text-slate-500 dark:border-slate-700">
                      <X className="h-3 w-3" /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className={`text-xs ${s.isSection ? 'font-semibold text-slate-700 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400'}`}>
                  <span onMouseUp={e => selectNumber(e, actualIndex)}>{renderVariableText(s.text, variables)}</span>
                </p>
              )}
              {s.substeps?.length > 0 && (
                editingIndex === actualIndex ? (
                  <ul className="mt-1 space-y-0.5 pl-3 border-l border-slate-200 dark:border-slate-700">
                    {s.substeps.map((substep, substepIndex) => (
                      <li key={substepIndex} className="text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="mr-1 text-slate-400">{String.fromCharCode(97 + substepIndex)}.</span>
                        <span onMouseUp={e => selectNumber(e, actualIndex, 'substep', substepIndex)}>{renderVariableText(substep, variables)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    + {s.substeps.length} substep{s.substeps.length > 1 ? 's' : ''}
                  </p>
                )
              )}
            </div>
            {s.special && (
              editingIndex === actualIndex && selectedStyle ? (
                <span className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${selectedStyle.badge}`}>
                  {selectedMarker?.Icon && <selectedMarker.Icon className="h-3 w-3" />}
                  {selectedStyle.label}
                </span>
              ) : (
                <span className="flex-shrink-0 text-slate-400">
                  {selectedMarker?.Icon && <selectedMarker.Icon className="h-3.5 w-3.5" />}
                </span>
              )
            )}
          </div>
          {editingIndex === actualIndex && !s.isSection && (
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800" onClick={e => e.stopPropagation()}>
              <div className="mb-2 flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditingTextIndex(actualIndex);
                    setEditingText(editableText(s.text));
                  }}
                  className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 hover:border-teal-300 hover:text-teal-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  <PencilLine className="h-3 w-3" /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => addStepBelow(actualIndex)}
                  className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 hover:border-teal-300 hover:text-teal-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  <ListPlus className="h-3 w-3" /> Add step below
                </button>
                <button
                  type="button"
                  onClick={() => removeStep(actualIndex)}
                  className="flex items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:bg-slate-900 dark:text-red-400"
                >
                  <Trash2 className="h-3 w-3" /> Remove step
                </button>
                <button
                  type="button"
                  onClick={() => setVariablePickerIndex(variablePickerIndex === actualIndex ? null : actualIndex)}
                  className="flex items-center gap-1 rounded-md border border-teal-200 bg-white px-2 py-1 text-[10px] font-medium text-teal-700 hover:bg-teal-50 dark:border-teal-800 dark:bg-slate-900 dark:text-teal-300"
                >
                  <Plus className="h-3 w-3" /> Add variable
                </button>
              </div>
              {variablePickerIndex === actualIndex && (
                <div className="mb-3 rounded-md border border-teal-100 bg-teal-50 p-2 dark:border-teal-900 dark:bg-teal-950/30">
                  <p className="mb-1.5 text-[10px] font-medium text-teal-700 dark:text-teal-300">Choose a number from this step</p>
                  <div className="flex flex-wrap gap-1">
                    {variableCandidates(s).length > 0 ? variableCandidates(s).map(candidate => (
                      <button
                        key={`${candidate.target}-${candidate.substepIndex}-${candidate.value}`}
                        type="button"
                        onClick={() => {
                          onMakeVariable?.({ ...candidate, stepIndex: actualIndex });
                          setVariablePickerIndex(null);
                        }}
                        className="rounded-md border border-teal-200 bg-white px-2 py-1 text-xs font-semibold text-teal-700 hover:border-teal-400 dark:border-teal-800 dark:bg-slate-900 dark:text-teal-300"
                      >
                        {candidate.value}
                      </button>
                    )) : (
                      <span className="text-[10px] text-slate-400">No unlinked numbers found in this step.</span>
                    )}
                  </div>
                </div>
              )}
              {linkedVariables.length > 0 && (
                <div className="mb-3 space-y-1.5">
                  <p className="text-[10px] font-medium text-slate-500 dark:text-slate-300">Variables in this step</p>
                  {linkedVariables.map(variable => (
                    <div key={variable.id} className="grid grid-cols-[1fr_5rem_4rem_auto] gap-1 rounded-md border border-slate-200 bg-white p-1.5 dark:border-slate-700 dark:bg-slate-900">
                      <Input
                        value={variable.label}
                        onChange={event => onUpdateVariable?.(variable.id, { label: event.target.value })}
                        aria-label="Variable label"
                        className="h-7 text-xs"
                      />
                      <Input
                        value={variable.default}
                        onChange={event => onUpdateVariable?.(variable.id, { default: event.target.value })}
                        aria-label="Default value"
                        className="h-7 text-xs"
                      />
                      <Input
                        value={variable.unit || ''}
                        onChange={event => onUpdateVariable?.(variable.id, { unit: event.target.value })}
                        aria-label="Unit"
                        placeholder="Unit"
                        className="h-7 text-xs"
                      />
                      <button type="button" onClick={() => onRemoveVariable?.(variable.id)} title="Remove variable" className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="mb-1.5 text-[10px] font-medium text-slate-400">Step meaning</p>
              <div className="flex flex-wrap gap-1">
                {STEP_MARKERS.map(marker => (
                  <button
                    key={marker.label}
                    type="button"
                    onClick={() => updateMarker(actualIndex, marker.value)}
                    title={marker.label}
                    aria-label={marker.label}
                    className={`h-8 min-w-8 rounded-md border px-1.5 text-sm transition-colors ${
                      s.special === marker.value
                        ? 'border-teal-400 bg-teal-50 ring-1 ring-teal-200 dark:bg-teal-900/30'
                        : 'border-slate-200 bg-white hover:border-teal-300 dark:border-slate-700 dark:bg-slate-900'
                    }`}
                  >
                    <marker.Icon className="mx-auto h-4 w-4" />
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-slate-400">You can also select a number directly in the step text and choose Add variable.</p>
            </div>
          )}
          </div>
        )})}
      </div>
      {numberSelection && (
        <div
          className="fixed z-[100] rounded-lg border border-teal-200 bg-white p-1 shadow-xl dark:border-teal-800 dark:bg-slate-900"
          style={{ left: numberSelection.left, top: numberSelection.top }}
          onMouseDown={e => e.preventDefault()}
        >
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-900/30"
            onClick={() => {
              onMakeVariable(numberSelection);
              setNumberSelection(null);
              window.getSelection()?.removeAllRanges();
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Add variable
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Special step styles ──────────────────────────────────────────────────────
const SPECIAL_STYLES = {
  ice: { bg: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700', badge: 'bg-blue-100 text-blue-700 dark:text-blue-300', label: 'On Ice' },
  warning: { bg: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800', badge: 'bg-amber-100 text-amber-700 dark:text-amber-400', label: 'Caution' },
  temp: { bg: 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800', badge: 'bg-orange-100 text-orange-700 dark:text-orange-400', label: 'Temperature' },
  toxic: { bg: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800', badge: 'bg-red-100 text-red-700 dark:text-red-400', label: 'Toxic' },
  'fume hood': { bg: 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800', badge: 'bg-purple-100 text-purple-700 dark:text-purple-400', label: 'Fume Hood' },
  gloves: { bg: 'bg-cyan-50 border-cyan-200 dark:bg-cyan-900/20 dark:border-cyan-800', badge: 'bg-cyan-100 text-cyan-700 dark:text-cyan-300', label: 'Gloves' },
  timer: { bg: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800', badge: 'bg-indigo-100 text-indigo-700 dark:text-indigo-300', label: 'Timer' },
  sterile: { bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800', badge: 'bg-emerald-100 text-emerald-700 dark:text-emerald-300', label: 'Sterile' },
};

// ─── Step renderer (shared for preview and library card) ─────────────────────
export function RenderSteps({ steps, variables = [], values = {}, onValueChange }) {
  let stepNum = 0;
  return (
    <ol className="space-y-2">
      {steps.map((step, i) => {
        if (step.isSection) {
          // Section header — not a numbered step
          return (
            <li key={i} className="pt-2 pb-0.5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 pb-1">
                {step.text}
              </p>
            </li>
          );
        }
        stepNum++;
        const style = step.special ? SPECIAL_STYLES[step.special] : null;
        const marker = STEP_MARKERS.find(item => item.value === step.special);
        const MarkerIcon = marker?.Icon;
        const renderedStepText = renderVariableText(step.text, variables, values);
        const renderedSubsteps = (step.substeps || []).map(substep => renderVariableText(substep, variables, values));
        const renderedNote = renderVariableText(step.note, variables, values);
        const duration = getStepDuration([renderedStepText, ...renderedSubsteps, renderedNote || ''].join(' '));
        return (
          <li key={i} className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
            <span className="font-bold text-slate-500 dark:text-slate-400 w-5 flex-shrink-0 mt-0.5">{stepNum}.</span>
            <div className="flex-1 min-w-0">
              <span className="text-slate-700 dark:text-slate-200">
                <InlineVariableText text={step.text} variables={variables} values={values} onValueChange={onValueChange} />
              </span>
              {/* Substeps */}
              {step.substeps?.length > 0 && (
                <ul className="mt-2 space-y-1 pl-3 border-l-2 border-slate-200 dark:border-slate-600">
                  {step.substeps.map((sub, j) => (
                    <li key={j} className="text-xs text-slate-600 dark:text-slate-300 flex gap-1.5">
                      <span className="text-slate-400 flex-shrink-0">{String.fromCharCode(97 + j)}.</span>
                      <InlineVariableText text={sub} variables={variables} values={values} onValueChange={onValueChange} />
                    </li>
                  ))}
                </ul>
              )}
              {/* Note / side note */}
              {step.note && (
                <div className="mt-2 flex items-start gap-1.5 p-2 bg-white/60 dark:bg-slate-900/40 rounded border border-slate-200 dark:border-slate-700">
                  <Info className="w-3 h-3 text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                    <InlineVariableText text={step.note} variables={variables} values={values} onValueChange={onValueChange} />
                  </p>
                </div>
              )}
              {step.param && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(step.param.options || {}).map(([key, value]) => (
                    <span key={key} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      <span className="text-slate-400">{key}:</span> {value}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {(style || duration) && (
              <div className="flex flex-shrink-0 flex-col items-end gap-1">
                {style && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${style.badge}`}>
                    {MarkerIcon && <MarkerIcon className="h-3 w-3" />} {style.label}
                  </span>
                )}
                {duration && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                    <Clock3 className="h-3 w-3" /> {duration}
                  </span>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ─── Preview card (step 2) ────────────────────────────────────────────────────
function PreviewCard({ protocol, variables }) {
  const [calcVals, setCalcVals] = useState(
    Object.fromEntries(variables.map(v => [v.id, v.default]))
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className="font-semibold text-slate-800 dark:text-slate-100">{protocol.name || 'Naamloos protocol'}</span>
        <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 text-xs">Custom</Badge>
        {protocol.category && (
          <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs">{protocol.category}</Badge>
        )}
      </div>

      <RenderSteps
        steps={protocol.steps}
        variables={variables}
        values={calcVals}
        onValueChange={(id, value) => setCalcVals(current => ({ ...current, [id]: value }))}
      />
    </div>
  );
}

// ─── Main ProtocolBuilder ─────────────────────────────────────────────────────
export default function ProtocolBuilder({ onSave, onCancel, settings }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [rawText, setRawText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  // variables: each has isAiSuggestion flag
  const [variables, setVariables] = useState([]);
  const [protocolSteps, setProtocolSteps] = useState([]);
  const fileInputRef = useRef(null);

  // ── File upload ────────────────────────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const text = await readFileAsText(file);
      setRawText(text);
    } catch {
      setAiError('Could not read this file. Use a .txt or .md file.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // ── AI analysis (step 0 → 1) ───────────────────────────────────────────────
  const handleCreateProtocol = async () => {
    if (!rawText.trim()) { setAiError('Enter protocol text first.'); return; }
    setAiError('');
    setAiLoading(true);

    const prompt = `You are an expert molecular biology lab protocol analyst. Your task is to carefully read the following protocol text and convert it into a structured JSON format.

CRITICAL RULES for parsing:
1. TITLES and section headers are NOT steps. Mark them as {"isSection": true, "text": "Header name", "special": null, "substeps": [], "note": null}
2. Steps with SUBSTEPS: if a step has labeled sub-parts (a, b, c or i, ii, iii or bullet points nested under a main step), put the main action as "text" and the sub-parts as "substeps" array.
3. Do NOT create a separate step for every line. Read the full context first.
4. NOTES, side notes, tips, important remarks that aren't execution steps → put in the "note" field of the nearest step they belong to.
5. SAFETY/CAUTION/WARNING information → classify the step or the relevant step with special: "warning" or "toxic".
6. TEMPERATURE-related steps (incubate, heat, cool, centrifuge) → special: "temp"
7. ON ICE / cold steps (keep on ice, 4°C) → special: "ice"  
8. FUME HOOD steps → special: "fume hood"
9. TOXIC/hazardous steps → special: "toxic"
10. Do NOT copy titles, kit names, reagent lists, or introductory text as steps.
11. Read the protocol holistically — understand what is a phase/section title vs. an actual action step.

Return ONLY valid JSON:
{
  "steps": [
    {
      "text": "Main step description",
      "special": null,
      "isSection": false,
      "substeps": ["Sub-step a description", "Sub-step b description"],
      "note": "Optional note or side note for this step, or null"
    }
  ]
}

Protocol text to analyze:
${rawText}`;

    try {
      const result = await InvokeLLM({
        settings,
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            steps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  text: { type: 'string' },
                  special: { type: ['string', 'null'] },
                  isSection: { type: 'boolean' },
                  substeps: { type: 'array', items: { type: 'string' } },
                  note: { type: ['string', 'null'] },
                },
              },
            },
          },
        },
      });

      if (result && Array.isArray(result.steps) && result.steps.length > 0) {
        // Normalise steps
        const cleaned = result.steps.map(s => ({
          text: s.text || '',
          special: s.special || null,
          isSection: !!s.isSection,
          substeps: Array.isArray(s.substeps) ? s.substeps.filter(Boolean) : [],
          note: s.note || null,
        })).filter(s => s.text.trim());

        // When the source has explicit numbering, preserve that structure
        // deterministically. This prevents headings and nested bullets from
        // being promoted to standalone steps by an inconsistent AI response.
        const parsedSteps = hasExplicitProtocolStructure(rawText)
          ? parseStepsFromText(rawText)
          : cleaned;
        setProtocolSteps(parsedSteps);
        setVariables([]);
        setStep(1);
      } else {
        setProtocolSteps(parseStepsFromText(rawText));
        setVariables([]);
        setStep(1);
      }
    } catch {
      setProtocolSteps(parseStepsFromText(rawText));
      setVariables([]);
      setStep(1);
    } finally {
      setAiLoading(false);
    }
  };

  // ── Variable management ────────────────────────────────────────────────────
  const updateVariableById = (id, changes) => {
    setVariables(prev => prev.map(variable => variable.id === id ? { ...variable, ...changes } : variable));
  };

  const removeVariable = (idx) => {
    const variable = variables[idx];
    if (variable?.id) {
      const placeholder = `{{${variable.id}}}`;
      const restore = value => typeof value === 'string'
        ? value.split(placeholder).join(String(variable.default ?? ''))
        : value;
      setProtocolSteps(prev => prev.map(protocolStep => ({
        ...protocolStep,
        text: restore(protocolStep.text),
        substeps: (protocolStep.substeps || []).map(restore),
        note: restore(protocolStep.note),
      })));
    }
    setVariables(prev => prev.filter((_, i) => i !== idx));
  };

  const removeVariableById = id => {
    const index = variables.findIndex(variable => variable.id === id);
    if (index >= 0) removeVariable(index);
  };

  const makeNumberVariable = ({ stepIndex, value, target, substepIndex }) => {
    const sourceStep = protocolSteps[stepIndex];
    if (!sourceStep) return;

    const sourceText = target === 'substep'
      ? sourceStep.substeps?.[substepIndex] || ''
      : sourceStep[target] || sourceStep.text || '';
    const unit = inferUnit(sourceText, value);
    const baseId = `step${protocolSteps.slice(0, stepIndex + 1).filter(item => !item.isSection).length}Value`;
    let id = baseId;
    let suffix = 2;
    while (variables.some(variable => variable.id === id)) id = `${baseId}${suffix++}`;
    const placeholder = `{{${id}}}`;
    let linkedCount = 0;

    const bind = text => {
      const result = replaceNumericValue(text, value, placeholder);
      linkedCount += result.count;
      return result.text;
    };
    const updatedStep = {
      ...sourceStep,
      text: bind(sourceStep.text),
      substeps: (sourceStep.substeps || []).map(bind),
      note: bind(sourceStep.note),
    };
    if (linkedCount === 0) return;

    setProtocolSteps(prev => prev.map((protocolStep, index) => index === stepIndex ? updatedStep : protocolStep));
    setVariables(prev => [...prev, {
      id,
      label: unit ? `${unit} in step ${protocolSteps.slice(0, stepIndex + 1).filter(item => !item.isSection).length}` : `Value in step ${protocolSteps.slice(0, stepIndex + 1).filter(item => !item.isSection).length}`,
      default: value,
      unit,
      reason: `Linked to ${linkedCount} ${linkedCount === 1 ? 'value' : 'values'} in this step`,
      isAiSuggestion: false,
      isLinked: true,
    }]);
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = () => {
    const serializedSteps = JSON.stringify(protocolSteps);
    const calcFields = variables
      .filter(v => v.label && v.id && serializedSteps.includes(`{{${v.id}}}`))
      .map(({ isAiSuggestion: _isAiSuggestion, reason: _reason, ...rest }) => ({
        ...rest,
        default: rest.default || '0',
      }));

    const cleanedSteps = protocolSteps.filter(s => s.text?.trim());

    const protocol = {
      id: `custom-${Date.now()}`,
      name: name || 'Mijn Protocol',
      category: category || 'Custom',
      tags: ['custom', ...(name ? [name.toLowerCase().replace(/\s+/g, '-')] : [])],
      custom: true,
      steps: cleanedSteps,
      ...(calcFields.length > 0 ? {
        calcFields,
        calc: buildCalcFn(calcFields),
      } : {}),
    };

    onSave(protocol);
  };

  const buildCalcFn = (fields) => (vals) =>
    fields
      .filter(f => f.label)
      .map(f => `${f.label}: ${parseFloat(vals[f.id]) || 0}${f.unit ? ' ' + f.unit : ''}`)
      .join(' | ');

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow-sm">
          <Plus className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-slate-800 dark:text-slate-100">Add Protocol</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Create a custom protocol with AI-assisted structure detection</p>
        </div>
      </div>

      <StepBar current={step} />

      {/* ── Step 0: protocol input ───────────────────────────────────────── */}
      {step === 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Protocol name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. CRISPR Cas9 transfection"
                className="border-slate-200 dark:border-slate-700"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">Category</Label>
              <Input
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="e.g. DNA, Protein, Cell Culture..."
                className="border-slate-200 dark:border-slate-700"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Protocol text <span className="text-red-500">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.csv,.rtf"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 hover:border-teal-400 hover:text-teal-600 transition-colors"
                  title="Upload a .txt or .md file"
                >
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                  <span>{uploading ? 'Loading...' : 'Upload .txt / .md'}</span>
                </button>
              </div>
            </div>
            <textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder={`Paste your protocol text here, or upload a .txt file.\n\nExample:\nAgarose Gel Electrophoresis\n\nMaterials:\n- Agarose\n- 1× TAE buffer\n- Midori Green\n\n1. Weigh agarose and dissolve in 1× TAE buffer.\n   a. Heat in microwave until fully dissolved.\n   b. Swirl every 30 seconds. Do not boil over.\n2. Cool to ~55°C. Add Midori Green (1:2000).\n   NOTE: Do NOT use EtBr — Midori Green is non-mutagenic.\n3. Pour into sealed tray with comb...`}
              rows={14}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 p-3 resize-y focus:outline-none focus:ring-2 focus:ring-teal-400 placeholder:text-slate-300 dark:placeholder:text-slate-600 font-mono"
            />
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Tip: paste the complete protocol, including titles, notes, and warnings.
              The AI will organize its structure. For PDFs, copy and paste the text here.
            </p>
          </div>

          {aiError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {aiError}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <Button variant="ghost" onClick={onCancel} className="text-slate-500">
              Cancel
            </Button>
            <Button
              onClick={handleCreateProtocol}
              disabled={aiLoading || !rawText.trim() || !name.trim()}
              className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
            >
              {aiLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing protocol...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Create Protocol <ChevronRight className="w-4 h-4" /></>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 1: edit detected steps ─────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <StepsPreview
            steps={protocolSteps}
            variables={variables}
            onChange={setProtocolSteps}
            onMakeVariable={makeNumberVariable}
            onUpdateVariable={updateVariableById}
            onRemoveVariable={removeVariableById}
          />

          <div className="flex items-center justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep(0)} className="gap-1.5 text-slate-500">
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
            <Button
              onClick={() => setStep(2)}
              className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
            >
              See preview <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: preview and save ─────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl max-h-[60vh] overflow-y-auto">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Protocol preview
            </p>
            <PreviewCard
              protocol={{ name, category, steps: protocolSteps }}
              variables={variables.filter(v => v.label && v.id)}
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <Button variant="ghost" onClick={() => setStep(1)} className="gap-1.5 text-slate-500 w-full sm:w-auto">
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
            <Button
              variant="outline"
              onClick={() => setStep(0)}
              className="gap-1.5 w-full sm:w-auto border-slate-300 text-slate-600"
            >
              <Pencil className="w-4 h-4" /> Edit source text
            </Button>
            <Button
              onClick={handleSave}
              className="bg-teal-600 hover:bg-teal-700 text-white gap-2 w-full sm:w-auto sm:ml-auto"
            >
              <BookOpen className="w-4 h-4" /> Add to Library
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
