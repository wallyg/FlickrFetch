# FlickrFetch 3.3: round 2 (fixes from your testing)

Quit FlickrFetch, install the new DMG from `dist/` (same file name as before), and open it. Your tag list and settings carry over.

1. **Scan screen wording.** To see it, clear the tag list first (Settings does not do this yet; tell me and I'll clear it again). The "Build your tag list" screen should now explain Refresh and Full rescan in a second paragraph.
2. **Search inside a letter.** In the Tags tab press **S**, then type `york` in the find box. The list should show only tags starting with S that contain "york". The line above the list says "…within the chosen letter". Clear the text and the S list comes back. Picking a different letter keeps your typed text.
3. **Spellings on hover.** Hover a yellow "5 spellings" badge next to "New York". A small list of the five ways it was typed appears. (Flickr doesn't say how often each is used, so there are no counts.)
4. **Back to Tags.** Tick two tags, press **View photos**. Next to the tag chip in the Photostream there is a blue **← Back to Tags** link. Press it: you return to the Tags tab with your selection intact.
5. **Re-check the blank "Any" result.** Tick `Athena` and `Panathenaic`, leave the switch on **any**, press **View photos**. You should see 33 photos. If you ever get zero again, tell me the exact tags and what the switch said.

Not changed in this round: the album filters staying on in the next album (#134), the remaining dialog wording (#135), and the audit screen (designed, not built).
