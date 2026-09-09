# RackTwin — Master GitHub Copilot Build Prompt

You are a senior Flutter, Supabase and SaaS engineer.

Build a production-quality MVP mobile application named **RackTwin**.

RackTwin is a simple rack-documentation application for IT departments, MSPs, hospitals, schools and businesses. It allows users to create digital server and network rack layouts, attach real photos, manage teams, and generate QR codes that engineers can scan to view the latest rack information.

The app must run on:

- iOS
- Android
- Mobile and tablet layouts

Use the following stack:

- Flutter with Dart
- Material 3
- Riverpod for state management
- GoRouter for navigation
- Supabase PostgreSQL for the database
- Supabase Authentication
- Supabase Storage for rack photos
- Supabase Row Level Security
- RevenueCat for Apple and Google subscriptions
- qr_flutter for QR generation
- mobile_scanner for QR scanning
- image_picker and camera for rack photos
- uuid for identifiers
- intl for Australian date formatting
- freezed and json_serializable where useful

Do not create unnecessary architecture or placeholder complexity. Build a clean, maintainable MVP that can be expanded later.

---

## PRODUCT GOAL

The core promise is:

> **Build the rack. Photograph the rack. Scan the rack.**

A user should be able to:

1. Sign in.
2. Create an organisation.
3. Invite organisation members.
4. Assign members roles.
5. Create a site.
6. Create a location within that site.
7. Create a rack.
8. Select the rack’s total RU capacity.
9. Drag devices into the rack.
10. Take or upload a real rack photo.
11. Compare the digital layout and real photo.
12. Generate and print or share a QR code.
13. Scan the QR code to view the rack.
14. Manage their subscription and account.

Keep the workflow extremely simple. A user should be able to create a basic rack in under two minutes.

---

## DESIGN DIRECTION

Create a clean, premium, modern interface.

Visual style:

- Dark charcoal and white surfaces
- Bright lime-green accent colour
- Large clear headings
- Rounded cards
- Minimal clutter
- Clear icons
- Smooth but subtle animations
- Excellent dark mode
- Large touch targets
- Modern Apple-quality spacing
- Responsive tablet layout

Do not make it look like old enterprise asset-management software.

Use this starter colour palette:

- Primary lime: `#B7F34A`
- Near black: `#101210`
- Dark surface: `#1A1D1A`
- Light background: `#F5F7F4`
- White: `#FFFFFF`
- Error: `#D92D20`
- Warning: `#F79009`

Use system fonts initially.

---

## AUTHENTICATION

Create an authentication flow with:

- Email and password
- Password reset
- Sign in with Apple on iOS
- Sign in with Google
- Microsoft sign-in architecture prepared but hidden behind a feature flag for the MVP
- Email verification
- Sign out
- Session persistence

When registering, require:

- Full name
- Email
- Password
- Checkbox accepting Terms and Conditions
- Checkbox acknowledging the Privacy Policy

Store the date and version of the accepted legal documents.

After first registration, ask the user to:

- Create an organisation
- Enter organisation name
- Optionally enter ABN
- Optionally upload an organisation logo

The user who creates the organisation becomes its owner.

---

## USER ROLES

Support these organisation roles:

### Owner

Can:

- View all organisation data
- Create and edit sites
- Create and edit locations
- Create and edit racks
- Create and edit devices
- Upload and delete photos
- Invite members
- Remove members
- Change member roles
- Manage subscription and billing
- Update organisation settings
- Transfer organisation ownership
- Delete organisation

There must always be at least one owner.

### Admin

Can:

- View all organisation data
- Create and edit sites
- Create and edit locations
- Create and edit racks
- Create and edit devices
- Upload and delete photos
- Invite members
- Remove Editors and Viewers
- Change Editor and Viewer roles
- Manage organisation settings

Cannot:

- Delete the organisation
- Transfer ownership
- Remove an Owner
- Manage billing unless explicitly granted later

### Editor

Can:

- View organisation data
- Create and edit sites
- Create and edit locations
- Create and edit racks
- Create and edit devices
- Upload rack photos
- Update documentation

Cannot:

