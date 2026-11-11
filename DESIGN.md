---
name: jatoGifs
description: Compact Spanish GIF selection for GitHub conversation editors.
colors:
  surface: "#fff"
  subtle: "#f6f8fa"
  ink: "#1f2328"
  muted: "#59636e"
  line: "#d1d9e0"
  accent: "#0969da"
  selected: "#ddf4ff"
  focus: "#0969da"
  danger: "#b42318"
  surface-dark: "#161b22"
  subtle-dark: "#21262d"
  ink-dark: "#f0f6fc"
  muted-dark: "#b1bac4"
  line-dark: "#3d444d"
  accent-dark: "#79c0ff"
  selected-dark: "#18364d"
  focus-dark: "#79c0ff"
  danger-dark: "#ffb4a9"
  save: "#1f883d"
  save-hover: "#1a7f37"
  attribution: "#121212"
  status: "#24292f"
typography:
  body:
    fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'
    fontSize: "14px"
    lineHeight: 1.5
  title:
    fontSize: "21px"
    lineHeight: 1.2
    letterSpacing: "-.025em"
  settings-title:
    fontSize: "28px"
    lineHeight: 1.2
    letterSpacing: "-.025em"
  section-title:
    fontSize: "17px"
  button:
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.5
  label:
    fontSize: "12px"
  caption:
    fontSize: "11px"
  collection-field:
    fontSize: "13px"
  code:
    fontFamily: "ui-monospace,SFMono-Regular,Consolas,monospace"
    fontSize: "12px"
rounded:
  attribution: "2px"
  code: "3px"
  control: "6px"
  status: "8px"
  picker: "12px"
spacing:
  caption: "3px 5px"
  control: "7px 12px"
  field: "10px 12px"
  notice: "12px 14px"
  grid-gap: "8px"
  main: "12px"
  header: "16px 18px 13px"
  footer: "10px 16px"
components:
  button-secondary:
    backgroundColor: "{colors.subtle}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "{spacing.control}"
  button-secondary-hover:
    backgroundColor: "{colors.selected}"
  button-primary:
    backgroundColor: "{colors.save}"
    textColor: "{colors.surface}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "{spacing.control}"
  button-primary-hover:
    backgroundColor: "{colors.save-hover}"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    padding: "2px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "{spacing.field}"
    width: "100%"
  textarea-collection:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.collection-field}"
    rounded: "{rounded.control}"
    padding: "{spacing.field}"
    width: "100%"
  gif-tile:
    backgroundColor: "{colors.subtle}"
    rounded: "{rounded.control}"
    padding: "0"
    height: "110px"
  notice:
    backgroundColor: "{colors.subtle}"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "{spacing.notice}"
---

# Design System: jatoGifs

## Overview

The approved direction is a compact, Spanish, GitHub-native interface. System typography, familiar blue accents and light/dark surfaces keep attention on choosing a GIF and returning to the conversation editor. This document records the implemented extension rather than proposing a new visual identity.

The gallery is dense and practical. GIF imagery supplies the visual variety; framing, labels and controls remain restrained. Settings and privacy reuse the same palette and type system in a wider reading layout.

**Key Characteristics:**
- Compact Spanish controls and status copy.
- System fonts and GitHub-compatible light/dark themes.
- Three-column GIF gallery with a narrow-width fallback.
- Visible keyboard focus, selection outlines and attribution.

## Colors

The primary accent is GitHub blue: links, the “Gifs” wordmark segment, caret and focus use the accent/focus pair. Light and dark token pairs are specified in the frontmatter; CSS switches them through the same semantic custom properties.

### Primary

- **GitHub Blue:** the light accent and focus color.
- **Light GitHub Blue:** the dark-theme accent and focus color.
- **Selection Blue:** the light/dark selected surfaces for hover and text selection.

### Secondary

- **Save Green:** the implemented settings save action, with a darker hover variant. This is a specific action variant; blue remains the interface accent.

### Neutral

- **Surface / Subtle:** main canvas and secondary control or notice surfaces.
- **Ink / Muted:** main content and supporting text.
- **Line:** borders, dividers and scrollbar thumb.
- **Attribution Black:** background behind the official attribution asset.
- **Status Charcoal:** background of the temporary GitHub-page status message.
- **White:** save-button text, GIF captions and status-message text remain white in both themes.

Error results use the light/dark danger pair. The caption uses the dark surface color as its fixed background in both themes.

## Typography

The base stack is the operating system UI stack, defined under `typography.body`. Buttons, inputs and textareas inherit it; the collection textarea overrides the inherited size with the collection-field role. The picker title is the compact title role; settings and privacy use the larger settings-title role. Both share tight title tracking and line height. Section headings use section-title; header links and text actions use label; captions and the keyboard hint use caption.

Buttons and field labels use semibold weight (600). Heading weight is the browser's native heading default; it is not replaced by a custom heading weight in the stylesheet. Inline commands and keys use the code role. Supporting settings paragraphs cap at (65ch).

