# AGENTS.md

## Purpose

This repository powers Kyle Givler's personal site at `kgivler.com` and the related development-services site at `dev.kgivler.com`.

The main site should feel personal, technical, playful, and recognizably Kyle. The development-services site should remain intentionally conventional, light-themed, clear, and easy for a potential client to understand.

Do not turn either site into a generic AI-written portfolio or an over-engineered web application.

## Branch / working context

Check `dev` first unless Kyle explicitly says otherwise.

Inspect the existing implementation before changing it.

Make the smallest coherent change needed for the current task. Do not opportunistically rewrite unrelated pages, styles, or infrastructure.

## Working rules

- Preserve the terminal / systems-lab identity of the main site.
- Prefer plain HTML, CSS, and native JavaScript for static frontend work.
- Prefer .NET when a server-side component is actually needed.
- Do not introduce React, Vue, or another SPA framework.
- Keep dependencies small and intentional.
- Preserve accessibility and graceful no-JavaScript behavior.
- Preserve graceful degradation when optional self-hosted services are unavailable.
- Keep public telemetry deliberately sanitized.
- Run relevant checks after meaningful changes.

## Copy and tone

Visible copy should sound natural, specific, and human.

Avoid:

- generic portfolio / résumé language
- repetitive `Problem / Built / Decisions / Stack / Result` templates
- generic marketing filler
- architecture prose that reads like internal documentation
- unnecessary phrases such as `supporting infrastructure`, `operational capabilities`, or `provides` when simpler wording works
- repeating that Kyle designed, deployed, operates, or maintains something when the page already makes that obvious

Prefer:

- short explanations
- concrete technical details
- first-person language where natural
- plain wording
- humor where it fits
- dry technical lists when a list is actually the clearest format

SEO metadata may be more conventional than visible body copy.

## Main-site structure

Primary navigation:

- Home
- Projects
- Lab
- Systems
- VPS Reviews
- Hire Me

The homepage is stable enough that unrelated work should not churn it.

Do not let Home become a monitoring dashboard. Detailed live widgets belong on `/lab/`.

## Lab

`/lab/` is the interactive / weird part of the site.

It currently includes:

- host telemetry
- Random Steam mini-demo
- service preview
- Noise Observatory recent events
- QOTD
- public IRC chat
- public Matrix room
- recent Git activity
- visitor BBS
- interactive shell

Keep Lab focused on things a visitor can interact with or watch live.

Project case studies can be linked from Lab widgets where that helps, but do not turn Lab into another project directory.

## Projects

Use `/projects/` as a curated directory, not a repository dump.

Completed detail pages:

- `/projects/mission-control/`
- `/projects/random-steam/`
- `/projects/wsiwot/`
- `/projects/dn42atlas/`
- `/projects/tcpnoise/`
- `/projects/reapershell/`
- `/projects/pluto-ad-detector/`
- `/projects/random-github/`
- `/projects/happy-protocols/`

Project detail pages are human-facing case studies, not README copies.

Reuse:

- `Source/projects/projects.css`
- `Source/projects/project-detail.css`

where practical, but do not force every case study into identical headings.

The current project-detail batch is complete.

Do not add detail pages now for:

- SmolSearch
- RimWorld modding
- DN42 / Yggdrasil infrastructure
- Mycelium

Mycelium should be present in the curated Networking / protocols index if it is still missing, but it does not deserve a detail page yet.

Do not associate the iMule modernization project with Kyle or this public site.

Do not add planning-stage projects simply because repositories exist. Revisit Internet Noise FM, ShareShit, HappyPortal, and B.L.O.A.T. only when they have useful implemented behavior.

## Systems

`/services/` is the current Systems page.

Systems should document what Kyle runs without exposing the private management plane.

The current page is improved but not yet certified complete.

Do not claim completeness until a later full inventory audit has reconciled the page against the actual hosts.

### Inventory vs telemetry

Declared inventory is authoritative for whether a service exists.

Mission Control Agents are telemetry sources, not inventory sources.

A known service may remain listed even when no Agent is available. Do not hide it or move it to a different host to make telemetry look cleaner.

