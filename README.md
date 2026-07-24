# kgivler.com

Source for [kgivler.com](https://www.kgivler.com), Kyle Givler's terminal-themed portfolio site.

The site is a public hub for software projects, self-hosted services, classic internet protocol experiments, live workstation telemetry, Steam integrations, GitHub activity, and a small local-AI code review demo. It is proudly self-hosted on my local workstation and exposed to the internet through a Cloudflare Tunnel, so some of the live widgets are showing real data from the machine under my desk.

## What Is Here

- `Source/` - Static frontend assets for the portfolio site.
- `Source/index.html` - Main terminal-style landing page.
- `Source/Services/` - Services and infrastructure view.
- `Source/js/` - Browser modules for commands, telemetry, Steam presence, Git activity, QOTD, and the Qwen review panel.
- `Kgivler.Api/` - ASP.NET Core API used by the portfolio widgets.
- `Kgivler.Api/Routes/` - Minimal API route groups for telemetry, Steam presence, BBS messages, Git activity, and code review.

## Features

- Terminal-inspired portfolio interface with interactive commands.
- Live host telemetry and public workstation status.
- Steam presence and Random Steam Game demo links.
- Services page covering public apps, classic TCP services, infrastructure, and monitoring tools.
- Recent GitHub activity feed via Mission Control.
- Daily quote integration through HappyQOTD.
- Browser-based code review panel backed by a local LM Studio model.
- Lightweight BBS-style message endpoints.

## Tech Stack

- Static HTML, CSS, and JavaScript modules.
- Bootstrap 5 and Font Awesome from CDNs.
- ASP.NET Core Minimal APIs.
- SQLite-backed message and hit-count storage.
- JoyfulReaperLib packages for Mission Control and web stats.
- LM Studio integration for local code review experiments.

## Local Development

### Frontend

The frontend is static. You can serve `Source/` with any local static server:

```powershell
cd Source
python -m http.server 5500
```

Then open:

```text
http://localhost:5500
```

Local frontend API targets are configured in `Source/js/config.js`.

### API

Build and run the ASP.NET Core API:

```powershell
dotnet build Kgivler.Api\Kgivler.Api.slnx
dotnet run --project Kgivler.Api\Kgivler.Api.csproj
```

In development, the API allows local frontend origins such as `http://localhost:5500`.

## Configuration

Runtime secrets and private service values should be supplied through user secrets, environment variables, or deployment configuration.

Common configuration areas:

- `Steam:ApiKey`
- `Steam:OwnerSteamId`
- `LmStudio:BaseUrl`
- `LmStudio:Model`
- `GitActivity:BaseUrl`
- `GitActivity:ApiKey`
- `MissionControl:*`

The public `Source/config.*` files are intentionally fake scanner bait. The real browser configuration lives in `Source/js/config.js`.

## API Surface

- `GET /api/system/usage`
- `GET /api/system/status`
- `GET /api/steam/presence`
- `GET /api/github/activity`
- `GET /api/code-review/health`
- `POST /api/code-review`
- `GET /api/bbs`
- `POST /api/bbs`

Rate limits are applied to telemetry, Steam, BBS, and code review endpoints.

## Deployment Notes

The public site is designed to run as a static frontend with supporting APIs exposed through `api.kgivler.com` and related service subdomains.

Most of the interesting parts are self-hosted. The main site and several API-backed widgets run on my local workstation, with public traffic routed in through a Cloudflare Tunnel. No cloud bullshit: the point is to show real telemetry, real service health, and real experiments from my own hardware instead of a perfectly polished static brochure.

Because the site depends on homelab infrastructure, occasional downtime is expected. Live features may show offline or degraded states when the workstation is powered off, under maintenance, the Cloudflare Tunnel is interrupted, a VPS-side service is unavailable, or the local model runtime is not running.

## License

Copyright (c) 2026 Kyle Givler.

Licensed under the MIT License. See [LICENSE.md](LICENSE.md).
