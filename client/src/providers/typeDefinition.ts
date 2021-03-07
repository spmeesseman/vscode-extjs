
import {
    CancellationToken, TypeDefinitionProvider, ExtensionContext, languages, Location,
    LocationLink, Position, ProviderResult, TextDocument, Uri
} from "vscode";
import { extjsLangMgr } from "../extension";
import * as log from "../common/log";
import { ComponentType } from "../../../common";


class ExtJsTypeDefinitionProvider implements TypeDefinitionProvider
{
    provideTypeDefinition(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Location | Location[] | LocationLink[]>
    {
        log.methodStart("provide type definition", 1);

        const { cmpClass, cmpType, property, thisClass } = extjsLangMgr.getLineProperties(document, position, "   ");

        if (property && cmpClass && (cmpType === ComponentType.Property || cmpType === ComponentType.Class))
        {
            log.value("   component class", cmpClass, 2);
            const fsPath = extjsLangMgr.getFilePath(cmpClass);
            if (fsPath)
            {
                const uri = Uri.file(fsPath),
                      { start, end } = extjsLangMgr.getPropertyPosition(property, cmpType, cmpClass, "   "),
                      range = extjsLangMgr.getPropertyRange(property, thisClass, start, end, position);
                log.value("   fsPath", uri.fsPath, 2);
                log.write("   open type definition file", 1);
                log.write("provide type definition complete", 1);
                return {
                    uri,
                    range
                };
            }
            else {
                log.write("   fs path not found", 1);
            }
        }

        log.methodDone("provide type definition", 1);
    }
}


export default function registerTypeDefinitionProvider(context: ExtensionContext)
{
    context.subscriptions.push(languages.registerTypeDefinitionProvider("javascript", new ExtJsTypeDefinitionProvider()));
}
