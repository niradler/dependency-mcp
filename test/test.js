import { PackageVersionChecker } from "../src/packageChecker.js";

async function runTests() {
  console.log("🧪 Running Dependency MCP Tests...\n");
  
  const checker = new PackageVersionChecker();
  let passed = 0;
  let failed = 0;

  // Test helper function
  async function test(name, testFn) {
    try {
      console.log(`⏳ Testing: ${name}`);
      await testFn();
      console.log(`✅ PASS: ${name}\n`);
      passed++;
    } catch (error) {
      console.log(`❌ FAIL: ${name}`);
      console.log(`   Error: ${error.message}\n`);
      failed++;
    }
  }

  // NPM Tests
  await test("NPM - Get latest version of express", async () => {
    const result = await checker.getLatestVersion("express", "npm");
    if (!result.found || !result.latest_version) {
      throw new Error("Failed to get express latest version");
    }
    console.log(`   Latest express version: ${result.latest_version}`);
  });

  await test("NPM - Check if express v4.18.0 exists", async () => {
    const result = await checker.checkVersionExists("express", "4.18.0", "npm");
    if (!result.exists) {
      throw new Error("express 4.18.0 should exist");
    }
  });

  await test("NPM - Get package info for lodash", async () => {
    const result = await checker.getPackageInfo("lodash", "npm");
    if (!result.found || !result.versions || result.versions.length === 0) {
      throw new Error("Failed to get lodash package info");
    }
    console.log(`   Lodash has ${result.versions.length} versions`);
  });

  // PyPI Tests
  await test("PyPI - Get latest version of flask", async () => {
    const result = await checker.getLatestVersion("flask", "pypi");
    if (!result.found || !result.latest_version) {
      throw new Error("Failed to get flask latest version");
    }
    console.log(`   Latest flask version: ${result.latest_version}`);
  });

  await test("PyPI - Check if requests v2.28.0 exists", async () => {
    const result = await checker.checkVersionExists("requests", "2.28.0", "pypi");
    if (!result.exists) {
      throw new Error("requests 2.28.0 should exist");
    }
  });

  // Maven Tests
  await test("Maven - Get latest version of spring-core", async () => {
    const result = await checker.getLatestVersion("org.springframework:spring-core", "maven");
    if (!result.found || !result.latest_version) {
      throw new Error("Failed to get spring-core latest version");
    }
    console.log(`   Latest spring-core version: ${result.latest_version}`);
  });

  // Crates.io Tests
  await test("Crates - Get latest version of serde", async () => {
    const result = await checker.getLatestVersion("serde", "crates");
    if (!result.found || !result.latest_version) {
      throw new Error("Failed to get serde latest version");
    }
    console.log(`   Latest serde version: ${result.latest_version}`);
  });

  // Go Tests
  await test("Go - Get latest version of gorilla/mux", async () => {
    const result = await checker.getLatestVersion("github.com/gorilla/mux", "go");
    if (!result.found || !result.latest_version) {
      throw new Error("Failed to get gorilla/mux latest version");
    }
    console.log(`   Latest gorilla/mux version: ${result.latest_version}`);
  });

  // Error handling tests
  await test("Handle non-existent package", async () => {
    const result = await checker.getLatestVersion("this-package-definitely-does-not-exist-12345", "npm");
    if (result.found) {
      throw new Error("Should not find non-existent package");
    }
  });

  await test("Handle invalid registry", async () => {
    try {
      await checker.getLatestVersion("express", "invalid-registry");
      throw new Error("Should throw error for invalid registry");
    } catch (error) {
      if (!error.message.includes("Unsupported registry")) {
        throw error;
      }
    }
  });

  // Summary
  console.log("🏁 Test Results:");
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${passed + failed}`);
  
  if (failed === 0) {
    console.log("🎉 All tests passed!");
    process.exit(0);
  } else {
    console.log("💥 Some tests failed!");
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run tests
runTests().catch((error) => {
  console.error("Test runner error:", error);
  process.exit(1);
});
