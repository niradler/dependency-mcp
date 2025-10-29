# Dependency MCP - TypeScript Migration

This project has been migrated to TypeScript with the following changes:

## Changes Made

### 1. TypeScript Conversion
- Converted all `.js` files to `.ts`
- Added TypeScript configuration (`tsconfig.json`)
- Added type definitions in `src/types.ts`
- Added proper type annotations throughout the codebase

### 2. Package Updates
- **Migrated from `node-fetch` to `axios`**: Modern HTTP client with better TypeScript support
- **Updated to latest package versions**:
  - `axios`: ^1.7.9
  - `@types/node`: ^22.10.5
  - `typescript`: ^5.7.3
  - `tsx`: ^4.19.2 (for development)

### 3. Build System
- Source code is now in `src/` as TypeScript files
- Compiled output goes to `dist/` directory
- Added build scripts in package.json

## Development

### Install Dependencies
```bash
npm install
```

### Build the Project
```bash
npm run build
```

### Run in Development Mode
```bash
npm run dev
```

### Run Tests
```bash
npm test
```

### Type Checking
```bash
npm run typecheck
```

## Project Structure
```
dependency-mcp/
├── src/
│   ├── index.ts          # Main server entry point
│   ├── packageChecker.ts # Package version checking logic
│   └── types.ts          # TypeScript type definitions
├── test/
│   └── test.ts           # Test suite
├── dist/                 # Compiled JavaScript (generated)
├── tsconfig.json         # TypeScript configuration
└── package.json
```

## Migration Benefits

1. **Type Safety**: Full TypeScript type checking prevents runtime errors
2. **Better IDE Support**: Enhanced autocomplete and IntelliSense
3. **Modern HTTP Client**: Axios provides better error handling and interceptor support
4. **Improved Maintainability**: Types make the codebase easier to understand and refactor
5. **Latest Dependencies**: Using the most recent stable versions of all packages

## Notes

- The compiled JavaScript files in `dist/` are what get executed
- The shebang (`#!/usr/bin/env node`) is preserved in the compiled output
- Both source TypeScript files and compiled JavaScript are included in npm package
