
import {
    CancellationToken, DefinitionProvider, ExtensionContext, languages, Location,
    LocationLink, Position, ProviderResult, Range, TextDocument, Uri
} from "vscode";
import { extjsLangMgr } from "../extension";
import * as log from "../common/log";


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
            const componentClass = extjsLangMgr.getComponentClass(xtype);
            if (componentClass)
            {
                const fsPath = extjsLangMgr.getFilePath(componentClass);
                if (fsPath)
                {
                    let start = new Position(0, 0),
                        end = new Position(0, 0);
                    const pObject = extjsLangMgr.getXType(componentClass, xtype),
                          pObject2 = extjsLangMgr.getAlias(componentClass, xtype);
                    if (pObject) {
                        start = new Position(pObject.start?.line, pObject.start?.column);
                        end = new Position(pObject.end?.line, pObject.end?.column);
                    }
                    if (pObject2 && start.line === 0 && start.character === 0) {
                        start = new Position(pObject2.start?.line, pObject2.start?.column);
                        end = new Position(pObject2.end?.line, pObject2.end?.column);
                    }
                    const uri = Uri.file(fsPath),
                          range = new Range(start, end);
                    log.write("open definition file", 1);
                    log.value("   component class", componentClass, 2);
                    log.value("   fsPath", uri.fsPath, 2);
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
