# Changelog

All notable changes to OC Manager are documented in this file.

## [Unreleased]

### Added
- **Storyboard polygon panels** — panels can be trapezoids / parallelograms (OpenKoma-style corner ratios on the bounding box), with cyan corner handles that slide along the top/bottom edge, shape presets, and slanted (／ ＼), vertical and horizontal split with gutter. Figure clipping, break-the-frame, layers, JSON (rect panels without `shape` stay valid) and PNG/JPG/SVG export all use the polygon.
- **漫画分镜 / Manga storyboard editor** (`/storyboard`) — one-page name/rough storyboard: staggered panel auto-layout from quick specs, red featured centre panel + title box, draggable/resizable dialogue boxes (rectangle narration, speech bubble with draggable tail, thought bubble; vertical right-to-left or horizontal CJK), stick figures with pose presets (standing/pointing/waving/walking/sitting/handshake/hug) and draggable joints, per-box opaque/transparent fill with shapes (rect, rounded, oval speech, cloud, spiky shout, wavy) and optional border, per-figure break-the-frame, layers panel (select/hide/lock/rename/reorder), export menu (PNG/JPG/SVG + JSON document export/import with validation), optional AI draft via the existing AI config. Saved per user alongside other app data (`storyboards`). Model/UX ideas inspired by [OpenKoma](https://github.com/Reuben-Sun/OpenKoma) (Apache-2.0; no code copied).
- **Gallery thumbnails** — uploads keep the original CDN URL and also store a ~720px WebP/JPEG `thumbUrl`; grid loads the thumb, lightbox opens the original. In-UI “为旧图生成缩图” plus `scripts/backfill-gallery-thumbs.mjs` for R2 backfill.
- **Avatar upload compression** — avatars are resized (~512px) before PUT to cut upload size.

## [0.2.0] - 2026-08-13

### Added
- **World partitions** — characters can be organized by world/setting; home page has world filter tabs
- **World-scoped option catalogs** — gender, race, affiliation, and birthplace options are per-world and creatable via combobox
- **Dynamic Preferences** — free-form preference blocks (add/remove/edit titles & content)
- **Image Gallery tab** — Discord CDN (or any URL) image gallery per character, with lightbox
- **AresMoused branding** — logo in navbar/footer, copyright & contact links (email, Discord, Civitai)
- **Avatar URL support** + client-side image compression to avoid localStorage quota issues
- **Draggable radar chart** points for combat style
- **Purple mono combat sliders** (separate from bipolar trait sliders)

### Fixed
- 404 on `/character/[id]` dynamic routes
- localStorage `QuotaExceededError` when saving large base64 avatars
- `logo.ts` PLACEHOLDER runtime error

### Changed
- Character sheet basic info uses searchable OptionSelect / WorldSelect instead of plain text for shared fields
- Gallery moved from inline sheet section to its own tab (alongside Timeline & Relationships)

## [0.1.0] - 2026-08-13

### Added
- Initial release: character CRUD, trait analysis, emotional assessment, combat radar, happiness index, timeline, relationship map, JSON import/export, localStorage persistence
