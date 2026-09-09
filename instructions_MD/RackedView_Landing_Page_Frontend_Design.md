# RackedView — Premium Landing Page Front-End Redesign

## Objective

Redesign the **RackedView public landing page** to feel like a premium, modern B2B SaaS product for IT infrastructure documentation.

Use the supplied reference image as the visual direction.

**IMPORTANT: FRONT-END ONLY.**

- Do **not** change the backend.
- Do **not** change the database.
- Do **not** change Supabase.
- Do **not** change authentication logic.
- Do **not** change API routes, server logic, schemas, RLS policies, data models, or existing backend services.
- Do **not** remove or rewrite existing application functionality.
- Only modify the front-end presentation, landing-page components, styling, layout, imagery, typography, animations, and responsive behaviour.
- Reuse existing components/data where appropriate.
- If a CTA already has an existing route/action, keep that functionality intact.

---

# 1. Overall Design Direction

The page should look like a **serious premium infrastructure SaaS**, not a generic startup template.

### Visual personality

- Dark, cinematic, technical
- Premium B2B SaaS
- Modern but restrained
- Strong typography
- High contrast
- Lots of depth
- Subtle blue glow
- Realistic server-rack / data-centre imagery
- Product UI shown prominently
- Clean spacing
- No fake testimonials
- No fake customer counts
- No fake reviews
- No fake "trusted by" claims
- No invented customers
- No invented statistics
- No manufacturer/customer logos presented as customers
- No claims that RackedView is already trusted by organisations unless the existing site/data actually supports the claim

The page should communicate:

> **RackedView helps IT teams document, visualise and manage their rack infrastructure.**

---

# 2. Colour Direction

Primary palette:

- Near-black / deep navy backgrounds
- White / off-white text
- Electric blue as the primary accent
- Very subtle blue gradients and glows
- Dark slate panels
- Light sections can be used for contrast

Suggested feel:

```text
Background:     #050B12 / #07111C
Panel:          #0B1622
Panel border:   rgba(255,255,255,0.08)
Primary blue:   #1597FF / #168DFF
White:          #F5F8FC
Muted text:     #91A2B5
```

Do not make the entire page a flat black rectangle.

Use:

- atmospheric gradients
- subtle radial blue lighting
- blurred rack lights
- faint borders
- soft shadows
- glass-like UI panels where appropriate

---

# 3. Header

Create a premium sticky/top navigation.

### Left

RackedView logo + wordmark.

### Navigation

- Why RackedView
- Features
- Use Cases
- Pricing
- Resources

### Right

- Log in
- Get Started

The header should sit naturally over the hero and use a subtle transparent/dark treatment.

On mobile:

- Logo
- Hamburger/menu
- Get Started button if space allows

Do not create a separate dashboard-style sidebar for the landing page.

---

# 4. HERO SECTION

This is the most important section.

Use a full-width cinematic hero.

### Background

Use a high-quality server rack / data-centre image or existing appropriate project asset.

The image should be:

- dark
- blue/black
- premium
- realistic
- slightly blurred/darkened behind text
- visually rich without making text hard to read

Add a subtle dark gradient from left to right.

### Eyebrow

```text
RACK INFRASTRUCTURE. MADE SIMPLE.
```

Small uppercase blue text with letter spacing.

### Main headline

Use:

```text
Document.
Visualise.
Stay in control.
```

The final line can use the blue accent.

Large, bold typography.

### Supporting copy

Use:

```text
RackedView helps IT teams document racks, manage
hardware, store documentation and visualise their
infrastructure — all in one place.
```

Do not overstate capabilities beyond what the existing product actually provides.

### CTAs

Primary:

```text
Get Started →
```

Secondary:

```text
Watch Video
```

If Watch Video functionality does not currently exist, style it as a visual CTA without inventing backend functionality. Prefer linking to an existing video if one already exists.

### Hero benefit strip

Under the CTAs, show three compact benefits:

