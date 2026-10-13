// Stand-in for the promotion module's "@models" barrel.
//
// The real barrel is seven `model.define(...)` DML definitions. They are passed
// to `MedusaService({...})` at class-definition time and are used at runtime in
// exactly one place in promotion-module.ts (`toMikroORMEntity(ApplicationMethod)`
// at line 1629, inside `updateApplicationMethods_`), which `registerUsage` never
// reaches. Loading the real definitions drags in mikro-orm, which is not on the
// code path under test. Each export below is an inert marker.
export const ApplicationMethod = { name: "ApplicationMethod" } as any
export const Campaign = { name: "Campaign" } as any
export const CampaignBudget = { name: "CampaignBudget" } as any
export const CampaignBudgetUsage = { name: "CampaignBudgetUsage" } as any
export const Promotion = { name: "Promotion" } as any
export const PromotionRule = { name: "PromotionRule" } as any
export const PromotionRuleValue = { name: "PromotionRuleValue" } as any
