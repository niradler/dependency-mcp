import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import type { PackageResult, PackageVersionRequest, Registry, RegistryHandler } from './types.js';

export class PackageVersionChecker {
  private registryHandlers: Record<Registry, RegistryHandler>;

  constructor() {
    this.registryHandlers = {
      npm: new NpmHandler(),
      pypi: new PypiHandler(),
      maven: new MavenHandler(),
      nuget: new NugetHandler(),
      rubygems: new RubygemsHandler(),
      crates: new CratesHandler(),
      go: new GoHandler(),
    };
  }

  async getLatestVersion(packageName: string, registry: Registry): Promise<PackageResult> {
    const validatedPackageName = this._validatePackageName(packageName);
    const handler = this.registryHandlers[registry];
    if (!handler) {
      throw new Error(`Unsupported registry: ${registry}`);
    }
    return await handler.getLatestVersion(validatedPackageName);
  }

  async checkVersionExists(packageName: string, version: string, registry: Registry): Promise<PackageResult> {
    const validatedPackageName = this._validatePackageName(packageName);
    const validatedVersion = this._validateVersion(version);
    const handler = this.registryHandlers[registry];
    if (!handler) {
      throw new Error(`Unsupported registry: ${registry}`);
    }
    return await handler.checkVersionExists(validatedPackageName, validatedVersion);
  }

  async getPackageInfo(packageName: string, registry: Registry): Promise<PackageResult> {
    const validatedPackageName = this._validatePackageName(packageName);
    const handler = this.registryHandlers[registry];
    if (!handler) {
      throw new Error(`Unsupported registry: ${registry}`);
    }
    return await handler.getPackageInfo(validatedPackageName);
  }

  async getLatestVersions(packages: string[], registry: Registry): Promise<PackageResult[]> {
    const handler = this.registryHandlers[registry];
    if (!handler) {
      throw new Error(`Unsupported registry: ${registry}`);
    }

    return await this._processBatch(packages, registry, async (packageName: string) => {
      return await handler.getLatestVersion(packageName);
    });
  }

  async checkVersionsExist(packages: PackageVersionRequest[], registry: Registry): Promise<PackageResult[]> {
    const handler = this.registryHandlers[registry];
    if (!handler) {
      throw new Error(`Unsupported registry: ${registry}`);
    }

    return await this._processBatch(packages, registry, async ({ package_name, version }: PackageVersionRequest) => {
      return await handler.checkVersionExists(package_name, version);
    });
  }

  async getPackagesInfo(packages: string[], registry: Registry): Promise<PackageResult[]> {
    const handler = this.registryHandlers[registry];
    if (!handler) {
      throw new Error(`Unsupported registry: ${registry}`);
    }

    return await this._processBatch(packages, registry, async (packageName: string) => {
      return await handler.getPackageInfo(packageName);
    });
  }

  private async _processBatch<T>(
    packages: T[],
    registry: Registry,
    processor: (packageData: T) => Promise<PackageResult>
  ): Promise<PackageResult[]> {
    if (!Array.isArray(packages) || packages.length === 0) {
      throw new Error('Packages must be a non-empty array');
    }

    if (packages.length > 100) {
      throw new Error('Maximum 100 packages allowed per request');
    }

    const results = await Promise.all(
      packages.map(async (packageData) => {
        try {
          return await processor(packageData);
        } catch (error) {
          const packageName = typeof packageData === 'string' ? packageData : (packageData as PackageVersionRequest).package_name;
          return {
            package: packageName,
            registry,
            found: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          };
        }
      })
    );

    return results;
  }

  private _validatePackageName(packageName: string): string {
    if (!packageName || typeof packageName !== 'string') {
      throw new Error('Package name must be a non-empty string');
    }

    if (packageName.length > 500) {
      throw new Error('Package name too long (max 500 characters)');
    }

    return packageName.trim();
  }

