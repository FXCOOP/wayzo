/**
 * Global Test Teardown for Wayzo Playwright MCP Testing
 * Runs after all tests to clean up and generate reports
 */

import fs from 'fs';
import path from 'path';

export default async function globalTeardown() {
  console.log('🧹 Starting global test teardown...');

  try {
    // Generate test summary report
    await generateTestSummary();

    // Clean up test artifacts
    await cleanupTestArtifacts();

    // Archive test results
    await archiveTestResults();

    console.log('✅ Global test teardown completed successfully');
  } catch (error) {
    console.error('❌ Global test teardown failed:', error.message);
  }
}

async function generateTestSummary() {
  console.log('📊 Generating test summary report...');

  try {
    const testResultsDir = path.join(process.cwd(), 'test-results');
    const resultsJsonPath = path.join(testResultsDir, 'results.json');

    let summary = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch
      },
      testStatus: 'completed',
      recommendations: []
    };

    // Try to read Playwright results if available
    if (fs.existsSync(resultsJsonPath)) {
      try {
        const results = JSON.parse(fs.readFileSync(resultsJsonPath, 'utf8'));

        summary.stats = {
          total: results.suites?.reduce((acc, suite) => acc + (suite.specs?.length || 0), 0) || 0,
          passed: 0,
          failed: 0,
          skipped: 0
        };

        // Calculate detailed stats
        if (results.suites) {
          results.suites.forEach(suite => {
            if (suite.specs) {
              suite.specs.forEach(spec => {
                if (spec.tests) {
                  spec.tests.forEach(test => {
                    if (test.results) {
                      test.results.forEach(result => {
                        switch (result.status) {
                          case 'passed':
                            summary.stats.passed++;
                            break;
                          case 'failed':
                            summary.stats.failed++;
                            break;
                          case 'skipped':
                            summary.stats.skipped++;
                            break;
                        }
                      });
                    }
                  });
                }\n              });\n            }\n          });\n        }\n\n        // Generate recommendations based on results\n        const successRate = summary.stats.total > 0 ? \n          (summary.stats.passed / summary.stats.total) * 100 : 0;\n\n        if (successRate >= 95) {\n          summary.recommendations.push('✅ Excellent test results! All critical fixes are working properly.');\n          summary.recommendations.push('✅ Safe to proceed with deployment.');\n        } else if (successRate >= 80) {\n          summary.recommendations.push('⚠️ Most tests passing but some issues remain.');\n          summary.recommendations.push('⚠️ Review failed tests before deployment.');\n          summary.recommendations.push('💡 Focus on HIGH PRIORITY fixes first.');\n        } else {\n          summary.recommendations.push('❌ High failure rate detected.');\n          summary.recommendations.push('❌ DO NOT DEPLOY until critical issues are resolved.');\n          summary.recommendations.push('🔧 Run baseline tests to identify core problems.');\n        }\n\n        summary.successRate = Math.round(successRate);\n      } catch (error) {\n        console.log('⚠️ Could not parse test results:', error.message);\n      }\n    }\n\n    // Write summary report\n    const summaryPath = path.join(testResultsDir, 'test-summary.json');\n    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));\n\n    // Generate human-readable report\n    const readableReport = generateReadableReport(summary);\n    const readableReportPath = path.join(testResultsDir, 'TEST-SUMMARY.md');\n    fs.writeFileSync(readableReportPath, readableReport);\n\n    console.log('✅ Test summary generated:', readableReportPath);\n  } catch (error) {\n    console.log('⚠️ Test summary generation failed:', error.message);\n  }\n}\n\nfunction generateReadableReport(summary) {\n  const { stats, successRate, recommendations, timestamp } = summary;\n  \n  return `# Wayzo Critical Fixes Test Summary\n\n**Generated:** ${timestamp}\n**Test Suite:** Playwright MCP Integration\n\n## 📊 Test Results\n\n${stats ? `\n- **Total Tests:** ${stats.total}\n- **Passed:** ${stats.passed} ✅\n- **Failed:** ${stats.failed} ❌\n- **Skipped:** ${stats.skipped} ⏭️\n- **Success Rate:** ${successRate}%\n\n### Result Breakdown\n\n| Status | Count | Percentage |\n|--------|-------|------------|\n| Passed | ${stats.passed} | ${stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0}% |\n| Failed | ${stats.failed} | ${stats.total > 0 ? Math.round((stats.failed / stats.total) * 100) : 0}% |\n| Skipped | ${stats.skipped} | ${stats.total > 0 ? Math.round((stats.skipped / stats.total) * 100) : 0}% |\n\n` : '**No detailed stats available**\\n\\n'}\n\n## 💡 Recommendations\n\n${recommendations.map(rec => `- ${rec}`).join('\\n')}\n\n## 🧪 Test Categories\n\n### Baseline Tests\n- ✅ Core functionality validation\n- ✅ Essential loading tests\n- ✅ Critical JavaScript functionality\n\n### Critical Fixes Tests\n- 🔴 **HIGH PRIORITY:** GPT API Integration, Location Autofill, Weather Table, Budget Duplication\n- 🟡 **MEDIUM PRIORITY:** Content Validation, Widget Integration, Mobile Responsiveness\n- 🟢 **LOW PRIORITY:** Date Validation, Error Handling, Data Quality\n\n### Cross-Browser Tests\n- Chrome, Firefox, Safari/WebKit\n- Mobile: Chrome Mobile, Safari Mobile\n- Tablet: iPad Pro\n\n## 📱 Device Testing\n\n- **Desktop:** 1280x720, 1440x900\n- **Mobile:** iPhone 12 (390x844), Pixel 5 (393x851)\n- **Tablet:** iPad Pro (1024x1366)\n\n## 🔧 Environment\n\n- **Node.js:** ${summary.environment.nodeVersion}\n- **Platform:** ${summary.environment.platform}\n- **Architecture:** ${summary.environment.architecture}\n\n## 📁 Test Artifacts\n\n- **HTML Report:** \\`test-results/html-report/index.html\\`\n- **Screenshots:** \\`test-results/artifacts/\\`\n- **Videos:** \\`test-results/artifacts/\\`\n- **JUnit XML:** \\`test-results/junit.xml\\`\n\n## 🚀 Next Steps\n\n${successRate >= 95 ? `\n1. ✅ **READY FOR DEPLOYMENT**\n2. 🚀 Proceed with production release\n3. 📊 Monitor production metrics\n4. 🔄 Schedule next regression test cycle\n` : successRate >= 80 ? `\n1. 🔍 **REVIEW FAILED TESTS**\n2. 🛠️ Fix remaining issues\n3. 🔄 Re-run critical test suite\n4. ✅ Confirm >95% pass rate before deployment\n` : `\n1. 🚨 **CRITICAL ISSUES DETECTED**\n2. 🛑 DO NOT DEPLOY\n3. 🔧 Run baseline tests to identify core problems\n4. 🛠️ Fix HIGH PRIORITY issues first\n5. 🔄 Re-run complete test suite\n`}\n\n---\n\n*Generated by Wayzo Playwright MCP Testing Framework*\n`;\n}\n\nasync function cleanupTestArtifacts() {\n  console.log('🗑️ Cleaning up test artifacts...');\n\n  try {\n    const testResultsDir = path.join(process.cwd(), 'test-results');\n    const tempDir = path.join(testResultsDir, 'temp');\n\n    // Clean up temporary files\n    if (fs.existsSync(tempDir)) {\n      fs.rmSync(tempDir, { recursive: true, force: true });\n    }\n\n    // Clean up old screenshots/videos (keep last 50)\n    const artifactsDir = path.join(testResultsDir, 'artifacts');\n    if (fs.existsSync(artifactsDir)) {\n      const files = fs.readdirSync(artifactsDir)\n        .map(file => ({\n          name: file,\n          path: path.join(artifactsDir, file),\n          mtime: fs.statSync(path.join(artifactsDir, file)).mtime\n        }))\n        .sort((a, b) => b.mtime - a.mtime);\n\n      // Keep only the 50 most recent files\n      const filesToDelete = files.slice(50);\n      filesToDelete.forEach(file => {\n        try {\n          fs.unlinkSync(file.path);\n        } catch (error) {\n          console.log(`⚠️ Could not delete ${file.name}:`, error.message);\n        }\n      });\n\n      if (filesToDelete.length > 0) {\n        console.log(`🗑️ Cleaned up ${filesToDelete.length} old test artifacts`);\n      }\n    }\n\n    console.log('✅ Test artifacts cleanup completed');\n  } catch (error) {\n    console.log('⚠️ Test artifacts cleanup failed:', error.message);\n  }\n}\n\nasync function archiveTestResults() {\n  console.log('📦 Archiving test results...');\n\n  try {\n    const testResultsDir = path.join(process.cwd(), 'test-results');\n    const archiveDir = path.join(testResultsDir, 'archive');\n    \n    if (!fs.existsSync(archiveDir)) {\n      fs.mkdirSync(archiveDir, { recursive: true });\n    }\n\n    // Create archive with timestamp\n    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');\n    const archiveName = `test-run-${timestamp}`;\n    const archivePath = path.join(archiveDir, archiveName);\n    \n    if (!fs.existsSync(archivePath)) {\n      fs.mkdirSync(archivePath, { recursive: true });\n    }\n\n    // Copy important files to archive\n    const filesToArchive = [\n      'test-summary.json',\n      'TEST-SUMMARY.md',\n      'junit.xml',\n      'results.json'\n    ];\n\n    filesToArchive.forEach(filename => {\n      const sourcePath = path.join(testResultsDir, filename);\n      const destPath = path.join(archivePath, filename);\n      \n      if (fs.existsSync(sourcePath)) {\n        fs.copyFileSync(sourcePath, destPath);\n      }\n    });\n\n    console.log(`✅ Test results archived to: ${archiveName}`);\n  } catch (error) {\n    console.log('⚠️ Test results archiving failed:', error.message);\n  }\n}"}