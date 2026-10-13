/*
 * Reproduction against medusajs/medusa @ 146c46b0ad1146b40595c8ef586c4d5890982603
 *
 * Question: is `application_method.max_quantity` under
 * ApplicationMethodAllocation.EACH capped per LINE ITEM or per PROMOTION PER
 * CART?
 *
 * Nothing here reimplements medusa logic. Everything under test is imported
 * from the clone:
 *   packages/modules/promotion/src/utils/compute-actions/line-items.ts
 *   packages/core/utils/src/totals/promotion/index.ts
 *   packages/core/utils/src/totals/math.ts
 *
 * No campaign is attached to any promotion here, so
 * computeActionForBudgetExceeded returns at its first branch
 * (usage.ts:34) and no budget guard runs. This is deliberately a different
 * question from the campaign-budget finding.
 */
import { getComputedActionsForItems } from "../hunt/medusa/packages/modules/promotion/src/utils/compute-actions/line-items"
import {
  calculateAdjustmentAmountFromPromotion,
  getPromotionValue,
} from "../hunt/medusa/packages/core/utils/src/totals/promotion/index"
import { decorateCartTotals } from "../hunt/medusa/packages/core/utils/src/totals/cart/index"
import { MathBN } from "./shim/framework-utils"

const line = (s = "") => console.log(s)
const rule = (t: string) => {
  line()
  line("=".repeat(78))
  line(t)
  line("=".repeat(78))
}

line("medusa @ 146c46b0ad1146b40595c8ef586c4d5890982603")
line()
line("EXECUTED, from the clone, unmodified:")
line("  packages/modules/promotion/src/utils/compute-actions/line-items.ts")
line("  packages/modules/promotion/src/utils/compute-actions/usage.ts")
line("  packages/core/utils/src/totals/promotion/index.ts")
line("  packages/core/utils/src/totals/math.ts                       MathBN")
line("  packages/core/utils/src/totals/big-number.ts                 MEDUSA_EPSILON")
line("  packages/core/utils/src/totals/cart/index.ts                 decorateCartTotals")
line("  packages/core/utils/src/totals/line-item/index.ts            getLineItemTotals")
line("  packages/core/utils/src/totals/adjustment/index.ts           calculateAdjustmentTotal")
line()
line("REPLACED: nothing on the arithmetic path. Promotions and line items are")
line("plain object fixtures, which is what getComputedActionsForItems takes.")
line("No campaign is set, so no budget guard runs at all.")