  private _validateVersion(version: string): string {
    if (!version || typeof version !== 'string') {
      throw new Error('Version must be a non-empty string');
    }

    if (version.length > 100) {
      throw new Error('Version string too long (max 100 characters)');
    }

    return version.trim();
  }
}

abstract class BaseRegistryHandler implements RegistryHandler {
  protected timeout: number = 10000;
  protected maxRetries: number = 2;
  protected rateLimitDelay: number = 100;
  protected lastRequestTime: number = 0;
  protected axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      timeout: this.timeout,
      headers: {
        'User-Agent': 'dependency-mcp/1.0.0',
        'Accept': 'application/json',
      },
    });
  }

  abstract getLatestVersion(packageName: string): Promise<PackageResult>;
  abstract checkVersionExists(packageName: string, version: string): Promise<PackageResult>;
  abstract getPackageInfo(packageName: string): Promise<PackageResult>;

  protected async makeRequest<T = any>(url: string, options: AxiosRequestConfig = {}): Promise<T | null> {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.rateLimitDelay) {
      await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest));
    }
    this.lastRequestTime = Date.now();

    try {
      const response = await this.axiosInstance.request<T>({
        url,
        ...options,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          return null;
        }
        if (error.response?.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }
        if (error.response?.status && error.response.status >= 500) {
          throw new Error(`Server error: ${error.response.status} ${error.response.statusText}`);
        }
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
          throw new Error('Network error: Unable to reach registry');
        }
        if (error.code === 'ECONNABORTED') {
          throw new Error('Request timeout');
        }
        throw new Error(`HTTP ${error.response?.status}: ${error.response?.statusText || error.message}`);
      }
      throw error;
    }
  }

  protected _createErrorResponse(packageName: string, registry: string, error: { message: string }, additionalData: Partial<PackageResult> = {}): PackageResult {
    return {
      package: packageName,
      registry,
      found: false,
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
      ...additionalData
    };
  }

  protected _createSuccessResponse(packageName: string, registry: string, data: Partial<PackageResult>, additionalData: Partial<PackageResult> = {}): PackageResult {
    return {
      package: packageName,
      registry,
      found: true,
      timestamp: new Date().toISOString(),
      ...data,
      ...additionalData
    };
  }
}

class NpmHandler extends BaseRegistryHandler {
  async getLatestVersion(packageName: string): Promise<PackageResult> {
    const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
    const data = await this.makeRequest<any>(url);

    if (!data) {
      return this._createErrorResponse(packageName, 'npm', { message: 'Package not found' });
    }

    return this._createSuccessResponse(packageName, 'npm', {
      latest_version: data['dist-tags']?.latest,
      description: data.description,
    });
  }

  async checkVersionExists(packageName: string, version: string): Promise<PackageResult> {
    const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
    const data = await this.makeRequest<any>(url);

    if (!data) {
      return this._createErrorResponse(packageName, 'npm', { message: 'Package not found' }, { version });
    }

    const exists = data.versions && data.versions[version] !== undefined;
    return this._createSuccessResponse(packageName, 'npm', {
      version,
      exists,
    });
  }

  async getPackageInfo(packageName: string): Promise<PackageResult> {
    const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
    const data = await this.makeRequest<any>(url);

    if (!data) {
      return this._createErrorResponse(packageName, 'npm', { message: 'Package not found' });
    }

    return this._createSuccessResponse(packageName, 'npm', {
      latest_version: data['dist-tags']?.latest,
      description: data.description,
      versions: Object.keys(data.versions || {}),
      homepage: data.homepage,
      repository: data.repository?.url,
    });
  }
}

class PypiHandler extends BaseRegistryHandler {
  async getLatestVersion(packageName: string): Promise<PackageResult> {
    const url = `https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`;
    const data = await this.makeRequest<any>(url);

    if (!data) {
      return this._createErrorResponse(packageName, 'pypi', { message: 'Package not found' });
    }

    return this._createSuccessResponse(packageName, 'pypi', {
      latest_version: data.info?.version,
      description: data.info?.summary,
    });
  }

