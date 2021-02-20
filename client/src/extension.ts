
import * as path from "path";
import * as vscode from "vscode";
import * as util from "./common/utils";
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from "vscode-languageclient";
import registerEnsureRequireCommand from "./commands/ensureRequire";
import { registerProviders } from "./providers/manager";
import ExtjsLanguageManager from "./languageManager";
import ServerRequest from "./common/ServerRequest";

let client: LanguageClient;
let disposables: vscode.Disposable[];
const clients: Map<string, LanguageClient> = new Map();


export async function activate(context: vscode.ExtensionContext)
{
    util.initLog("extjsLangSvr", "ExtJs Language Client", context);

    util.log("The ExtJs Language Server is now active!");

    registerProviders(context);
    await run(context);

    const serverRequest = new ServerRequest(client);
    const extjsLanguageManager = new ExtjsLanguageManager(serverRequest);

    registerEnsureRequireCommand(context, serverRequest);

    disposables = await extjsLanguageManager.setup(context);
}


async function run(context: vscode.ExtensionContext)
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
    const outputChannel: vscode.OutputChannel = vscode.window.createOutputChannel("ExtJs Language Server");

    //
    // The server is implemented in nodevscode.
    //
    const serverModule = context.asAbsolutePath(
        path.join("dist", "server.js")
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
