# Stonybrook Landscaping

**Fictional small-business website — portfolio demonstration**

Stonybrook Landscaping is a fictional premium residential landscaping company created to demonstrate the design, code quality, and deliverables offered through my website development services.

**This is not a real landscaping business.** The company, project descriptions, and business information are illustrative.

## Purpose

This project demonstrates what a client could receive when commissioning a small-business website through [my development services](https://dev.kgivler.com/websites/).

The goal is a professional, responsive, accessible, and maintainable website without unnecessary frameworks or infrastructure.

## Technology

- HTML5
- CSS3
- Vanilla JavaScript, where necessary
- Static file hosting (Nginx or another conventional web server)
- No frontend framework or build system required

## Pages

| Page | Purpose |
|---|---|
| Home | Business introduction, services overview, and calls to action |
| About | Company story, approach, and philosophy |
| Services | Landscape design, hardscaping, planting, and outdoor living |
| Portfolio | Illustrative landscaping projects |
| Contact | Consultation request form |

## Demonstration Status

**Ready for portfolio review.** This is a finished static-site example, not an operating landscaping company.

All five pages are implemented. The portfolio is a complete static gallery that becomes a manual carousel when JavaScript initializes successfully.

The sample contact form is a **local-only demonstration**. With JavaScript enabled, it shows native browser validation and a confirmation, then clears the fields. It does not transmit submissions or store them on the server. Without JavaScript, the submit button stays disabled. Do not connect this fictional-business demo to a live submission endpoint.

## Search engines and social previews

The demonstration domain intentionally has a `robots.txt` file with `Disallow: /`
so compliant crawlers will not crawl the fictional business. This is **not**
a guarantee that the URL itself cannot appear in search results if another
site links to it. To reliably use `noindex`, crawlers need to be allowed
to request the pages and read the directive.

The HTML still demonstrates page-specific titles, descriptions, canonical
URLs, semantic headings, descriptive image text, and Open Graph/social-preview
metadata. The demo includes a branded favicon. Social cards reuse the
existing illustrative `hero.jpg` rather than adding another image asset.

For an actual client site, replace the fictional content, canonicals,
images, and social metadata with real business details, and set crawler
access according to that site's needs. This demo does not need a sitemap.

## Design Goals

- Professional presentation appropriate for a premium residential landscaping business
- Responsive layouts for desktop, tablet, and mobile
- Clear navigation and calls to action
- Semantic HTML and keyboard accessibility
- Basic search-engine metadata
- Readable, maintainable source code
- Minimal dependencies
- Straightforward static hosting and deployment

## Running Locally

Open `index.html` in a browser, or serve this directory using any static HTTP server.

No compilation or package installation is required.

## Images and Other Assets

The imagery is AI-generated and does not represent completed work by an actual landscaping company.

`about-garden.jpg` is a progressive JPEG at 1600 × 1200 (705,480 bytes). The 800 × 600 variant, `about-garden-800.jpg`, is 169,977 bytes. Both were resized from the original 2000 × 1500 image with Lanczos resampling and saved at JPEG quality 78 with optimization. HTML uses width-based `srcset`; the About background uses `image-set` with a JPEG fallback. WebP trials were larger than JPEG for this image, so no extra format is shipped.

Third-party images and assets may have separate licenses. Their inclusion in this demonstration does not grant permission to reuse them.

## Accessibility notes

- Link focus uses forest and cream rings so it remains visible on light surfaces, dark surfaces, and imagery. Forest against cream is 7.22:1 and against sand is 6.55:1.
- Placeholder text is 6.03:1 against white. Inactive gallery indicators are 3.86:1 against cream. These exceed the relevant 4.5:1 text and 3:1 interface contrast targets.
- The disabled submit button (when JavaScript is unavailable) is intentionally inactive and is exempt from minimum contrast requirements. The demo confirmation has a status announcement and receives focus after a successful example submission. The brand's decorative gold dot is hidden from assistive technology. This is not a claim of full WCAG conformance.
- All pages have a first-focusable skip link. The gallery exposes all four images and descriptions without JavaScript; enhancement alone enables controls and hides inactive projects. Captions share a grid row to reserve enough space as text wraps, without clipping enlarged text.
- Reduced-motion preferences disable smooth scrolling and reduce transitions. Mobile/tablet form fields use at least 16px text without restricting user zoom.

## Licensing — Important

**THIS PROJECT IS NOT MIT LICENSED.**

Although other parts of the parent repository may be distributed under the MIT License, the files in `dev/examples/stonybrook/` are expressly excluded.

This project's source code is publicly available solely so prospective clients can evaluate my programming competence, code quality, and development practices when considering hiring me.

Viewing and inspection for that purpose are permitted. Reuse, redistribution, modification, deployment, and use as a website template are not permitted without prior written authorization.

See [LICENSE.txt](LICENSE.txt) for the complete terms.

## Development Services

Interested in commissioning a website or custom software?

Visit **https://dev.kgivler.com/** for services, pricing, and contact information.

---

Copyright © 2026 Kyle Givler. All rights reserved for this demonstration project.
