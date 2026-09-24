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
Target homepage order:
1. Short human introduction
2. Prominent workstation/system-status widget
3. Small Steam presence indicator
4. Featured projects
5. Latest blog/devlog posts
6. Development-services callout linking to `https://dev.kgivler.com/`
7. Recent/selected projects
8. Link to `/projects/`
9. Interactive shell near the bottom
10. Contact and external links

The interactive shell should also appear at the bottom of `/lab/`.

Do not let the homepage become a full operations dashboard. Detailed live widgets belong on `/lab/`.

## Lab
`/lab/` is the home for larger live/experimental features:
- detailed workstation telemetry
- Random Steam demo
- service/system status views
- QOTD
- recent Git activity
- visitor BBS
- Qwen/local-AI experiment
- other live infrastructure experiments
- the interactive shell at the bottom

## Projects
Use `/projects/` as a curated project directory with clean URLs such as:
- `/projects/mission-control/`
- `/projects/random-steam/`
- `/projects/reapershell/`
- `/projects/tcpnoise/`

Do not dump every tutorial, fork, scratchpad, archive, or abandoned experiment onto the public project directory.

## Blog
The planned canonical blog location is `https://kgivler.com/blog/`.

Use Markdown as the authoring format.

A small .NET server-rendered app is acceptable, but avoid browser WYSIWYG editors, JavaScript editing interfaces, a database unless truly needed, login/admin systems just to publish posts, and a separate API unless justified.

Posts should have stable URLs, dates, metadata, RSS, and sitemap coverage.

If `blog.kgivler.com` is used, prefer redirecting it to `https://kgivler.com/blog/` rather than maintaining a second canonical copy.

## Development services
`dev.kgivler.com` is intentionally visually separate from the main site.

It should:
- use a light, conventional, professional visual style
- identify the service provider as Kyle Givler
- avoid fake-company branding
- use LinkedIn as the initial primary contact path
- avoid publishing fixed prices until pricing is deliberately worked out
- communicate breadth without becoming an unreadable list

Potential service areas include websites, custom .NET/backend applications, APIs and small services, integrations and automation, Docker/VPS/self-hosting help, debugging/code review, programming mentoring, and smaller or discounted non-commercial/community work.

Do not imply legal, tax, licensing, SLA, or business terms that have not been deliberately decided.

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
