/*
 * Probe against medusajs/medusa @ 146c46b0ad1146b40595c8ef586c4d5890982603
 *
 * computeActionForBudgetExceeded is imported from the clone and never
 * reimplemented. MathBN is the real MathBN from the clone, wrapped so that the
 * arguments each call receives are recorded. The arithmetic is medusa's.
 */
import { computeActionForBudgetExceeded } from "../hunt/medusa/packages/modules/promotion/src/utils/compute-actions/usage"
import { TAP } from "./shim/framework-utils-tapped"

const line = (s = "") => console.log(s)
const rule = (t: string) => {
  line()
  line("=".repeat(78))
  line(t)
  line("=".repeat(78))
}

function promotion(budgetType: string, limit: number | null, used: number) {
  return {
    id: "promo_1",
    code: "SAVE",
    campaign: {
      id: "camp_1",
      budget: {
        id: "probudg_1",
        type: budgetType,
        limit,
        used,
        currency_code: "usd",
        attribute: "customer_id",
      },
    },
  } as any
}

function callTapped(budgetType: string, limit: number | null, used: number, amount: number) {
  TAP.log = []
  TAP.on = true
  const action = computeActionForBudgetExceeded(
    promotion(budgetType, limit, used),
    amount
  )
  TAP.on = false
  return { action, log: TAP.log.slice() }
}

/* --------------------------------------------------------------- *
 * PART A: what the guard actually puts on each side of the compare.
 * --------------------------------------------------------------- */
rule("PART A  every MathBN call the guard makes, with its real arguments")
line("Each block is one call to computeActionForBudgetExceeded(promotion, amount).")
line("The lines under it are the MathBN calls that call made, in order, with the")
line("arguments medusa's own code passed. Recorded, not retyped.")

const tapCases: [string, number | null, number, number][] = [
  ["spend", 100, 0, 150],
  ["spend_by_attribute", 100, 0, 150],
  ["spend_by_attribute", 100, 37, 150],
  ["usage", 100, 0, 150],
  ["spend_by_attribute", 0.5, 0, 150],
]

for (const [type, limit, used, amount] of tapCases) {
  const { action, log } = callTapped(type, limit, used, amount)
  line()
  line(
    `call: type=${type} limit=${limit} used=${used} amount=${amount}  ->  ${
      action ? "REFUSE (" + action.action + ")" : "PERMIT"
    }`
  )
  for (const e of log) {
    line(`      MathBN.${e.op}(${e.args.join(", ")}) = ${e.result}`)
  }
}

/* --------------------------------------------------------------- *
 * PART B: the discount amount does not move the verdict.
 * --------------------------------------------------------------- */
rule("PART B  does the offered discount change the verdict?")
line("Budget limit fixed at 100, used fixed at 0. Only `amount` varies.")
line()
line("AMOUNT            spend                spend_by_attribute")
for (const amt of [1, 99, 100, 101, 1000, 1000000, 1000000000]) {
  const s = computeActionForBudgetExceeded(promotion("spend", 100, 0), amt)
  const sba = computeActionForBudgetExceeded(
    promotion("spend_by_attribute", 100, 0),
    amt
  )
  line(
    `${String(amt).padEnd(17)} ${(s ? "REFUSE" : "PERMIT").padEnd(20)} ${
      sba ? "REFUSE" : "PERMIT"
    }`
  )
}

/* --------------------------------------------------------------- *
 * PART C: locate the refusal boundary and compare it to used + 1.
 * --------------------------------------------------------------- */
rule("PART C  where is the refusal boundary for spend_by_attribute?")
line("For each `used`, the smallest limit that still PERMITs a 1,000,000")
line("discount is found by bisection on the real function. If the guard were")
line("comparing money it would depend on the 1,000,000. If it is comparing a")
line("count, the boundary sits at used + 1.")
line()
line("USED     BOUNDARY (smallest permitting limit)   used + 1   MATCH")

function smallestPermittingLimit(
  budgetType: string,
  used: number,
  amount: number
): number {
  // binary search over limit in (0, hi]; limit 0 is excluded because
  // `campaignBudget.limit &&` treats 0 as falsy.
  let lo = 1e-9
  let hi = used + amount + 10
  const permits = (limit: number) =>
    !computeActionForBudgetExceeded(promotion(budgetType, limit, used), amount)
  if (!permits(hi)) {
    return NaN
  }
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (permits(mid)) {
      hi = mid
    } else {
      lo = mid
    }
  }
  return hi
}

for (const used of [0, 1, 5, 37, 99, 1000]) {
  const b = smallestPermittingLimit("spend_by_attribute", used, 1000000)
  const expected = used + 1
  line(
    `${String(used).padEnd(8)} ${b.toPrecision(12).padEnd(38)} ${String(
      expected
    ).padEnd(10)} ${Math.abs(b - expected) < 1e-6 ? "yes" : "NO"}`
  )
}

line()
line("Same bisection on a plain `spend` budget, for contrast. Here the")
line("boundary should move with the discount, because the discount is what is")
line("being compared.")
line()
line("AMOUNT        USED     BOUNDARY (smallest permitting limit)   used + amount")
for (const [amt, used] of [
  [150, 0],
  [150, 37],
  [1000000, 0],
] as [number, number][]) {
  const b = smallestPermittingLimit("spend", used, amt)
  line(
    `${String(amt).padEnd(13)} ${String(used).padEnd(8)} ${b
      .toPrecision(12)
      .padEnd(38)} ${used + amt}`
  )
}

/* --------------------------------------------------------------- *
 * PART D: the exact exclusive boundary, stated twice.
 * --------------------------------------------------------------- */
rule("PART D  the boundary at used = 0, stated as two adjacent limits")
line("LIMIT                      AMOUNT            VERDICT")
for (const amt of [1000000]) {
  for (const limit of [0, 1e-9, 0.5, 0.999999999, 1, 1.000000001, 2]) {
    const a = computeActionForBudgetExceeded(
      promotion("spend_by_attribute", limit, 0),
      amt
    )
    line(
      `${String(limit).padEnd(26)} ${String(amt).padEnd(17)} ${
        a ? "REFUSE" : "PERMIT"
      }`
    )
  }
}
line()
line("A limit of 1 permits a discount of 1,000,000. A limit of 0.999999999")
line("refuses it. The quantity on the left of the comparison is 1.")
