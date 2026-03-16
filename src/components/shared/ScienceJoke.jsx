const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }), InvokeLLM:async()=>({}) } } };

import React, { useState, useEffect } from 'react';

const FALLBACK_JOKES = [
  'What did the asteroid say when asked a question? "No comet."',
  'Who was the smartest pig? Ein-swine.',
  'What does a magician shout during an experiment? Labracadabra!',
  'Who was the first electricity detective? Sherlock Ohms.',
  'What did the bartender say to the neutron? "For you, no charge."',
  'THINK LIKE A PROTON. ALWAYS POSITIVE.',
  'Why did the biology student break up with the physics student? There was no chemistry.',
  'I tried to come up with a chemistry joke... but all the good ones Argon.',
  'A neutron walks into a bar. Bartender: "For you, no charge."',
  "Why can't you trust an atom? They make up everything.",
  'What do you call an acid with an attitude? A-mean-o acid.',
  'Why did the cell phone go to school? To improve its cell culture.',
  "Helium walks into a bar. Bartender: \"We don't serve noble gases.\" He doesn't react.",
];

const CACHE_KEY = 'labcalc_science_jokes';
const CACHE_TS_KEY = 'labcalc_science_jokes_ts';
const INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 hours

function getSeedIndex() {
  // Returns a stable index that changes every 3 hours
  const epoch = Math.floor(Date.now() / INTERVAL_MS);
  return epoch % FALLBACK_JOKES.length;
}

export default function ScienceJoke({ isDark = false }) {
  const [joke, setJoke] = useState(() => FALLBACK_JOKES[getSeedIndex()]);

  useEffect(() => {
    const cacheTs = parseInt(localStorage.getItem(CACHE_TS_KEY) || '0', 10);
    const cachedJokes = (() => {
      try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; }
    })();

    // If cache is still fresh, pick from cached jokes
    if (cachedJokes && cachedJokes.length && Date.now() - cacheTs < INTERVAL_MS) {
      const idx = getSeedIndex() % cachedJokes.length;
      setJoke(cachedJokes[idx]);
      return;
    }

    // Fetch new jokes from AI
    db.integrations.Core.InvokeLLM({
      prompt: `Generate 15 funny, clever science jokes or quotes for a molecular biology lab app. Mix short one-liners with quotes. Make them genuinely funny and varied — about biology, chemistry, physics, lab life. Return ONLY a JSON array of 15 strings. Examples: "What did the asteroid say when the reporter asked him a question? No comet.", "THINK LIKE A PROTON. ALWAYS POSITIVE.", "Why can't you trust atoms? They make up everything."`,
      response_json_schema: { type: 'object', properties: { jokes: { type: 'array', items: { type: 'string' } } } }
    }).then(result => {
      if (result?.jokes?.length) {
        localStorage.setItem(CACHE_KEY, JSON.stringify(result.jokes));
        localStorage.setItem(CACHE_TS_KEY, String(Date.now()));
        const idx = getSeedIndex() % result.jokes.length;
        setJoke(result.jokes[idx]);
      }
    }).catch(() => {});
  }, []);

  return (
    <p className={`max-w-xl mx-auto text-sm italic text-center ${isDark ? 'text-white/50' : 'text-slate-500'}`}>
      "{joke}"
    </p>
  );
}