  async checkVersionExists(packageName: string, version: string): Promise<PackageResult> {
    const url = `https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`;
    const data = await this.makeRequest<any>(url);

    if (!data) {
      return this._createErrorResponse(packageName, 'pypi', { message: 'Package not found' }, { version });
    }

    const exists = data.releases && data.releases[version] !== undefined;
    return this._createSuccessResponse(packageName, 'pypi', {
      version,
      exists,
    });
  }

  async getPackageInfo(packageName: string): Promise<PackageResult> {
    const url = `https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`;
    const data = await this.makeRequest<any>(url);

    if (!data) {
      return this._createErrorResponse(packageName, 'pypi', { message: 'Package not found' });
    }

    return this._createSuccessResponse(packageName, 'pypi', {
      latest_version: data.info?.version,
      description: data.info?.summary,
      versions: Object.keys(data.releases || {}),
      homepage: data.info?.home_page,
      author: data.info?.author,
    });
  }
}

class MavenHandler extends BaseRegistryHandler {
  constructor() {
    super();
    this.timeout = 20000; // Maven registry can be very slow
    this.maxRetries = 3;
    this.axiosInstance = axios.create({
      timeout: this.timeout,
      headers: {
        'User-Agent': 'dependency-mcp/1.0.0',
        'Accept': 'application/json',
      },
    });
  }

  private async makeRequestWithRetry<T = any>(url: string, options: AxiosRequestConfig = {}): Promise<T | null> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.makeRequest<T>(url, options);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        if (attempt < this.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
        }
      }
    }

    throw lastError;
  }

  async getLatestVersion(packageName: string): Promise<PackageResult> {
    const [groupId, artifactId] = packageName.split(':');
    if (!groupId || !artifactId) {
      return this._createErrorResponse(packageName, 'maven', { message: 'Invalid format. Use groupId:artifactId' });
    }

    const url = `https://search.maven.org/solrsearch/select?q=g:"${groupId}"+AND+a:"${artifactId}"&rows=1&wt=json&core=gav`;
    const data = await this.makeRequestWithRetry<any>(url);

    if (!data || !data.response?.docs?.length) {
      return this._createErrorResponse(packageName, 'maven', { message: 'Package not found' });
    }

    const doc = data.response.docs[0];
    return this._createSuccessResponse(packageName, 'maven', {
      latest_version: doc.latestVersion || doc.v,
      description: `Maven artifact: ${groupId}:${artifactId}`,
    });
  }

  async checkVersionExists(packageName: string, version: string): Promise<PackageResult> {
    const [groupId, artifactId] = packageName.split(':');
    if (!groupId || !artifactId) {
      return this._createErrorResponse(packageName, 'maven', { message: 'Invalid format. Use groupId:artifactId' }, { version });
    }

    const url = `https://search.maven.org/solrsearch/select?q=g:"${groupId}"+AND+a:"${artifactId}"+AND+v:"${version}"&rows=1&wt=json&core=gav`;
    const data = await this.makeRequestWithRetry<any>(url);

    const exists = data && data.response?.docs?.length > 0;
    return this._createSuccessResponse(packageName, 'maven', {
      version,
      exists,
    });
  }

  async getPackageInfo(packageName: string): Promise<PackageResult> {
    const [groupId, artifactId] = packageName.split(':');
    if (!groupId || !artifactId) {
      return this._createErrorResponse(packageName, 'maven', { message: 'Invalid format. Use groupId:artifactId' });
    }

    const url = `https://search.maven.org/solrsearch/select?q=g:"${groupId}"+AND+a:"${artifactId}"&rows=50&wt=json&core=gav`;
    const data = await this.makeRequestWithRetry<any>(url);

    if (!data || !data.response?.docs?.length) {
      return this._createErrorResponse(packageName, 'maven', { message: 'Package not found' });
    }

    const doc = data.response.docs[0];
    return this._createSuccessResponse(packageName, 'maven', {
      latest_version: doc.latestVersion || doc.v,
      description: `Maven artifact: ${groupId}:${artifactId}`,
      versions: data.response.docs.map((d: any) => d.v || d.latestVersion).filter(Boolean),
    });
  }
}

