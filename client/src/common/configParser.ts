
import { Uri, window, workspace, WorkspaceFolder } from "vscode";
import { configuration } from "./configuration";
import { IConf } from  "../../../common";
import * as log from "./log";
import { pathExists, readFile } from "../../../common/lib/fs";
import * as json5 from "json5";
import * as path from "path";


export class ConfigParser
{

    async getConfig(): Promise<IConf[]>
    {
        const config: IConf[] = [];
        log.methodStart("get extjs configuration", 1, "", true);
        //
        // Specific directories set directly in user settings, the `include` setting
        //
        await this.parseSettings(config);
        //
        // The `.extjsrc` config files
        //
        await this.parseExtjsrcFiles(config);
		//
		// Frameworkdirectory, as specified in VSCode settings.  If not specified, the app.json
		// parser will read the first framework directory found when parsing workspace.json.
		//
        await this.parseSettingsFrameworkPath(config);
        //
        // The `app.json` files
        //
        await this.parseAppDotJsonFiles(config);
        //
        // All done
        //
        log.methodDone("get extjs configuration", 1, "", true, [["# of configured projects found", config.length]]);
        return config;
    }


    private logConf(conf: IConf)
    {
        log.value("      namespace", conf.name, 2);
        log.value("      classpath", conf.classpath, 2);
        log.value("      workspace rel dir", conf.baseWsDir, 1);
        log.value("      base project dir", conf.baseDir, 1);
        log.write("      classpaths:", 1);
        conf.classpath.every((c) => {
            log.write(`         ${c}`, 1);
        });
    }


    private async parseAppDotJsonFiles(config: IConf[])
    {
        const appDotJsonUris = await workspace.findFiles("**/app.json");
        for (const uri of appDotJsonUris)
        {
            await this.parseAppDotJson(uri, config, "   ");
        }
    }


