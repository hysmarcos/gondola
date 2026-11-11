# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Shoppers who buy at coto.com.ar and want to spend less. They compare products in a category, pick bank promos by day, and check the cart before paying. They install the extension from the Chrome Web Store, so they may know nothing about how it works.

## Name
Góndola ("Góndola para Coto"). The goal is an improved version of each supermarket's site: Coto first, then Carrefour, Día, Más and others, each as "Góndola para <store>". Own brand: navy #14284b with an amber #ffc233 highlight (icon in assets/icon/). On Coto, the product list and the product page use Góndola's own skin; the user can turn it off in the popup.

## Product Purpose
A Chrome extension (Manifest V3) that adds what Coto's site lacks for a careful shopper: sorting by price per kg/L/unit, a "real price to compare" on every product, bank promos that follow Coto's real rules, and a cart that shows what you will really pay. Success: the shopper picks the cheapest option without doing math, and Coto's own features (add, quantities, checkout) keep working.

## Positioning
It works inside Coto's own pages and uses Coto's own data (the price with any offer, multi-buy promos, bank promos from Coto's API, exclusions from Coto's legal terms). To compare, it only sends barcodes (EAN) to the public APIs of Carrefour, Día and Más; no own servers, no personal data.

## Operating Context
- Runs on coto.com.ar: category lists, search, offers, product page, carousels, mini-cart, /carrito.
- Popup (toolbar button): the user picks bank cards and the shopping day, and the theme (Claro / Oscuro / Automático). More menus will come, so the popup has tabs.
- Settings are stored with chrome.storage.local only. The one exception is the resolved theme ("light" or "dark"), which src/theme.js also caches in coto.com.ar's localStorage under gondola-theme so the page does not flash white on load; Coto's scripts can read it, but it reveals nothing the data-gondola-theme attribute on <html> does not already show.

## Capabilities and Constraints
- Never removes or breaks Coto's native UI or behavior; it only adds nodes and data-coto-unit-* attributes (data-coto-unit-hide also hides "Ver planes de cuotas" on list cards when the Góndola design is on). With the design on, it also sets data-gondola-skin on <html> and hides with CSS the product page's fixed rating stars and empty spacer divs. The Góndola skin restyles the list and product pages with CSS; never re-parents Coto's controls.
- With the dark theme on, it sets data-gondola-theme on <html> and, during the change, the temporary class gondola-theme-wave. It restyles the whole site with CSS only, on every Coto page and not just the two the skin covers.
- Can change the quantity of an add-to-cart request only to complete NxM promos (2x1, 3x2, 6x4…), and the user can turn this off.
- Host permissions only for Carrefour, Día and Más; no own servers.

## Brand Commitments
- Neutral base; Coto red only for buying and offers; blue and amber for what Góndola adds.
- It is NOT an official Coto product: the popup must say "No afiliado a Coto" and must not use Coto's logo.
- Language: Spanish (Argentina), short and plain.

## Evidence on Hand
No testimonials, ratings, or user numbers exist. Do not invent them.

## Product Principles
1. Coto keeps working: every native button, total, and flow behaves as before.
2. One number to compare: the shopper sees the price that matters first; Coto's secondary lines fade.
3. Honest math: if the extension is not sure (data mismatch, out of sync total), it shows nothing rather than a wrong number.
4. The user stays in control: automatic actions can be turned off.
