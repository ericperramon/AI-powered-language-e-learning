// Cliente servidor para HeyGen LiveAvatar (FULL Mode).
// Solo debe importarse desde código de servidor (route handlers / server actions):
// la X-API-KEY nunca debe llegar al bundle del navegador.
// La X-API-KEY es secreta y NUNCA debe salir del servidor: al front solo se le
// entrega el `session_token` devuelto por createSessionToken().

const API_BASE = "https://api.liveavatar.com/v1";

// Avatar de sandbox documentado por LiveAvatar: sesiones ~1 min, sin gastar créditos.
const SANDBOX_AVATAR_ID = "dd73ea75-1218-4ef3-92ce-606d5f7fbc0a";

export class LiveAvatarConfigError extends Error {}
export class LiveAvatarApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

function getApiKey(): string {
  const apiKey = process.env.LIVEAVATAR_API_KEY;
  if (!apiKey) {
    throw new LiveAvatarConfigError(
      "Falta LIVEAVATAR_API_KEY en el entorno del servidor."
    );
  }
  return apiKey;
}

function isSandbox(): boolean {
  return process.env.LIVEAVATAR_SANDBOX === "true";
}

async function apiFetch<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "X-API-KEY": getApiKey(),
      "Content-Type": "application/json",
      ...init.headers
    }
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new LiveAvatarApiError(
      `LiveAvatar ${path} respondió ${response.status}: ${body.slice(0, 300)}`,
      response.status
    );
  }

  return (await response.json()) as T;
}

// Mapea el nombre del idioma del curso (target_language, p. ej. "English") al
// código ISO que espera LiveAvatar. Por defecto inglés.
const LANGUAGE_CODES: Record<string, string> = {
  english: "en",
  inglés: "en",
  ingles: "en",
  spanish: "es",
  español: "es",
  espanol: "es",
  french: "fr",
  francés: "fr",
  frances: "fr",
  german: "de",
  alemán: "de",
  aleman: "de",
  italian: "it",
  italiano: "it",
  portuguese: "pt",
  portugués: "pt",
  portugues: "pt"
};

export function toLanguageCode(targetLanguage: string | null | undefined): string {
  if (!targetLanguage) return "en";
  return LANGUAGE_CODES[targetLanguage.trim().toLowerCase()] ?? "en";
}

type ContextResponse = { data: { id: string } };

export async function createContext(input: {
  name: string;
  prompt: string;
  opening_text: string;
}): Promise<string> {
  const result = await apiFetch<ContextResponse>("/contexts", {
    method: "POST",
    body: JSON.stringify(input)
  });
  return result.data.id;
}

// Cache en memoria de contextos creados al vuelo, indexado por idioma+nivel.
// Evita recrear un contexto en cada arranque de sesión dentro de la misma
// instancia de servidor. En producción se recomienda fijar LIVEAVATAR_CONTEXT_ID.
const contextCache = new Map<string, string>();

function buildTutorPrompt(languageName: string, level: string | null): { prompt: string; opening: string } {
  const lvl = level ? ` The learner's level is ${level}.` : "";
  return {
    prompt:
      `You are a friendly, patient ${languageName} conversation tutor for an e-learning platform.` +
      `${lvl} Speak only in ${languageName}. Keep your turns short (1-3 sentences) so the student talks most of the time. ` +
      `Ask open questions, gently correct mistakes by restating the sentence correctly, and adapt difficulty to the learner. ` +
      `Be encouraging and never switch to another language unless the student is completely stuck.`,
    opening: `Hi! Let's practise your ${languageName}. What would you like to talk about today?`
  };
}

type ContextListResponse = {
  data: { results: Array<{ id: string; name: string }>; next: string | null };
};

// Busca un contexto ya creado por su nombre (los nombres son únicos en LiveAvatar).
// La lista viene paginada en data.results; recorremos páginas hasta encontrarlo.
async function findContextIdByName(name: string): Promise<string | null> {
  try {
    for (let page = 1; page <= 20; page += 1) {
      const result = await apiFetch<ContextListResponse>(
        `/contexts?page=${page}&page_size=100`,
        { method: "GET" }
      );
      const match = result.data?.results?.find((c) => c.name === name);
      if (match) return match.id;
      if (!result.data?.next) break;
    }
    return null;
  } catch {
    return null;
  }
}

async function resolveContextId(languageName: string, languageCode: string, level: string | null): Promise<string> {
  const envContext = process.env.LIVEAVATAR_CONTEXT_ID;
  if (envContext) return envContext;

  const cacheKey = `${languageCode}:${level ?? ""}`;
  const cached = contextCache.get(cacheKey);
  if (cached) return cached;

  const name = `Speaking tutor (${languageCode}${level ? ` · ${level}` : ""})`;

  // Reutiliza el contexto si ya existe (la caché en memoria se pierde al reiniciar).
  const existing = await findContextIdByName(name);
  if (existing) {
    contextCache.set(cacheKey, existing);
    return existing;
  }

  const { prompt, opening } = buildTutorPrompt(languageName, level);
  let id: string;
  try {
    id = await createContext({ name, prompt, opening_text: opening });
  } catch (error) {
    // Carrera: otro request lo creó entre el lookup y el create → recupéralo.
    if (error instanceof LiveAvatarApiError && error.status === 400) {
      const found = await findContextIdByName(name);
      if (found) {
        contextCache.set(cacheKey, found);
        return found;
      }
    }
    throw error;
  }
  contextCache.set(cacheKey, id);
  return id;
}

type SessionTokenResponse = { data: { session_id: string; session_token: string } };

// Crea un token de sesión FULL Mode. Devuelve el session_token, que es lo único
// que debe viajar al navegador. El SDK web hace internamente /sessions/start.
export async function createSpeakingSessionToken(input: {
  languageName: string;
  level: string | null;
}): Promise<{ sessionToken: string; sessionId: string }> {
  const sandbox = isSandbox();
  const avatarId = process.env.LIVEAVATAR_AVATAR_ID ?? (sandbox ? SANDBOX_AVATAR_ID : null);

  if (!avatarId) {
    throw new LiveAvatarConfigError(
      "Falta LIVEAVATAR_AVATAR_ID (o activa LIVEAVATAR_SANDBOX=true para probar con el avatar de sandbox)."
    );
  }

  const languageCode = toLanguageCode(input.languageName);
  const contextId = await resolveContextId(input.languageName, languageCode, input.level);
  const voiceId = process.env.LIVEAVATAR_VOICE_ID;

  const avatarPersona: Record<string, unknown> = {
    context_id: contextId,
    language: languageCode
  };
  if (voiceId) avatarPersona.voice_id = voiceId;

  const body: Record<string, unknown> = {
    mode: "FULL",
    avatar_id: avatarId,
    avatar_persona: avatarPersona
  };
  if (sandbox) body.is_sandbox = true;

  const result = await apiFetch<SessionTokenResponse>("/sessions/token", {
    method: "POST",
    body: JSON.stringify(body)
  });

  return { sessionToken: result.data.session_token, sessionId: result.data.session_id };
}
