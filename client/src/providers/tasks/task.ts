
import { Task, TaskProvider, WorkspaceFolder, ShellExecution, Uri, workspace, ShellExecutionOptions } from "vscode";
import * as path from "path";
import * as util from "../../common/clientUtils";
import * as log from "../../common/log";
import { ExtJsTaskDefinition } from "./definition";
import { configuration } from "../../common/configuration";


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
            path: path.relative(folder.uri.fsPath, uri.fsPath),
            cmdLine: "sencha app build",
            takesArgs: false,
            uri
        };
        return def;
    }


    public getDocumentPosition(scriptName: string | undefined, documentText: string | undefined): number
    {
        return 0;
    }


    public async readTasks(logPad = ""): Promise<Task[]>
    {
        log.methodStart("detect app-publisher files", 1, logPad, true);

        const allTasks: Task[] = [];
        const visitedFiles: Set<string> = new Set();

        if (workspace.workspaceFolders)
        {
            for (const fobj of workspace.workspaceFolders)
            {
                if (!util.isExcluded(fobj.uri.path) && !visitedFiles.has(fobj.uri.fsPath))
                {
                    visitedFiles.add(fobj.uri.fsPath);
                    allTasks.push(...await this.readUriTasks(fobj.uri));
                }
            }
        }

        log.value(logPad + "   # of tasks", allTasks.length, 2, logPad);
        log.methodDone("detect extjs configuration files", 1, logPad, true);

        return allTasks;
    }


    private _getKind(cmdLine: string, defaultDef: ExtJsTaskDefinition): ExtJsTaskDefinition
    {
        return { ...defaultDef, ...{ cmdLine } };
    }


    public async readUriTasks(uri: Uri, wsFolder?: WorkspaceFolder, logPad = ""): Promise<Task[]>
    {
        const cwd = path.dirname(uri.fsPath),
              folder = wsFolder || workspace.getWorkspaceFolder(uri),
              groupSeparator = configuration.get<string>("groupSeparator");

        if (!folder) {
            return [];
        }

        const defaultDef = this.getDefaultDefinition(undefined, folder, uri),
              options: ShellExecutionOptions = { cwd },
              tasks: Task[] = [],
              taskDefs: any = [];

        //
        // For ap files in the same dir, nsamed with a tag, e.g.:
        //    .publishrc.spm.json
        //
        let apLabel = "";
        const match = uri.fsPath.match(/\.publishrc\.(.+)\.(?:js(?:on)?|ya?ml)$/i);
        if (match && match.length > 1 && match[1])
        {
            apLabel =  match[1];
        }

        log.methodStart("read extjs file uri task", 1, logPad, true, [["path", uri?.fsPath], ["project folder", folder?.name]]);

        // taskDefs.push({
        //     label: "general" + groupSeparator + "config",
        //     cmdLine: "npx app-publisher --version"
        // });

        //
        // Create the shell execution objects
        //
        taskDefs.forEach((def: any) => {
            let apFmtLabel = "";
            if (apLabel) {
                apFmtLabel = ` (${apLabel.toLowerCase()})`;
                def.cmdLine += ` --config-name ${apLabel}`;
            }
            const exec = new ShellExecution(def.cmdLine, options);
            tasks.push(new Task(this._getKind(def.cmdLine, defaultDef), folder,
                                `${def.label}${apFmtLabel}`, "app-publisher", exec, undefined));
        });

        log.methodDone("read app-publisher file uri tasks", 1, logPad, true);

        return tasks;
    }

}
