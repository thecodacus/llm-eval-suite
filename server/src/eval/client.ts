import type { ModelRow, Completion } from "../types.js";

/** One chat completion against any OpenAI-compatible server. Captures timing + tokens. */
export async function complete(
  model: ModelRow,
  messages: Array<{ role: string; content: string }>,
  opts: { temperature?: number } = {}
): Promise<Completion> {
  const body = {
    model: model.model,
    messages,
    temperature: opts.temperature ?? model.temperature,
    max_tokens: model.max_tokens,
    stream: false,
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), model.timeout_s * 1000);
  const t0 = Date.now();
  try {
    const res = await fetch(`${model.base_url.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${model.api_key}`,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const totalS = (Date.now() - t0) / 1000;
    if (!res.ok) {
      return blank(totalS, `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const data: any = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const ct: number | null = data?.usage?.completion_tokens ?? null;
    const tokPerS = ct && totalS ? ct / totalS : null;
    return {
      text,
      totalS,
      promptTokens: data?.usage?.prompt_tokens ?? null,
      completionTokens: ct,
      tokPerS,
    };
  } catch (e: any) {
    return blank((Date.now() - t0) / 1000, e?.name === "AbortError" ? "timeout" : String(e));
  } finally {
    clearTimeout(timer);
  }
}

function blank(totalS: number, error: string): Completion {
  return { text: "", totalS, promptTokens: null, completionTokens: null, tokPerS: null, error };
}
