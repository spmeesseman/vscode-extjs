
import { Disposable, ExtensionContext, OutputChannel, window } from "vscode";
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from "vscode-languageclient";
import { registerProviders } from "./providers/manager";
import { initStorage } from "./common/storage";
import { initFsStorage } from "./common/fsStorage";
import registerEnsureRequiresCommand from "./commands/ensureRequire";
import registerReplaceTextCommand from "./commands/replaceText";
import registerIgnoreErrorCommand from "./commands/ignoreError";
import ExtjsLanguageManager from "./languageManager";
import ServerRequest from "./common/ServerRequest";
import * as log from "./common/log";
import * as path from "path";


let client: LanguageClient;
let disposables: Disposable[];
const clients: Map<string, LanguageClient> = new Map();

export let extjsLangMgr: ExtjsLanguageManager;


export interface ExtJsApi
{
    extjsLangMgr: ExtjsLanguageManager | undefined;
}


export async function activate(context: ExtensionContext): Promise<ExtJsApi>
{
    log.initLog("extjsLangSvr", "ExtJs Language Client", context);

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
    // Register VSCode Language Providers, i.e. Hover providers, completion providers, etc
    //
    registerProviders(context);
    await run(context);

    //
    // Register VSCode Commands found in package.json contribuets.commands
    //
    registerCommands(context);

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

    return {
        extjsLangMgr
    };
}


function registerCommands(context: ExtensionContext)
{
    registerEnsureRequiresCommand(context);
    registerReplaceTextCommand(context);
    registerIgnoreErrorCommand(context);
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
        diagnosticCollectionName: "ExtJs Language Server",
        outputChannel,
        synchronize: {
            //
            // Notify the server about file changes to '.clientrc files contained in the workspace
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


export function deactivate(): Thenable<void>
{
    const promises: Thenable<void>[] = [];
    if (disposables) {
        for (const disposable of disposables) {
            disposable.dispose();
        }
    }
    if (client) {
        promises.push(client.stop());
    }
    for (const client of clients.values()) {
        promises.push(client.stop());
    }
    return Promise.all(promises).then(() => undefined);
}