- Manage members
- Manage billing
- Delete organisation
- Change organisation settings

### Viewer

Can:

- View sites
- View locations
- View racks
- View devices
- View permitted rack photos
- View activity history

Cannot:

- Create
- Edit
- Delete
- Invite members
- Manage billing

Use Supabase Row Level Security to enforce permissions server-side. Do not rely only on UI checks.

---

## MAIN NAVIGATION

After authentication, use a bottom navigation bar with **four** destinations:

1. Home
2. View
3. Organisation
4. Settings

The Home screen must have two large primary action cards:

- Build Rack
- View Racks

Also display:

- Organisation name
- Number of sites
- Number of racks
- Number of organisation members
- Recently updated racks
- Subscription status
- Empty-state guidance when no racks exist

---

# HOME SCREEN

The Home screen must contain:

### Header

- RackTwin logo or text
- Current organisation
- Profile avatar
- Organisation switcher architecture prepared for later

### Primary actions

- Build Rack
- View Racks

### Quick summary

Display compact cards showing:

- Sites
- Racks
- Members
- Last update

### Recent racks

Each recent rack card shows:

- Rack name
- Site
- Location
- Last updated date
- Thumbnail of latest rack photo if available

Each card opens the rack detail screen.

---

# ORGANISATION SCREEN

Add a dedicated **Organisation** button in the main navigation.

This is the central area for team and organisation management.

The Organisation screen must contain:

## Organisation Overview

Display:

- Organisation logo
- Organisation name
- ABN if entered
- Subscription plan
- Subscription status
- Number of users
- Number of sites
- Number of racks
- Organisation owner
- Created date

Actions:

- Edit organisation
- Manage members
- Invite member
- Manage subscription
- Transfer ownership
- Delete organisation

Only show actions the current user has permission to use.

---

## MEMBERS

Display all organisation members.

Each member card shows:

- Avatar
- Full name
- Email
- Role
- Status
- Joined date
- Last active date when available

Statuses:

- Active
- Invite pending
- Invite expired
- Disabled

Provide filters:

- All
- Owners
- Admins
- Editors
- Viewers
- Pending invites

Allow search by:

- Name
- Email

---

## INVITE MEMBER FLOW

Owner and Admin users can invite members.

Invite fields:

- Email address
- Role
- Optional message

Role options:

- Admin
- Editor
- Viewer

Only an Owner may invite another Owner or transfer ownership.

When sending an invite:

1. Create an organisation invitation record.
2. Generate a secure single-use invitation token.
3. Send an email using a server-side email service.
4. Record the invite sender.
5. Record the invited role.
6. Set an expiry date.
7. Allow the invite to be resent.
8. Allow the invite to be cancelled.

If the email already belongs to an existing RackTwin user:

- Let them accept the organisation invite after signing in.

If the email belongs to a new user:

- Let them register and then automatically join the organisation after accepting the invite.

Do not expose raw invitation database IDs.

---

## MEMBER MANAGEMENT

Owner and permitted Admin users can tap a member to open Member Details.

Member Details shows:

- Name
- Email
- Current role
- Joined date
- Invited by
- Last active
- Sites accessed where useful later

Allowed actions:

- Change role
- Remove member
- Disable access
- Resend invite
- Cancel invite

Rules:

- Owners cannot remove themselves if they are the only Owner.
- Ownership must be transferred first.
- Admins cannot promote users to Owner.
- Admins cannot remove Owners.
- Editors and Viewers cannot access member management.
- The last Owner cannot be removed or downgraded.

Show confirmation dialogs for destructive actions.

---

## ORGANISATION EDITING

Owner and Admin can update:

- Organisation name
- ABN
- Organisation logo
- Support contact
- Default QR access mode
- Default RU numbering direction

Owner-only settings:

- Transfer ownership
- Delete organisation
- Billing ownership

---

## ORGANISATION INVITATION DATABASE MODEL

Create an `organisation_invitations` table containing:

- id UUID
- organisation_id UUID
- invited_email
- invited_role
- token_hash
- invited_by
- status
- expires_at
- accepted_by
- accepted_at
- created_at
- updated_at

Invitation statuses:

