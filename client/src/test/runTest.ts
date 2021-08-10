
import * as path from "path";
// eslint-disable-next-line import/no-extraneous-dependencies
import { runTests } from "vscode-test";


async function main()
{
    try {
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
    }
    catch (err) {
        console.error(`Failed to run tests: ${err}\n${err.stack}`);
        process.exit(1);
    }
}

main();
