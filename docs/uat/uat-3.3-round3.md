# FlickrFetch 3.3: round 3 (code review fixes)

Quit FlickrFetch, install the new DMG from `dist/` (same file name), open it. Your tag list and settings carry over.

1. **Old album tag no longer follows you.** Open an album, open a photo, click one of its tags (the album filters to it). Click the **Albums** tab and open a *different* album. It should show all its photos with no tag chip.
2. **Refresh no longer brings the tag back.** Tags tab, pick a tag, **View photos**. Press the circular **Refresh photostream** icon. You should get your normal photostream, no tag chip.
3. **Mixed accent list.** Tags tab: find `athens`, tick **Athens**; find `québec`, tick **Québec**. Leave the switch on **any** and press **View photos**. You should see about 1,320 photos (Athens and Québec together), not about 70.
4. **Accent tags that already worked.** Tick **Honshū** and **Kantō**, any, **View photos**. About 2,100 photos.
5. **Cancelled scan.** Press **Full rescan**, confirm, then press **Cancel** after a few seconds. The tag list should still show sensible numbers. Then press **Refresh**: it should finish in a few seconds.
6. **License wording.** Open a Creative Commons photo. The License line in the panel and the License line from **Copy all metadata** should match.
7. **Still fine:** Cmd+F in the Tags tab, right-click a photo in the grid (Open on Flickr), and a second **Refresh** in the Tags tab (should be quick).

Not changed: the dialog wording pass (#135) and the audit screen.
