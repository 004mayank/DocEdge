import { loadEnv } from '../config/env';
// Use the built-in fetch (Node 18+) to avoid undici version/runtime quirks.

export async function openaiVisionJson<T>(opts: {
  system: string;
  userText: string;
  images: Array<{ base64: string; mimeType: string }>;
  schemaHint?: string;
}): Promise<T> {
  const env = loadEnv();
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');

  const imageBlocks = opts.images.map((img) => ({
    type: 'image_url',
    image_url: { url: `data:${img.mimeType};base64,${img.base64}`, detail: 'high' },
  }));

  const userContent: any[] = [
    ...imageBlocks,
    {
      type: 'text',
      text: opts.userText + (opts.schemaHint ? `\n\nReturn JSON matching:\n${opts.schemaHint}` : ''),
    },
  ];

  const body = {
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: userContent },
    ],
    temperature: 0.2,
    response_format: { type: 'json_object' },
    max_tokens: 1024,
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI vision error ${res.status}: ${txt}`);
  }

  const json: any = await res.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI vision empty response');
  return JSON.parse(content) as T;
}

export async function openaiChatJson<T>(opts: {
  system: string;
  user: string;
  schemaHint?: string;
}): Promise<T> {
  const env = loadEnv();
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');

  const body = {
    model: 'gpt-4.1-mini',
    messages: [
      { role: 'system', content: opts.system },
      {
        role: 'user',
        content:
          opts.user +
          (opts.schemaHint
            ? `\n\nReturn JSON matching:\n${opts.schemaHint}`
            : ''),
      },
    ],
    temperature: 0.2,
    response_format: { type: 'json_object' },
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${txt}`);
  }

  const json: any = await res.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI empty response');
  return JSON.parse(content) as T;
}
