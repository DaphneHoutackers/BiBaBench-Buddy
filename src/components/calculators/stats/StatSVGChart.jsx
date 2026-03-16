import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Download, Copy, Check, BarChart2 } from 'lucide-react';

function pStars(p) {
  if (p == null) return '';
  if (p < 0.001) return '***';
  if (p < 0.01) return '**';
  if (p < 0.05) return '*';
  return 'ns';
}

const CHART_TYPES = [
  { id: 'bar', label: 'Bar chart (mean ± SEM)' },
  { id: 'box', label: 'Box plot' },
  { id: 'dot', label: 'Dot plot (all data points)' },
  { id: 'violin', label: 'Bar + dots (scatter overlay)' },
];

const PADDING = { top: 60, right: 40, bottom: 80, left: 65 };
const W = 560, H = 380;
const PLOT_W = W - PADDING.left - PADDING.right;
const PLOT_H = H - PADDING.top - PADDING.bottom;

function buildSVGString(svgEl) {
  if (!svgEl) return '';
  const clone = svgEl.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return new XMLSerializer().serializeToString(clone);
}

export default function StatSVGChart({ descriptive, posthoc, rawGroups, valueLabel, colors, setColors }) {
  const [chartType, setChartType] = useState('bar');
  const [copied, setCopied] = useState(false);
  const svgRef = useRef(null);

  if (!descriptive?.length) return null;

  const groups = descriptive.map(d => d.group);
  const nGroups = groups.length;
  const barW = Math.min(60, (PLOT_W - 20) / nGroups * 0.5);
  const step = PLOT_W / nGroups;

  // Y scale
  const allValues = descriptive.flatMap(d => [d.mean + d.sd * 1.5, d.min, d.max, d.q3, d.q1, d.mean - d.sd * 1.5]).filter(v => v != null);
  if (rawGroups) Object.values(rawGroups).flat().forEach(v => allValues.push(v));
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const range = rawMax - rawMin || 1;
  const yMin = rawMin - range * 0.08;
  const yMax = rawMax + range * 0.22; // room for significance bars
  const toY = v => PLOT_H - ((v - yMin) / (yMax - yMin)) * PLOT_H;

  // Tick values
  const nTicks = 5;
  const ticks = Array.from({ length: nTicks + 1 }, (_, i) => yMin + (i / nTicks) * (yMax - yMin));

  // Significance bracket pairs
  const sigPairs = (posthoc || []).filter(p => {
    const a = p.adjusted_p ?? p.p_value;
    return a != null;
  }).map(p => {
    const comps = p.comparison.split(/\s+vs\.?\s+/i);
    return { a: comps[0]?.trim(), b: comps[1]?.trim(), stars: p.stars || pStars(p.adjusted_p ?? p.p_value), sig: p.significant };
  }).filter(p => p.a && p.b && groups.includes(p.a) && groups.includes(p.b));

  const xOf = (group) => PADDING.left + groups.indexOf(group) * step + step / 2;

  // Build SVG element paths per chart type
  const renderChartContent = () => {
    const elements = [];

    groups.forEach((g, gi) => {
      const d = descriptive[gi];
      const cx = PADDING.left + gi * step + step / 2;
      const color = colors[g] || '#4f86c6';
      const raw = rawGroups?.[g] || [];

      if (chartType === 'bar') {
        const barH = Math.abs(toY(d.mean) - toY(0 > yMin ? 0 : yMin));
        const y0 = Math.min(toY(d.mean), toY(0 > yMin ? 0 : yMin));
        elements.push(
          <rect key={`bar-${gi}`} x={cx - barW / 2} y={PADDING.top + toY(d.mean)} width={barW} height={PLOT_H - toY(d.mean)} fill={color} rx="2" data-group={g} className="bar" />,
          // SEM
          <line key={`sem-top-${gi}`} x1={cx} y1={PADDING.top + toY(d.mean + (d.sem || 0))} x2={cx} y2={PADDING.top + toY(d.mean - (d.sem || 0))} stroke="#333" strokeWidth="1.5" />,
          <line key={`sem-cap-t-${gi}`} x1={cx - 5} y1={PADDING.top + toY(d.mean + (d.sem || 0))} x2={cx + 5} y2={PADDING.top + toY(d.mean + (d.sem || 0))} stroke="#333" strokeWidth="1.5" />,
          <line key={`sem-cap-b-${gi}`} x1={cx - 5} y1={PADDING.top + toY(d.mean - (d.sem || 0))} x2={cx + 5} y2={PADDING.top + toY(d.mean - (d.sem || 0))} stroke="#333" strokeWidth="1.5" />
        );
      } else if (chartType === 'box') {
        const q1y = PADDING.top + toY(d.q1);
        const q3y = PADDING.top + toY(d.q3);
        const medy = PADDING.top + toY(d.median);
        const maxy = PADDING.top + toY(d.max);
        const miny = PADDING.top + toY(d.min);
        elements.push(
          <rect key={`box-${gi}`} x={cx - barW / 2} y={q3y} width={barW} height={q1y - q3y} fill={color} fillOpacity="0.6" stroke={color} strokeWidth="1.5" rx="2" />,
          <line key={`med-${gi}`} x1={cx - barW / 2} y1={medy} x2={cx + barW / 2} y2={medy} stroke={color} strokeWidth="2.5" />,
          <line key={`whisker-top-${gi}`} x1={cx} y1={q3y} x2={cx} y2={maxy} stroke={color} strokeWidth="1.5" strokeDasharray="3,2" />,
          <line key={`whisker-bot-${gi}`} x1={cx} y1={q1y} x2={cx} y2={miny} stroke={color} strokeWidth="1.5" strokeDasharray="3,2" />,
          <line key={`cap-top-${gi}`} x1={cx - barW * 0.3} y1={maxy} x2={cx + barW * 0.3} y2={maxy} stroke={color} strokeWidth="1.5" />,
          <line key={`cap-bot-${gi}`} x1={cx - barW * 0.3} y1={miny} x2={cx + barW * 0.3} y2={miny} stroke={color} strokeWidth="1.5" />
        );
      } else if (chartType === 'dot') {
        raw.forEach((v, vi) => {
          const jitter = (vi % 5 - 2) * 5;
          elements.push(
            <circle key={`dot-${gi}-${vi}`} cx={cx + jitter} cy={PADDING.top + toY(v)} r="4" fill={color} fillOpacity="0.75" stroke="white" strokeWidth="1" />
          );
        });
        // mean line
        elements.push(
          <line key={`mean-${gi}`} x1={cx - barW / 2} y1={PADDING.top + toY(d.mean)} x2={cx + barW / 2} y2={PADDING.top + toY(d.mean)} stroke={color} strokeWidth="2.5" />
        );
      } else if (chartType === 'violin') {
        // bar + dots overlay
        elements.push(
          <rect key={`bar-${gi}`} x={cx - barW / 2} y={PADDING.top + toY(d.mean)} width={barW} height={PLOT_H - toY(d.mean)} fill={color} fillOpacity="0.5" rx="2" />
        );
        raw.forEach((v, vi) => {
          const jitter = (vi % 7 - 3) * 4;
          elements.push(
            <circle key={`dot-${gi}-${vi}`} cx={cx + jitter} cy={PADDING.top + toY(v)} r="3.5" fill={color} stroke="white" strokeWidth="1" />
          );
        });
        elements.push(
          <line key={`sem-top-${gi}`} x1={cx} y1={PADDING.top + toY(d.mean + (d.sem || 0))} x2={cx} y2={PADDING.top + toY(d.mean - (d.sem || 0))} stroke="#333" strokeWidth="2" />,
          <line key={`sem-cap-t-${gi}`} x1={cx - 5} y1={PADDING.top + toY(d.mean + (d.sem || 0))} x2={cx + 5} y2={PADDING.top + toY(d.mean + (d.sem || 0))} stroke="#333" strokeWidth="1.5" />,
          <line key={`sem-cap-b-${gi}`} x1={cx - 5} y1={PADDING.top + toY(d.mean - (d.sem || 0))} x2={cx + 5} y2={PADDING.top + toY(d.mean - (d.sem || 0))} stroke="#333" strokeWidth="1.5" />
        );
      }
    });
    return elements;
  };

  // Significance brackets
  let bracketLevel = {};
  const renderBrackets = () => {
    return sigPairs.map((pair, i) => {
      const x1 = xOf(pair.a), x2 = xOf(pair.b);
      const key = `${pair.a}__${pair.b}`;
      const level = (bracketLevel[key] || 0);
      bracketLevel[key] = level + 1;
      const bracketY = PADDING.top + 8 + level * 18;
      const color = pair.sig ? '#1a1a2e' : '#aaa';
      return (
        <g key={`bracket-${i}`} className="significance">
          <line x1={x1} y1={bracketY + 8} x2={x1} y2={bracketY} stroke={color} strokeWidth="1.2" />
          <line x1={x1} y1={bracketY} x2={x2} y2={bracketY} stroke={color} strokeWidth="1.2" />
          <line x1={x2} y1={bracketY} x2={x2} y2={bracketY + 8} stroke={color} strokeWidth="1.2" />
          <text x={(x1 + x2) / 2} y={bracketY - 3} textAnchor="middle" fontSize="11" fill={color} fontWeight="600">{pair.stars}</text>
        </g>
      );
    });
  };

  const downloadSVG = () => {
    const svg = buildSVGString(svgRef.current);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'statistics_figure.svg';
    a.click();
  };

  const copySVG = () => {
    const svg = buildSVGString(svgRef.current);
    navigator.clipboard.writeText(svg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-0 shadow-sm bg-white/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium text-slate-700 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-violet-500" /> Figure
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-600">Chart type</Label>
            <Select value={chartType} onValueChange={setChartType}>
              <SelectTrigger className="w-52 border-slate-200 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHART_TYPES.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 flex-wrap">
            {groups.map(g => (
              <div key={g} className="flex items-center gap-1.5 text-xs">
                <label className="text-slate-600 font-medium">{g}:</label>
                <input
                  type="color"
                  value={colors[g] || '#4f86c6'}
                  onChange={e => setColors(c => ({ ...c, [g]: e.target.value }))}
                  className="h-7 w-8 rounded cursor-pointer border border-slate-200"
                />
              </div>
            ))}
          </div>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={copySVG} className="gap-1.5 h-8">
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy SVG'}
            </Button>
            <Button size="sm" onClick={downloadSVG} className="gap-1.5 h-8 bg-violet-600 hover:bg-violet-700">
              <Download className="w-3.5 h-3.5" /> Download SVG
            </Button>
          </div>
        </div>

        {/* SVG figure */}
        <div className="overflow-x-auto">
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ fontFamily: 'Helvetica, Arial, sans-serif', background: 'white', display: 'block', maxWidth: '100%' }}>
            {/* Background */}
            <rect x="0" y="0" width={W} height={H} fill="white" id="background" />

            {/* Y axis ticks & grid */}
            <g id="yaxis">
              {ticks.map((v, i) => {
                const y = PADDING.top + toY(v);
                const label = Math.abs(v) >= 1000 ? v.toExponential(1) : Number(v.toFixed(3)).toString();
                return (
                  <g key={i}>
                    <line x1={PADDING.left} y1={y} x2={PADDING.left + PLOT_W} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                    <line x1={PADDING.left - 4} y1={y} x2={PADDING.left} y2={y} stroke="#555" strokeWidth="1" />
                    <text x={PADDING.left - 7} y={y + 4} textAnchor="end" fontSize="10" fill="#555">{label}</text>
                  </g>
                );
              })}
            </g>

            {/* Axes */}
            <g id="axes">
              <line x1={PADDING.left} y1={PADDING.top} x2={PADDING.left} y2={PADDING.top + PLOT_H} stroke="#333" strokeWidth="1.5" />
              <line x1={PADDING.left} y1={PADDING.top + PLOT_H} x2={PADDING.left + PLOT_W} y2={PADDING.top + PLOT_H} stroke="#333" strokeWidth="1.5" />
            </g>

            {/* Y label */}
            <text
              transform={`translate(${16}, ${PADDING.top + PLOT_H / 2}) rotate(-90)`}
              textAnchor="middle" fontSize="12" fill="#333" fontWeight="600" id="ylabel"
            >
              {valueLabel}
            </text>

            {/* X labels */}
            <g id="xlabels">
              {groups.map((g, gi) => {
                const cx = PADDING.left + gi * step + step / 2;
                return (
                  <text key={gi} x={cx} y={PADDING.top + PLOT_H + 20} textAnchor="middle" fontSize="11" fill="#333" fontWeight="500">{g}</text>
                );
              })}
            </g>

            {/* Chart content */}
            <g id="chart-content">
              {renderChartContent()}
            </g>

            {/* Significance brackets */}
            <g id="significance-brackets">
              {renderBrackets()}
            </g>

            {/* Legend */}
            <g id="legend" transform={`translate(${PADDING.left}, ${H - 20})`}>
              {groups.map((g, i) => (
                <g key={i} transform={`translate(${i * 100}, 0)`}>
                  <rect x="0" y="-8" width="10" height="10" fill={colors[g] || '#4f86c6'} rx="2" />
                  <text x="13" y="0" fontSize="10" fill="#555">{g}</text>
                </g>
              ))}
            </g>
          </svg>
        </div>
        <p className="text-xs text-slate-400 text-center">
          SVG exports with separate layers per element — editable in Inkscape / Adobe Illustrator
        </p>
      </CardContent>
    </Card>
  );
}