```text
Centralised
Documentation

Visual Rack
Layouts

Fast Search
& Access
```

Use simple line icons.

---

# 5. PRODUCT UI MOCKUP

The hero needs to show the product itself.

Place a large floating RackedView UI mockup on the right side.

It should visually communicate the actual product.

Example:

### Top

```text
RackedView

Racks > DC1 - Core Rack

Front View | Rear View | Details
```

### Main area

Show a realistic rack elevation containing:

- patch panels
- switches
- servers
- UPS
- storage
- PDU
- other hardware

Use believable rack-unit numbering.

### Details panel

Show information such as:

```text
Device Details

Name
Core Switch 01

Type
Network Switch

Manufacturer
[existing/real product data if available]

Model
[existing/real product data if available]

Position
U36

Status
Online

Serial Number
...

IP Address
...

Notes
...
```

Do not hard-code fake customer data into the actual application if real application data can be displayed instead.

The mockup should look like a polished product screenshot.

---

# 6. FEATURE INTRO SECTION

Transition into a darker product-focused section.

Eyebrow:

```text
A CLEARER WAY TO MANAGE IT INFRASTRUCTURE
```

Headline:

```text
Everything you need
for your racks.
```

Supporting copy:

```text
From rack layouts and hardware details to photos and
documentation, RackedView gives you a complete view
of your infrastructure — so you can work faster, stay
organised and reduce downtime.
```

CTA:

```text
Explore Features →
```

On the right, create a 2x3 feature-card grid.

### Cards

#### Rack Builder

```text
Create accurate rack
elevations with ease.
```

#### Device Library

```text
Store hardware details
and models.
```

#### Documentation

```text
Attach manuals, diagrams,
photos and more.
```

#### Visualise

```text
Front and rear rack
views.
```

#### Search & Filter

```text
Find any device, port
or document in seconds.
```

#### Team Collaboration

```text
Keep your infrastructure
data up to date.
```

Use consistent blue line icons.

---

# 7. PRODUCT SHOWCASE SECTION

Create a cinematic product showcase.

Background:

- dark
- subtle server-room image
- low-opacity blue lighting

Left side:

Eyebrow:

```text
SEE THE BIGGER PICTURE
```

Headline:

```text
Detailed rack views
that actually help.
```

Copy:

```text
Visualise your racks with realistic elevations, view
device details, track connections and keep everything
documented in one place.
```

Feature checklist:

```text
Interactive rack layouts
Front and rear views
Device information at a glance
Link to documentation and photos
Keep records up to date
```

Use blue circular check icons.

Right side:

Large RackedView application mockup.

Show:

- rack elevation
- device list
- rack navigation
- documentation
- photos
- device details

The application UI should be the visual hero of this section.

---

# 8. USE CASE SECTION

Do NOT call this:

> Trusted by IT Professionals

Do NOT include:

- testimonials
- customer logos
- fake statistics
- fake adoption numbers
- fake companies
- "trusted by hundreds of teams"
- "used by thousands"
- invented social proof

Instead use:

### Eyebrow

```text
BUILT FOR HOW IT TEAMS WORK
```

### Headline

```text
Less time searching.
More time doing.
```

Supporting copy:

```text
Keep your infrastructure information organised,
accessible and easy to share — whether it’s a single
site or multiple locations.
```

Create four use-case columns/cards:

### IT Teams

```text
Keep infrastructure
documented and accessible.
```

### MSPs

```text
Manage multiple client
environments with ease.
```

### Technicians

```text
Find what you need,
fast.
```

### Multi-Site Businesses

```text
Keep infrastructure
records together.
```

These are positioning/use-case statements, not customer claims.

---

# 9. OPTIONAL WORKFLOW SECTION

If space allows, add a simple visual workflow.

Eyebrow:

```text
FROM RACK TO RECORD
```

Headline:

```text
Document your infrastructure
without the paperwork.
```

Three stages:

### 01 — Build

Create the rack layout.

### 02 — Document

Add devices, photos, documents and information.

