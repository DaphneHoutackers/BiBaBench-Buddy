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

const CACHE_KEY = 'labcalc_science_jokes_pool';

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function ScienceJoke({ isDark = false }) {
  const [joke, setJoke] = useState('');

  useEffect(() => {
    let pool;
    try {
      pool = JSON.parse(localStorage.getItem(CACHE_KEY));
    } catch { }

    if (!pool || !Array.isArray(pool) || pool.length === 0) {
      pool = shuffle(FALLBACK_JOKES);
    }
    
    const nextJoke = pool.pop();
    setJoke(nextJoke);
    localStorage.setItem(CACHE_KEY, JSON.stringify(pool));

    if (pool.length < 5) {
      db.integrations.Core.InvokeLLM({
        prompt: `Generate 15 funny, clever science jokes or quotes for a molecular biology lab app. Mix short one-liners with quotes. Make them genuinely funny and varied — about biology, chemistry, physics, lab life. Return ONLY a JSON array of 15 strings. Examples: "What did the asteroid say when the reporter asked him a question? No comet.", "THINK LIKE A PROTON. ALWAYS POSITIVE.", "Why can't you trust atoms? They make up everything."`,
        response_json_schema: { type: 'object', properties: { jokes: { type: 'array', items: { type: 'string' } } } }
      }).then(result => {
        if (result?.jokes?.length) {
          const currentPool = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
          const newPool = currentPool.concat(result.jokes);
          localStorage.setItem(CACHE_KEY, JSON.stringify(newPool));
        }
      }).catch(() => {});
    }
  }, []);

  return (
    <p className={`max-w-xl mx-auto text-sm italic text-center ${isDark ? 'text-white/50' : 'text-slate-500'}`}>
      "{joke}"
    </p>
  );
}