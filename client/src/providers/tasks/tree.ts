import {
    Event, EventEmitter, ExtensionContext, Task, TaskDefinition, TaskRevealKind, TextDocument,
    TreeDataProvider, TreeItem, TreeItemCollapsibleState, Uri, TaskStartEvent, TaskEndEvent,
    commands, window, workspace, tasks, Selection, WorkspaceFolder, InputBoxOptions,
    Terminal, StatusBarItem, StatusBarAlignment, CustomExecution, ConfigurationChangeEvent
} from "vscode";
import * as path from "path";
import { pathExists, utils } from "../../../../common";
import * as assert from "assert";
import constants from "../../common/constants";
import * as log from "../../common/log";
import TaskItem from "./item";
import TaskFile from "./file";
import TaskFolder from "./folder";
import { storage } from "../../common/storage";
import { providers } from "../../extension";
import { configuration } from "../../common/configuration";
import { ExtJsTaskProvider } from "./task";



class NoScripts extends TreeItem
{
    constructor()
    {
        super("No snippets or app.json files found", TreeItemCollapsibleState.None);
        this.contextValue = "noscripts";
    }
}
const noScripts = new NoScripts();


/**
 * @class TaskTreeDataProvider
 *
 * @since 0.8.0
 *
 * Implements the VSCode TreeDataProvider API to build a tree of tasks to display within a view.
 */
export class TaskTreeDataProvider implements TreeDataProvider<TreeItem>
{
    private static statusBarSpace: StatusBarItem;
    private tasks: Task[] | null = null;
    private treeBuilding = false;
    private busy = false;
    private extensionContext: ExtensionContext;
    private name: string;
    private taskTree: TaskFolder[] | NoScripts[] | null = null;
    private currentInvalidation: string | undefined;
    private _onDidChangeTreeData: EventEmitter<TreeItem | null> = new EventEmitter<TreeItem | null>();
    readonly onDidChangeTreeData: Event<TreeItem | null> = this._onDidChangeTreeData.event;
    private groupSeparator = "___";
    private maxGroupLevel = 10;
    private maxLastTasks = 10;


    constructor(name: string, context: ExtensionContext)
    {
        const subscriptions = context.subscriptions;
        this.extensionContext = context;
        this.name = name;

        //
        // Register commands
        //
        subscriptions.push(commands.registerCommand("vscode-extjs:tasks.run",  async (item: TaskItem) => { await this.run(item); }, this));
        subscriptions.push(commands.registerCommand("vscode-extjs:tasks.runNoTerm",  async (item: TaskItem) => { await this.run(item, true, false); }, this));
        subscriptions.push(commands.registerCommand("vscode-extjs:tasks.runWithArgs",  async (item: TaskItem, args: string) => { await this.run(item, false, true, args); }, this));
        subscriptions.push(commands.registerCommand("vscode-extjs:tasks.runLastTask",  async () => { await this.runLastTask(); }, this));
        subscriptions.push(commands.registerCommand("vscode-extjs:tasks.stop",  (item: TaskItem) => { this.stop(item); }, this));
        subscriptions.push(commands.registerCommand("vscode-extjs:tasks.restart",  async (item: TaskItem) => { await this.restart(item); }, this));
        subscriptions.push(commands.registerCommand("vscode-extjs:tasks.pause",  (item: TaskItem) => { this.pause(item); }, this));
        subscriptions.push(commands.registerCommand("vscode-extjs:tasks.open", async (item: TaskItem) => { await this.open(item); }, this));
        subscriptions.push(commands.registerCommand("vscode-extjs:tasks.openTerminal", (item: TaskItem) => { this.openTerminal(item); }, this));
        subscriptions.push(commands.registerCommand("vscode-extjs:tasks.refresh", async () => { await this.refresh(true, false); }, this));
        subscriptions.push(commands.registerCommand("vscode-extjs:tasks.addToExcludes", async (taskFile: TaskFile | string) => { await this.addToExcludes(taskFile); }, this));
        subscriptions.push(commands.registerCommand("vscode-extjs:tasks.addRemoveFromFavorites", async (taskItem: TaskItem) => { await this.addRemoveFavorite(taskItem); }, this));
        subscriptions.push(commands.registerCommand("vscode-extjs:tasks.clearSpecialFolder", async (taskFolder: TaskFolder) => { await this.clearSpecialFolder(taskFolder); }, this));

        //
        // Register for task start/stop events
        //
        tasks.onDidStartTask(async (_e) => this.taskStartEvent(_e));
        tasks.onDidEndTask(async (_e) => this.taskFinishedEvent(_e));

        //
        // Watch workspace app.json files
        //
        const appJsonWatcher = workspace.createFileSystemWatcher("**/app.json");
        subscriptions.push(appJsonWatcher.onDidChange(async (e) => { await this.refresh(e); }, this));
        subscriptions.push(appJsonWatcher.onDidDelete(async (e) => { await this.refresh(e); }, this));
        subscriptions.push(appJsonWatcher.onDidCreate(async (e) => { await this.refresh(e); }, this));

        //
        // Refresh tree when folders are added/removed from the workspace
        //
        context.subscriptions.push(workspace.onDidChangeWorkspaceFolders(async(_e) => { await this.refresh(); }, this));

        //
        // Register configurations/settings change watcher
        //
        context.subscriptions.push(workspace.onDidChangeConfiguration(async e => { await this.processConfigChanges(context, e); }, this));
    }


    private async processConfigChanges(context: ExtensionContext, e: ConfigurationChangeEvent)
    {
        if (e.affectsConfiguration("extjsIntellisense.enableTaskExplorer"))
        {
            // main extension will handle this particular setting
        }
    }


    /**
     * @method addRemoveFavorite
     *
     * Adds/removes tasks from the Favorites List.  Basically a toggle, if the task exists as a
     * favorite already when this function is called, it gets removed, if it doesnt exist, it gets added.
     *
     * @param taskItem The representative TaskItem of the task to add/remove
     */
    private async addRemoveFavorite(taskItem: TaskItem)
    {
        const favTasks = storage.get<string[]>(constants.FAV_TASKS_STORE, []);
        const favId = this.getTaskItemId(taskItem);

        log.methodStart("add/remove favorite", 1, "", false, [
            ["id", taskItem.id ], [ "current fav count", favTasks.length ]
        ]);

        //
        // If this task exists in the favorites, remove it, if it doesnt, then add it
        //
        if (favId && favTasks.indexOf(favId) === -1)
        {
            await this.saveTask(taskItem, -1, true);
        }
        else //
        {   // Remove
            //
            utils.removeFromArray(favTasks, favId);
            log.value("   new fav count", favTasks.length, 2);
            //
            // Update local storage for persistence
            //
            await storage.update(constants.FAV_TASKS_STORE, favTasks);
            //
            // Update
            //
            await this.showSpecialTasks(true, true, undefined, "   ");
        }
        log.methodDone("add/remove favorite", 1);
    }


    private async addToExcludes(selection: TaskFile | string)
    {
        const me = this;
        let pathValue = "";
        let uri: Uri | undefined;

        log.methodStart("add to excludes", 1, "", true, [[ "global", global ]]);

        if (selection instanceof TaskFile)
        {
            uri = selection.resourceUri;
            if (selection.isGroup)
            {
                log.write("  file group");
                pathValue = "";
                for (const each of selection.treeNodes)
                {
                    if (each.resourceUri) {
                        pathValue += each.resourceUri.path;
                        pathValue += ",";
                    }
                }
                if (pathValue) {
                    pathValue = pathValue.substring(0, pathValue.length - 1);
                }
            }
            else if (uri)
            {
                log.value("  file glob", uri.path);
                pathValue = uri.path;
            }
        }
        else {
            pathValue = selection;
        }

        if (!pathValue) {
            return;
        }
        log.value("   path value", pathValue, 2);

        let excludes: string[] = [];
        const excludes2 = configuration.get<string[]>("exclude");
        if (excludes2 && excludes2 instanceof Array) {
            excludes = excludes2;
        }
        else if (typeof excludes2 === "string") {
            excludes.push(excludes2);
        }
        const paths = pathValue.split(",");
        for (const s in paths) {
            if (paths.hasOwnProperty(s)) { // skip properties inherited from prototype
                utils.pushIfNotExists(excludes, paths[s]);
            }
        }

        configuration.update("exclude", excludes);
        // configuration.update("exclude", excludes);

        await me.refresh(selection instanceof TaskFile ? selection.taskSource : false, uri);

        log.methodDone("add to excludes", 1);
    }


    private addToSpecialFolder(taskItem: TaskItem, folder: any, tasks: string[], label: string)
    {
        if (taskItem && taskItem.id && folder && tasks && label && taskItem.task && tasks.includes(taskItem.id))
        {
            const taskItem2 = new TaskItem(this.extensionContext, taskItem.taskFile, taskItem.task);
            taskItem2.id = label + ":" + taskItem2.id;
            taskItem2.label = this.getSpecialTaskName(taskItem2);
            folder.insertTaskFile(taskItem2, 0);
        }
    }


    private async buildGroupings(folders: Map<string, TaskFolder>, logPad = "", logLevel = 1)
    {
        log.methodStart("build tree node groupings", logLevel, logPad);

        //
        // Sort nodes.  By default the project folders are sorted in the same order as that
        // of the Explorer.  Sort TaskFile nodes and TaskItems nodes alphabetically, by default
        // its entirely random as to when the individual providers report tasks to the engine
        //
        // After the initial sort, create any task groupings based on the task group separator.
        // 'folders' are the project/workspace folders.
        //
        for (const [ key, folder ] of folders)
        {
            if (key === constants.LAST_TASKS_LABEL || key === constants.FAV_TASKS_LABEL) {
                continue;
            }
            this.sortFolder(folder, logPad + "   ", logLevel + 1);
            //
            // Create groupings by task type
            //
            await this.createTaskGroupings(folder, logPad + "   ", logLevel + 1);
        }

        log.methodDone("build tree node groupings", logLevel, logPad);
    }


