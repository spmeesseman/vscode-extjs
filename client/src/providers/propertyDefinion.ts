
import {
    CancellationToken, DefinitionProvider, ExtensionContext, languages, Location,
    LocationLink, Position, ProviderResult, Range, TextDocument, Uri
} from "vscode";
import { extjsLangMgr } from "../extension";
import { ComponentType, utils } from "../../../common";
import { isPositionInRange } from "../common/clientUtils";
import * as log from "../common/log";


class PropertyDefinitionProvider implements DefinitionProvider
{
    provideDefinition(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Location | Location[] | LocationLink[]>
    {
        log.methodStart("provide definition", 1);

        const { cmpType, property, cmpClass, thisClass } = extjsLangMgr.getLineProperties(document, position, "   ");

        if (property && cmpClass && cmpType !== undefined && cmpType !== ComponentType.None)
        {
            log.value("   component class", cmpClass, 2);
            const fsPath = extjsLangMgr.getFilePath(cmpClass);
            if (fsPath)
            {
                const uri = Uri.file(fsPath),
                      { start, end } = extjsLangMgr.getPropertyPosition(property, cmpType, cmpClass, "   "),
                      range = extjsLangMgr.getPropertyRange(property, thisClass, start, end, position);
                //
                // Provide a `Location` object to VSCode
                //
                log.methodDone("provide definition", 1, "", false, [["fsPath", uri.fsPath ]]);
                return {
                    uri,
                    range
                };
            }
        }
    }
}


export default function registerPropertyDefinitionProvider(context: ExtensionContext)
{
    context.subscriptions.push(languages.registerDefinitionProvider("javascript", new PropertyDefinitionProvider()));
}
