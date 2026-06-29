const SECTION_PATTERN = /^\s*([A-Z])\s*[).:-]\s*(\S.*)$/;
const NUMBERED_STEP_PATTERN = /^\s*(\d+)\s*[.)]\s*(\S.*)$/;
const ALPHA_SUBSTEP_PATTERN = /^\s*([a-z]|[ivxlcdm]+)\s*[.)]\s+(\S.*)$/i;
const SYMBOL_BULLET_PATTERN = /^\s*[-*•●▪◦·]\s+(\S.*)$/;
const O_BULLET_PATTERN = /^\s*o\s+(\S.*)$/i;
const NOTE_PATTERN = /^\s*(?:note|notes|tip|remark|important)\s*[:.-]\s*(\S.*)$/i;

function inferSpecial(text) {
  const lower = text.toLowerCase();
  if (/\btoxic\b|\bhazardous\b|\bcarcinogen\b/.test(lower)) return 'toxic';
  if (/\bfume hood\b/.test(lower)) return 'fume hood';
  if (/\bwarning\b|\bcaution\b|\bgloves?\b|\bhazard\b/.test(lower)) return 'warning';
  if (/\bon ice\b|\bice-cold\b|\b4\s*°?c\b|\bfreeze\b|\bfrozen\b/.test(lower)) return 'ice';
  if (/\d+(?:[.,]\d+)?\s*°c\b|\bincubat(?:e|ion)\b|\bheat\b|\bcool\b|\bcentrifug(?:e|ation)\b/.test(lower)) return 'temp';
  return null;
}

function makeStep(text) {
  return { text: text.trim(), special: null, isSection: false, substeps: [], note: null };
}

function setInferredSpecial(step) {
  if (step.isSection) return step;
  const searchable = [step.text, ...(step.substeps || []), step.note || ''].join(' ');
  return { ...step, special: inferSpecial(searchable) };
}

export function hasExplicitProtocolStructure(raw = '') {
  return raw.split(/\r?\n/).some(line => NUMBERED_STEP_PATTERN.test(line));
}

/**
 * Parses common pasted protocol formatting without depending on an LLM:
 * - A), B), ... are section headings
 * - 1., 2), ... are executable steps
 * - bullets and lettered items below a step are substeps
 * - indented wrapped lines continue the preceding item
 */
export function parseProtocolText(raw = '') {
  const sourceLines = raw.replace(/\r\n?/g, '\n').split('\n');
  const hasNumberedSteps = hasExplicitProtocolStructure(raw);

  if (!hasNumberedSteps) {
    return sourceLines
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const text = line.replace(/^[-*•●▪◦·]\s*/, '').trim();
        return setInferredSpecial(makeStep(text));
      });
  }

  const steps = [];
  let currentStep = null;
  let lastItemWasSubstep = false;

  for (const rawLine of sourceLines) {
    if (!rawLine.trim()) {
      lastItemWasSubstep = false;
      continue;
    }

    const sectionMatch = rawLine.match(SECTION_PATTERN);
    if (sectionMatch) {
      steps.push({
        text: `${sectionMatch[1]}) ${sectionMatch[2].trim()}`,
        special: null,
        isSection: true,
        substeps: [],
        note: null,
      });
      currentStep = null;
      lastItemWasSubstep = false;
      continue;
    }

    const numberedMatch = rawLine.match(NUMBERED_STEP_PATTERN);
    if (numberedMatch) {
      currentStep = makeStep(numberedMatch[2]);
      steps.push(currentStep);
      lastItemWasSubstep = false;
      continue;
    }

    const noteMatch = rawLine.match(NOTE_PATTERN);
    if (noteMatch && currentStep) {
      currentStep.note = currentStep.note
        ? `${currentStep.note} ${noteMatch[1].trim()}`
        : noteMatch[1].trim();
      lastItemWasSubstep = false;
      continue;
    }

    const bulletMatch = rawLine.match(O_BULLET_PATTERN)
      || rawLine.match(SYMBOL_BULLET_PATTERN)
      || rawLine.match(ALPHA_SUBSTEP_PATTERN);
    if (bulletMatch && currentStep) {
      const text = bulletMatch[bulletMatch.length - 1].trim();
      currentStep.substeps.push(text);
      lastItemWasSubstep = true;
      continue;
    }

    // Pasted text often wraps a long step or substep onto an indented line.
    if (currentStep && /^\s+/.test(rawLine)) {
      const continuation = rawLine.trim();
      if (lastItemWasSubstep && currentStep.substeps.length > 0) {
        const last = currentStep.substeps.length - 1;
        currentStep.substeps[last] = `${currentStep.substeps[last]} ${continuation}`;
      } else {
        currentStep.text = `${currentStep.text} ${continuation}`;
      }
      continue;
    }

    // Unnumbered preamble/material lists are intentionally not execution steps.
    lastItemWasSubstep = false;
  }

  return steps.map(setInferredSpecial);
}