    private async parseAppDotJson(uri: Uri, config: IConf[], logPad: string)
    {
        log.methodStart("parse app.json", 1, logPad, true, [["path", uri.fsPath]]);

        const fileSystemPath = uri.fsPath,
              baseDir = path.dirname(uri.fsPath),
              wsDir = (workspace.getWorkspaceFolder(uri) as WorkspaceFolder).uri.fsPath,
              baseWsDir = path.dirname(path.normalize(path.relative(wsDir, uri.fsPath))),
              confs: IConf[] = [];

        let conf: IConf | undefined;
        try {
            conf = json5.parse(await readFile(fileSystemPath));
        }
        catch { conf = undefined; }

        if (!conf)
        {
            window.showWarningMessage(`Invalid app.json file ${uri.fsPath} - invalid JSON`);
            return confs;
        }
        else if (!conf.name)
        {
            window.showWarningMessage(`Invalid app.json file ${uri.fsPath} - no 'name' property found`);
            return confs;
        }
        else if (!conf.classpath && (!conf.classic || !conf.classic.classpath) && (!conf.modern || !conf.modern.classpath))
        {
            window.showWarningMessage(`Invalid app.json file ${uri.fsPath} - no 'classpath' properties found`);
            return confs;
        }

        if (!conf.classpath)
        {
            conf.classpath = [];
        }
        else if (!(conf.classpath instanceof Array))
        {
            conf.classpath = [ conf.classpath ];
        }

        //
        // Merge classpath to root
        //
        const classic = conf.classic ? Object.assign([], conf.classic) : {},
              modern = conf.modern ? Object.assign([], conf.modern) : {};


        log.write("   process toolkit specific classpaths", 1, logPad);
        if (classic.classpath)
        {
            log.write("      add classpaths for 'classic' toolkit", 1, logPad);
            for (const c of classic.classpath)
            {
                log.value("         path", c, 1, logPad);
                conf.classpath.push(...classic.classpath.filter((c2: string) => conf && !conf.classpath.includes(c2)));
            }
        }
        if (modern.classpath)
        {
            log.write("      add classpaths for 'modern' toolkit", 1, logPad);
            for (const c of modern.classpath)
            {
                log.value("         path", c, 1, logPad);
                conf.classpath.push(...modern.classpath.filter((c2: string) => conf && !conf.classpath.includes(c2)));
            }
        }

        //
        // Push the main configuration (project level)
        //
        conf.baseDir = baseDir;
        conf.baseWsDir = baseWsDir;
        conf.wsDir = wsDir;
        confs.push(conf);

        //
        // workspace.json
        //
        const wsDotJsonFsPath = path.join(baseDir, "workspace.json");
        if (await pathExists(wsDotJsonFsPath))
        {
            let wsConf: any | undefined;
            try {
                wsConf = json5.parse(await readFile(wsDotJsonFsPath));
            }
            catch {
                wsConf = undefined;
                window.showWarningMessage(`Invalid workspace.json file ${uri.fsPath} - invalid JSON`);
            }

            if (wsConf && wsConf.frameworks && wsConf.frameworks.ext)
            {   //
                // The framework directory should have a package.json, specifying its dependencies, i.e.
                // the ext-core package.  Read package.json in framework directory.  If found, this is an
                // open tooling project
                //
                const buildDir = wsConf.build ? wsConf.build.dir.replace(/\$\{workspace.dir\}[/\\]{1}/, "") : undefined,
                      frameworkDir = path.join(baseDir, wsConf.frameworks.ext),
                      fwJsonFsPath = path.join(frameworkDir, "package.json");
                if (await pathExists(fwJsonFsPath))
                {
                    log.write("   this is an open tooling project", 1, logPad);
                    //
                    // There should be a reference to the core package in the 'dependencies' property of
                    // package.json, e.g.:
                    //
                    //     "dependencies": {
                    //         "@sencha/ext-core": "7.2.0"
                    //     }
                    //
                    const { classpath } = await this.parsePackageJson(fwJsonFsPath, baseDir, logPad + "   ", /@sencha/);
                    const fwSdkConf = {
                        name: "Ext",
                        classpath,
                        baseDir,
                        baseWsDir,
                        buildDir,
                        wsDir,
                        frameworkDir
                    };
                    this.logConf(fwSdkConf);
                    confs.push(fwSdkConf);
                }
                else {
                    const cmdConf = {
						name: "Ext",
						classpath: [ wsConf.frameworks.ext ],
                        baseDir,
                        baseWsDir,
                        buildDir,
                        wsDir,
                        frameworkDir
					};
                    log.write("   this is a sencha cmd project", 1, logPad);
                    log.value("   add ws.json framework path", wsConf.frameworks.ext, 1, logPad);
                    this.logConf(cmdConf);
					confs.push(cmdConf);
                }
            }

            if (wsConf && wsConf.packages && wsConf.packages.dir)
            {
                log.write("   process workspace.json dependency packages from packages.dir", 1, logPad);
                const dirs = wsConf.packages.dir.split(","),
                      toolkit = configuration.get<string>("toolkit", "classic");
                for (const d of dirs)
                {
                    const wsRelPath = d.replace(/\$\{workspace.dir\}[/\\]{1}/, "").replace(/\$\{toolkit.name\}/, toolkit),
                          wsFullPath = d.replace(/\$\{workspace.dir\}/, baseDir).replace(/\$\{toolkit.name\}/, toolkit);
                    log.write("      add dependency package", 1, logPad);
                    log.value("         path", wsRelPath, 1, logPad);
                    const { classpath, ns } = await this.parsePackageJson(path.normalize(path.join(wsFullPath, "package.json")), baseDir, logPad + "         ");
                    if (classpath.length > 0)
                    {
                        for (const clsPath of classpath)
                        {
                            if (confs.length > 1 && ns === "Ext")
                            {
                                if (!confs[1].classpath.includes(clsPath)) {
                                    confs[1].classpath.push(clsPath);
                                }
                            }
                            else if (!conf.classpath.includes(clsPath)) {
                                conf.classpath.push(clsPath);
                            }
                        }
                    }
                    else if (!conf.classpath.includes(wsRelPath)) {
                        conf.classpath.push(wsRelPath);
                    }
                    log.write("      add dependency package complete", 1, logPad);
                }
            }
        }

        if (confs.length)
        {
            log.write("   successfully parsed app.json:", 1, logPad);
            this.logConf(confs[0]);
			if (confs.length > 1) {
				log.write("      framework directory:");
				log.value("         namespace", confs[1].name, 1, logPad);
				log.value("         workspace rel dir", confs[1].baseWsDir, 1, logPad);
                log.write("         classpaths:", 1, logPad);
                confs[1].classpath.every((c) => {
                    log.write(`            ${c}`, 1, logPad);
                });
			}
            config.push(...confs);
        }

        log.methodDone("parse app.json", 1, logPad);
    }


