export interface PackageResult {
  package: string;
  registry: string;
  found: boolean;
  timestamp: string;
  latest_version?: string;
  description?: string;
  version?: string;
  exists?: boolean;
  versions?: string[];
  homepage?: string;
  repository?: string;
  author?: string;
  error?: string;
}

export interface PackageVersionRequest {
  package_name: string;
  version: string;
}

export type Registry = 'npm' | 'pypi' | 'maven' | 'nuget' | 'rubygems' | 'crates' | 'go';

export interface RegistryHandler {
  getLatestVersion(packageName: string): Promise<PackageResult>;
  checkVersionExists(packageName: string, version: string): Promise<PackageResult>;
  getPackageInfo(packageName: string): Promise<PackageResult>;
}
