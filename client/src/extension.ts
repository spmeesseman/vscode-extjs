
import * as log from "./common/log";
import * as path from "path";
import registerEnsureRequiresCommand from "./commands/ensureRequire";
import registerIndexFilesCommand from "./commands/indexFiles";
import registerClearAstCommand from "./commands/clearAst";
import registerReplaceTextCommand from "./commands/replaceText";
import registerIgnoreErrorCommand from "./commands/ignoreError";
import registerWaitReadyCommand from "./commands/waitReady";
import ExtjsLanguageManager, { ILineProperties } from "./languageManager";
import ServerRequest from "./common/ServerRequest";
import { views } from "./providers/tasks/views";
import { ConfigurationChangeEvent, Disposable, ExtensionContext, OutputChannel, Position, tasks, TextDocument, window, workspace } from "vscode";
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from "vscode-languageclient";
import { registerProviders } from "./providers/manager";
import { initStorage } from "./common/storage";
import { initFsStorage } from "./common/fsStorage";
import { TaskTreeDataProvider } from "./providers/tasks/tree";
import { configuration } from "./common/configuration";
import { ExtJsTaskProvider } from "./providers/tasks/task";


let client: LanguageClient;
let taskTree: TaskTreeDataProvider | undefined;
let disposables: Disposable[];
const clients: Map<string, LanguageClient> = new Map();

export const providers: Map<string, ExtJsTaskProvider> = new Map();
export let extjsLangMgr: ExtjsLanguageManager;


export interface IExtjsLanguageManager
{
    getLineProperties: (document: TextDocument, position: Position, logPad: string, logLevel: number) => ILineProperties;
    setBusy: (busy: boolean) => void;
    setTests: (tests: boolean) => void;
}

export interface ExtJsApi
{
    extjsLangMgr: IExtjsLanguageManager;
    client: LanguageClient;
}


export async function activate(context: ExtensionContext): Promise<ExtJsApi>
{
    log.initLog("extjsIntellisense", "ExtJs Language Client", context);
    log.write("The ExtJs Language Server is now active!");

    //
    // Init global local storage
    //
    initStorage(context);
    //
    // Init FS storage for syntax caching, per project / workspace folder
    //
    // if (vscode.workspace.workspaceFolders) {
    //     for (const wsf of vscode.workspace.workspaceFolders) {
    //         initFsStorage(wsf.name, context);
    //     }
    // }
    initFsStorage(context);

    //
    // Start the server
    //
    await run(context);

    //
    // Register VSCode Commands found in package.json contributes.commands
    //
    registerCommands(context);

    //
    // Register internal task providers.  Npm, VScode type tasks are provided
    // by VSCode, not internally.
    //
    const taskProvider = new ExtJsTaskProvider();
    context.subscriptions.push(tasks.registerTaskProvider("extjs", taskProvider));
    providers.set("extjs", taskProvider);

    //
    // Register the task provider
    //
    if (configuration.get<boolean>("enableTaskExplorer")) {
        taskTree = registerExplorer("taskExplorer", context);
    }

    //
    // Refresh tree when folders are added/removed from the workspace
    //
    const workspaceWatcher = workspace.onDidChangeWorkspaceFolders(async(_e) =>
    {
        if (configuration.get<boolean>("enableTaskExplorer"))
        {
            if (taskTree) {
                await taskTree.refresh("newWsFolder");
            }
            else {
                taskTree = registerExplorer("taskExplorer", context);
            }
        }
    });
    context.subscriptions.push(workspaceWatcher);

    //
    // Register configurations/settings change watcher
    //
    const d = workspace.onDidChangeConfiguration(async e => {
        await processConfigChanges(context, e);
    });
    context.subscriptions.push(d);

    //
    // Init/clear FS storage for syntax caching when a new project/workspace folder is added/removed
    //
    // const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(async(_e) =>
    // {
    //     for (const wsf of _e.removed) {
    //         // clearFsStorage(wsf.name, context);
    //     }
    //     for (const wsf of _e.added) {
    //         initFsStorage(wsf.name, context);
    //     }
    // });
    // context.subscriptions.push(workspaceWatcher);


    //
    // Language Manager
    //
    extjsLangMgr = new ExtjsLanguageManager(new ServerRequest(client));
    disposables = await extjsLangMgr.initialize(context);

    //
    // Register VSCode Language Providers, i.e. Hover providers, completion providers, etc
    //
    registerProviders(context);

    return {
        extjsLangMgr,
        client
    };
}


async function processConfigChanges(context: ExtensionContext, e: ConfigurationChangeEvent)
{
    if (e.affectsConfiguration("extjsIntellisense.enableTaskExplorer"))
    {
        if (configuration.get<boolean>("enableTaskExplorer")) {
            if (taskTree) {
                await taskTree.refresh("config");
            }
            else {
                taskTree = registerExplorer("taskExplorer", context);
            }
        }
    }
}


function registerCommands(context: ExtensionContext)
{
    registerEnsureRequiresCommand(context);
    registerReplaceTextCommand(context);
    registerIgnoreErrorCommand(context);
    registerIndexFilesCommand(context);
    registerClearAstCommand(context);
    registerWaitReadyCommand(context);
}


