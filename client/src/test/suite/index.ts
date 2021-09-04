/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable prefer-arrow/prefer-arrow-functions */
"use strict";

//
import * as path from "path";
import * as Mocha from "mocha";
const { colors } = require("mocha/lib/reporters/base");
// const {colors, symbols} = require("mocha/lib/reporters/base");
const NYC = require("nyc");
// const foreground = require("foreground-child");
import * as glob from "glob";

// import * as baseConfig from "@istanbuljs/nyc-config-typescript";

//
// Recommended modules, loading them here to speed up NYC init
// and minimize risk of race condition
//
import "ts-node/register";
import "source-map-support/register";
import { argv } from "process";

//
// Specify files to test.  SHould be * for full test, use filename for debugging
// specific tests themselves.
//
const fileToTest = "*";
// const fileToTest = "configFile";
// const fileToTest = "document";
// const fileToTest = "hover";
// const fileToTest = "commands";
// const fileToTest = "completion";

//
// Linux: prevent a weird NPE when mocha on Linux requires the window size from the TTY
// Since we are not running in a tty environment, we just implement he method statically
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
    // const testsRoot = path.resolve(__dirname, "..", "..", "..");
    const testsRoot = __dirname,
          nycRoot = path.resolve(__dirname, "..", "..", "..", "..");
    //
    // NYC config
    //
    const nycCfg: any = {
        extends: "@istanbuljs/nyc-config-typescript",
        // ...baseConfig,
        // cwd: path.join(__dirname, "..", "..", "..", ".."),
        cwd: nycRoot,
        // reporter: ["text", "html", "lcov", "cobertura" ],
        reporter: ["text-summary", "html", "lcov", "cobertura" ],
        all: true,
        silent: false,
        instrument: true,
        hookRequire: true,
        hookRunInContext: true,
        hookRunInThisContext: true,
        showProcessTree: true,
        useSpawnWrap: true,           // wrap language server spawn
        include: ["dist/**/*.js"],
        // include: ["dist/**/*.js", "common/lib/*.js"],
        exclude: [ "dist/client/test/**", "dist/client/providers/tasks/**" ] // ,
        // require: [ "bootstrap-fork"]
    };

    //
    // NYC instance
    //
    const nyc = new NYC(nycCfg);

    //
    // Check the modules already loaded and warn in case of race condition
    // (ideally, at this point the require cache should only contain one file - this module)
    //
    const myFilesRegex = /vscode-extjs\/dist/;
    const filterFn = myFilesRegex.test.bind(myFilesRegex);
    if (Object.keys(require.cache).filter(filterFn).length > 1)
    {
        console.warn("NYC initialized after modules were loaded", Object.keys(require.cache).filter(filterFn));
    }

    // Object.keys(require.cache).forEach(f => {
    //     console.log(f);
    // });

    //
    // Debug which files will be included/excluded
    // console.log('Glob verification', await nyc.exclude.glob(nyc.cwd));
    //
    await nyc.createTempDirectory();

    // await nyc.reset();

    // const env: any = {
    //     NYC_CONFIG: JSON.stringify(nycCfg),
    //     NYC_CWD: process.cwd() // nycRoot
    // };

    // if (nycCfg.all) {
    //     await nyc.addAllFiles();
    // }

    // const wrapper = require.resolve("./wrap.js");
    // //Support running nyc as a user without HOME (e.g. linux 'nobody'),
    // //https://github.com/istanbuljs/nyc/issues/951
    // env.SPAWN_WRAP_SHIM_ROOT = process.env.SPAWN_WRAP_SHIM_ROOT || process.env.XDG_CACHE_HOME || require("os").homedir();
    // const sw = require("spawn-wrap");
    // sw([wrapper], env);

    // nycCfg.isChildProcess = true;
    //
    // nycCfg._processInfo = {
    //     pid: process.pid,
    //     ppid: process.ppid,
    //     parent: process.env.NYC_PROCESS_ID || null
    // };
    //
    // if (process.env.NYC_PROCESSINFO_EXTERNAL_ID) {
    //     nycCfg._processInfo.externalId = process.env.NYC_PROCESSINFO_EXTERNAL_ID;
    //     delete process.env.NYC_PROCESSINFO_EXTERNAL_ID;
    // }
    //
    // if (process.env.NYC_CONFIG_OVERRIDE) {
    //     Object.assign(nycCfg, JSON.parse(process.env.NYC_CONFIG_OVERRIDE));
    //     process.env.NYC_CONFIG = JSON.stringify(nycCfg);
    // }

    await nyc.wrap();

    // const suppressEPIPE = function(error: any) {
    //     /* Prevent dumping error when `nyc npm t|head` causes stdout to
    //      * be closed when reporting runs. */
    //     if (error.code !== "EPIPE") {
    //       throw error;
    //     }
    // };

    // Both running the test script invocation and the check-coverage run may
    // set process.exitCode. Keep track so that both children are run, but
    // a non-zero exit codes in either one leads to an overall non-zero exit code.
    // process.exitCode = 0;
    // foreground(argv, async () =>
    // {
    //     const mainChildExitCode = process.exitCode;
    //     try {
    //         // await nyc.writeProcessIndex();
    //
    //         // nyc.maybePurgeSourceMapCache();
    //         // if (argv.checkCoverage) {
    //         // await nyc.checkCoverage({
    //         //     lines: argv.lines,
    //         //     functions: argv.functions,
    //         //     branches: argv.branches,
    //         //     statements: argv.statements
    //         // }, argv['per-file']).catch(suppressEPIPE)
    //         // process.exitCode = process.exitCode || mainChildExitCode
    //         // }
    //
    //         // await nyc.report().catch(suppressEPIPE);
    //     } catch (error) {
    //         /* istanbul ignore next */
    //         process.exitCode = process.exitCode || mainChildExitCode || 1;
    //         /* istanbul ignore next */
    //         console.error(error.message);
    //     }
    // });

    // require("spawn-wrap").runMain();

    //
    // Create the mocha test
    //
    const mocha = new Mocha({
        ui: "tdd", // the TDD UI is being used in extension.test.ts (suite, test, etc.)
        color: true, // colored output from test results,
        timeout: 30000, // default timeout: 10 seconds
        retries: 0,
        // reporter: "mocha-multi-reporters",
        // reporterOptions: {
        //     reporterEnabled: "spec, mocha-junit-reporter",
        //     mochaJunitReporterReporterOptions: {
        //         mochaFile: __dirname + "/../../coverage/junit/extension_tests.xml",
        //         suiteTitleSeparatedBy: ": "
        //     }
        // }
    });
    colors.slow = 33;
    // symbols.ok = "";

    //
    // Add all files to the test suite
    //
    const files = glob.sync(`**/${fileToTest}.test.js`, { cwd: testsRoot });
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
