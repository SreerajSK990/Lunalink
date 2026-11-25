import type { CapabilitySet } from "../capabilities/CapabilitySet.js";
import { UnsupportedFeatureError } from "../errors/UnsupportedFeatureError.js";
import { ValidationError } from "../errors/ValidationError.js";
import { assertLinkAllowed, type LinkRules } from "./linkRules.js";
import { isLink, readTypedPrefix, searchPlatforms, type SearchPlatformName } from "./platforms.js";

/**
 * How to turn a query into an identifier.
 */
export interface IdentifierOptions {
  /** Platform to search on. */
  source: SearchPlatformName | undefined;
  /** Platform used when `source` isn't given. */
  defaultSource: SearchPlatformName;
  /** Link allow and deny lists. */
  linkRules: LinkRules;
  /** Capabilities of the node that will run the search. */
  capabilities: CapabilitySet | null;
  /** Node id, for errors. */
  nodeId: string;
}

/**
 * Turns user input into what `/v4/loadtracks` expects.
 *
 * Links pass through after the link rules are checked. Text that already starts with a prefix
 * (`scsearch:lofi`) passes through unchanged. Anything else gets the platform's prefix.
 *
 * @param query - User input.
 * @param options - Platform, rules and node capabilities.
 * @returns The identifier.
 * @throws {ValidationError} For empty input or a refused link.
 * @throws {UnsupportedFeatureError} When the node lacks the platform's source.
 */
export function buildIdentifier(query: string, options: IdentifierOptions): string {
  const text = query.trim();
  if (text.length === 0) throw new ValidationError("query", "is empty");
  if (isLink(text)) {
    assertLinkAllowed(text, options.linkRules);
    return text;
  }
  if (options.source === undefined && readTypedPrefix(text) !== null) return text;
  const name = options.source ?? options.defaultSource;
  const platform = searchPlatforms[name];
  const capabilities = options.capabilities;
  if (capabilities && !platform.sources.some((source) => capabilities.has(`source:${source}`))) {
    throw new UnsupportedFeatureError(
      `source:${platform.sources[0]}`,
      options.nodeId,
      `Searching ${name} needs the ${platform.sources.join(" or ")} source on the node.`,
    );
  }
  return `${platform.prefix}:${text}`;
}
