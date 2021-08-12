
import * as path from "path";
import * as log from "../common/log";
import { rmdirSync } from "fs";
import { commands, ExtensionContext } from "vscode";
import { extjsLangMgr } from "../extension";

let fsStoragePath: string;


export async function clearAst(project?: string, force = false, logPad = "")
{
    log.methodStart("clear ast command", 1, logPad, true, [["cache path", fsStoragePath]]);

    if (!extjsLangMgr.isBusy() || force)
    {
        let nsPath = fsStoragePath;
        if (project) {
            nsPath = path.join(fsStoragePath, project);
        }

        log.value("   removing directory", nsPath, 1, logPad);
        rmdirSync(nsPath, {
            recursive: true
        });
    }
    else {
        log.write("   busy, did not run command", 1, logPad);
    }

    log.methodStart("clear ast command", 1, logPad);
}


function registerClearAstCommand(context: ExtensionContext)
{
    fsStoragePath = context.globalStoragePath;
	context.subscriptions.push(
        commands.registerCommand("vscode-extjs:clearAst", async (project?: string, force = false, logPad = "") => { await clearAst(project, force, logPad); })
    );
}


export default registerClearAstCommand;
