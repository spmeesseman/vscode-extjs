
import { Uri, workspace } from "vscode";
import { configuration } from "./configuration";
import * as fs from "fs";
import * as json5 from "json5";
import * as path from "path";
import { IConf } from  "../../../common";
import * as log from "./log";


export class ConfigParser
{
	private sdkDirectory: string | undefined;


    async getConfig(): Promise<IConf[]>
    {
        const config: IConf[] = [],
			  confUris = await workspace.findFiles(".extjsrc{.json,}"),
              appDotJsonUris = await workspace.findFiles("app.json"),
			  fwDirectory = configuration.get<string>("frameworkDirectory");
        let settingsPaths = configuration.get<string[]|string>("include");

        log.methodStart("initialize confdig", 1, "", true);

        //
        // Specific directories set directly in user settings, the `include` setting
        //
        if (settingsPaths)
        {
            if (typeof settingsPaths === "string") {
                settingsPaths = [ settingsPaths ];
            }
            for (const path of settingsPaths)
            {
                const pathParts = path?.split("|");
                if (pathParts.length === 2)
                {
                    config.push({
                        classpath: pathParts[1],
                        name: pathParts[0],
                        baseDir: ""
                    });
                }
            }
        }

        //
        // The `.extjsrc` config files
        //
        if (confUris)
        {
            for (const uri of confUris)
            {
                const fileSystemPath = uri.fsPath || uri.path;
                const confJson = fs.readFileSync(fileSystemPath, "utf8");
                const conf: IConf = json5.parse(confJson);
                if (conf.classpath && conf.name)
                {
                    log.value("   add .extjsrc path", fileSystemPath, 2);
                    log.value("      namespace", conf.name, 2);
                    log.value("      classpath", conf.classpath, 3);
                    config.push(conf);
                }
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
                baseDir: fwDirectory
			});
		}

        //
        // The `app.json` files
        //
        if (appDotJsonUris)
        {
            let foundFwDir = !!fwDirectory;
            for (const uri of appDotJsonUris)
            {
                foundFwDir = this.parseAppDotJson(uri, !fwDirectory && !foundFwDir, config);
            }
        }

        log.value("   # of configs found", config.length, 3);
        log.methodDone("initialize config", 1, "", true);

        return config;
    }


    private parseAppDotJson(uri: Uri, parseFwDir: boolean, config: IConf[]): boolean
    {
        const fileSystemPath = uri.fsPath || uri.path,
              baseDir = path.dirname(uri.fsPath),
              confs: IConf[] = [],
              conf: IConf = json5.parse(fs.readFileSync(fileSystemPath, "utf8"));
        let foundFwDir = false;

        //
        // Merge classpath to root
        //
        const classic = conf.classic ? Object.assign([], conf.classic) : {},
              modern = conf.modern ? Object.assign([], conf.modern) : {};

        if (!conf.classpath)
        {
            conf.classpath = [];
        }
        else if (typeof conf.classpath === "string")
        {
            conf.classpath = [ conf.classpath ];
        }

        if (classic?.classpath)
        {
            conf.classpath = conf.classpath.concat(...classic.classpath);
        }
        if (modern?.classpath) {
            conf.classpath = conf.classpath.concat(...modern.classpath);
        }

        //
        // workspace.json
        //
        const wsDotJsonFsPath = path.join(baseDir, "workspace.json");
        if (fs.existsSync(wsDotJsonFsPath))
        {
            const wsConf = json5.parse(fs.readFileSync(wsDotJsonFsPath, "utf8"));

            if (parseFwDir && wsConf.frameworks && wsConf.frameworks.ext)
            {   //
                // The framework directory should have a package.json, specifying its dependencies, i.e.
                // the ext-core package.  Read package.json in framework directory.  If found, this is an
                // open tooling project
                //
                const fwJsonFsPath = path.join(baseDir, wsConf.frameworks.ext, "package.json");
                if (fs.existsSync(fwJsonFsPath))
                {
                    const fwConf = json5.parse(fs.readFileSync(fwJsonFsPath, "utf8"));
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
                                    baseDir
                                };
                                if (sdkConf.classpath)
                                {
                                    foundFwDir = true;
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
                        baseDir
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
			confs.push(conf);
		}

        if (confs.length)
        {
            log.value("   add app.json paths", fileSystemPath, 2);
            log.value("      namespace", confs[0].name, 2);
            log.value("      classpath", confs[0].classpath, 3);
			if (confs.length > 1) {
				log.write("      framework directory");
				log.value("         namespace", confs[1].name, 2);
				log.value("         classpath", confs[1].classpath, 3);
			}
            config.push(...confs);
        }

        return foundFwDir;
    }

}