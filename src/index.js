#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { PackageVersionChecker } from "./packageChecker.js";

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
        description: "Get the latest version of a package from various package managers",
        inputSchema: {
          type: "object",
          properties: {
            package_name: {
              type: "string",
              description: "Name of the package to check",
            },
            registry: {
              type: "string",
              enum: ["npm", "pypi", "maven", "nuget", "rubygems", "crates", "go"],
              description: "Package registry/manager to check",
            },
          },
          required: ["package_name", "registry"],
        },
      },
      {
        name: "check_version_exists",
        description: "Check if a specific version of a package exists",
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
              enum: ["npm", "pypi", "maven", "nuget", "rubygems", "crates", "go"],
              description: "Package registry/manager to check",
            },
          },
          required: ["package_name", "version", "registry"],
        },
      },
      {
        name: "get_package_info",
        description: "Get detailed information about a package including all versions",
        inputSchema: {
          type: "object",
          properties: {
            package_name: {
              type: "string",
              description: "Name of the package to get info for",
            },
            registry: {
              type: "string",
              enum: ["npm", "pypi", "maven", "nuget", "rubygems", "crates", "go"],
              description: "Package registry/manager to check",
            },
          },
          required: ["package_name", "registry"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "get_latest_version": {
        const { package_name, registry } = args;
        const result = await packageChecker.getLatestVersion(package_name, registry);
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
        const { package_name, version, registry } = args;
        const result = await packageChecker.checkVersionExists(package_name, version, registry);
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
        const { package_name, registry } = args;
        const result = await packageChecker.getPackageInfo(package_name, registry);
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
          text: `Error: ${error.message}`,
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
  console.error("Dependency MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
