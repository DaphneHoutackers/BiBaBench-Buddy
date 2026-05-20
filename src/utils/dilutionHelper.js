import React from 'react';

/**
 * Calculates a dilution suggestion for a given concentration and target amount.
 * @param {number|string} conc - The original concentration
 * @param {number|string} targetAmount - The target amount (e.g. ng)
 * @param {number} minVol - The minimum allowable volume before a dilution is suggested (e.g., 0.5 or 0.3 µL)
 * @returns {Object|null} The dilution suggestion object, or null if no dilution is needed.
 */
export function getDilutionSuggestion(conc, targetAmount, minVol = 0.5) {
  const parsedConc = Number(conc);
  const parsedTargetAmount = Number(targetAmount);

  if (!Number.isFinite(parsedConc) || parsedConc <= 0 || !Number.isFinite(parsedTargetAmount) || parsedTargetAmount <= 0) {
    return null;
  }

  const vol = parsedTargetAmount / parsedConc;

  if (vol >= minVol || vol <= 0) return null;

  // Calculate the lowest integer dilution factor that reaches minVol
  const df = Math.ceil(minVol / vol);
  
  const stockVol = 1.0;
  const mqVol = stockVol * df - stockVol;
  
  return {
    dilutionFactor: df,
    dilutedConc: (parsedConc / df).toFixed(2),
    stockVol: stockVol.toFixed(1),
    mqVol: mqVol.toFixed(1),
    newVol: (vol * df).toFixed(2),
    originalVol: vol.toFixed(2),
  };
}

/**
 * Generates the warning text formatted as requested:
 * ⚠ sample1 requires only ... µL (<0.5 µL) → dilute x:x →  x µL stock + x µL MQ → xx ng/µL; use *... µL
 */
export function generateDilutionWarning(name, suggestion, minVol = 0.5) {
  if (!suggestion) return null;
  return React.createElement('span', null,
    name, ' requires only ', React.createElement('strong', null, `${suggestion.originalVol} µL`),
    ` (<`, React.createElement('strong', null, `${minVol} µL`), `) → dilute `,
    React.createElement('strong', null, `1:${suggestion.dilutionFactor}`), ` → `,
    React.createElement('strong', null, `${suggestion.stockVol} µL`), ` stock + `,
    React.createElement('strong', null, `${suggestion.mqVol} µL`), ` MQ → `,
    React.createElement('strong', null, `${suggestion.dilutedConc} ng/µL`), `; use *`,
    React.createElement('strong', null, `${suggestion.newVol} µL`)
  );
}
