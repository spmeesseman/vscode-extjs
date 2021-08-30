
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
        const config: IConf[] = [],
			  confUris = await workspace.findFiles("**/.extjsrc{.json,}"),
              appDotJsonUris = await workspace.findFiles("**/app.json"),
              settingsPaths = configuration.get<string[]>("include", []);

        // workspace.workspaceFolders?.map(folder => folder.uri.path)

        log.methodStart("get extjs configuration", 1, "", true);

        //
        // Specific directories set directly in user settings, the `include` setting
        //
        for (const sPath of settingsPaths)
        {
            const pathParts = sPath.split("|");
            if (pathParts.length === 2 && pathParts[1])
            {   //
                // Only include paths that exist in the active workspace
                //
                const sWsFolder = workspace.getWorkspaceFolder(Uri.file(pathParts[1]));
                if (sWsFolder)
                {
                    log.value("   add settings conf", sPath, 1);
                    const sConf: IConf = {
                        classpath: [ pathParts[1] ],
                        name: pathParts[0],
                        baseDir: path.dirname(pathParts[1]),
                        baseWsDir: ".",
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

        //
        // The `.extjsrc` config files
        //
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
            }
            if (conf && conf.classpath && conf.name)
            {
                const baseDir = path.dirname(uri.fsPath),
                      wsDir = (workspace.getWorkspaceFolder(uri) as WorkspaceFolder).uri.fsPath;
                //
                // baseWsDir should be the relative path from the workspace folder root to the app.json
                // file.  The Language Manager will use workspace.findFiles which will require a path
                // relative to a workspace folder.
                //
                const baseWsDir = path.dirname(uri.fsPath.replace(wsDir, ""))
                                .replace(/\\/g, "/").substring(1); // trim leading path sep

                if (!(conf.classpath instanceof Array)) {
                    conf.classpath = [ conf.classpath ];
                }

                conf.baseDir = baseDir;
                conf.baseWsDir = baseWsDir;
                conf.wsDir = wsDir;

                log.value("   add .extjsrc conf", fileSystemPath, 1);
                this.logConf(conf);
                config.push(conf);

                if (conf.framework)
                {
                    if (await pathExists(conf.framework))
                    {
                        const fwConf: IConf = {
                            classpath: [ path.relative(baseDir, conf.framework) ],
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

                config.push(conf);
            }
        }

		//
		// Frameworkdirectory, as specified in VSCode settings.  If not specified, the app.json
		// parser will read the first framework directory found when parsing workspace.json.
		//
        const fwDirectory = configuration.get<string>("frameworkDirectory");
		if (fwDirectory)
		{
            if (await pathExists(fwDirectory))
            {
                const fwConf: IConf = {
                    classpath: [ fwDirectory ],
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

        //
        // The `app.json` files
        //
        for (const uri of appDotJsonUris)
        {
            await this.parseAppDotJson(uri, config, "   ");
        }

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


    private async parseAppDotJson(uri: Uri, config: IConf[], logPad: string)
    {
        log.methodStart("parse app.json", 1, logPad, true, [["path", uri.fsPath]]);

        const fileSystemPath = uri.fsPath,
              baseDir = path.dirname(uri.fsPath),
              wsDir = (workspace.getWorkspaceFolder(uri) as WorkspaceFolder).uri.fsPath,
              //
              // baseWsDir should be the relative path from the workspace folder root to the app.json
              // file.  The Language Manager will use workspace.findFiles which will require a path
              // relative to a workspace folder.
              //
              baseWsDir = path.dirname(uri.fsPath.replace(wsDir, ""))
                              .replace(/\\/g, "/").substring(1), // trim leading path sep
              confs: IConf[] = [];

        let conf: IConf | undefined;
        try {
            conf = json5.parse(await readFile(fileSystemPath));
        }
        catch { conf = undefined; }

        if (!conf)
        {
            window.showWarningMessage(`Invalid .extjsrc file ${uri.fsPath} - invalid JSON`);
            return confs;
        }
        else if (!conf.name)
        {
            window.showWarningMessage(`Invalid .extjsrc file ${uri.fsPath} - no 'name' property found`);
            return confs;
        }
        else if (!conf.classpath && (!conf.classic || !conf.classic.classpath) && (!conf.modern || !conf.modern.classpath))
        {
            window.showWarningMessage(`Invalid .extjsrc file ${uri.fsPath} - no 'classpath' properties found`);
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
            catch { wsConf = undefined; }

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
                {   //
                    // There should be a reference to the core package in the 'dependencies' property of
                    // package.json, e.g.:
                    //
                    //     "dependencies": {
                    //         "@sencha/ext-core": "7.2.0"
                    //     }
                    //
                    log.write("   this is an open tooling project", 1, logPad);
                    let fwConf: any | undefined;
                    try {
                        fwConf = json5.parse(await readFile(fwJsonFsPath));
                    }
                    catch { fwConf = undefined; }
                    if (fwConf && fwConf.dependencies)
                    {
                        log.write("   process framework dependency packages", 1, logPad);
                        for (const dep in fwConf.dependencies)
                        {
                            if (fwConf.dependencies.hasOwnProperty(dep))
                            {
								const fwPath = path.join("node_modules", dep).replace(/\\/g, "/"),
                                      // eslint-disable-next-line no-template-curly-in-string
                                      fwSdkClasspath = fwConf.sencha?.classpath?.replace("${package.dir}", fwPath);
                                if (fwSdkClasspath)
                                {
                                    const fwSdkConf = {
                                        name: "Ext",
                                        classpath: [ fwSdkClasspath ],
                                        baseDir,
                                        baseWsDir,
                                        buildDir,
                                        wsDir,
                                        frameworkDir
                                    };
                                    log.write(`      add dependency package '${dep}'`, 1, logPad);
                                    log.value("         path", fwPath, 1, logPad);
                                    log.value("         version", fwConf.dependencies[dep], 1, logPad);
                                    this.logConf(fwSdkConf);
                                    confs.push(fwSdkConf);
                                }
                            }
                        }
                    }
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

            if (wsConf.packages && wsConf.packages.dir)
            {
                log.write("   process workspace.json dependency packages from packages.dir", 1, logPad);
                const dirs = wsConf.packages.dir.split(","),
                      toolkit = configuration.get<string>("toolkit", "classic");
                for (const d of dirs)
                {
                    const wsPath = d.replace(/\$\{workspace.dir\}[/\\]{1}/, "").replace(/\$\{toolkit.name\}/, toolkit);
                    log.write("      add dependency package", 1, logPad);
                    log.value("         path", wsPath, 1, logPad);
                    if (!conf.classpath.includes(wsPath)) {
                        conf.classpath.push(wsPath);
                    }
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

}
