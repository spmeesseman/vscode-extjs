
import {
    CancellationToken, TypeDefinitionProvider, ExtensionContext, languages, Location,
    LocationLink, Position, ProviderResult, TextDocument, Uri, commands
} from "vscode";
import { extjsLangMgr } from "../extension";
import * as log from "../common/log";
import { ComponentType } from "../../../common";


class ExtJsTypeDefinitionProvider implements TypeDefinitionProvider
{
    async provideTypeDefinition(document: TextDocument, position: Position, token: CancellationToken)
    {
        let location: Location | undefined;

        log.methodStart("provide type definition", 1, "", true);

        //
        // It's possible the indexer initiated a re-indexing since editing the document is
        // what triggers thecompletion item request, so wait for it to finish b4 proceeding
        //
        await commands.executeCommand("vscode-extjs:waitReady", "   ");

        //
        // Indexer finished, proceed...
        //

        const { cmpClass, cmpType, property, thisClass, project } = extjsLangMgr.getLineProperties(document, position, "   ");

        if (property && cmpClass && (cmpType === ComponentType.Property || cmpType === ComponentType.Class))
        {
            log.value("   component class", cmpClass, 2);
            const fsPath = extjsLangMgr.getFilePath(cmpClass);
            if (fsPath)
            {
                const uri = Uri.file(fsPath),
                      ns = extjsLangMgr.getNamespaceFromClass(cmpClass, project, undefined, "   ", 2),
                      { start, end } = extjsLangMgr.getPropertyPosition(property, cmpType, cmpClass, ns, project, false, "   ", 2),
                      range = extjsLangMgr.getPropertyRange(property, thisClass, start, end, position);
                log.value("   fsPath", uri.fsPath, 2);
                //
                // Provide a `Location` object to VSCode
                //
                location = {
                    uri,
                    range
                };
            }
        }

        log.methodDone("provide type definition", 1);
        return location;
    }
}


export default function registerTypeDefinitionProvider(context: ExtensionContext)
{
    context.subscriptions.push(languages.registerTypeDefinitionProvider("javascript", new ExtJsTypeDefinitionProvider()));
}
