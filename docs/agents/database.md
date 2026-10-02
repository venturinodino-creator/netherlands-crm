# The shared database

One Supabase project, `cfhljbexesdrabmadpcc`, serves the three Regions. Every `crm_*` table has a `region` column and the page scopes each request by it. The migration history in Supabase is the record of the schema; this page holds only what a session needs before touching a save.

## Rules that explain a refused save

- **Access.** On every `crm_*` table any signed-in user reads; insert, update and delete pass only when `is_admin()`. A viewer's write is refused by design.
- **Foreign keys.** `crm_contacts.inst_id`, `crm_interactions.inst_id` and `crm_opportunities.inst_id` point at `crm_institutions.id`. The institutions table is sparse: a seed Institution has a row only once something was saved on it. Create the row first.
- **Named columns.** The page sends named columns on an Institution save, so a page that names a column the database lacks breaks every Institution save. A column is added in the database before the page that uses it lands.

## Homes for shared edits (spec #103, applied 2026-10-02)

Migration `shared_edits_columns_and_region_settings`, additive:

| Where | What it holds |
|---|---|
| `crm_institutions.matrix_note` (text, nullable) | The Competitor Matrix note for the Institution. |
| `crm_institutions.competitor_details` (jsonb, nullable) | Competitor product details with no other home: renewal dates, OpenAlex tier and fee. Product statuses stay in `product_status`. |
| `crm_region_settings` (`region`, `key`, `value` jsonb, `updated_at`; primary key `region, key`) | Small per-Region shared values. `threat_overrides` is a map of LeapSpace Insights item id to hand-set threat level. Same access rules as the other tables. |

Earlier homes of the same kind: `crm_institutions.ws_pinned` (the Pin) and `crm_institutions.product_status` (the Product status), both from 2026-09-19.

## Working with it

Read the schema and access rules through the Supabase connector, read-only. A change to the schema is a migration, applied only with the owner's go-ahead in that session, and added to this page.
