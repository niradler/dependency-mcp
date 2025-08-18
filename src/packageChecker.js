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
    const handler = this.registryHandlers[registry];
    if (!handler) {
      throw new Error(`Unsupported registry: ${registry}`);
    }
    return await handler.getLatestVersion(packageName);
  }

  async checkVersionExists(packageName, version, registry) {
    const handler = this.registryHandlers[registry];
    if (!handler) {
      throw new Error(`Unsupported registry: ${registry}`);
    }
    return await handler.checkVersionExists(packageName, version);
  }

  async getPackageInfo(packageName, registry) {
    const handler = this.registryHandlers[registry];
    if (!handler) {
      throw new Error(`Unsupported registry: ${registry}`);
    }
    return await handler.getPackageInfo(packageName);
  }
}

class BaseRegistryHandler {
  async makeRequest(url, options = {}) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'dependency-mcp/1.0.0',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new Error(`Network error: Unable to reach registry`);
      }
      throw error;
    }
  }
}

class NpmHandler extends BaseRegistryHandler {
  async getLatestVersion(packageName) {
    const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
    const data = await this.makeRequest(url);
    
    if (!data) {
      return { package: packageName, registry: 'npm', found: false, error: 'Package not found' };
    }

    return {
      package: packageName,
      registry: 'npm',
      found: true,
      latest_version: data['dist-tags']?.latest,
      description: data.description,
    };
  }

  async checkVersionExists(packageName, version) {
    const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
    const data = await this.makeRequest(url);
    
    if (!data) {
      return { package: packageName, version, registry: 'npm', exists: false, error: 'Package not found' };
    }

    const exists = data.versions && data.versions[version] !== undefined;
    return {
      package: packageName,
      version,
      registry: 'npm',
      exists,
    };
  }

  async getPackageInfo(packageName) {
    const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
    const data = await this.makeRequest(url);
    
    if (!data) {
      return { package: packageName, registry: 'npm', found: false, error: 'Package not found' };
    }

    return {
      package: packageName,
      registry: 'npm',
      found: true,
      latest_version: data['dist-tags']?.latest,
      description: data.description,
      versions: Object.keys(data.versions || {}),
      homepage: data.homepage,
      repository: data.repository?.url,
    };
  }
}

class PypiHandler extends BaseRegistryHandler {
  async getLatestVersion(packageName) {
    const url = `https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`;
    const data = await this.makeRequest(url);
    
    if (!data) {
      return { package: packageName, registry: 'pypi', found: false, error: 'Package not found' };
    }

    return {
      package: packageName,
      registry: 'pypi',
      found: true,
      latest_version: data.info?.version,
      description: data.info?.summary,
    };
  }

  async checkVersionExists(packageName, version) {
    const url = `https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`;
    const data = await this.makeRequest(url);
    
    if (!data) {
      return { package: packageName, version, registry: 'pypi', exists: false, error: 'Package not found' };
    }

    const exists = data.releases && data.releases[version] !== undefined;
    return {
      package: packageName,
      version,
      registry: 'pypi',
      exists,
    };
  }

  async getPackageInfo(packageName) {
    const url = `https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`;
    const data = await this.makeRequest(url);
    
    if (!data) {
      return { package: packageName, registry: 'pypi', found: false, error: 'Package not found' };
    }

    return {
      package: packageName,
      registry: 'pypi',
      found: true,
      latest_version: data.info?.version,
      description: data.info?.summary,
      versions: Object.keys(data.releases || {}),
      homepage: data.info?.home_page,
      author: data.info?.author,
    };
  }
}

class MavenHandler extends BaseRegistryHandler {
  async getLatestVersion(packageName) {
    // Maven packages are in format groupId:artifactId
    const [groupId, artifactId] = packageName.split(':');
    if (!groupId || !artifactId) {
      return { package: packageName, registry: 'maven', found: false, error: 'Invalid format. Use groupId:artifactId' };
    }

    const url = `https://search.maven.org/solrsearch/select?q=g:"${groupId}"+AND+a:"${artifactId}"&rows=1&wt=json`;
    const data = await this.makeRequest(url);
    
    if (!data || !data.response?.docs?.length) {
      return { package: packageName, registry: 'maven', found: false, error: 'Package not found' };
    }

    const doc = data.response.docs[0];
    return {
      package: packageName,
      registry: 'maven',
      found: true,
      latest_version: doc.latestVersion,
      description: `Maven artifact: ${groupId}:${artifactId}`,
    };
  }

