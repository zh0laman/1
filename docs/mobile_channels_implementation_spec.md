# Mobile Channels Implementation Spec

## Purpose

This document defines how the mobile client must implement channels so the behavior is correct, predictable, and aligned with the web frontend.

It is written as an implementation and QA reference for:

- Flutter mobile developers
- backend developers validating API contracts
- QA engineers testing channel scenarios
- product/tech leads comparing mobile and web parity

This is the target behavior. If current mobile behavior differs from this document, the mobile client should be considered incomplete or inconsistent until fixed.

## Scope

This document covers channels only.

It does not describe:

- personal chats
- group chats
- calls
- linked devices
- boards
- drive

Channel semantics here are:

- channel = one-to-many broadcast entity
- subscribers read content
- admins and owner manage the channel
- admins and owner publish posts
- channel may be `public` or `private`

## Core Product Model

### Channel types

The mobile client must support two channel types:

1. `public`
2. `private`

Behavior must differ clearly:

- `public` channel:
  - may have a public `username`
  - may be opened by public link
  - may be discovered by search
  - user may subscribe directly if backend allows it

- `private` channel:
  - does not expose public username-based discovery
  - must not be discoverable in public search unless backend explicitly supports protected discovery
  - access must happen only through direct membership/subscription flow or trusted invite flow

If mobile stores `type` but does not change UX and permissions by `type`, the implementation is incomplete.

### Roles

The mobile client must support exactly these channel roles:

1. `owner`
2. `admin`
3. `subscriber`

Role semantics:

- `owner`
  - full control
  - can edit channel info
  - can change public username
  - can add/remove subscribers
  - can promote/demote admins
  - can delete the channel

- `admin`
  - can publish posts
  - can edit allowed channel metadata if backend allows it
  - can add/remove subscribers if backend allows it
  - cannot transfer ownership implicitly
  - cannot demote/remove owner

- `subscriber`
  - can view channel
  - can receive updates
  - cannot publish posts
  - cannot manage members
  - cannot edit channel

If the UI shows these roles but business logic does not enforce them, the implementation is incorrect.

### Channel membership model

For channels, mobile must treat members as subscribers/admins/owner, not as generic group members.

This matters in:

- labels
- permissions
- API contracts
- list screens
- profile screens
- action menus
- analytics

The mobile client must not reuse group UX without adapting terminology and permissions.

## Required Data Contracts

### Channel view

Mobile must work with a channel model that includes at least:

- `id`
- `name`
- `description`
- `username`
- `type`
- `avatar_url`
- `member_count`
- `created_at`
- `updated_at`
- `is_subscribed`
- `my_role`

Required behavior:

- `is_subscribed` drives whether the user can read as a member/subscriber
- `my_role` drives publishing and management permissions
- `username` is used for public link generation
- if `username` is absent, fallback link uses channel id only if product allows it

### Channel members

Mobile must normalize member payloads consistently.

At minimum each member record must contain:

- `user_id`
- `role`
- `is_muted`
- user display data:
  - `user_full_name`
  - `user_username`
  - `user_avatar`

Backend variations must be normalized in one place. UI must not depend on raw inconsistent payload shapes.

### Channel posts

Mobile must support posts with:

- `id`
- `channel_id`
- `author_id`
- `content`
- `attachment_url`
- `attachment_type`
- `attachment_size`
- `is_pinned`
- `is_deleted`
- `is_edited`
- `views_count`
- `comments_count`
- `created_at`
- `updated_at`
- `edited_at`
- optional reaction summary
- optional author/channel display metadata

## Required API Surface

The mobile client should be aligned with the same backend contract used by web.

Minimum required endpoints:

