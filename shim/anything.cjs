// Generic stub for infrastructure packages that the medusa barrel files pull in
// (mikro-orm, awilix, ...). None of them are on the code path under test; they
// are only reachable because packages/core/utils/src/common/index.ts re-exports
// every file in that directory. Any property resolves to a no-op function.
function makeStub(name) {
  const fn = function stub() {
    return fn
  }
  fn.displayName = name
  return new Proxy(fn, {
    get(target, prop) {
      if (prop === "__esModule") {
        return true
      }
      if (prop === "default") {
        return target
      }
      if (prop in target) {
        return target[prop]
      }
      return makeStub(String(prop))
    },
    apply() {
      return fn
    },
    construct() {
      return {}
    },
  })
}

module.exports = makeStub("root")
