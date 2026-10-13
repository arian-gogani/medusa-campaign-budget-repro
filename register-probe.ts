/*
 * Reproduction against medusajs/medusa @ 146c46b0ad1146b40595c8ef586c4d5890982603
 *
 * Runs BOTH rules that measure a `spend` campaign budget, over the same four
 * carts, and prints their verdicts side by side.
 *
 *   rule A, the compute path:  getComputedActionsForItems, from
 *     packages/modules/promotion/src/utils/compute-actions/line-items.ts
 *     (which calls computeActionForBudgetExceeded per item)
 *
 *   rule B, the register path: PromotionModuleService.prototype.registerUsage,
 *     from packages/modules/promotion/src/services/promotion-module.ts:305
 *
 * Neither is reimplemented. Both are imported from the clone. For rule B the
 * class is loaded with no database and no DI container, so the persistence
 * layer is replaced by recorders. What is real and what is a stand-in is
 * printed by the script itself, below the verdicts.
 */
import PromotionModuleService from "../hunt/medusa/packages/modules/promotion/src/services/promotion-module"
import { getComputedActionsForItems } from "../hunt/medusa/packages/modules/promotion/src/utils/compute-actions/line-items"
import { MathBN } from "./shim/framework-utils-register"

const line = (s = "") => console.log(s)
const rule = (t: string) => {
  line()
  line("=".repeat(78))
  line(t)
  line("=".repeat(78))
}

/* ------------------------------------------------------------------ *
 * Fixtures. Identical in shape to repro.ts.
 * ------------------------------------------------------------------ */
function budget(type: string, limit: number | null, used = 0) {
  return {
    id: "probudg_1",
    type,
    limit,
    used,
    currency_code: "usd",
    attribute: "customer_id",
  }
}

function promotion(opts: {
  budgetType: string
  limit: number | null
  used?: number
}) {
  return {
    id: "promo_1",
    code: "SAVE",
    is_tax_inclusive: false,
    campaign: {
      id: "camp_1",
      budget: budget(opts.budgetType, opts.limit, opts.used ?? 0),
    },
    application_method: {
      type: "percentage",
      target_type: "items",
      allocation: "each",
      value: 50,
      max_quantity: 1,
      target_rules: [],
    },
  } as any
}

function item(id: string, subtotal: number, quantity = 1) {
  return {
    id,
    quantity,
    subtotal,
    original_total: subtotal,
    is_discountable: true,
  } as any
}

/* ------------------------------------------------------------------ *
 * The stand-in persistence layer for registerUsage.
 *
 * registerUsage touches the database in five places. Each is replaced by an
 * in-memory recorder. The accumulation loop, the MathBN arithmetic and the
 * limit guard are untouched medusa code.
 * ------------------------------------------------------------------ */
function makeService(promotionRows: any[], withTransaction = true) {
  const writes: { service: string; data: any }[] = []
  const lockedTables: string[] = []
  const rawSql: string[] = []
  const listCalls: string[] = []

  const svc: any = Object.create(PromotionModuleService.prototype)

  // 1. the budget/promotion read, twice (before and after the row locks).
  //    Returns the same objects both times, which is what a re-read inside the
  //    same transaction would give: promotion-module.ts:332 says the refresh is
  //    there "so a surrounding transaction's pending state is preserved".
  svc.listActivePromotions_ = async (filters: any) => {
    listCalls.push(JSON.stringify(filters))
    return promotionRows
  }

  // 2, 3, 4. the three writers.
  svc.promotionService_ = {
    update: async (d: any) => {
      writes.push({ service: "promotion", data: d })
      return d
    },
  }
  svc.campaignBudgetService_ = {
    update: async (d: any) => {
      writes.push({ service: "promotion_campaign_budget", data: d })
      return d
    },
  }
  svc.campaignBudgetUsageService_ = {
    list: async () => [],
    create: async (d: any) => {
      writes.push({ service: "promotion_campaign_budget_usage", data: d })
      return d
    },
    update: async (d: any) => {
      writes.push({ service: "promotion_campaign_budget_usage", data: d })
      return d
    },
  }

  // 5. the knex transaction context used for SELECT ... FOR UPDATE.
  const knex: any = (table: string) => {
    lockedTables.push(table)
    const chain: any = {}
    chain.whereIn = () => chain
    chain.orderBy = () => chain
    chain.forUpdate = () => chain
    chain.select = async () => []
    return chain
  }
  knex.raw = async (sql: string) => {
    rawSql.push(sql)
    return []
  }

  const context: any = {
    transactionManager: {
      getTransactionContext: () => (withTransaction ? knex : undefined),
    },
  }

  return { svc, context, writes, lockedTables, rawSql, listCalls }
}

