# Air Seeder Field Toolkit

A phone-first, offline-capable field calculator for seeding rates, cart run limits, field capacity and meter catch tests. It is an independent tool, not an official Väderstad product and not affiliated with or endorsed by Väderstad.

## Use

Open `index.html` from a local web server or a GitHub Pages site. The three bottom tabs are **Rates**, **Bins** and **Field**. Enter the rates, seed counts, bulk densities, bin capacities, fill factors and machine/field measurements that apply to your equipment and product. Inputs are saved only in this browser on this device.

The app preloads the per-bin volume (L) published in Väderstad's technical table for the selected Precision Delivery model. The optional fifth bin is off unless you select it for a model offering one. The printed totals are shown as supplied and may differ slightly from summed bin volumes because of published rounding and optional-bin configurations. For other carts, enter the usable internal volume for each bin from the manual or dealer. Enter every product's rate, measured bulk density, and fill factor; optional TKW adds a seed-count estimate. Tap the unit chip next to a value to switch its units. The optimizer assigns separate bins or, when explicitly enabled, groups multiple bins with the same product. Chained assignments are only planning suggestions: verify actual cart plumbing and metering compatibility. The estimate assumes a full starting cart and uniform product flow; account for reserve/heel in the fill factor. Refill count excludes the initial load.

**Units:** Rates use lb/ac or kg/ha. TKW is grams per 1,000 seeds; the app derives seeds/ac for lb/ac and seeds/ha for kg/ha. Bin volume is entered in L, density in kg/L, and field area in acres in the Bins workflow. Conversions use 1 lb = 0.45359237 kg, 1 ac = 0.40468564224 ha, and 1 ha = 10,000 m². Theoretical field capacity assumes the entered working width is effective width; effective capacity adds the entered turn and refill delays. Turns are estimated from uniform-length passes using width × pass length, so irregular field shapes need operator judgment. Catch-test adjustment is target rate divided by measured rate, expressed as a percentage of the current meter setting.

## Product information and assumptions

The linked [Väderstad Precision Delivery Air Cart page](https://www.vaderstad.com/ca-en/drilling/air-carts/precision-delivery-air-cart) is accessible and includes a technical-data table with models 400, 680, 820, 910, 1000, and 1350, total volumes, four per-bin volumes and optional Bin 5 volumes where offered. The table and selectable model entries are reproduced in the Bins tab and `vaderstad-pd-specs.js`, with litres retained exactly as published. The optional bin is not included unless selected. Densities and fill factors are not specified in that table and are never prefilled.

The brand colors and logo are from Väderstad's publicly served [brand logo](https://www.vaderstad.com/globalassets/vaderstad-logo.svg) and [official stylesheet palette](https://www.vaderstad.com/assets/css/variables.61a6b442f0a48ee5ff24.css). Väderstad and its logo are trademarks of their owner; their use identifies the equipment context and does not imply endorsement.

All outputs are estimates for planning and setup checks, not a substitute for the operator's manual, product labels, calibrated scales or an on-machine verification. The owner should confirm the applicable product rates, metering limits, legal requirements and field conditions before operation.

## Offline and install

Serve the files over HTTPS (or `localhost`) to enable the service worker and PWA install prompt. The service worker and all app assets use relative paths, so the app works from a GitHub Pages project subpath as well as a domain root. Once loaded online, its app shell is cached for subsequent offline use. GitHub Actions deploys the repository to GitHub Pages when changes are pushed to `main`; configure Pages to use **GitHub Actions** if it is not already enabled.

The supplied square image at `assets/app-icon.png` is used for the browser favicon and installed app icon.

## Tests

Open `tests/calculations.test.html` from the same local server. It runs browser-native assertions against the calculation module and reports each result on the page.
