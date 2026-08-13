# Changelog

All notable changes to OC Manager are documented in this file.

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
