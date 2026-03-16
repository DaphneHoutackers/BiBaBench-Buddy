const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }), InvokeLLM:async()=>({}) } } };

import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart2, Play, Loader2, CheckCircle2, Info, ChevronDown, ChevronUp } from 'lucide-react';
import StatSVGChart from './stats/StatSVGChart';
import SpreadsheetGrid from './stats/SpreadsheetGrid';

const TESTS = [
  { id: 'auto', label: '🤖 Auto-select (AI recommended)' },
  { id: '__sep1__', label: '── Parametric ──', disabled: true },
  { id: 't_independent', label: "Welch's independent t-test" },
  { id: 't_student', label: "Student's t-test (equal variances)" },
  { id: 't_paired', label: 'Paired t-test' },
  { id: 't_onesample', label: 'One-sample t-test' },
  { id: 'anova_one', label: 'One-way ANOVA' },
  { id: 'anova_two', label: 'Two-way ANOVA' },
  { id: 'pearson', label: 'Pearson correlation' },
  { id: 'linear_regression', label: 'Linear regression' },
  { id: '__sep2__', label: '── Non-Parametric ──', disabled: true },
  { id: 'mann_whitney', label: 'Mann-Whitney U test' },
  { id: 'wilcoxon', label: 'Wilcoxon signed-rank test' },
  { id: 'kruskal_wallis', label: 'Kruskal-Wallis test' },
  { id: 'friedman', label: 'Friedman test' },
  { id: 'spearman', label: 'Spearman correlation' },
  { id: '__sep3__', label: '── Categorical ──', disabled: true },
  { id: 'chi_square', label: 'Chi-square test' },
  { id: 'fisher_exact', label: "Fisher's exact test" },
  { id: '__sep4__', label: '── Variance ──', disabled: true },
  { id: 'levene', label: "Levene's test" },
  { id: 'bartlett', label: "Bartlett's test" },
  { id: 'f_test', label: 'F-test (variance ratio)' },
];

const RESULT_SCHEMA = {
  type: 'object',
  properties: {
    descriptive: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          group: { type: 'string' },
          n: { type: 'number' },
          mean: { type: 'number' },
          sd: { type: 'number' },
          sem: { type: 'number' },
          median: { type: 'number' },
          q1: { type: 'number' },
          q3: { type: 'number' },
          min: { type: 'number' },
          max: { type: 'number' },
          ci95_lower: { type: 'number' },
          ci95_upper: { type: 'number' }
        }
      }
    },
    normality_tests: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          group: { type: 'string' },
          test: { type: 'string' },
          statistic: { type: 'number' },
          p_value: { type: 'number' },
          is_normal: { type: 'boolean' },
          note: { type: 'string' }
        }
      }
    },
    variance_test: {
      type: 'object',
      properties: {
        test: { type: 'string' },
        statistic: { type: 'number' },
        df1: { type: 'number' },
        df2: { type: 'number' },
        p_value: { type: 'number' },
        equal_variances: { type: 'boolean' }
      }
    },
    test_performed: { type: 'string' },
    test_reason: { type: 'string' },
    main_result: {
      type: 'object',
      properties: {
        statistic_name: { type: 'string' },
        statistic: { type: 'number' },
        df: { type: 'string' },
        p_value: { type: 'number' },
        significant: { type: 'boolean' },
        alpha: { type: 'number' }
      }
    },
    effect_size: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        value: { type: 'number' },
        interpretation: { type: 'string' }
      }
    },
    posthoc: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          comparison: { type: 'string' },
          p_value: { type: 'number' },
          adjusted_p: { type: 'number' },
          method: { type: 'string' },
          significant: { type: 'boolean' },
          stars: { type: 'string' }
        }
      }
    },
    recommendation: { type: 'string' },
    interpretation: { type: 'string' }
  }
};

function parseGroups(rows, headers, groupCol, valueCol) {
  const gIdx = headers.indexOf(groupCol);
  const vIdx = headers.indexOf(valueCol);
  if (gIdx === -1 || vIdx === -1) return {};
  const groups = {};
  rows.forEach(row => {
    const g = row[gIdx]?.trim();
    const v = parseFloat(row[vIdx]);
    if (g && !isNaN(v)) {
      if (!groups[g]) groups[g] = [];
      groups[g].push(v);
    }
  });
  return groups;
}

function fmt(n, d = 4) {
  if (n == null) return '—';
  if (Math.abs(n) < 0.001 && n !== 0) return n.toExponential(2);
  return Number(n).toFixed(d);
}

