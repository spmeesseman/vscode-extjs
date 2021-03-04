
import {
    CancellationToken, TypeDefinitionProvider, ExtensionContext, languages, Location,
    LocationLink, Position, ProviderResult, Range, TextDocument, Uri, window
} from "vscode";
import { extjsLangMgr } from "../extension";
import * as log from "../common/log";
import { toVscodePosition } from "../common/clientUtils";
import { utils, ComponentType } from "../../../common";


class ExtJsTypeDefinitionProvider implements TypeDefinitionProvider
{
    provideTypeDefinition(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Location | Location[] | LocationLink[]>
    {
        log.methodStart("provide type definition", 1);

        // eslint-disable-next-line prefer-const
        let { cmpClass, cmpType, property } = extjsLangMgr.getLineProperties(document, position, "   ");

        if (property && cmpClass && cmpType === ComponentType.Class)
        {
            log.value("   component class", cmpClass, 2);
            const fsPath = extjsLangMgr.getFilePath(cmpClass);
            if (fsPath)
            {
                let start = new Position(0, 0),
                    end = new Position(0, 0);
                const pObject = extjsLangMgr.getProperty(cmpClass, property);
                if (pObject)
                {
                    log.write("   setting position", 2);
                    log.value("      start line", pObject.start?.line, 3);
                    log.value("      end line", pObject.end?.line, 3);
                    start = toVscodePosition(pObject.start);
                    end = toVscodePosition(pObject.end);
                }
                const uri = Uri.file(fsPath),
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

        log.methodDone("provide type definition", 1);
    }
}


export default function registerTypeDefinitionProvider(context: ExtensionContext)
{
    context.subscriptions.push(languages.registerTypeDefinitionProvider("javascript", new ExtJsTypeDefinitionProvider()));
}
