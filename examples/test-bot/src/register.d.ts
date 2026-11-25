import "lunalink";

declare module "lunalink" {
  interface Register {
    requester: { id: string; tag: string };
  }
}
