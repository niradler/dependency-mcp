import fetch from "node-fetch";

export class PackageVersionChecker {
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

  async getLatestVersion(packageName, registry) {
    const validatedPackageName = this._validatePackageName(packageName);
    const handler = this.registryHandlers[registry];
    if (!handler) {
      throw new Error(`Unsupported registry: ${registry}`);
    }
    return await handler.getLatestVersion(validatedPackageName);
  }

  async checkVersionExists(packageName, version, registry) {
    const validatedPackageName = this._validatePackageName(packageName);
    const validatedVersion = this._validateVersion(version);
    const handler = this.registryHandlers[registry];
    if (!handler) {
      throw new Error(`Unsupported registry: ${registry}`);
    }
    return await handler.checkVersionExists(validatedPackageName, validatedVersion);
  }

  async getPackageInfo(packageName, registry) {
    const validatedPackageName = this._validatePackageName(packageName);
    const handler = this.registryHandlers[registry];
    if (!handler) {
      throw new Error(`Unsupported registry: ${registry}`);
    }
    return await handler.getPackageInfo(validatedPackageName);
  }

  async getLatestVersions(packages, registry) {
    const handler = this.registryHandlers[registry];
    if (!handler) {
      throw new Error(`Unsupported registry: ${registry}`);
    }

    return await this._processBatch(packages, registry, async (packageName) => {
      return await handler.getLatestVersion(packageName);
    });
  }

  async checkVersionsExist(packages, registry) {
    const handler = this.registryHandlers[registry];
    if (!handler) {
      throw new Error(`Unsupported registry: ${registry}`);
    }

    return await this._processBatch(packages, registry, async ({ package_name, version }) => {
      return await handler.checkVersionExists(package_name, version);
    });
  }

  async getPackagesInfo(packages, registry) {
    const handler = this.registryHandlers[registry];
    if (!handler) {
      throw new Error(`Unsupported registry: ${registry}`);
    }

    return await this._processBatch(packages, registry, async (packageName) => {
      return await handler.getPackageInfo(packageName);
    });
  }

  async _processBatch(packages, registry, processor) {
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
          const packageName = typeof packageData === 'string' ? packageData : packageData.package_name;
          return {
            package: packageName,
            registry,
            found: false,
            error: error.message,
            timestamp: new Date().toISOString()
          };
        }
      })
    );

    return results;
  }

  _validatePackageName(packageName) {
    if (!packageName || typeof packageName !== 'string') {
      throw new Error('Package name must be a non-empty string');
    }

    if (packageName.length > 500) {
      throw new Error('Package name too long (max 500 characters)');
    }

    return packageName.trim();
  }

  _validateVersion(version) {
    if (!version || typeof version !== 'string') {
      throw new Error('Version must be a non-empty string');
    }

    if (version.length > 100) {
      throw new Error('Version string too long (max 100 characters)');
    }

    return version.trim();
  }
}

class BaseRegistryHandler {
  constructor() {
    this.timeout = 10000;
    this.maxRetries = 2;
    this.rateLimitDelay = 100;
    this.lastRequestTime = 0;
  }

