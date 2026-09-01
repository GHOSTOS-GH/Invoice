# Task EXPORT-CLIENTS-PRODUCTS — Code Agent

## Summary
Added export (CSV + Excel) dropdown menus and CSV import buttons to both the
Clients screen and the Products screen, leveraging the shared
`src/lib/export-utils.ts` helpers.

## Files modified
- `src/components/screens/clients-screen.tsx`
- `src/components/screens/products-screen.tsx`

## Implementation notes
- Both screens now have a `DropdownMenu` (trigger Button variant="outline"
  size="sm" with `Download` icon + "Exporter" label) containing two items:
  "Exporter CSV" and "Exporter Excel".
- Both screens have a "Importer CSV" outline button with `Upload` icon that
  opens a hidden file input; the CSV is parsed via `papaparse` (header mode)
  and rows are inserted via `createClient` / `createProduct`, then `refresh()`
  is called.
- French headers ("Nom", "Téléphone", "Adresse", "Catégorie", "Image URL")
  are matched first, with English fallbacks for resilience.
- Toasts: success on export and on import (with the count imported), error
  on parse failure or import exception.
- Filename pattern: `clients_${date}.csv` / `clients_${date}.xlsx` /
  `produits_${date}.csv` / `produits_${date}.xlsx` where
  `date = new Date().toISOString().slice(0, 10)`.
- Spinner shown on the import button while parsing/inserting.
- Brand color `#2563EB` kept on the primary "Ajouter" button. All buttons
  use `rounded-xl` and `h-9` to align with the existing action button.

## Verification
- `bunx eslint src/components/screens/clients-screen.tsx src/components/screens/products-screen.tsx` → 0 errors (exit 0)
- `bunx tsc --noEmit` → no errors in these two files.

## Pre-existing issue (not touched)
`src/lib/pdf-generation.ts` references `invoiceTaxAmount` which is not
exported from `src/lib/types.ts`. This was not in scope for this task and
was left untouched.
