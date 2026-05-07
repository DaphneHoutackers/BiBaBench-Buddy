const fs = require('fs');

const files = [
  'src/components/calculators/DigestCalculator.jsx',
  'src/components/calculators/GibsonCalculator.jsx'
];

const replacements = [
  { regex: /text-slate-800/g, replacement: 'text-slate-800 dark:text-slate-100' },
  { regex: /text-slate-700/g, replacement: 'text-slate-700 dark:text-slate-200' },
  { regex: /text-slate-600/g, replacement: 'text-slate-600 dark:text-slate-300' },
  { regex: /text-slate-500/g, replacement: 'text-slate-500 dark:text-slate-400' },
  { regex: /text-slate-400/g, replacement: 'text-slate-400 dark:text-slate-500' },
  { regex: /bg-white\/80/g, replacement: 'bg-white/80 dark:bg-slate-900/50' },
  { regex: /bg-white/g, replacement: 'bg-white dark:bg-slate-900' },
  { regex: /bg-slate-100/g, replacement: 'bg-slate-100 dark:bg-slate-800' },
  { regex: /bg-slate-50/g, replacement: 'bg-slate-50 dark:bg-slate-800/50' },
  { regex: /border-slate-200/g, replacement: 'border-slate-200 dark:border-slate-700' },
  { regex: /border-slate-100/g, replacement: 'border-slate-100 dark:border-slate-800' },
  { regex: /bg-blue-50/g, replacement: 'bg-blue-50 dark:bg-blue-900/30' },
  { regex: /text-blue-700/g, replacement: 'text-blue-700 dark:text-blue-300' },
  { regex: /border-blue-100/g, replacement: 'border-blue-100 dark:border-blue-800' },
  { regex: /bg-amber-50/g, replacement: 'bg-amber-50 dark:bg-amber-900/30' },
  { regex: /text-amber-800/g, replacement: 'text-amber-800 dark:text-amber-300' },
  { regex: /text-amber-700/g, replacement: 'text-amber-700 dark:text-amber-400' },
  { regex: /border-amber-200/g, replacement: 'border-amber-200 dark:border-amber-800' },
  { regex: /from-rose-50 to-orange-50/g, replacement: 'from-rose-50 to-orange-50 dark:from-rose-950/30 dark:to-orange-950/30' },
  { regex: /from-emerald-50 to-teal-50/g, replacement: 'from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30' },
  { regex: /text-rose-600/g, replacement: 'text-rose-600 dark:text-rose-400' },
  { regex: /text-rose-700/g, replacement: 'text-rose-700 dark:text-rose-300' },
  { regex: /text-red-500/g, replacement: 'text-red-500 dark:text-red-400' },
  { regex: /text-red-600/g, replacement: 'text-red-600 dark:text-red-400' },
  { regex: /text-blue-600/g, replacement: 'text-blue-600 dark:text-blue-400' },
  { regex: /text-blue-500/g, replacement: 'text-blue-500 dark:text-blue-400' },
  { regex: /text-emerald-700/g, replacement: 'text-emerald-700 dark:text-emerald-300' },
  { regex: /bg-emerald-100/g, replacement: 'bg-emerald-100 dark:bg-emerald-900/40' },
  { regex: /bg-emerald-50/g, replacement: 'bg-emerald-50 dark:bg-emerald-900/20' },
  { regex: /border-emerald-200/g, replacement: 'border-emerald-200 dark:border-emerald-800' },
  { regex: /bg-slate-200/g, replacement: 'bg-slate-200 dark:bg-slate-700' },
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Prevent double replacements if script is run multiple times
  if (!content.includes('dark:text-slate-100')) {
    replacements.forEach(r => {
      content = content.replace(r.regex, r.replacement);
    });
    
    // Fix any nested bg-white dark:bg-slate-900/80 issues where 'bg-white/80' might have been matched by 'bg-white' before.
    // Actually the regex order is important: bg-white/80 is before bg-white.
    
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  } else {
    console.log(`${file} already updated`);
  }
});