- `POST /api/v1/channels`
- `GET /api/v1/channels`
- `GET /api/v1/channels/{channelId}`
- `GET /api/v1/channels/username/{username}`
- `GET /api/v1/channels/search?q=...`
- `PUT /api/v1/channels/{channelId}`
- `PUT /api/v1/channels/{channelId}/avatar`
- `DELETE /api/v1/channels/{channelId}`
- `POST /api/v1/channels/{channelId}/subscribe`
- `DELETE /api/v1/channels/{channelId}/subscribe`
- `GET /api/v1/channels/{channelId}/members`
- `GET /api/v1/channels/{channelId}/admins`
- `POST /api/v1/channels/{channelId}/members`
- `PUT /api/v1/channels/{channelId}/members/{userId}/role`
- `DELETE /api/v1/channels/{channelId}/members/{userId}`
- `POST /api/v1/channels/{channelId}/posts`
- `GET /api/v1/channels/{channelId}/posts`
- `GET /api/v1/channels/{channelId}/posts/pinned`
- `GET /api/v1/channels/posts/{postId}`
- `PUT /api/v1/channels/posts/{postId}`
- `DELETE /api/v1/channels/posts/{postId}`
- `POST /api/v1/channels/posts/{postId}/view`
- `POST /api/v1/channels/posts/{postId}/pin`
- `POST /api/v1/channels/posts/{postId}/reactions`
- `DELETE /api/v1/channels/posts/{postId}/reactions/{reaction}`

## Strict Contract Compatibility Rules

### Admin list payload

Mobile and web must parse the same backend response shape for channel admins.

This must be explicitly agreed.

Allowed options:

1. backend returns:

```json
{ "admins": [...] }
```

2. backend returns:

```json
{ "members": [...] }
```

But both clients must support the chosen format consistently. Ideally both clients should tolerate both shapes during migration.

If web expects `members` and mobile expects `admins`, one client will break.

### Channel search rules

Search behavior must be defined and identical:

- public channels are searchable
- private channels are not searchable unless backend explicitly says otherwise
- search by channel name
- search by username when public
- search results must preserve `is_subscribed` and `my_role`

### Public username rules

For public channels:

- username is required
- username must be validated on client before request
- username must be unique
- allowed charset should be explicitly defined

Recommended validation:

- minimum length: 4
- allowed: `a-z`, `A-Z`, `0-9`, `_`

If product wants lowercase-only usernames, enforce that on both backend and client.

## Required Mobile UX

### 1. Create channel

Mobile must provide a dedicated create channel flow, not a reused group dialog with renamed labels.

Flow:

1. choose `public` or `private`
2. enter channel name
3. optionally enter description
4. if `public`, enter username
5. create channel
6. optionally add subscribers
7. open created channel

Validation:

- name is required
- public username is required for public channels
- invalid username is blocked before request
- backend conflict must show readable error

### 2. Open channel

Mobile must support channel opening by:

1. chat list tap
2. in-app search result
3. direct identifier:
   - channel id
   - `@username`
4. public URL

If only in-app resolution exists but real OS-level public link opening does not work, implementation is incomplete.

### 3. Subscribe / unsubscribe

Rules:

- unsubscribed user sees channel content only if product allows preview
- unsubscribed user must see a clear subscribe CTA
- subscribed subscriber sees posts but no compose UI
- subscribed admin/owner sees compose UI
- unsubscribe must:
  - update local state
  - update profile state
  - update chat list state
  - close or reset active channel if needed

### 4. Channel profile

Channel profile must support:

- avatar
- title
- description
- public link
- username editing for public channels
- admin list
- subscriber list
- member count
- subscribe/unsubscribe
- delete channel for owner

Public/private differences:

- public channel profile shows shareable link
- private channel must not expose a misleading public link

### 5. Member management

Owner/admin management rules must be explicit.

Required capabilities:

- add subscribers
- remove subscribers
- owner can promote subscriber to admin
- owner can demote admin to subscriber
- owner cannot demote self without explicit transfer flow
- admin cannot modify owner

### 6. Posting

Publishing rules:

- owner/admin can publish text post
- owner/admin can publish attachments if backend supports it
- subscriber cannot publish
- unsubscribed user cannot publish

