# Rerunning this reproduction

The scripts import Medusa's real source files. They do not reimplement
anything. Paths in `shim/*.ts` and `repro.ts` are relative and expect the clone
two directories up, at `../hunt/medusa`, so put this directory and the clone
side by side.

    mkdir -p ~/medusa-repro/hunt
    git clone https://github.com/arian-gogani/medusa-campaign-budget-repro.git ~/medusa-repro/repro
    git clone https://github.com/medusajs/medusa.git ~/medusa-repro/hunt/medusa
    git -C ~/medusa-repro/hunt/medusa checkout 146c46b0ad1146b40595c8ef586c4d5890982603
    cd ~/medusa-repro/repro && npm install --no-fund --no-audit bignumber.js@9 esbuild zod@4.2.0
    cd ~/medusa-repro/repro && node build.cjs repro.ts

`output-at-146c46b0a.txt` is the output recorded on 2026-10-12 at that SHA.

There are four more scripts. Each is independent of the others and none of them
changes what `build.cjs repro.ts` does.

    cd ~/medusa-repro/repro && node build-tapped.cjs probe.ts
    cd ~/medusa-repro/repro && node build-validator.cjs validator-probe.ts
    cd ~/medusa-repro/repro && node build-register.cjs register-probe.ts
    cd ~/medusa-repro/repro && node build.cjs maxqty-probe.ts

`probe.ts` answers "what is the budget guard actually comparing". It runs the
same `computeActionForBudgetExceeded` from the clone, but through
`build-tapped.cjs`, which points the `@medusajs/framework/utils` alias at
`shim/framework-utils-tapped.ts` instead of `shim/framework-utils.ts`. The only
difference between those two files is that the tapped one wraps `MathBN` in a
recorder: every call is forwarded to the real `MathBN` from the clone and its
arguments are printed. No arithmetic is reimplemented. Recorded output is in
`output-probe-at-146c46b0a.txt`.

`validator-probe.ts` answers "does the Admin API accept the type". It imports
the real `AdminCreateCampaign`, `AdminUpdateCampaign`, `AdminCreatePromotion`
and `AdminUpdatePromotion` from
`packages/medusa/src/api/admin/{campaigns,promotions}/validators.ts` in the
clone and calls `safeParse` on request bodies. `build-validator.cjs` resolves
`@medusajs/framework/zod` to zod 4.2.0, the version pinned in the clone's root
`package.json`, and `@medusajs/framework/utils` to
`shim/framework-utils-plus.ts`, which is `shim/framework-utils.ts` plus
`ProductStatus` (the validator barrel reaches for it). Recorded output is in
`output-validator-at-146c46b0a.txt`.

`register-probe.ts` answers "what does the other rule say". It loads
`packages/modules/promotion/src/services/promotion-module.ts` from the clone and
calls the real `registerUsage` off `PromotionModuleService.prototype`, so the
real `@InjectTransactionManager()` / `@EmitEvents()` / `@MedusaContext()`
decorator stack applies. `registerUsage` needs a database and a DI container, so
five things are replaced by in-memory recorders: `listActivePromotions_`, the
three `*Service_.update` writers, and the knex transaction context. None of them
is arithmetic. The accumulation loop, the `MathBN` calls and the limit guard are
medusa's. The script prints what it executed and what it replaced, and it
includes two controls: `registerUsage` still refuses to run without a
transaction, and it still refuses a genuinely exhausted budget.

`build-register.cjs` differs from `build.cjs` in three resolutions, each
commented in the file: `@medusajs/framework/utils` to
`shim/framework-utils-register.ts`, `@models` to `shim/models-stub.ts`, and
`@types` to the promotion module's own real `src/types` barrel in the clone. The
core/utils "common" barrel goes to `shim/common-lite-register.ts`, which is
`shim/common-lite.ts` plus the three string helpers
`packages/core/utils/src/event-bus/utils.ts` imports. Recorded output is in
`output-register-at-146c46b0a.txt`.

`db-probe.sql` answers "does the schema accept the type". It needs a Postgres
you can create a database in. The two DDL statements in it are copied verbatim
from `Migration20240227120221.ts` and `Migration20250909083125.ts` in the clone.

    psql -d postgres -c "CREATE DATABASE nbx_medusa_probe;"
    psql -d nbx_medusa_probe -f db-probe.sql

Recorded output is in `output-db-at-146c46b0a.txt`. The last statement in the
file is a deliberate failure: it is the control showing the check constraint
does reject a type that is not in the enum.

`build.cjs` bundles the entry point together with the clone's sources and then
requires the bundle. Two aliases are shimmed, and both only redirect to real
medusa source files:

- `@medusajs/framework/utils` to `shim/framework-utils.ts`, which re-exports the
  real implementations from the files that define them.
- `packages/core/utils/src/common/index.ts` to `shim/common-lite.ts`, which
  re-exports the same individual sources. The real barrel re-exports every file
  in that directory, including ones that import mikro-orm and dotenv, none of
  which is on the code path under test.

`shim/anything.cjs` is a no-op stub for infrastructure packages that the barrels
reach for and that are never called here.

The clone itself is never modified.

Verified on 2026-10-12: `repro.ts`, `probe.ts`, `validator-probe.ts`,
`register-probe.ts` and `maxqty-probe.ts` each produce their recorded output
byte for byte. `db-probe.sql` reproduces except for the two
environment-dependent fields psql prints, the absolute path in its error prefix
and the row's `created_at`/`updated_at`; the constraint definition, the INSERT,
the stored row and the control failure all match. `repro.ts`, `probe.ts`,
`validator-probe.ts`, `db-probe.sql`, `build.cjs`, `build-tapped.cjs`,
`build-validator.cjs`, `tsconfig.json`, `shim/framework-utils.ts`,
`shim/framework-utils-tapped.ts`, `shim/framework-utils-plus.ts`,
`shim/common-lite.ts` and `shim/anything.cjs` were not edited.

`shim/empty.ts` is new. `tsconfig.json` already pointed four type-only path
aliases at it and the file was missing, so those aliases previously fell through
to `shim/anything.cjs`. The earlier probes were re-run with the file present.
