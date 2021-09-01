
import * as path from "path";
import * as log from "../common/log";
import { glob } from "glob";
import { readFile, writeFile } from "../../../common/lib/fs";
import { commands, ExtensionContext, Uri, window, workspace, WorkspaceFolder } from "vscode";
import { extjsLangMgr } from "../extension";
import { tmpdir } from "os";

let fsStoragePath: string;


function dumpCache(project?: string, logPad = "   ", logLevel = 1)
{
    return new Promise(async (resolve, reject) =>
    {
        log.methodStart("dump cache command", logLevel, logPad, true, [["cache path", fsStoragePath]]);

        if (workspace.workspaceFolders && !extjsLangMgr.isBusy())
        {
            let cmpPath = fsStoragePath,
                fileGlob = "**/components.json";

            if (project)
            {
                cmpPath = path.join(fsStoragePath, project);
            }
            else
            {
                fileGlob = "";
                for (const wsFolder of workspace.workspaceFolders)
                {
                    if (fileGlob !== "") { fileGlob += ","; }
                    fileGlob += `${path.basename(wsFolder.uri.fsPath)}`;
                }
                fileGlob = workspace.workspaceFolders.length > 1 ? `{${fileGlob}}/**/components.json` :
                                                                   `${fileGlob}/**/components.json`;
            }

            glob(fileGlob, { nocase: true, ignore: "flags/**", cwd: cmpPath }, async (err, files) =>
            {
                log.write(`   dumping ${files.length} cached ast files to formatted JSON files`, logLevel, logPad);
                for (const f of files)
                {
                    log.value("      file", f, logLevel, logPad);
                    const fullPath = path.join(cmpPath, f),
                          jso = JSON.parse(await readFile(fullPath)),
                          nameSpace = path.basename(path.dirname(f)),
                          projectSpace = project || f.substring(0, f.indexOf("/")) || f,
                          tmpFile = path.join(tmpdir(), `${projectSpace}-${nameSpace}.json`);
                    await writeFile(tmpFile, JSON.stringify(jso, undefined, 4));
                    await window.showTextDocument(await workspace.openTextDocument(Uri.file(tmpFile)));
                }
                log.methodDone("dump cache command", logLevel, logPad);
                resolve(true);
            });
        }
        else {
            log.write("   did not run command", logLevel, logPad);
            log.methodDone("dump cache command", logLevel, logPad);
            resolve(false);
        }
    });
}


function registerDumpCacheCommand(context: ExtensionContext)
{
    fsStoragePath = context.globalStoragePath;
	context.subscriptions.push(
        commands.registerCommand("vscode-extjs:dumpCache", async (project?: string, logPad?: string, logLevel?: number) => { await dumpCache(project, logPad, logLevel); })
    );
}


export default registerDumpCacheCommand;
