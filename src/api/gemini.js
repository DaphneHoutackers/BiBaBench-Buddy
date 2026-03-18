/**
 * AI integration supporting multiple providers: Groq, Gemini, OpenAI, OpenRouter.
 */

const getSettings = () => {
  try {
    return JSON.parse(localStorage.getItem('bibabenchbuddy_settings') || '{}');
  } catch {
    return {};
  }
};

const PROVIDER_CONFIGS = {
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    defaultModel: 'llama-3.3-70b-versatile'
  },
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o'
  },
  gemini: {
    url: 'https://generativelanguage.googleapis.com/v1beta/models/',
    defaultModel: 'gemini-2.0-flash'
  },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: 'google/gemini-2.0-flash-001'
  }
};

/**
 * InvokeLLM — Routes requests to the selected AI provider.
 */
export async function InvokeLLM(args = {}) {
  const { prompt, response_json_schema, file_urls } = args;
  const settings = getSettings();
  const provider = settings.aiProvider || 'groq';
  const model = settings.aiModel || PROVIDER_CONFIGS[provider]?.defaultModel;
  
  const apiKey = 
    settings[`${provider}ApiKey`] || 
    (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env[`VITE_${provider.toUpperCase()}_API_KEY`] : undefined);

  if (!apiKey) {
    console.warn(`[AI] No API key set for ${provider}. Add your key in Settings > AI Settings.`);
    return response_json_schema ? {} : `AI is not configured for ${provider.toUpperCase()}. Please add your API key in the Settings.`;
  }

  if (provider === 'gemini') {
    return invokeGemini({ prompt, response_json_schema, apiKey, model });
  } else {
    // OpenAI, Groq, and OpenRouter share a similar schema
    return invokeOpenAIStyle({ prompt, response_json_schema, apiKey, model, provider });
  }
}

async function invokeOpenAIStyle({ prompt, response_json_schema, apiKey, model, provider }) {
  const config = PROVIDER_CONFIGS[provider];
  const url = config.url;

  const messages = [
    {
      role: 'system',
      content: response_json_schema
        ? 'You are a helpful AI assistant. Respond with valid JSON only, no markdown, no code fences.'
        : 'You are a helpful AI assistant.'
    },
    { role: 'user', content: prompt }
  ];

  if (response_json_schema) {
    messages[1].content += `\n\nRespond with valid JSON matching this schema: ${JSON.stringify(response_json_schema)}. Return ONLY the JSON object.`;
  }

  try {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    if (provider === 'openrouter') {
      headers['HTTP-Referer'] = window.location.origin;
      headers['X-Title'] = 'BiBaBenchBuddy';
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model,
        messages,
        temperature: 0.7,
        max_tokens: 4096,
        ...(response_json_schema ? { response_format: { type: 'json_object' } } : {}),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[${provider.toUpperCase()}] API error:`, res.status, err);
      return response_json_schema ? {} : `AI error (${res.status}). Check your API key.`;
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? '';

    if (response_json_schema) {
      try {
        const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        return JSON.parse(cleaned);
      } catch (e) {
        console.warn(`[${provider.toUpperCase()}] Failed to parse JSON:`, e, '\nRaw:', text);
        return {};
      }
    }

    return text;
  } catch (err) {
    console.error(`[${provider.toUpperCase()}] Request failed:`, err);
    return response_json_schema ? {} : 'AI request failed. Check your internet connection.';
  }
}

async function invokeGemini({ prompt, response_json_schema, apiKey, model }) {
  const url = `${PROVIDER_CONFIGS.gemini.url}${model}:generateContent?key=${apiKey}`;

  const systemInstruction = response_json_schema
    ? 'You are a helpful AI assistant. Respond with valid JSON only.'
    : 'You are a helpful AI assistant.';

  let fullPrompt = prompt;
  if (response_json_schema) {
    fullPrompt += `\n\nRespond with valid JSON matching this schema: ${JSON.stringify(response_json_schema)}. Return ONLY the JSON object.`;
  }

  try {
    const res = await fetch(url, {
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

/**
 * ValidateApiKey — Checks if an API key is valid by sending a test request.
 */
export async function ValidateApiKey({ provider, apiKey }) {
  const model = PROVIDER_CONFIGS[provider]?.defaultModel;
  
  if (provider === 'gemini') {
    const url = `${PROVIDER_CONFIGS.gemini.url}${model}:generateContent?key=${apiKey}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Say "ok"' }] }],
          generationConfig: { maxOutputTokens: 5 }
        }),
      });
      return { success: res.ok, status: res.status };
    } catch (err) {
      return { success: false, message: err.message };
    }
  } else {
    const url = PROVIDER_CONFIGS[provider].url;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: 'Say "ok"' }],
          max_tokens: 5,
        }),
      });
      return { success: res.ok, status: res.status };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }
}

/**
 * FetchOpenRouterModels — Gets the current list of available models from OpenRouter.
 */
export async function FetchOpenRouterModels() {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.data.map(m => ({
      id: m.id,
      label: m.name || m.id
    })).sort((a, b) => a.label.localeCompare(b.label));
  } catch (err) {
    console.error('[OpenRouter] Failed to fetch models:', err);
    return null;
  }
}
