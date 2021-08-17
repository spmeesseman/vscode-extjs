
import { Uri, workspace } from "vscode";
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

        log.methodStart("initialize configurations", 1, "", true);

        //
        // Specific directories set directly in user settings, the `include` setting
        //
        for (const path of settingsPaths)
        {
            const pathParts = path?.split("|");
            if (pathParts.length === 2)
            {
                config.push({
                    classpath: pathParts[1],
                    name: pathParts[0],
                    baseDir: "",
                    baseWsDir: "",
                    buildDir: "",
                    wsDir: workspace.getWorkspaceFolder(Uri.file(pathParts[1]))?.uri.fsPath || "",
                });
            }
        }

        //
        // The `.extjsrc` config files
        //
        for (const uri of confUris)
        {
            const fileSystemPath = uri.fsPath || uri.path;
            const confJson = await readFile(fileSystemPath);
            const conf: IConf = json5.parse(confJson);
            if (conf.classpath && conf.name)
            {
                log.value("   add .extjsrc path", fileSystemPath, 2);
                log.value("      namespace", conf.name, 2);
                log.value("      classpath", conf.classpath, 3);
                config.push(conf);
            }
        }

		//
		// Frameworkdirectory, as specified in VSCode settings.  If not specified, the app.json
		// parser will read the first framework directory found when parsing workspace.json.
		//
		if (fwDirectory)
		{
			config.push({
				classpath: fwDirectory.replace("\\", "/"),
				name: "Ext",
                baseDir: fwDirectory,
                baseWsDir: fwDirectory,
                buildDir: "",
                wsDir: workspace.getWorkspaceFolder(Uri.file(fwDirectory))?.uri.fsPath || fwDirectory
			});
		}

        //
        // The `app.json` files
        //
        for (const uri of appDotJsonUris)
        {
            await this.parseAppDotJson(uri, config);
        }

        log.value("   # of configs found", config.length, 3);
        log.methodDone("initialize config", 1, "", true);

        return config;
    }


    private async parseAppDotJson(uri: Uri, config: IConf[])
    {
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

        if (!conf.classpath)
        {
            conf.classpath = [];
        }
        else if (typeof conf.classpath === "string")
        {
            conf.classpath = [ conf.classpath ];
        }

        //
        // Merge classpath to root
        //
        const classic = conf.classic ? Object.assign([], conf.classic) : {},
              modern = conf.modern ? Object.assign([], conf.modern) : {};


        if (classic.classpath)
        {
            conf.classpath = conf.classpath.concat(...classic.classpath);
        }
        if (modern.classpath)
        {
            conf.classpath = conf.classpath.concat(...modern.classpath);
        }

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
                const buildDir = wsConf.build ? wsConf.build.dir.replace(/\$\{workspace.dir\}[/\\]{1}/, "") : undefined;
                const fwJsonFsPath = path.join(baseDir, wsConf.frameworks.ext, "package.json");
                if (await pathExists(fwJsonFsPath))
                {
                    const fwConf = json5.parse(await readFile(fwJsonFsPath));
                    if (fwConf.dependencies)
                    {
                        for (const dep in fwConf.dependencies)
                        {
                            if (fwConf.dependencies.hasOwnProperty(dep))
                            {
								const fwPath = path.join("node_modules", dep).replace(/\\/g, "/");
                                const sdkConf: IConf = {
                                    name: "Ext",
                                    // eslint-disable-next-line no-template-curly-in-string
                                    classpath: fwConf.sencha?.classpath?.replace("${package.dir}", fwPath),
                                    baseDir,
                                    baseWsDir,
                                    buildDir,
                                    wsDir
                                };
                                if (sdkConf.classpath)
                                {
                                    confs.push(sdkConf);
                                    log.value("   add framework package.json path", fwPath, 2);
                                    log.value("      framework version", fwConf.dependencies[dep], 2);
                                }
                            }
                        }
                    }
                    else {
                        log.error("No package.json found in workspace.framework directory");
                    }
                }
                else {
					confs.push({
						name: "Ext",
						classpath: wsConf.frameworks.ext,
                        baseDir,
                        baseWsDir,
                        buildDir,
                        wsDir
					});
                    log.value("   add ws.json framework path", wsConf.frameworks.ext, 2);
                }
            }

            if (wsConf.packages && wsConf.packages.dir)
            {
                const dirs = wsConf.packages.dir.split(",");
                for (const d of dirs)
                {
                    const wsPath = d.replace(/\$\{workspace.dir\}[/\\]{1}/, "")
                                    .replace(/\$\{toolkit.name\}/, "classic");
                    conf.classpath.push(wsPath);
                    log.value("   add ws.json path", wsPath, 2);
                }
            }
        }

		if (conf.classpath && conf.name)
        {
            conf.baseDir = baseDir;
            conf.baseWsDir = baseWsDir;
            conf.wsDir = wsDir;
			confs.push(conf);
		}

        if (confs.length)
        {
            log.value("   add app.json paths", fileSystemPath, 2);
            log.value("      namespace", confs[0].name, 2);
            log.value("      classpath", confs[0].classpath, 3);
            log.value("      workspace dir", confs[0].baseWsDir, 3);
			if (confs.length > 1) {
				log.write("      framework directory");
				log.value("         namespace", confs[1].name, 2);
				log.value("         classpath", confs[1].classpath, 3);
				log.value("         workspace dir", confs[1].baseWsDir, 3);
			}
            config.push(...confs);
        }
    }

}
