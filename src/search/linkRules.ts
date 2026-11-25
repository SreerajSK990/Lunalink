import { ValidationError } from "../errors/ValidationError.js";

/**
 * Which links users may load.
 */
export interface LinkRules {
  /** Allow links at all. Defaults to `true`. */
  allowLinks?: boolean;
  /** When set, only links matching one of these are allowed. Strings match the host name. */
  allow?: readonly (string | RegExp)[];
  /** Links matching any of these are refused. Strings match the host name. */
  deny?: readonly (string | RegExp)[];
}

function matches(url: URL, rule: string | RegExp): boolean {
  if (typeof rule === "string") {
    const host = url.hostname.toLowerCase();
    const wanted = rule.toLowerCase();
    return host === wanted || host.endsWith(`.${wanted}`);
  }
  return rule.test(url.href);
}

/**
 * Throws when a link is not allowed by the rules.
 *
 * @param link - The link.
 * @param rules - Allow and deny lists.
 * @throws {ValidationError} When the link is refused.
 */
export function assertLinkAllowed(link: string, rules: LinkRules): void {
  if (rules.allowLinks === false) throw new ValidationError("query", "links are turned off");
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    throw new ValidationError("query", "that isn't a valid link");
  }
  if (rules.deny?.some((rule) => matches(url, rule))) {
    throw new ValidationError("query", `links from ${url.hostname} aren't allowed`);
  }
  if (rules.allow && rules.allow.length > 0 && !rules.allow.some((rule) => matches(url, rule))) {
    throw new ValidationError("query", `links from ${url.hostname} aren't allowed`);
  }
}
