/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { createConnection, ProposedFeatures } from "vscode-languageserver";
import { parseExtJsFile, getExtJsComponent } from "./astUtil";

//
// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
//
const connection = createConnection(ProposedFeatures.all);


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

export { connection };