    private async buildTaskTree(tasksList: Task[], logPad = "", logLevel = 1): Promise<TaskFolder[] | NoScripts[]>
    {
        let taskCt = 0;
        const folders: Map<string, TaskFolder> = new Map();
        const files: Map<string, TaskFile> = new Map();
        let ltFolder: TaskFolder | undefined,
            favFolder: TaskFolder | undefined;

        log.methodStart("build task tree", logLevel, logPad);
        this.treeBuilding = true;

        //
        // The 'Last Tasks' folder will be 1st in the tree
        //
        const lastTasks = storage.get<string[]>(constants.LAST_TASKS_STORE, []);
        if (lastTasks && lastTasks.length > 0)
        {
            ltFolder = new TaskFolder(constants.LAST_TASKS_LABEL);
            folders.set(constants.LAST_TASKS_LABEL, ltFolder);
        }

        //
        // The 'Favorites' folder will be 2nd in the tree (or 1st if configured to hide
        // the 'Last Tasks' folder)
        //
        const favTasks = storage.get<string[]>(constants.FAV_TASKS_STORE, []);
        if (favTasks && favTasks.length > 0)
        {
            favFolder = new TaskFolder(constants.FAV_TASKS_LABEL);
            folders.set(constants.FAV_TASKS_LABEL, favFolder);
        }

        //
        // The 'Code Snippets' folder
        //
        const snippetTasks = storage.get<string[]>(constants.SNIPPETS_TASKS_STORE, []);
        if (snippetTasks && snippetTasks.length > 0)
        {
            const snippetsFolder = new TaskFolder(constants.SNIPPETS_TASKS_LABEL);
            folders.set(constants.SNIPPETS_TASKS_LABEL, snippetsFolder);
        }

        //
        // Loop through each task provided by the engine and build a task tree
        //
        for (const each of tasksList)
        {
            log.blank(1);
            log.write("   Processing task " + (++taskCt).toString() + " of " + tasksList.length.toString(), logLevel, logPad);
            this.buildTaskTreeList(each, folders, files, ltFolder, favFolder, lastTasks, favTasks, logPad + "   ");
        }

        //
        // Sort and build groupings
        //
        await this.buildGroupings(folders, logPad + "   ", logLevel);

        //
        // Sort the 'Last Tasks' folder by last time run
        //
        this.sortLastTasks(ltFolder?.taskFiles, lastTasks, logPad + "   ", logLevel);

        //
        // Sort the 'Favorites' folder
        //
        this.sortTasks(favFolder?.taskFiles, logPad + "   ", logLevel);

        //
        // Get sorted root project folders (only project folders are sorted, special folders 'Favorites',
        // 'User Tasks' and 'Last Tasks' are kept at the top of the list.
        //
        const sortedFolders = this.getSortedRoot(folders);

        //
        // Done!
        //
        log.methodDone("build task tree", logLevel, logPad);
        this.treeBuilding = false;

        return sortedFolders;
    }


    /**
     * @method buildTaskTreeList
     *
     * @param each The Task that the tree item to be created will represent.
     * @param folders The map of existing TaskFolder items.  TaskFolder items represent workspace folders.
     * @param files The map of existing TaskFile items.
     * @param ltFolder The TaskFolder representing "Last Tasks"
     * @param favFolder The TaskFolder representing "Favorites"
     * @param lastTasks List of Task ID's currently in the "Last Tasks" TaskFolder.
     * @param favTasks List of Task ID's currently in the "Favorites" TaskFolder.
     * @param logPad Padding to prepend to log entries.  Should be a string of any # of space characters.
     */
    private buildTaskTreeList(each: Task, folders: Map<string, TaskFolder>, files: Map<string, TaskFile>, ltFolder: TaskFolder | undefined, favFolder: TaskFolder | undefined, lastTasks: string[], favTasks: string[], logPad = "")
    {
        let folder: TaskFolder | undefined,
            scopeName: string;

        log.methodStart("build task tree list", 2, logPad, true, [
            [ "name", each.name ], [ "source", each.source ], [ "scope", each.scope ],
            [ "definition type", each.definition.type ], [ "definition path", each.definition.path ]
        ]);

        const definition: TaskDefinition = each.definition;
        let relativePath = definition.path ?? "";

        //
        // Make sure this task shouldn't be ignored based on various criteria...
        // Process only if this task type/source is enabled in settings or is scope is empty (VSCode provided task)
        // By default, also ignore npm 'install' tasks, since its available in the context menu
        //
        const include: boolean | string = this.isTaskIncluded(each, relativePath, logPad + "   ");
        if (!include) {
            log.methodDone("build task tree list", 2, logPad);
            return;
        }

        const isNpmInstallTask = include === "npm-install";
        if (typeof include === "string" && !isNpmInstallTask) { // TSC tasks may have had their rel. pathchanged
            relativePath = include;
            log.value(logPad + "   set relative path", relativePath, 2);
        }

        //
        // Set scope name and create the TaskFolder, a "user" task will have a TaskScope scope, not
        // a WorkspaceFolder scope.
        //
        if (this.isWorkspaceFolder(each.scope))
        {
            scopeName = each.scope.name;
            folder = folders.get(scopeName);
            if (!folder)
            {
                folder = new TaskFolder(each.scope);
                folders.set(scopeName, folder);
            }
        }
        else {
            return;
        }

        //
        // Log the task details
        //
        this.logTask(each, scopeName, logPad + "   ");

        //
        // Get task file node, this will create one of it doesn't exist
        //
        const taskFile = this.getTaskFileNode(each, folder, files, relativePath, scopeName, logPad + "   ");

        //
        // Create and add task item to task file node
        //
        // If this is an 'NPM Install' task, then we do not add the "tree item".  We do however add
        // the "tree file" (above), so that the npm management tasks (including install update, audit,
        // etc) are available via context menu of the "tree file" that represents the folder that the
        // package.json file is found in.  Pre-v2.0.5, we exited earlier if an 'npm install' task was
        // found, but in doing so, if there were no npm "scripts" in the package.json, code execution
        // would not get far enough to create the "tree file" node for the context menu.
        //
        if (!isNpmInstallTask)
        {   //
            // Create "tree item" node and add it to the owner "tree file" node
            //
            const taskItem = new TaskItem(this.extensionContext, taskFile, each);
            taskFile.addTreeNode(taskItem);
            //
            // Add this task to the 'Last Tasks' folder if we need to
            //
            this.addToSpecialFolder(taskItem, ltFolder, lastTasks, constants.LAST_TASKS_LABEL);
            //
            // Add this task to the 'Favorites' folder if we need to
            //
            this.addToSpecialFolder(taskItem, favFolder, favTasks, constants.FAV_TASKS_LABEL);
        }

        log.methodDone("build task tree list", 2, logPad);
    }


    /**
     * @method clearSpecialFolder
     *
     * @param folder The TaskFolder representing either the "Last Tasks" or the "Favorites" folders.
     */
    private async clearSpecialFolder(folder: TaskFolder | string)
    {
        const choice = typeof folder === "string" ?
                       "Yes" : await window.showInformationMessage("Clear all tasks from this folder?", "Yes", "No"),
              label = typeof folder === "string" ? folder : folder.label;
        if (choice === "Yes")
        {
            if (label === constants.FAV_TASKS_LABEL) {
                await storage.update(constants.FAV_TASKS_STORE, []);
                await this.showSpecialTasks(false, true);
            }
            else if (label === constants.LAST_TASKS_LABEL) {
                await storage.update(constants.LAST_TASKS_STORE, []);
                await this.showSpecialTasks(false);
            }
        }
    }


    /**
     * @method createSpecialFolder
     *
     * Create and add a special folder the the tree.  As of v2.0 these are the "Last Tasks" and
     * "Favorites" folders.
     *
     * @param storeName A defined constant representing the special folder ("Last Tasks", or "Favorites")
     * @see [TaskItem](TaskItem)
     * @param label The folder label to be displayed in the tree.
     * @param treeIndex The tree index to insert the created folder at.
     * @param sort Whether or not to sort any existing items in the folder.
     * @param logPad Padding to prepend to log entries.  Should be a string of any # of space characters.
     */
    private async createSpecialFolder(storeName: string, label: string, treeIndex: number, sort: boolean, logPad = "")
    {
        const lTasks = storage.get<string[]>(storeName, []);
        const folder = new TaskFolder(label);

        log.methodStart("create special tasks folder", 1, logPad, true, [
            [ "store",  storeName ], [ "name",  label ]
        ]);

        if (!this.taskTree) {
            return;
        }

        this.taskTree.splice(treeIndex, 0, folder);

        for (const tId of lTasks)
        {
            const taskItem2 = await this.getTaskItems(tId, logPad + "   ");
            if (taskItem2 && taskItem2 instanceof TaskItem && taskItem2.task)
            {
                const taskItem3 = new TaskItem(this.extensionContext, taskItem2.taskFile, taskItem2.task);
                taskItem3.id = label + ":" + taskItem3.id;
                taskItem3.label = this.getSpecialTaskName(taskItem3);
                folder.insertTaskFile(taskItem3, 0);
            }
        }

        if (sort) {
            this.sortTasks(folder.taskFiles, logPad + "   ");
        }

        log.methodDone("create special tasks folder", 1, logPad);
    }


