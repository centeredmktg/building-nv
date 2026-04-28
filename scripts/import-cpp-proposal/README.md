# CPP Proposal Importer

Two-step pipeline to backfill archival CPP-era proposal PDFs into the Building NV `Quote` model.

## Usage

```bash
# 1. Extract PDF to JSON intermediate
npx tsx scripts/import-cpp-proposal/extract.ts ~/Downloads/proposal.pdf
# -> outputs/cpp-imports/<slug>.json

# 2. Review the JSON. Fix any wrong trade tags, descriptions, or numbers.

# 3. Seed the Quote into Postgres
npx tsx scripts/import-cpp-proposal/seed.ts outputs/cpp-imports/<slug>.json
# -> creates Quote with cppBranded=true, status=sent

# If totalMismatch was flagged in extract and you've reviewed, force the seed:
npx tsx scripts/import-cpp-proposal/seed.ts outputs/cpp-imports/<slug>.json --force
```

## Behavior

- Idempotent by slug — re-running seed deletes and recreates the Quote.
- All imports are tagged `cppBranded: true` and `status: "sent"`.
- Numbers preserved verbatim from the PDF — no re-pricing.
- Customer Company found-or-created by name (case-insensitive).
- Output JSON is gitignored (may contain customer info).

## Caution: re-seeding signed quotes

The idempotent delete only cascades to `LineItemSection` and `QuoteCompany`. It will **fail with a foreign-key error** if the existing Quote has an `Acceptance` or `Contract` record (i.e., if the quote has been through the signing flow). For backfill of archival proposals this is unlikely to matter — but if you need to re-seed a signed quote, delete its `Acceptance` and `Contract` rows first.

## When to update

- LLM mis-tags trades → edit `trade-mapping.ts` overrides
- Section title needs to change → edit `SECTION_TITLE_OVERRIDES` in `trade-mapping.ts`
- Prompt needs tuning → edit `prompts.ts`
- New JSON schema field → edit `types.ts` and update both `extract.ts` and `seed.ts`

## Spec

See `docs/superpowers/specs/2026-04-27-cpp-proposal-importer-design.md`.
