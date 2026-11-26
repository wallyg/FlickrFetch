# Build and install 3.13: steps for the Mac

Do these at your Mac. The checklist to walk afterwards is `docs/uat/uat-3.13.md` (K1 to K27 are the review fixes).

## 1. Before you build

1. Quit FlickrFetch if it is open (and stop `npm run dev` if it is running in a Terminal tab).
2. Back up your data. The new version merges two data folders once and, from now on, keeps each Flickr account's records in its own file, so keep a copy until you are happy. In Terminal:

```bash
cp -R ~/Library/Application\ Support/flickr-fetch ~/Desktop/flickr-fetch-backup
```

```bash
cp -R ~/Library/Application\ Support/FlickrFetch ~/Desktop/FlickrFetch-old-backup
```

(The second one may say "No such file". That is fine: it just means the old folder was already gone.)

## 2. Build

1. Open Terminal in the project folder:

```bash
cd "/Users/wallygobetz/Documents/Flickr Fetch App Build/flickr-fetch"
```

2. Make sure the code is the latest pushed version (this should print nothing):

```bash
git status --short
```

3. Build the installer on your own Mac only:

```bash
npm run build:local
```

**Never run `npm run build`** (without `:local`). That one publishes to GitHub.

What happens: the 344 tests run first (the build stops if any fail), then the old `dist/` and `out/` folders are cleared, then the app is built and packed. It takes a few minutes. A macOS keychain window may pop up: type your Mac password and choose **Always Allow** if offered (that is the prompt that issue #176 would end).

4. Done when you see the new file (its time should be now, not 10:22 this morning, which was the old build):

```bash
ls -la dist/*.dmg
```

It is `dist/FlickrFetch-3.13.0-arm64.dmg`.

## 3. Install

1. Double-click the .dmg and drag FlickrFetch onto Applications, replacing the old one.
2. First open: macOS may say "FlickrFetch" Not Opened (the app is not notarized yet). Click **Done**, then System Settings > Privacy & Security > **Open Anyway**. Or run:

```bash
xattr -cr /Applications/FlickrFetch.app
```

## 4. Test, in this order

1. **K1 and K22 first.** Open the app: you are still signed in, your settings are as you left them, and History, Tags, Health Check and On This Day show what they showed before. Nothing asks you to sign in again. If this fails, stop and tell me before doing anything else.
2. K2 to K21 and K24 to K27 in any order.
3. **K23 last** (needs a second Flickr account): it signs you out. Sign back in as your own account at the end and check your records are back.
4. Write every problem down as you go and send them all at once. I fix everything in one pass and build once (no builds in the middle of testing).

## 5. If something goes wrong

- The app opens but your data looks missing: quit it, then restore the backup:

```bash
rm -rf ~/Library/Application\ Support/flickr-fetch && cp -R ~/Desktop/flickr-fetch-backup ~/Library/Application\ Support/flickr-fetch
```

- The build itself fails: copy the last 20 lines of Terminal output to me.
- You only want a quick look at a screen without installing: `npm run dev` opens the app straight from the code (it uses the same data folder, so your records are there).

## 6. After UAT

1. Send me the feedback. I fix, retest and rebuild once.
2. Release decision: I recommend v3.13.0 as a release (it is a large batch, and it has been several sprints since v3.12). I will ask about running `/code-review ultra` first, as your rules say.
3. On release the 3.13 issues close: #228, #232, #236, #237, #243, #254, #261, #262, #265, #266, #269, #271 and the review fixes and pulled-in items #168, #255 and #273 to #291. #109 and #195 stay open (on hold).
