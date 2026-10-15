# kgivler.com Site Plan

## Goal and visual direction

Make kgivler.com feel like Kyle's actual work and personality rather than an AI-polished résumé. Continue refining the existing site instead of redesigning it from zero.

Use one coherent design system across the personal-site pages:

- Home: dark, modern, technical, personal; restrained terminal flavor.
- Projects: clean dark technical cards and project case studies.
- Lab: strongest terminal / hacker aesthetic; live widgets, prompts, status blocks, shell, and weirdness encouraged.
- Systems: operational inventory / network catalog in the same visual family, but still readable by a human.
- dev.kgivler.com: intentionally separate, light, conventional, and client-facing.

Avoid turning any page into generic portfolio copy.

## Navigation

Primary navigation:

- Home
- Projects
- Lab
- Systems
- VPS Reviews
- Hire Me (`https://dev.kgivler.com/`)

Keep `/services/` as the current Systems route. If `/systems/` is introduced later, preserve `/services/` with an appropriate redirect.

Do not add Blog navigation until there is actual content and an implementation decision.

## Homepage

The homepage is in a good state and should not be churned while other sections are being finished.

Current progression:

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

Featured Projects:

- Mission Control
- Random Steam Game
- What Should I Work On Today?

Detailed architecture belongs on project pages, not the homepage.

## Lab

`/lab/` is the live / weird part of the site.

Current intended features:

- FrontDesk host telemetry
- Random Steam mini-demo
- services/system preview
- Noise Observatory recent events
- QOTD
- public IRC chat
- public Matrix room
- recent Git activity
- visitor BBS
- full interactive shell at the bottom
- other live infrastructure experiments when they are actually interactive

Recent cleanup connected Lab widgets back to the new project case studies where useful.

Keep the Lab focused on things a visitor can poke at. Do not turn it into a public Mission Control dashboard.

Preserve:

- accessible controls
- useful static / no-JavaScript behavior
- independent widget failure handling
- deliberately sanitized public telemetry
- the current `live_host`, `public_services`, `communication_and_activity`, and `experiments` grouping unless there is a strong reason to change it

## Projects

`/projects/` is a curated directory, not a repository dump.

### Completed detail-page batch

The current detail-page batch is complete:

- Mission Control — `/projects/mission-control/`
- Random Steam Game — `/projects/random-steam/`
- What Should I Work On Today? — `/projects/wsiwot/`
- DN42Atlas — `/projects/dn42atlas/`
- tcpnoise + Noise Observatory — `/projects/tcpnoise/`
- ReaperShell — `/projects/reapershell/`
- PlutoAdDetector — `/projects/pluto-ad-detector/`
- Random GitHub — `/projects/random-github/`
- Happy Protocols — `/projects/happy-protocols/`

Project detail pages are human-facing case studies, not README copies. Reuse `Source/projects/project-detail.css` where practical, but do not force identical section structures.

The `/projects/` index has been updated to add `Details →` links only for projects that actually have detail pages.

### Intentionally skipped for now

- SmolSearch: currently mostly an old snapshot and not active / automated enough to justify a detail page.
- RimWorld modding: wait until there is a stronger reason to revive and present it.
- DN42 / Yggdrasil infrastructure: wait until Systems and the public peering presentation are in better shape.
- iMule modernization: do not associate it with Kyle or kgivler.com.

### Mycelium

Mycelium belongs in the curated Networking / protocols section of `/projects/`, but does not need a detail page yet.

Add it to the project index if it is still missing.

Wait on a detail page until it has a stronger completed vertical slice such as recursive crawling, another protocol, or behavioral protocol recognition.

### Projects to revisit later

Do not add planning-stage projects merely because repositories exist.

Revisit these when they have useful implemented behavior:

- Internet Noise FM
- ShareShit
- HappyPortal
- B.L.O.A.T.

Consolidate related projects when one story is better than many tiny pages:

