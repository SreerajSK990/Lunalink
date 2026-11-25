/**
 * A cleanup step registered with {@link Disposer}.
 */
export type DisposeStep = () => void | Promise<void>;

/**
 * Collects cleanup steps (remove a listener, close a socket, and so on) and runs them in reverse
 * order. One failing step never stops the others from running.
 *
 * @example
 * ```ts
 * const disposer = new Disposer();
 * emitter.on("raw", onRaw);
 * disposer.add(() => emitter.off("raw", onRaw));
 * const errors = await disposer.dispose();
 * ```
 */
export class Disposer {
  #steps: DisposeStep[] = [];
  #disposed = false;

  /**
   * Whether {@link Disposer.dispose} has already run.
   *
   * @returns `true` after disposal.
   */
  get disposed(): boolean {
    return this.#disposed;
  }

  /**
   * Registers a cleanup step. If the disposer has already run, the step runs right away.
   *
   * @param step - Cleanup function.
   */
  add(step: DisposeStep): void {
    if (this.#disposed) {
      void Promise.resolve()
        .then(step)
        .catch(() => undefined);
      return;
    }
    this.#steps.push(step);
  }

  /**
   * Runs every step, newest first. Calling it again does nothing.
   *
   * @returns Errors thrown by steps. Empty when everything went fine.
   */
  async dispose(): Promise<unknown[]> {
    if (this.#disposed) return [];
    this.#disposed = true;
    const steps = this.#steps.reverse();
    this.#steps = [];
    const errors: unknown[] = [];
    for (const step of steps) {
      try {
        await step();
      } catch (error) {
        errors.push(error);
      }
    }
    return errors;
  }
}
