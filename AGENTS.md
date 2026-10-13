# AGENTS.md

## Purpose
This repository powers Kyle Givler's personal site at `kgivler.com` and the related development-services site at `dev.kgivler.com`.

The main site should feel personal, technical, playful, and recognizably Kyle. The development-services site should be intentionally conventional, light-themed, clear, and easy for a potential client to understand.

Do not turn either site into a generic AI-written portfolio or an over-engineered web application.

## Working rules
- Preserve the terminal/systems-lab identity of the main site.
- Prefer plain HTML, CSS, and native JavaScript for static frontend work.
- Prefer .NET for server-side functionality when a server component is actually needed.
- Do not introduce React, Vue, or another SPA framework.
- Keep dependencies small and intentional.
- Preserve accessibility and graceful no-JavaScript behavior.
- Preserve graceful degradation when optional self-hosted services are unavailable.
- Never expose private service URLs, WireGuard addresses, credentials, API keys, secrets, or administrative endpoints to the browser.
- Keep public telemetry deliberately sanitized.
- Make the smallest coherent change needed for the current task.
- Do not opportunistically rewrite unrelated code.
- Inspect the existing implementation before changing it.
- Run relevant build/tests and verify static pages after meaningful changes.

## Copy and tone
Visible copy should sound natural and specific.

Avoid repetitive `Problem / Built / Decisions / Stack / Result` templates, inflated résumé language, generic marketing filler, and repeated claims about designing/deploying/operating systems.

Prefer short explanations, specific technical details where interesting, plain language, first-person explanations, and humor where it fits.

SEO metadata can be more conventional than visible body copy.

## Main-site structure
The homepage is in a stable enough state that project-detail work should not repeatedly churn it.

Current homepage progression:
1. short human introduction / `whoami`
2. small Steam presence
3. Featured Projects
4. infrastructure / hosting Kyle uses
5. Development Services / Hire Me
6. current / recent work
7. Lab teaser
8. interactive shell
9. contact / elsewhere
10. footer

Featured Projects are Mission Control, Random Steam Game, and What Should I Work On Today?.

Do not let the homepage become a full operations dashboard. Detailed live widgets belong on `/lab/`.

The interactive shell should also appear at the bottom of `/lab/`.

## Lab
`/lab/` is the home for larger live/experimental features:
- detailed host telemetry
- Random Steam demo
- service/system status views
- QOTD
- recent Git activity
- visitor BBS
- other live infrastructure experiments
- the interactive shell at the bottom

## Projects
Use `/projects/` as a curated project directory, not a repository dump.

Clean project-detail routes include:
- `/projects/mission-control/`
- `/projects/random-steam/`
- `/projects/wsiwot/`
- `/projects/reapershell/`
- `/projects/tcpnoise/`

Project detail pages should be human-facing case studies, not README copies. Reuse `Source/projects/project-detail.css` where practical, but do not force every project into identical headings or structure.

Completed detail pages on `dev`:
- Mission Control
- Random Steam Game
- What Should I Work On Today?

Rough next-page order:
1. DN42Atlas
2. tcpnoise / Noise Observatory as one combined page
3. ReaperShell
4. PlutoAdDetector
5. Random GitHub
6. SmolSearch
7. Happy protocol projects as one combined page
8. RimWorld modding as one combined page

Build and review project detail pages one by one. Do not keep editing the `/projects/` index merely to add one new detail link after each page. After the planned detail-page batch is complete, do one catalog cleanup pass that adds `Details →` links and other needed index changes.

Mycelium belongs in the curated Networking / protocols catalog once that index pass happens, but it should not get a detail page yet. Wait for a stronger completed vertical slice such as recursive crawling, a second protocol, or behavioral protocol recognition.

Do not add planning-stage projects simply because repositories exist. Internet Noise FM, ShareShit, HappyPortal, and B.L.O.A.T. should be reconsidered when they have useful implemented behavior.

Leave the dedicated DN42 / Yggdrasil infrastructure case study until late in the project-page pass. Review the Systems page first and revisit the case study after the planned clearnet-facing peering / DN42-mirror presentation work.

Consolidate related work when that tells a clearer story:
- tcpnoise + Noise Observatory
- Happy protocol servers
- RimWorld modding

Do not dump tutorials, forks, scratchpads, archives, learning repos, landing-page repos, or abandoned experiments into the public project directory.

## Blog
Blogging remains a future decision.

Do not add Blog navigation, empty Latest Writing sections, or a publishing system before there is actual content and an implementation decision.

If blogging proceeds, `https://kgivler.com/blog/` is a useful candidate canonical location. Stable URLs, dates, metadata, RSS, and sitemap coverage would be useful. Avoid CMS complexity, browser WYSIWYG editors, login/admin systems, databases, or separate APIs without a real need.

## Development services
`dev.kgivler.com` is intentionally visually separate from the main site.

It should:
- use a light, conventional, professional visual style
- identify the service provider as Kyle Givler
- avoid fake-company branding
- communicate breadth without becoming an unreadable list
- avoid publishing invented legal, tax, licensing, SLA, or business terms

Do not opportunistically redesign `dev.kgivler.com` while working on main-site project pages.

## Service inventory
The operational service catalog must not treat Mission Control Agent availability as the source of truth for whether a service exists.

Inventory and telemetry are separate concepts.

A service may be known to exist on a host even when that host has no Agent. In that case show a clear state such as `NO AGENT` or `STATUS UNAVAILABLE` rather than hiding the service or assigning it to the wrong host.

## Security and privacy
- Never commit real credentials.
- Never put private Agent/WireGuard endpoints in frontend files.
- Do not expose administrative controls from public pages.
- Treat User-Agent and similar request metadata as untrusted claims.
- Do not expand public telemetry simply because the backend can collect it.
