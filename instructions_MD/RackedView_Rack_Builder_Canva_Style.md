# RackedView Rack Builder — Premium Canva-Style Front-End Redesign

## IMPORTANT

This task is **FRONT-END ONLY**.

Do not modify, rewrite, migrate, replace, or restructure anything related to the backend.

### Do NOT change:
- Database
- Supabase
- Authentication
- API endpoints
- API logic
- Database schemas
- RLS policies
- Server-side code
- Existing data models
- Existing backend services
- Existing persistence logic

Use the existing functionality and data exactly as it currently works.

The goal is to completely redesign the **visual Rack Builder workspace** so it feels like a premium, professional **Canva/Figma-style visual editor for IT rack infrastructure**.

---

# 1. CORE CONCEPT

The current Rack Builder feels like a traditional form/application.

Change the mental model to:

> **The rack is the canvas.**

RackedView should feel like:

**Canva + Figma + IT rack documentation.**

The user should be able to look at the interface and immediately understand:

- Left side = things I can add
- Centre = my rack/canvas
- Right side = properties of whatever I selected
- Top = editing/view controls

The interface should feel visual rather than form-heavy.

---

# 2. TARGET LAYOUT

Use a full-screen application workspace.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ RackedView    Racks   Devices   Documentation   Templates   Reports   Search │
├────────┬──────────────────────┬──────────────────────────────┬───────────────┤
│        │                      │                              │               │
│ TOOLS  │   ELEMENT LIBRARY    │          CANVAS              │  PROPERTIES   │
│        │                      │                              │               │
│ Devices│ Search devices...    │       ┌──────────────┐       │ Device        │
│ Wiring │                      │       │              │       │ Properties    │
│ Text   │ Network              │       │    RACK 01   │       │               │
│ Shapes │ [Switch] [Router]    │       │              │       │ Name          │
│ Images │ [Patch]  [Firewall]  │       │    Devices   │       │ Type          │
│ Tools  │                      │       │              │       │ Manufacturer  │
│ Templates│ Compute            │       │              │       │ Position      │
│        │ [Server] [Storage]   │       │              │       │ Height        │
│        │                      │       │              │       │ Labels        │
│        │ Power                │       │              │       │ Notes         │
│        │ [UPS] [PDU]          │       │              │       │ Connections   │
│        │                      │       │              │       │ Documentation│
└────────┴──────────────────────┴───────────────┴──────────────┴───────────────┘
```

---

# 3. VISUAL STYLE

The UI should look premium and polished.

## Overall

- Dark application chrome
- White/light canvas
- Deep navy panels
- Electric blue primary accent
- Rounded corners
- Soft shadows
- Thin borders
- Subtle gradients
- Excellent spacing
- Modern typography
- High-quality device imagery
- Smooth interactions

The visual reference is the supplied Rack Builder mockup.

Think:

> **Canva editor meets professional network infrastructure software.**

Do NOT make it look like an admin dashboard.

Do NOT make it look like a spreadsheet.

Do NOT make it look like a settings page.

---

# 4. TOP NAVIGATION

Create a premium application header.

### Left

RackedView logo + wordmark.

### Navigation

```text
Racks
Devices
Documentation
Templates
Reports
```

### Search

Large search field:

```text
Search devices, racks, templates...
```

### Right

- Notifications if existing functionality supports it
- User/avatar
- Existing account controls

---

# 5. RACK BUILDER HEADER

Below the global navigation:

### Breadcrumb

```text
Racks  /  New Rack
```

### Rack title

```text
Head Office - Core Rack
```

Allow the existing title/edit functionality to remain functional.

### Subtitle

```text
Design, visualise and document your rack layout.
```

### Right controls

```text
Undo
Redo
100% ▼
Zoom
Fit
Front View
Rear View
Save Rack ▼
⋮
```

These should look like professional design-tool controls.

---

# 6. LEFT TOOLBAR

The far-left vertical toolbar is the primary tool navigation.

This is one of the most important changes.

Use large icons with labels.

### Tools

```text
Devices
Elements
Wiring
Text
Shapes
Images
Tools
Templates
```

The currently selected tool should have a strong blue active state.

---

# 7. ELEMENT LIBRARY

When **Devices** is selected, show the element library beside the toolbar.

The library should feel like Canva's element panel.

## Header

```text
Devices
```

Search:

```text
Search devices...
```

Add filter/funnel control.

---

# 8. DEVICE CATEGORIES

Organise devices into visual categories.

## Network

```text
Switch
Router
Patch Panel
Firewall
```

## Compute

```text
Server
Storage
```

## Power

```text
UPS
PDU
```

## Other

```text
Blank Panel
Cable Manager
```

Use existing available device types where possible.

Do not invent backend records.

---

# 9. DEVICE CARDS

Each device should have a visual card.

Example:

```text
┌─────────────────────┐
│                     │
│   [device image]    │
│                     │
│       Switch        │
└─────────────────────┘
```

Cards should support:

- Hover state
- Dragging
- Click-to-add
- Visual feedback
- Existing add-item behaviour

The goal is:

> **Drag device → drop onto rack.**

This should be the primary interaction.

If drag-and-drop functionality already exists, improve the presentation without changing the underlying data logic.

If the existing app uses click-to-add, preserve that functionality while making it visually feel like a design tool.

---

# 10. WIRING TOOL

When clicking **Wiring**, replace the device library with a wiring toolbox.

Example:

```text
Wiring

