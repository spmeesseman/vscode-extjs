/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
    createConnection, TextDocuments, ProposedFeatures, InitializeParams,
	DidChangeConfigurationNotification, TextDocumentSyncKind, InitializeResult
} from "vscode-languageserver";
import {
	TextDocument
} from "vscode-languageserver-textdocument";
import { parseExtJsFile, getExtJsComponent } from "./syntaxTree";
import { ISettings, defaultSettings } from  "../../common";
import { validateExtJsDocument, validateExtJsFile } from "./validation";


//
// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
//
const connection = createConnection(ProposedFeatures.all);
//
// Document Management
//
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
//
// Capabilities
//
let hasConfigurationCapability = false,
    hasWorkspaceFolderCapability = false,
    hasDiagnosticRelatedInformationCapability = false;
//
// Global Settings
//
let globalSettings: ISettings = defaultSettings;


// documents.onDidClose(e => {
//
// });
//
//
documents.onDidChangeContent(change => {
	validateExtJsDocument(change.document, connection, hasDiagnosticRelatedInformationCapability);
});


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
            // //
            // // Tell the client that this server supports code completion.
            // //
            // completionProvider: {
            //     resolveProvider: true
            // }
            textDocumentSync: {
				openClose: true,
				change: TextDocumentSyncKind.Incremental
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
    // if (hasWorkspaceFolderCapability)
    // {
    //     connection.workspace.onDidChangeWorkspaceFolders(_event => {
    //         connection.console.log("Workspace folder change event received.");
    //         console.log("Workspace folder change event received.");
    //         console.log(_event);
    //     });
    // }
});


connection.onDidChangeConfiguration(change =>
{
    globalSettings = <ISettings>(
        (change.settings?.extjsLangSvr || defaultSettings)
    );
	// documents.all().forEach((textDocument) => {
    //     validateExtJsFile(textDocument, connection, hasDiagnosticRelatedInformationCapability);
    // });
});


connection.onRequest("parseExtJsFile", async (param: any) =>
{
    try {
        const jso = JSON.parse(param);
        return await parseExtJsFile(jso?.fsPath, jso?.text, jso?.nameSpace, jso?.isFramework);
    }
    catch (error)
    {
        if (error instanceof SyntaxError) {
            return null;
        }
        throw error;
    }
});


connection.onRequest("validateExtJsFile", async (param: any) =>
{
    try {
        await validateExtJsFile(JSON.parse(param), connection, hasDiagnosticRelatedInformationCapability);
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
// documents.listen(connection);
connection.listen();


export { connection, globalSettings };
