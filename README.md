# LeadG2 Scoping Agent

Reads everything about a prospect, recommends the best-fit LeadG2 scope in **service points**, and produces a client-ready **executive summary** (shareable web page) and a **PowerPoint deck** in the BridgeTower / Hubbard style.

## How it works
1. **Pick the prospect.** Search HubSpot by company name or ID. Optionally paste/dictate notes or drop in transcripts, RFPs and PDFs.
2. **The agent reads everything.** For the company *and every associated contact and deal* it pulls all calls (notes, HubSpot AI call summaries, full transcripts where available), emails (quoted reply chains stripped), meetings (incl. internal notes), notes and tasks, plus deals and email engagement. Claude reads it all in one pass (up to ~600k characters; oldest activity is dropped first if over the limit, and the screen tells you).
3. **Review the recommendation.** You see what we've learned (each point with a quote and its source), desired results, pains, current systems, stakeholders, budget/timeline signals and open questions. The recommended scope — priced products, hourly custom work, partnership options and a monthly service-points mix — is fully editable. Everything autosaves.
4. **Generate.** Claude writes the executive summary + deck copy from the *final* scope. You get `/p/<id>` (shareable executive summary, printable to PDF) and a 13-slide PPTX built server-side.

## Pricing
- **Two sides of the house.** *HubSpot implementation* (onboarding, portal setup, migration, integration) is a fixed-price, one-time scope of work — no hours are shown to clients. *Growth* is the consulting retainer plus service points.
- **Consulting** is one $2,000/month retainer — marketing, HubSpot, or both (`NEXT_PUBLIC_LEADG2_CONSULTING_MONTHLY`). It replaces the "Marketing Consulting" product; other monthly services (AEO, website maintenance, post-onboarding subscriptions) are added on top.
- **Products** come from LeadG2's HubSpot product library (Products object), read live and cached for 10 minutes. If HubSpot isn't reachable, `data/products.json` (a snapshot of the same 76 products) is used and the review screen says so. Prices always come from the library, never from Claude.
- **Integrations and migrations** are outsourced: the agent adds them as vendor-quoted lines with a recommended starting price and deliverables. On the review screen both are editable; replace them with the vendor's quote. Client-facing, they're marked "estimate*" with a footnote until finalized.
- **Custom work** the library doesn't cover (integration builds, multi-source migrations, technical discovery) and `$0` add-ons get a fixed price set from an internal effort estimate × **$125** (`NEXT_PUBLIC_LEADG2_HOURLY_RATE`). The estimate is only visible on the internal review screen; clients see the fixed price.
- **Service points**: 1 point = 1 hour = $125. The points menu comes from the Service Point Tracker (`lib/offerings.ts`).
- **Enterprise deals** (like BridgeTower and Hubbard): one shared implementation plus 2–3 partnership options (e.g. Guided / Collaborative / Embedded) with their own term and support level, and an optional partner discount. Smaller deals get a single scope with no options.
- The agent recommends the strongest scope for each side and suggests 2-4 optional add-ons ("Also worth considering") you can add with one click.
- Everything is editable on the review screen: add/remove products, custom work, quantities, options, discount, contract start and HubSpot licensing.