Search...

NETWORK
────────────

Ethernet
Fibre
Patch Cable

POWER
────────────

Power Cable

CONNECTION
────────────

Connection Line
```

The user should be able to visually add or interact with connection elements using the existing application functionality.

Use cable/connection visuals that look clean and professional.

---

# 11. TEXT TOOL

When clicking **Text**:

```text
Text

Add Text

Heading
Subheading
Label
Note
```

Show simple text presets.

Example:

```text
+ Add heading

+ Add label

+ Add note
```

Text placed on the canvas should feel like a Canva text object.

---

# 12. SHAPES TOOL

When clicking **Shapes**:

```text
Shapes

□ Rectangle
○ Circle
— Line
→ Arrow
```

Use clean icons.

Shapes should be visually consistent with the rest of the editor.

---

# 13. IMAGES TOOL

When clicking **Images**:

```text
Images

Upload Image

Drag an image here
or
Choose Image
```

Use the existing image/upload functionality if present.

Do not create new backend storage systems.

---

# 14. TOOLS PANEL

When clicking **Tools**:

```text
Tools

Pen
Highlighter
Eraser
Measure
Select
```

Use a design-tool style presentation.

Pen and highlighter should feel like annotation tools.

These are particularly useful for documenting unusual rack layouts or adding notes to a visual elevation.

Only connect these controls to existing functionality where available.

Do not modify backend architecture to implement them.

---

# 15. TEMPLATES PANEL

When clicking **Templates**:

Show visual template cards.

Examples:

```text
Standard Network Rack

Server Rack

Office Rack

Core Switch Rack

Small Cabinet
```

These should be presented as visual templates.

Use existing template functionality if available.

Do not invent backend template infrastructure.

---

# 16. CANVAS

The centre of the interface is the star.

It should feel like a real design canvas.

### Canvas background

Use:

- Light grey/white
- Very subtle grid
- Infinite-canvas feel
- Soft shadow around rack
- Plenty of whitespace

Example:

```text
·  ·  ·  ·  ·  ·  ·  ·

        ┌────────────────────┐
        │      RACK 01       │
        ├────────────────────┤
42      │                    │
41      │    PATCH PANEL     │
40      │                    │
39      ├────────────────────┤
38      │      SWITCH        │
37      ├────────────────────┤
36      │      FIREWALL      │
35      │                    │
34      ├────────────────────┤
...
        │       SERVER       │
        │                    │
        └────────────────────┘
```

---

# 17. RACK VISUAL

The rack should look significantly more premium than the current version.

Use:

- Dark rack frame
- Realistic hardware
- Clear RU numbering
- Rack-unit grid
- Device separation
- Subtle depth
- Realistic shadows
- Clean labels

Display:

```text
42
41
40
39
...
1
```

on both sides where appropriate.

The rack itself should feel like an object sitting inside a design canvas.

---

# 18. DEVICE INTERACTION

When a device is selected:

### Blue selection border

Use a clear blue outline.

### Handles

Where appropriate, show:

- Move
- Resize/height
- Selection handles

### Position guides

Show subtle blue alignment lines.

Example:

```text
        ────────────────
             U36
        ────────────────
```

This should make positioning feel like Canva/Figma.

---

# 19. DRAGGING EXPERIENCE

When dragging a device:

- Show a semi-transparent preview
- Highlight the valid rack position
- Snap to rack units
- Show the target RU
- Provide a subtle blue drop indicator
- Animate the placement smoothly

Example:

```text
        U36 ─────────────

             ↓

        ┌──────────────┐
        │   SWITCH     │
        └──────────────┘
