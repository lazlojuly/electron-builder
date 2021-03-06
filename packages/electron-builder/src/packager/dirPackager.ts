import { path7za } from "7zip-bin"
import BluebirdPromise from "bluebird-lst"
import { debug7zArgs, log, spawn } from "electron-builder-util"
import { copyDir, DO_NOT_USE_HARD_LINKS, statOrNull } from "electron-builder-util/out/fs"
import { chmod, emptyDir } from "fs-extra-p"
import * as path from "path"
import { Config, ElectronDownloadOptions } from "../metadata"
import { PlatformPackager } from "../platformPackager"

const downloadElectron: (options: any) => Promise<any> = BluebirdPromise.promisify(require("electron-download-tf"))

interface InternalElectronDownloadOptions extends ElectronDownloadOptions {
  version: string
  platform: string
  arch: string
}

function createDownloadOpts(opts: Config, platform: string, arch: string, electronVersion: string): InternalElectronDownloadOptions {
  return Object.assign({
    platform,
    arch,
    version: electronVersion,
  }, opts.electronDownload)
}

/** @internal */
export function unpackElectron(packager: PlatformPackager<any>, out: string, platform: string, arch: string, version: string) {
  return unpack(packager, out, platform, createDownloadOpts(packager.config, platform, arch, version))
}

/** @internal */
export function unpackMuon(packager: PlatformPackager<any>, out: string, platform: string, arch: string, version: string) {
  return unpack(packager, out, platform, Object.assign({
    mirror: "https://github.com/brave/muon/releases/download/v",
    customFilename: `brave-v${version}-${platform}-${arch}.zip`,
    verifyChecksum: false,
  }, createDownloadOpts(packager.config, platform, arch, version)))
}

async function unpack(packager: PlatformPackager<any>, out: string, platform: string, options: InternalElectronDownloadOptions) {
  let dist: string | null | undefined = packager.config.electronDist
  if (dist != null) {
    const zipFile = `electron-v${options.version}-${platform}-${options.arch}.zip`
    const resolvedDist = path.resolve(packager.projectDir, dist)
    if ((await statOrNull(path.join(resolvedDist, zipFile))) != null) {
      options.cache = resolvedDist
      dist = null
    }
  }

  if (dist == null) {
    const zipPath = (await BluebirdPromise.all<any>([
      downloadElectron(options),
      emptyDir(out)
    ]))[0]

    await spawn(path7za, debug7zArgs("x").concat(zipPath, `-o${out}`))
  }
  else {
    const source = packager.getElectronSrcDir(dist)
    const destination = packager.getElectronDestinationDir(out)
    log(`Copying Electron from "${source}" to "${destination}"`)
    await emptyDir(out)
    await copyDir(source, destination, null, null, DO_NOT_USE_HARD_LINKS)
  }

  if (platform === "linux") {
    // https://github.com/electron-userland/electron-builder/issues/786
    // fix dir permissions — opposite to extract-zip, 7za creates dir with no-access for other users, but dir must be readable for non-root users
    await BluebirdPromise.all([
      chmod(path.join(out, "locales"), "0755"),
      chmod(path.join(out, "resources"), "0755")
    ])
  }
}