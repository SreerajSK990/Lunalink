import js from "@eslint/js";
import jsdoc from "eslint-plugin-jsdoc";
import tseslint from "typescript-eslint";

const jsdocOnlyComments = {
  meta: {
    type: "suggestion",
    docs: { description: "Allow JSDoc blocks only. Line and plain block comments are rejected." },
    schema: [],
    messages: { notJsdoc: "Only JSDoc comments (/** ... */) are allowed." },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          const isJsdoc = comment.type === "Block" && comment.value.startsWith("*");
          if (!isJsdoc) context.report({ loc: comment.loc, messageId: "notJsdoc" });
        }
      },
    };
  },
};

export default tseslint.config(
  { ignores: ["dist", "coverage", "node_modules", "research", "examples/**/dist"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["*.config.ts", "*.config.js", ".dependency-cruiser.cjs"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { lunalink: { rules: { "jsdoc-only-comments": jsdocOnlyComments } } },
    rules: {
      "lunalink/jsdoc-only-comments": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-inferrable-types": "off",
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/consistent-type-exports": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "no-console": "error",
      eqeqeq: ["error", "always"],
      "max-lines": ["error", { max: 1000, skipBlankLines: false, skipComments: false }],
    },
  },
  {
    files: ["src/**/*.ts"],
    plugins: { jsdoc },
    settings: { jsdoc: { mode: "typescript" } },
    rules: {
      ...jsdoc.configs["flat/recommended-typescript-error"].rules,
      "jsdoc/require-jsdoc": [
        "error",
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            ClassDeclaration: true,
            MethodDefinition: true,
            ArrowFunctionExpression: false,
            FunctionExpression: false,
          },
          contexts: [
            "TSInterfaceDeclaration",
            "TSTypeAliasDeclaration",
            "TSEnumDeclaration",
            "TSPropertySignature",
            "ExportNamedDeclaration > VariableDeclaration",
            "ClassBody > PropertyDefinition[accessibility!='private']",
          ],
        },
      ],
      "jsdoc/require-description": "error",
      "jsdoc/tag-lines": ["error", "any", { startLines: 1 }],
    },
  },
  {
    files: ["**/*.js", "**/*.cjs", "*.config.ts"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ["**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { module: "writable", require: "readonly" },
    },
  },
  {
    files: ["test/**/*.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "max-lines": "off",
    },
  },
);
