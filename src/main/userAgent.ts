import { app } from 'electron'

// What FlickrFetch calls itself when it asks Flickr for something: its real version and its real project page (not the default axios one,
// which Flickr's firewall blocks as an automated tool).
export const USER_AGENT = `FlickrFetch/${app.getVersion()} (Electron desktop app; https://github.com/wallyg/FlickrFetch)`