The compose area must be role-aware.

### 7. Post interactions

Minimum interaction support:

- load posts with pagination
- mark as viewed
- react to post
- delete post if allowed

Optional but recommended:

- edit post
- pin/unpin post
- pinned posts screen

If API exists but UI does not expose it, mark it as backlog, not “done”.

## Deep Link Requirements

This is mandatory for correct public channel behavior.

### Supported public link formats

Recommended formats:

- `https://alem.me/@username`
- `https://alem.me/username`
- `https://alem.me/messenger/{channelId}`

Mobile parser may accept all of them, but one canonical format should be chosen for sharing.

### OS-level support

Mobile must support external opening from:

- browser
- messenger app
- notification tap
- copied deep link

Android requirements:

- proper `intent-filter`
- `VIEW`
- `BROWSABLE`
- matching host/path rules

iOS requirements:

- Universal Links or explicit supported deep link scheme

### In-app handling

After app receives a channel link:

1. parse identifier
2. resolve by username or id
3. open messenger screen
4. load channel details
5. show subscribe CTA if not subscribed
6. never silently fail

Error cases:

- channel not found
- no access
- invalid link
- expired/private link if backend uses secure invite links

Each case must have a user-friendly message.

## WebSocket Requirements

Mobile must support channel real-time updates.

Required channel events:

- `channel_created`
- `channel_updated`
- `channel_deleted`
- `new_channel_post`
- `channel_post_edited`
- `channel_post_deleted`

Required behavior:

- channel list preview updates on new post
- active open channel updates immediately
- deleted post disappears or becomes deleted-state depending on product rule
- deleted channel is removed from list
- updated channel metadata refreshes title/avatar/username where visible

WebSocket events must update:

- channel detail screen
- channel preview in list
- unread/last activity state if product uses it

## State Synchronization Rules

Mobile must not treat each screen as isolated.

When a channel changes, these states must stay aligned:

- active channel details
- channel profile bottom sheet
- channel list item
- search results
- route/deep-link identifier state

Examples:

- after subscribe:
  - `is_subscribed = true`
  - member count refreshes
  - list item updates
  - compose permissions recalculate

- after role change:
  - profile updates
  - compose permissions update immediately
  - admin/subscriber tabs update

- after username change:
  - public link changes
  - route resolution keeps working
  - copied share link uses new username

## Pagination Rules

### Posts

Posts must support pagination:

- initial load
- load more
- no duplicate merging
- stable ordering

### Subscribers

Subscriber list must support pagination if channel can exceed 100 members.

Required:

- `limit`
- `offset`
- load more UI
- total count awareness

If mobile always loads only first 100 subscribers, the implementation is not production-ready for large channels.

## Permissions Matrix

| Action | Unsubscribed | Subscriber | Admin | Owner |
|---|---:|---:|---:|---:|
| Open public channel | Yes | Yes | Yes | Yes |
| Open private channel with access | No/Restricted | Yes | Yes | Yes |
| Subscribe | Yes | No | No | No |
| Unsubscribe / leave | No | Yes | Yes | Yes |
| View posts | Product-defined preview / limited | Yes | Yes | Yes |
| Publish post | No | No | Yes | Yes |
| Edit channel info | No | No | Product-defined | Yes |
| Change username | No | No | No | Yes |
| Add subscribers | No | No | Product-defined | Yes |
| Remove subscribers | No | No | Product-defined | Yes |
| Promote to admin | No | No | No | Yes |
| Demote admin | No | No | No | Yes |
| Delete channel | No | No | No | Yes |

If product wants admins to edit metadata or manage subscribers, backend and UI must say so explicitly.

## Error Handling Requirements

Every channel request must map backend errors into readable UI messages.

Minimum handled statuses:

- `400` invalid input
- `401` unauthorized
- `403` forbidden
- `404` not found
- `409` conflict, especially username already taken
- `500` generic server failure

