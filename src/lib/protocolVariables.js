export function renderVariableText(text, variables = [], values = {}) {
  if (!text) return text;
  const byId = Object.fromEntries(variables.map(variable => [variable.id, variable]));
  return text.replace(/\{\{([\w-]+)\}\}/g, (match, id) => {
    const variable = byId[id];
    if (!variable) return match;
    return String(values[id] ?? variable.default ?? '');
  });
}

export function replaceNumericValue(text, value, replacement) {
  if (!text) return { text, count: 0 };
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(^|[^\\d.,])(${escaped})(?![\\d.,])`, 'g');
  let count = 0;
  const next = text.replace(pattern, (_, prefix) => {
    count++;
    return `${prefix}${replacement}`;
  });
  return { text: next, count };
}

export function inferUnit(text, value) {
  const index = text.indexOf(value);
  if (index < 0) return '';
  const after = text.slice(index + value.length);
  const match = after.match(/^\s*(×g|xg|°C|µL|uL|mL|L|µm|um|mm|nm|mM|µM|nM|M|mg|µg|ug|ng|h(?:ours?)?|min(?:utes?)?|sec(?:onds?)?|s|%)(?=\b|\s|[,.)]|$)/i);
  return match?.[1] || '';
}

function durationToSeconds(value, unit) {
  const normalizedUnit = unit.toLowerCase();
  if (/^h/.test(normalizedUnit)) return value * 3600;
  if (/^m/.test(normalizedUnit)) return value * 60;
  return value;
}

export function getStepDuration(text = '') {
  if (!text) return null;
  const range = text.match(/(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|min|seconds?|secs?|sec|s)\b/i);
  if (range) {
    const unit = /^h/i.test(range[3]) ? 'h' : /^m/i.test(range[3]) ? 'min' : 'sec';
    return `${range[1]}–${range[2]} ${unit}`;
  }

  let totalSeconds = 0;
  let found = false;
  const repetitionPattern = /(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|min|seconds?|secs?|sec|s)\b/gi;
  const withoutRepetitions = text.replace(repetitionPattern, (_, count, duration, unit) => {
    totalSeconds += Number(count) * durationToSeconds(Number(duration.replace(',', '.')), unit);
    found = true;
    return ' ';
  });

  const durationPattern = /(\d+(?:[.,]\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|min|seconds?|secs?|sec|s)\b/gi;
  for (const match of withoutRepetitions.matchAll(durationPattern)) {
    totalSeconds += durationToSeconds(Number(match[1].replace(',', '.')), match[2]);
    found = true;
  }

  if (!found) return /\bovernight\b/i.test(text) ? 'Overnight' : null;
  if (totalSeconds < 60) return `${Number(totalSeconds.toFixed(1))} sec`;
  return `${Number((totalSeconds / 60).toFixed(1))} min`;
}
