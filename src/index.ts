#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { PackageVersionChecker } from "./packageChecker.js";
import type { Registry } from "./types.js";

const SUPPORTED_REGISTRIES: Registry[] = ["npm", "pypi", "maven", "nuget", "rubygems", "crates", "go"];

const server = new Server(
  {
    name: "dependency-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const packageChecker = new PackageVersionChecker();

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_latest_version",
        description: "Get the latest version of a package. Use for dependency updates, version checks, or when you need the most recent stable release. Returns package name, latest version, description, and timestamp.",
        inputSchema: {
          type: "object",
          properties: {
            package_name: {
              type: "string",
              description: "Name of the package to check",
            },
            registry: {
              type: "string",
              enum: SUPPORTED_REGISTRIES,
              description: "Package registry/manager to check",
            },
          },
          required: ["package_name", "registry"],
        },
      },
      {
        name: "check_version_exists",
        description: "Check if a specific version exists. Use for dependency validation, CI/CD checks, or ensuring version compatibility. Returns whether the version exists with package details and timestamp.",
        inputSchema: {
          type: "object",
          properties: {
            package_name: {
              type: "string",
              description: "Name of the package to check",
            },
            version: {
              type: "string",
              description: "Version to check for existence",
            },
            registry: {
              type: "string",
              enum: SUPPORTED_REGISTRIES,
              description: "Package registry/manager to check",
            },
          },
          required: ["package_name", "version", "registry"],
        },
      },
      {
        name: "get_package_info",
        description: "Get detailed package information including all versions. Use for dependency audits, security reviews, or when you need comprehensive package metadata. Returns versions list, homepage, repository, and full package details.",
        inputSchema: {
          type: "object",
          properties: {
            package_name: {
              type: "string",
              description: "Name of the package to get info for",
            },
            registry: {
              type: "string",
              enum: SUPPORTED_REGISTRIES,
              description: "Package registry/manager to check",
            },
          },
          required: ["package_name", "registry"],
        },
      },
      {
        name: "get_latest_versions",
        description: "Get latest versions for multiple packages simultaneously. Use when checking 3+ dependencies - processes up to 100 packages in parallel. Returns individual results for each package with error isolation. Much faster than individual calls for multiple packages.",
        inputSchema: {
          type: "object",
          properties: {
            packages: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Array of package names to check",
            },
            registry: {
              type: "string",
              enum: SUPPORTED_REGISTRIES,
              description: "Package registry/manager to check",
            },
          },
          required: ["packages", "registry"],
        },
      },
      {
        name: "check_versions_exist",
        description: "Check if specific versions exist for multiple packages. Use for bulk dependency validation, CI/CD pipeline checks, or ensuring multiple package version compatibility. Processes up to 100 packages in parallel with individual error handling.",
        inputSchema: {
          type: "object",
          properties: {
            packages: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  package_name: {
                    type: "string",
                    description: "Name of the package to check",
                  },
                  version: {
                    type: "string",
                    description: "Version to check for existence",
                  },
                },
                required: ["package_name", "version"],
              },
              description: "Array of package objects with name and version",
            },
            registry: {
              type: "string",
              enum: SUPPORTED_REGISTRIES,
              description: "Package registry/manager to check",
            },
          },
          required: ["packages", "registry"],
        },
      },
      {
        name: "get_packages_info",
        description: "Get comprehensive package details for multiple packages. Use for dependency audits, security reviews, or bulk package analysis. Processes up to 100 packages in parallel. Returns detailed info for each package with error isolation - failed packages don't break the batch.",
        inputSchema: {
          type: "object",
          properties: {
            packages: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Array of package names to get info for",
            },
            registry: {
              type: "string",
              enum: SUPPORTED_REGISTRIES,
              description: "Package registry/manager to check",
            },
          },
          required: ["packages", "registry"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Validate arguments
    if (!args || typeof args !== 'object') {
      throw new Error('Invalid arguments: must be an object');
    }

    switch (name) {
      case "get_latest_version": {
        const { package_name, registry } = args as { package_name?: string; registry?: string };
        if (!package_name || !registry) {
          throw new Error('Missing required parameters: package_name and registry');
        }
        if (!SUPPORTED_REGISTRIES.includes(registry as Registry)) {
          throw new Error(`Unsupported registry: ${registry}. Supported: ${SUPPORTED_REGISTRIES.join(', ')}`);
        }
        const result = await packageChecker.getLatestVersion(package_name, registry as Registry);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "check_version_exists": {
        const { package_name, version, registry } = args as { package_name?: string; version?: string; registry?: string };
        if (!package_name || !version || !registry) {
          throw new Error('Missing required parameters: package_name, version, and registry');
        }
        if (!SUPPORTED_REGISTRIES.includes(registry as Registry)) {
          throw new Error(`Unsupported registry: ${registry}. Supported: ${SUPPORTED_REGISTRIES.join(', ')}`);
        }
        const result = await packageChecker.checkVersionExists(package_name, version, registry as Registry);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_package_info": {
        const { package_name, registry } = args as { package_name?: string; registry?: string };
        if (!package_name || !registry) {
          throw new Error('Missing required parameters: package_name and registry');
        }
        if (!SUPPORTED_REGISTRIES.includes(registry as Registry)) {
          throw new Error(`Unsupported registry: ${registry}. Supported: ${SUPPORTED_REGISTRIES.join(', ')}`);
        }
        const result = await packageChecker.getPackageInfo(package_name, registry as Registry);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_latest_versions": {
        const { packages, registry } = args as { packages?: string[]; registry?: string };
        if (!packages || !Array.isArray(packages) || packages.length === 0) {
          throw new Error('Missing or invalid packages parameter: must be a non-empty array');
        }
        if (!registry) {
          throw new Error('Missing required parameter: registry');
        }
        if (!SUPPORTED_REGISTRIES.includes(registry as Registry)) {
          throw new Error(`Unsupported registry: ${registry}. Supported: ${SUPPORTED_REGISTRIES.join(', ')}`);
        }
        const result = await packageChecker.getLatestVersions(packages, registry as Registry);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "check_versions_exist": {
        const { packages, registry } = args as { 
          packages?: Array<{ package_name: string; version: string }>; 
          registry?: string 
        };
        if (!packages || !Array.isArray(packages) || packages.length === 0) {
          throw new Error('Missing or invalid packages parameter: must be a non-empty array');
        }
        if (!registry) {
          throw new Error('Missing required parameter: registry');
        }
        if (!SUPPORTED_REGISTRIES.includes(registry as Registry)) {
          throw new Error(`Unsupported registry: ${registry}. Supported: ${SUPPORTED_REGISTRIES.join(', ')}`);
        }
        // Validate package objects
        for (const pkg of packages) {
          if (!pkg.package_name || !pkg.version) {
            throw new Error('Each package must have package_name and version properties');
          }
        }
        const result = await packageChecker.checkVersionsExist(packages, registry as Registry);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_packages_info": {
        const { packages, registry } = args as { packages?: string[]; registry?: string };
        if (!packages || !Array.isArray(packages) || packages.length === 0) {
          throw new Error('Missing or invalid packages parameter: must be a non-empty array');
        }
        if (!registry) {
          throw new Error('Missing required parameter: registry');
        }
        if (!SUPPORTED_REGISTRIES.includes(registry as Registry)) {
          throw new Error(`Unsupported registry: ${registry}. Supported: ${SUPPORTED_REGISTRIES.join(', ')}`);
        }
        const result = await packageChecker.getPackagesInfo(packages, registry as Registry);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