    private async parseExtjsrcFiles(config: IConf[])
    {
        const confUris = await workspace.findFiles("**/.extjsrc{.json,}");

        for (const uri of confUris)
        {
            const fileSystemPath = uri.fsPath,
                  confJson = await readFile(fileSystemPath);

            let conf: IConf | undefined;
            try {
                conf = json5.parse(confJson);
            }
            catch {
                window.showWarningMessage(`Invalid .extjsrc file ${path} - invalid JSON`);
                continue;
            }
            if (conf && conf.classpath && conf.name)
            {
                const baseDir = path.dirname(uri.fsPath),
                      wsDir = (workspace.getWorkspaceFolder(uri) as WorkspaceFolder).uri.fsPath;
                if (!(conf.classpath instanceof Array)) {
                    conf.classpath = [ conf.classpath ];
                }

                conf.baseDir = baseDir;
                conf.baseWsDir = path.dirname(path.normalize(path.relative(wsDir, uri.fsPath)));
                conf.wsDir = wsDir;

                log.value("   add .extjsrc conf", fileSystemPath, 1);
                this.logConf(conf);
                config.push(conf);

                if (conf.framework)
                {
                    if (await pathExists(conf.framework))
                    {
                        const fwConf: IConf = {
                            classpath: [ path.normalize(path.relative(baseDir, conf.framework)) ],
                            name: "Ext",
                            baseDir,
                            baseWsDir: ".", // path.relative(baseDir, conf.framework),
                            buildDir: "",
                            wsDir: conf.framework,
                            frameworkDir: conf.framework
                        };
                        log.value("   add framework conf from .extjsrc", conf.framework, 1);
                        this.logConf(conf);
                        config.push(fwConf);
                    }
                    else {
                        window.showWarningMessage(`Invalid framework path ${uri.fsPath} - does not exist`);
                    }
                }

                // const buildDir = conf.build ? conf.build.dir.replace(/\$\{workspace.dir\}[/\\]{1}/, "") : undefined,

                config.push(conf);
            }
        }
    }