### 03 — Manage

Keep infrastructure information organised and accessible.

Connect the three stages with a subtle line/flow animation.

---

# 10. FINAL CTA

Use a cinematic dark section with server-rack imagery.

Headline:

```text
Take control of your infrastructure.
```

Supporting text:

```text
Start documenting, visualising and managing your
racks with RackedView.
```

Buttons:

```text
Get Started →
```

and, where supported:

```text
Watch Video
```

Optional small supporting phrase:

```text
Organise today.
Operate tomorrow.
```

Do not make unsupported claims.

---

# 11. FOOTER

Minimal premium footer.

Include:

- RackedView logo
- Product links
- Resources
- Company
- Legal
- Privacy
- Terms
- Login

Keep it clean and compact.

---

# 12. Typography

Use a modern SaaS-style sans-serif.

Preferred characteristics:

- bold geometric headline
- clean readable body font
- slightly tight headline tracking
- generous line height for body text

Hero headline should feel substantial.

Example hierarchy:

```text
Hero:
64–88px desktop

Section headings:
48–64px

Card headings:
18–22px

Body:
16–18px

Eyebrows:
11–13px uppercase
```

Scale down appropriately on tablets/mobile.

---

# 13. Animations

Keep animations premium and subtle.

Use:

- fade-up on section entry
- slight product-card movement
- subtle blue glow
- hover elevation on cards
- button hover transitions
- very subtle background movement

Avoid:

- excessive bouncing
- cheesy startup animations
- spinning objects
- huge parallax effects
- anything that makes the site feel like a template

The page should feel expensive.

---

# 14. Responsive Design

The landing page must work properly at:

- Desktop
- Laptop
- Tablet
- Mobile

### Mobile hero

Stack:

1. headline
2. copy
3. CTA buttons
4. benefit strip
5. product mockup

Do not simply shrink the desktop layout.

The product UI mockups should remain readable on mobile.

Feature cards should collapse into one column or two columns depending on screen width.

Navigation should become a clean mobile menu.

---

# 15. Image / Asset Direction

Use imagery that communicates:

- server racks
- data centres
- network hardware
- cables
- infrastructure
- rack elevations

Avoid:

- generic business people
- handshake stock photos
- random office workers
- cheesy corporate photography
- generic abstract startup imagery

The product itself should be the primary visual.

---

# 16. Important Content Rule

RackedView is being presented as a product that is being built/grown.

Therefore:

**Never invent social proof.**

Do not add:

```text
Trusted by 500+ IT teams
10,000+ racks documented
99.9% uptime
Used by Microsoft
Used by hospitals
Used by government
Loved by 1,000+ technicians
```

unless those statements are already verified in the existing project.

Likewise, do not invent testimonials or customer logos.

The website should look premium because of **design + product**, not fake traction.

---

# 17. Implementation Rules

Before changing anything:

1. Inspect the existing front-end structure.
2. Identify the current landing/home page.
3. Identify existing global styles/components.
4. Reuse the existing logo/assets where possible.
5. Preserve all existing routes and functionality.
6. Preserve existing authentication.
7. Preserve all existing backend integrations.
8. Only change the front-end landing-page presentation.

Do not rewrite working application logic just to achieve the visual design.

If a backend-driven value is needed for a visual component, use the existing data source rather than creating a new backend implementation.

---

# 18. Final Quality Bar

The finished page should feel closer to a premium infrastructure product such as a high-end enterprise SaaS website than a generic template.

The first impression should immediately communicate:

**RackedView = professional rack infrastructure documentation and visualisation.**

Prioritise:

1. Strong hero
2. Beautiful product UI
3. Clear explanation of what RackedView does
4. Premium typography
5. Strong visual hierarchy
6. Realistic infrastructure imagery
7. Clean responsive behaviour
8. No fake claims
9. No backend changes

The supplied reference image is the visual benchmark for the overall composition, polish, spacing, dark/blue aesthetic, product mockups and premium SaaS presentation.
