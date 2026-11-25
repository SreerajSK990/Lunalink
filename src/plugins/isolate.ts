import { ErrorCode } from "../errors/ErrorCode.js";
import { LunalinkError } from "../errors/LunalinkError.js";

/**
 * Called when a plugin call throws or times out.
 */
export type PluginErrorHandler = (pluginName: string, label: string, error: unknown) => void;

/**
 * Settings for {@link isolate}.
 */
export interface IsolateOptions<F> {
  /** How long the call may take, in milliseconds. */
  timeoutMs: number;
  /** Value returned when the call fails. */
  fallback: F;
  /** Reports the failure. */
  onError: PluginErrorHandler;
}

/**
 * Runs a plugin call with a timeout. A failure is reported and turned into `fallback`, so one
 * broken plugin never stops playback.
 *
 * @param pluginName - Plugin that owns the call.
 * @param label - What the call does, for the error report.
 * @param task - The call. Receives a signal that aborts on timeout.
 * @param options - Timeout, fallback value and error handler.
 * @returns The call's result, or the fallback.
 */
export async function isolate<T, F>(
  pluginName: string,
  label: string,
  task: (signal: AbortSignal) => T | Promise<T>,
  options: IsolateOptions<F>,
): Promise<T | F> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(
        new LunalinkError(
          ErrorCode.PluginFailed,
          `Plugin "${pluginName}" took longer than ${String(options.timeoutMs)} ms (${label}).`,
          { details: { plugin: pluginName, label } },
        ),
      );
    }, options.timeoutMs);
  });
  try {
    return await Promise.race([Promise.resolve().then(() => task(controller.signal)), timeout]);
  } catch (error) {
    options.onError(pluginName, label, error);
    return options.fallback;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Runs a synchronous plugin call. A throw is reported and turned into `fallback`.
 *
 * @param pluginName - Plugin that owns the call.
 * @param label - What the call does.
 * @param task - The call.
 * @param fallback - Value on failure.
 * @param onError - Error handler.
 * @returns The result, or the fallback.
 */
export function isolateSync<T, F>(
  pluginName: string,
  label: string,
  task: () => T,
  fallback: F,
  onError: PluginErrorHandler,
): T | F {
  try {
    return task();
  } catch (error) {
    onError(pluginName, label, error);
    return fallback;
  }
}