### Systems copy

Some Systems prose still sounds too much like documentation.

A future cleanup should preserve the structure and facts while rewriting only the human-facing prose.

Do not replace useful technical lists with fluffy paragraphs.

### Full audit later

When asked to perform the real Systems audit, go host by host:

- Clanker
- ScopeCreep
- Wurstcase
- FrontDesk
- Molasses
- hbg1
- Ryzenshine

Reconcile, as applicable:

- listening sockets
- system services
- Docker / compose workloads
- nginx / IIS sites and bindings
- DNS zones
- routing daemons and policies
- WireGuard / Yggdrasil connectivity
- scheduled jobs / timers / tasks
- backups
- public APIs
- classic protocol listeners
- Hyper-V workloads on Ryzenshine

Classify each discovered item as:

- public service
- alternate-network service
- internal operations
- infrastructure component
- experiment
- intentionally omitted

Do not expose secrets or unnecessary attack-surface detail just to make the inventory feel complete.

## DN42 peering

Kyle operates `AS4242420425`.

Systems should contain a short DN42 introduction and a `Peer with me on DN42` link, but should not duplicate full routing policy.

Planned clearnet peering hostname:

`https://dn42.kgivler.com/`

That hostname does not exist yet.

The next implementation task is to make it a clearnet mirror / proxy of the existing DN42Landing content.

DN42Landing is the detailed source for current:

- POPs
- prefixes
- tunnel options
- BGP policy
- transit policy
- Looking Glass links
- contact information

Avoid maintaining two separate hand-written copies of peering policy.

## Yggdrasil peering

Use the existing Yggdrasil landing page for detailed peering information:

`http://landing.ygg.kgivler.com/`

Systems may briefly explain Yggdrasil and that public peering is available, but the landing page should carry the current peer URIs, ports, node details, and locations.

## Happy Protocols

Treat the Happy* protocol servers as one larger project story.

The Systems page may list individual deployed protocol services.

HappyTime / RFC 868 is not currently deployed. Do not present it as a live service until Kyle says that changed.

## Public communication

Public communication currently includes:

- IRC web chat: `https://chat.kgivler.com/`
- Matrix room: `#joyfulreaper-dev:kgivler.com`
- Matrix link: `https://matrix.to/#/#joyfulreaper-dev:kgivler.com`

It is fine for both Lab and Systems to link these.

## Future DN42 / Yggdrasil case study

Do not build the dedicated alternate-network infrastructure case study yet.

Wait until:

1. Systems has settled
2. `dn42.kgivler.com` exists
3. the peering presentation is working
4. the full Systems inventory audit has been done

Then decide whether the story belongs under Projects, Systems, or both.

## Blog

Blogging remains a future decision.

Do not add Blog navigation, placeholders, or a publishing system before actual content exists and Kyle has chosen an implementation.

## Development services

`dev.kgivler.com` is intentionally visually separate.

It should:

- use a light, conventional, professional style
- identify Kyle Givler as the provider
- avoid fake-company branding
- communicate breadth without becoming an unreadable list
- avoid invented legal, tax, licensing, SLA, or business terms

Do not opportunistically redesign `dev.kgivler.com` while working on the main site.

## Security and privacy

- Never commit real credentials.
- Never put private Agent endpoints in frontend files.
- Never publish private WireGuard addresses unless Kyle explicitly intends them to be public.
- Do not expose administrative controls from public pages.
- Do not expose private management URLs simply because they appear in inventory or configuration.
- Treat User-Agent and similar request metadata as untrusted claims.
- Do not expand public telemetry simply because the backend can collect it.
- Keep public service descriptions accurate without publishing unnecessary attack-surface details.

## Validation

For static changes:

- inspect the existing page first
- check duplicate DOM IDs
- check internal routes and asset paths
- check external links
- check responsive behavior
- preserve keyboard / accessibility behavior
- preserve useful no-JavaScript behavior
- run `git diff --check` when practical
- report any browser-testing limitation

For Systems changes specifically, check that private endpoints, credentials, API keys, private network addresses, and administrative URLs were not accidentally added.