  async makeRequest(url, options = {}) {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.rateLimitDelay) {
      await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest));
    }
    this.lastRequestTime = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'dependency-mcp/1.0.0',
          'Accept': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
        ...options,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }
        if (response.status >= 500) {
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }

      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new Error('Network error: Unable to reach registry');
      }

      throw error;
    }
  }

  _createErrorResponse(packageName, registry, error, additionalData = {}) {
    return {
      package: packageName,
      registry,
      found: false,
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
      ...additionalData
    };
  }

  _createSuccessResponse(packageName, registry, data, additionalData = {}) {
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
  async getLatestVersion(packageName) {
    const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
    const data = await this.makeRequest(url);

    if (!data) {
      return this._createErrorResponse(packageName, 'npm', { message: 'Package not found' });
    }

    return this._createSuccessResponse(packageName, 'npm', {
      latest_version: data['dist-tags']?.latest,
      description: data.description,
    });
  }

  async checkVersionExists(packageName, version) {
    const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
    const data = await this.makeRequest(url);

    if (!data) {
      return this._createErrorResponse(packageName, 'npm', { message: 'Package not found' }, { version });
    }

    const exists = data.versions && data.versions[version] !== undefined;
    return this._createSuccessResponse(packageName, 'npm', {
      version,
      exists,
    });
  }

  async getPackageInfo(packageName) {
    const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
    const data = await this.makeRequest(url);

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
  async getLatestVersion(packageName) {
    const url = `https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`;
    const data = await this.makeRequest(url);

    if (!data) {
      return this._createErrorResponse(packageName, 'pypi', { message: 'Package not found' });
    }

    return this._createSuccessResponse(packageName, 'pypi', {
      latest_version: data.info?.version,
      description: data.info?.summary,
    });
  }

  async checkVersionExists(packageName, version) {
    const url = `https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`;
    const data = await this.makeRequest(url);

    if (!data) {
      return this._createErrorResponse(packageName, 'pypi', { message: 'Package not found' }, { version });
    }

    const exists = data.releases && data.releases[version] !== undefined;
    return this._createSuccessResponse(packageName, 'pypi', {
      version,
      exists,
    });
  }

  async getPackageInfo(packageName) {
    const url = `https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`;
    const data = await this.makeRequest(url);

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
  }

  async makeRequestWithRetry(url, options = {}) {
    let lastError;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.makeRequest(url, options);
      } catch (error) {
        lastError = error;
        if (attempt < this.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
        }
      }
    }

    throw lastError;
  }

  async getLatestVersion(packageName) {
    const [groupId, artifactId] = packageName.split(':');
    if (!groupId || !artifactId) {
      return this._createErrorResponse(packageName, 'maven', { message: 'Invalid format. Use groupId:artifactId' });
    }

    const url = `https://search.maven.org/solrsearch/select?q=g:"${groupId}"+AND+a:"${artifactId}"&rows=1&wt=json&core=gav`;
    const data = await this.makeRequestWithRetry(url);

    if (!data || !data.response?.docs?.length) {
      return this._createErrorResponse(packageName, 'maven', { message: 'Package not found' });
    }

    const doc = data.response.docs[0];
    return this._createSuccessResponse(packageName, 'maven', {
      latest_version: doc.latestVersion || doc.v,
      description: `Maven artifact: ${groupId}:${artifactId}`,
    });
  }

  async checkVersionExists(packageName, version) {
    const [groupId, artifactId] = packageName.split(':');
    if (!groupId || !artifactId) {
      return this._createErrorResponse(packageName, 'maven', { message: 'Invalid format. Use groupId:artifactId' }, { version });
    }

    const url = `https://search.maven.org/solrsearch/select?q=g:"${groupId}"+AND+a:"${artifactId}"+AND+v:"${version}"&rows=1&wt=json&core=gav`;
    const data = await this.makeRequestWithRetry(url);

    const exists = data && data.response?.docs?.length > 0;
    return this._createSuccessResponse(packageName, 'maven', {
      version,
      exists,
    });
  }

  async getPackageInfo(packageName) {
    const [groupId, artifactId] = packageName.split(':');
    if (!groupId || !artifactId) {
      return this._createErrorResponse(packageName, 'maven', { message: 'Invalid format. Use groupId:artifactId' });
    }

    const url = `https://search.maven.org/solrsearch/select?q=g:"${groupId}"+AND+a:"${artifactId}"&rows=50&wt=json&core=gav`;
    const data = await this.makeRequestWithRetry(url);

    if (!data || !data.response?.docs?.length) {
      return this._createErrorResponse(packageName, 'maven', { message: 'Package not found' });
    }

    const doc = data.response.docs[0];
    return this._createSuccessResponse(packageName, 'maven', {
      latest_version: doc.latestVersion || doc.v,
      description: `Maven artifact: ${groupId}:${artifactId}`,
      versions: data.response.docs.map(d => d.v || d.latestVersion).filter(Boolean),
    });
  }
}

class NugetHandler extends BaseRegistryHandler {
  async getLatestVersion(packageName) {
    const url = `https://api.nuget.org/v3-flatcontainer/${packageName.toLowerCase()}/index.json`;
    const data = await this.makeRequest(url);

    if (!data || !data.versions?.length) {
      return this._createErrorResponse(packageName, 'nuget', { message: 'Package not found' });
    }

    const latestVersion = data.versions[data.versions.length - 1];
    return this._createSuccessResponse(packageName, 'nuget', {
      latest_version: latestVersion,
      description: `NuGet package: ${packageName}`,
    });
  }

  async checkVersionExists(packageName, version) {
    const url = `https://api.nuget.org/v3-flatcontainer/${packageName.toLowerCase()}/index.json`;
    const data = await this.makeRequest(url);

    if (!data) {
      return this._createErrorResponse(packageName, 'nuget', { message: 'Package not found' }, { version });
    }

    const exists = data.versions && data.versions.includes(version);
    return this._createSuccessResponse(packageName, 'nuget', {
      version,
      exists,
    });
  }

