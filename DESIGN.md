# Design system

## Direction

An independent field-service calculator in the visual language of Väderstad's equipment identity: a bright, minimal worksheet framed by a red masthead, compact red actions, and the supplied black, red, and yellow app mark. It uses the official equipment logo in the header and a clear non-affiliation label. No ornamental gradients, remote fonts, or remote image dependencies; the interface remains self-contained offline.

## Context and composition

Built for a farmer or operator checking a rate outdoors in bright daylight, often one-handed on a phone. The surface stays light with dark text; labeled inputs and a persistent three-tab bottom bar make the next action easy to find. Each screen groups calculations with spacing and hairline dividers instead of nested cards. Unit buttons sit beside values and switch on tap. On wider viewports, related calculators form columns without changing their reading order.

## Tokens

- Väderstad red: `#c2242a`; Väderstad yellow: `#f1ca00`; black: `#000000`; official dark yellow: `#d7b505`.
- Charcoal: `#333333`; black: `#000000`; deep green: `#3c5a44`.
- White: `#ffffff`; cool paper: `#f4f5f2`; borders: `#c9ccc6`.
- Warning/error red: `#9e1b22`, distinguished by text and invalid field state.
- Body type: system sans-serif stack. Numerical outputs use tabular numerals.
- Touch controls: minimum 48 px high. Focus: clearly visible green outline.

## Components and behavior

- Red brand band: yellow-backed official logo, app identity, independent-tool status.
- Bottom navigation: three large, labeled tabs (Rates, Bins, Field); selected tab uses red fill and yellow indicator.
- Worksheet groups: crisp dividers, clear headings, paired controls and prominent high-contrast result fields.
- Bin estimates always retain a visible source caveat. Published model volumes load from the official data table; other carts require user-entered capacities. Product density, fill factor, and application rates are user-provided. The product-first optimizer assigns products to bins, with chained assignment clearly marked as a compatibility-dependent planning option.
- Invalid or incomplete values produce an explicit prompt instead of a zero or stale result.
- Respect reduced-motion settings; avoid motion that impairs use.

## Responsive behavior

Phone-first single column with a safe-area-aware sticky bottom navigation. At larger widths, paired worksheet groups can sit side-by-side, with a constrained reading width and unchanged bottom navigation semantics. All assets and page references are relative for GitHub Pages subpaths.