async function registerVerdict(
  budgetType: string,
  limit: number | null,
  used: number,
  usageActions: { amount: any; code: string }[]
) {
  const row = promotion({ budgetType, limit, used })
  const h = makeService([row])
  try {
    await h.svc.registerUsage(usageActions, { customer_id: "cus_1" }, h.context)
    return {
      verdict: "ACCEPT",
      detail: "",
      usedAfter: String(row.campaign.budget.used),
      writes: h.writes,
      lockedTables: h.lockedTables,
      rawSql: h.rawSql,
      listCalls: h.listCalls,
    }
  } catch (e: any) {
    return {
      verdict: "REFUSE",
      detail: `${e.type}: ${e.message}`,
      usedAfter: String(row.campaign.budget.used),
      writes: h.writes,
      lockedTables: h.lockedTables,
      rawSql: h.rawSql,
      listCalls: h.listCalls,
    }
  }
}

/* ------------------------------------------------------------------ *
 * PART 0: prove the real registerUsage is the thing being called.
 * ------------------------------------------------------------------ */
async function main() {
  rule("PART 0  the real registerUsage is loaded and runs")

  line(
    "registerUsage is obtained from PromotionModuleService.prototype, so the real"
  )
  line(
    "@InjectTransactionManager() / @EmitEvents() / @MedusaContext() decorator"
  )
  line("stack from the clone is in place. Three checks that it is the real one:")
  line()

  const ok = await registerVerdict("spend", 1000, 0, [
    { amount: 50, code: "SAVE" },
  ])
  line(`  method is a function on the prototype: ${typeof (PromotionModuleService.prototype as any).registerUsage}`)
  line(`  trivial registration, limit 1000, one 50 adjustment: ${ok.verdict}`)
  line(`  budget row it wrote: ${JSON.stringify(ok.writes)}`)
  line(`  rows it locked FOR UPDATE: ${JSON.stringify(ok.lockedTables)}`)
  line(`  raw SQL it issued: ${JSON.stringify(ok.rawSql)}`)
  line()
  line(
    "CONTROL: the transaction requirement at promotion-module.ts:349 is real."
  )
  line("Same call with getTransactionContext() returning undefined:")
  const noTx = makeService([promotion({ budgetType: "spend", limit: 1000 })], false)
  try {
    await noTx.svc.registerUsage(
      [{ amount: 50, code: "SAVE" }],
      { customer_id: "cus_1" },
      noTx.context
    )
    line("  ACCEPT  (unexpected)")
  } catch (e: any) {
    line(`  REFUSE  ${e.type}: ${e.message}`)
  }

  line()
  line("CONTROL: a genuinely exhausted budget is refused by registerUsage.")
  const exhausted = await registerVerdict("spend", 100, 100, [
    { amount: 50, code: "SAVE" },
  ])
  line(`  limit 100, used 100, one 50 adjustment: ${exhausted.verdict}  ${exhausted.detail}`)

  /* ------------------------------------------------------------------ *
   * PART 1: both rules, same four carts.
   * ------------------------------------------------------------------ */
  rule("PART 1  rule A (compute) and rule B (register), same cart, side by side")

  line("Same $300 of goods, same 50%-off-each promotion, same $100 or $1000 budget.")
  line("The only difference between rows is whether the goods arrive as one line")
  line("or three.")
  line()
  line("rule A = getComputedActionsForItems, the function update-cart-promotions runs")
  line("rule B = PromotionModuleService.registerUsage, the function complete-cart runs")
  line("         fed the adjustments rule A produced, mapped the way")
  line("         complete-cart.ts:592 maps them: { amount, code } per adjustment")
  line()

  type Scenario = {
    label: string
    items: any[]
    limit: number
  }

  const threeItems = [item("i1", 100), item("i2", 100), item("i3", 100)]
  const oneItem = [item("i1", 300)]

  const scenarios: Scenario[] = [
    { label: "3 x $100 lines, limit 1000", items: threeItems, limit: 1000 },
    { label: "1 x $300 line,  limit 1000", items: oneItem, limit: 1000 },
    { label: "3 x $100 lines, limit 100", items: threeItems, limit: 100 },
    { label: "1 x $300 line,  limit 100", items: oneItem, limit: 100 },
  ]

  const rows: string[][] = []

  for (const s of scenarios) {
    // rule A
    const actions = getComputedActionsForItems(
      promotion({ budgetType: "spend", limit: s.limit }),
      s.items,
      new Map()
    )
    const adjustments = actions.filter(
      (a: any) => a.action === "addItemAdjustment"
    )
    const exceeded = actions.filter(
      (a: any) => a.action === "campaignBudgetExceeded"
    )
    const total = adjustments.reduce(
      (acc: any, a: any) => MathBN.add(acc, a.amount),
      MathBN.convert(0)
    )

    // rule B, fed exactly what rule A produced
    const usageActions = adjustments.map((a: any) => ({
      amount: a.amount,
      code: a.code,
    }))
    const reg = await registerVerdict("spend", s.limit, 0, usageActions)

    rows.push([
      s.label,
      String(s.limit),
      `discount=${total.toString()} adj=${adjustments.length} exceeded=${exceeded.length}`,
      exceeded.length ? "REFUSE" : "ACCEPT",
      String(usageActions.length),
      reg.verdict,
      reg.verdict === "REFUSE" ? reg.detail : `used -> ${reg.usedAfter}`,
    ])
  }

  const header = [
    "CART",
    "LIMIT",
    "RULE A OUTPUT",
    "RULE A",
    "FED TO B",
    "RULE B",
    "RULE B DETAIL",
  ]
  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i].length))
  )
  const fmt = (r: string[]) =>
    r.map((c, i) => c.padEnd(widths[i])).join("  ")
  line(fmt(header))
  line(widths.map((w) => "-".repeat(w)).join("  "))
  for (const r of rows) {
    line(fmt(r))
  }

  line()
  line("Row 3 is the finding. $150 of discount against a $100 budget: rule A")
  line("permits it when the cart is three lines, and rule B refuses the same")
  line("$150. Row 4 is the same $150 of discount arriving as one line, where")
  line("rule A refuses it. Row 4's rule B column is on an empty input, because")
  line("rule A emitted no adjustments for it to register, so it carries no")
  line("information; PART 1b fixes that by feeding rule B both shapes directly.")

  /* ------------------------------------------------------------------ *
   * PART 1b: rule B is insensitive to the split; rule A is not.
   * ------------------------------------------------------------------ */
  rule("PART 1b  rule B fed the same $150 as 3 adjustments and as 1")

  line("This is the half the earlier pass quoted instead of running. The point")
  line("is that rule B returns the same verdict for both shapes.")
  line()

  const bRows: string[][] = []
  for (const limit of [1000, 100]) {
    for (const shape of [
      { label: "3 adjustments of 50", actions: [50, 50, 50] },
      { label: "1 adjustment of 150", actions: [150] },
    ]) {
      const r = await registerVerdict(
        "spend",
        limit,
        0,
        shape.actions.map((a) => ({ amount: a, code: "SAVE" }))
      )
      bRows.push([
        shape.label,
        String(limit),
        r.verdict,
        r.verdict === "REFUSE" ? r.detail : `used -> ${r.usedAfter}`,
      ])
    }
  }
  const bHeader = ["ADJUSTMENTS FED TO registerUsage", "LIMIT", "RULE B", "DETAIL"]
  const bw = bHeader.map((h, i) =>
    Math.max(h.length, ...bRows.map((r) => r[i].length))
  )
  const bfmt = (r: string[]) => r.map((c, i) => c.padEnd(bw[i])).join("  ")
  line(bfmt(bHeader))
  line(bw.map((w) => "-".repeat(w)).join("  "))
  for (const r of bRows) {
    line(bfmt(r))
  }
  line()
  line("Rule B does not care how the $150 is split. Rule A does. That is the")
  line("disagreement, with both halves executed.")

  /* ------------------------------------------------------------------ *
   * PART 2: the disagreement stated as the two arithmetics.
   * ------------------------------------------------------------------ */
  rule("PART 2  what each rule compares, for the 3-line cart at limit 100")

  line("Rule A, per item, with `used` read from the budget row each time:")
  const perItemPromo = promotion({ budgetType: "spend", limit: 100 })
  const aActions = getComputedActionsForItems(perItemPromo, threeItems, new Map())
  const aAdj = aActions.filter((x: any) => x.action === "addItemAdjustment")
  for (const a of aAdj as any[]) {
    line(
      `  item=${a.item_id}  amount=${a.amount}  budget.used at the time=${perItemPromo.campaign.budget.used}  -> gt(${MathBN.add(
        perItemPromo.campaign.budget.used,
        a.amount
      ).toString()}, 100) = ${MathBN.gt(
        MathBN.add(perItemPromo.campaign.budget.used, a.amount),
        100
      )}`
    )
  }
  line(`  budget.used after rule A ran: ${perItemPromo.campaign.budget.used}`)
  line()
  line("Rule B, over the same three adjustments, accumulating:")
  const bRow = promotion({ budgetType: "spend", limit: 100 })
  const bH = makeService([bRow])
  const seen: string[] = []
  const bActions = (aAdj as any[]).map((a) => ({ amount: a.amount, code: a.code }))
  let running = MathBN.convert(0)
  for (const a of bActions) {
    running = MathBN.add(running, a.amount)
    seen.push(
      `  amount=${a.amount}  running used=${running.toString()}  -> gt(${running.toString()}, 100) = ${MathBN.gt(
        running,
        100
      )}`
    )
  }
  try {
    await bH.svc.registerUsage(bActions, { customer_id: "cus_1" }, bH.context)
    line("  registerUsage: ACCEPT")
  } catch (e: any) {
    line(`  registerUsage: REFUSE  ${e.type}: ${e.message}`)
  }
  line(`  budget.used when it stopped: ${bRow.campaign.budget.used}`)
  line("  the accumulation it was doing, recomputed with the same MathBN:")
  for (const s of seen) {
    line(s)
  }

  /* ------------------------------------------------------------------ *
   * PART 3: what is real and what is a stand-in.
   * ------------------------------------------------------------------ */
  rule("PART 3  what was executed and what was replaced")
  line("EXECUTED, from the clone, unmodified:")
  line("  packages/modules/promotion/src/utils/compute-actions/line-items.ts")
  line("  packages/modules/promotion/src/utils/compute-actions/usage.ts")
  line("  packages/modules/promotion/src/services/promotion-module.ts  registerUsage")
  line("  packages/core/utils/src/totals/math.ts                       MathBN")
  line("  packages/core/utils/src/modules-sdk/decorators/*.ts          the decorator stack")
  line("  packages/core/utils/src/common/errors.ts                     MedusaError")
  line()
  line("REPLACED, none of it arithmetic:")
  line("  this.listActivePromotions_          -> returns the fixture rows")
  line("  this.promotionService_.update       -> recorder")
  line("  this.campaignBudgetService_.update  -> recorder")
  line("  this.campaignBudgetUsageService_.*  -> recorder")
  line("  the knex transaction context        -> records SET LOCAL / FOR UPDATE, returns []")
  line("  MedusaService(...)                  -> inert base class with a no-op emitEvents_")
  line("  @models                             -> inert markers")

  /* ------------------------------------------------------------------ *
   * PART 4: ADJACENT, NOT THIS FINDING.
   *
   * The pair in PART 1 holds the discount at $150 across both cart shapes,
   * which is what makes the budget comparison clean. It does that by making
   * the one-line cart a single line of quantity 1 and subtotal 300. A customer
   * who buys three units of one variant instead gets one line of quantity 3,
   * and that is a different cart. Printed here so the finding does not
   * overstate what a customer can hold constant.
   * ------------------------------------------------------------------ */
  rule("PART 4  ADJACENT OBSERVATION, a different defect, printed for honesty")

  line("`max_quantity` under allocation EACH is applied within one line item.")
  line("Three lines of quantity 1 and one line of quantity 3 are the same goods")
  line("to a customer and not the same discount to the compute path.")
  line()
  line("No campaign budget at all on the promotion, so no budget guard runs:")

  function noBudgetPromo() {
    const p = promotion({ budgetType: "spend", limit: null })
    p.campaign = undefined
    return p
  }

  const shapes: [string, any[]][] = [
    ["3 lines, qty 1, $100 each", [item("i1", 100), item("i2", 100), item("i3", 100)]],
    ["1 line,  qty 3, $300", [item("i1", 300, 3)]],
    ["1 line,  qty 1, $300", [item("i1", 300, 1)]],
  ]
  for (const [label, items] of shapes) {
    const acts = getComputedActionsForItems(noBudgetPromo(), items, new Map())
    const adj = acts.filter((a: any) => a.action === "addItemAdjustment")
    const tot = adj.reduce(
      (acc: any, a: any) => MathBN.add(acc, a.amount),
      MathBN.convert(0)
    )
    line(
      `  ${label.padEnd(28)} -> discount=${tot.toString().padEnd(6)} adjustments=${adj.length}`
    )
  }
  line()
  line("That spread is not the budget defect and is not claimed as part of it.")
  line("It is printed because it is the reason the PART 1 pair uses a quantity-1")
  line("line of $300 rather than a quantity-3 line, and because it needs its own")
  line("pass before anything is said about it.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
