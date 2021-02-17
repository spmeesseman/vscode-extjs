/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
    createConnection, ProposedFeatures, InitializeParams, InitializeResult,
    DidChangeConfigurationNotification, TextDocumentSyncKind
} from "vscode-languageserver";
import { parseExtJsFile, getExtJsComponent } from "./syntaxTree";
import { ISettings } from "./interface";

//
// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
//
const connection = createConnection(ProposedFeatures.all);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

const defaultSettings: ISettings = {
    debug: false,
    debugLevel: 1,
    include: [ "app", "extjs", "node_modules/@sencha/ext" ]
};

let globalSettings: ISettings = defaultSettings;


connection.onInitialize((params: InitializeParams) =>
{
    const capabilities = params.capabilities;

    hasConfigurationCapability = !!(
        capabilities.workspace && !!capabilities.workspace.configuration
    );

    hasWorkspaceFolderCapability = !!(
        capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );

    hasDiagnosticRelatedInformationCapability = !!(
        capabilities.textDocument &&
        capabilities.textDocument.publishDiagnostics &&
        capabilities.textDocument.publishDiagnostics.relatedInformation
    );

    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            //
            // Tell the client that this server supports code completion.
            //
            completionProvider: {
                resolveProvider: true
            }
        }
    };

    if (hasWorkspaceFolderCapability)
    {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true
            }
        };
    }

    return result;
});

connection.onInitialized(async () =>
{
    if (hasConfigurationCapability)
    {   //
        // Register for all configuration changes.
        //
        await connection.client.register(DidChangeConfigurationNotification.type, { section: "extjsLangSvr" });
    }
    if (hasWorkspaceFolderCapability)
    {
        // connection.workspace.onDidChangeWorkspaceFolders(_event => {
        //     // connection.console.log("Workspace folder change event received.");
        // });
    }
});

connection.onDidChangeConfiguration(change =>
{
    globalSettings = <ISettings>(
        (change.settings?.extjsLangSvr || defaultSettings)
    );
});

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

//
// Listen
//
connection.listen();


export { connection, globalSettings };
