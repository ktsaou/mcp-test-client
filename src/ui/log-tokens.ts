/**
 * Lazy `gpt-tokenizer` wrapper. The encoder data ships ~25 KB gz; we only
 * pay that when a user expands a log entry for the first time (DEC-009 +
 * DEC-012's perf note: don't tokenise eagerly).
 *
 * The first {@link estimateTokens} call dynamic-imports the o200k_base
 * encoder; subsequent calls re-use the resolved module.
 */

type Encoder = { encode(text: string): number[] };

let encoderPromise: Promise<Encoder> | null = null;

function loadEncoder(): Promise<Encoder> {
  if (encoderPromise) return encoderPromise;
  encoderPromise = import('gpt-tokenizer/encoding/o200k_base').then((m) => m as unknown as Encoder);
  return encoderPromise;
}

/**
 * Returns the estimated token count for `value` using `o200k_base`.
 * Resolves once the encoder has loaded.
 *
 * The input is JSON-stringified without indentation — token counts are about
 * "what would this cost in an LLM context", and frontier APIs don't see the
 * pretty-printer's whitespace.
 */
export async function estimateTokens(value: unknown): Promise<number> {
  const enc = await loadEncoder();
  return enc.encode(JSON.stringify(value)).length;
}

/** Test hook: reset the cached module so a fresh import happens next call. */
export function __resetTokenizerForTests(): void {
  encoderPromise = null;
}