```

Do not allow the visual interface to feel clunky.

---

# 20. RIGHT PROPERTY PANEL

When an object is selected, show:

```text
Device Properties
```

with a clean dark panel.

Example:

### Device image

Large preview of selected device.

### Fields

```text
Device Type
Switch

Manufacturer
Cisco

Model
Catalyst 9300

Name
Core Switch

Position (U)
36

Height
1U
```

Use the existing application fields/data.

Do not create fake data storage.

---

# 21. COLOUR / LABELS

Include a visual colour selector:

```text
Colour

● ● ● ● ● ●
```

And labels:

```text
Labels

[ Core × ] [ Network × ]        +
```

This should visually resemble Canva's object properties.

Only persist these values using existing functionality where supported.

---

# 22. NOTES

Add a clean notes area:

```text
Notes

Main core switch for head office.
Connected to firewall and distribution
switches.
```

Use existing notes functionality/data if available.

---

# 23. COLLAPSIBLE PROPERTIES

At the bottom of the property panel:

```text
Connections                         4   >
Documentation                       2   >
Additional Settings                     >
```

These should be expandable sections.

Use existing application functionality where available.

---

# 24. CANVA-LIKE TOP TOOLBAR

The editor should have a familiar design-tool toolbar.

Include visually:

```text
↶ Undo
↷ Redo

100% ▼

⌕ Zoom
Fit

Grid
Snap

Front View
Rear View

Preview

Save Rack
```

Keep this clean.

Do not overcrowd it.

---

# 25. RESPONSIVE BEHAVIOUR

Desktop is the priority because this is a professional rack-building workspace.

For smaller screens:

- Collapse the left tool library
- Convert panels into drawers
- Keep the rack canvas usable
- Keep properties accessible
- Preserve zoom/pan
- Avoid shrinking the rack until it becomes unusable

Mobile can use a bottom-sheet style tool interface if necessary.

---

# 26. MICRO-INTERACTIONS

Add subtle polish:

### Buttons

- Smooth hover
- Slight brightness increase
- Small elevation

### Device cards

- Hover lift
- Blue border
- Drag cursor

### Canvas

- Smooth zoom
- Smooth pan
- Snap feedback

### Selection

- Blue border
- Soft blue glow
- Handles/guides

### Panels

- Smooth open/close
- No jarring movement

Keep animations fast and professional.

---

# 27. EMPTY RACK STATE

When the rack is empty, make it feel intentional.

Inside the rack:

```text
Start building your rack

Drag devices from the left
or click an item to add it.

+ Add first item
```

Add a subtle rack/device icon.

Do not make the empty state feel like a broken or unfinished page.

---

# 28. PREMIUM DETAILS

Add the small details that make the interface feel expensive:

- subtle 1px borders
- 8–14px corner radius depending on component
- layered shadows
- soft blue focus rings
- consistent iconography
- excellent spacing
- subtle background texture/grid
- professional empty states
- consistent button sizing
- smooth transitions
- no excessive gradients

Avoid visual clutter.

---

# 29. IMPORTANT UX PRINCIPLE

The user should be able to understand the application without reading documentation.

Within 5 seconds they should understand:

> **I can grab an IT device from the left and put it into my rack.**

That is the core experience.

---

# 30. DO NOT TURN THIS INTO A FORM

Avoid making the left side primarily:

```text
Rack Name
Rack #
Max RU
Sort RU
Add Item
```

Those controls can still exist, but they should no longer dominate the experience.

Instead:

```text
DEVICES
WIRING
TEXT
SHAPES
IMAGES
TOOLS
TEMPLATES
```

should be the primary visual navigation.

Rack metadata should be accessible through a secondary properties/details area.

---

# 31. FINAL VISUAL TARGET

The finished interface should feel like:

**Canva**
- visual editor
- drag/drop
- element library
- properties panel
- canvas
- templates

+

**Figma**
- clean workspace
- precise positioning
- selection states
- guides
- zoom
- professional controls

+

**RackedView**
- rack elevations
- IT hardware
- rack units
- devices
- wiring
- documentation
- infrastructure visualisation

The final result should look like a **premium professional IT design application**, not a CRUD form.

---

# 32. IMPLEMENTATION PRIORITY

Build/refine in this order:

1. Overall workspace layout
2. Left tool navigation
3. Device element library
4. Central rack canvas
5. Device selection state
6. Right properties panel
7. Top design toolbar
8. Wiring/Text/Shapes/Images/Tools panels
9. Drag/drop visual experience
10. Empty-state design
11. Responsive behaviour
12. Animations and polish

At every stage:

**FRONT-END ONLY.**

Preserve all existing backend functionality and application data behaviour.