    /**
     * @method createTaskGroupings
     *
     * Creates main task groupings, i.e. 'npm', 'vscode', 'batch', etc, for a given {@link TaskFolder}
     *
     * @param folder The TaskFolder to process
     */
    private async createTaskGroupings(folder: TaskFolder, logPad = "", logLevel = 1)
    {
        let prevTaskFile: TaskItem | TaskFile | undefined;
        const subfolders: Map<string, TaskFile> = new Map();

        log.methodStart("create tree node folder grouping", logLevel, logPad, true, [[ "project folder", folder.label ]]);

        for (const each of folder.taskFiles)
        {   //
            // Only processitems of type 'TaskFile'
            //
            if (!(each instanceof TaskFile)) {
                continue;
            }
            //
            // Check if current taskfile source is equal to previous (i.e. ant, npm, vscode, etc)
            //
            if (prevTaskFile && prevTaskFile.taskSource === each.taskSource)
            {
                const id = folder.label + each.taskSource;
                let subfolder: TaskFile | undefined = subfolders.get(id);
                if (!subfolder)
                {
                    log.values([
                        ["   Add source file sub-container", each.path],
                        ["      id", id]
                    ], logLevel + 2, logPad, true);
                    const definition = (each.treeNodes[0] as TaskItem)?.task?.definition;
                    if (definition)
                    {
                        subfolder = new TaskFile(this.extensionContext, folder, definition,
                                                each.taskSource, each.path, 0, true, undefined, "   ");
                        subfolders.set(id, subfolder);
                        folder.addTaskFile(subfolder);
                        //
                        // Since we add the grouping when we find two or more equal group names, we are iterating
                        // over the 2nd one at this point, and need to add the previous iteration's TaskItem to the
                        // new group just created
                        //
                        subfolder.addTreeNode(prevTaskFile); // addScript will set the group level on the TaskItem
                    }
                }
                if (subfolder && subfolder.nodePath !== each.nodePath) {
                    subfolder.addTreeNode(each); // addScript will set the group level on the TaskItem
                }
            }
            prevTaskFile = each;
            //
            // Create the grouping
            //
            await this.createTaskGroupingsBySep(folder, each, subfolders, 0, logPad + "   ", logLevel + 1);
        }

        //
        // For groupings with separator, when building the task tree, when tasks are grouped new task definitions
        // are created but the old task remains in the parent folder.  Remove all tasks that have been moved down
        // into the tree hierarchy due to groupings
        //
        this.removeGroupedTasks(folder, subfolders, logPad + "   ", logLevel + 1);

        //
        // For groupings with separator, now go through and rename the labels within each group minus the
        // first part of the name split by the separator character (the name of the new grouped-with-separator node)
        //
        log.write(logPad + "   rename grouped tasks", logLevel);
        for (const each of folder.taskFiles)
        {
            if (each instanceof TaskFile) {
                await this.renameGroupedTasks(each);
            }
        }

        //
        // Resort after making adds/removes
        //
        this.sortFolder(folder, logPad + "   ", logLevel + 1);

        log.methodDone("create tree node folder grouping", logLevel, logPad);
    }


    /**
     * @method createTaskGroupingsBySep
     *
     *  By default the hierarchy would look like:
     *
     *      build
     *          prod
     *          dev
     *          server-dev
     *          server-prod
     *          sass
     *
     * @param folder The base task folder
     * @param each  Task file to process
     * @param prevTaskFile Previous task file processed
     * @param subfolders Tree taskfile map
     */
    private async createTaskGroupingsBySep(folder: TaskFolder, taskFile: TaskFile, subfolders: Map<string, TaskFile>, treeLevel = 0, logPad = "", logLevel = 2)
    {
        let prevName: string[] | undefined;
        let prevTaskItem: TaskItem | undefined;
        const newNodes: TaskFile[] = [];
        const atMaxLevel: boolean = this.maxGroupLevel <= treeLevel + 1;

        log.methodStart("create task groupings by separator", logLevel, logPad, true, [
            [ "folder", folder.label ], [ "label (node name)", taskFile.label ], [ "grouping level", treeLevel ], [ "is group", taskFile.isGroup ],
            [ "file name", taskFile.fileName ], [ "folder", folder.label ], [ "path", taskFile.path ], ["tree level", treeLevel]
        ]);

        const _setNodePath = (t: TaskItem | undefined, cPath: string) =>
        {
            if (t && !atMaxLevel && prevName)
            {
                log.write("   setting node path", logLevel + 2, logPad);
                log.value("      current", t.nodePath, logLevel + 2, logPad);
                if (!t.nodePath && taskFile.taskSource === "Workspace") {
                    t.nodePath = path.join(".vscode", prevName[treeLevel]);
                }
                else if (!t.nodePath) {
                    t.nodePath = prevName[treeLevel];
                }
                else {
                    t.nodePath = path.join(cPath, prevName[treeLevel]);
                }
                log.value("      new", t.nodePath, logLevel + 2, logPad);
            }
        };

        for (const each of taskFile.treeNodes)
        {
            if (!(each instanceof TaskItem) || !each.task || !each.label) {
                continue;
            }
            const label = each.label.toString();
            let subfolder: TaskFile | undefined;
            const prevNameThis = label?.split(this.groupSeparator);
            const prevNameOk = prevName && prevName.length > treeLevel && prevName[treeLevel];

            log.write("   process task item", logLevel + 1, logPad);
            log.values([
                ["id", each.id], ["label", label], ["node path", each.nodePath], ["command", each.command?.command],
                ["previous name [tree level]", prevName && prevNameOk ? prevName[treeLevel] : "undefined"],
                ["this previous name", prevNameThis]
            ], logLevel + 2, logPad + "      ");

            //
            // Check if we're in a state to create a new group.
            // If 'prevName' length > 1, then this task was grouped using the group separator, for
            // example:
            //
            //     build-ui-dev
            //     build-ui-production
            //     build-svr-trace
            //     build-svr-debug
            //     build-svr-production
            //
            // There may be other tasks, if we are grouping at more than one level, that may match
            // another set of tasks in separate parts of the groupings, for example:
            //
            //     wp-build-ui-dev
            //     wp-build-ui-production
            //     wp-build-svr-trace
            //     wp-build-svr-debug
            //     wp-build-svr-production
            //
            let foundGroup = false;
            if (prevName && prevNameOk && prevNameThis && prevNameThis.length > treeLevel)
            {
                for (let i = 0; i <= treeLevel; i++)
                {
                    if (prevName[i] === prevNameThis[i]) {
                        log.write("   found group", 4, logPad);
                        foundGroup = true;
                    }
                    else {
                        foundGroup = false;
                        break;
                    }
                }
            }

            if (foundGroup && prevName)
            {   //
                // We found a pair of tasks that need to be grouped.  i.e. the first part of the label
                // when split by the separator character is the same...
                //
                const id = this.getGroupedId(folder, taskFile, label, treeLevel);
                subfolder = subfolders.get(id);

                if (!subfolder)
                {   //
                    // Create the new node, add it to the list of nodes to add to the tree.  We must
                    // add them after we loop since we are looping on the array that they need to be
                    // added to
                    //
                    subfolder = new TaskFile(this.extensionContext, folder, each.task.definition, taskFile.taskSource,
                                             each.taskFile.path, treeLevel, true, prevName[treeLevel], logPad);
                    subfolders.set(id, subfolder);
                    _setNodePath(prevTaskItem, each.nodePath);
                    //
                    // Since we add the grouping when we find two or more equal group names, we are iterating
                    // over the 2nd one at this point, and need to add the previous iteration's TaskItem to the
                    // new group just created
                    //
                    subfolder.addTreeNode(prevTaskItem); // addScript will set the group level on the TaskItem
                    newNodes.push(subfolder);
                }

                _setNodePath(each, each.nodePath);
                subfolder.addTreeNode(each); // addScript will set the group level on the TaskItem
            }

            if (label.includes(this.groupSeparator)) {
                prevName = label.split(this.groupSeparator);
            }
            prevTaskItem = each;
        }

        //
        // If there are new grouped by separator nodes to add to the tree...
        //
        if (newNodes.length > 0)
        {
            let numGrouped = 0;
            for (const n of newNodes)
            {
                taskFile.insertTreeNode(n, numGrouped++);
                if (!atMaxLevel)
                {
                    await this.createTaskGroupingsBySep(folder, n, subfolders, treeLevel + 1, logPad + "   ", logLevel + 1);
                }
            }
        }

        log.methodDone("create task groupings by separator", logLevel, logPad);
    }


    private findDocumentPosition(document: TextDocument, taskItem?: TaskItem): number
    {
        const documentText = document.getText();

        log.methodStart("find task definition document position", 1, "", true,
            [ [ "task label", taskItem?.label], [ "task source", taskItem?.taskSource] ]
        );

        if (!taskItem || !taskItem.task) { return 0; }

        const provider = providers.get("extjs") as ExtJsTaskProvider,
              scriptOffset = provider.getDocumentPosition(taskItem.task.name, documentText);

        log.methodDone("find task definition document position", 1, "", true, [ ["offset", scriptOffset ] ]);
        return scriptOffset;
    }


    private fireTaskChangeEvents(taskItem: TaskItem, logPad: string, logLevel: number)
    {
        if (!this.taskTree || !taskItem) {
            log.error("task change event fire, invalid argument");
            return;
        }

        log.methodStart("fire task change events", logLevel, logPad);

        //
        // Fire change event for parent folder.  Firing the change event for the task item itself
        // does not cause the getTreeItem() callback to be called from VSCode Tree API.  Firing it
        // on the parent folder (type TreeFile) works good though.  Pre v2, we refreshed the entire
        // tree, so this is still good.  TODO possibly this gets fixed in the future to be able to
        // invalidate just the TaskItem, so check back on this sometime.
        //
        this._onDidChangeTreeData.fire(taskItem.taskFile);

        //
        // Fire change event for the 'Last Tasks' folder if the task exists there
        //
        const lastTasks = storage.get<string[]>(constants.LAST_TASKS_STORE, []);
        if (utils.existsInArray(lastTasks, this.getTaskItemId(taskItem)) !== false)
        {
            if (this.taskTree[0].label === constants.LAST_TASKS_LABEL)
            {
                this._onDidChangeTreeData.fire(this.taskTree[0]);
            }
        }

        //
        // Fire change event for the 'Favorites' folder if the task exists there
        //
        const favTasks = storage.get<string[]>(constants.FAV_TASKS_STORE, []);
        if (utils.existsInArray(favTasks, this.getTaskItemId(taskItem)) !== false)
        {
            if (this.taskTree[0].label === constants.FAV_TASKS_LABEL)
            {
                this._onDidChangeTreeData.fire(this.taskTree[0]);
            }
            else if (this.taskTree[1].label === constants.FAV_TASKS_LABEL)
            {
                this._onDidChangeTreeData.fire(this.taskTree[1]);
            }
        }

        log.methodStart("fire task change events", logLevel, logPad);
    }


