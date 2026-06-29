import test from 'node:test';
import assert from 'node:assert/strict';
import { getStepDuration, inferUnit, renderVariableText, replaceNumericValue } from './protocolVariables.js';

test('links only complete matching numbers', () => {
  const replacement = replaceNumericValue(
    'Use <250 mL or >250 mL; do not change 1250 mL.',
    '250',
    '{{cultureVolume}}',
  );

  assert.equal(replacement.count, 2);
  assert.equal(
    replacement.text,
    'Use <{{cultureVolume}} mL or >{{cultureVolume}} mL; do not change 1250 mL.',
  );
});

test('renders every linked occurrence from one variable value', () => {
  const text = 'Use <{{cultureVolume}} mL or >{{cultureVolume}} mL.';
  const variables = [{ id: 'cultureVolume', default: '250' }];

  assert.equal(renderVariableText(text, variables), 'Use <250 mL or >250 mL.');
  assert.equal(
    renderVariableText(text, variables, { cultureVolume: '500' }),
    'Use <500 mL or >500 mL.',
  );
});

test('infers common laboratory units', () => {
  assert.equal(inferUnit('Centrifuge at 4,000×g.', '4,000'), '×g');
  assert.equal(inferUnit('Incubate for 15 min', '15'), 'min');
  assert.equal(inferUnit('Prepare a 2% gel', '2'), '%');
});

test('calculates total step duration including repetitions', () => {
  assert.equal(getStepDuration('Wash 3×5 min.'), '15 min');
  assert.equal(getStepDuration('Incubate for 60 min.'), '60 min');
  assert.equal(getStepDuration('Incubate for 5–10 min.'), '5–10 min');
  assert.equal(getStepDuration('Grow overnight.'), 'Overnight');
});
