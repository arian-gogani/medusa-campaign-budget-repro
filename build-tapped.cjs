// Bundle a repro entry point together with the real medusa sources from the
// clone. --tsconfig equivalent: tsconfigRaw is applied to every input file, so
// the decorators in medusa's barrel files parse.
const esbuild = require("esbuild")
const fs = require("fs")
const path = require("path")

const entry = process.argv[2]
if (!entry) {
  console.error("usage: node build-tapped.cjs <entry.ts>")
  process.exit(1)
}

const tsconfig = JSON.parse(fs.readFileSync(path.join(__dirname, "tsconfig.json"), "utf8"))

// Only bignumber.js is a real runtime dependency of the code under test.
// Everything else that medusa's barrel files reach for is infrastructure that
// is never called on this path, so it resolves to the no-op stub.
const REAL = new Set(["bignumber.js"])
const stubPlugin = {
  name: "stub-infra",
  setup(build) {
    // Redirect the core/utils "common" barrel to a lite version. See
    // shim/common-lite.ts for why.
    build.onResolve({ filter: /(^|\/)(\.\.\/)*common$/ }, (args) => {
      const resolved = path.resolve(args.resolveDir, args.path)
      if (resolved.endsWith("/packages/core/utils/src/common")) {
        return { path: path.join(__dirname, "shim", "common-lite.ts") }
      }
      return undefined
    })
    // The one difference from build.cjs: "@medusajs/framework/utils" resolves to
    // the tapped shim, which delegates every MathBN call to the real MathBN in
    // the clone and records the arguments it was given.
    build.onResolve({ filter: /^@medusajs\/framework\/utils$/ }, () => ({
      path: path.join(__dirname, "shim", "framework-utils-tapped.ts"),
    }))
    build.onResolve({ filter: /^[^.\/]/ }, (args) => {
      // Let esbuild's own tsconfig "paths" resolution handle these: they map to
      // the shim barrel that re-exports the real medusa sources.
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

esbuild.build({
  plugins: [stubPlugin],
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  outfile: path.join(__dirname, "out", path.basename(entry).replace(/\.ts$/, ".cjs")),
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
