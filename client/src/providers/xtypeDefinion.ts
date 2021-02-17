
import { CancellationToken, DefinitionProvider, ExtensionContext, languages, Location, LocationLink, Position, ProviderResult, Range, TextDocument, Uri, workspace } from "vscode";
import { getComponentClass, getFilePath, getXType } from "../languageManager";
import * as util from "../common/utils";


class XtypeDefinitionProvider implements DefinitionProvider
{
    provideDefinition(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Location | Location[] | LocationLink[]>
    {
        const range = document.getWordRangeAtPosition(position);
        if (range === undefined) {
            return;
        }

        const line = position.line,
			  xtype = document.getText(range),
			  text = document.getText(new Range(new Position(line, 0), new Position(line, range.end.character + 1)));

        if (new RegExp(`xtype\\s*:\\s*(['"])${xtype}\\1$`).test(text))
        {
            const componentClass = getComponentClass(xtype);
            if (componentClass)
            {
                const fsPath = getFilePath(componentClass);
                if (fsPath)
                {
                    let start = new Position(0, 0),
                        end = new Position(0, 0);
                    const pObject = getXType(componentClass, xtype);
                    if (pObject) {
                        start = new Position(pObject.start?.line, pObject.start?.column);
                        end = new Position(pObject.end?.line, pObject.end?.column);
                    }
                    const uriPath = Uri.parse(fsPath).path.replace(/\\/g, "/"), // win32 compat
                          uri = Uri.parse(`file://${uriPath}`),
                          range = new Range(start, end);
                    util.log("open definition file", 1);
                    util.logValue("   component class", componentClass, 2);
                    util.logValue("   fsPath", uri.fsPath, 2);
                    return {
                        uri,
                        range
                    };
                }
            }
        }
    }
}


export default function registerXtypeDefinitionProvider(context: ExtensionContext)
{
    context.subscriptions.push(languages.registerDefinitionProvider("javascript", new XtypeDefinitionProvider()));
}
