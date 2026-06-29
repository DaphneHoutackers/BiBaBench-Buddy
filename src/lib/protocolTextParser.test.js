import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProtocolText } from './protocolTextParser.js';

test('parses section headings and nested bullets without numbering headings', () => {
  const input = `A) Removal of bacterial cells
1. Grow bacterial liquid culture ON (until stationary phase).
2. Transfer the liquid culture to 50mL tubes
3. Centrifuge at 4,000×g, 4°C, 15 min.
4. Carefully transfer the supernatant to a new tube without disturbing the pellet.
5. Centrifuge the collected supernatant at 4,000×g, 4°C, 15 min
6. Transfer the supernatant again to a new sterile container.

B) Filtration of culture supernatant
7. Filtrations depended on culture volume
o\tCultures <250 mL: Filter the supernatant through a 0.2µm syringe filter into a tube
o\tCultures >250 mL: Filter the supernatant using a vacuum filtration system with 0.2 µm PES membrane filters (47 mm).`;

  const result = parseProtocolText(input);

  assert.equal(result.filter(item => item.isSection).length, 2);
  assert.equal(result.filter(item => !item.isSection).length, 7);
  assert.equal(result[0].text, 'A) Removal of bacterial cells');
  assert.equal(result[7].text, 'B) Filtration of culture supernatant');
  assert.deepEqual(result[8].substeps, [
    'Cultures <250 mL: Filter the supernatant through a 0.2µm syringe filter into a tube',
    'Cultures >250 mL: Filter the supernatant using a vacuum filtration system with 0.2 µm PES membrane filters (47 mm).',
  ]);
});

test('joins indented wrapped lines to the preceding substep', () => {
  const result = parseProtocolText(`1. Choose a filter
  a. For small cultures, use a syringe filter
     and collect in a sterile tube.`);

  assert.deepEqual(result[0].substeps, [
    'For small cultures, use a syringe filter and collect in a sterile tube.',
  ]);
});

