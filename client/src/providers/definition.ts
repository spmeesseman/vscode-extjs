
import {
    CancellationToken, commands, DefinitionProvider, ExtensionContext, languages, Location,
    Position, TextDocument, Uri
} from "vscode";
import { extjsLangMgr } from "../extension";
import { ComponentType } from "../../../common";
import * as log from "../common/log";


class ExtJsDefinitionProvider implements DefinitionProvider
{
    async provideDefinition(document: TextDocument, position: Position, token: CancellationToken)
    {
        let location: Location | undefined;

        log.methodStart("provide definition", 1, "", true);

        //
        // It's possible the indexer initiated a re-indexing since editing the document is
        // what triggers thecompletion item request, so wait for it to finish b4 proceeding
        //
        await commands.executeCommand("vscode-extjs:waitReady", "   ");
        //
        // Indexer finished, proceed...
        //

        const { cmpType, property, cmpClass, thisClass, project } = extjsLangMgr.getLineProperties(document, position, "   ");

        if (property && cmpClass && cmpType !== undefined && cmpType !== ComponentType.None)
        {
            log.value("   component class", cmpClass, 2);
            const fsPath = extjsLangMgr.getFilePath(cmpClass, project, "   ");
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
        log.methodDone("provide definition", 1);
        return location;
    }
}


export default function registerDefinitionProvider(context: ExtensionContext)
{
    context.subscriptions.push(languages.registerDefinitionProvider("javascript", new ExtJsDefinitionProvider()));
}
