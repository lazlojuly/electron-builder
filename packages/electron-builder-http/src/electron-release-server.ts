import { CancellationToken } from "./CancellationToken"
import { configureRequestOptions, HttpExecutor } from "./httpExecutor"
import { ElectronReleaseServerOptions } from "./publishOptions"

export class ElectronReleaseServerClient {
  readonly token: string
  
  constructor(private options: ElectronReleaseServerOptions, 
    private readonly httpExecutor: HttpExecutor<any>) {
  }
  
  async authenticate() {
    try {
      const { token }: any = await this.httpExecutor.request(
        configureRequestOptions({
          hostname: this.options.url,
          protocol: 'https:',
          path: '/api/auth/login'
        }, null, 'POST'),
        new CancellationToken(),
        {
          username: this.options.username,
          password: this.options.password
        }
      )
      return token
    }
    catch(e) {
      throw new Error(`Could not authenticate with Electron Release Server`)
    }
    
  }
}