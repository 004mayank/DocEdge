type Utterance = {
  transcript: string;
  speaker?: number;
  start?: number;
  end?: number;
};

const QUESTION_STARTERS = [
  'do you',
  'did you',
  'are you',
  'is it',
  'have you',
  'when',
  'where',
  'why',
  'what',
  'how',
  'how long',
  'any',
  'can you',
  'could you',
  'will you',
];

const CLINICAL_CUES = [
  'pain',
  'fever',
  'cough',
  'cold',
  'breath',
  'breathing',
  'bp',
  'blood pressure',
  'sugar',
  'diabetes',
  'allergy',
  'allergies',
  'medicine',
  'medicines',
  'since when',
  'from when',
  'duration',
  'severity',
  'vomit',
  'nausea',
  'headache',
];

function scoreAsDoctorQuestion(textRaw: string) {
  const text = (textRaw || '').trim();
  const lower = text.toLowerCase();

  let score = 0;
  if (text.endsWith('?')) score += 2;

  for (const s of QUESTION_STARTERS) {
    if (lower.startsWith(s + ' ') || lower === s) {
      score += 2;
      break;
    }
  }

  for (const cue of CLINICAL_CUES) {
    if (lower.includes(cue)) {
      score += 1;
      break;
    }
  }

  if (
    lower.startsWith('i ') ||
    lower.startsWith("i'm") ||
    lower.startsWith('my ') ||
    lower.startsWith('since ') ||
    lower.startsWith('it ') ||
    lower.startsWith('we ') // usually not a question
  ) {
    score -= 2;
  }

  return score;
}

export function inferQnaFromUtterances(input: {
  utterances?: Utterance[];
  fallbackText?: string;
}) {
  const utterances = (input.utterances ?? []).filter(
    (u) => u?.transcript && u.transcript.trim().length > 0,
  );

  const questions: Array<{ text: string; idx: number; score: number }> = [];
  const responses: Array<{ text: string; idx: number }> = [];

  if (!utterances.length && input.fallbackText) {
    // Very rough fallback: split by sentence.
    const parts = input.fallbackText
      .split(/(?<=[?.!])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      const score = scoreAsDoctorQuestion(parts[i]);
      if (score >= 2) questions.push({ text: parts[i], idx: i, score });
      else responses.push({ text: parts[i], idx: i });
    }
  } else {
    for (let i = 0; i < utterances.length; i++) {
      const t = utterances[i].transcript.trim();
      const score = scoreAsDoctorQuestion(t);
      if (score >= 2) questions.push({ text: t, idx: i, score });
      else responses.push({ text: t, idx: i });
    }
  }

  // Naive pairing: each response attaches to the most recent question.
  const pairs: Array<{ question: string; responses: string[] }> = [];
  let qPtr = -1;
  for (let i = 0; i < (utterances.length || 0); i++) {
    const q = questions.find((x) => x.idx === i);
    if (q) {
      pairs.push({ question: q.text, responses: [] });
      qPtr = pairs.length - 1;
      continue;
    }
    const r = responses.find((x) => x.idx === i);
    if (r && qPtr >= 0) pairs[qPtr].responses.push(r.text);
  }

  return {
    mode: 'inferred',
    questions: questions.map((q) => q.text),
    responses: responses.map((r) => r.text),
    pairs,
  };
}

