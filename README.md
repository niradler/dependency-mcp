# Dependency MCP Server

A Model Context Protocol (MCP) server for checking package versions across multiple package managers and registries.

## Features

- **Multi-language support**: Check packages from NPM, PyPI, Maven, NuGet, RubyGems, Crates.io, and Go modules
- **Latest version lookup**: Get the most recent version of any package
- **Version existence check**: Verify if a specific version exists
- **Package information**: Get detailed package metadata including all versions
- **Easy installation**: Install and run via npx

## Supported Package Managers

- **npm** - Node.js packages
- **pypi** - Python packages
- **maven** - Java packages (format: `groupId:artifactId`)
- **nuget** - .NET packages
- **rubygems** - Ruby gems
- **crates** - Rust crates
- **go** - Go modules

## Installation

### Global Installation

```bash
npm install -g dependency-mcp
```

### Run with npx (no installation needed)

```bash
npx dependency-mcp
```

### Local Development

```bash
git clone <repository>
cd dependency-mcp
npm install
npm start
```

## Usage

The server runs as an MCP server using stdio transport. It's designed to be used with MCP-compatible clients.

### Available Tools

#### 1. `get_latest_version`

Get the latest version of a package.

**Parameters:**

- `package_name` (string): Name of the package
- `registry` (string): Package registry (`npm`, `pypi`, `maven`, `nuget`, `rubygems`, `crates`, `go`)

**Example:**

```json
{
  "package_name": "express",
  "registry": "npm"
}
```

#### 2. `check_version_exists`

Check if a specific version exists.

**Parameters:**

- `package_name` (string): Name of the package
- `version` (string): Version to check
- `registry` (string): Package registry

**Example:**

```json
{
  "package_name": "flask",
  "version": "2.3.0",
  "registry": "pypi"
}
```

#### 3. `get_package_info`

Get detailed package information including all versions.

**Parameters:**

- `package_name` (string): Name of the package
- `registry` (string): Package registry

**Example:**

```json
{
  "package_name": "lodash",
  "registry": "npm"
}
```

## Configuration with Claude Desktop

Add this to your Claude Desktop configuration file:

### Windows

`%APPDATA%\Claude\claude_desktop_config.json`

### macOS

`~/Library/Application Support/Claude/claude_desktop_config.json`

### Linux

`~/.config/claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "dependency-checker": {
      "command": "npx",
      "args": ["dependency-mcp"]
    }
  }
}
```

## Example Responses

### Latest Version Response

```json
{
  "package": "express",
  "registry": "npm",
  "found": true,
  "latest_version": "4.18.2",
  "description": "Fast, unopinionated, minimalist web framework"
}
```

### Version Check Response

```json
{
  "package": "flask",
  "version": "2.3.0",
  "registry": "pypi",
  "exists": true
}
```

### Package Info Response

```json
{
  "package": "lodash",
  "registry": "npm",
  "found": true,
  "latest_version": "4.17.21",
  "description": "Lodash modular utilities.",
  "versions": ["4.17.21", "4.17.20", "..."],
  "homepage": "https://lodash.com/",
  "repository": "git+https://github.com/lodash/lodash.git"
}
```

## Special Format Notes

### Maven

Maven packages should be specified in the format `groupId:artifactId`:

```json
{
  "package_name": "org.springframework:spring-core",
  "registry": "maven"
}
```

### Go Modules

Go modules should use the full module path:

```json
{
  "package_name": "github.com/gorilla/mux",
  "registry": "go"
}
```

## Error Handling

The server provides detailed error messages for common scenarios:

- Package not found
- Network connectivity issues
- Invalid package name formats
- Registry API errors

## Development

### Project Structure

```
dependency-mcp/
├── src/
│   ├── index.js          # Main MCP server
│   └── packageChecker.js # Package registry handlers
├── test/
│   └── test.js          # Basic tests
├── package.json
└── README.md
```

### Running Tests

```bash
npm test
```

### Debug Mode

```bash
npm run dev
```

## License

MIT