  async checkVersionExists(packageName, version) {
    const [groupId, artifactId] = packageName.split(':');
    if (!groupId || !artifactId) {
      return { package: packageName, version, registry: 'maven', exists: false, error: 'Invalid format. Use groupId:artifactId' };
    }

    const url = `https://search.maven.org/solrsearch/select?q=g:"${groupId}"+AND+a:"${artifactId}"+AND+v:"${version}"&rows=1&wt=json`;
    const data = await this.makeRequest(url);
    
    const exists = data && data.response?.docs?.length > 0;
    return {
      package: packageName,
      version,
      registry: 'maven',
      exists,
    };
  }

  async getPackageInfo(packageName) {
    const [groupId, artifactId] = packageName.split(':');
    if (!groupId || !artifactId) {
      return { package: packageName, registry: 'maven', found: false, error: 'Invalid format. Use groupId:artifactId' };
    }

    const url = `https://search.maven.org/solrsearch/select?q=g:"${groupId}"+AND+a:"${artifactId}"&rows=20&wt=json`;
    const data = await this.makeRequest(url);
    
    if (!data || !data.response?.docs?.length) {
      return { package: packageName, registry: 'maven', found: false, error: 'Package not found' };
    }

    const doc = data.response.docs[0];
    return {
      package: packageName,
      registry: 'maven',
      found: true,
      latest_version: doc.latestVersion,
      description: `Maven artifact: ${groupId}:${artifactId}`,
      versions: data.response.docs.map(d => d.v),
    };
  }
}

class NugetHandler extends BaseRegistryHandler {
  async getLatestVersion(packageName) {
    const url = `https://api.nuget.org/v3-flatcontainer/${packageName.toLowerCase()}/index.json`;
    const data = await this.makeRequest(url);
    
    if (!data || !data.versions?.length) {
      return { package: packageName, registry: 'nuget', found: false, error: 'Package not found' };
    }

    const latestVersion = data.versions[data.versions.length - 1];
    return {
      package: packageName,
      registry: 'nuget',
      found: true,
      latest_version: latestVersion,
      description: `NuGet package: ${packageName}`,
    };
  }

  async checkVersionExists(packageName, version) {
    const url = `https://api.nuget.org/v3-flatcontainer/${packageName.toLowerCase()}/index.json`;
    const data = await this.makeRequest(url);
    
    if (!data) {
      return { package: packageName, version, registry: 'nuget', exists: false, error: 'Package not found' };
    }

    const exists = data.versions && data.versions.includes(version);
    return {
      package: packageName,
      version,
      registry: 'nuget',
      exists,
    };
  }

  async getPackageInfo(packageName) {
    const url = `https://api.nuget.org/v3-flatcontainer/${packageName.toLowerCase()}/index.json`;
    const data = await this.makeRequest(url);
    
    if (!data || !data.versions?.length) {
      return { package: packageName, registry: 'nuget', found: false, error: 'Package not found' };
    }

    return {
      package: packageName,
      registry: 'nuget',
      found: true,
      latest_version: data.versions[data.versions.length - 1],
      description: `NuGet package: ${packageName}`,
      versions: data.versions,
    };
  }
}

class RubygemsHandler extends BaseRegistryHandler {
  async getLatestVersion(packageName) {
    const url = `https://rubygems.org/api/v1/gems/${encodeURIComponent(packageName)}.json`;
    const data = await this.makeRequest(url);
    
    if (!data) {
      return { package: packageName, registry: 'rubygems', found: false, error: 'Package not found' };
    }

    return {
      package: packageName,
      registry: 'rubygems',
      found: true,
      latest_version: data.version,
      description: data.info,
    };
  }

  async checkVersionExists(packageName, version) {
    const url = `https://rubygems.org/api/v1/versions/${encodeURIComponent(packageName)}.json`;
    const data = await this.makeRequest(url);
    
    if (!data) {
      return { package: packageName, version, registry: 'rubygems', exists: false, error: 'Package not found' };
    }

    const exists = Array.isArray(data) && data.some(v => v.number === version);
    return {
      package: packageName,
      version,
      registry: 'rubygems',
      exists,
    };
  }