- pending
- accepted
- expired
- cancelled

Never store the raw invitation token in the database.

Store only its secure hash.

---

# BUILD RACK FLOW

Create a guided multi-step rack creation flow.

## Step 1: Rack details

Fields:

- Rack name
- Site
- Location or room
- Rack level
- Rack identifier
- Total rack units
- Notes

Site:

- Select existing site
- Or create a new site without leaving the flow

Location:

- Select an existing location belonging to the selected site
- Or create a new location

Rack level examples:

- Basement
- Ground Floor
- Level 1
- Level 2
- Roof
- Data Centre Row
- Custom entry

Rack identifier examples:

- R1
- R2
- MCR-01
- COMMS-A

Rack unit options:

- 6U
- 9U
- 12U
- 18U
- 24U
- 27U
- 32U
- 42U
- 45U
- 48U
- Custom RU count between 1 and 60

Allow RU numbering to run:

- Bottom to top
- Top to bottom

Default to bottom-to-top numbering.

---

## Step 2: Rack builder

Display a visual vertical rack with clearly numbered rack units.

The rack builder must support:

- Drag and drop
- Snap devices to rack units
- Move devices up and down
- Resize devices by RU height
- Prevent devices from overlapping
- Show valid drop positions
- Show invalid positions clearly
- Undo last change
- Delete device
- Duplicate device
- Edit device
- Front view
- Rear view
- Empty rack-unit visibility
- Pinch to zoom where practical
- Smooth scrolling for 42U and 48U racks

Device library:

- Patch panel
- Network switch
- Router
- Firewall
- Server
- UPS
- PDU
- Fibre tray
- NVR
- Storage array
- Modem
- KVM
- Shelf
- Blanking panel
- Cable manager
- Custom device

Each device has:

- Device name
- Device type
- Manufacturer
- Model
- Hostname
- Serial number
- Asset tag
- IP address
- MAC address
- RU height
- Starting RU
- Front or rear placement
- Status
- Notes

Device status options:

- Active
- Spare
- Offline
- Planned
- Faulty
- Decommissioned

For the MVP, devices can use clean generic visual blocks with icons and labels.

Do not attempt photorealistic manufacturer equipment.

Add a floating **Add Device** button that opens the device library.

When a device is dragged into the rack:

- Snap it to the nearest valid rack unit.
- Update its starting RU.
- Save changes automatically after a short debounce.
- Display a small “Saved” confirmation.
- Keep a local draft if the network becomes unavailable.

---

## Step 3: Rack photos

Allow users to:

- Take a photo with the camera
- Select a photo from the gallery
- Add multiple photos
- Mark one photo as the current primary photo
- Add an optional caption
- Record the upload date and uploader
- Compress large images before upload
- Display upload progress
- Retry failed uploads

Photo types:

- Front
- Rear
- Side
- Room overview
- Other

Create a comparison screen with:

- Digital rack layout
- Current real rack photo

On phones, allow switching between:

- Layout
- Photo
- Split view

On tablets, show the digital layout and photo side-by-side.

Do not use AI image recognition in the MVP.

---

## Step 4: Review and save

Display:

- Organisation
- Site
- Location
- Rack name
- Rack RU capacity
- Number of devices
- Latest photo
- QR access setting

Actions:

- Save rack
- Return to editing
- Generate QR code
- Share rack

---

# VIEW SCREEN

The View screen must show all documented infrastructure in this hierarchy:

Organisation  
→ Sites  
→ Locations  
→ Racks

Site cards must show:

- Site name
- Address or optional location description
- Number of locations
- Number of racks
- Last updated date

Selecting a site opens its locations.

Location cards must show:

- Location name
- Level
- Number of racks
- Latest photo thumbnail if available

Selecting a location opens its racks.

Rack cards must show:

- Rack name
- Rack identifier
- RU capacity
- Number of devices
- Last updated date
- Current photo thumbnail
- Documentation status

Documentation status:

- Current
- Review due
- Missing photo
- Empty rack
- Archived

Include:

- Search
- Sort
- Filters
- List and card views
- Pull to refresh
- Empty states

Search should match:

