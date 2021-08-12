
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
        let location: Location | undefined;

        log.methodStart("provide type definition", 1, "", true);

        const { cmpClass, cmpType, property, thisClass } = extjsLangMgr.getLineProperties(document, position, "   ");

        if (property && cmpClass && (cmpType === ComponentType.Property || cmpType === ComponentType.Class))
        {
            log.value("   component class", cmpClass, 2);
            const fsPath = extjsLangMgr.getFilePath(cmpClass);
            if (fsPath)
            {
                const uri = Uri.file(fsPath),
                      { start, end } = extjsLangMgr.getPropertyPosition(property, cmpType, cmpClass, extjsLangMgr.getNamespaceFromClass(cmpClass), "   "),
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
