// Signs the finished app as a whole bundle. electron-builder skips signing when there is no Developer ID certificate, which leaves only
// the Electron binary's own stamp. macOS then calls a downloaded copy "damaged" instead of the friendlier "cannot verify the developer".
//
// Two ways to sign, picked automatically (#176):
//  1. A certificate you made yourself, once, in Keychain Access (Certificate Assistant > Create a Certificate > type "Code Signing").
//     Every build signed with it carries the same identity, so macOS asks about "FlickrFetch Safe Storage" once and then stops asking
//     after updates. It is used when a certificate with the name below is in your keychain.
//  2. Otherwise "ad hoc" (no certificate). Each build gets its own one-off identity, so macOS asks again after every update.
//
// The certificate name is "FlickrFetch Local Signing", or whatever FLICKRFETCH_SIGN_IDENTITY says. If that variable is set and the
// certificate is missing the build stops, instead of quietly falling back and bringing the prompts back unnoticed.
const { execFileSync } = require('child_process')
const path = require('path')

const DEFAULT_IDENTITY = 'FlickrFetch Local Signing'

function inKeychain(name) {
  try {
    execFileSync('security', ['find-certificate', '-c', name], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)

  const asked = process.env.FLICKRFETCH_SIGN_IDENTITY
  const name = asked || DEFAULT_IDENTITY
  const found = inKeychain(name)
  if (asked && !found) throw new Error(`FLICKRFETCH_SIGN_IDENTITY is "${asked}" but no certificate with that name is in your keychain.`)

  if (found) {
    console.log(`  • signing with your certificate "${name}" (stable identity: macOS asks about the keychain once, not after every update)`)
    execFileSync('codesign', ['--force', '--deep', '--sign', name, app], { stdio: 'inherit' })
  } else {
    console.log(`  • no "${name}" certificate in your keychain: signing ad hoc (macOS will ask about the keychain again after each update, see #176)`)
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' })
  }
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' })
}
