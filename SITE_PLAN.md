# kgivler.com Site Plan

## Goal and visual direction
Make kgivler.com feel like Kyle's actual work and personality rather than an AI-polished résumé. Continue refining the existing site rather than redesigning it from zero.

Use one coherent design system across personal-site pages: dark technical colors, consistent navigation/footer, typography families, spacing, buttons, links, cards, status treatments, responsive behavior, and voice.

- Home: dark, modern, technical, personal; restrained terminal flavor rather than one giant fake terminal.
- Projects: clean dark technical cards/detail pages with minimal terminal decoration.
- Lab: strongest terminal/hacker aesthetic; prompts, command headings, status blocks, live widgets, interactive shell, and weirdness encouraged.
- Systems: same visual family, with an operational/catalog/dashboard emphasis.
- dev.kgivler.com: intentionally remains a separate light, conventional, professional site identifying Kyle Givler as the provider.

## Navigation
Primary navigation: Home, Projects, Lab, Systems, VPS Reviews, Hire Me (`https://dev.kgivler.com/`).

Preserve `/services/` compatibility; its human-facing navigation concept is Systems, avoiding confusion with paid Development Services. If a `/systems/` route is introduced later, preserve the old URL with appropriate redirects.

Do not add Blog navigation or an empty Latest Writing section before a blogging decision and actual content exist.

## Homepage
The homepage structure is in a good state and should not be repeatedly churned while project detail pages are being built.

Current intended progression:
1. short human introduction / `whoami`
2. small Steam presence
3. Featured Projects
4. infrastructure / hosting Kyle uses, including required affiliate disclosure
5. Development Services / Hire Me
6. current / recent work
7. Lab teaser
8. interactive shell
9. contact / elsewhere
10. footer

Featured Projects are Mission Control, Random Steam Game, and What Should I Work On Today?. Keep their homepage descriptions concise; detailed architecture and project history belong on their project pages.

kgivler.com and api.kgivler.com run on FrontDesk. Full host telemetry is not a defining homepage feature.

## /lab/
`/lab/` is the home for larger live and experimental features, reusing existing CSS, JS, and API logic where appropriate:

- detailed host telemetry
- Random Steam mini-demo
- services/system preview
- QOTD
- recent Git activity
- public chat block
- BBS presentation
- other live infrastructure experiments
- full interactive shell at the bottom

Steam presence stays on Home; the shell appears on both pages. Preserve accessibility, useful static/no-JavaScript behavior, independent widget failure handling, and deliberately sanitized public telemetry.

## /projects/
`/projects/` is a curated directory, not a repository dump. Keep clean project routes such as `/projects/mission-control/`, `/projects/random-steam/`, `/projects/wsiwot/`, `/projects/reapershell/`, and `/projects/tcpnoise/`.

Current featured projects:
- Mission Control
- Random Steam Game
- What Should I Work On Today?

Useful categories:
- applications / infrastructure
- developer tools
- networking / protocols
- game / modding

### Detail-page pattern
Project detail pages are case studies, not README copies. Reuse the shared `Source/projects/project-detail.css` pattern while allowing each project to have its own story and section order.

Completed detail pages on `dev`:
- Mission Control — `/projects/mission-control/`
- Random Steam Game — `/projects/random-steam/`
- What Should I Work On Today? — `/projects/wsiwot/`

Planned next detail pages, in rough order:
1. DN42Atlas
2. tcpnoise / Noise Observatory as one combined story
3. ReaperShell
4. PlutoAdDetector
5. Random GitHub
6. SmolSearch
7. the Happy protocol projects as one combined page
8. RimWorld modding as one combined page

Build and review these pages one at a time. After the planned detail pages exist, return to `/projects/` and add the local `Details →` links in one cleanup pass instead of repeatedly editing the index after each page.

### Projects that belong on the index before they need a detail page
Mycelium is substantial enough for a Networking / protocols entry now, but should wait for its own detail page until it has a stronger completed vertical slice such as recursive crawling, a second protocol, or behavioral protocol recognition.