    async getChildren(element?: TreeItem, logPad = "", logLevel = 2): Promise<TreeItem[]>
    {
        let waited = 0;
        let items: any = [];

        log.methodStart("get tree children", logLevel, logPad, false, [
            [ "task folder", element?.label ], [ "all tasks need to be retrieved", !this.tasks ],
            [ "specific tasks need to be retrieved", !!this.currentInvalidation ],
            [ "current invalidation", this.currentInvalidation ],
            [ "task tree needs to be built", !this.taskTree ]
        ]);

        //
        // The vscode task engine processing will call back in multiple time while we are awaiting
        // the call to buildTaskTree().  This occurs on the await of buildGroupings() in buildTaskTree.
        // To prevent bad. things. happening. sleep the call here until the tree has finished building.
        // This "could"" be prevented by re-implementing the tree the "right way", where we don't build the
        // whole tree if it doesnt exist and build it node by node as theyare expanded, but, because we
        // have 'LastTasks' and 'Favorites', we need to load everything.  Oh well.
        //
        while (this.treeBuilding) {
            log.write(logPad + "   waiting...", logLevel);
            await utils.timeout(100);
            waited += 100;
        }
        if (waited) {
            log.write(logPad + "   waited " + waited + " ms", logLevel);
        }

        //
        // Build task tree if not built already.
        //
        if (!this.taskTree)
        {   //
            // If 'tasks' is empty, then ask for all tasks.
            // If 'tasks' is non-empty, and 'currentInvalidation' is set, then only ask for tasks
            // of type specified by it's value.  The 'currentInvalidation' parameter is set by the
            // refresh() function when a file modify/create/delete event has occurred, it will be
            // set to the task type of the file that was modified.created/deleted, and at this point
            // the provider's tasks cache will have been invalidated and rebuilt.
            //
            // Note that if 'currentInvalidation' is 'workspace', indicating tasks from a tasks.json
            // file, there in actuality is no task type called 'workspace'.  Tasks found in these
            // files can be of any type that is available to VSCode's task provider interface
            // (including providers implemented in this extension).  In this case, we have to ask
            // for all tasks.
            //
            if (!this.tasks || this.currentInvalidation === "workspace") {
                this.tasks = await tasks.fetchTasks();
            }
            else if (this.currentInvalidation)
            {   //
                // Get all tasks of the type defined in 'currentInvalidation' from VSCode, remove
                // all tasks of the type defined in 'currentInvalidation' from the tasks list cache,
                // and add the new tasks from VSCode into the tasks list.
                //
                const taskItems = await tasks.fetchTasks({
                    type: "extjs"
                });
                this.tasks.push(...taskItems);
            }
            if (this.tasks)
            {   //
                // Build the entire task tree
                //
                try {
                    this.taskTree = await this.buildTaskTree(this.tasks, logPad + "   ", logLevel);
                }
                catch (e) {
                    log.error(e.toString());
                }
                log.blank(1);
                if (!this.taskTree || this.taskTree.length === 0)
                {
                    this.taskTree = [noScripts];
                }
            }
        }

        if (element instanceof TaskFolder)
        {
            log.write(logPad + "   Get folder task files", logLevel);
            items = element.taskFiles;
        }
        else if (element instanceof TaskFile)
        {
            log.write(logPad + "   Get file tasks/scripts", logLevel);
            items = element.treeNodes;
        }
        else if (!element)
        {
            log.write(logPad + "   Get task tree", logLevel);
            if (this.taskTree)
            {
                items = this.taskTree;
            }
        }

        log.methodDone("get tree children", logLevel, logPad);

        this.currentInvalidation = undefined; // reset file modification task type flag
        return items;
    }


    private getGroupedId(folder: TaskFolder, file: TaskFile, label: string, treeLevel: number)
    {
        const labelSplit = label?.split(this.groupSeparator);
        let id = "";
        for (let i = 0; i <= treeLevel; i++)
        {
            id += labelSplit[i];
        }
        if (file.resourceUri) {
            id += file.resourceUri.fsPath.replace(/\W/gi, "");
        }
        else if (file.fileName) {
            id += file.fileName.replace(/\W/gi, "");
        }
        return folder.label + file.taskSource + id + (treeLevel || treeLevel === 0 ? treeLevel.toString() : "");
    }


    public getParent(element: TreeItem): TreeItem | null
    {
        if (element instanceof TaskFolder)
        {
            return null;
        }
        if (element instanceof TaskFile)
        {
            return element.folder;
        }
        if (element instanceof TaskItem)
        {
            return element.taskFile;
        }
        if (element instanceof NoScripts)
        {
            return null;
        }
        return null;
    }


    private getSortedRoot(folders: Map<string, TaskFolder>): TaskFolder[]
    {
        return [...folders.values()]?.sort((a: TaskFolder, b: TaskFolder) =>
        {
            const sFolders = [ constants.FAV_TASKS_LABEL, constants.LAST_TASKS_LABEL];
            if (a.label === constants.LAST_TASKS_LABEL) {
                return -1;
            }
            else if (b.label === constants.LAST_TASKS_LABEL) {
                return 1;
            }
            else if (a.label === constants.FAV_TASKS_LABEL) {
                if (b.label !== constants.LAST_TASKS_LABEL) {
                    return -1;
                }
                return 1;
            }
            else if (b.label === constants.FAV_TASKS_LABEL) {
                if (a.label !== constants.LAST_TASKS_LABEL) {
                    return 1;
                }
                return -1;
            }
            if (a.label && b.label) {
                return a.label.toString().localeCompare(b.label?.toString());
            }
            return 0;
        });
    }


    private getSpecialTaskName(taskItem: TaskItem)
    {
        return taskItem.label + " (" + taskItem.taskFile.folder.label + " - " + taskItem.taskSource + ")";
    }


    /**
     * @method getTaskItems
     *
     * Returns a flat mapped list of tree items, or the tre item specified by taskId.
     *
     * @param taskId Task ID
     * @param logPad Padding to prepend to log entries.  Should be a string of any # of space characters.
     * @param executeOpenForTests For running mocha tests only.
     */
    public async getTaskItems(taskId: string | undefined, logPad = "", executeOpenForTests = false, logLevel = 1): Promise<Map<string, TaskItem> | TaskItem | undefined>
    {
        const me = this;
        const taskMap: Map<string, TaskItem> = new Map();
        let done = false;

        log.methodStart("Get task item(s) from tree", logLevel, logPad, false, [
            [ "task id", taskId ?? "all tasks" ], [ "execute open", executeOpenForTests ]
        ]);

        const treeItems = await me.getChildren(undefined, "   ", logLevel + 1);
        if (!treeItems || treeItems.length === 0)
        {
            window.showInformationMessage("No tasks found!");
            await storage.update(constants.FAV_TASKS_STORE, []);
            await storage.update(constants.LAST_TASKS_STORE, []);
            return;
        }

        const processItem2g = async (pItem2: TaskFile) =>
        {
            const treeFiles: any[] = await me.getChildren(pItem2, "   ", logLevel + 1);
            if (treeFiles.length > 0)
            {
                for (const item2 of treeFiles)
                {
                    if (done) {
                        break;
                    }
                    if (item2 instanceof TaskItem)
                    {
                        const tmp = me.getParent(item2);
                        assert(
                            tmp instanceof TaskFile,
                            "Invaid parent type, should be TaskFile for TaskItem"
                        );
                        await processItem2(item2);
                    }
                    else if (item2 instanceof TaskFile && item2.isGroup)
                    {
                        log.write("        Task File (grouped): " + item2.path + item2.fileName, logLevel + 2);
                        await processItem2g(item2);
                    }
                    else if (item2 instanceof TaskFile && !item2.isGroup)
                    {
                        log.write("        Task File (grouped): " + item2.path + item2.fileName, logLevel + 2);
                        await processItem2(item2);
                    }
                }
            }
        };

        const processItem2 = async (pItem2: any) =>
        {
            const treeTasks: any[] = await me.getChildren(pItem2, "   ", logLevel + 1);
            if (treeTasks.length > 0)
            {
                for (const item3 of treeTasks)
                {
                    if (done) {
                        break;
                    }

                    if (item3 instanceof TaskItem)
                    {
                        if (executeOpenForTests) {
                            await me.open(item3);
                        }
                        const tmp = me.getParent(item3);
                        assert(
                            tmp instanceof TaskFile,
                            "Invaid parent type, should be TaskFile for TaskItem"
                        );
                        if (item3.task && item3.task.definition)
                        {
                            let tPath: string;

                            if (me.isWorkspaceFolder(item3)) {
                                tPath = item3.task.definition.uri ? item3.task.definition.uri.fsPath :
                                    (item3.task.definition.path ? item3.task.definition.path : "root");
                            }
                            else {
                                tPath = "root";
                            }

                            log.write(logPad + "   ✔ Processed " + item3.task.name, logLevel + 2);
                            log.value(logPad + "        id", item3.id, logLevel + 2);
                            log.value(logPad + "        type", item3.taskSource + " @ " + tPath, logLevel + 2);
                            if (item3.id) {
                                taskMap.set(item3.id, item3);
                                if (taskId && taskId === item3.id) {
                                    done = true;
                                }
                            }
                        }
                    }
                    else if (item3 instanceof TaskFile && item3.isGroup)
                    {
                        await processItem2(item3);
                    }
                }
            }
        };

        const processItem = async (pItem: any) =>
        {
            let tmp: any;
            const treeFiles: any[] = await me.getChildren(pItem, "   ", logLevel + 2);
            if (treeFiles.length > 0)
            {
                for (const item2 of treeFiles)
                {
                    if (done) {
                        break;
                    }
                    if (item2 instanceof TaskFile && !item2.isGroup)
                    {
                        log.write(logPad + "   Task File: " + item2.path + item2.fileName, logLevel + 2);
                        tmp = me.getParent(item2);
                        assert(
                            tmp instanceof TaskFolder,
                            "Invaid parent type, should be TaskFolder for TaskFile"
                        );
                        await processItem2(item2);
                    }
                    else if (item2 instanceof TaskFile && item2.isGroup)
                    {
                        await processItem2g(item2);
                    }
                    else if (item2 instanceof TaskItem)
                    {
                        await processItem2(item2);
                    }
                }
            }
        };

        for (const item of treeItems)
        {
            if (item instanceof TaskFolder)
            {
                const isFav = item.label?.toString().includes(constants.FAV_TASKS_LABEL);
                const isLast = item.label?.toString().includes(constants.LAST_TASKS_LABEL);
                const tmp: any = me.getParent(item);
                assert(tmp === null, "Invalid parent type, should be null for TaskFolder");
                log.write("   Task Folder " + item.label + ":  " + (!isFav && !isLast ?
                         item.resourceUri?.fsPath : (isLast ? constants.LAST_TASKS_LABEL :
                            constants.FAV_TASKS_LABEL)), logLevel + 1, logPad);
                await processItem(item);
            }
        }

        log.methodDone("Get task item(s) from tree", logLevel, logPad, false, [
            [ "# of items found", taskMap.keys.length ]
        ]);

        if (taskId) {
            return taskMap.get(taskId);
        }
        return taskMap;
    }


