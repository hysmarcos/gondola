# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Shoppers who buy at coto.com.ar and want to spend less. They compare products in a category, pick bank promos by day, and check the cart before paying. They install the extension from the Chrome Web Store, so they may know nothing about how it works.

## Name
Góndola ("Góndola para Coto"). The goal is an improved version of each supermarket's site: Coto first, then Carrefour, Día, Más and others, each as "Góndola para <store>". Own brand: navy #14284b with an amber #ffc233 highlight (icon in assets/icon/). Coto pages keep Coto's look.

## Product Purpose
A Chrome extension (Manifest V3) that adds what Coto's site lacks for a careful shopper: sorting by price per kg/L/unit, a "real price to compare" on every product, bank promos that follow Coto's real rules, and a cart that shows what you will really pay. Success: the shopper picks the cheapest option without doing math, and Coto's own features (add, quantities, checkout) keep working.

## Positioning
It works inside Coto's own pages and uses Coto's own data (the price with any offer, multi-buy promos, bank promos from Coto's API, exclusions from Coto's legal terms). To compare, it only sends barcodes (EAN) to the public APIs of Carrefour, Día and Más; no own servers, no personal data.

## Operating Context
- Runs on coto.com.ar: category lists, search, offers, product page, carousels, mini-cart, /carrito.
- Popup (toolbar button): the user picks bank cards and the shopping day. More menus will come, so the popup has tabs.
- Settings are stored with chrome.storage.local only.

## Capabilities and Constraints
- Never removes or breaks Coto's native UI or behavior; it only adds nodes and data-coto-unit-* attributes.
- Can change the quantity of an add-to-cart request only to complete NxM promos (2x1, 3x2, 6x4…), and the user can turn this off.
- Host permissions only for Carrefour, Día and Más; no own servers.

## Brand Commitments
- Visually close to Coto (Coto red, Poppins) so it feels at home on the site.
- It is NOT an official Coto product: the popup must say "No afiliado a Coto" and must not use Coto's logo.
- Language: Spanish (Argentina), short and plain.

## Evidence on Hand
No testimonials, ratings, or user numbers exist. Do not invent them.

## Product Principles
1. Coto keeps working: every native button, total, and flow behaves as before.
2. One number to compare: the shopper sees the price that matters first; Coto's secondary lines fade.
3. Honest math: if the extension is not sure (data mismatch, out of sync total), it shows nothing rather than a wrong number.
4. The user stays in control: automatic actions can be turned off.