### Projects to revisit later
Do not add planning-stage projects merely because a repository exists. Revisit these after they have useful implemented behavior:
- Internet Noise FM — keep it associated with the tcpnoise / Noise Observatory story until there is a working station worth showing separately.
- ShareShit — revisit after the basic sharing/upload/expiration/token flow is implemented.
- HappyPortal — revisit after it moves beyond pre-MVP planning into a usable client/service workflow.
- B.L.O.A.T. — add once the live service actually performs URL amplification and the intentionally inconvenient transfer flow.

The DN42 / Yggdrasil infrastructure story deserves a future case study, but leave it until late in this project-page pass. First review the Systems page and finish the planned clearnet-facing peering / DN42-mirror presentation. Then decide whether the result belongs primarily under Projects, Systems, or both.

Consolidate RimWorld work where one entry/page with selected mods tells a clearer story. Do not publish every tutorial, fork, scratchpad, archive, learning repo, landing-page repo, or abandoned experiment.

## Copy cleanup
Audit Home and the Systems catalog line by line when those areas are actively being worked on. Remove repetitive Problem / Built / Decisions / Stack / Result treatments, formal architecture prose on Home, repeated claims about designing/deploying/operating systems, stale descriptions, duplicate project entries, and generated résumé language.

Prefer short first-person explanations, concrete technical details, and humor where it fits. Detailed architecture belongs on project pages, repository READMEs, or future writing.

### Monetization guardrail
Preserve existing monetization/affiliate content and required affiliate disclosures during future homepage cleanup unless Kyle explicitly requests their removal. Presentation may be compacted to fit the design, but keep affiliate links, sponsored link attributes, and clear commission disclosure.

## Systems: inventory vs telemetry
Declared service inventory is authoritative. Mission Control Agents are optional telemetry sources, not the source of truth for service existence.

A known service on a host without an Agent stays visible with NO AGENT or STATUS UNAVAILABLE. Hard-coded summary counts should eventually come from inventory or be removed. Never expose private URLs or administrative controls.

A later Systems review should also consider how DN42/Yggdrasil peering, public/mirrored services, and the eventual clearnet-facing peer/mirror presentation fit together before building the dedicated alternate-network infrastructure project page.

## Blogging: future decision
Do not implement Blog now. Kyle has not selected static HTML, generated Markdown, a small .NET app, or another approach. No Blog nav or placeholders before that decision and actual content.

If blogging proceeds, `https://kgivler.com/blog/` remains a useful candidate canonical location, with `blog.kgivler.com` optionally redirecting there. Stable URLs, dates, metadata, RSS, and sitemap coverage would be useful requirements.

Avoid CMS complexity, browser editing interfaces, databases, login/admin systems, or separate APIs without a real need.

Possible future topics: Gopher/Gemini, DN42, Yggdrasil/WireGuard routing, FreeBSD C networking, tcpnoise and Internet scanners, self-hosted monitoring, restic/Backblaze backups, oddball RFC protocols, and .NET infrastructure work. These may eventually have both stable project/system pages and narrative posts.

## Development services
The site already exists. Preserve its separate light professional style and Kyle's identity. Communicate breadth without an unreadable list; do not invent fixed prices or legal, tax, licensing, SLA, or business terms.

## Current execution order
1. Continue building and reviewing the planned project detail pages one at a time.
2. Add Mycelium to the curated `/projects/` index during the next index cleanup, without giving it a detail page yet.
3. When the detail-page batch is complete, update `/projects/` once with `Details →` links and any final catalog cleanup.
4. Review the Systems page and service inventory/host modeling while preserving `/services/` compatibility.
5. Revisit the DN42/Yggdrasil infrastructure case study after the Systems review and planned clearnet peering / DN42-mirror presentation work.
6. Decide whether and how to blog only when ready to publish content.
7. Revisit smaller polish such as sitemap/SEO coverage, webmanifest metadata, shell discoverability, and mobile/static behavior as pages are added.

## Validation
For static-site changes, check duplicate DOM IDs, nested asset/module paths, screenshot sizing, responsive behavior, accessibility, useful no-JavaScript behavior, and available frontend/static checks. Run `git diff --check` when practical and report browser-testing limitations.