    private async parsePackageJson(packageJsonFile: string, baseDir: string, logPad: string, includeDependency?: RegExp)
    {
        let ns: string | undefined;
        const classpath: string[] = [];

        log.methodStart("parse package.json", 1, logPad, false, [["file", packageJsonFile]]);

        if (await pathExists(packageJsonFile))
        {
            let packageJson: any | undefined;
            try {
                packageJson = json5.parse(await readFile(packageJsonFile));
            }
            catch { packageJson = undefined; }

            if (packageJson && packageJson.sencha)
            {
                ns = packageJson.sencha.namespace;

                if (includeDependency && packageJson.dependencies)
                {
                    for (const dep in packageJson.dependencies)
                    {
                        if (includeDependency.test(dep))
                        {
                            const fwPath = path.normalize(path.join(baseDir, "node_modules", dep, "package.json"));
                            classpath.push(...(await this.parsePackageJson(fwPath, baseDir, logPad + "   ", includeDependency)).classpath);
                            log.write(`   add dependency package classpaths'${dep}'`, 1, logPad);
                            log.value("      path", fwPath, 1, logPad);
                            log.value("      version", packageJson.dependencies[dep], 1, logPad);
                        }
                    }
                }

                if (packageJson.sencha.classpath)
                {
                    let packageClsPath: string | string[] =  packageJson.sencha.classpath;
                    if (!(packageClsPath instanceof Array)) {
                        packageClsPath = [ packageClsPath ];
                    }
                    classpath.push(...packageClsPath);
                }
                if (packageJson.sencha.classic && packageJson.sencha.classic.classpath)
                {
                    let packageClsPathClassic: string | string[] = packageJson.sencha.classic.classpath;
                    if (!(packageClsPathClassic instanceof Array)) {
                        packageClsPathClassic = [ packageClsPathClassic ];
                    }
                    classpath.push(...packageClsPathClassic);
                }
                if (packageJson.sencha.modern && packageJson.sencha.modern.classpath)
                {
                    let packageClsPathModern: string | string[] = packageJson.sencha.modern.classpath;
                    if (!(packageClsPathModern instanceof Array)) {
                        packageClsPathModern = [ packageClsPathModern ];
                    }
                    classpath.push(...packageClsPathModern);
                }
            }

            const relPath = path.relative(baseDir, path.dirname(packageJsonFile)),
                  toolkit = configuration.get<string>("toolkit", "classic");
            for (const i in classpath) {
                // eslint-disable-next-line no-template-curly-in-string
                classpath[i] = path.normalize(classpath[i].replace("${package.dir}", relPath).replace("${toolkit.name}", toolkit));
            }
        }

        log.methodDone("parse package.json", 1, logPad);
        return { classpath, ns };
    }


    private async parseSettings(config: IConf[])
    {
        const settingsPaths = configuration.get<string[]>("include", []);

        for (const sPath of settingsPaths)
        {
            const pathParts = sPath.split("|");
            if (pathParts.length === 2 && pathParts[1])
            {   //
                // Only include paths that exist in the active workspace
                //
                const sWsFolder = workspace.getWorkspaceFolder(Uri.file(pathParts[1]));
                if (sWsFolder && path.isAbsolute(pathParts[1]))
                {
                    log.value("   add settings conf", sPath, 1);
                    const clsPathRel = path.normalize(path.relative(sWsFolder.uri.fsPath, pathParts[1]));
                    const sConf: IConf = {
                        classpath: [ clsPathRel ],
                        name: pathParts[0],
                        baseDir: path.normalize(pathParts[1]),
                        baseWsDir: clsPathRel,
                        buildDir: "",
                        wsDir: sWsFolder.uri.fsPath
                    };
                    this.logConf(sConf);
                    config.push(sConf);
                }
            }
            else {
                window.showWarningMessage(`Invalid include path ${sPath} - must be 'namespace|path'`);
            }
        }
    }


    private async parseSettingsFrameworkPath(config: IConf[])
    {
        const fwDirectory = configuration.get<string>("frameworkDirectory");
		if (fwDirectory)
		{
            if (await pathExists(fwDirectory))
            {
                const fwConf: IConf = {
                    classpath: [ path.normalize(fwDirectory) ],
                    name: "Ext",
                    baseDir: fwDirectory,
                    baseWsDir: ".",
                    buildDir: "",
                    wsDir: workspace.getWorkspaceFolder(Uri.file(fwDirectory))?.uri.fsPath || fwDirectory,
                    frameworkDir: fwDirectory
                };
                log.value("   add framework path from settings", fwDirectory, 1);
                this.logConf(fwConf);
                config.push(fwConf);
            }
            else {
                window.showWarningMessage(`Invalid framework path ${fwDirectory} - does not exist`);
            }
		}
    }

}