- Site
- Location
- Rack
- Device name
- Hostname
- Serial number
- Asset tag
- IP address

---

# RACK DETAIL SCREEN

The rack detail screen must contain:

### Header

- Rack name
- Site and location
- Rack identifier
- Edit button
- Share button
- QR button

### Tabs

1. Layout
2. Photo
3. Devices
4. Details
5. Activity

### Layout tab

- Front rack view
- Rear rack view
- Tap device to inspect details
- Edit mode for authorised users

### Photo tab

- Current photo
- Previous photos
- Photo date
- Uploaded by
- Add photo button

### Devices tab

- Searchable list of all devices
- Device name
- Type
- RU position
- Status
- Hostname
- IP address

### Details tab

- Site
- Location
- Rack capacity
- RU numbering direction
- Notes
- QR access mode
- Created by
- Created date
- Last updated by
- Last updated date

### Activity tab

Record:

- Rack created
- Device added
- Device moved
- Device edited
- Device removed
- Photo uploaded
- Rack details changed
- QR access changed
- Member actions affecting the rack where useful

---

# QR CODE FUNCTIONALITY

Every rack must have a unique, non-sequential public identifier.

Generate a QR code that links to:

`https://app-domain.example/rack/{publicRackId}`

Do not expose internal database IDs in QR URLs.

QR access modes:

1. Organisation login required
2. Anyone with the link can view
3. PIN protected
4. Disabled

Default to organisation login required.

The QR screen must allow the user to:

- Preview the QR code
- Download it as PNG
- Share it
- Generate a printable label
- Regenerate the public rack link
- Disable QR access
- Select access mode
- Set or change the PIN

The printable label must contain:

- QR code
- Organisation name
- Site name
- Location
- Rack name
- Short instruction: “Scan to view rack”
- Optional organisation logo

Create a clean A6-style label layout suitable for printing.

Do not include passwords, IP addresses, serial numbers or sensitive device data directly inside the QR code.

The QR code must only contain the secure rack URL.

---

# WEB RACK VIEW

Prepare a simple responsive web-view architecture using Flutter Web for the MVP.

The QR rack page must:

- Load quickly on mobile
- Show rack name
- Show site and location
- Show current rack photo
- Show the digital rack layout
- Show last updated time
- Allow tapping a device for permitted information
- Honour rack access settings
- Require sign-in when organisation access is enabled
- Require the PIN when PIN access is enabled
- Show a clear disabled-link message when access is disabled

Public users must not see sensitive fields by default.

Public-safe fields:

- Device name
- Device type
- Manufacturer
- Model
- RU position
- Status
- General notes explicitly marked public

Restricted fields:

- IP address
- MAC address
- Serial number
- Asset tag
- Internal notes
- Activity history

Only authenticated authorised organisation members may view restricted fields.

---

# SETTINGS SCREEN

Create the following settings sections.

## Account

- Full name
- Email address
- Profile image
- Change password
- Connected sign-in providers
- Sign out

## Subscription

- Current plan
- Subscription status
- Renewal date
- Upgrade
- Restore purchases
- Manage subscription
- Billing help

Do not use Stripe checkout directly inside the iOS or Android app.

Use RevenueCat with:

- Apple App Store auto-renewable subscriptions
- Google Play subscriptions
- Restore purchases
- Entitlement verification
- Server-side webhook architecture prepared

Initial product:

- RackTwin Business Annual
- AUD $499.99 per year
- Product identifier: `racktwin_business_annual`

Create a developer feature flag allowing the subscription requirement to be bypassed in local development.

Provide a seven-day free trial architecture but keep it disabled by default.

## App preferences

- Light mode
- Dark mode
- Use device setting
- Default RU numbering direction
- Default QR access mode
- Date format
- Notification preferences

Use Australian date formatting by default.

## Security and privacy

- Privacy Policy
- Terms and Conditions
- Data collection summary
- Export my data
- Request account deletion
- Delete account
- Manage active sessions
- App permissions
- Camera permission explanation
- Photo-library permission explanation

Account deletion must be initiated inside the app.

Before deletion:

