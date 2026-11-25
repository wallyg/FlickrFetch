# UAT 3.13 (Components)

Built so far (more steps are added as each item is built).

## Shared states and field looks (#232, #237)

One focus ring, one hover and pressed look, one disabled look and one look for text boxes and selects, written once. Visible shifts to look for are listed below.

- [ ] A1 **Keyboard focus.** Click into the app, press Tab repeatedly across a screen (Photostream, Health Check, Settings): every control you land on shows a blue ring, two pixels off its edge, including text boxes and the tab buttons that had no ring before. Clicking with the mouse does not show a ring on buttons.
- [ ] A2 **Hover and pressed.** Point at a grey Secondary button, then at a pink Main button: each gets a little darker under the pointer, a bit more while the mouse is held down, and a pink button stays pink. A select (a drop-down box) also darkens a little. Text-only links and photo tiles are unchanged.
- [ ] A3 **Disabled.** Find a disabled control (for example the Download button with nothing chosen, or Reset when nothing changed): it is half strength and the pointer shows a not-allowed sign. A disabled text box or select is filled light grey.
- [ ] A4 **Checkboxes.** Every tick box and radio button in the app is pink when ticked (Settings, filters, the album box), not blue.
- [ ] A5 **Text boxes and selects match.** In Settings (Health Check numbers, the Tune checks number boxes, the text box for words), Album Checks, Tags, Map and the Audit lists: the boxes share one edge colour (a light grey, a little darker than before on those that used the lighter one), the same corner and the same height inside a row. The box for the Tune checks word list is a standard box too. Anything that looks misaligned?
- [ ] A6 **Reduce motion.** In macOS System Settings > Accessibility > Display, switch on Reduce motion, then open a photo grid while it loads and tick a photo: the shimmer and the pop do not animate. The small spinner in the photo view while a photo is working still turns.