## Brand
Built to the LeadG2 brand guide v1.1 (leadg2.thecenterforsalesstrategy.com/leadg2-brand-guide):
- **Type:** Mulish 800 headlines and 700 UI/labels; Lora for body copy, leads and accents (headline accents in Lora italic). Both load from Google Fonts.
- **Color:** Navy `#1B263B`, Midnight `#0D1B2A`, Cream `#F7F3EE`, Smoke `#F4F4F4`, Line `#E0E1DD`, Slate `#50606D`, Mist `#AEB6C4`, Steel `#9DA6B5`; Orange `#E17226` only for actions and accents, Orange Dark `#C2611C` for links and hover, Light Orange `#F2913F` only on Midnight. Tokens in `tailwind.config.ts`, components in `app/globals.css`.
- **Pages:** cream hero → alternating White/Smoke sections → Midnight closing panel (radius 22, no glow or gradient). Flat orange buttons, radius 6, no shadow. Feature cards with an orange rule and Lora-italic numbers; Midnight emphasis card for the option we recommend; dashed "bottom line" callout. No eyebrow labels above headlines.
- **Logo:** official files only. `logo-color.png` on light; `logo-on-dark.png` on Navy/Midnight (the official file with G2 in Steel, per the guide's primary lockup); `logo-color-tagline.png` on light slides.

## Deck (13–16 slides)
Cover · Agenda · What we heard from your team · What's holding growth back · Before/After · Where we're going · How we'll get you there · Here's what we recommend · *Choose your level of support (if options)* · *Monthly service points plan (if points)* · Roadmap (Gantt) · Your LeadG2 team · Where the investment goes · *Open questions (if any)* · Let's get started · Thank you.

`sample-output-enterprise.pptx` and `sample-output-retainer.pptx` show both shapes.

Styled after the BridgeTower and Hubbard decks (navy glow backgrounds in `assets/deck/`, official logo files) and set in the brand fonts: Mulish for titles and labels, Lora for body and italic accents. Fonts aren't embedded — the viewer's machine needs Mulish and Lora installed (free on Google Fonts) or PowerPoint will substitute.

## Setup
```bash
cp .env.example .env.local
npm install
npm run dev
```
See `.env.example` for `ANTHROPIC_API_KEY`, `HUBSPOT_ACCESS_TOKEN` (private app token), storage (`DATA_DIR` on Render, or Upstash `KV_REST_API_URL`/`KV_REST_API_TOKEN`), `APP_PASSWORD`, `LEADG2_CONTACT_*` and `NEXT_PUBLIC_LEADG2_HOURLY_RATE`.

## Deploy on Render
1. Push this folder to a GitHub repo.
2. In Render: **New → Blueprint**, pick the repo. Render reads `render.yaml` and creates a Node web service (Starter plan) with a 1 GB persistent disk at `/var/data` for saved proposals.
3. When prompted, fill in the secret env vars:

| Variable | What to enter |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key (console.anthropic.com) |
| `HUBSPOT_ACCESS_TOKEN` | HubSpot private app token. Scopes: `crm.objects.companies.read`, `crm.objects.contacts.read`, `crm.objects.deals.read`, `sales-email-read`, `e-commerce` (Products). If one is missing, the app names it in the error. |
| `APP_PASSWORD` | Password for the internal tool (username `leadg2`). Proposal share links stay public. |
| `LEADG2_CONTACT_NAME` / `_TITLE` / `_EMAIL` / `_PHONE` | Presenter shown on the deck and summary |

Already set by the Blueprint: `NODE_VERSION=22`, `DATA_DIR=/var/data`, `APP_USERNAME=leadg2`, `NEXT_PUBLIC_LEADG2_HOURLY_RATE=125`, `NEXT_PUBLIC_LEADG2_CONSULTING_MONTHLY=2000`, `LEADG2_CONTACT_WEBSITE=leadg2.com`.

4. Deploy. Build: `npm ci && npm run build`. Start: `npm start`. Health check: `/api/health`.

Notes: the `NEXT_PUBLIC_*` rates are baked in at build time, so redeploy after changing them. Render doesn't cut off long requests, so the 1–3 minute analysis runs fine. To use Upstash Redis instead of the disk, set `KV_REST_API_URL` / `KV_REST_API_TOKEN` and you can drop the disk (and use any plan).

## Claude
`claude-opus-5-5` with adaptive thinking, streaming, structured outputs (Zod schemas in `lib/types.ts`), and server-side refusal fallback (`fallbacks: "default"`, removable in `lib/agent.ts`).

## Known limits
- **Call transcripts** come from HubSpot's calling transcripts endpoint and need conversation intelligence on the portal. If a transcript can't be fetched the agent uses the call's AI summary and notes and says so.
- PPTX "fit to box" text shrinking only takes effect once a slide is edited in PowerPoint; prompts keep copy short to avoid overflow.