- Explain what will be deleted.
- Explain what may be retained for legal or billing requirements.
- Require reauthentication.
- Require typed confirmation: `DELETE`.
- Provide a clear final confirmation.
- Delete or anonymise associated personal data according to the data model.
- Prevent accidental organisation deletion when other organisation members exist.
- Allow ownership transfer before deletion.

Also create a public web route where users can request account deletion for Google Play compliance.

## Support

- Help centre
- Contact support
- Report a bug
- Feature request
- App version
- Build number

Use placeholder URLs through a central `AppLinks` configuration file:

- Privacy Policy URL
- Terms and Conditions URL
- Support URL
- Account deletion URL
- Marketing website URL

Do not hard-code these URLs throughout the app.

## About

- About RackTwin
- Version
- Open-source licences
- Copyright
- Acknowledgements

---

# SUBSCRIPTION ACCESS

Allow users to register and explore a sample demonstration rack before subscribing.

Subscription paywall should appear when the organisation attempts to:

- Create its first real rack
- Invite more than one additional team member
- Export a QR label
- Upload a real rack photo

The paywall must clearly show:

- Product name
- Annual price
- Subscription duration
- Auto-renewal explanation
- Restore purchases
- Terms and Conditions link
- Privacy Policy link
- Manage subscription information
- Cancel-anytime wording
- Purchase button

Do not use manipulative countdowns or misleading free-trial language.

The subscription belongs to the organisation.

Do not require every organisation member to purchase separately.

The organisation Owner controls billing.

---

# DATABASE MODEL

Create Supabase SQL migrations for these tables.

## profiles

- id UUID, references auth.users
- full_name
- avatar_url
- created_at
- updated_at
- terms_version
- terms_accepted_at
- privacy_version
- privacy_accepted_at

## organisations

- id UUID
- name
- abn
- logo_url
- owner_user_id
- support_email
- subscription_status
- subscription_entitlement
- subscription_expires_at
- created_at
- updated_at

## organisation_members

- id UUID
- organisation_id
- user_id
- role
- status
- invited_email
- invited_by
- invitation_status
- joined_at
- created_at
- updated_at

## organisation_invitations

- id UUID
- organisation_id
- invited_email
- invited_role
- token_hash
- invited_by
- status
- expires_at
- accepted_by
- accepted_at
- created_at
- updated_at

## sites

- id UUID
- organisation_id
- name
- address
- description
- created_by
- created_at
- updated_at
- archived_at

## locations

- id UUID
- organisation_id
- site_id
- name
- level
- description
- created_by
- created_at
- updated_at
- archived_at

## racks

- id UUID
- public_id UUID
- organisation_id
- site_id
- location_id
- name
- rack_identifier
- rack_units
- numbering_direction
- notes
- qr_access_mode
- qr_pin_hash
- qr_enabled
- created_by
- updated_by
- created_at
- updated_at
- archived_at

## devices

- id UUID
- organisation_id
- rack_id
- name
- device_type
- manufacturer
- model
- hostname
- serial_number
- asset_tag
- ip_address
- mac_address
- ru_height
- start_ru
- rack_side
- status
- internal_notes
- public_notes
- created_by
- updated_by
- created_at
- updated_at
- archived_at

## rack_photos

- id UUID
- organisation_id
- rack_id
- storage_path
- thumbnail_path
- photo_type
- caption
- is_primary
- uploaded_by
- created_at

## rack_activity

- id UUID
- organisation_id
- rack_id
- user_id
- action_type
- entity_type
- entity_id
- summary
- old_data JSONB
- new_data JSONB
- created_at

## organisation_activity

- id UUID
- organisation_id
- user_id
- action_type
- target_user_id
- summary
- old_data JSONB
- new_data JSONB
- created_at

Use this to log:

- Member invited
- Invite resent
- Invite cancelled
- Member joined
- Member removed
- Member disabled
- Role changed
- Organisation settings changed
- Ownership transferred

## subscription_events

- id UUID
- organisation_id
- provider
- event_type
- external_customer_id
- external_transaction_id
- payload JSONB
- created_at

## account_deletion_requests

- id UUID
- user_id
- email
- status
- requested_at
- completed_at
- notes

Create indexes for:

