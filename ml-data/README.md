# ml-data

Lagos State food prices and market indicators from **January 2018 to May 2026** (101 months), built from real sources, mainly the National Bureau of Statistics (NBS). Months without a real figure were estimated, and every price row says which.
**See `SOURCES.md`** for every source, how gaps were filled, and how much of the data is real.

Every period is the 1st of the month (`YYYY-MM-01`).

| File | Rows | Columns | What it is |
|---|---|---|---|
| `commodities.json` | 25 | `name, slug, category, unit, description, latestPrice` | The 25 tracked foods and their metadata (`latestPrice` is the May 2026 price). |
| `lagos_food_prices.csv` | 2,525 | `period, commodity_slug, price, source, basis` | Monthly Lagos price in naira per unit. `source` names where it came from; `basis` is `real` or `estimated`. |
| `macro_indicators.csv` | 707 | `period, key, value` | 7 monthly indicators (see below) for the same 101 months. |
| `commodity_sensitivities.json` | 25 | `fx, diesel, seasonality, supply, inflation` (0 to 1 each) | How strongly each commodity reacts to each factor. Used by the forecast model. |
| `sources/` | | | The raw source figures the files above are built from. |

## Indicator keys
- `USD_NGN`: naira per US dollar (CBN official rate, monthly average)
- `DIESEL_PRICE`, `PETROL_PRICE`: naira per litre in Lagos (NBS)
- `HEADLINE_INFLATION`, `FOOD_INFLATION`: annual percent (NBS, via CBN)
- `RAINFALL_INDEX`: 0 to 100, Lagos rainfall as a share of the wettest month (NASA)
- `SUPPLY_INDEX`: 0 to 100, from the crop calendar (not measured; high after the Sep–Dec harvest)

## Rebuilding
`npm run data:generate` runs `scripts/build-ml-data.ts`, which rebuilds the three data files from `sources/`. Then run `npm run db:seed` to load them into the database.
