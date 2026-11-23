// Signs the finished app "ad-hoc" (no Apple certificate) as a whole bundle. electron-builder skips signing when there is no
// Developer ID certificate, which leaves only the Electron binary's own stamp. macOS then calls a downloaded copy "damaged"
// instead of the friendlier "cannot verify the developer". A complete ad-hoc seal is the cheap step until real signing (#29).
const { execFileSync } = require('child_process')
const path = require('path')

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' })
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' })
}
