# Dependency MCP Server

A Model Context Protocol (MCP) server for checking package versions across multiple package managers and registries.

## Features

- **Multi-language support**: Check packages from NPM, PyPI, Maven, NuGet, RubyGems, Crates.io, and Go modules
- **Latest version lookup**: Get the most recent version of any package
- **Version existence check**: Verify if a specific version exists
- **Package information**: Get detailed package metadata including all versions
- **Batch processing**: Check multiple packages simultaneously for improved efficiency
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

## Available Tools

### Single Package Tools

Use these tools when you need to check **1-2 packages** or require **detailed information**:

#### 1. `get_latest_version`

Get the latest version of a package. Use for dependency updates, version checks, or when you need the most recent stable release.

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

Check if a specific version exists. Use for dependency validation, CI/CD checks, or ensuring version compatibility.

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

Get detailed package information including all versions. Use for dependency audits, security reviews, or when you need comprehensive package metadata.

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

### Multi-Package Tools

Use these tools when you need to check **3+ packages** or perform **bulk operations**:

#### 4. `get_latest_versions`

Get latest versions for multiple packages simultaneously. Use when checking 3+ dependencies - processes up to 100 packages in parallel.

**Parameters:**

- `packages` (array): Array of package names
- `registry` (string): Package registry

**Example:**

```json
{
  "packages": ["react", "lodash", "axios"],
  "registry": "npm"
}
```

#### 5. `check_versions_exist`

Check if specific versions exist for multiple packages. Use for bulk dependency validation, CI/CD pipeline checks, or ensuring multiple package version compatibility.

**Parameters:**

- `packages` (array): Array of package objects with `package_name` and `version`
- `registry` (string): Package registry

**Example:**

```json
{
  "packages": [
    { "package_name": "react", "version": "18.2.0" },
    { "package_name": "lodash", "version": "4.17.21" },
    { "package_name": "axios", "version": "1.6.0" }
  ],
  "registry": "npm"
}
```

#### 6. `get_packages_info`

Get comprehensive package details for multiple packages. Use for dependency audits, security reviews, or bulk package analysis.

**Parameters:**

- `packages` (array): Array of package names
- `registry` (string): Package registry

**Example:**

```json
{
  "packages": ["react", "lodash", "axios"],
  "registry": "npm"
}
```

## Tool Selection Guide

### When to Use Single Package Tools:

- **1-2 packages** to check
- **Detailed information** needed (versions, homepage, repository)
- **Specific version validation** for one package
- **Quick checks** during development

### When to Use Multi-Package Tools:

- **3+ packages** to check
- **Bulk dependency validation**
- **CI/CD pipeline checks**
- **Dependency audits** or security reviews
- **Performance-critical** scenarios with multiple packages

### Performance Notes:

- **Single package tools**: Faster for 1-2 packages
- **Multi-package tools**: 3-5x faster for 5+ packages due to parallel processing
- **Error isolation**: Failed packages don't break the entire batch
- **Batch limits**: Maximum 100 packages per request

## Batch Processing

The multi-package tools provide significant performance improvements when checking multiple packages:

### Benefits

- **Eliminates round-trip delays**: Check up to 100 packages in a single request
- **Consistent error handling**: Individual package failures don't break the entire batch
- **Parallel processing**: All packages are checked concurrently for maximum efficiency
- **Reduced API overhead**: Fewer HTTP requests to external registries

### Limitations

- **Maximum batch size**: 100 packages per request
- **Rate limiting**: Built-in delays prevent overwhelming external APIs
- **Timeout handling**: 10-second timeout per request with graceful fallback
- **Memory usage**: Large batches may consume more memory

### When to Use Batch Tools

- **Dependency audits**: Check multiple packages in your project
- **Version comparisons**: Compare versions across multiple packages
- **Bulk updates**: Identify which packages have newer versions available
- **CI/CD pipelines**: Validate multiple package versions simultaneously

## Production Considerations

### Performance

- **Concurrent processing**: Multi-package tools use Promise.all for parallel execution
- **Rate limiting**: Built-in 100ms delay between requests to external APIs
- **Timeout handling**: 10-second timeout with graceful error handling
- **Memory management**: Efficient processing of large batches

### Reliability

- **Error isolation**: Individual package failures don't affect others in the batch
- **Network resilience**: Handles temporary network issues gracefully
- **API fallbacks**: Graceful degradation when external APIs are unavailable
- **Validation**: Comprehensive input validation prevents invalid requests
- **Registry-specific handling**: Maven registry may be slower in some network environments

### Security

- **Input sanitization**: All inputs are validated and sanitized
- **Rate limiting**: Prevents abuse of external APIs
- **Error messages**: Safe error messages that don't expose internal details
- **Timeout protection**: Prevents hanging requests

### Monitoring

- **Timestamps**: All responses include ISO timestamps for tracking
- **Error tracking**: Detailed error information for debugging
- **Performance metrics**: Built-in timeout and rate limiting tracking

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
- Rate limiting exceeded
- Server errors (5xx responses)
- Request timeouts
- Input validation errors

### Error Response Format

All error responses include:

- `error`: Human-readable error message
- `timestamp`: ISO timestamp of when the error occurred
- `package`: Package name that caused the error
- `registry`: Registry where the error occurred

### Input Validation

The server validates all inputs:

- Package names: Must be non-empty strings under 500 characters
- Versions: Must be non-empty strings under 100 characters
- Registry: Must be one of the supported registries
- Batch size: Maximum 100 packages per request
- Required parameters: All required fields must be present

### Response Expectations

#### Single Package Tools:

- **Success**: Returns complete package information with `found: true`
- **Not Found**: Returns `found: false` with error message
- **Network Issues**: Returns error with descriptive message
- **Always includes**: `timestamp`, `package`, `registry` fields

#### Multi-Package Tools:

- **Success**: Returns array of results, each with individual status
- **Partial Success**: Some packages succeed, others fail - each has individual result
- **Error Isolation**: Failed packages don't affect successful ones
- **Batch Processing**: All packages processed in parallel for efficiency
- **Consistent Format**: Each result follows same structure as single package tools

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
