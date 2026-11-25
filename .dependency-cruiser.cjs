const layers = [
  "protocol",
  "utils",
  "errors",
  "events",
  "transport",
  "capabilities",
  "drivers",
  "node",
  "track",
  "queue",
  "filters",
  "search",
  "voice",
  "features",
  "player",
  "lifecycle",
  "stores",
  "plugins",
  "core",
];

const layerRules = layers.map((layer, index) => {
  const higher = layers.slice(index + 1);
  return {
    name: `layer-${layer}`,
    comment: `src/${layer} may only import from itself or lower layers`,
    severity: "error",
    from: { path: `^src/${layer}/` },
    to: { path: higher.length > 0 ? `^src/(${higher.join("|")})/` : "^$" },
  };
});

module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-orphans",
      severity: "warn",
      from: { orphan: true, pathNot: ["\\.d\\.ts$", "^src/index\\.ts$"] },
      to: {},
    },
    {
      name: "no-runtime-dependencies",
      comment: "Lunalink ships with zero runtime dependencies",
      severity: "error",
      from: { path: "^src/" },
      to: { dependencyTypes: ["npm", "npm-dev", "npm-optional", "npm-peer", "npm-no-pkg"] },
    },
    {
      name: "extensions-use-public-api",
      comment:
        "adapters, built-in stores and built-in plugins only use the public barrel or protocol types",
      severity: "error",
      from: { path: "^src/(adapters|stores-builtin|plugins-builtin)/" },
      to: {
        path: "^src/",
        pathNot: [
          "^src/index\\.ts$",
          "^src/protocol/",
          "^src/(adapters|stores-builtin|plugins-builtin)/",
        ],
      },
    },
    ...layerRules,
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
  },
};
