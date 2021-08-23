
import { Uri, window, workspace } from "vscode";
import { configuration } from "./configuration";
import { IConf } from  "../../../common";
import * as log from "./log";
import { deleteDir, pathExists, readFile } from "../../../common/lib/fs";
import * as json5 from "json5";
import * as path from "path";


export class ConfigParser
{
	private sdkDirectory: string | undefined;


    async getConfig(): Promise<IConf[]>
    {
        const config: IConf[] = [],
			  confUris = await workspace.findFiles("**/.extjsrc{.json,}"),
              appDotJsonUris = await workspace.findFiles("**/app.json"),
			  fwDirectory = configuration.get<string>("frameworkDirectory"),
              settingsPaths = configuration.get<string[]>("include", []);

        // workspace.workspaceFolders?.map(folder => folder.uri.path)

        log.methodStart("get extjs configuration", 1, "", true);

        //
        // Specific directories set directly in user settings, the `include` setting
        //
        for (const path of settingsPaths)
        {
            const pathParts = path?.split("|");
            if (pathParts.length === 2)
            {
                config.push({
                    classpath: [ pathParts[1] ],
                    name: pathParts[0],
                    baseDir: "",
                    baseWsDir: "",
                    buildDir: "",
                    wsDir: workspace.getWorkspaceFolder(Uri.file(pathParts[1]))?.uri.fsPath || "",
                });
            }
            else {
                window.showWarningMessage(`Invalid include path ${path} - must be 'namespace|path'`);
            }
        }

        //
        // The `.extjsrc` config files
        //
        for (const uri of confUris)
        {
            const fileSystemPath = uri.fsPath || uri.path,
                  confJson = await readFile(fileSystemPath),
                  conf: IConf = json5.parse(confJson);
            if (conf.classpath && conf.name)
            {
                if (!(conf.classpath instanceof Array)) {
                    conf.classpath = [ conf.classpath ];
                }
                log.value("   add .extjsrc path", fileSystemPath, 1);
                log.value("      namespace", conf.name, 2);
                log.value("      classpath", conf.classpath, 2);
                config.push(conf);
            }
        }

		//
		// Frameworkdirectory, as specified in VSCode settings.  If not specified, the app.json
		// parser will read the first framework directory found when parsing workspace.json.
		//
		if (fwDirectory)
		{
            log.value("   add framework path from settings", fwDirectory, 1);
			config.push({
				classpath: [ fwDirectory.replace("\\", "/") ],
				name: "Ext",
                baseDir: fwDirectory,
                baseWsDir: fwDirectory,
                buildDir: "",
                wsDir: workspace.getWorkspaceFolder(Uri.file(fwDirectory))?.uri.fsPath || fwDirectory,
                frameworkDir: fwDirectory
			});
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


    private async parseAppDotJson(uri: Uri, config: IConf[], logPad: string)
    {
        log.methodStart("parse app.json", 1, logPad, true, [["path", uri.fsPath]]);

        const fileSystemPath = uri.fsPath,
              baseDir = path.dirname(uri.fsPath),
              wsDir = workspace.getWorkspaceFolder(uri)?.uri.fsPath || baseDir,
              //
              // baseWsDir should be the relative path from the workspace folder root to the app.json
              // file.  The Language Manager will use workspace.findFiles which will require a path
              // relative to a workspace folder.
              //
              baseWsDir = path.dirname(uri.fsPath.replace(wsDir || baseDir, ""))
                              .replace(/\\/g, "/").substring(1), // trim leading path sep
              confs: IConf[] = [],
              conf: IConf = json5.parse(await readFile(fileSystemPath));

        if (!conf.name)
        {
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
                conf.classpath.push(...classic.classpath.filter((c2: string) => !conf.classpath.includes(c2)));
            }
        }
        if (modern.classpath)
        {
            log.write("      add classpaths for 'modern' toolkit", 1, logPad);
            for (const c of modern.classpath)
            {
                log.value("         path", c, 1, logPad);
                conf.classpath.push(...modern.classpath.filter((c2: string) => !conf.classpath.includes(c2)));
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
            const wsConf = json5.parse(await readFile(wsDotJsonFsPath));

            if (wsConf.frameworks && wsConf.frameworks.ext)
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
                    const fwConf = json5.parse(await readFile(fwJsonFsPath));
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
                                    log.write(`      add dependency package '${dep}'`, 1, logPad);
                                    log.value("         path", fwPath, 1, logPad);
                                    log.value("         version", fwConf.dependencies[dep], 1, logPad);
                                    confs.push({
                                        name: "Ext",
                                        classpath: [ fwSdkClasspath ],
                                        baseDir,
                                        baseWsDir,
                                        buildDir,
                                        wsDir,
                                        frameworkDir
                                    });
                                }
                            }
                        }
                    }
                }
                else {
                    log.write("   this is a sencha cmd project", 1, logPad);
                    log.value("   add ws.json framework path", wsConf.frameworks.ext, 1, logPad);
					confs.push({
						name: "Ext",
						classpath: [ wsConf.frameworks.ext ],
                        baseDir,
                        baseWsDir,
                        buildDir,
                        wsDir,
                        frameworkDir
					});
                }
            }

            if (wsConf.packages && wsConf.packages.dir)
            {
                log.write("   process workspace.json dependency packages from packages.dir", 1, logPad);
                const dirs = wsConf.packages.dir.split(",");
                for (const d of dirs)
                {
                    const toolkit = configuration.get<string>("toolkit", "classic"),
                          wsPath = d.replace(/\$\{workspace.dir\}[/\\]{1}/, "").replace(/\$\{toolkit.name\}/, toolkit);
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
            log.value("      namespace", confs[0].name, 1, logPad);
            log.value("      path", fileSystemPath, 1, logPad);
            log.value("      workspace rel dir", confs[0].baseWsDir, 1, logPad);
            log.value("      base project dir", confs[0].baseDir, 1, logPad);
            log.write("      classpaths:", 1, logPad);
            confs[0].classpath.every((c) => {
                log.write(`         ${confs[0].classpath}`, 1, logPad);
            });
			if (confs.length > 1) {
				log.write("      framework directory:");
				log.value("         namespace", confs[1].name, 1, logPad);
				log.value("         workspace rel dir", confs[1].baseWsDir, 1, logPad);
                log.write("         classpaths:", 1, logPad);
                confs[1].classpath.every((c) => {
                    log.write(`            ${confs[1].classpath}`, 1, logPad);
                });
			}
            config.push(...confs);
        }

        log.methodDone("parse app.json", 1, logPad);
    }

}
