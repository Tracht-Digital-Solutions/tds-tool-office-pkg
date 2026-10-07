# PDF output and time maths

## Fonts

Standard PDF fonts are WinAnsi-encoded. `toWinAnsi` folds typographic quotes and dashes
and drops the rest, because pdf-lib **throws** at draw time on an unencodable character.
An address pasted from Word is normal input here, not an edge case.

## Coordinates

PDF user space has its origin bottom-left, but a label grid counts from the top of the
sheet. Both PDF-writing islands measure rows downwards from `A4.h`. Getting this
backwards mirrors the whole sheet.

## Label geometry

A grid wider or taller than A4 prints stickers that fall off the edge, and the PDF looks
fine until it leaves the printer. `LabelSheet.test.ts` measures every preset against A4.
Product codes in preset labels are compatibility hints; the geometry is what matters.

## Timesheet

A shift that ends before it starts runs past midnight; it is not a negative day.
`workedMinutes` wraps. Treating it as negative would corrupt the monthly total on exactly
the sheet with a late shift.