  async getPackageInfo(packageName) {
    const url = `https://rubygems.org/api/v1/gems/${encodeURIComponent(packageName)}.json`;
    const data = await this.makeRequest(url);
    
    if (!data) {
      return { package: packageName, registry: 'rubygems', found: false, error: 'Package not found' };
    }

    const versionsUrl = `https://rubygems.org/api/v1/versions/${encodeURIComponent(packageName)}.json`;
    const versionsData = await this.makeRequest(versionsUrl);
    
    return {
      package: packageName,
      registry: 'rubygems',
      found: true,
      latest_version: data.version,
      description: data.info,
      versions: Array.isArray(versionsData) ? versionsData.map(v => v.number) : [],
      homepage: data.homepage_uri,
    };
  }
}

class CratesHandler extends BaseRegistryHandler {
  async getLatestVersion(packageName) {
    const url = `https://crates.io/api/v1/crates/${encodeURIComponent(packageName)}`;
    const data = await this.makeRequest(url);
    
    if (!data || !data.crate) {
      return { package: packageName, registry: 'crates', found: false, error: 'Package not found' };
    }

    return {
      package: packageName,
      registry: 'crates',
      found: true,
      latest_version: data.crate.newest_version,
      description: data.crate.description,
    };
  }

  async checkVersionExists(packageName, version) {
    const url = `https://crates.io/api/v1/crates/${encodeURIComponent(packageName)}/versions`;
    const data = await this.makeRequest(url);
    
    if (!data) {
      return { package: packageName, version, registry: 'crates', exists: false, error: 'Package not found' };
    }

    const exists = data.versions && data.versions.some(v => v.num === version);
    return {
      package: packageName,
      version,
      registry: 'crates',
      exists,
    };
  }

  async getPackageInfo(packageName) {
    const url = `https://crates.io/api/v1/crates/${encodeURIComponent(packageName)}`;
    const data = await this.makeRequest(url);
    
    if (!data || !data.crate) {
      return { package: packageName, registry: 'crates', found: false, error: 'Package not found' };
    }

    const versionsUrl = `https://crates.io/api/v1/crates/${encodeURIComponent(packageName)}/versions`;
    const versionsData = await this.makeRequest(versionsUrl);
    
    return {
      package: packageName,
      registry: 'crates',
      found: true,
      latest_version: data.crate.newest_version,
      description: data.crate.description,
      versions: versionsData?.versions?.map(v => v.num) || [],
      homepage: data.crate.homepage,
      repository: data.crate.repository,
    };
  }
}

class GoHandler extends BaseRegistryHandler {
  async getLatestVersion(packageName) {
    // Use Go proxy API
    const url = `https://proxy.golang.org/${encodeURIComponent(packageName)}/@latest`;
    const data = await this.makeRequest(url);
    
    if (!data) {
      return { package: packageName, registry: 'go', found: false, error: 'Package not found' };
    }

    return {
      package: packageName,
      registry: 'go',
      found: true,
      latest_version: data.Version,
      description: `Go module: ${packageName}`,
    };
  }

  async checkVersionExists(packageName, version) {
    const url = `https://proxy.golang.org/${encodeURIComponent(packageName)}/@v/${encodeURIComponent(version)}.info`;
    const data = await this.makeRequest(url);
    
    return {
      package: packageName,
      version,
      registry: 'go',
      exists: data !== null,
    };
  }

  async getPackageInfo(packageName) {
    const latestUrl = `https://proxy.golang.org/${encodeURIComponent(packageName)}/@latest`;
    const latestData = await this.makeRequest(latestUrl);
    
    if (!latestData) {
      return { package: packageName, registry: 'go', found: false, error: 'Package not found' };
    }

    const versionsUrl = `https://proxy.golang.org/${encodeURIComponent(packageName)}/@v/list`;
    const versionsData = await this.makeRequest(versionsUrl);
    
    let versions = [];
    if (versionsData && typeof versionsData === 'string') {
      versions = versionsData.trim().split('\n').filter(v => v);
    }

    return {
      package: packageName,
      registry: 'go',
      found: true,
      latest_version: latestData.Version,
      description: `Go module: ${packageName}`,
      versions,
    };
  }
}