Do not expose raw backend objects directly in UI.

## Offline / Retry Expectations

At minimum:

- failed subscribe shows retryable message
- failed channel open does not blank the screen forever
- failed profile save preserves edited values locally until dismissed
- failed post send restores input or preserves draft

Recommended:

- draft persistence for unsent channel post text
- retry action for failed media upload

## QA Acceptance Checklist

### Creation

- public channel can be created with valid username
- public channel creation fails with invalid username
- public channel creation fails with duplicate username and shows correct error
- private channel can be created without username
- created channel opens immediately after creation

### Discovery and open

- public channel appears in search
- private channel does not appear in public search
- channel opens by id
- channel opens by username
- channel opens by canonical public URL
- invalid channel URL shows correct error

### Subscription

- unsubscribed user sees subscribe CTA
- subscribe updates profile and list state
- unsubscribe removes membership state correctly
- unsubscribed subscriber cannot publish

### Roles

- owner can promote subscriber to admin
- owner can demote admin to subscriber
- owner can remove subscriber
- admin cannot modify owner
- subscriber cannot manage anyone

### Profile

- public link is copied correctly
- username update changes public link
- avatar update refreshes immediately
- member count refreshes after subscribe/unsubscribe/add/remove

### Posts

- admin/owner can create text post
- subscriber cannot create post
- image/file/audio post works if product supports it
- reaction add/remove works
- viewed state updates
- post delete works for allowed role

### Real-time

- new post updates active channel
- new post updates channel list preview
- deleted post disappears or changes state correctly
- updated channel name/avatar refreshes in visible screens

### Large data

- subscriber list supports channels with more than 100 members
- posts pagination does not duplicate items

## Known Anti-Patterns

These are common incorrect implementations and must be avoided:

1. Reusing group logic and only renaming labels to “channel”.
2. Storing `type = public/private` but not changing behavior.
3. Showing roles in UI without actually enforcing permissions.
4. Supporting internal `@username` resolution but not real external deep links.
5. Loading only first 100 subscribers and calling it done.
6. Parsing fragile backend payloads directly inside widgets.
7. Keeping channel details, profile sheet, and channel list out of sync.
8. Treating owner/admin permissions as identical without product decision.
9. Exposing a public link for private channel.
10. Claiming feature completeness when `pin/edit/mute` exist only in datasource and not in UI.

## Recommended Implementation Structure

For Flutter mobile:

- `data/datasources/channels_remote_datasource.dart`
  - only network calls and DTO normalization

- `data/models/channel_models.dart`
  - strongly normalized models

- `presentation/logic/channel_utils.dart`
  - username validation
  - identifier parsing
  - deep-link normalization

- `presentation/pages/channel_detail_page.dart`
  - channel screen

- `presentation/widgets/channel_detail/channel_profile_bottom_sheet.dart`
  - profile and member management

- one dedicated coordinator for:
  - app link resolution
  - navigation into messenger
  - initial channel load by identifier

Deep-link handling must not be hidden only inside messenger widget logic.

## Recommended Additional Work For Mobile

If the current mobile codebase already supports the basics, these should be prioritized next:

1. Finish external deep-link support for `alem.me`.
2. Unify channel admin response parsing with web.
3. Add subscriber pagination in channel profile.
4. Decide and enforce exact admin permissions.
5. Expose edit/pin/pinned-posts only if product really wants them.
6. Add widget/integration tests for full channel flows.
7. Clean all broken text encoding in channel/group UI strings.

## Definition Of Done

Mobile channel implementation can be considered correct only if all of the following are true:

- public/private behavior is actually different
- owner/admin/subscriber permissions are enforced
- channel can be opened from external public link
- profile, list, and detail views stay synchronized
- subscriber management works for large channels
- channel API contracts match web
- websocket updates are reflected correctly
- main channel flows are covered by tests

If any of those points is missing, mobile channels should be treated as partially implemented, not complete.
