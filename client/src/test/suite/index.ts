/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable prefer-arrow/prefer-arrow-functions */
"use strict";

//
import * as path from "path";
import * as Mocha from "mocha";
const NYC = require("nyc");
import * as glob from "glob";

//
// Recommended modules, loading them here to speed up NYC init
// and minimize risk of race condition
//
import "ts-node/register";
import "source-map-support/register";

//
// Linux: prevent a weird NPE when mocha on Linux requires the window size from the TTY
// Since we are not running in a tty environment, we just implementt he method statically
//
if (process.platform === "linux")
{
    const tty = require("tty");
    if (!tty.getWindowSize)
    {
        tty.getWindowSize = (): number[] =>
        {
            return [80, 75];
        };
    }
}

export async function run(): Promise<void>
{
    const testsRoot = path.resolve(__dirname, "..", "..", "..");
    // Setup coverage pre-test, including post-test hook to report
    const nyc = new NYC(
    {
        extends: "@istanbuljs/nyc-config-typescript",
        cwd: path.join(__dirname, "..", "..", "..", ".."),
        reporter: ["text-summary", "html", "lcov", "cobertura" ],
        all: true,
        silent: false,
        instrument: true,
        hookRequire: true,
        hookRunInContext: true,
        hookRunInThisContext: true,
        include: ["dist/**/*.js"],
        exclude: ["dist/test/**"],
    });
    await nyc.wrap();
    //
    // Check the modules already loaded and warn in case of race condition
    // (ideally, at this point the require cache should only contain one file - this module)
    //
    const myFilesRegex = /vscode-recall\/dist/;
    const filterFn = myFilesRegex.test.bind(myFilesRegex);
    if (Object.keys(require.cache).filter(filterFn).length > 1)
    {
        console.warn("NYC initialized after modules were loaded", Object.keys(require.cache).filter(filterFn));
    }

    //
    // Debug which files will be included/excluded
    // console.log('Glob verification', await nyc.exclude.glob(nyc.cwd));
    //
    await nyc.createTempDirectory();

    //
    // Create the mocha test
    //
    const mocha = new Mocha({
        ui: "tdd", // the TDD UI is being used in extension.test.ts (suite, test, etc.)
        useColors: true, // colored output from test results,
        timeout: 30000, // default timeout: 10 seconds
        retries: 1,
        reporter: "mocha-multi-reporters",
        reporterOptions: {
            reporterEnabled: "spec, mocha-junit-reporter",
            mochaJunitReporterReporterOptions: {
                mochaFile: __dirname + "/../../coverage/junit/extension_tests.xml",
                suiteTitleSeparatedBy: ": "
            }
        }
    });

    mocha.useColors(true);

    //
    // Add all files to the test suite
    //
    const files = glob.sync("**/*.test.js", { cwd: testsRoot });
    files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

    const failures: number = await new Promise(resolve => mocha.run(resolve));
    await nyc.writeCoverageFile();

    //
    // Capture text-summary reporter's output and log it in console
    //
    console.log(await captureStdout(nyc.report.bind(nyc)));

    if (failures > 0)
    {
        throw new Error(`${failures} tests failed.`);
    }
}

async function captureStdout(fn: any)
{
    // eslint-disable-next-line prefer-const
    let w = process.stdout.write, buffer = "";
    process.stdout.write = (s: string) => { buffer = buffer + s; return true; };
    await fn();
    process.stdout.write = w;
    return buffer;
}