    private getTaskName(script: string, relativePath: string | undefined)
    {
        if (relativePath && relativePath.length)
        {
            return `${script} - ${relativePath.substring(0, relativePath.length - 1)}`;
        }
        return script;
    }


    private getTaskFileNode(task: Task, folder: TaskFolder, files: any, relativePath: string, scopeName: string, logPad = ""): TaskFile
    {
        let taskFile: TaskFile;
        //
        // Reference ticket #133, vscode folder should not use a path appenditure in it's folder label
        // in the task tree, there is only one path for vscode/workspace tasks, /.vscode.  The fact that
        // you can set the path variable inside a vscode task changes the relativePath for the task,
        // causing an endless loop when putting the tasks into groups (see taskTree.createTaskGroupings).
        // All other task types will have a relative path of it's location on the filesystem (with
        // exception of TSC, which is handled elsewhere).
        //
        const relPathAdj = task.source !== "Workspace" ? relativePath : ".vscode";

        let id = task.source + ":" + path.join(scopeName, relPathAdj);
        if (task.definition.fileName && !task.definition.scriptFile)
        {
            id = path.join(id, task.definition.fileName);
        }

        taskFile = files.get(id);

        //
        // Create taskfile node if needed
        //
        if (!taskFile)
        {
            log.value(logPad + "   Add source file container", task.source);
            taskFile = new TaskFile(this.extensionContext, folder, task.definition, task.source, relativePath, 0, false, undefined, logPad);
            folder.addTaskFile(taskFile);
            files.set(id, taskFile);
        }

        return taskFile;
    }


    private getTaskItemId(taskItem: TaskItem)
    {
        return taskItem?.id?.replace(constants.LAST_TASKS_LABEL + ":", "")
                            .replace(constants.FAV_TASKS_LABEL + ":", "");
    }


    private getTerminal(taskItem: TaskItem, logPad = ""): Terminal | undefined
    {
        const me = this;
        let checkNum = 0;
        let term: Terminal | undefined;

        log.write("Get terminal", 1, logPad);

        if (!taskItem.task || !taskItem.label)
        {
            log.write("   no defined task on TaskItem", 2, logPad);
            return;
        }

        if (!window.terminals || window.terminals.length === 0)
        {
            log.write("   zero terminals alive", 2, logPad);
            return term;
        }

        if (window.terminals.length === 1)
        {
            log.write("   return only terminal alive", 2, logPad);
            return window.terminals[0];
        }

        const check = (taskName: string) =>
        {
            let termNum = 0,
                term2: Terminal | undefined;
            log.value("   Checking possible task terminal name #" + (++checkNum).toString(), taskName, 2);
            taskName = taskName.toLowerCase();
            for (const t of window.terminals)
            {
                log.value("      == terminal " + (++termNum) + " name", t.name, 2, logPad);
                let termName = t.name.toLowerCase().replace("task - ", "");
                if (termName.endsWith(" Task")) {
                    termName = termName.substring(0, termName.length - 5);
                }
                if (taskName.indexOf(termName) !== -1 || termName.indexOf(taskName) !== -1)
                {
                    term2 = t;
                    log.write("   found!", 2, logPad);
                    break;
                }
            }
            return term2;
        };

        let relPath = taskItem.task.definition.path ? taskItem.task.definition.path : "";
        if (relPath[relPath.length - 1] === "/") {
            relPath = relPath.substring(0, relPath.length - 1);
        }
        else if (relPath[relPath.length - 1] === "\\") {
            relPath = relPath.substring(0, relPath.length - 1);
        }

        if (taskItem.taskFile.folder.workspaceFolder)
        {
            const lblString = taskItem.task.name;
            let taskName = taskItem.taskFile.label + ": " + taskItem.label +
                            " (" + taskItem.taskFile.folder.workspaceFolder.name + ")";
            term = check(taskName);

            if (!term && lblString.indexOf("(") !== -1)
            {
                taskName = taskItem.taskSource + ": " + lblString.substring(0, lblString.indexOf("(")).trim() +
                           (relPath ? " - " : "") + taskItem.taskFile.folder.workspaceFolder.name + ")";
                term = check(taskName);
            }

            if (!term)
            {
                taskName = taskItem.taskSource + ": " + lblString +
                           (relPath ? " - " : "") + relPath + " (" + taskItem.taskFile.folder.workspaceFolder.name + ")";
                term = check(taskName);
            }

            if (!term)
            {
                taskName = taskItem.taskSource + ": " + lblString + " (" + taskItem.taskFile.folder.workspaceFolder.name + ")";
                term = check(taskName);
            }

            if (!term)
            {
                taskName = taskItem.taskSource + ": " + lblString +
                           (relPath ? " - " : "") + relPath + " (" + taskItem.taskFile.folder.workspaceFolder.name + ")";
                term = check(taskName);
            }

            if (!term && taskItem.taskSource === "Workspace")
            {
                taskName = "npm: " + lblString +
                           (relPath ? " - " : "") + relPath + " (" + taskItem.taskFile.folder.workspaceFolder.name + ")";
                term = check(taskName);
            }

            if (!term && lblString.indexOf("(") !== -1)
            {
                taskName = taskItem.taskSource + ": " + lblString.substring(0, lblString.indexOf("(")).trim() +
                           (relPath ? " - " : "") + relPath + " (" + taskItem.taskFile.folder.workspaceFolder.name + ")";
                term = check(taskName);
            }

            if (!term && lblString.indexOf("(") !== -1)
            {
                taskName = taskItem.taskSource + ": " + lblString.substring(0, lblString.indexOf("(")).trim() +
                           (relPath ? " - " : "") + relPath + " (" + taskItem.taskFile.folder.workspaceFolder.name + ")";
                term = check(taskName);
            }

            if (!term && relPath)
            {
                const folder = taskItem.getFolder();
                if (folder) {
                    taskName = folder.name + " (" + relPath + ")";
                    term = check(taskName);
                }
                if (!term)
                {
                    const folder = taskItem.getFolder();
                    if (folder) {
                        taskName = folder.name + " (" + path.basename(relPath) + ")";
                        term = check(taskName);
                    }
                }
            }
        }

        return term;
    }


    public getTreeItem(element: TaskItem | TaskFile | TaskFolder): TreeItem
    {
        log.blank(3);
        log.write("get tree item", 3);
        log.value("   label", element?.label, 3);
        if (element instanceof TaskItem) {
            log.write("   refresh task item state", 3);
            element.refreshState();
        }
        return element;
    }


    private async handleFileWatcherEvent(invalidate: any, opt?: boolean | Uri, logPad = "")
    {
        log.methodStart("handle filewatcher / settings change / test event", 1, logPad);
        log.methodDone("   handle filewatcher / settings change / test event", 1, logPad);
    }


    private isTaskIncluded(task: Task, relativePath: string, logPad = ""): boolean | string
    {
        //
        // We have our own provider for Gulp and Grunt tasks...
        // Ignore VSCode provided gulp and grunt tasks, which are always and only from a gulp/gruntfile
        // in a workspace folder root directory.  All internally provided tasks will have the 'uri' property
        // set in its task definition,VSCode provided Grunt/Gulp tasks will not
        //
        if (!task.definition.uri && (task.source === "gulp" || task.source === "grunt"))
        {
            log.write(`   skipping vscode provided ${task.source} task`, 2, logPad);
            return false;
        }

        //
        // Remove the '-' from app-publisher task.  VSCode doesn't like dashes in the settings names, so...
        //
        let settingName: string = "enable" + utils.toProperCase(task.source);
        if (settingName === "enableApp-publisher") {
            settingName = "enableAppPublisher";
        }
        return true;
    }


    private isWorkspaceFolder(value: any): value is WorkspaceFolder
    {
        return value && typeof value !== "number";
    }


