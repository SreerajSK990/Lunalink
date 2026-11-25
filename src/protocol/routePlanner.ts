/**
 * The IP rotation strategies Lavalink supports.
 */
export type ApiRoutePlannerClass =
  | "RotatingIpRoutePlanner"
  | "NanoIpRoutePlanner"
  | "RotatingNanoIpRoutePlanner"
  | "BalancingIpRoutePlanner";

/**
 * The configured IP block.
 */
export interface ApiIpBlock {
  /** `Inet4Address` or `Inet6Address`. */
  type: "Inet4Address" | "Inet6Address";
  /** Size of the block. */
  size: string;
}

/**
 * An address the server stopped using because it got rate limited or banned.
 */
export interface ApiFailingAddress {
  /** The address. */
  failingAddress: string;
  /** When it failed, in Unix milliseconds. */
  failingTimestamp: number;
  /** When it failed, as a readable string. */
  failingTime: string;
}

/**
 * Route planner details. Which optional fields are present depends on the planner class.
 */
export interface ApiRoutePlannerDetails {
  /** The configured IP block. */
  ipBlock: ApiIpBlock;
  /** Addresses that are currently marked as failing. */
  failingAddresses: ApiFailingAddress[];
  /** Number of rotations. `RotatingIpRoutePlanner` only. */
  rotateIndex?: string;
  /** Current offset in the block. `RotatingIpRoutePlanner` only. */
  ipIndex?: string;
  /** Address in use. `RotatingIpRoutePlanner` only. */
  currentAddress?: string;
  /** Current offset in the block. Nano planners only. */
  currentAddressIndex?: string;
  /** Which /64 block is in use. `RotatingNanoIpRoutePlanner` only. */
  blockIndex?: string;
}

/**
 * Response of `GET /v4/routeplanner/status` when a route planner is configured. When none is
 * configured the server answers 204 with no body.
 */
export interface ApiRoutePlannerStatus {
  /** Planner implementation in use. */
  class: ApiRoutePlannerClass | null;
  /** Planner details. */
  details: ApiRoutePlannerDetails | null;
}