  async getPackageInfo(packageName) {
    const url = `https://api.nuget.org/v3-flatcontainer/${packageName.toLowerCase()}/index.json`;
    const data = await this.makeRequest(url);

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
  async getLatestVersion(packageName) {
    const url = `https://rubygems.org/api/v1/gems/${encodeURIComponent(packageName)}.json`;
    const data = await this.makeRequest(url);

    if (!data) {
      return this._createErrorResponse(packageName, 'rubygems', { message: 'Package not found' });
    }

    return this._createSuccessResponse(packageName, 'rubygems', {
      latest_version: data.version,
      description: data.info,
    });
  }

  async checkVersionExists(packageName, version) {
    const url = `https://rubygems.org/api/v1/versions/${encodeURIComponent(packageName)}.json`;
    const data = await this.makeRequest(url);

    if (!data) {
      return this._createErrorResponse(packageName, 'rubygems', { message: 'Package not found' }, { version });
    }

    const exists = Array.isArray(data) && data.some(v => v.number === version);
    return this._createSuccessResponse(packageName, 'rubygems', {
      version,
      exists,
    });
  }

  async getPackageInfo(packageName) {
    const url = `https://rubygems.org/api/v1/gems/${encodeURIComponent(packageName)}.json`;
    const data = await this.makeRequest(url);

    if (!data) {
      return this._createErrorResponse(packageName, 'rubygems', { message: 'Package not found' });
    }

    const versionsUrl = `https://rubygems.org/api/v1/versions/${encodeURIComponent(packageName)}.json`;
    const versionsData = await this.makeRequest(versionsUrl);

    return this._createSuccessResponse(packageName, 'rubygems', {
      latest_version: data.version,
      description: data.info,
      versions: Array.isArray(versionsData) ? versionsData.map(v => v.number) : [],
      homepage: data.homepage_uri,
    });
  }
}

class CratesHandler extends BaseRegistryHandler {
  async getLatestVersion(packageName) {
    const url = `https://crates.io/api/v1/crates/${encodeURIComponent(packageName)}`;
    const data = await this.makeRequest(url);

    if (!data || !data.crate) {
      return this._createErrorResponse(packageName, 'crates', { message: 'Package not found' });
    }

    return this._createSuccessResponse(packageName, 'crates', {
      latest_version: data.crate.newest_version,
      description: data.crate.description,
    });
  }

  async checkVersionExists(packageName, version) {
    const url = `https://crates.io/api/v1/crates/${encodeURIComponent(packageName)}/versions`;
    const data = await this.makeRequest(url);

    if (!data) {
      return this._createErrorResponse(packageName, 'crates', { message: 'Package not found' }, { version });
    }

    const exists = data.versions && data.versions.some(v => v.num === version);
    return this._createSuccessResponse(packageName, 'crates', {
      version,
      exists,
    });
  }

  async getPackageInfo(packageName) {
    const url = `https://crates.io/api/v1/crates/${encodeURIComponent(packageName)}`;
    const data = await this.makeRequest(url);

    if (!data || !data.crate) {
      return this._createErrorResponse(packageName, 'crates', { message: 'Package not found' });
    }

    const versionsUrl = `https://crates.io/api/v1/crates/${encodeURIComponent(packageName)}/versions`;
    const versionsData = await this.makeRequest(versionsUrl);

    return this._createSuccessResponse(packageName, 'crates', {
      latest_version: data.crate.newest_version,
      description: data.crate.description,
      versions: versionsData?.versions?.map(v => v.num) || [],
      homepage: data.crate.homepage,
      repository: data.crate.repository,
    });
  }
}

class GoHandler extends BaseRegistryHandler {
  async getLatestVersion(packageName) {
    const url = `https://proxy.golang.org/${encodeURIComponent(packageName)}/@latest`;
    const data = await this.makeRequest(url);

    if (!data) {
      return this._createErrorResponse(packageName, 'go', { message: 'Package not found' });
    }

    return this._createSuccessResponse(packageName, 'go', {
      latest_version: data.Version,
      description: `Go module: ${packageName}`,
    });
  }

  async checkVersionExists(packageName, version) {
    const url = `https://proxy.golang.org/${encodeURIComponent(packageName)}/@v/${encodeURIComponent(version)}.info`;
    const data = await this.makeRequest(url);

    return this._createSuccessResponse(packageName, 'go', {
      version,
      exists: data !== null,
    });
  }

  async getPackageInfo(packageName) {
    const latestUrl = `https://proxy.golang.org/${encodeURIComponent(packageName)}/@latest`;
    const latestData = await this.makeRequest(latestUrl);

    if (!latestData) {
      return this._createErrorResponse(packageName, 'go', { message: 'Package not found' });
    }

    const versionsUrl = `https://proxy.golang.org/${encodeURIComponent(packageName)}/@v/list`;
    let versions = [];

    try {
      const versionsResponse = await fetch(versionsUrl, {
        headers: {
          'User-Agent': 'dependency-mcp/1.0.0',
          'Accept': 'text/plain',
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (versionsResponse.ok) {
        const versionsText = await versionsResponse.text();
        if (versionsText && typeof versionsText === 'string') {
          versions = versionsText.trim().split('\n').filter(v => v);
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