    private logTask(task: Task, scopeName: string, logPad = "")
    {
        const definition = task.definition;

        log.value("name", task.name, 3, logPad);
        log.value("source", task.source, 3, logPad);
        log.value("scope name", scopeName, 4, logPad);
        if (this.isWorkspaceFolder(task.scope))
        {
            log.value("scope.name", task.scope.name, 4, logPad);
            log.value("scope.uri.path", task.scope.uri.path, 4, logPad);
            log.value("scope.uri.fsPath", task.scope.uri.fsPath, 4, logPad);
        }
        log.value("relative Path", definition.path ? definition.path : "", 4, logPad);
        log.value("type", definition.type, 4, logPad);
        if (definition.scriptType)
        {
            log.value("   script type", definition.scriptType, 4, logPad);	// if 'script' is defined, this is type npm
        }
        if (definition.scriptFile)
        {
            log.value("   script file", definition.scriptFile, 4, logPad);	// if 'script' is defined, this is type npm
        }
        if (definition.script)
        {
            log.value("script", definition.script, 4, logPad);	// if 'script' is defined, this is type npm
        }
        if (definition.path)
        {
            log.value("path", definition.path, 4, logPad);
        }
        //
        // Internal task providers will set a fileName property
        //
        if (definition.fileName)
        {
            log.value("file name", definition.fileName, 4, logPad);
        }
        //
        // Internal task providers will set a uri property
        //
        if (definition.uri)
        {
            log.value("file path", definition.uri.fsPath, 4, logPad);
        }
        //
        // Script task providers will set a fileName property
        //
        if (definition.takesArgs)
        {
            log.value("script requires args", "true", 4, logPad);
        }
        if (definition.cmdLine)
        {
            log.value("script cmd line", definition.cmdLine, 4, logPad);
        }
    }


    private async open(selection: TaskItem)
    {
        const clickAction = configuration.get<string>("clickAction") || "Open";

        //
        // As of v1.30.0, added option to change the entry item click to execute.  In order to avoid having
        // to re-register the handler when the setting changes, we just re-route the request here
        //
        if (clickAction === "Execute") {
            await this.run(selection);
            return;
        }

        const uri = selection.taskFile.resourceUri;
        if (uri)
        {
            log.methodStart("open document at position", 1, "", true, [
                [ "command", selection.command?.command ], [ "source", selection.taskSource ],
                [ "uri path", uri.path ], [ "fs path", uri.fsPath ]
            ]);

            if (await pathExists(uri.fsPath))
            {
                const document: TextDocument = await workspace.openTextDocument(uri);
                const offset = this.findDocumentPosition(document, selection instanceof TaskItem ? selection : undefined);
                const position = document.positionAt(offset);
                await window.showTextDocument(document, { selection: new Selection(position, position) });
            }
        }
    }


    private openTerminal(taskItem: TaskItem)
    {
        const term = this.getTerminal(taskItem);
        if (term) {
            term.show();
        }
    }


    private pause(taskItem: TaskItem)
    {
        if (!taskItem || this.busy)
        {
            window.showInformationMessage("Busy, please wait...");
            return;
        }

        log.methodStart("pause", 1, "", true);

        if (taskItem.task?.execution)
        {
            const terminal = this.getTerminal(taskItem, "   ");
            if (terminal)
            {
                if (taskItem.paused)
                {
                    taskItem.paused = false;
                    log.value("   send to terminal", "Y", 1);
                    terminal.sendText("N");
                }
                else
                {
                    taskItem.paused = true;
                    log.value("   send to terminal", "\\u0003", 1);
                    terminal.sendText("\u0003");
                }
            }
            else {
                window.showInformationMessage("Terminal not found");
            }
        }
        else {
            window.showInformationMessage("Executing task not found");
        }

        log.methodDone("pause", 1);
    }


    private pushToTopOfSpecialFolder(taskItem: TaskItem, label: string, treeIndex: number, logPad = "")
    {
        let taskItem2: TaskItem | undefined;
        const ltFolder = this.taskTree ? this.taskTree[treeIndex] as TaskFolder : undefined;
        const taskId = label + ":" + this.getTaskItemId(taskItem);

        if (!ltFolder || !taskItem.task) {
            return;
        }

        for (const t of ltFolder.taskFiles)
        {
            if (t instanceof TaskItem && t.id === taskId) {
                taskItem2 = t;
                break;
            }
        }

        if (taskItem2)
        {
            ltFolder.removeTaskFile(taskItem2);
        }
        else if (ltFolder.taskFiles.length >= configuration.get<number>("numLastTasks"))
        {
            ltFolder.removeTaskFile(ltFolder.taskFiles[ltFolder.taskFiles.length - 1]);
        }

        if (!taskItem2)
        {
            taskItem2 = new TaskItem(this.extensionContext, taskItem.taskFile, taskItem.task);
            taskItem2.id = taskId;
            taskItem2.label = this.getSpecialTaskName(taskItem2);
        }

        log.value(logPad + "   add item", taskItem2.id, 2);
        ltFolder.insertTaskFile(taskItem2, 0);
    }


    /**
     * Responsible for refreshing the tree content and tasks cache
     * This function is called each time and event occurs, whether its a modified or new
     * file (via FileSystemWatcher event), or when the view first becomes active/visible, etc.
     *
     * @param invalidate The invalidation event.
     * Can be one of the custom values:
     *     "tests"            (from unit tests)
     *     "visible-event"
     *     false|null|undefined
     *
     * Can also be one of the task types FileSystemWatcher event):
     *
     *     "ant"
     *     "app-publisher"
     *     "bash"
     *     "batch"
     *     "gradle"
     *     "grunt"
     *     "gulp"
     *     "make"
     *     "npm"
     *     "nsis"
     *     "perl"
     *     "powershell"
     *     "python"
     *     "ruby"
     *     "tests"
     *     "Workspace"
     *
     * If invalidate is false, then this is both an event as a result from adding to excludes list
     * and the item being added is a file, not a group / set of files.  If theitem being added to
     * the excludes list is a group/folder, then invalidate will be set to the task source, i.e.
     * npm, ant, workspace, etc.
     *
     * If invalidate is true and opt is false, then the refresh button was clicked
     *
     * If invalidate is "tests" and opt undefined, then extension.refreshTree() called in tests
     *
     * If task is truthy, then a task has started/stopped, opt will be the task definition's
     * 'uri' property, note that task types not internally provided will not contain this property.
     *
     * If invalidate and opt are both truthy, then a filesystemwatcher event or a task just triggered
     *
     * If invalidate and opt are both undefined, then a configuration has changed
     *
     * 2/10/2021 - Task start/finish events no longer call this function.  This means invalidate will
     * only be false if it is set from the addToExcludes() function.
     *
     * @param opt Uri of the invalidated resource
     */
    public async refresh(invalidate?: any, opt?: Uri | boolean, logPad = ""): Promise<void>
    {
        log.methodStart("refresh task tree", 1, logPad, true, [
            [ "from view", this.name ], [ "invalidate", invalidate ],
            [ "opt fsPath", opt && opt instanceof Uri ? opt.fsPath : "n/a" ],
            [ "tree is null", !this.taskTree ]
        ]);

        if (invalidate === "fs")
        {
            await this.handleFileWatcherEvent(invalidate, opt, logPad + "   ");
        }

        if (opt && opt instanceof Uri)
        {
            log.write(`   invalidation is for type '${invalidate}'`, 1, logPad);
            //
            // TODO - Performance Enhancement
            // Get the invalidated treeitem.treefile and invalidate that instead of rebuilding
            // the entire tree. We set currentInvalidation here, setting the 'currentInvalidation'
            // flag will cause the resulting call to getChildren() from the VSCode task engine to
            // only re-provide the invalidated task type, instead of all task types
            //
            this.currentInvalidation = invalidate;     // 'invalidate' will be taskType if 'opt' is uri
            this.taskTree = null;                      // see todo above
            this._onDidChangeTreeData.fire(null);      // see todo above // task.definition.treeItem
        }                                              // not sure if its even possible
        else //
        {   // Re-ask for all tasks from all providers and rebuild tree
            //
            log.write("   invalidation is for all types", 1, logPad);
            this.tasks = null; // !skipAskTasks ? null : this.tasks;
            this.taskTree = null;
            this._onDidChangeTreeData.fire(null);
        }

        log.methodDone("refresh task tree", 1, logPad, true);

        return;
    }


    private removeGroupedTasks(folder: TaskFolder, subfolders: Map<string, TaskFile>, logPad: string, logLevel: number)
    {
        const taskTypesRmv: TaskFile[] = [];

        log.methodStart("remove grouped tasks", logLevel, logPad);

        for (const each of folder.taskFiles)
        {
            if (!(each instanceof TaskFile) || !each.label) {
                continue;
            }
            const id = folder.label + each.taskSource;
            const id2 = this.getGroupedId(folder, each, each.label.toString(), each.groupLevel);

            if (!each.isGroup && subfolders.get(id))
            {
                taskTypesRmv.push(each);
            }
            else if (id2 && !each.isGroup && subfolders.get(id2))
            {
                taskTypesRmv.push(each);
            }
            else if (each.isGroup)
            {
                for (const each2 of each.treeNodes)
                {
                    this.removeScripts(each2 as TaskFile, folder, subfolders, 0, logPad, logLevel + 1);
                    if (each2 instanceof TaskFile && each2.isGroup && each2.groupLevel > 0)
                    {
                        for (const each3 of each2.treeNodes)
                        {
                            if (each3 instanceof TaskFile)
                            {
                                this.removeScripts(each3, folder, subfolders, 0, logPad, logLevel + 1);
                            }
                        }
                    }
                }
            }
            else {
                this.removeScripts(each, folder, subfolders, 0, logPad, logLevel + 1);
            }
        }

        for (const each of taskTypesRmv)
        {
            folder.removeTaskFile(each);
        }

        log.methodDone("remove grouped tasks", logLevel, logPad);
    }


