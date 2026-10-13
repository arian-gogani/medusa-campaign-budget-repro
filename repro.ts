/*
 * Reproduction against medusajs/medusa @ 146c46b0ad1146b40595c8ef586c4d5890982603
 *
 * Nothing here reimplements medusa logic. Both functions under test are
 * imported from the clone:
 *   packages/modules/promotion/src/utils/compute-actions/usage.ts
 *   packages/modules/promotion/src/utils/compute-actions/line-items.ts
 */
import { computeActionForBudgetExceeded } from "../hunt/medusa/packages/modules/promotion/src/utils/compute-actions/usage"
import { getComputedActionsForItems } from "../hunt/medusa/packages/modules/promotion/src/utils/compute-actions/line-items"
import { MathBN } from "./shim/framework-utils"

const line = (s = "") => console.log(s)
const rule = (t: string) => {
  line()
  line("=".repeat(78))
  line(t)
  line("=".repeat(78))
}

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
  allocation?: string
  type?: string
  value?: number
  maxQuantity?: number
}) {
  return {
    id: "promo_1",
    code: "SAVE",
    is_tax_inclusive: false,
    campaign: { id: "camp_1", budget: budget(opts.budgetType, opts.limit, opts.used ?? 0) },
    application_method: {
      type: opts.type ?? "percentage",
      target_type: "items",
      allocation: opts.allocation ?? "each",
      value: opts.value ?? 50,
      max_quantity: opts.maxQuantity ?? 1,
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
 * PART 1: the budget guard in isolation.
 * computeActionForBudgetExceeded is a pure function. It returns an
 * action when the budget is exhausted and undefined when it permits.
 * ------------------------------------------------------------------ */
rule("PART 1  computeActionForBudgetExceeded(promotion, amount)")
line("A $1,000 discount is offered against budgets whose limit is stated below.")
line("used = 0 in every row. PERMIT means the function returned no action.")
line()
line(
  "BUDGET TYPE          LIMIT        VERDICT   (discount offered: 1000)"
)

const amount = 1000
const cases: [string, number | null][] = [
  ["spend", 10],
  ["spend", 100000],
  ["usage", 10],
  ["use_by_attribute", 10],
  ["spend_by_attribute", 0.5],
  ["spend_by_attribute", 1],
  ["spend_by_attribute", 10],
  ["spend_by_attribute", 100000],
  ["spend_by_attribute", 0],
  ["spend_by_attribute", null],
  ["spend", 0],
  ["spend", null],
]

for (const [type, limit] of cases) {
  const action = computeActionForBudgetExceeded(
    promotion({ budgetType: type, limit }),
    amount
  )
  line(
    `${type.padEnd(20)} ${String(limit).padEnd(12)} ${
      action ? "REFUSE  (" + action.action + ")" : "PERMIT"
    }`
  )
}

line()
line("Same guard, but the budget is already fully consumed (used = limit):")
line("BUDGET TYPE          LIMIT   USED    VERDICT")
for (const type of ["spend", "usage", "spend_by_attribute"]) {
  const action = computeActionForBudgetExceeded(
    promotion({ budgetType: type, limit: 100, used: 100 }),
    amount
  )
  line(
    `${type.padEnd(20)} ${"100".padEnd(7)} ${"100".padEnd(7)} ${
      action ? "REFUSE  (" + action.action + ")" : "PERMIT"
    }`
  )
}

/* ------------------------------------------------------------------ *
 * PART 2: through the real item loop.
 * getComputedActionsForItems is what the cart workflow calls.
 * ------------------------------------------------------------------ */
rule("PART 2  getComputedActionsForItems: a cart of 3 x $100 items, 50% off each")

function run(label: string, promo: any, items: any[]) {
  const actions = getComputedActionsForItems(promo, items, new Map())
  const adjustments = actions.filter((a) => a.action === "addItemAdjustment")
  const exceeded = actions.filter(
    (a) => a.action === "campaignBudgetExceeded"
  )
  const total = adjustments.reduce(
    (acc, a: any) => MathBN.add(acc, a.amount),
    MathBN.convert(0)
  )
  const b = promo.campaign.budget
  line(
    `${label.padEnd(34)} budget=${String(b.type).padEnd(19)} limit=${String(
      b.limit
    ).padEnd(8)} used=${String(b.used).padEnd(5)} -> discount=${total.toString().padEnd(6)} adjustments=${
      adjustments.length
    } exceeded=${exceeded.length}`
  )
  return { total: total.toString(), adjustments: adjustments.length, exceeded: exceeded.length }
}

const threeItems = [item("i1", 100), item("i2", 100), item("i3", 100)]

line()
line("CONTROL: ordinary inputs, budget comfortably large")
run("control: spend, limit 1000", promotion({ budgetType: "spend", limit: 1000 }), threeItems)

line()
line("CONTROL: the guard refuses when it is asked in the unit it understands")
run("control: spend, limit 40", promotion({ budgetType: "spend", limit: 40 }), threeItems)
run("control: spend, limit 100 used 60", promotion({ budgetType: "spend", limit: 100, used: 60 }), threeItems)
run("control: usage, limit 0.5", promotion({ budgetType: "usage", limit: 0.5 }), threeItems)

line()
line("DEFECT 1: spend_by_attribute budget never binds")
run("spend_by_attribute, limit 10", promotion({ budgetType: "spend_by_attribute", limit: 10 }), threeItems)
run("spend_by_attribute, limit 1", promotion({ budgetType: "spend_by_attribute", limit: 1 }), threeItems)
run("spend_by_attribute, limit 0", promotion({ budgetType: "spend_by_attribute", limit: 0 }), threeItems)
run("spend_by_attribute, limit 0.5", promotion({ budgetType: "spend_by_attribute", limit: 0.5 }), threeItems)

line()
line("DEFECT 2: a SPEND budget is checked per item against a `used` that never advances")
line("Same $300 of goods, same 50%-off promotion, same $150 of discount, same $100 budget.")
line("The only difference is whether the goods arrive as one line or three.")
run("3 x $100 lines, limit 1000", promotion({ budgetType: "spend", limit: 1000 }), threeItems)
run("1 x $300 line,  limit 1000", promotion({ budgetType: "spend", limit: 1000 }), [item("i1", 300)])
run("3 x $100 lines, limit 100", promotion({ budgetType: "spend", limit: 100 }), threeItems)
run("1 x $300 line,  limit 100", promotion({ budgetType: "spend", limit: 100 }), [item("i1", 300)])

line()
line("DEFECT 3 (shape): one code reported exhausted AND adjusted in the same result")
const mixed = getComputedActionsForItems(
  promotion({ budgetType: "spend", limit: 50 }),
  [item("big", 200), item("small", 20)],
  new Map()
)
line(JSON.stringify(mixed.map((a: any) => ({ action: a.action, item: a.item_id, amount: a.amount?.toString(), code: a.code })), null, 2))

line()
line("limit 0 on a plain spend budget, for comparison with the control above:")
run("spend, limit 0", promotion({ budgetType: "spend", limit: 0 }), threeItems)
