# kgivler.com Site Plan

## Goal and visual direction
Make kgivler.com feel like Kyle's actual work and personality rather than an AI-polished résumé. This is restructuring and cleanup, not a redesign from zero.

Use one coherent design system across personal-site pages: dark technical colors, consistent navigation/footer, typography families, spacing, buttons, links, cards, status treatments, responsive behavior, and voice.

- Home: dark, modern, technical, personal; restrained terminal flavor rather than one giant fake terminal.
- Projects: clean dark technical cards/detail pages with minimal terminal decoration.
- Lab: strongest terminal/hacker aesthetic; prompts, command headings, status blocks, live widgets, interactive shell, and weirdness encouraged.
- Systems: same visual family, with an operational/catalog/dashboard emphasis.
- dev.kgivler.com: already exists and intentionally remains a separate light, conventional, professional site identifying Kyle Givler as the provider.

The first extraction slice retains the current terminal presentation on both Home and Lab. Review the remaining homepage before deciding the next design slice.

## Navigation
Eventual primary navigation: Home, Projects, Lab, Systems, Hire Me (https://dev.kgivler.com/).

Do not link to an unbuilt Projects page. Preserve /services/ compatibility; its human-facing navigation concept is Systems, avoiding confusion with paid Development Services. If a /systems/ route is introduced later, preserve the old URL with appropriate redirects.

Do not add Blog navigation or an empty Latest Writing section before a blogging decision and actual content exist.

## Homepage target
1. About Kyle: short human introduction covering backend/software, self-hosting, networking, weird Internet protocols, developer tooling, and game/modding work. Avoid résumé-like repetition.
2. “What is Kyle doing?”: only a small Steam presence indicator. No manually maintained “currently hacking on” field.
3. Featured Projects: exactly Mission Control, Random Steam Game, and tcpnoise. Keep descriptions concise.
4. Development Services / Hire Me: short, non-salesy CTA to https://dev.kgivler.com/, mentioning .NET, APIs, Linux/VPS deployment, self-hosting, and infrastructure where useful.
5. Current / Recent Work: a small curated selection. Candidates include ReaperShell, What Should I Work On Today?, HappyGopher/HappyGemini, DN42/Yggdrasil, Random GitHub, and RimWorld work. Do not list everything.
6. Lab teaser with an obvious “Enter the Lab” link.
7. Interactive shell.
8. Contact / elsewhere.

kgivler.com and api.kgivler.com now run on FrontDesk, not Kyle's workstation. Full host telemetry is no longer a defining homepage feature.

## /lab/
Move the existing Live Systems Lab here, reusing existing CSS, JS, and API logic:

- detailed FrontDesk host telemetry
- Random Steam mini-demo
- services/system preview
- QOTD
- recent Git activity
- public chat block
- BBS presentation
- other existing live infrastructure experiments
- full interactive shell at the bottom

Steam presence stays on Home; the shell appears on both pages. Preserve accessibility, useful static/no-JavaScript behavior, independent widget failure handling, and deliberately sanitized public telemetry.

Qwen/LM Studio code review has already been removed; it is not pending cleanup.

## /projects/
Plan a curated directory with clean routes such as /projects/mission-control/, /projects/random-steam/, /projects/reapershell/, and /projects/tcpnoise/.

Featured: Mission Control, Random Steam Game, tcpnoise.

Useful categories:
- infrastructure / operations / applications
- networking / protocols
- developer tools
- game / modding

ReaperShell and What Should I Work On Today? (WSIWOT) should be prominent in the broader catalog. HappyGopher/HappyGemini and DN42/Yggdrasil belong in networking/protocol work. Consider Random GitHub and other materially active or illustrative projects, rather than every repository.

Consolidate RimWorld work where one entry with selected mods tells a clearer story. Remove Random Steam's duplicate Additional Projects entry during the later catalog cleanup. Do not publish every tutorial, fork, scratchpad, archive, or abandoned experiment.

## Copy cleanup (later slice)
Audit Home and the Systems catalog line by line. Rewrite or remove repetitive Problem / Built / Decisions / Stack / Result treatments, formal architecture prose on Home, repeated claims about designing/deploying/operating systems, stale descriptions, duplicate project entries, and generated résumé language.

Prefer short first-person explanations, concrete technical details, and humor where it fits. Detailed architecture belongs on project pages, repository READMEs, or future writing.

### Monetization guardrail
Preserve existing monetization/affiliate content and required affiliate disclosures during future homepage cleanup unless Kyle explicitly requests their removal. Presentation may be compacted to fit the design, but keep the affiliate links, sponsored link attributes, and clear commission disclosure. The dedicated GreenCloud hosting section belongs immediately after Featured Projects and before Development Services / Hire Me; do not claim that all featured projects run on GreenCloud.

## Systems: inventory vs telemetry
Declared service inventory is authoritative. Mission Control Agents are optional telemetry sources, not the source of truth for service existence.

A known service on a host without an Agent stays visible with NO AGENT or STATUS UNAVAILABLE. For example, Uptime Kuma on Molasses must not be assigned to Clanker just because Clanker has Agent data. Hard-coded summary counts should eventually come from inventory or be removed. Never expose private URLs or administrative controls.

## Blogging: future decision
Do not implement Blog now. Kyle has not selected static HTML, generated Markdown, a small .NET app, or another approach. No Blog nav or placeholders before that decision and actual content.

If blogging proceeds, https://kgivler.com/blog/ remains a useful candidate canonical location, with blog.kgivler.com optionally redirecting there. A subdirectory offers no guaranteed SEO ranking bonus; its appeal is shared navigation, site hierarchy, sitemap, and maintenance. Markdown is an authoring option, not a selected implementation. Stable URLs, dates, metadata, RSS, and sitemap coverage would be useful requirements.

Avoid CMS complexity, browser editing interfaces, databases, login/admin systems, or separate APIs without a real need.

Possible future topics: Gopher/Gemini, DN42, Yggdrasil/WireGuard routing, FreeBSD C networking, tcpnoise and Internet scanners, self-hosted monitoring, restic/Backblaze backups, oddball RFC protocols, and .NET infrastructure work. These may eventually have both stable project/system pages and narrative posts.

## Development services
The site already exists. Preserve its separate light professional style, Kyle's identity, and initial LinkedIn contact path. Communicate breadth without an unreadable list; do not invent fixed prices or legal, tax, licensing, SLA, or business terms. Do not touch dev.kgivler.com in this extraction slice.

## Execution order
1. Refresh this plan.
2. Extract the existing Live Systems Lab into static /lab/. Keep Steam on Home and the shell on both. Add Home/Lab navigation and sitemap coverage. Do not redesign the rest of Home, build Projects, implement Blog, or change backend/API behavior.
3. Review the remaining homepage before selecting the next design slice.
4. Clean up homepage copy and implement the agreed layout within the shared design system.
5. Audit the curated project catalog, then build /projects/ and a detail-page pattern.
6. Refine Systems inventory/host modeling as needed while preserving /services/ compatibility.
7. Decide whether and how to blog only when ready to publish content.
8. Revisit smaller polish: webmanifest metadata, shell discoverability, mobile/static behavior, and sitemap/SEO coverage as pages are added.

## Extraction validation
Check duplicate DOM IDs, optional-widget guards, Home Steam refresh, both shells, all moved Lab widgets, nested asset/module paths, static/no-JavaScript behavior, and available frontend/static checks. Run git diff --check and report browser-testing limitations. Leave changes uncommitted and unpushed for review.
