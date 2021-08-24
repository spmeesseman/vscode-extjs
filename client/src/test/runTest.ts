
import { execSync } from "child_process";
import * as path from "path";
// eslint-disable-next-line import/no-extraneous-dependencies
// import { runTests } from "vscode-test";
// eslint-disable-next-line import/no-extraneous-dependencies
import { runTests } from "@vscode/test-electron";


async function main()
{
    try {
        console.log("clear package.json activation event");
        execSync("enable-full-coverage.sh", { cwd: "tools" });
        //
        // The folder containing the Extension Manifest package.json
        // Passed to '--extensionDevelopmentPath'
        //
        const extensionDevelopmentPath = path.resolve(__dirname, "../../../");
        //
        // The path to test runner
        // Passed to --extensionTestsPath
        //
        const extensionTestsPath = path.resolve(__dirname, "./suite/index");
        const extensionTestsWsPath = path.resolve(__dirname, "../../../client/testFixture");
        //
        // Download VS Code, unzip it and run the integration test
        //
        await runTests({
            version: process.env.CODE_VERSION,
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [ "--disable-extensions", "--disable-workspace-trust", extensionTestsWsPath ]
        });
        console.log("restore package.json activation event");
        execSync("enable-full-coverage.sh --off", { cwd: "tools" });
    }
    catch (err) {
        console.error(`Failed to run tests: ${err}\n${err.stack ?? "No call stack details found"}`);
        console.log("restore package.json activation event");
        execSync("enable-full-coverage.sh --off", { cwd: "tools" });
        process.exit(1);
    }
}

main();
