
import {
    CancellationToken, DefinitionProvider, ExtensionContext, languages, Location,
    LocationLink, Position, ProviderResult, Range, TextDocument, Uri
} from "vscode";
import { extjsLangMgr } from "../extension";
import { ComponentType } from "../../../common";
import * as log from "../common/log";


class PropertyDefinitionProvider implements DefinitionProvider
{
    provideDefinition(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Location | Location[] | LocationLink[]>
    {
        log.methodStart("provide definition", 1);

        const { cmpType, property, cmpClass } = extjsLangMgr.getLineProperties(document, position, "   ");

        if (property && cmpClass && cmpType !== undefined && cmpType !== ComponentType.None)
        {
            log.value("   component class", cmpClass, 2);
            const fsPath = extjsLangMgr.getFilePath(cmpClass);
            if (fsPath)
            {
                const uri = Uri.file(fsPath),
                      { start, end } = extjsLangMgr.getPropertyPosition(property, cmpType, cmpClass, "   "),
                      range = new Range(start, end);
                log.value("   fsPath", uri.fsPath, 2);
                log.write("   open definition file", 1);
                log.write("provide definition complete", 1);
                return {
                    uri,
                    range
                };
            }
            else {
                log.write("   fs path not found", 1);
            }
        }

        log.methodDone("provide definition complete", 1);
    }
}


export default function registerPropertyDefinitionProvider(context: ExtensionContext)
{
    context.subscriptions.push(languages.registerDefinitionProvider("javascript", new PropertyDefinitionProvider()));
}