class NugetHandler extends BaseRegistryHandler {
  async getLatestVersion(packageName: string): Promise<PackageResult> {
    const url = `https://api.nuget.org/v3-flatcontainer/${packageName.toLowerCase()}/index.json`;
    const data = await this.makeRequest<any>(url);

    if (!data || !data.versions?.length) {
      return this._createErrorResponse(packageName, 'nuget', { message: 'Package not found' });
    }

    const latestVersion = data.versions[data.versions.length - 1];
    return this._createSuccessResponse(packageName, 'nuget', {
      latest_version: latestVersion,
      description: `NuGet package: ${packageName}`,
    });
  }

  async checkVersionExists(packageName: string, version: string): Promise<PackageResult> {
    const url = `https://api.nuget.org/v3-flatcontainer/${packageName.toLowerCase()}/index.json`;
    const data = await this.makeRequest<any>(url);

    if (!data) {
      return this._createErrorResponse(packageName, 'nuget', { message: 'Package not found' }, { version });
    }

    const exists = data.versions && data.versions.includes(version);
    return this._createSuccessResponse(packageName, 'nuget', {
      version,
      exists,
    });
  }

  async getPackageInfo(packageName: string): Promise<PackageResult> {
    const url = `https://api.nuget.org/v3-flatcontainer/${packageName.toLowerCase()}/index.json`;
    const data = await this.makeRequest<any>(url);

    if (!data || !data.versions?.length) {
      return this._createErrorResponse(packageName, 'nuget', { message: 'Package not found' });
    }

    return this._createSuccessResponse(packageName, 'nuget', {
      latest_version: data.versions[data.versions.length - 1],
      description: `NuGet package: ${packageName}`,
      versions: data.versions,
    });
  }
}

class RubygemsHandler extends BaseRegistryHandler {
  async getLatestVersion(packageName: string): Promise<PackageResult> {
    const url = `https://rubygems.org/api/v1/gems/${encodeURIComponent(packageName)}.json`;
    const data = await this.makeRequest<any>(url);

    if (!data) {
      return this._createErrorResponse(packageName, 'rubygems', { message: 'Package not found' });
    }

    return this._createSuccessResponse(packageName, 'rubygems', {
      latest_version: data.version,
      description: data.info,
    });
  }

  async checkVersionExists(packageName: string, version: string): Promise<PackageResult> {
    const url = `https://rubygems.org/api/v1/versions/${encodeURIComponent(packageName)}.json`;
    const data = await this.makeRequest<any>(url);

    if (!data) {
      return this._createErrorResponse(packageName, 'rubygems', { message: 'Package not found' }, { version });
    }

    const exists = Array.isArray(data) && data.some((v: any) => v.number === version);
    return this._createSuccessResponse(packageName, 'rubygems', {
      version,
      exists,
    });
  }

  async getPackageInfo(packageName: string): Promise<PackageResult> {
    const url = `https://rubygems.org/api/v1/gems/${encodeURIComponent(packageName)}.json`;
    const data = await this.makeRequest<any>(url);

    if (!data) {
      return this._createErrorResponse(packageName, 'rubygems', { message: 'Package not found' });
    }

    const versionsUrl = `https://rubygems.org/api/v1/versions/${encodeURIComponent(packageName)}.json`;
    const versionsData = await this.makeRequest<any>(versionsUrl);

    return this._createSuccessResponse(packageName, 'rubygems', {
      latest_version: data.version,
      description: data.info,
      versions: Array.isArray(versionsData) ? versionsData.map((v: any) => v.number) : [],
      homepage: data.homepage_uri,
    });
  }
}