- tcpnoise + Noise Observatory
- Happy protocol servers
- RimWorld modding

Do not dump tutorials, forks, scratchpads, archives, learning repos, landing-page repos, or abandoned experiments into the curated project directory.

## Systems

`/services/` is the Systems page.

Its job is to answer:

- what machines exist
- what runs where
- what is publicly reachable
- what networks Kyle participates in
- what internal infrastructure is worth naming publicly
- where to find project, service, and peering information

It is not supposed to expose the entire management plane.

### Current state

The Systems page has received a first cleanup / expansion pass.

It currently covers:

- Clanker
- ScopeCreep
- Wurstcase
- FrontDesk
- Molasses
- hbg1
- Ryzenshine
- Clearnet services
- DN42
- Yggdrasil
- I2P mirrors where relevant
- Happy / classic protocols
- Noise Observatory / tcpnoise
- operations tooling
- backups
- experiments / weird Internet
- public chat / Matrix
- project-detail cross-links
- a new `Peer with me` section

This pass is intentionally not a proof of completeness.

Do not call the Systems inventory fully complete until the later host-by-host audit is done.

### Systems copy cleanup

The structure is good enough for now, but some prose still reads too much like documentation or generated architecture copy.

Later, do a copy-only humanization pass:

- preserve all technical facts, hostnames, links, ports, protocols, and section structure
- rewrite only prose that sounds like internal documentation, a résumé, or AI-generated infrastructure copy
- keep technical lists dry when that is useful
- make intros and explanatory paragraphs shorter, plainer, and more like Kyle
- humor is fine where it fits

Avoid phrases such as:

- supporting infrastructure
- handles / provides / facilitates, when simpler wording works
- current public peer URIs
- operational capabilities
- architecture-heavy filler that does not help a visitor

Do not turn the copy pass into another redesign.

### Inventory vs telemetry

Declared inventory is authoritative for whether a service exists.

Mission Control Agents are telemetry sources, not the source of truth for inventory.

A service can exist on a host with no Agent. In that case use a state such as `NO AGENT` or `STATUS UNAVAILABLE` rather than hiding the service or assigning it to a different host.

### Full Systems audit — later

When Kyle is fresh, perform a real inventory audit host by host:

1. Clanker
2. ScopeCreep
3. Wurstcase
4. FrontDesk
5. Molasses
6. hbg1
7. Ryzenshine

For Linux / FreeBSD hosts, reconcile the page against:

- listening sockets
- systemd / rc services
- Docker containers / compose stacks
- nginx / reverse-proxy vhosts
- DNS zones and authoritative services
- BIRD / routing configuration
- WireGuard / Yggdrasil / other tunnels
- cron jobs / systemd timers
- backup jobs
- public protocol listeners
- intentionally public APIs

For Ryzenshine, also check:

- IIS sites / bindings
- Hyper-V workloads
- Docker Desktop workloads
- Windows services
- tunnels / reverse proxies
- scheduled tasks

Classify discoveries as:

- public service
- alternate-network service
- internal operations
- infrastructure component
- experiment
- intentionally omitted from public presentation

The goal is to make Systems accurate without publishing private management endpoints, credentials, private WireGuard addresses, or unnecessary attack-surface details.

## DN42 peering

Kyle operates `AS4242420425`.

Do not duplicate the full DN42 peering policy inside Systems.

Preferred presentation:

1. short human explanation of DN42
2. mention `AS4242420425` and the multi-POP network
3. `Peer with me on DN42 →`
4. link to a clearnet mirror / proxy of the existing DN42Landing content

Planned clearnet hostname:

`https://dn42.kgivler.com/`

This does not exist yet. The next infrastructure task is to stand it up as a clearnet mirror / proxy of DN42Landing and then verify the Systems link.

DN42Landing should remain the detailed source for:

- POPs
- prefixes
- tunnel information
- BGP policy
- transit policy
- Looking Glass links
- contact information

