
import { Task, TaskProvider, WorkspaceFolder, ShellExecution, Uri, workspace, ShellExecutionOptions } from "vscode";
import * as path from "path";
import * as json5 from "json5";
import * as util from "../../common/clientUtils";
import * as log from "../../common/log";
import { ExtJsTaskDefinition } from "./definition";
import { configuration } from "../../common/configuration";
import { readFile } from "../../../../common";


export class ExtJsTaskProvider implements TaskProvider
{
    public cachedTasks: Task[] | undefined;


    constructor() { }


    public async provideTasks()
    {
        log.methodStart("provide extjs tasks", 1, "", true);

        if (!this.cachedTasks) {
            this.cachedTasks = await this.readTasks("   ");
        }
        return this.cachedTasks;
    }


    public resolveTask(_task: Task): Task | undefined
    {
        return undefined;
    }


    public createTask(target: string, cmd: string | undefined, folder: WorkspaceFolder, uri: Uri, xArgs: string[] | undefined, logPad: string): Task | undefined
    {
        return undefined;
    }


    public getDefaultDefinition(target: string | undefined, folder: WorkspaceFolder, uri: Uri): ExtJsTaskDefinition
    {
        const def: ExtJsTaskDefinition = {
            type: "extjs",
            script: target,
            target,
            fileName: path.basename(uri.fsPath),
            path: path.dirname(path.relative(folder.uri.fsPath, uri.fsPath)),
            cmdLine: "sencha app build",
            takesArgs: false,
            uri
        };
        return def;
    }


    public getDocumentPosition(scriptName: string, documentText: string): number
    {
        return documentText.indexOf(scriptName, documentText.indexOf("\"builds\"") + 1) || 0;
    }


    public async readTasks(logPad = ""): Promise<Task[]>
    {
        log.methodStart("detect extjs app.json files", 1, logPad, true);

        const allTasks: Task[] = [];

        const appDotJsonUris = await workspace.findFiles("**/app.json");
        for (const uri of appDotJsonUris)
        {
            allTasks.push(...await this.readUriTasks(uri));
        }

        log.methodDone("detect extjs app.json files", 1, logPad, true, [["# of tasks", allTasks.length]]);
        return allTasks;
    }


    private getKind(cmdLine: string, defaultDef: ExtJsTaskDefinition): ExtJsTaskDefinition
    {
        return { ...defaultDef, ...{ cmdLine } };
    }


    public async readUriTasks(uri: Uri, wsFolder?: WorkspaceFolder, logPad = ""): Promise<Task[]>
    {
        const cwd = path.dirname(uri.fsPath),
              folder = wsFolder || workspace.getWorkspaceFolder(uri);

        if (!folder) {
            return [];
        }

        log.methodStart("read extjs file uri task", 1, logPad, true, [["path", uri?.fsPath], ["project folder", folder?.name]]);

        const defaultDef = this.getDefaultDefinition(undefined, folder, uri),
              options: ShellExecutionOptions = { cwd },
              tasks: Task[] = [],
              appJson = json5.parse(await readFile(uri.fsPath));

        if (appJson && appJson.builds)
        {
            const sep = "___";
            Object.keys(appJson.builds).forEach((buildName: string) =>
            {
                const buildNameFmt = buildName.toLowerCase();
                let cmdLine = `sencha app build ${buildName} development`,
                    label = `cmd${sep}build${sep}dev${sep}${buildNameFmt}`,
                    exec = new ShellExecution(cmdLine, options);
                tasks.push(new Task(this.getKind(cmdLine, defaultDef), folder, label, "extjs", exec, undefined));

                cmdLine = `sencha app build ${buildName} production"`;
                label = `cmd${sep}build${sep}production${sep}${buildNameFmt}`;
                exec = new ShellExecution(cmdLine, options);
                tasks.push(new Task(this.getKind(cmdLine, defaultDef), folder, label, "extjs", exec, undefined));

                cmdLine = `cross-env webpack --env.profile=${buildName} --env.watch=no --env.environment=development --env.treeshake=yes`;
                label = `webpack${sep}build${sep}dev${sep}${buildNameFmt}`;
                exec = new ShellExecution(cmdLine, options);
                tasks.push(new Task(this.getKind(cmdLine, defaultDef), folder, label, "extjs", exec, undefined));

                cmdLine = `cross-env webpack --env.profile=${buildName} --env.watch=no --env.environment=production --env.treeshake=yes`;
                label = `webpack${sep}build${sep}production${sep}${buildNameFmt}`;
                exec = new ShellExecution(cmdLine, options);
                tasks.push(new Task(this.getKind(cmdLine, defaultDef), folder, label, "extjs", exec, undefined));
            });
        }

        log.methodDone("read app-publisher file uri tasks", 1, logPad, true);

        return tasks;
    }

}
