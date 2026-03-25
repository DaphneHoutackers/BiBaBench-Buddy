import { useEffect, useRef, useState } from 'react';
import { SCIENCE_JOKES } from '@/lib/jokes';

const CURRENT_JOKE_KEY = 'bibabenchbuddy_science_joke_current';
const LAST_ROTATED_KEY = 'bibabenchbuddy_science_joke_last_rotated';
const SEEN_JOKES_KEY = 'bibabenchbuddy_science_jokes_seen';

const ROTATE_MS = 60 * 60 * 1000; // 1 hour

function getNextJoke() {
  const current = localStorage.getItem(CURRENT_JOKE_KEY) || '';
  let seen = [];
  try {
    const rawSeen = localStorage.getItem(SEEN_JOKES_KEY);
    if (rawSeen) seen = JSON.parse(rawSeen);
  } catch (e) {}

  // If we've seen almost all jokes, reset the seen list
  if (seen.length >= SCIENCE_JOKES.length - 2) {
    seen = [];
  }

  // Filter out the current joke and recently seen jokes
  let pool = SCIENCE_JOKES.filter(j => j !== current && !seen.includes(j));

  // Fallback if pool is empty
  if (pool.length === 0) pool = SCIENCE_JOKES.filter(j => j !== current);

  // Pick random
  const next = pool[Math.floor(Math.random() * pool.length)];

  // Update seen
  seen.push(next);
  localStorage.setItem(SEEN_JOKES_KEY, JSON.stringify(seen));
  localStorage.setItem(CURRENT_JOKE_KEY, next);
  localStorage.setItem(LAST_ROTATED_KEY, String(Date.now()));

  // Cleanup old obsolete keys from the previous API-based version
  try {
    localStorage.removeItem('bibabenchbuddy_science_jokes_pool');
    localStorage.removeItem('bibabenchbuddy_science_jokes_replenishing');
  } catch (e) {}

  return next;
}

export default function ScienceJoke({ isDark = false }) {
  const [joke, setJoke] = useState('');
  const intervalRef = useRef(null);

  useEffect(() => {
    const rotateJoke = () => {
      const next = getNextJoke();
      setJoke(next);
    };

    const lastRotated = Number(localStorage.getItem(LAST_ROTATED_KEY) || 0);
    const storedJoke = localStorage.getItem(CURRENT_JOKE_KEY);

    // Only rotate if no joke exists, 1 hour has passed, or current joke isn't in our new vetted list (legacy clear)
    if (!storedJoke || Date.now() - lastRotated >= ROTATE_MS || !SCIENCE_JOKES.includes(storedJoke)) {
      rotateJoke();
    } else {
      // Use existing joke so it persists across refreshes
      setJoke(storedJoke);
    }

    intervalRef.current = setInterval(() => {
      const lr = Number(localStorage.getItem(LAST_ROTATED_KEY) || 0);
      if (Date.now() - lr >= ROTATE_MS) {
        rotateJoke();
      }
    }, 60 * 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <p className={`max-w-xl mx-auto text-sm italic text-center ${isDark ? 'text-white/50' : 'text-slate-500'}`}>
      &quot;{joke || SCIENCE_JOKES[0]}&quot;
    </p>
  );
}