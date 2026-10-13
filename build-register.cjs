// Bundle a repro entry point together with the real medusa sources from the
// clone. Same as build.cjs except for the resolutions marked below, which are
// what it takes to load packages/modules/promotion/src/services/promotion-module.ts
// without a database or a DI container. See shim/framework-utils-register.ts
// and shim/models-stub.ts for what is real and what is a stand-in.
const esbuild = require("esbuild")
const fs = require("fs")
const path = require("path")

const entry = process.argv[2]
if (!entry) {
  console.error("usage: node build-register.cjs <entry.ts>")
  process.exit(1)
}

const tsconfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, "tsconfig.json"), "utf8")
)

const REAL = new Set(["bignumber.js"])
const stubPlugin = {
  name: "stub-infra",
  setup(build) {
    build.onResolve({ filter: /(^|\/)(\.\.\/)*common$/ }, (args) => {
      const resolved = path.resolve(args.resolveDir, args.path)
      if (resolved.endsWith("/packages/core/utils/src/common")) {
        return { path: path.join(__dirname, "shim", "common-lite-register.ts") }
      }
      return undefined
    })
    // Difference 1 from build.cjs: "@medusajs/framework/utils" resolves to the
    // register shim, which re-exports the real implementations plus the real
    // decorator stack, and stands in for MedusaService and toMikroORMEntity.
    build.onResolve({ filter: /^@medusajs\/framework\/utils$/ }, () => ({
      path: path.join(__dirname, "shim", "framework-utils-register.ts"),
    }))
    // Difference 2 from build.cjs: "@models" resolves to inert markers rather
        // than the mikro-orm-backed DML definitions.
    build.onResolve({ filter: /^@models$/ }, () => ({
      path: path.join(__dirname, "shim", "models-stub.ts"),
    }))
    // Difference 3 from build.cjs: "@types" resolves to the promotion module's
    // own real src/types barrel in the clone, which promotion-module.ts needs
    // for the ApplicationMethodRuleTypes enum.
    build.onResolve({ filter: /^@types$/ }, () => ({
      path: path.join(
        __dirname,
        "..",
        "hunt",
        "medusa",
        "packages",
        "modules",
        "promotion",
        "src",
        "types",
        "index.ts"
      ),
    }))
    build.onResolve({ filter: /^[^.\/]/ }, (args) => {
      if (
        REAL.has(args.path) ||
        args.path.startsWith("@medusajs/framework") ||
        args.path === "@medusajs/types" ||
        args.path === "@models" ||
        args.path === "@types"
      ) {
        return undefined
      }
      if (require("module").isBuiltin(args.path.replace(/^node:/, ""))) {
        return { path: args.path, external: true }
      }
      return { path: path.join(__dirname, "shim", "anything.cjs") }
    })
  },
}

esbuild
  .build({
    plugins: [stubPlugin],
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    outfile: path.join(
      __dirname,
      "out",
      path.basename(entry).replace(/\.ts$/, ".cjs")
    ),
    absWorkingDir: __dirname,
    tsconfigRaw: { compilerOptions: tsconfig.compilerOptions },
    logLevel: "error",
    logOverride: { "require-resolve-not-external": "silent" },
  })
  .then(() => {
    require(path.join(
      __dirname,
      "out",
      path.basename(entry).replace(/\.ts$/, ".cjs")
    ))
  })
  .catch((e) => {
    console.error(e && e.message)
    process.exit(1)
  })
