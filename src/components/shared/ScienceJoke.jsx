import { useEffect, useRef, useState } from 'react';

const FALLBACK_JOKES = [
  'What did the asteroid say when asked a question? "No comet."',
  'Who was the smartest pig? Ein-swine.',
  'What does a magician shout during an experiment? Labracadabra!',
  'Who was the first electricity detective? Sherlock Ohms.',
  'What did the bartender say to the neutron? "For you, no charge."',
  'THINK LIKE A PROTON. ALWAYS POSITIVE.',
  'Why did the biology student break up with the physics student? There was no chemistry.',
  'I tried to come up with a chemistry joke... but all the good ones Argon.',
  "Why can't you trust an atom? They make up everything.",
  'What do you call an acid with an attitude? A-mean-o acid.',
  'Why did the cell phone go to school? To improve its cell culture.',
  "Helium walks into a bar. Bartender: \"We don't serve noble gases.\" He doesn't react.",
  "Never trust an atom... they make up everything!",
  "A biologist, a chemist, and a physicist go to the ocean for the first time. The physicist is fascinated by the waves and walks into the water, never to return. The biologist wants to study the marine life and also walks in, never to return. The chemist writes in his notebook: 'Physicists and biologists are soluble in salt water.'",
  "Why are biologists so good at multitasking? Because they have many nuclei.",
  "What's a pirate's favorite amino acid? Arrr-ginine!",
  "What is a physicist's favorite food? Fission chips.",
  "How does a mathematician fix a flat tire? With a multi-plyer.",
  "Why did the physics teacher break up with the biology teacher? There was no biology between them.",
  "I have a new joke about entropy, but it's not very well ordered.",
  "What do you do with a dead chemist? You barium.",
  "Why did the bacteria cross the microscope? To get to the other slide.",
  "Schrödinger's cat walks into a bar... and doesn't.",
  "Oxygen, Magnesium, Sulfur, and Silver walked into a bar. O Mg S Ag!",
  "What do you call a biologist who's also a DJ? A cell-ist.",
  "Organic chemistry is difficult. Those who study it have alkynes of trouble.",
  "If the silver surfer and iron man teamed up, they'd be alloys.",
  "Why are chemists great at solving problems? Because they have all the solutions.",
];

const CACHE_POOL_KEY = 'bibabenchbuddy_science_jokes_pool';
const SEEN_KEY = 'bibabenchbuddy_science_jokes_seen';
const CURRENT_JOKE_KEY = 'bibabenchbuddy_science_joke_current';
const LAST_ROTATED_KEY = 'bibabenchbuddy_science_joke_last_rotated';
const REPLENISHING_KEY = 'bibabenchbuddy_science_jokes_replenishing';

const ROTATE_MS = 60 * 60 * 1000;
const MIN_POOL_SIZE = 12;
const TARGET_POOL_SIZE = 24;

const SCIENCE_TERMS = [
  'atom', 'molecule', 'electron', 'proton', 'neutron', 'chemistry', 'physics',
  'biology', 'cell', 'enzyme', 'gene', 'dna', 'rna', 'protein', 'lab',
  'microscope', 'bacteria', 'quantum', 'entropy', 'acid', 'base', 'nucleus',
  'react', 'reaction', 'polymerase', 'primer', 'culture', 'petri', 'pipette',
  'centrifuge', 'spectrometer', 'mitochondria', 'photon', 'genome',
];

const TEMPLATE_SUBJECTS = [
  'the atom', 'the proton', 'the electron', 'the PCR machine', 'the primer',
  'the polymerase', 'the cell', 'the enzyme', 'the physicist', 'the chemist',
  'the biologist', 'the lab intern', 'the mitochondrion', 'the bacterium',
  'the pipette', 'the centrifuge',
];

const TEMPLATE_PUNCHLINES = [
  'because it wanted a positive reaction.',
  'because the results were too basic.',
  'because there was no chemistry.',
  'because it needed more space to orbit.',
  'because it could not handle the pressure.',
  'because everything finally clicked into solution.',
  'because it lost its charge halfway through.',
  'because it wanted to keep things in suspension.',
  'because the protocol had too many variables.',
  'because the data were not statistically significant.',
  'because it was trying to stay in equilibrium.',
  'because the whole thing was out of phase.',
];

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function safeReadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function safeWriteJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function normalizeJoke(joke) {
  return String(joke || '')
    .replace(/\s+/g, ' ')
    .replace(/^["“]|["”]$/g, '')
    .trim();
}

function isShortJoke(joke) {
  if (!joke) return false;
  const wordCount = joke.split(/\s+/).length;
  const lineCount = joke.split('\n').length;
  // Limit to max 3 lines, 35 words, and 200 characters to ensure jokes don't span large blocks.
  return lineCount <= 3 && wordCount <= 35 && joke.length <= 200;
}

