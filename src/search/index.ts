export {
  isLink,
  readTypedPrefix,
  recommendationPrefixes,
  searchPlatforms,
  type SearchPlatform,
  type SearchPlatformName,
} from "./platforms.js";
export { assertLinkAllowed, type LinkRules } from "./linkRules.js";
export { buildIdentifier, type IdentifierOptions } from "./buildIdentifier.js";
export { mirrorQueries, pickBestMatch, scoreCandidate } from "./mirror.js";
