# Sahasra Vastra — Shopify theme

The storefront theme for sahasravastra.com: Shopify **Horizon 4.1.4** with the Sahasra Vastra (`sv-*`) sections, snippets and assets on top.

The first commit is a snapshot of the live theme (`sahasra-build-v1`), pulled through the Admin API and checked against Shopify's checksums.

## Previewing a branch

In Shopify Admin, go to **Online Store → Themes → Add theme → Connect from GitHub**. Pick this repository and branch. Shopify creates an unpublished theme that stays in sync with the branch. Preview it, then publish it when you're happy.

With the Shopify CLI: `shopify theme dev --store sahasravastra.myshopify.com`.

## How the shop is organised (tags)

| Tag | Meaning |
| --- | --- |
| `age-0-3m`, `age-6-9m`, `age-2-3y` … | The age bands a design is made in. The band labels and order come from the main menu's *Shop by Age* third level. |
| `type-romper`, `type-co-ord` … | The garment type. Each category collection is a smart collection on one of these tags. |
| `gender-girl`, `gender-boy` | **New.** Tag a unisex design with **both**. The Girls · Boys choices appear only after at least one product has one of these tags. |

## Products popup (age → category → products)

* Clicking any link to **/pages/products** opens the popup. The popup asks the child's age (and Girls/Boys once products are tagged), then shows only the categories made in that age. Next it shows the category's sub-categories, if it has any. It ends on `/collections/<category>/<age-tag>`.
* **Categories** are read from the navigation:
  * the `sv-categories` menu if you create one (top level = categories, second level = sub-categories), otherwise
  * the main menu item that links to `/pages/products`, or is titled *Products*, *Shop by Type* or *Shop by Category*.
* **Category icons** come from the collection metafield `custom.category_icon` (a file). Otherwise the collection image is used, then the first product photo.

### Store setup (done 24 Sep 2026)
* The **Products** page exists (handle `products`, template **products**).
* In the main menu, *Shop by Type* is renamed **Products**. It still links to All products, so the old theme keeps working. This theme opens the popup from any top-level menu item titled "Products", whatever its link.
* Products are tagged `gender-girl` / `gender-boy`; unisex designs have both.
* The preview theme **"Sahasra — Products finder (preview 2)"** (unpublished) holds this branch's changes on top of the live theme's stock-limit work.
* Every garment type is its own smart collection on a `type-` tag, listed under **Products** in the main menu. Clothing: Sleepsuits (`type-sleepsuit`), Rompers (`type-romper`), Onesies (`type-onesie`), Jumpsuits (`type-jumpsuit`), Dungarees (`type-dungaree`), Co-ord Sets (`type-co-ord`), Sunsuits (`type-sunsuit`), Frocks & Dresses (`type-frock`), T-Shirts & Tops (`type-top`), Bottoms (`type-bottom`), Ethnic Wear (`type-ethnic`). Accessories: Sleeping Bags (`type-sleeping-bag`), Swaddles (`type-swaddle`), Bibs (`type-bib`), Burp Cloths (`type-burp-cloth`), Caps (`type-cap`). A type with no products yet stays hidden in the menu, the category grid and the popup.
* The footed sleepsuits carry `type-sleepsuit`, not `type-romper`. The old *Rompers & Onesies* collection is no longer in the menu.

## Collection page

Filters are now a left sidebar (lunabee style). The top of the sidebar lists:

* **Category**, with counts for the age being viewed
* **Shopping for** (Girls/Boys)
* **Age** chips

Shopify's own filters (size, price, availability, from Search & Discovery) follow below.

## Product page

The order is now: product, **You may also like**, **Recently viewed**, **Customer reviews**, Reels, *Completes the set* + legal record, delivery charges.

* **Details** and **Size guide** (the measurement table and size chart) are accordions in the right-hand column.
* Product **videos** added to a product's media play inside the image carousel.

### Reviews
* Reviews live in **Content → Metaobjects → Product review** (type `sv_review`). Only **Active** entries show on the site; leave a new one as Draft until it's checked.
* **Write a review** on the site emails the review to the store's contact address. Copy the good ones into a Product review entry, and add the parent's photo if they sent one.
* To use a reviews app instead (Judge.me, Loox), add its block to the *SV Reviews* section.

## Homepage additions
* **SV Shop by category**: tiles open the popup with that category already chosen.
* **SV Products in tabs**: New arrivals split into Girls / Boys by tag.
* **SV Reels**: add a *Reel* block per vertical video.
* **SV Moments** ("Sahasra Vastra Moments"): add a *Moment* block per customer photo, with an optional name, quote and the product they're wearing.
