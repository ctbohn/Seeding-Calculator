# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Inferred from the supplied product brief: farmers and equipment operators using a phone while setting up or running seeding equipment in the field or farmyard.

## Product Purpose

An offline-capable field toolkit for converting seeding rates, estimating field product requirements and cart run limits, estimating field capacity and checking a meter using a catch test.

## Positioning

The product brings common seeding calculations into one phone-first, field-ready tool; calculations work offline after the app shell is cached.

## Operating Context

Users may need to make or verify calculations outdoors, away from reliable connectivity, using US customary or metric units. The tool is intended for operational estimates and setup checks.

## Capabilities and Constraints

The app calculates mass-rate and TKW-based seed-count conversions, field totals, optimized product-to-bin assignments, per-product acreage and refill estimates, theoretical/effective field capacity, field time, and meter catch-test results. Dedicated assignments use one bin per product; optional chained planning assigns multiple bins to one product and requires the operator to verify metering and plumbing compatibility. Official per-bin and optional Bin 5 volumes for Väderstad Precision Delivery models 400, 680, 820, 910, 1000, and 1350 are sourced from the linked official product page's technical table. Product densities and fill factors, along with rates, widths, speeds, turn times, and other field inputs, are user-provided. The product is an independent tool and is not affiliated with or endorsed by Väderstad. Calculation outputs are estimates and do not replace equipment documentation or field verification.

## Evidence on Hand

The official Väderstad Precision Delivery page is accessible at https://www.vaderstad.com/ca-en/drilling/air-carts/precision-delivery-air-cart and includes an official technical table for model totals and per-bin volumes in bu and L. The model-specific litre figures are preserved in `vaderstad-pd-specs.js` and the on-screen table. Official logo and palette asset URLs are documented in README.md. All numeric examples in automated tests are synthetic test values, not manufacturer specifications.

## Product Principles

- Keep the essential workflows available offline.
- Make units, assumptions, and source quality visible beside the resulting estimate.
- Never present unverified manufacturer specifications as facts.
- Validate user inputs and expose invalid or incomplete calculations clearly.
