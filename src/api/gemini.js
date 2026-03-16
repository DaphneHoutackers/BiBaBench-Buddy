/**
 * AI integration via Groq — replaces Base44's InvokeLLM.
 *
 * Uses the Groq REST API with Llama 3 (free tier: 30 req/min).
 * API key is read from VITE_AI_API_KEY in .env.
 * 
 * To switch provider, change PROVIDER below to 'gemini' or 'groq'.
 */

const getApiKey = () => {
  try {
    const settings = JSON.parse(localStorage.getItem('app_settings_v1') || '{}');
    return settings.groqApiKey || import.meta.env.VITE_AI_API_KEY;
  } catch {
    return import.meta.env.VITE_AI_API_KEY;
  }
};

const PROVIDER = 'groq'; // 'groq' or 'gemini'

// ── Groq config ──
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

/**
 * InvokeLLM — drop-in replacement for Base44's db.integrations.Core.InvokeLLM
 */
export async function InvokeLLM({ prompt, response_json_schema, file_urls } = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[AI] No API key set. Add your key in Settings > AI Settings.');
    return response_json_schema ? {} : 'AI is not configured. Please add your Groq API key in the Settings.';
  }

  if (PROVIDER === 'groq') {
    return invokeGroq({ prompt, response_json_schema, apiKey });
  } else {
    // Gemini backup logic - currently also requires a key
    return invokeGemini({ prompt, response_json_schema, apiKey });
  }
}

// Update helper functions to accept apiKey parameter
async function invokeGroq({ prompt, response_json_schema, apiKey }) {
  const messages = [
    {
      role: 'system',
      content: response_json_schema
        ? 'You are a helpful AI assistant. Respond with valid JSON only, no markdown, no code fences.'
        : 'You are a helpful AI assistant.'
    },
    { role: 'user', content: prompt }
  ];

  // If JSON is expected, add schema hint
  if (response_json_schema) {
    messages[1].content += `\n\nRespond with valid JSON matching this schema: ${JSON.stringify(response_json_schema)}. Return ONLY the JSON object.`;
  }

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 4096,
        ...(response_json_schema ? { response_format: { type: 'json_object' } } : {}),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[Groq] API error:', res.status, err);
      return response_json_schema ? {} : `AI error (${res.status}). Check your API key.`;
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? '';

    if (response_json_schema) {
      try {
        const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        return JSON.parse(cleaned);
      } catch (e) {
        console.warn('[Groq] Failed to parse JSON:', e, '\nRaw:', text);
        return {};
      }
    }

    return text;
  } catch (err) {
    console.error('[Groq] Request failed:', err);
    return response_json_schema ? {} : 'AI request failed. Check your internet connection.';
  }
}

// ── Gemini (backup) ───────────────────────────────────────────────────────
async function invokeGemini({ prompt, response_json_schema, apiKey }) {
  const GEMINI_MODEL = 'gemini-2.0-flash';
  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const systemInstruction = response_json_schema
    ? 'You are a helpful AI assistant. Respond with valid JSON only.'
    : 'You are a helpful AI assistant.';

  let fullPrompt = prompt;
  if (response_json_schema) {
    fullPrompt += `\n\nRespond with valid JSON matching this schema: ${JSON.stringify(response_json_schema)}. Return ONLY the JSON object.`;
  }

  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
          ...(response_json_schema ? { responseMimeType: 'application/json' } : {}),
        }
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[Gemini] API error:', res.status, err);
      return response_json_schema ? {} : `AI error: ${res.status}`;
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    if (response_json_schema) {
      try {
        const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        return JSON.parse(cleaned);
      } catch (e) {
        console.warn('[Gemini] Failed to parse JSON:', e);
        return {};
      }
    }

    return text;
  } catch (err) {
    console.error('[Gemini] Request failed:', err);
    return response_json_schema ? {} : 'AI request failed.';
  }
}
