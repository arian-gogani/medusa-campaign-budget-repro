// Bundle the clone's real Admin API campaign validator so it can be executed.
// Aliases: "@medusajs/framework/zod" -> the real zod 4.2.0 (the version pinned
// in the clone's root package.json), "@medusajs/framework/utils" -> shim that
// re-exports the clone's own CampaignBudgetType and isPresent.
const esbuild = require("esbuild")
const path = require("path")

const entry = process.argv[2]
if (!entry) {
  console.error("usage: node build-validator.cjs <entry.ts>")
  process.exit(1)
}

const plugin = {
  name: "alias",
  setup(build) {
    build.onResolve({ filter: /^@medusajs\/framework\/zod$/ }, () => ({
      path: require.resolve("zod", { paths: [__dirname] }),
    }))
    build.onResolve({ filter: /^@medusajs\/framework\/utils$/ }, () => ({
      path: path.join(__dirname, "shim", "framework-utils-plus.ts"),
    }))
    build.onResolve({ filter: /^(@medusajs\/framework\/types|@medusajs\/types)$/ }, () => ({
      path: path.join(__dirname, "shim", "anything.cjs"),
    }))
    build.onResolve({ filter: /(^|\/)(\.\.\/)*common$/ }, (args) => {
      const resolved = path.resolve(args.resolveDir, args.path)
      if (resolved.endsWith("/packages/core/utils/src/common")) {
        return { path: path.join(__dirname, "shim", "common-lite.ts") }
      }
      return undefined
    })
    build.onResolve({ filter: /^[^.\/]/ }, (args) => {
      if (args.path === "zod") return undefined
      if (args.path === "bignumber.js") {
        return { path: require.resolve("bignumber.js", { paths: [__dirname] }) }
      }
      if (require("module").isBuiltin(args.path.replace(/^node:/, ""))) {
        return { path: args.path, external: true }
      }
      return { path: path.join(__dirname, "shim", "anything.cjs") }
    })
  },
}

const out = path.join(
  __dirname,
  "out",
  path.basename(entry).replace(/\.ts$/, ".cjs")
)

esbuild
  .build({
    plugins: [plugin],
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    outfile: out,
    absWorkingDir: __dirname,
    tsconfigRaw: {
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        moduleResolution: "node",
        experimentalDecorators: true,
        esModuleInterop: true,
        skipLibCheck: true,
      },
    },
    logLevel: "error",
    logOverride: { "require-resolve-not-external": "silent" },
  })
  .then(() => require(out))
  .catch((e) => {
    console.error(e && e.message)
    process.exit(1)
  })