function registerExplorer(name: string, context: ExtensionContext, enabled?: boolean): TaskTreeDataProvider | undefined
{
    log.write("Register tasks tree provider '" + name + "'");

    if (enabled !== false)
    {
        if (workspace.workspaceFolders)
        {
            const treeDataProvider = new TaskTreeDataProvider(name, context);
            const treeView = window.createTreeView(name, { treeDataProvider, showCollapseAll: true });
            const view = views.get(name);
            if (view) {
                context.subscriptions.push(view);
                log.write("   Tree data provider registered'" + name + "'");
            }
            return treeDataProvider;
        }
        else {
            log.write("✘ No workspace folders!!!");
        }
    }

    return undefined;
}


async function run(context: ExtensionContext)
{
    //
    // Create an output channel for the server to log to
    //
    // To enable chatter between client and server on this channel, set the following setting
    // in settings.json:
    //
    //    "extjsLangServer.trace.server": "verbose"
    //
    // Otherwise, extension debug logging only will occur on this channel, if it is enabled in
    // the user's settings.
    //
    const outputChannel: OutputChannel = window.createOutputChannel("ExtJs Language Server");

    //
    // The server is implemented in nodevscode.
    //
    const serverModule = context.asAbsolutePath(
        path.join("dist", "server", "server.js")
    );

    //
    // The debug options for the server:
    //
    //     --inspect=6009
    //
    // Runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
    //
    const debugOptions = { execArgv: [ "--nolazy", "--inspect=6009" ] };

    //
    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    //
    const serverOptions: ServerOptions =
    {
        run: {
            module: serverModule,
            transport: TransportKind.ipc
        },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: debugOptions
        }
    };

    //
    // Options to control the language client
    //
    const clientOptions: LanguageClientOptions =
    {   //
        // Register the server for JS documents
        //
        documentSelector: [{ scheme: "file", language: "javascript" } ],
        diagnosticCollectionName: "ExtJs Intellisense",
        outputChannel,
        synchronize: {
            //
            // Notify the server about file changes to '.extjsrc files contained in the workspace
            // fileEvents: vscode.workspace.createFileSystemWatcher('**/*.js'),
        }   //
    };

    // We are only interested in language mode text
    // if (document.languageId !== "plaintext" || (document.uri.scheme !== "file" && document.uri.scheme !== "untitled")) {
    //     return;
    // }
    //
    // const uri = document.uri;
    // // Untitled files go to a default client.
    // if (uri.scheme === "untitled" && !client) {
    //     const debugOptions = { execArgv: ["--nolazy", "--inspect=6010"] };
    //     const serverOptions = {
    //         run: { module, transport: TransportKind.ipc },
    //         debug: { module, transport: TransportKind.ipc, options: debugOptions}
    //     };
    //     const clientOptions: LanguageClientOptions = {
    //         documentSelector: [
    //             { scheme: "untitled", language: "plaintext" }
    //         ],
    //         diagnosticCollectionName: "lsp-multi-server-example",
    //         outputChannel: outputChannel
    //     };
    //     client = new LanguageClient("lsp-multi-server-example", "LSP Multi Server Example", serverOptions, clientOptions);
    //     client.start();
    //     return;
    // }
    // let folder = Workspace.getWorkspaceFolder(uri);
    // // Files outside a folder can't be handled. This might depend on the language.
    // // Single file languages like JSON might handle files outside the workspace folders.
    // if (!folder) {
    //     return;
    // }
    // // If we have nested workspace folders we only start a server on the outer most workspace folder.
    // folder = getOuterMostWorkspaceFolder(folder);
    //
    // if (!clients.has(folder.uri.toString())) {
    //     const debugOptions = { execArgv: ["--nolazy", `--inspect=${6011 + clients.size}`] };
    //     const serverOptions = {
    //         run: { module, transport: TransportKind.ipc },
    //         debug: { module, transport: TransportKind.ipc, options: debugOptions}
    //     };
    //     const clientOptions: LanguageClientOptions = {
    //         documentSelector: [
    //             { scheme: "file", language: "plaintext", pattern: `${folder.uri.fsPath}/**/*` }
    //         ],
    //         diagnosticCollectionName: "lsp-multi-server-example",
    //         workspaceFolder: folder,
    //         outputChannel: outputChannel
    //     };
    //     const client = new LanguageClient("lsp-multi-server-example", "LSP Multi Server Example", serverOptions, clientOptions);
    //     client.start();
    //     clients.set(folder.uri.toString(), client);
    // }

    //
    // Create the language client and start the client.
    //
    client = new LanguageClient(
        "extjsLangServer",
        "VSCode ExtJs Language Server",
        serverOptions,
        clientOptions
    );

    client.start();

    // vscode.workspace.onDidChangeWorkspaceFolders((event) =>
    // {
    //     for (const folder  of event.removed)
    //     {
    //         const client = clients.get(folder.uri.toString());
    //         if (client) {
    //             clients.delete(folder.uri.toString());
    //             client.stop();
    //         }
    //     }
    // });

    await client.onReady();
    return client;
}


export async function deactivate()
{
    const promises: Thenable<void>[] = [];
    for (const disposable of disposables) {
        disposable.dispose();
    }
    promises.push(client.stop());
    for (const client of clients.values()) {
        promises.push(client.stop());
    }
    return Promise.all(promises).then(() => undefined);
}