class CratesHandler extends BaseRegistryHandler {
  async getLatestVersion(packageName: string): Promise<PackageResult> {
    const url = `https://crates.io/api/v1/crates/${encodeURIComponent(packageName)}`;
    const data = await this.makeRequest<any>(url);

    if (!data || !data.crate) {
      return this._createErrorResponse(packageName, 'crates', { message: 'Package not found' });
    }

    return this._createSuccessResponse(packageName, 'crates', {
      latest_version: data.crate.newest_version,
      description: data.crate.description,
    });
  }

  async checkVersionExists(packageName: string, version: string): Promise<PackageResult> {
    const url = `https://crates.io/api/v1/crates/${encodeURIComponent(packageName)}/versions`;
    const data = await this.makeRequest<any>(url);

    if (!data) {
      return this._createErrorResponse(packageName, 'crates', { message: 'Package not found' }, { version });
    }

    const exists = data.versions && data.versions.some((v: any) => v.num === version);
    return this._createSuccessResponse(packageName, 'crates', {
      version,
      exists,
    });
  }

  async getPackageInfo(packageName: string): Promise<PackageResult> {
    const url = `https://crates.io/api/v1/crates/${encodeURIComponent(packageName)}`;
    const data = await this.makeRequest<any>(url);

    if (!data || !data.crate) {
      return this._createErrorResponse(packageName, 'crates', { message: 'Package not found' });
    }

    const versionsUrl = `https://crates.io/api/v1/crates/${encodeURIComponent(packageName)}/versions`;
    const versionsData = await this.makeRequest<any>(versionsUrl);

    return this._createSuccessResponse(packageName, 'crates', {
      latest_version: data.crate.newest_version,
      description: data.crate.description,
      versions: versionsData?.versions?.map((v: any) => v.num) || [],
      homepage: data.crate.homepage,
      repository: data.crate.repository,
    });
  }
}

class GoHandler extends BaseRegistryHandler {
  async getLatestVersion(packageName: string): Promise<PackageResult> {
    const url = `https://proxy.golang.org/${encodeURIComponent(packageName)}/@latest`;
    const data = await this.makeRequest<any>(url);

    if (!data) {
      return this._createErrorResponse(packageName, 'go', { message: 'Package not found' });
    }

    return this._createSuccessResponse(packageName, 'go', {
      latest_version: data.Version,
      description: `Go module: ${packageName}`,
    });
  }

  async checkVersionExists(packageName: string, version: string): Promise<PackageResult> {
    const url = `https://proxy.golang.org/${encodeURIComponent(packageName)}/@v/${encodeURIComponent(version)}.info`;
    const data = await this.makeRequest<any>(url);

    return this._createSuccessResponse(packageName, 'go', {
      version,
      exists: data !== null,
    });
  }

  async getPackageInfo(packageName: string): Promise<PackageResult> {
    const latestUrl = `https://proxy.golang.org/${encodeURIComponent(packageName)}/@latest`;
    const latestData = await this.makeRequest<any>(latestUrl);

    if (!latestData) {
      return this._createErrorResponse(packageName, 'go', { message: 'Package not found' });
    }

    const versionsUrl = `https://proxy.golang.org/${encodeURIComponent(packageName)}/@v/list`;
    let versions: string[] = [];

    try {
      const versionsResponse = await axios.get(versionsUrl, {
        headers: {
          'User-Agent': 'dependency-mcp/1.0.0',
          'Accept': 'text/plain',
        },
        timeout: this.timeout,
      });

      if (versionsResponse.status === 200 && versionsResponse.data) {
        const versionsText = versionsResponse.data;
        if (versionsText && typeof versionsText === 'string') {
          versions = versionsText.trim().split('\n').filter((v: string) => v);
        }
      }
    } catch (error) {
      // If versions fetch fails, continue with empty versions array
    }

    return this._createSuccessResponse(packageName, 'go', {
      latest_version: latestData.Version,
      description: `Go module: ${packageName}`,
      versions,
    });
  }
}
