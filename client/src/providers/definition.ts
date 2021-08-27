
import {
    CancellationToken, commands, DefinitionProvider, ExtensionContext, languages, Location,
    Position, TextDocument, Uri
} from "vscode";
import { extjsLangMgr } from "../extension";
import { ComponentType, utils } from "../../../common";
import * as log from "../common/log";
import { shouldIgnoreType } from "../common/clientUtils";


class ExtJsDefinitionProvider implements DefinitionProvider
{
    async provideDefinition(document: TextDocument, position: Position, token: CancellationToken)
    {
        let location: Location | undefined;

        if (!utils.isExtJsFile(document.getText())) {
            return;
        }

        log.methodStart("provide definition", 1, "", true);

        //
        // It's possible the indexer initiated a re-indexing since editing the document is
        // what triggers thecompletion item request, so wait for it to finish b4 proceeding
        //
        await commands.executeCommand("vscode-extjs:waitReady", "   ", 3);
        //
        // Indexer finished, proceed...
        //

        const { cmpType, property, cmpClass, thisClass, project } = extjsLangMgr.getLineProperties(document, position, "   ", 2);

        if (property && cmpClass && cmpType !== undefined && cmpType !== ComponentType.None)
        {
            log.value("   component class", cmpClass, 2);
            const fsPath = extjsLangMgr.getFilePath(cmpClass, project, "   ");
            if (fsPath)
            {
                const uri = Uri.file(fsPath),
                      { start, end } = extjsLangMgr.getPropertyPosition(property, cmpType, cmpClass, project, false, "   ", 2),
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
