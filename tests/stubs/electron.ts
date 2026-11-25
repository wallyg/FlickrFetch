// A stand-in for Electron's own module, so app code that asks for the user data folder or registers a handler can be loaded in a test.
// The "user data" folder is a fresh empty folder in the system's temporary files, so a test can open the app's real database code and
// settings file without ever touching your own library.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const userData = mkdtempSync(join(tmpdir(), 'flickrfetch-tests-'))
export const app = { getPath: (): string => userData, getVersion: (): string => '0.0.0', isPackaged: false, on: (): void => {} }
export const ipcMain = { handle: (): void => {}, on: (): void => {} }
export const safeStorage = { isEncryptionAvailable: (): boolean => false }
export const shell = { openExternal: async (): Promise<void> => {} }
export const dialog = {}
export const clipboard = { writeText: (): void => {} }
export const BrowserWindow = class {}
export const Notification = class { static isSupported(): boolean { return false }; show(): void {}; on(): void {} }
export default { app, ipcMain, safeStorage, shell, dialog, clipboard, BrowserWindow, Notification }