## Layout

The picker is a viewport-height flex column: fixed header, scrolling main gallery and fixed footer. Header and footer use thin divider borders. The gallery has three equal columns with the grid-gap token; at a maximum viewport width of (340px), it becomes two columns and hides the visual keyboard hint. The GIF tiles have fixed height, with images cropped using `object-fit: cover`.

The embedded picker frame is positioned near the active editor. Its width is `max(180px, min(416px, viewport width − 24px))`; its height is `max(160px, min(456px, viewport height − 24px))`. It prefers placement below the editor when space permits, with a (6px) gap, and otherwise positions above. Placement is clamped with a (12px) viewport inset.

Settings and privacy share a centered container with maximum width (660px), vertical margin (40px), horizontal padding (24px) and bottom padding (32px). The settings container has minimum width (320px), and its body has minimum width (360px). Action rows wrap, using the gallery gap. Footer items also wrap, with (6px) gaps.

## Elevation & Depth

The embedded picker supplies the single raised surface. Its shadow is `0 8px 32px rgba(0,0,0,.22)`. Inside, tonal surfaces and (1px) borders divide content; GIF tiles have no individual shadow. The temporary page status message is a flat, fixed dark surface.

The implementation defines no animated transitions. Caption visibility changes directly on hover, keyboard focus or image failure. Reduced-motion preference forces automatic scrolling behavior.

## Shapes

Controls, fields, notices and GIF tiles use the control radius. The outer picker uses the larger picker radius; temporary status uses status; inline code and attribution use their smaller dedicated radii. GIF imagery and captions clip within the tile. Controls and fields use a (1px) semantic line border; the picker frame and GIF tiles have no border.

## Components

### Buttons

Secondary buttons use subtle surface, ink text and a line border. Hover uses the selected surface. The “Guardar colección” action uses Save Green and white text, including in dark mode. “Comprobar GIF” and “Guardar clave” use the secondary variant. Disabled buttons retain their layout and reduce opacity to (.65), with a waiting cursor.

The close button is transparent and borderless with (7px) padding and the implemented (20px) inline cross icon. The settings text action is a compact borderless accent control; both transparent variants retain the shared selected-surface hover behavior.

### Inputs / Fields

The full-width settings field uses the surface, ink, line border and control radius. Its caret uses the accent. Labels are block-level semibold text with margin (22px 0 7px). Error status text uses danger. The API-key and collection result regions each keep a minimum height of (24px), use ink normally and danger for errors, and announce updates through polite live status.

### Manual Collection

In version 1.1.0, “Tu colección” precedes API-key settings. Its full-width textarea accepts one GIPHY page URL or ID per line, has eight initial rows, maximum length (40000), minimum height (150px), vertical resizing and overflow wrapping. It reuses the field surface, border, radius, padding, caret and focus treatment; only its type size is reduced to the collection-field role. The semibold label “Enlaces o ID de tus GIF” and linked help text explain the (100 GIF) limit. “Guardar colección” and “Comprobar GIF” share the existing wrapping action row, followed by the collection result region. No palette, layout or elevation changes accompany this control.

### GIF Gallery

A tile is a native button with zero padding, a clipped image and the gif-tile dimensions. Selection and keyboard focus each receive a (3px) focus-color outline at (1px) offset. The caption overlays the lower edge, truncates to one line and becomes visible on hover, keyboard focus or image failure. Captions have a fixed dark background and white text.

Arrow keys choose a GIF; Enter inserts it and Escape dismisses the picker. Selection and loading feedback also use polite live status regions. General focus-visible treatment is a (2px) focus-color outline with (3px) offset.

### Header / Footer

The wordmark highlights only “Gifs” in the accent color. The channel link is compact and underlines on hover. The footer displays the official Powered by GIPHY asset at (150px × 20px), the settings action and the keyboard hint. Keep the attribution legible and visible.

### Notices / Inline Code

Notices use a subtle surface and control radius. Commands and key names use a muted, compact monospace treatment with padding (2px 4px). Status messages use muted text, centered alignment, padding (24px 12px) and overflow wrapping.

## Do's and Don'ts

### Do:
- **Do** preserve the compact Spanish interface and exact jatoGifs name.
- **Do** apply light/dark values through the existing semantic surface, ink, line, accent and focus roles.
- **Do** keep keyboard focus and selection clearly visible and maintain live status announcements.
- **Do** preserve the official GIPHY attribution and the channel link.
- **Do** use the existing system font and restrained outer-picker shadow.

### Don't:
- **Don't** add a new palette, font, decorative motif or animation while extending this documented interface.
- **Don't** remove the narrow-width grid fallback or replace cropped GIF tiles with a different gallery model without a new approved direction.
- **Don't** hide captions from keyboard focus or remove the visible focus treatment.
- **Don't** treat a GIF choice as permission to submit the user's GitHub comment.
