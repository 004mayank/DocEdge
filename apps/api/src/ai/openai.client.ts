import { loadEnv } from '../config/env';
import { request } from 'undici';

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

  const res = await request('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (res.statusCode < 200 || res.statusCode >= 300) {
    const txt = await res.body.text();
    throw new Error(`OpenAI error ${res.statusCode}: ${txt}`);
  }

  const json: any = await res.body.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI empty response');
  return JSON.parse(content) as T;
}
