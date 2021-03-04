
import {
    CancellationToken, DefinitionProvider, ExtensionContext, languages, Location,
    LocationLink, Position, ProviderResult, Range, TextDocument, Uri, window
} from "vscode";
import { extjsLangMgr } from "../extension";
import * as log from "../common/log";
import { toVscodePosition } from "../common/clientUtils";
import { utils, ComponentType } from "../../../common";


class PropertyDefinitionProvider implements DefinitionProvider
{
    provideDefinition(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Location | Location[] | LocationLink[]>
    {
        log.methodStart("provide definition", 1);

        // eslint-disable-next-line prefer-const
        let { cmpType, property, cmpClass } = extjsLangMgr.getLineProperties(document, position, "   ");

        if (property && cmpClass && cmpType !== undefined && cmpType !== ComponentType.None)
        {
            log.value("   component class", cmpClass, 2);
            const fsPath = extjsLangMgr.getFilePath(cmpClass);
            if (fsPath)
            {
                let start = new Position(0, 0),
                    end = new Position(0, 0);
                let pObject = cmpType === ComponentType.Method ? extjsLangMgr.getMethod(cmpClass, property) :
                                            (cmpType === ComponentType.Config ? extjsLangMgr.getConfig(cmpClass, property) :
                                                                                extjsLangMgr.getProperty(cmpClass, property));
                if (cmpType === ComponentType.Method && (property.startsWith("get") || property.startsWith("set")))
                {
                    const cProperty = utils.lowerCaseFirstChar(property.substring(3)),
                            cObject = cProperty ? extjsLangMgr.getConfig(cmpClass, cProperty) : undefined;
                    if (cObject) {
                        cmpType = ComponentType.Config;
                        pObject = cObject;
                        property = cProperty;
                        log.value("      config name", property, 2);
                    }
                }
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

        log.methodDone("provide definition complete", 1);
    }
}


export default function registerPropertyDefinitionProvider(context: ExtensionContext)
{
    context.subscriptions.push(languages.registerDefinitionProvider("javascript", new PropertyDefinitionProvider()));
}
