# dev.kgivler.com Development Services Plan

## Purpose
`dev.kgivler.com` is a simple professional landing site for paid or potentially paid software/development work offered directly by Kyle Givler.

It is not intended to look like `kgivler.com`.

The main site can be terminal-themed, playful, and infrastructure-heavy. This site should be light, calm, conventional, readable, and easy for a non-technical potential client to understand.

## Identity
Use Kyle Givler's own name.

Working title: **Kyle Givler — Development Services**

Do not invent a company identity or imply an LLC/business entity that does not exist.

Business/legal structure, taxes, contracts, licensing terms, insurance, and related administrative questions still need deliberate research before real client work is accepted at scale.

## Hosting / repository
Initial implementation may live in the existing `kgivler_com` repository in its own folder and deploy to `https://dev.kgivler.com/`.

It may move to a private or dedicated repository later if there is a practical reason.

Keep the implementation separable enough that such a move would not be painful.

## Visual direction
- light theme
- conventional typography
- restrained layout
- responsive/mobile-friendly
- no terminal gimmick required
- no fake shell
- no green-on-black styling
- no need to visually match the main site beyond basic identity/linking

"Boring" is a feature here.

## Current calls to action and pricing
Use the on-site contact form and LinkedIn for inquiries. Fixed-scope website package pricing is already published ($299 personal/nonprofit, $499 small business introductory pricing), with optional static hosting at $149/year. Other work may be quoted separately. Do not silently change pricing or add new products without a decision.

## Service breadth
Communicate broad capability without becoming a giant undifferentiated checklist.

### Websites
- simple static/personal/business sites
- landing pages
- small custom sites
- modernization or cleanup of an existing site
- deployment/hosting help

### Custom software / backend
- .NET applications
- ASP.NET Core backends
- APIs
- small microservices
- SQLite-backed internal tools
- integrations between existing systems

### Automation and infrastructure
- scripts and small utilities
- repetitive-task automation
- Docker/Compose help
- VPS/self-hosting setup
- monitoring/alerting integrations
- network/service troubleshooting

### Programming help and mentoring
- debugging
- code review
- explaining unfamiliar code
- architectural guidance for small projects
- mentoring/tutoring
- help getting unstuck

Do not offer to complete graded academic work dishonestly.

### Community / non-commercial work
Make room for discounted non-commercial projects, volunteer/community work, nonprofits, and interesting small tools or integrations.

Do not promise discounts in a way that creates an unlimited obligation. Phrase this as willingness to discuss reduced-cost or volunteer work when the project and circumstances make sense.

## Positioning
Avoid presenting Kyle as a generic "full-service agency."

Useful differentiators:
- direct access to the person doing the work
- practical small-project scope
- willingness to work on unusual technical problems
- strong .NET/backend/infrastructure experience
- ability to handle both code and deployment for small systems
- interest in smaller jobs that larger agencies often do not want

Keep claims grounded in actual work visible on `kgivler.com` and GitHub.

## Proof / portfolio links
Good proof candidates:
- Mission Control
- Random Steam Game
- ReaperShell
- selected infrastructure/networking work
- selected websites or hosted systems

Link back to:
- `https://kgivler.com/`
- `https://kgivler.com/projects/`
- GitHub

## Current page structure
Homepage: services, selected work, how I work, community work, contact form/LinkedIn. Supporting pages: website packages, FAQ, and the planned dedicated `/hosting/` page. Hosting should appear as a homepage service card and be cross-linked from `/websites/` and `/faq/`. Do not add premium/business-critical hosting tiers in phase one.

## Hosting decisions and outstanding business work
Phase-one hosting scope and decisions are specified in [HOSTING_PHASE1.md](HOSTING_PHASE1.md). Public hosting terms and site privacy text are drafted at `src/static/hosting/terms/index.html` and `src/static/privacy/index.html`. Verify wording, operational data flows, and a mechanism for affirmative acceptance before taking hosting payments. The hosting service is best-effort static hosting with no uptime SLA, no included backups, 14-day renewal grace period, and normally a few business days for support replies (not guaranteed). Annual hosting fees are nonrefundable except where law requires otherwise. A separate basic hosting Terms of Service and privacy disclosures must be reviewed and published before accepting paying hosting customers.

Still to define or verify before selling hosting: acceptable-use limits, operational retention/suspension procedure, billing/renewal reminders, agreed scope of contact-form integration, business/legal/tax questions, and any needed contractual notices. No promise of future HappyPortal/HappyPages features.

## Near-term success condition
The first version succeeds if a visitor can answer, within roughly a minute:
- Who is Kyle?
- What kinds of technical work can he help with?
- Is my small/weird project within scope?
- Has he built real things?
- How do I contact him?