    /**
     * Perform some removal based on groupings with separator.  The nodes added within the new
     * group nodes need to be removed from the old parent node still...
     *
     * @param taskFile TaskFile instance to remove tasks from
     * @param folder Project task folder
     * @param subfolders Current tree subfolders map
     * @param level Current grouping level
     */
    private removeScripts(taskFile: TaskFile, folder: TaskFolder, subfolders: Map<string, TaskFile>, level = 0, logPad = "", logLevel = 3)
    {
        const me = this;
        const taskTypesRmv: (TaskItem|TaskFile)[] = [];

        log.methodStart("remove scripts", logLevel, logPad, false);

        for (const each of taskFile.treeNodes)
        {
            const label = each.label?.toString();

            if (!label) {
                continue;
            }

            const labelPart = label?.split(this.groupSeparator)[level];
            const id = this.getGroupedId(folder, taskFile, label, level);

            if (each instanceof TaskItem)
            {
                if (label.split(this.groupSeparator).length > 1 && labelPart)
                {
                    if (subfolders.get(id))
                    {
                        taskTypesRmv.push(each);
                    }
                }
            }
            else
            {
                let allTasks = false;
                for (const each2 of each.treeNodes)
                {
                    if (each2 instanceof TaskItem)
                    {
                        allTasks = true;
                    }
                    else {
                        allTasks = false;
                        break;
                    }
                }

                if (!allTasks) {
                    me.removeScripts(each, folder, subfolders, level + 1, logPad, logLevel + 1);
                }
            }
        }

        for (const each2 of taskTypesRmv)
        {
            taskFile.removeTreeNode(each2);
        }

        log.methodDone("remove scripts", logLevel, logPad);
    }


    private async renameGroupedTasks(taskFile: TaskFile)
    {
        let rmvLbl = taskFile.label?.toString();
        rmvLbl = rmvLbl?.replace(/\(/gi, "\\(").replace(/\[/gi, "\\[");
        rmvLbl = rmvLbl?.replace(/\)/gi, "\\)").replace(/\]/gi, "\\]");

        for (const each2 of taskFile.treeNodes)
        {
            if (each2 instanceof TaskItem)
            {
                const rgx = new RegExp(rmvLbl + this.groupSeparator, "i");
                each2.label = each2.label?.toString().replace(rgx, "");

                if (each2.groupLevel > 0)
                {
                    let label = "";
                    const labelParts = each2.label?.split(this.groupSeparator);
                    if (labelParts)
                    {
                        for (let i = each2.groupLevel; i < labelParts.length; i++)
                        {
                            label += (label ? this.groupSeparator : "") + labelParts[i];
                        }
                        each2.label = label || each2.label;
                    }
                }
            }
            else {
                await this.renameGroupedTasks(each2);
            }
        }
    }



    private async restart(taskItem: TaskItem)
    {
        log.methodStart("restart task", 1, "", true);
        if (!taskItem || this.busy)
        {
            window.showInformationMessage("Busy, please wait...");
        }
        else {
            this.stop(taskItem);
            await this.run(taskItem);
        }
        log.methodDone("restart task", 1);
    }


    private async resumeTask(taskItem: TaskItem)
    {
        log.methodStart("resume task", 1, "", true);
        const term = this.getTerminal(taskItem, "   ");
        if (term) {
            log.value("   send to terminal", "N", 1);
            term.sendText("N", true);
            taskItem.paused = false;
        }
        else {
            window.showInformationMessage("Terminal not found");
        }
        log.methodDone("resume task", 1);
    }


    /**
     * Run/execute a command.
     * The refresh() function will eventually be called by the VSCode task engine when
     * the task is launched
     *
     * @param taskItem TaskItem instance
     * @param noTerminal Whether or not to show the terminal
     * Note that the terminal will be shown if there is an error
     * @param withArgs Whether or not to prompt for arguments
     * Note that only script type tasks use arguments (and Gradle, ref ticket #88)
     */
    private async run(taskItem: TaskItem, noTerminal = false, withArgs = false, args?: string)
    {
        if (!taskItem || this.busy)
        {
            window.showInformationMessage("Busy, please wait...");
            return;
        }

        log.methodStart("run task", 1, "", true, [["task name", taskItem.label]]);

        if (withArgs === true)
		{
            await this.runWithArgs(taskItem, args, noTerminal);
		}
        else if (taskItem.paused)
        {
            await this.resumeTask(taskItem);
        }
        else //
        {   // Create a new instance of 'task' if this is to be ran with no terminal (see notes below)
            //
            let newTask = taskItem.task;
            if (noTerminal && newTask)
            {   //
                // For some damn reason, setting task.presentationOptions.reveal = TaskRevealKind.Silent or
                // task.presentationOptions.reveal = TaskRevealKind.Never does not work if we do it on the task
                // that was instantiated when the providers were asked for tasks.  If we create a new instance
                // here, same exact task, then it works.  Same kind of thing with running with args, but in that
                // case I can understand it because a new execution class has to be instantiated with the command
                // line arguments.  In this case, its simply a property task.presentationOption on an instantiated
                // task.  No idea.  But this works fine for now.
                //
                const def = newTask.definition;
                const p = providers.get("extjs"),
                      folder = taskItem.getFolder();
                if (folder) {
                    newTask = p?.createTask(def.target, undefined, folder, def.uri, undefined, "   ");
                    //
                    // Since this task doesnt belong to a treeItem, then set the treeItem id that represents
                    // an instance of this task.
                    //
                    if (newTask) {
                        newTask.definition.taskItemId = def.taskItemId;
                    }
                }
            }
            if (await this.runTask(newTask, noTerminal)) {
                await this.saveTask(taskItem, this.maxLastTasks, false, "   ");
            }
        }

        log.methodDone("run task", 1);
    }


    private async runLastTask()
    {
        if (this.busy)
        {
            window.showInformationMessage("Busy, please wait...");
            return;
        }

        let lastTaskId: string | undefined;
        const lastTasks = storage.get<string[]>(constants.LAST_TASKS_STORE, []);
        if (lastTasks && lastTasks.length > 0)
        {
            lastTaskId = lastTasks[lastTasks.length - 1];
        }

        if (!lastTaskId)
        {
            window.showInformationMessage("No saved tasks!");
            return;
        }

        log.methodStart("Run last task", 1, "", true, [["last task id", lastTaskId]]);

        const taskItem = await this.getTaskItems(lastTaskId, "   ");

        if (taskItem && taskItem instanceof TaskItem)
        {
            await this.run(taskItem);
        }
        else
        {
            window.showInformationMessage("Task not found!  Check log for details");
            await utils.removeFromArray(lastTasks, lastTaskId);
            await storage.update(constants.LAST_TASKS_STORE, lastTasks);
            await this.showSpecialTasks(true);
        }

        log.methodDone("Run last task", 1);
    }


    private async runTask(task: Task | undefined, noTerminal?: boolean): Promise<boolean>
    {
        if (!task) {
            return false;
        }

        if (noTerminal === true) {
            task.presentationOptions.reveal = TaskRevealKind.Silent;
        }
        else {
            task.presentationOptions.reveal = TaskRevealKind.Always;
        }

        try {
            await tasks.executeTask(task);
        }
        catch (e) {
            const err = e.toString();
            if (err.indexOf("No workspace folder") !== -1)
            {
                window.showErrorMessage("Task execution failed:  No workspace folder.  NOTE: You must " +
                                        "save your workspace first before running 'User' tasks");
            }
            else {
                window.showErrorMessage("Task execution failed: " + err);
            }
            log.write("Task execution failed: " + err);
            return false;
        }
        return true;
    }


    /**
     * Run/execute a command, with arguments (prompt for args)
     *
     * @param taskItem TaskItem instance
     * @param noTerminal Whether or not to show the terminal
     * Note that the terminal will be shown if there is an error
     */
    public async runWithArgs(taskItem: TaskItem, args?: string, noTerminal?: boolean)
    {
        if (taskItem.task && !(taskItem.task.execution instanceof CustomExecution))
        {
            const me = this;
            const opts: InputBoxOptions = { prompt: "Enter command line arguments separated by spaces"};

            const _run = async (_args: string | undefined) =>
            {
                if (_args)
                {
                    let newTask: Task | undefined = taskItem?.task;
                    if (newTask && taskItem.task) {
                        const def = taskItem.task.definition,
                                folder = taskItem.getFolder();
                        if (folder) {
                            newTask = providers.get("extjs")?.createTask(def.script, undefined, folder, def.uri, _args.trim().split(" "), "   ");
                            //
                            // Since this task doesnt belong to a treeItem, then set the treeItem id that represents
                            // an instance of this task.
                            //
                            if (newTask) {
                                newTask.definition.taskItemId = def.taskItemId;
                            }
                        }
                    }
                    if (newTask) {
                        if (await this.runTask(newTask, noTerminal)) {
                            await me.saveTask(taskItem, this.maxLastTasks);
                        }
                    }
                }
            };

            if (!args) {
                window.showInputBox(opts).then(async (str) => { _run(str); });
            }
            else {
                await _run(args);
            }
        }
        else {
            window.showInformationMessage("Custom execution tasks cannot have the cmd line altered");
        }
    }


    private async saveTask(taskItem: TaskItem, maxTasks: number, isFavorite = false, logPad = "")
    {
        const storeName: string = !isFavorite ? constants.LAST_TASKS_STORE : constants.FAV_TASKS_STORE;
        const label: string = !isFavorite ? constants.LAST_TASKS_LABEL : constants.FAV_TASKS_LABEL;
        const cstTasks = storage.get<string[]>(storeName, []);
        const taskId =  this.getTaskItemId(taskItem);

        log.methodStart("save task", 1, logPad, false, [
            [ "treenode label", label ], [ "max tasks", maxTasks ], [ "is favorite", isFavorite ],
            [ "task id", taskId ], [ "current saved task ids", cstTasks.toString() ]
        ]);

        if (!taskId) {
            log.write("   invalid task id, exit", 1, logPad);
            return;
        }

        //
        // Moving it to the top of the list it if it already exists
        //
        if (utils.existsInArray(cstTasks, taskId) !== false) {
            await utils.removeFromArray(cstTasks, taskId);
        }

        if (maxTasks > 0) {
            while (cstTasks.length >= maxTasks)
            {
                cstTasks.shift();
            }
        }

        cstTasks.push(taskId);

        await storage.update(storeName, cstTasks);

        log.methodDone("save task", 1, logPad, false, [
            [ "new saved task ids", cstTasks.toString() ]
        ]);

        await this.showSpecialTasks(true, isFavorite, taskItem, logPad);
    }


