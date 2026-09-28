import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const historyContext = readFileSync(
  new URL('../context/HistoryContext.jsx', import.meta.url),
  'utf8'
);
const plasmidAnalyzer = readFileSync(
  new URL('../components/calculators/PlasmidAnalyzer.jsx', import.meta.url),
  'utf8'
);

test('history sync has no interval polling or wildcard selects', () => {
  assert.doesNotMatch(historyContext, /setInterval\s*\(/);
  assert.doesNotMatch(historyContext, /\.select\(['"]\*['"]\)/);
});

test('history provider creates one realtime channel and applies events incrementally', () => {
  assert.equal([...historyContext.matchAll(/supabase\.channel\(`tool-history-/g)].length, 1);
  const eventHandler = historyContext.slice(
    historyContext.indexOf('const applyChange = payload =>'),
    historyContext.indexOf('const channel = supabase.channel')
  );
  assert.match(eventHandler, /applyRemoteHistoryChange/);
  assert.doesNotMatch(eventHandler, /loadRemoteHistory/);
  assert.match(historyContext, /addEventListener\('online', onOnline\)/);
  assert.match(historyContext, /addEventListener\('focus', onFocus\)/);
  assert.match(historyContext, /addEventListener\('visibilitychange', onVisibility\)/);
});

test('sequence library is requested only from the active Sequence Analyzer', () => {
  assert.match(plasmidAnalyzer, /if \(user && isActive\) loadSequenceLibrary\(\)/);
  assert.match(historyContext, /\.eq\('toolid', '__seq_analyzer_library__'\)[\s\S]*?\.limit\(1\)/);
});
