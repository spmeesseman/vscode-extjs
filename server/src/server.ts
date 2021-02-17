/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { createConnection, ProposedFeatures, InitializeParams, InitializeResult, DidChangeConfigurationNotification, TextDocumentSyncKind } from "vscode-languageserver";
import { parseExtJsFile, getExtJsComponent } from "./syntaxTree";
import { initLog } from "./util";

//
// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
//
const connection = createConnection(ProposedFeatures.all);

// let hasConfigurationCapability: boolean = false;
// let hasWorkspaceFolderCapability: boolean = false;
// let hasDiagnosticRelatedInformationCapability: boolean = false;
//
// interface ExtJsLsSettings
// {
//     debug: boolean;
//     debugLevel: number;
// }
//
// const defaultSettings: ExtJsLsSettings = { debug: false, debugLevel: 2 };
// let globalSettings: ExtJsLsSettings = defaultSettings;
//
// // Cache the settings of all open documents
// let extjsSettings: Map<string, Thenable<ExtJsLsSettings>> = new Map();


// connection.onInitialize((params: InitializeParams) =>
// {
//     let capabilities = params.capabilities;
//
//     //
//     // Does the client support the `workspace/configuration` request?   If not, we fall back
//     // using global settings.
//     //
//     hasConfigurationCapability = !!(
//         capabilities.workspace && !!capabilities.workspace.configuration
//     );
//
//     hasWorkspaceFolderCapability = !!(
//         capabilities.workspace && !!capabilities.workspace.workspaceFolders
//     );
//
//     hasDiagnosticRelatedInformationCapability = !!(
//         capabilities.textDocument &&
//         capabilities.textDocument.publishDiagnostics &&
//         capabilities.textDocument.publishDiagnostics.relatedInformation
//     );
//
//     const result: InitializeResult = {
//         capabilities: {
//             textDocumentSync: TextDocumentSyncKind.Incremental,
//             // Tell the client that this server supports code completion.
//             completionProvider: {
//                 resolveProvider: true
//             }
//         }
//     };
//
//     if (hasWorkspaceFolderCapability)
//     {
//         result.capabilities.workspace = {
//             workspaceFolders: {
//                 supported: true
//             }
//         };
//     }
//
//     return result;
// });

connection.onInitialized(async () =>
{
    // if (hasConfigurationCapability)
    // {   //
    //     // Register for all configuration changes.
    //     //connection.client.register(DidChangeConfigurationNotification.type, undefined);
    // }
    // if (hasWorkspaceFolderCapability)
    // {
    //     connection.workspace.onDidChangeWorkspaceFolders(_event => {
    //         connection.console.log("Workspace folder change event received.");
    //     });
    // }
    initLog();
    // connection.console.log((await getSettings("debug")).toString());
});
//
// connection.onDidChangeConfiguration(change =>
// {
//     console.log("connection.onDidChangeConfiguration");
//     if (hasConfigurationCapability) {
//         // Reset all cached document settings
//         extjsSettings.clear();
//     }
//     else {
//         globalSettings = <ExtJsLsSettings>(
//             (change.settings.extjsLangSvr || defaultSettings)
//         );
//     }
// });

connection.onRequest("parseExtJsFile", async (text: string) =>
{
    try {
        return await parseExtJsFile(text);
    }
    catch (error)
    {
        if (error instanceof SyntaxError) {
            return null;
        }
        throw error;
    }
});

connection.onRequest("getExtJsComponent", async (text: string) =>
{
    try {
        return await getExtJsComponent(text);
    }
    catch (error)
    {
        if (error instanceof SyntaxError) {
            return null;
        }
        throw error;
    }
});

connection.onRequest("onSettingsChange", async () =>
{
    try {
        connection.console.log("HERE!!");
        //await initLog();
        connection.console.log("HERE22!!");
    }
    catch (error)
    {
        if (error instanceof SyntaxError) {
            return null;
        }
        throw error;
    }
});

//
// Listen
//
connection.listen();

// function getSettings(resource: string): Thenable<ExtJsLsSettings>
// {
//     if (!hasConfigurationCapability) {
//       return Promise.resolve(globalSettings);
//     }
//     let result = extjsSettings.get(resource);
//     if (!result)
//     {
//         result = connection.workspace.getConfiguration({
//             scopeUri: resource,
//             section: "extjsLangSvr"
//         });
//         extjsSettings.set(resource, result);
//     }
//     return result;
// }

export { connection };
