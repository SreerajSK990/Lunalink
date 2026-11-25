import { ErrorCode } from "./ErrorCode.js";
import { LunalinkError, type LunalinkErrorOptions } from "./LunalinkError.js";

/**
 * A value passed to Lunalink was out of range or the wrong type. Thrown before anything is sent
 * to a node, so nothing changed.
 */
export class ValidationError extends LunalinkError {
  /** Name of the bad field or argument, for example `options.nodes[0].port`. */
  readonly field: string;

  /**
   * Creates the error.
   *
   * @param field - The bad field or argument.
   * @param message - What was wrong and what is allowed.
   * @param isOption - `true` for constructor options, `false` for method arguments.
   * @param options - Cause and extra details.
   */
  constructor(
    field: string,
    message: string,
    isOption = false,
    options: LunalinkErrorOptions = {},
  ) {
    super(isOption ? ErrorCode.InvalidOption : ErrorCode.InvalidArgument, `${field}: ${message}`, {
      ...options,
      details: { ...options.details, field },
    });
    this.field = field;
  }
}
