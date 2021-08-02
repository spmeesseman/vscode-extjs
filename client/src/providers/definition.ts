
import {
    CancellationToken, DefinitionProvider, ExtensionContext, languages, Location,
    LocationLink, Position, ProviderResult, TextDocument, Uri
} from "vscode";
import { extjsLangMgr } from "../extension";
import { ComponentType } from "../../../common";
import * as log from "../common/log";


class ExtJsDefinitionProvider implements DefinitionProvider
{
    provideDefinition(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Location | Location[] | LocationLink[]>
    {
        let location: Location | undefined;

        log.methodStart("provide definition", 1, "", true);

        const { cmpType, property, cmpClass, thisClass } = extjsLangMgr.getLineProperties(document, position, "   ");
        const ns = cmpClass ? extjsLangMgr.getNamespaceFromFile(document.uri.fsPath) : undefined;

        if (property && cmpClass && cmpType !== undefined && cmpType !== ComponentType.None)
        {
            log.value("   component class", cmpClass, 2);
            const fsPath = extjsLangMgr.getFilePath(cmpClass, "   ");
            if (fsPath)
            {
                const uri = Uri.file(fsPath),
                      { start, end } = extjsLangMgr.getPropertyPosition(property, cmpType, cmpClass, ns, "   "),
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