- organisation_id
- site_id
- location_id
- rack_id
- public_id
- hostname
- serial_number
- asset_tag
- ip_address
- invited_email
- updated_at

Create sensible foreign keys and cascade rules.

---

# SECURITY

Implement Supabase Row Level Security policies.

Requirements:

- Users can only access organisations they belong to.
- Viewers can only read.
- Editors can create and update rack documentation.
- Admins can manage members within their allowed role restrictions.
- Owners can manage billing, ownership and organisation deletion.
- Organisation membership permissions must be validated server-side.
- Public QR access must go through a restricted database function or secure server endpoint.
- Never expose unrestricted rack tables using anonymous Supabase access.
- PINs must never be stored as plain text.
- Invitation tokens must never be stored as plain text.
- Storage paths must be organisation scoped.
- Signed URLs should be used for private images.
- Validate all user input.
- Apply reasonable upload file-size limits.
- Only accept supported image formats.
- Log important changes in rack_activity or organisation_activity.
- Do not place secret keys inside the Flutter application.
- Use environment variables for Supabase URLs, anonymous keys and RevenueCat public SDK keys.
- Keep service-role keys server-side only.

---

# OFFLINE AND ERROR HANDLING

For the MVP:

- Cache recently viewed racks.
- Preserve unsaved rack-builder changes locally.
- Show clear offline state.
- Retry failed saves.
- Retry failed image uploads.
- Never silently discard user changes.
- Show helpful error messages instead of raw exceptions.
- Add loading, empty, error and success states to every primary screen.

---

# PROJECT STRUCTURE

Use a feature-first structure similar to:

```text
lib/
  app/
  core/
    config/
    constants/
    errors/
    routing/
    theme/
    utils/
    widgets/
  features/
    auth/
    home/
    organisations/
    organisation_members/
    organisation_invites/
    sites/
    locations/
    racks/
    rack_builder/
    devices/
    photos/
    qr_access/
    subscriptions/
    settings/
    account_deletion/
  services/
    supabase/
    revenuecat/
    storage/
    local_cache/
  main.dart
```

Each feature should contain:

- data
- domain
- presentation

Avoid unnecessary abstractions where a simpler implementation is clearer.

---

# TESTING

Add:

- Unit tests for rack placement and overlap validation
- Unit tests for RU numbering
- Unit tests for permission logic
- Unit tests for organisation roles
- Unit tests for invitation expiry
- Widget tests for the rack builder
- Widget tests for organisation member management
- Widget tests for the paywall
- Widget tests for account deletion
- Integration tests for creating and viewing a rack
- Integration tests for inviting and accepting a member
- Repository tests using mocked Supabase clients

Critical rack-placement tests:

- 1U device placed correctly
- Multi-RU device placed correctly
- Device cannot exceed rack capacity
- Devices cannot overlap
- Moving device releases previous units
- Front and rear placements remain independent
- Deleted device frees occupied units
- Top-to-bottom numbering works
- Bottom-to-top numbering works

Critical organisation tests:

- Owner can invite Admin
- Admin can invite Editor
- Admin cannot invite Owner
- Viewer cannot invite users
- Editor cannot manage members
- Last Owner cannot leave
- Owner can transfer ownership
- Admin cannot remove Owner
- Expired invite cannot be accepted
- Cancelled invite cannot be accepted

---

# DEMO DATA

Create optional demo data containing:

Organisation:

- Metro Health IT

Organisation members:

- Alex Owner — Owner
- Jordan Admin — Admin
- Casey Engineer — Editor
- Taylor Support — Viewer

Site:

- Central Hospital

Location:

- Ground Floor Main Communications Room

Rack:

- MCR-R1
- 42U

Example devices:

- 24-port patch panel
- Core network switch
- Firewall
- Fibre tray
- Two servers
- UPS
- PDU

Include one placeholder rack photo for local development only.

The user must be able to delete the demonstration data.

---

# DELIVERY ORDER

## Phase 1

- Project setup
- Theme
- Routing
- Supabase configuration
- Authentication
- Organisation onboarding
- Main bottom navigation

## Phase 2