function pStars(p) {
  if (p < 0.001) return '***';
  if (p < 0.01) return '**';
  if (p < 0.05) return '*';
  return 'ns';
}

function NormalityRow({ r }) {
  return (
    <tr className="border-b border-slate-100 text-sm">
      <td className="py-2 px-3 font-medium text-slate-700">{r.group}</td>
      <td className="py-2 px-3 text-slate-500">{r.test}</td>
      <td className="py-2 px-3 font-mono text-center">{fmt(r.statistic, 4)}</td>
      <td className="py-2 px-3 font-mono text-center">{fmt(r.p_value, 4)}</td>
      <td className="py-2 px-3 text-center">
        <Badge className={r.is_normal ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
          {r.is_normal ? 'Normal' : 'Non-normal'}
        </Badge>
      </td>
    </tr>
  );
}

function ResultsDisplay({ results }) {
  const [showDetails, setShowDetails] = useState(true);
  const mr = results.main_result;
  const sig = mr?.significant;

  return (
    <div className="space-y-4">
      {/* Main result banner */}
      <div className={`p-4 rounded-xl border ${sig ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-start gap-3">
          {sig
            ? <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            : <Info className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />}
          <div className="flex-1">
            <p className="font-semibold text-slate-800">{results.test_performed}</p>
            <p className="text-sm text-slate-600 mt-0.5">{results.interpretation}</p>
          </div>
        </div>
        {mr && (
          <div className="mt-3 flex flex-wrap gap-3">
            <span className="px-3 py-1 bg-white rounded-lg border border-slate-200 text-sm font-mono">
              {mr.statistic_name} = {fmt(mr.statistic, 3)}
            </span>
            {mr.df && <span className="px-3 py-1 bg-white rounded-lg border border-slate-200 text-sm font-mono">df = {mr.df}</span>}
            <span className={`px-3 py-1 rounded-lg border text-sm font-mono font-bold ${sig ? 'bg-emerald-100 border-emerald-300 text-emerald-800' : 'bg-white border-slate-200 text-slate-700'}`}>
              p = {fmt(mr.p_value, 4)} {pStars(mr.p_value)}
            </span>
            {results.effect_size?.value != null && (
              <span className="px-3 py-1 bg-white rounded-lg border border-slate-200 text-sm font-mono">
                {results.effect_size.name} = {fmt(results.effect_size.value, 3)} ({results.effect_size.interpretation})
              </span>
            )}
          </div>
        )}
      </div>

      {results.test_reason && (
        <div className="flex items-start gap-2 text-sm text-slate-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
          <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <span><strong>Test selection:</strong> {results.test_reason}</span>
        </div>
      )}

      {/* Toggle detailed stats */}
      <button onClick={() => setShowDetails(s => !s)}
        className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-800">
        {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        Detailed Statistics
      </button>

      {showDetails && (
        <div className="space-y-4">
          {/* Descriptive */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Descriptive Statistics</p>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Group', 'n', 'Mean', 'SD', 'SEM', 'Median', 'Q1', 'Q3', 'Min', 'Max', '95% CI'].map(h => (
                      <th key={h} className="text-left py-2 px-3 font-semibold text-slate-600 text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.descriptive?.map((d, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="py-2 px-3 font-medium">{d.group}</td>
                      <td className="py-2 px-3 font-mono">{d.n}</td>
                      <td className="py-2 px-3 font-mono">{fmt(d.mean, 3)}</td>
                      <td className="py-2 px-3 font-mono">{fmt(d.sd, 3)}</td>
                      <td className="py-2 px-3 font-mono">{fmt(d.sem, 3)}</td>
                      <td className="py-2 px-3 font-mono">{fmt(d.median, 3)}</td>
                      <td className="py-2 px-3 font-mono">{fmt(d.q1, 3)}</td>
                      <td className="py-2 px-3 font-mono">{fmt(d.q3, 3)}</td>
                      <td className="py-2 px-3 font-mono">{fmt(d.min, 3)}</td>
                      <td className="py-2 px-3 font-mono">{fmt(d.max, 3)}</td>
                      <td className="py-2 px-3 font-mono text-xs">[{fmt(d.ci95_lower, 3)}, {fmt(d.ci95_upper, 3)}]</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Normality */}
          {results.normality_tests?.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Normality Tests</p>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Group', 'Test', 'Statistic', 'p-value', 'Result'].map(h => (
                        <th key={h} className="text-left py-2 px-3 font-semibold text-slate-600 text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.normality_tests.map((r, i) => <NormalityRow key={i} r={r} />)}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Variance test */}
          {results.variance_test?.test && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Variance Homogeneity</p>
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-sm flex flex-wrap gap-4">
                <span><strong>{results.variance_test.test}</strong></span>
                <span className="font-mono">F = {fmt(results.variance_test.statistic, 3)}</span>
                {results.variance_test.df1 && <span className="font-mono">df = ({results.variance_test.df1}, {results.variance_test.df2})</span>}
                <span className="font-mono">p = {fmt(results.variance_test.p_value, 4)}</span>
                <Badge className={results.variance_test.equal_variances ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                  {results.variance_test.equal_variances ? 'Equal variances' : 'Unequal variances'}
                </Badge>
              </div>
            </div>
          )}

          {/* Post-hoc */}
          {results.posthoc?.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Post-hoc Comparisons</p>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Comparison', 'p-value', 'Adjusted p', 'Method', 'Significance'].map(h => (
                        <th key={h} className="text-left py-2 px-3 font-semibold text-slate-600 text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.posthoc.map((r, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="py-2 px-3 font-medium">{r.comparison}</td>
                        <td className="py-2 px-3 font-mono">{fmt(r.p_value, 4)}</td>
                        <td className="py-2 px-3 font-mono">{fmt(r.adjusted_p, 4)}</td>
                        <td className="py-2 px-3 text-slate-500">{r.method || '—'}</td>
                        <td className="py-2 px-3">
                          <span className={`font-bold text-lg ${r.significant ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {r.stars || pStars(r.adjusted_p ?? r.p_value)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function StatisticsAnalyzer() {
  const [rawText, setRawText] = useState('');
  const [hasHeader, setHasHeader] = useState(true);
  const [parsedData, setParsedData] = useState(null);
  const [colTypes, setColTypes] = useState([]);
  const [groupCol, setGroupCol] = useState('');
  const [valueCol, setValueCol] = useState('');
  const [selectedTest, setSelectedTest] = useState('auto');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [colors, setColors] = useState({});
  const [activeTab, setActiveTab] = useState('data');

  const parseDataFromText = (text) => {
    const lines = (text || rawText).trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) return;
    const rows = lines.map(l => l.split('\t').map(c => c.trim()));
    const maxCols = Math.max(...rows.map(r => r.length));
    let headers, dataRows;
    if (hasHeader) {
      headers = rows[0].map((h, i) => h || `Col${i + 1}`);
      dataRows = rows.slice(1);
    } else {
      headers = Array.from({ length: maxCols }, (_, i) => `Col${i + 1}`);
      dataRows = rows;
    }
    const types = headers.map((_, ci) => {
      const vals = dataRows.map(r => r[ci]).filter(v => v);
      const numCount = vals.filter(v => !isNaN(parseFloat(v))).length;
      return numCount / vals.length > 0.7 ? 'numeric' : 'categorical';
    });
    setColTypes(types);
    setParsedData({ headers, rows: dataRows });
    const catCols = headers.filter((_, i) => types[i] === 'categorical');
    const numCols = headers.filter((_, i) => types[i] === 'numeric');
    if (catCols.length > 0) setGroupCol(catCols[0]);
    if (numCols.length > 0) setValueCol(numCols[0]);
    setResults(null);
    setActiveTab('config');
  };

  const analyze = async () => {
    if (!parsedData || !groupCol || !valueCol) return;
    setLoading(true);
    setResults(null);

    const groups = parseGroups(parsedData.rows, parsedData.headers, groupCol, valueCol);
    const groupSummary = Object.entries(groups)
      .map(([name, vals]) => `  "${name}": [${vals.join(', ')}]`)
      .join('\n');

    const testInstruction = selectedTest === 'auto'
      ? 'automatically select the most appropriate statistical test based on the data characteristics (n, normality, variance homogeneity, number of groups)'
      : `perform the following test: ${TESTS.find(t => t.id === selectedTest)?.label || selectedTest}`;

    const prompt = `You are an expert biostatistician performing rigorous statistical analysis. ${testInstruction}.

DATASET:
Group variable: "${groupCol}"
Value variable: "${valueCol}"
Groups and raw values:
${groupSummary}

Please perform the following analysis steps:
1. Calculate complete descriptive statistics for each group (n, mean, SD, SEM, median, Q1, Q3, min, max, 95% CI)
2. Shapiro-Wilk normality test for each group — compute the actual W statistic and p-value numerically
3. Levene's test for homogeneity of variances
4. The main statistical test (with full test statistics, degrees of freedom, exact p-value)
5. Post-hoc tests with correction if applicable (Tukey HSD for ANOVA, Bonferroni for others)
6. Effect size with interpretation (Cohen's d, η², r, etc. depending on test)
7. Provide plain-language interpretation

Return EXACT numeric values — not approximations like ">0.05". Calculate actual p-values.`;

    const result = await db.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: RESULT_SCHEMA,
      model: 'claude_sonnet_4_6'
    });

    const defaultColors = ['#4f86c6', '#e8734a', '#6bbf6a', '#c77dcc', '#f0c040', '#7ecece', '#e87e9e'];
    const newColors = {};
    result.descriptive?.forEach((g, i) => {
      newColors[g.group] = colors[g.group] || defaultColors[i % defaultColors.length];
    });
    setColors(newColors);

    const rawGroups = parseGroups(parsedData.rows, parsedData.headers, groupCol, valueCol);
    setResults({ ...result, rawGroups, valueLabel: valueCol, groupLabel: groupCol });
    setLoading(false);
    setActiveTab('results');
  };

  const numericCols = parsedData?.headers.filter((_, i) => colTypes[i] === 'numeric') || [];
  const catCols = parsedData?.headers.filter((_, i) => colTypes[i] === 'categorical') || [];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white">
          <BarChart2 className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Statistics Analyzer</h2>
          <p className="text-sm text-slate-500">Normality testing, statistical tests, effect sizes & publication-ready figures</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-lg">
          <TabsTrigger value="data">1. Data</TabsTrigger>
          <TabsTrigger value="config" disabled={!parsedData}>2. Configure</TabsTrigger>
          <TabsTrigger value="results" disabled={!results}>3. Results & Figure</TabsTrigger>
        </TabsList>

        {/* ── Step 1: Data ── */}
        <TabsContent value="data" className="mt-4">
          <Card className="border-0 shadow-sm bg-white/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium text-slate-700">Voer data in</CardTitle>
            </CardHeader>
            <CardContent>
              <SpreadsheetGrid onDataReady={(text) => { setRawText(text); parseDataFromText(text); }} />
              {parsedData && (
                <div className="mt-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Ingeladen: {parsedData.rows.length} rijen × {parsedData.headers.length} kolommen — ga naar stap 2
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Step 2: Configure ── */}
        <TabsContent value="config" className="mt-4">
          {parsedData && (
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="border-0 shadow-sm bg-white/80">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium text-slate-700">Column Types</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {parsedData.headers.map((h, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                        <span className="font-medium text-slate-700 text-sm">{h}</span>
                        <Select value={colTypes[i]} onValueChange={v => {
                          const newTypes = [...colTypes];
                          newTypes[i] = v;
                          setColTypes(newTypes);
                        }}>
                          <SelectTrigger className="w-32 h-7 text-xs border-slate-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="numeric">Numeric</SelectItem>
                            <SelectItem value="categorical">Categorical</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm bg-white/80">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium text-slate-700">Analysis Setup</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600">Group variable (categorical)</Label>
                    <Select value={groupCol} onValueChange={setGroupCol}>
                      <SelectTrigger className="border-slate-200">
                        <SelectValue placeholder="Select group column" />
                      </SelectTrigger>
                      <SelectContent>
                        {catCols.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600">Value variable (numeric)</Label>
                    <Select value={valueCol} onValueChange={setValueCol}>
                      <SelectTrigger className="border-slate-200">
                        <SelectValue placeholder="Select value column" />
                      </SelectTrigger>
                      <SelectContent>
                        {numericCols.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600">Statistical test</Label>
                    <Select value={selectedTest} onValueChange={setSelectedTest}>
                      <SelectTrigger className="border-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TESTS.map(t => (
                          <SelectItem key={t.id} value={t.id} disabled={t.disabled || t.id.startsWith('__sep')}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={analyze}
                    disabled={loading || !groupCol || !valueCol}
                    className="w-full bg-violet-600 hover:bg-violet-700"
                  >
                    {loading
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing…</>
                      : <><Play className="w-4 h-4 mr-2" /> Run Analysis</>}
                  </Button>
                  {loading && (
                    <p className="text-xs text-slate-500 text-center">
                      Calculating normality, variance tests & running {selectedTest === 'auto' ? 'auto-selected' : 'chosen'} test…
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ── Step 3: Results & Figure ── */}
        <TabsContent value="results" className="mt-4">
          {results && (
            <div className="space-y-6">
              <ResultsDisplay results={results} />
              <StatSVGChart
                descriptive={results.descriptive}
                posthoc={results.posthoc}
                rawGroups={results.rawGroups}
                valueLabel={results.valueLabel}
                colors={colors}
                setColors={setColors}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}