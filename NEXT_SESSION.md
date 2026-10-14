# Next Session — kgivler.com

## Where we stopped

The project-detail batch is finished.

Completed case studies:

- Mission Control
- Random Steam Game
- WSIWOT
- DN42Atlas
- tcpnoise + Noise Observatory
- ReaperShell
- PlutoAdDetector
- Random GitHub
- Happy Protocols

SmolSearch and RimWorld were intentionally skipped.

The dedicated DN42 / Yggdrasil infrastructure case study is intentionally deferred.

The `/projects/` index was updated to link to detail pages that actually exist.

The Lab received a small integration cleanup:

- project-detail links from relevant widgets
- Happy Protocols consolidation in the service preview
- IRC + Matrix chat links
- Matrix room: `#joyfulreaper-dev:kgivler.com`

The Systems page received a first conservative cleanup / expansion pass.

It is better organized, but Kyle is not fully happy with some of the prose because parts still read like documentation / AI copy. Do not reopen that tonight-style cleanup by default; save it for a focused copy pass.

## Immediate next task

Set up:

`https://dn42.kgivler.com/`

as a clearnet mirror / proxy of the existing DN42Landing content.

The Systems page should only give a short DN42 explanation and link to this landing page rather than duplicating the full peering policy.

For Yggdrasil, use the existing landing page:

`http://landing.ygg.kgivler.com/`

for current public peer information.

## Small pending site tasks

Check whether Mycelium has actually been added to `/projects/` under Networking / protocols.

If not, add it without creating a detail page.

Review sitemap / SEO coverage for the new project-detail routes and any other newly public pages.

## Later: Systems copy-only cleanup

Do not redesign the page.

Keep:

- all hosts
- all facts
- all links
- all ports
- all protocols
- the existing section structure

Only rewrite prose that sounds like:

- internal documentation
- architecture notes
- résumé copy
- generic AI-generated infrastructure language

Technical lists can stay technical.

## Later: full Systems inventory audit

Do this only when Kyle wants to spend the time on it.

Audit one host at a time:

1. Clanker
2. ScopeCreep
3. Wurstcase
4. FrontDesk
5. Molasses
6. hbg1
7. Ryzenshine

Cross-check listeners, services, containers, proxy configs, DNS, routing, tunnels, jobs, backups, APIs, classic protocols, IIS / Hyper-V / Windows services where applicable.

The result should answer “is everything I intentionally run represented?” without publishing private management endpoints or secrets.

## Important current facts

- DN42 ASN: `AS4242420425`
- Planned clearnet DN42 landing: `https://dn42.kgivler.com/`
- Existing Ygg peering landing: `http://landing.ygg.kgivler.com/`
- Public Matrix room: `#joyfulreaper-dev:kgivler.com`
- Matrix link: `https://matrix.to/#/#joyfulreaper-dev:kgivler.com`
- HappyTime / RFC 868 is not deployed yet; do not list it as live.
- iMule modernization must not be associated with Kyle or kgivler.com.
- Check `dev` first unless Kyle says otherwise.