- Organisation screen
- Member roles
- Member list
- Invite flow
- Member management
- Organisation editing
- Organisation RLS

## Phase 3

- Sites
- Locations
- Racks
- Database migrations
- Row Level Security

## Phase 4

- Rack builder
- Device library
- Drag, drop, snapping and validation
- Autosave and local drafts

## Phase 5

- Camera and rack photos
- Layout and photo comparison
- Rack detail screens
- Search

## Phase 6

- QR generation
- QR access controls
- Public web rack viewer
- Printable QR label

## Phase 7

- RevenueCat subscriptions
- Paywall
- Restore purchases
- Organisation entitlement handling

## Phase 8

- Settings
- Privacy Policy
- Terms and Conditions
- Support
- Account export
- Account deletion
- Google Play web deletion route

## Phase 9

- Tests
- Accessibility
- Offline handling
- Error handling
- Performance review
- Release configuration

---

# COPILOT WORKING RULES

Do not output the entire project as one giant response.

Work directly in the repository.

Before changing files:

1. Inspect the current project.
2. Explain the immediate implementation step.
3. List the files that will be created or changed.
4. Implement that step.
5. Run `flutter analyze`.
6. Run relevant tests.
7. Fix errors before continuing.
8. Update README progress.

Do not invent package APIs.

Check installed package versions before writing integrations.

Do not leave major functions containing TODO comments unless the missing requirement depends on an external credential.

For external services, create:

- Complete integration code
- Environment-variable templates
- Setup documentation
- Mock development mode

Use fake values only in `.env.example`.

Never commit:

- Supabase service-role keys
- Apple secrets
- Google service credentials
- RevenueCat secret API keys
- Production passwords

---

# README REQUIREMENTS

Create a detailed README containing:

- Product overview
- Features
- Architecture
- Setup instructions
- Flutter installation
- Supabase setup
- SQL migration instructions
- Storage-bucket setup
- Row Level Security explanation
- Organisation roles explanation
- Organisation invitation flow
- RevenueCat setup
- Apple subscription setup
- Google Play subscription setup
- Environment variables
- Running locally
- Running tests
- Building iOS
- Building Android
- Building the web viewer
- App Store preparation checklist
- Google Play preparation checklist
- Known MVP limitations

---

# MVP LIMITATIONS

Do not build these yet:

- AI rack-photo recognition
- Cable tracing
- Switch-port mapping
- IP address management
- ServiceNow integration
- Jira integration
- NFC tags
- Automated network discovery
- Manufacturer-specific device images
- Advanced PDF reports
- Multiple subscription tiers
- Full enterprise SAML
- Custom domains

Design the database so these can be added later, but do not delay the MVP by implementing them.

---

# FINAL ACCEPTANCE CRITERIA

The MVP is complete when:

- A user can register and sign in.
- A user can create an organisation.
- An Owner can invite organisation members.
- Invited users can accept an invitation.
- Owners and Admins can manage permitted member roles.
- Editors and Viewers are restricted correctly.
- A user can create a site and location.
- A user can create a rack with a selected RU capacity.
- A user can drag devices into valid RU positions.
- Devices cannot overlap.
- Rack layouts persist correctly.
- A user can take or upload a rack photo.
- A user can compare the rack layout and photo.
- A user can browse sites, locations and racks.
- A user can search for a rack or device.
- A user can generate a secure QR code.
- Scanning the QR code opens a responsive rack view.
- Public and restricted fields are handled safely.
- An Owner can purchase or restore the annual organisation subscription.
- A user can view Terms, Privacy and Support pages.
- A user can initiate account deletion inside the app.
- A user can request deletion through a public web route.
- All major flows have loading, empty and error states.
- `flutter analyze` completes without errors.
- Critical tests pass.
- No credentials are committed.
- The application can be built for iOS and Android.

---

# STARTING INSTRUCTION

Begin by inspecting the repository and implementing **Phase 1 only**.

Do not begin later phases until Phase 1 builds successfully and its relevant tests pass.

When Phase 1 is complete:

1. Summarise what was built.
2. List any external credentials still required.
3. List any known limitations.
4. Ask whether to continue to Phase 2.
