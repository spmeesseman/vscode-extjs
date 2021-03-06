
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
                      { start, end } = extjsLangMgr.getPropertyPosition(property, cmpType, cmpClass, "   ");
                let range = new Range(start, end);
                //
                // If the position is within the range of the goto definition, the provided definition will be
                // ignored by VSCode.  For example, consider the base class `VSCodeExtJS`, and the following
                // method call in one of it's own methods:
                //
                //     VSCodeExtJS.common.UserDropdown.create();
                //
                // The range of `VSCodeExtJS` is within class itself, so just reset the range to just be the
                // start position.  In this case the property 'VSCodeExtJS` is equal to the class 'VSCodeExtJS'.
                //
                if (thisClass === property && isPositionInRange(position, range))
                {
                    range = new Range(start, start);
                }
                //
                // Provide a `Location` object to VSCode
                //
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
