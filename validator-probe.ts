/*
 * Runs the clone's real Admin API campaign validators against request bodies.
 *
 * AdminCreateCampaign is the schema that
 * packages/medusa/src/api/admin/campaigns/middlewares.ts installs on
 * POST /admin/campaigns via validateAndTransformBody(AdminCreateCampaign).
 * AdminUpdateCampaign is the one it installs on POST /admin/campaigns/:id.
 * Nothing here redefines either schema.
 */
import {
  AdminCreateCampaign,
  AdminUpdateCampaign,
} from "../hunt/medusa/packages/medusa/src/api/admin/campaigns/validators"
import {
  AdminCreatePromotion,
  AdminUpdatePromotion,
} from "../hunt/medusa/packages/medusa/src/api/admin/promotions/validators"

const line = (s = "") => console.log(s)
const rule = (t: string) => {
  line()
  line("=".repeat(78))
  line(t)
  line("=".repeat(78))
}

// middlewares.ts passes the validator with no additional-data schema, i.e.
// validateAndTransformBody(AdminCreateCampaign) -> AdminCreateCampaign().
const createSchema = (AdminCreateCampaign as any)()
const updateSchema = (AdminUpdateCampaign as any)()

function check(schema: any, label: string, body: unknown) {
  const r = schema.safeParse(body)
  line()
  line(`--- ${label}`)
  line(`    body:    ${JSON.stringify(body)}`)
  if (r.success) {
    line(`    VERDICT: ACCEPTED`)
    line(
      `    parsed:  ${JSON.stringify(r.data, (_k, v) =>
        v instanceof Date ? v.toISOString() : v
      )}`
    )
  } else {
    line(`    VERDICT: REJECTED`)
    for (const issue of r.error.issues) {
      line(`    issue:   [${issue.path.join(".")}] ${issue.message}`)
    }
  }
}

rule("POST /admin/campaigns  (validateAndTransformBody(AdminCreateCampaign))")

const base = { name: "Probe", campaign_identifier: "PROBE-1" }

check(createSchema, "spend_by_attribute with an attribute", {
  ...base,
  budget: {
    type: "spend_by_attribute",
    limit: 10,
    attribute: "customer_id",
  },
})

check(createSchema, "spend_by_attribute with no attribute", {
  ...base,
  budget: { type: "spend_by_attribute", limit: 10 },
})

check(createSchema, "spend_by_attribute, no currency_code, limit 10", {
  ...base,
  budget: { type: "spend_by_attribute", limit: 10, attribute: "customer_email" },
})

check(createSchema, "spend_by_attribute with a currency_code too", {
  ...base,
  budget: {
    type: "spend_by_attribute",
    limit: 10,
    attribute: "customer_id",
    currency_code: "usd",
  },
})

check(createSchema, "CONTROL: a type that is not in the enum", {
  ...base,
  budget: {
    type: "spend_by_moonphase",
    limit: 10,
    attribute: "customer_id",
  },
})

check(createSchema, "CONTROL: spend with no currency_code", {
  ...base,
  budget: { type: "spend", limit: 10 },
})

check(createSchema, "CONTROL: use_by_attribute with an attribute", {
  ...base,
  budget: { type: "use_by_attribute", limit: 2, attribute: "customer_email" },
})

rule("POST /admin/campaigns/:id  (validateAndTransformBody(AdminUpdateCampaign))")

check(updateSchema, "attempt to set budget.type on update", {
  budget: { type: "spend_by_attribute", limit: 10 },
})

check(updateSchema, "CONTROL: update only the limit", {
  budget: { limit: 10 },
})

rule("POST /admin/promotions  (validateAndTransformBody(AdminCreatePromotion))")
line("CreatePromotion carries `campaign: CreateCampaign.optional()`, the same")
line("campaign schema, so this is a second route onto the same budget.")

const createPromotionSchema = (AdminCreatePromotion as any)()
const updatePromotionSchema = (AdminUpdatePromotion as any)()

const promoBase = {
  code: "PROBE10",
  type: "standard",
  application_method: {
    type: "percentage",
    target_type: "items",
    allocation: "each",
    value: 50,
    max_quantity: 1,
  },
}

check(createPromotionSchema, "promotion with a nested spend_by_attribute campaign", {
  ...promoBase,
  campaign: {
    name: "Probe",
    campaign_identifier: "PROBE-2",
    budget: {
      type: "spend_by_attribute",
      limit: 10,
      attribute: "customer_id",
    },
  },
})

check(updatePromotionSchema, "CONTROL: nested campaign on promotion update", {
  campaign: {
    name: "Probe",
    campaign_identifier: "PROBE-3",
    budget: {
      type: "spend_by_attribute",
      limit: 10,
      attribute: "customer_id",
    },
  },
})
