# kgivler.com Site Plan

## Goal
Make `kgivler.com` feel more like Kyle's actual work and personality and less like an AI-polished résumé.

This is a cleanup and restructuring project, not a redesign from zero.

## Core decisions
- Keep the terminal/systems aesthetic on the main site.
- Keep workstation information prominent.
- Keep a small Steam presence indicator near the prominent live area.
- Keep the interactive shell at the bottom of both the homepage and `/lab/`.
- Move most other live/experimental widgets to `/lab/`.
- Add a curated `/projects/` directory and project detail pages where worthwhile.
- Add a Markdown-first blog at `/blog/`.
- Add a separate development-services site at `dev.kgivler.com` using the same repository initially.
- Keep the development-services site light-themed, conventional, and intentionally boring compared with the main site.

## Homepage target layout
1. Intro
2. Prominent workstation area + small Steam presence
3. Featured projects
4. Latest blog/devlog posts
5. Development-services callout to `https://dev.kgivler.com/`
6. Recent/selected projects
7. Link to `/projects/`
8. Interactive shell
9. Contact / elsewhere

## /lab/
The lab is where the site's larger collection of live and weird features can breathe without overwhelming the homepage.

Candidate content:
- detailed workstation telemetry
- Random Steam demo
- service/system status
- QOTD
- recent Git activity
- BBS
- Qwen/local-AI code-review experiment
- other experimental live widgets
- full interactive shell at the bottom

## /projects/
Create a curated project index.

Likely high-value/current entries:
- Mission Control
- Random Steam Game
- Happy protocol family / HappyGopher / HappyGemini
- ReaperShell
- tcpnoise / FreeBSD C networking work
- Random GitHub
- selected RimWorld modding work
- Yggdrasil/DN42/networking-lab work where appropriate

Do not list every repository.

Consolidate related work when that tells a clearer story, such as one RimWorld Modding entry with selected individual mods.

Use clean routes like `/projects/reapershell/`.

## Copy cleanup
Audit the homepage and operational Services page line by line.

Rewrite or remove:
- repetitive `Problem / Built / Decisions / Stack / Result` structures
- overly formal architecture prose on the homepage
- repeated claims about designing/deploying/operating systems
- stale descriptions
- duplicate project entries
- copy that sounds more like a generated résumé than a person explaining their work

Detailed architecture belongs in project detail pages, blog posts, and repository READMEs more often than on the homepage.

## Operational services catalog
The current operational catalog is useful, but it should be treated as a systems/infrastructure view rather than confused with paid development services.

Longer-term route options include `/lab/services/` or `/systems/`.

Do not break the existing `/services/` URL casually. Add redirects if it changes.

### Inventory vs telemetry
Declared service inventory should be authoritative. Mission Control Agents are optional telemetry sources.

Example:
- Service: Uptime Kuma
- Host: Molasses
- Visibility: Private
- Telemetry: no Agent available
- Live status: `NO AGENT` / `UNAVAILABLE`

Do not assign a service to Clanker merely because Clanker is the only host with live Agent data.

Hard-coded summary counts should eventually be derived from inventory or removed.

## Blog
Canonical location: `https://kgivler.com/blog/`

### Why `/blog/`
There is no guaranteed SEO ranking bonus from a subdirectory by itself.

The reason to prefer `/blog/` is practical and structural:
- posts are clearly part of the same personal site
- navigation between portfolio, projects, services, and articles is simpler
- one sitemap/site hierarchy is easier to maintain
- analytics and site maintenance are simpler
- internal linking is more obvious
- visitors do not feel like they have left the site
- deployment can still be separate behind a reverse proxy if the blog is its own .NET app

A convenience hostname such as `blog.kgivler.com` may redirect to `https://kgivler.com/blog/`.

### Blog implementation
Prefer Markdown files with front matter.

```markdown
---
title: "I Put a Server on the Internet and Listened to What Knocked"
date: 2026-09-24
slug: internet-noise-open-tcp-port
description: "..."
---

Post body...
```

A small .NET server-rendered app may discover posts, parse Markdown, render `/blog/` and `/blog/{slug}/`, generate RSS, integrate with the sitemap, and cache parsed posts if useful.

Avoid CMS complexity unless a real requirement appears.

### Initial topic backlog
- running Gopher/Gemini in 2026
- routing Yggdrasil through WireGuard
- joining DN42
- FreeBSD C networking experiments
- what Internet scanners hit an exposed port
- building tcpnoise
- self-hosted multi-VPS monitoring
- restic peer + Backblaze B2 backups
- oddball RFC protocols
- using .NET for infrastructure projects

## Project catalog audit
Random Steam currently appears both as a flagship project and again in Additional Projects; remove the duplication.

RimWorld work should remain represented, but consider consolidating several mod cards into one stronger RimWorld Modding entry.

Recent/current work worth considering includes ReaperShell, tcpnoise/freebsd-c-lab, Random GitHub, Vinculum, Yggdrasil/DN42 work, and other projects that are materially active or illustrative.

## Small cleanup items
- expand sitemap coverage as `/blog/`, `/projects/`, `/lab/`, and project pages are added
- fill in meaningful webmanifest `name`, `short_name`, and theme metadata
- improve terminal help/discoverability
- fix Qwen model-status display
- keep mobile layout clean
- keep static/no-JS behavior useful

## Execution order
1. Commit planning/guardrail documents.
2. Audit and rewrite homepage copy.
3. Restructure homepage and create `/lab/`.
4. Audit and rebuild project catalog.
5. Add `/projects/` and project detail-page pattern.
6. Fix operational service inventory/host model.
7. Add development-services site at `dev.kgivler.com`.
8. Audit old blog repositories and pick/rebuild the blog implementation.
9. Add `/blog/` and initial posts.
10. Revisit smaller polish items and SEO metadata.
