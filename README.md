# PharmaPath

PharmaPath helps patients, caregivers, and prescribers answer a practical medication-access question faster: which pharmacy is worth calling first, and what should happen next if that first option does not work out.

The product combines nearby pharmacy discovery, medication access context, and clear next-step guidance without pretending to know real-time shelf inventory.

## What It Solves

Finding a medication can be frustrating for simple reasons: the closest pharmacy may not be the best first call, a medication may be harder to fill than usual, and people often do not know what question to ask next.

PharmaPath is designed to reduce that friction. It helps users build a better shortlist, understand likely access difficulty, and move into a call or prescribing decision with clearer context.

## Who It Helps

- Patients and caregivers trying to fill a prescription with less guesswork.
- Prescribers who want quick access context before routing a prescription.
- Contributors who want to add lightweight reports that can help future searches.

## Core Experiences

- `Pharmacy Finder`: Search by medication and location, review nearby options, and start with a tighter first-call path.
- `Medication Lookup`: Review medication-wide access context, manufacturer spread, recall activity, and planning cues without turning that context into a stock claim.
- `Methodology`: See what PharmaPath can support directly, what is inferred, and what still requires confirmation.

## Example Use Cases

- Prioritizing the best nearby pharmacies for a routine refill.
- Handling a same-day medication search where travel time and open hours matter.
- Planning around higher-friction medications that may require extra calls or backup options.
- Giving prescribers a faster way to think through alternatives before repeated failed routing attempts.

## Responsible Use

- PharmaPath is informational and workflow-oriented.
- It does not confirm real-time shelf inventory at a specific store.
- It does not replace direct pharmacy confirmation, clinical judgment, or emergency care.
- Medication access context should be treated as guidance for better questions, not as a guarantee.

## Public Links

- App: [pharmapath.org](https://pharmapath.org)
- Methodology: [pharmapath.org/methodology](https://www.pharmapath.org/methodology)
- Product overview: [docs/product-overview.md](./docs/product-overview.md)

## Development

1. Use Node `22.x`.
2. Run `npm ci`.
3. Run `npm run dev`.
4. Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` before shipping changes.

Additional developer notes live in [docs/development.md](./docs/development.md). Private configuration and release operations are intentionally not documented in the public README.

## Contact

- Email: [contact@pharmapath.org](mailto:contact@pharmapath.org)
