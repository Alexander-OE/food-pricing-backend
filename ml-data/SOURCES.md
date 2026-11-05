# Where the data comes from

The data covers **Lagos State, January 2018 to May 2026** (101 months). May 2026 is the latest month the National Bureau of Statistics (NBS) has published food prices for, so the app's forecast is for June 2026.
Prices are in naira, in the unit the app shows (1kg, crate of 30, 1 litre, 500g loaf, 500g pack, 400g tin).
All sources were accessed on 29 October 2026. The raw figures are in `ml-data/sources/`, and `npm run data:generate` (`scripts/build-ml-data.ts`) rebuilds the app's files from them.

## Sources

| # | Source | What it gave | Months |
|---|---|---|---|
| 1 | [NBS Selected Food Prices Watch, Lagos State](https://nigeria.opendataforafrica.org/gjskat/selected-food-prices-watch) (NBS data on the Nigeria Data Portal) | Monthly **Lagos** prices for 20 of the 25 commodities | Jan 2018 – Dec 2024 |
| 2 | [NBS Selected Food Price Watch tables](https://microdata.nigerianstat.gov.ng/index.php/catalog/162/related-materials) (NBS microdata catalog) | National and **South-West** averages, plus the price in **Lagos** whenever NBS names it the highest or lowest state | Nov 2024 – May 2026 |
| 3 | Nairametrics Lagos market surveys (Mushin, Daleko, Oyingbo, Mile 12). Each article link is in `sources/market_anchors.csv` | Spaghetti, powdered milk and pepper prices | 2019 – 2026 (23 dated prices) |
| 4 | [Lagos State Ministry of Agriculture price tracker](https://lagosagric.com/price-tracker/) (saved copies on the Internet Archive) | Pepper per kg | Oct 2025, Jan 2026 |
| 5 | [National Sugar Development Council figures, reported by BusinessDay](https://businessday.ng/agriculture/article/nigerias-average-sugar-price-hits-5-year-high/) | Sugar price per tonne, and a Lagos 25kg bag price | Dec 2019, Dec 2022, Jan 2023, Dec 2023, Jan–Feb 2024 |
| 6 | [Central Bank of Nigeria exchange rates](https://www.cbn.gov.ng/rates/ExchRateByCurrency.html) | US dollar rate (official central rate, averaged per month) | Jan 2018 – May 2026 |
| 7 | [Central Bank of Nigeria inflation table](https://www.cbn.gov.ng/rates/inflrates.html) (NBS consumer price index) | Headline and food inflation, year on year | Jan 2018 – May 2026 |
| 8 | NBS Petrol Price Watch, Lagos State: [Nigeria Data Portal](https://nigeria.opendataforafrica.org/xipucvg/premium-motor-spirit-petrol-price-watch-december-2025) and [NBS microdata catalog 157](https://microdata.nigerianstat.gov.ng/index.php/catalog/157/related-materials) | Petrol price per litre in Lagos | Jan 2018 – May 2026 |
| 9 | NBS Diesel Price Watch, Lagos State: [openAFRICA (2015–2019 file)](https://open.africa/dataset/automotive_gas_oil_diesel_monthly_price_2015_19), [Nigeria Data Portal](https://nigeria.opendataforafrica.org/ffbywug/automotive-gas-oil-diesel-price-watch), [NBS microdata catalog 158](https://microdata.nigerianstat.gov.ng/index.php/catalog/158/related-materials) | Diesel price per litre in Lagos | Jan 2018 – May 2026 |
| 10 | [NASA POWER](https://power.larc.nasa.gov/) satellite rainfall at Ikeja, Lagos | Monthly rainfall | Jan 2018 – May 2026 |

## How each commodity was built

**20 commodities with NBS data** (rice local and imported, maize, sliced bread, beans brown and white, yam, Irish and sweet potato, garri white and yellow, tomato, onion, plantain, beef, chicken, frozen fish, eggs, vegetable oil, palm oil):
- **Jan 2018 – Dec 2024:** the real NBS Lagos price for every month.
- **Jan 2025 – May 2026:** NBS stopped publishing a Lagos figure for every item, so each month follows the NBS **South-West** average. Where NBS names Lagos as the highest or lowest state, the real Lagos price is used instead. That happened for vegetable oil (May–Jul 2025), local and imported rice (Aug–Sep 2025), sliced bread (Nov 2025 – Feb 2026) and tomato (May 2026).
- **Unit changes when NBS updated its list in 2025:**
  - **Oils:** the 75cl price is converted to 1 litre (×4/3).
  - **Bread:** the 450g loaf price is converted to a 500g loaf.
  - **Eggs:** dozen prices up to 2024 are converted to a crate of 30 (×2.05). This uses NBS's own figures: its January 2025 crate price divided by its December 2024 dozen price. A crate costs less per egg than a dozen.
  - **Chicken:** the price is NBS "frozen chicken".

**5 commodities NBS does not cover.** Each is built from a few real prices, with the months between them following a related real NBS Lagos series (the "guide"):

| Commodity | Real prices used | Guide between them |
|---|---|---|
| Spaghetti (500g) | 7 Nairametrics prices, 2019–2025. Carton prices are divided by 20 packs | Golden Penny wheat flour |
| Sugar (1kg) | 5 NSDC national prices (per tonne ÷ 1,000) and 1 Lagos 25kg bag, 2019–2024 | Golden Penny wheat flour |
| Powdered milk (400g tin) | 2 Nairametrics prices (2020), plus Nov 2025 (900g tin scaled to 400g by weight) | Peak evaporated tin milk |
| Fresh pepper (1kg) | 2 Lagos State per-kg prices (2025–26), plus 13 Nairametrics "big bag" prices converted to per kg | Tomato |
| Carrot (1kg) | None for Lagos. NBS only added carrot in 2025, so 2025–26 uses the South-West average | Irish potato (both come mainly from Jos) |

**How a gap is filled:** between two real prices, the month follows the ups and downs of its guide. The leftover difference is spread evenly so the series lands exactly on the next real price. Before the first or after the last real price, the series simply follows the guide. Nothing was made up without a real price or a real guide behind it.

## Indicators

| Indicator | Basis |
|---|---|
| US dollar rate | Real (CBN). Before June 2023 this is the official rate, which was well below the street rate. |
| Petrol, diesel | Real NBS Lagos prices. Petrol for August 2025 was missing and is a straight line between July and September. |
| Headline and food inflation | Real (NBS via CBN). CBN shows NBS's revised 2025 figures, which differ from NBS's first 2025 announcements (for example, January 2025: 27.61% revised against 24.48% announced). The CBN table also repeats the same figures for May and June 2025. |
| Rainfall index | Real NASA rainfall, shown as a share of the wettest month in the period (0–100) |
| Supply index | **Not measured.** No monthly food-supply series exists for Lagos, so this follows the crop calendar: high after the Sep–Dec harvest, low in the May lean season. |

## Summary

- **Food prices: 2,525 rows, of which 1,709 are real (68%) and 816 are estimated (32%).**
  - **The 20 NBS commodities:** 84 to 88 real months each out of 101. Their estimated months are all in 2025–2026, from the South-West average.
  - **Spaghetti:** 7 real months.
  - **Sugar:** 6 real months.
  - **Powdered milk:** 2 real months.
  - **Fresh pepper:** 2 real months.
  - **Carrot:** 0 real months.
- **Indicators:** 605 of the 606 real monthly values were found (only petrol for August 2025 is estimated). The rainfall index is based on real rainfall, and the supply index is derived from the crop calendar.

**Where good data was hard to find:**
- **Carrot:** no dated Lagos prices exist before 2025. The whole series is a regional average (2025–26) carried back with Irish potato prices, so treat it as the least reliable.
- **Fresh pepper:** Lagos markets price pepper by the bag, and bag sizes are not stated. Bags were converted at about 35kg, which is where the October 2025 bag price meets the Lagos State per-kg price. Pepper also swings sharply from month to month.
- **Sugar and powdered milk:** few dated Lagos prices. Sugar mostly uses national wholesale figures, and nothing was found for 2018 or after early 2024 for sugar, or between 2021 and 2024 for milk.
- **All commodities, 2025–2026:** NBS no longer publishes a Lagos price for each item, so these months rely on the South-West average.
- **June 2024:** NBS's Lagos figures show a one-off spike (for example, tomato ₦3,213/kg and yam ₦3,377/kg). It is real NBS data, but it makes June look unusually expensive to the forecasting model.
