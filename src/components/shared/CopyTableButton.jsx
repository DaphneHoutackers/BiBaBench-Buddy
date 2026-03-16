import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Copy, Check } from 'lucide-react';

// Copies data as an HTML table to clipboard (pastes as table in Word/Notion/etc)
export function copyAsHtmlTable(rows) {
  const html = `<table border="1" style="border-collapse:collapse;font-family:monospace">` +
    rows.map((row, ri) =>
      `<tr>${row.map(cell =>
        ri === 0
          ? `<th style="padding:4px 8px;background:#f1f5f9;font-weight:600">${cell}</th>`
          : `<td style="padding:4px 8px">${cell}</td>`
      ).join('')}</tr>`
    ).join('') +
    `</table>`;

  const text = rows.map(r => r.join('\t')).join('\n');

  const blob = new Blob(
    [`<html><body>${html}</body></html>`],
    { type: 'text/html' }
  );
  const textBlob = new Blob([text], { type: 'text/plain' });

  if (window.ClipboardItem) {
    const item = new window.ClipboardItem({
      'text/html': blob,
      'text/plain': textBlob,
    });
    navigator.clipboard.write([item]);
  } else {
    // Fallback: plain text tab-separated
    navigator.clipboard.writeText(text);
  }
}

export default function CopyTableButton({ getData, label = "Copy Table" }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const rows = getData();
    copyAsHtmlTable(rows);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="text-slate-600 border-slate-200 hover:bg-slate-50 gap-2"
    >
      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
      {copied ? 'Copied!' : label}
    </Button>
  );
}