Avoid maintaining the same routing policy manually in two places.

## Yggdrasil peering

Systems should keep Yggdrasil peering concise and link to the existing landing page for current details:

`http://landing.ygg.kgivler.com/`

The landing page is the source for current public peer endpoints, listening ports, node information, and locations.

Do not duplicate those details in Systems unless there is a clear reason.

## Happy Protocols

Happy Protocols are presented as one project story even though multiple services are deployed.

Current deployed services include the classic protocol services already listed on Systems such as Gopher, Gemini, Finger, QOTD, Daytime, Echo, and Discard.

HappyTime / RFC 868 exists as work / code but is not currently deployed. Do not list it as a live service until that changes.

## Public communication

The public communication block can include both:

- IRC web chat: `https://chat.kgivler.com/`
- Matrix room: `#joyfulreaper-dev:kgivler.com`
- Matrix link: `https://matrix.to/#/#joyfulreaper-dev:kgivler.com`

Lab and Systems may both link these because they serve different purposes:

- Lab: visitor interaction
- Systems: inventory of public services

## Future DN42 / Yggdrasil case study

Do not build the dedicated alternate-network infrastructure case study yet.

First:

1. settle the Systems page
2. stand up `dn42.kgivler.com`
3. finish the clearnet-facing peering presentation
4. later perform the full Systems inventory audit
5. then decide whether the infrastructure story belongs primarily under Projects, Systems, or both

## Copy and tone

Visible copy should sound natural and specific.

Avoid:

- repetitive `Problem / Built / Decisions / Stack / Result` templates
- inflated résumé language
- generic marketing filler
- repeated claims about designing / deploying / operating systems
- prose that sounds like internal documentation
- unnecessarily formal architecture language

Prefer:

- short explanations
- specific technical details where interesting
- plain language
- first-person explanations
- humor where it fits

SEO metadata can be more conventional than visible body copy.

## Monetization guardrail

Preserve affiliate links and required disclosures unless Kyle explicitly requests their removal.

Presentation can be compacted, but keep:

- affiliate links
- `sponsored` link attributes
- clear commission disclosure

## Blogging

Blogging remains a future decision.

Do not add Blog navigation, empty Latest Writing sections, or a publishing system before there is actual content and an implementation decision.

If blogging proceeds, `https://kgivler.com/blog/` remains a reasonable canonical location.

Avoid CMS complexity, browser WYSIWYG editors, login/admin systems, databases, or separate APIs without a real need.

## Development services

`dev.kgivler.com` is intentionally separate from the main site.

It should remain:

- light
- conventional
- professional
- clearly identified as Kyle Givler's development / deployment services
- free of fake-company branding

Do not opportunistically redesign it while working on the personal site.

## Current execution order

1. Review / apply the latest Systems page draft if not already committed.
2. Set up `https://dn42.kgivler.com/` as a clearnet mirror / proxy of DN42Landing and verify the Systems link.
3. Make sure Mycelium is present on the curated `/projects/` index; no detail page yet.
4. Update sitemap / SEO coverage for the completed project pages and other newly added public routes as needed.
5. Leave the site alone for a bit.
6. Later, perform the copy-only humanization pass on Systems.
7. Later, perform the full host-by-host Systems inventory audit.
8. Revisit the DN42 / Yggdrasil infrastructure case study only after the peering presentation and Systems audit are in good shape.
9. Decide whether and how to blog only when ready to publish actual content.

## Validation

For static-site changes:

- check duplicate DOM IDs
- check nested asset / module paths
- check responsive behavior
- check accessibility and useful no-JavaScript behavior
- verify links to public services
- verify project-detail routes
- run available frontend / static checks
- run `git diff --check` when practical
- report browser-testing limitations

For Systems specifically, also verify that no private management URLs, credentials, API keys, private WireGuard addresses, or administrative endpoints were accidentally published.
