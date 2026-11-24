# Demand-test post (DRAFT — do not commit; this repo is public)

Where to post: Flickr Help Forum, relevant Flickr groups, r/flickr.
Before posting anywhere: read that venue's self-promotion rules. Some ban it outright; others want you to be an active member first, or to flag it clearly as your own project.

The goal isn't downloads. It's replies. A reply that says "I'd use this" or "is it signed?" is the signal. A download alone is not.

---

## Main version (forum or group)

**Title:** I built a Mac app to back up your Flickr library with the metadata still attached. Would you use it?

I've had photos on Flickr for years, and I got uneasy about how much of it only exists on Flickr's servers. The pictures are easy to download. The titles, descriptions, tags, dates, locations and licenses are not. They stay behind.

So I built **FlickrFetch**, a Mac app that:

- downloads your photos and videos, at original resolution on Pro accounts and CC-licensed photos (Flickr limits free accounts to smaller sizes)
- writes your titles, descriptions, tags, dates, GPS and license into the files themselves (EXIF, IPTC and XMP), so they work in any photo library
- downloads whole albums and collections, keeps a history, and skips what you already have
- asks Flickr for read-only access, so it can't change or delete anything, and keeps everything on your Mac

It's free for now, and the source is public: https://github.com/wallyg/FlickrFetch

I'm a product manager, not a developer. I designed and tested it, and wrote the code with Claude Code.

Being upfront about the rough edges: it's Apple Silicon Macs only for now, it isn't code-signed yet (so macOS will make you click "Open Anyway" once), and there's no Windows version.

I'm trying to work out whether this is useful to anyone beyond me, so I'd really value honest answers:

1. How do you back up your Flickr photos today, if at all?
2. Would you use something like this? If not, what's missing?
3. Is the unsigned warning a dealbreaker for you?

Thanks for reading — Wally

---

## Short version (r/flickr, or anywhere with a tight format)

I made a Mac app (free for now) that downloads your Flickr library with titles, tags, dates, GPS and license embedded in the files (originals on Pro and CC photos; Flickr limits free accounts to smaller sizes). Read-only access, everything stays on your Mac, and the source is public: https://github.com/wallyg/FlickrFetch

It's Apple Silicon only and unsigned for now. Is this something you'd use, and what would make it more useful?

---

## What to watch for in replies

| You hear | What it means |
|---|---|
| "Is it signed?" / "I'd try it if it didn't warn me" | Signing (#29) is worth the $99 |
| "Is there a Windows or Intel version?" | A platform question, not a feature one. Note how many ask |
| "I back up with Flickr's export / another tool" | Learn what that tool fails at |
| "Can it keep my albums in sync?" | Sync demand, which you're not ready for yet. Count it |
| Silence | Also an answer, but give it two weeks before concluding anything |

## Before posting, check

- [x] Wording is "free for now", which keeps your options open.
- [ ] If you ever charge: I believe Flickr issues non-commercial and commercial API keys, and a paid tier would likely need the commercial kind. I haven't checked which one you hold.
- [x] README says originals are for Pro and CC photos, and that it's only been tested on a Pro account.
- [ ] README is merged and the release page looks right. (The hero image, assets/brand/social-preview.png, still says "original resolution".)
- [ ] You've installed the DMG on a clean setup, or a friend has, so the install steps are true.
- [ ] You're ready to answer replies for a couple of weeks.
