import { ElectronReleaseServerOptions } from "electron-builder-http/out/publishOptions"
import { isEmptyOrSpaces, log } from "electron-builder-util"
import { ClientRequest } from "http"
import { httpExecutor } from "electron-builder-util/out/nodeHttpExecutor"
import { ElectronReleaseServerClient } from "electron-builder-http/out/electron-release-server"
import { HttpPublisher, PublishContext } from "./publisher"
import { configureRequestOptions } from "electron-builder-http"
import mime from "mime"

export class ElectronReleaseServerPublisher extends HttpPublisher {
  readonly providerName = "ElectronReleaseServer"
  private readonly client: ElectronReleaseServerClient
  private authToken: string

  constructor(context: PublishContext, private info: ElectronReleaseServerOptions,
    private readonly version: string
  ) {
    super(context)

    this.info.username = isEmptyOrSpaces(this.info.username) 
      ? process.env.ELECTRON_RELEASE_SERVER_USERNAME : this.info.username
    this.info.password = isEmptyOrSpaces(this.info.password) 
      ? process.env.ELECTRON_RELEASE_SERVER_PASSWORD : this.info.password
    
    if (isEmptyOrSpaces(this.info.username)) {
      throw new Error(`username is not set, neither programmatically, 
        nor using env "ELECTRON_RELEASE_SERVER_USERNAME"`)
    }
    
    if (isEmptyOrSpaces(this.info.password)) {
      throw new Error(`password is not set, neither programmatically, 
        nor using env "ELECTRON_RELEASE_SERVER_PASSWORD"`)
    }
    
    this.client = new ElectronReleaseServerClient(this.info, httpExecutor)
  }
  
  protected async doUpload(fileName: string, dataLength: number, 
    requestProcessor: (request: ClientRequest, reject: (error: Error) => void) => void) {
    
    this.authToken = await this.client.authenticate()
    
    if (this.authToken) {
      const versions = await this.getVersions()
      
      const existingVersion = versions.find((version:any) => 
        version.name === this.version)
      
      if (!existingVersion) {
        await this.createVersion(this.version)
      }
      
      try {
        return await httpExecutor.doApiRequest<any>(configureRequestOptions({
          hostname: this.info.url,
          path: `/api/asset/`,
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.authToken}`,
            Accept: "application/json",
            "Content-Type": mime.lookup(fileName),
            "Content-Length": dataLength
          }
        }), this.context.cancellationToken, requestProcessor)
      }
      catch(e) {
        log(e.toString())
        throw new Error(`Could not upload asset`)
      }
    }
    
    return Promise.resolve('hello')
  }
  
  // todo
  // private getPlatform() {
  //   const ersPlatform = (platform, arch) => {
  //     switch (platform) {
  //       case 'darwin':
  //         return 'osx_64';
  //       case 'linux':
  //         return arch === 'ia32' ? 'linux_32' : 'linux_64';
  //       case 'win32':
  //         return arch === 'ia32' ? 'windows_32' : 'windows_64';
  //       default:
  //         return platform;
  //     }
  //   };
  // }
  
  private async getVersions() {
    try {
      return await httpExecutor.request<any>(configureRequestOptions({
        hostname: this.info.url,
        path: `/api/version/`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.authToken}`
        }
      }), this.context.cancellationToken)
    }
    catch(e) {
      log(e.toString())
      throw new Error(`Could not get versions`)
    }
  }
  
  private async createVersion(version:string) {
    log(`creating new ver`)
    try {
      return await httpExecutor.request<any>(configureRequestOptions({
        hostname: this.info.url,
        path: `/api/version/`,
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.authToken}`
        }
      }), this.context.cancellationToken, {
        channel: {
          name: this.getChannel(version)
        },
        name: version,
        notes: ''
      })
    }
    catch(e) {
      log(e.toString())
      throw new Error(`Could not create version`)
    }
  }
  
  private getChannel(targetVersion:string) {
    let channel = 'stable';
    if (targetVersion.indexOf('beta') !== -1) {
      channel = 'beta';
    }
    if (targetVersion.indexOf('alpha') !== -1) {
      channel = 'alpha';
    }
    return channel  
  }
  
  toString() {
    return `ElectronReleaseServer package to string - TODO`
  }
}