/* promotion fixture. No `campaign` key at all. */
function promo(opts: {
  allocation?: string
  type?: string
  value?: number
  maxQuantity?: number | null
  taxInclusive?: boolean
}) {
  return {
    id: "promo_1",
    code: "SAVE",
    is_tax_inclusive: opts.taxInclusive ?? false,
    application_method: {
      type: opts.type ?? "percentage",
      target_type: "items",
      allocation: opts.allocation ?? "each",
      value: opts.value ?? 50,
      max_quantity: opts.maxQuantity === undefined ? 1 : opts.maxQuantity,
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

function run(label: string, p: any, items: any[]) {
  const actions = getComputedActionsForItems(p, items, new Map())
  const adj = actions.filter((a: any) => a.action === "addItemAdjustment")
  const total = adj.reduce(
    (acc: any, a: any) => MathBN.add(acc, a.amount),
    MathBN.convert(0)
  )
  const units = items.reduce((acc, i) => acc + Number(i.quantity), 0)
  const goods = items.reduce((acc, i) => acc + Number(i.subtotal), 0)
  const am = p.application_method
  line(
    `${label.padEnd(30)} ${String(am.allocation).padEnd(7)} ${String(
      am.type
    ).padEnd(10)} max_qty=${String(am.max_quantity).padEnd(5)} lines=${String(
      items.length
    ).padEnd(3)} units=${String(units).padEnd(3)} goods=${String(goods).padEnd(
      5
    )} -> discount=${total.toString().padEnd(7)} adjustments=${adj.length}`
  )
  return {
    total: total.toString(),
    adjustments: adj.length,
    per: adj.map((a: any) => a.amount.toString()),
  }
}

/* ------------------------------------------------------------------ *
 * PART 0: controls. An ordinary cart must discount correctly, and a
 * case that should cap must cap.
 * ------------------------------------------------------------------ */
rule("PART 0  CONTROLS")
line()
line("CONTROL A: an ordinary single-line cart discounts correctly.")
line("One $100 unit, 50% off, max_quantity 1. Correct answer is 50.")
const cA = run("control A", promo({}), [item("i1", 100)])
line(
  `  assertion: discount == 50 and adjustments == 1  ->  ${
    cA.total === "50" && cA.adjustments === 1 ? "PASS" : "FAIL"
  }`
)

line()
line("CONTROL B: a cap that should bind does bind, within one line item.")
line("One line, quantity 3, $300, 50% off, max_quantity 1.")
line("Uncapped 50% of $300 would be 150. max_quantity 1 must hold it to 50.")
const cB = run("control B", promo({}), [item("i1", 300, 3)])
line(
  `  assertion: discount == 50 (capped, not 150)     ->  ${
    cB.total === "50" ? "PASS" : "FAIL"
  }`
)

line()
line("CONTROL C: raising max_quantity to 3 on that same line lifts the cap.")
line("This shows the cap in control B was max_quantity doing its job and not")
line("some unrelated clamp.")
const cC = run("control C", promo({ maxQuantity: 3 }), [item("i1", 300, 3)])
line(
  `  assertion: discount == 150 (cap lifted)         ->  ${
    cC.total === "150" ? "PASS" : "FAIL"
  }`
)

line()
line("CONTROL D: max_quantity 2 on that line caps at two units, not three.")
const cD = run("control D", promo({ maxQuantity: 2 }), [item("i1", 300, 3)])
line(
  `  assertion: discount == 100                      ->  ${
    cD.total === "100" ? "PASS" : "FAIL"
  }`
)

/* ------------------------------------------------------------------ *
 * PART 1: the same goods, the same promotion, split differently.
 * ------------------------------------------------------------------ */
rule("PART 1  SAME GOODS, SAME PROMOTION, DIFFERENT LINE SPLIT")
line()
line("Three units of one $100 variant. $300 of goods either way.")
line("One promotion: 50% off, allocation EACH, max_quantity 1. No campaign.")
line()
const oneLine = run("1 line  x qty 3", promo({}), [item("i1", 300, 3)])
const twoLines = run("2 lines (qty 2 + qty 1)", promo({}), [
  item("i1", 200, 2),
  item("i2", 100, 1),
])
const threeLines = run("3 lines x qty 1", promo({}), [
  item("i1", 100),
  item("i2", 100),
  item("i3", 100),
])
line()
line(`per-adjustment amounts, 1 line:  ${JSON.stringify(oneLine.per)}`)
line(`per-adjustment amounts, 2 lines: ${JSON.stringify(twoLines.per)}`)
line(`per-adjustment amounts, 3 lines: ${JSON.stringify(threeLines.per)}`)
line()
line(
  `ratio 3 lines / 1 line = ${Number(threeLines.total) / Number(oneLine.total)}`
)

line()
line("Same experiment with a FIXED-amount promotion: $30 off, max_quantity 1.")
const fx1 = run("1 line  x qty 3", promo({ type: "fixed", value: 30 }), [
  item("i1", 300, 3),
])
const fx3 = run("3 lines x qty 1", promo({ type: "fixed", value: 30 }), [
  item("i1", 100),
  item("i2", 100),
  item("i3", 100),
])
line(`ratio 3 lines / 1 line = ${Number(fx3.total) / Number(fx1.total)}`)

line()
line("Scaling: more lines, same goods. 6 units of a $50 variant, $300 total.")
for (const n of [1, 2, 3, 6]) {
  const per = 6 / n
  const items = Array.from({ length: n }, (_, k) =>
    item(`i${k}`, 50 * per, per)
  )
  run(`${n} line(s) x qty ${per}`, promo({}), items)
}

/* ------------------------------------------------------------------ *
 * PART 2: where the per-line cap comes from, printed.
 * ------------------------------------------------------------------ */
rule("PART 2  THE ARITHMETIC, FROM THE REAL FUNCTION")
line()
line("calculateAdjustmentAmountFromPromotion is called once per line item by")
line("the loop at line-items.ts:140. Its EACH branch is")
line("packages/core/utils/src/totals/promotion/index.ts:182-218. Called")
line("directly, with the same arguments the loop builds:")
line()
line("LINE ITEM                      max_quantity  -> amount")
for (const [label, it] of [
  ["qty 3, subtotal 300", item("x", 300, 3)],
  ["qty 2, subtotal 200", item("x", 200, 2)],
  ["qty 1, subtotal 100", item("x", 100, 1)],
] as [string, any][]) {
  for (const mq of [1, 2, 3]) {
    const amt = calculateAdjustmentAmountFromPromotion(
      it,
      {
        value: 50,
        applied_value: 0,
        is_tax_inclusive: false,
        max_quantity: mq,
        type: "percentage",
        allocation: "each",
      },
      0
    )
    line(`${label.padEnd(30)} ${String(mq).padEnd(13)} -> ${amt.toString()}`)
  }
}

line()
line("The three MathBN steps the EACH branch takes, index.ts:182-200,")
line("recomputed here with the same MathBN from the clone, for the qty-3 line:")
{
  const it = item("x", 300, 3)
  const remainingItemAmount = MathBN.sub(it.subtotal, 0)
  const itemAmount = MathBN.div(it.subtotal, it.quantity)
  const maximumPromotionAmount = MathBN.mult(itemAmount, 1)
  const applicableAmount = MathBN.min(
    remainingItemAmount,
    maximumPromotionAmount
  )
  line(`  remainingItemAmount    = sub(300, 0)       = ${remainingItemAmount}`)
  line(`  itemAmount             = div(300, 3)       = ${itemAmount}`)
  line(`  maximumPromotionAmount = mult(${itemAmount}, 1)      = ${maximumPromotionAmount}`)
  line(`  applicableAmount       = min(300, ${maximumPromotionAmount})     = ${applicableAmount}`)
  const pv = getPromotionValue(
    { type: "percentage", value: 50, allocation: "each", max_quantity: 1 },
    applicableAmount,
    0,
    it
  )
  line(`  getPromotionValue(...)                     = ${pv}`)
}
line()
line("and for one of the qty-1 lines:")
{
  const it = item("x", 100, 1)
  const remainingItemAmount = MathBN.sub(it.subtotal, 0)
  const itemAmount = MathBN.div(it.subtotal, it.quantity)
  const maximumPromotionAmount = MathBN.mult(itemAmount, 1)
  const applicableAmount = MathBN.min(
    remainingItemAmount,
    maximumPromotionAmount
  )
  line(`  remainingItemAmount    = sub(100, 0)       = ${remainingItemAmount}`)
  line(`  itemAmount             = div(100, 1)       = ${itemAmount}`)
  line(`  maximumPromotionAmount = mult(${itemAmount}, 1)     = ${maximumPromotionAmount}`)
  line(`  applicableAmount       = min(100, ${maximumPromotionAmount})   = ${applicableAmount}`)
  const pv = getPromotionValue(
    { type: "percentage", value: 50, allocation: "each", max_quantity: 1 },
    applicableAmount,
    0,
    it
  )
  line(`  getPromotionValue(...)                     = ${pv}`)
}
line()
line("itemAmount is the UNIT price, so maximumPromotionAmount is a per-line")
line("budget of max_quantity units. Three lines get three such budgets.")
line("Nothing in the EACH path reads or writes a cart-level counter.")

/* ------------------------------------------------------------------ *
 * PART 3: ALLOCATION.ONCE, for comparison. This is the control that
 * shows medusa does know how to make a quantity cap cart-wide.
 * ------------------------------------------------------------------ */
rule("PART 3  ALLOCATION.ONCE, FOR COMPARISON")
line()
line("Same carts, same promotion value, allocation ONCE instead of EACH.")
line("line-items.ts:87 declares `let remainingQuota = maxQuantity ?? 0` and")
line("line-items.ts:182 decrements it, but only inside")
line("`if (allocation === ApplicationMethodAllocation.ONCE)`.")
line()
const once1 = run("ONCE  1 line  x qty 3", promo({ allocation: "once" }), [
  item("i1", 300, 3),
])
const once3 = run("ONCE  3 lines x qty 1", promo({ allocation: "once" }), [
  item("i1", 100),
  item("i2", 100),
  item("i3", 100),
])
line()
line(
  `ONCE:  1 line -> ${once1.total}, 3 lines -> ${once3.total}  (split-invariant: ${
    once1.total === once3.total ? "YES" : "NO"
  })`
)
line(
  `EACH:  1 line -> ${oneLine.total}, 3 lines -> ${threeLines.total}  (split-invariant: ${
    oneLine.total === threeLines.total ? "YES" : "NO"
  })`
)

line()
line("ACROSS, for completeness. max_quantity 1, fixed $30 off:")
const acr1 = run(
  "ACROSS 1 line  x qty 3",
  promo({ allocation: "across", type: "fixed", value: 30 }),
  [item("i1", 300, 3)]
)
const acr3 = run(
  "ACROSS 3 lines x qty 1",
  promo({ allocation: "across", type: "fixed", value: 30 }),
  [item("i1", 100), item("i2", 100), item("i3", 100)]
)
line(
  `ACROSS: 1 line -> ${acr1.total}, 3 lines -> ${acr3.total}  (split-invariant: ${
    acr1.total === acr3.total ? "YES" : "NO"
  })`
)

/* ------------------------------------------------------------------ *
 * PART 4: does it survive to the number the payment collection gets?
 *
 * The chain under test, all four links from the clone:
 *   getComputedActionsForItems           -> adjustment amounts
 *   prepareAdjustmentsFromPromotionActionsStep persists them verbatim
 *   decorateCartTotals / calculateAdjustmentTotal -> cart.total
 *   refresh-payment-collection.ts:164    -> amount: cart.raw_total
 * ------------------------------------------------------------------ */
rule("PART 4  THE NUMBER THE PAYMENT COLLECTION GETS")
line()
line("decorateCartTotals is the real function from")
line("packages/core/utils/src/totals/cart/index.ts, fed the adjustments that")
line("getComputedActionsForItems just produced. No tax lines, no shipping, no")
line("credit lines, so cart.total is subtotal minus discount.")
line()

function cartTotal(label: string, items: any[]) {
  const p = promo({})
  const actions = getComputedActionsForItems(p, items, new Map())
  const byItem = new Map<string, any[]>()
  for (const a of actions as any[]) {
    if (a.action !== "addItemAdjustment") {
      continue
    }
    const list = byItem.get(a.item_id) ?? []
    list.push({ amount: a.amount, is_tax_inclusive: a.is_tax_inclusive })
    byItem.set(a.item_id, list)
  }
  const cartLike: any = {
    currency_code: "usd",
    items: items.map((i) => ({
      id: i.id,
      unit_price: Number(i.subtotal) / Number(i.quantity),
      quantity: i.quantity,
      is_tax_inclusive: false,
      adjustments: byItem.get(i.id) ?? [],
      tax_lines: [],
    })),
    shipping_methods: [],
    credit_lines: [],
  }
  const decorated: any = decorateCartTotals(cartLike)
  line(
    `${label.padEnd(26)} subtotal=${decorated.subtotal
      .toString()
      .padEnd(6)} discount_total=${decorated.discount_total
      .toString()
      .padEnd(6)} cart.total=${decorated.total.toString().padEnd(6)} raw_total=${
      decorated.raw_amount ?? decorated.total.toString()
    }`
  )
  return decorated.total.toString()
}

line("CART SHAPE                 TOTALS FROM decorateCartTotals")
const tOne = cartTotal("1 line  x qty 3", [item("i1", 300, 3)])
const tTwo = cartTotal("2 lines (qty 2 + qty 1)", [
  item("i1", 200, 2),
  item("i2", 100, 1),
])
const tThree = cartTotal("3 lines x qty 1", [
  item("i1", 100),
  item("i2", 100),
  item("i3", 100),
])
line()
line(
  `the customer pays ${tThree} instead of ${tOne} for the same three units,`
)
line(
  `a difference of ${Number(tOne) - Number(tThree)} on ${Number(
    tOne
  )} of goods-after-the-intended-discount.`
)
line()
line("refresh-payment-collection.ts:164 sets the payment collection to")
line("`amount: cart.raw_total`, which is this number. authorize-payment-session")
line("takes only `{ id }` and authorizes the session's own amount.")

/* ------------------------------------------------------------------ *
 * PART 5: summary table
 * ------------------------------------------------------------------ */
rule("PART 5  SUMMARY")
line()
line("ALLOCATION  TYPE        max_qty  1 LINE QTY 3   3 LINES QTY 1   SPLIT-INVARIANT")
const rows: [string, string, string, string, string][] = [
  ["each", "percentage", "1", oneLine.total, threeLines.total],
  ["each", "fixed", "1", fx1.total, fx3.total],
  ["once", "percentage", "1", once1.total, once3.total],
  ["across", "fixed", "1", acr1.total, acr3.total],
]
for (const [alloc, type, mq, a, b] of rows) {
  line(
    `${alloc.padEnd(11)} ${type.padEnd(11)} ${mq.padEnd(8)} ${a.padEnd(
      14
    )} ${b.padEnd(15)} ${a === b ? "YES" : "NO"}`
  )
}