    public async showSpecialTasks(show: boolean, isFavorite = false, taskItem?: TaskItem, logPad = "")
    {
        let changed = true;
        const tree = this.taskTree;
        const storeName: string = !isFavorite ? constants.LAST_TASKS_STORE : constants.FAV_TASKS_STORE;
        const label: string = !isFavorite ? constants.LAST_TASKS_LABEL : constants.FAV_TASKS_LABEL;
        const favIdx = 1;
        const treeIdx = !isFavorite ? 0 : favIdx;

        log.methodStart("show special tasks", 1, logPad, false, [
            [ "is favorite", isFavorite ], [ "fav index", favIdx ], [ "tree index", treeIdx ],
            [ "show", show ], [ "has task item", !!taskItem ]
        ]);

        if (!tree || tree.length === 0 ||
            (tree.length === 1 && tree[0].contextValue === "noscripts")) {
            log.write(logPad + "   no tasks found in tree", 1);
            return;
        }

        if (show)
        {
            if (!taskItem || isFavorite) // refresh
            {
                taskItem = undefined;
                if (tree[treeIdx]?.label === label) {
                    tree.splice(treeIdx, 1);
                }
                changed = true;
            }

            if (!isFavorite && tree[0]?.label !== label)
            {
                await this.createSpecialFolder(storeName, label, 0, false, "   ");
                changed = true;
            }
            else if (isFavorite && tree[favIdx]?.label !== label)
            {
                await this.createSpecialFolder(storeName, label, favIdx, true, "   ");
                changed = true;
            }
            else if (taskItem) // only 'last tasks' case here.  'favorites' are added
            {
                this.pushToTopOfSpecialFolder(taskItem, label, treeIdx);
                changed = true;
            }
        }
        else {
            if (!isFavorite && tree[0].label === constants.LAST_TASKS_LABEL)
            {
                tree.splice(0, 1);
                changed = true;
            }
            else if (isFavorite && tree[favIdx].label === constants.FAV_TASKS_LABEL)
            {
                tree.splice(favIdx, 1);
                changed = true;
            }
        }

        if (changed) {
            this._onDidChangeTreeData.fire(taskItem || null);
        }
    }


    private showStatusMessage(task: Task)
    {
        if (task && configuration.get<boolean>("showRunningTask") === true)
        {
            const exec = tasks.taskExecutions.find(e => e.task.name === task.name && e.task.source === task.source &&
                         e.task.scope === task.scope && e.task.definition.path === task.definition.path);
            if (exec)
            {
                if (!TaskTreeDataProvider.statusBarSpace) {
                    TaskTreeDataProvider.statusBarSpace = window.createStatusBarItem(StatusBarAlignment.Left, -10000);
                    TaskTreeDataProvider.statusBarSpace.tooltip = "Task Explorer running task";
                }
                let statusMsg = task.name;
                if ((task.scope as WorkspaceFolder).name) {
                    statusMsg += " (" + (task.scope as WorkspaceFolder).name + ")";
                }
                TaskTreeDataProvider.statusBarSpace.text = "$(loading~spin) " + statusMsg;
                TaskTreeDataProvider.statusBarSpace.show();
            }
            else {
                if (TaskTreeDataProvider.statusBarSpace) {
                    TaskTreeDataProvider.statusBarSpace.dispose();
                }
            }
        }
    }


    private sortFolder(folder: TaskFolder, logPad: string, logLevel: number)
    {
        this.sortTasks(folder.taskFiles, logPad, logLevel);
        for (const each of folder.taskFiles)
        {
            if ((each instanceof TaskFile)) { // && each.isGroup) {
                this.sortTasks(each.treeNodes, logPad, logLevel);
            }
        }
    }


    private sortLastTasks(items: (TaskFile | TaskItem)[] | undefined, lastTasks: string[], logPad: string, logLevel: number)
    {
        log.methodStart("sort last tasks", logLevel, logPad);
        items?.sort((a: TaskItem | TaskFile, b: TaskItem | TaskFile) =>
        {
            if (a.id && b.id) {
                const aIdx = lastTasks.indexOf(a.id.replace(constants.LAST_TASKS_LABEL + ":", ""));
                const bIdx = lastTasks.indexOf(b.id.replace(constants.LAST_TASKS_LABEL + ":", ""));
                return (aIdx < bIdx ? 1 : (bIdx < aIdx ? -1 : 0));
            }
            return 0;
        });
        log.methodDone("sort last tasks", logLevel, logPad);
    }


    private sortTasks(items: (TaskFile | TaskItem)[] | undefined, logPad = "", logLevel = 1)
    {
        log.methodStart("sort tasks", logLevel, logPad);
        items?.sort((a: TaskFile| TaskItem, b: TaskFile| TaskItem) =>
        {
            if (a.label && b.label)
            {
                if ((a instanceof TaskFile && b instanceof TaskFile || a instanceof TaskItem && b instanceof TaskItem)) {
                    return a.label?.toString()?.localeCompare(b.label?.toString());
                }
                //
                // TaskFiles we keep at the  top, like a folder in Windows Explorer
                //
                else if (a instanceof TaskFile && b instanceof TaskItem)
                {
                    return -1;
                }
                return 1;
            }
            return 0;
        });
        log.methodDone("sort tasks", logLevel, logPad);
    }


    private stop(taskItem: TaskItem)
    {
        log.methodStart("stop", 1, "", true);

        if (!taskItem || this.busy)
        {
            window.showInformationMessage("Busy, please wait...");
            return;
        }

        const task = taskItem.task,        // taskItem.execution will not be set if the view hasnt been visible yet
              exec = taskItem.execution || // this really would only occur in the tests
                     tasks.taskExecutions.find(e => e.task.name === task?.name && e.task.source === task.source &&
                     e.task.scope === task.scope && e.task.definition.path === task.definition.path);
        if (exec)
        {
            if (configuration.get<boolean>("keepTermOnStop") === true)
            {
                const terminal = this.getTerminal(taskItem, "   ");
                log.write("   keep terminal open", 1);
                if (terminal)
                {
                    if (taskItem.paused)
                    {
                        log.value("   send to terminal", "Y", 1);
                        terminal.sendText("Y");
                    }
                    else
                    {
                        log.value("   send to terminal", "\\u0003", 1);
                        terminal.sendText("\u0003");
                        setTimeout(() => {
                            log.value("   send to terminal", "Y", 1);
                            terminal.sendText("Y", true);
                        }, 500);
                    }
                    taskItem.paused = false;
                }
                else {
                    window.showInformationMessage("Terminal not found");
                }
            }
            else {
                log.write("   kill terminal", 1);
                exec.terminate();
            }
        }
        else {
            window.showInformationMessage("Executing task not found");
        }

        log.methodDone("stop", 1);
    }

    private taskIdStartEvents: Map<string, NodeJS.Timeout> = new Map();
    private taskIdStopEvents: Map<string, NodeJS.Timeout> = new Map();


    private async taskStartEvent(e: TaskStartEvent)
    {
        //
        // Clear debounce timeout if still pending.  VScode v1.57+ emits about a dozen task
        // start/end event for a task.  Sick of these damn bugs that keep getting introduced
        // seemingly every other version AT LEAST.
        //
        const task = e.execution.task,
              taskId = task.definition.taskItemId;
        let taskTimerId: NodeJS.Timeout | undefined;
        if (taskTimerId = this.taskIdStartEvents.get(taskId)) {
            clearTimeout(taskTimerId);
            this.taskIdStartEvents.delete(taskId);
        }
        //
        // Debounce!!  VScode v1.57+ emits about a dozen task start/end event for a task.  Sick
        // of these damn bugs that keep getting introduced seemingly every other version AT LEAST.
        //
        taskTimerId = setTimeout(async () =>
        {
            log.methodStart("task started event", 1);
            //
            // Show status bar message (if ON in settings)
            //
            this.showStatusMessage(task);
            const taskItem = await this.getTaskItems(taskId) as TaskItem;
            this.fireTaskChangeEvents(taskItem, "   ", 1);
            log.methodDone("task started event", 1);
        }, 50);

        this.taskIdStartEvents.set(taskId, taskTimerId);
    }



    private async taskFinishedEvent(e: TaskEndEvent)
    {
        //
        // Clear debounce timeout if still pending.  VScode v1.57+ emits about a dozen task
        // start/end event for a task.  Sick of these damn bugs that keep getting introduced
        // seemingly every other version AT LEAST.
        //
        const task = e.execution.task;
        const taskId = task.definition.taskItemId;
        let taskTimerId: NodeJS.Timeout | undefined;
        if (taskTimerId = this.taskIdStopEvents.get(taskId)) {
            clearTimeout(taskTimerId);
            this.taskIdStopEvents.delete(taskId);
        }
        //
        // Debounce!!  VScode v1.57+ emits about a dozen task start/end event for a task.  Sick
        // of these damn bugs that keep getting introduced seemingly every other version AT LEAST.
        //
        taskTimerId = setTimeout(async () =>
        {
            log.methodStart("task finished event", 1);
            //
            // Hide status bar message (if ON in settings)
            //
            this.showStatusMessage(task);
            const taskItem = await this.getTaskItems(taskId, "   ", false, 2) as TaskItem;
            this.fireTaskChangeEvents(taskItem, "   ", 1);
            log.methodDone("task finished event", 1);
        }, 50);

        this.taskIdStopEvents.set(taskId, taskTimerId);
    }

}