function uniqueJokes(jokes) {
  const seen = new Set();
  const result = [];

  for (const joke of jokes) {
    const normalized = normalizeJoke(joke);
    if (!normalized) continue;

    // Filter out long jokes (max ~3 lines)
    if (!isShortJoke(normalized)) continue;

    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function generateLocalScienceJokes(count = 10) {
  const jokes = [];

  for (let i = 0; i < count; i += 1) {
    const subject = TEMPLATE_SUBJECTS[Math.floor(Math.random() * TEMPLATE_SUBJECTS.length)];
    const punchline = TEMPLATE_PUNCHLINES[Math.floor(Math.random() * TEMPLATE_PUNCHLINES.length)];
    jokes.push(`Why did ${subject} leave the experiment? ${punchline}`);
  }

  return uniqueJokes(jokes);
}

function extractJokesFromJokeApiPayload(payload) {
  if (!payload || payload.error) return [];

  if (Array.isArray(payload.jokes)) {
    return payload.jokes
      .map(item => {
        if (item.type === 'single') return item.joke;
        if (item.type === 'twopart') return `${item.setup} ... ${item.delivery}`;
        return null;
      })
      .filter(Boolean);
  }

  if (payload.type === 'single' && payload.joke) return [payload.joke];
  if (payload.type === 'twopart' && payload.setup && payload.delivery) {
    return [`${payload.setup} ... ${payload.delivery}`];
  }

  return [];
}

function looksSciencey(joke) {
  const text = joke.toLowerCase();
  return SCIENCE_TERMS.some(term => text.includes(term));
}

async function fetchJokeApiBatch() {
  const urls = [
    'https://v2.jokeapi.dev/joke/Pun,Miscellaneous?amount=6&type=single,twopart&blacklistFlags=nsfw,religious,political,racist,sexist,explicit',
    'https://v2.jokeapi.dev/joke/Pun?amount=6&type=single,twopart&blacklistFlags=nsfw,religious,political,racist,sexist,explicit',
    'https://v2.jokeapi.dev/joke/Miscellaneous?amount=6&type=single,twopart&blacklistFlags=nsfw,religious,political,racist,sexist,explicit',
  ];

  const settled = await Promise.allSettled(
    urls.map(url => fetch(url).then(res => res.json()))
  );

  const all = settled.flatMap(result =>
    result.status === 'fulfilled' ? extractJokesFromJokeApiPayload(result.value) : []
  );

  const cleaned = uniqueJokes(all);
  const scienceFirst = cleaned.filter(looksSciencey);
  const rest = cleaned.filter(j => !looksSciencey(j));

  return [...scienceFirst, ...rest];
}

async function replenishPool() {
  if (localStorage.getItem(REPLENISHING_KEY) === '1') return;

  const pool = safeReadJson(CACHE_POOL_KEY, []);
  if (pool.length >= MIN_POOL_SIZE) return;

  localStorage.setItem(REPLENISHING_KEY, '1');

  try {
    const current = normalizeJoke(localStorage.getItem(CURRENT_JOKE_KEY) || '');
    const seen = safeReadJson(SEEN_KEY, []);

    const [apiJokes] = await Promise.allSettled([fetchJokeApiBatch()]);
    const fetched = apiJokes.status === 'fulfilled' ? apiJokes.value : [];
    const generated = generateLocalScienceJokes(12);

    const merged = uniqueJokes([
      ...pool,
      ...fetched,
      ...generated,
      ...shuffle(FALLBACK_JOKES),
    ]).filter(j => j !== current && !seen.includes(j));

    safeWriteJson(CACHE_POOL_KEY, merged.slice(0, TARGET_POOL_SIZE));
  } finally {
    localStorage.removeItem(REPLENISHING_KEY);
  }
}

function getNextJoke() {
  const current = normalizeJoke(localStorage.getItem(CURRENT_JOKE_KEY) || '');
  const seen = safeReadJson(SEEN_KEY, []);
  let pool = uniqueJokes(safeReadJson(CACHE_POOL_KEY, []));

  if (!pool.length) {
    pool = uniqueJokes([
      ...shuffle(FALLBACK_JOKES),
      ...generateLocalScienceJokes(12),
    ]);
  }

  let candidates = pool.filter(j => !seen.includes(j) && j !== current);

  if (!candidates.length) {
    safeWriteJson(SEEN_KEY, current ? [current] : []);
    candidates = pool.filter(j => j !== current);
  }

  const next =
    candidates[Math.floor(Math.random() * candidates.length)] ||
    pool.find(j => j !== current) ||
    FALLBACK_JOKES[0];

  const nextSeen = uniqueJokes([...safeReadJson(SEEN_KEY, []), next]);
  const nextPool = pool.filter(j => j !== next);

  safeWriteJson(SEEN_KEY, nextSeen);
  safeWriteJson(CACHE_POOL_KEY, nextPool);
  localStorage.setItem(CURRENT_JOKE_KEY, next);
  localStorage.setItem(LAST_ROTATED_KEY, String(Date.now()));

  return next;
}

export default function ScienceJoke({ isDark = false }) {
  const [joke, setJoke] = useState('');
  const intervalRef = useRef(null);

  useEffect(() => {
    const rotateJoke = async () => {
      const next = getNextJoke();
      setJoke(next);
      replenishPool().catch(() => {});
    };

    // Bij iedere refresh direct een nieuwe joke
    rotateJoke();

    intervalRef.current = setInterval(() => {
      const lastRotated = Number(localStorage.getItem(LAST_ROTATED_KEY) || 0);
      if (Date.now() - lastRotated >= ROTATE_MS) {
        rotateJoke();
      }
    }, 60 * 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <p className={`max-w-xl mx-auto text-sm italic text-center ${isDark ? 'text-white/50' : 'text-slate-500'}`}>
      &quot;{joke || FALLBACK_JOKES[0]}&quot;
    </p>
  );
}