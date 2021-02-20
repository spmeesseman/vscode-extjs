
import {
    CancellationToken, DefinitionProvider, ExtensionContext, languages, Location,
    LocationLink, Position, ProviderResult, Range, TextDocument, Uri,
} from "vscode";
import {
    getComponentClass, getFilePath, ComponentType, getConfig, getProperty, getMethod
} from "../languageManager";
import * as util from "../common/utils";


class PropertyDefinitionProvider implements DefinitionProvider
{
    provideDefinition(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Location | Location[] | LocationLink[]>
    {
        let cmpType: ComponentType = ComponentType.None;
        const range = document.getWordRangeAtPosition(position);
        if (range === undefined) {
            return;
        }

        const line = position.line,
              nextLine = document.lineAt(line + 1),
              lineText = document.getText(new Range(new Position(line, 0), nextLine.range.start));
        let property = document.getText(range);

        if (lineText.match(new RegExp(`${property}\\([\\W\\w]*\\)\\s*;\\s*$`)))
        {
            cmpType = ComponentType.Method;
        }
        else if (lineText.match(new RegExp(`.${property}\\s*[;\\)]+\\s*$`)))
        {
            cmpType = ComponentType.Property;
        }

        if (cmpType !== ComponentType.None)
        {
            util.log("provide definition", 1);
            util.logValue("   property", property, 2);
            util.logValue("   component type", cmpType, 2);

            let cmpClass = getComponentClass(property, cmpType);
            if (!cmpClass)
            {   //
                // If this is a method, check for getter/setter for a config property...
                //
                if (cmpType === ComponentType.Method && property.startsWith("get") || property.startsWith("set"))
                {
                    util.log("   method not found, look for getter/setter config", 2);
                    property = util.lowerCaseFirstChar(property.substring(3));
                    cmpType = ComponentType.Config;
                    util.logValue("      config name", property, 2);
                    cmpClass = getComponentClass(property, cmpType, lineText);
                }
                //
                // If this is a property, check for a config property...
                //
                else if (cmpType === ComponentType.Property)
                {
                    util.log("   property not found, look for config", 2);
                    cmpType = ComponentType.Config;
                    cmpClass = getComponentClass(property, cmpType, lineText);
                }
            }
            if (cmpClass)
            {
                util.logValue("   component class", cmpClass, 2);
                const fsPath = getFilePath(cmpClass);
                if (fsPath)
                {
                    let start = new Position(0, 0),
                        end = new Position(0, 0);
                    const pObject = cmpType === ComponentType.Method ? getMethod(cmpClass, property) :
                                                    (cmpType === ComponentType.Config ? getConfig(cmpClass, property) :
                                                                                       getProperty(cmpClass, property));
                    if (pObject)
                    {
                        util.log("   setting position", 2);
                        util.logValue("      start line", pObject.start?.line, 3);
                        util.logValue("      end line", pObject.end?.line, 3);
                        start = new Position(pObject.start?.line, pObject.start?.column);
                        end = new Position(pObject.end?.line, pObject.end?.column);
                    }
                    const uriPath = Uri.parse(fsPath).path.replace(/\\/g, "/"), // win32 compat
                          uri = Uri.parse(`file://${uriPath}`),
                          range = new Range(start, end);
                    util.logValue("   fsPath", uri.fsPath, 2);
                    util.log("   open definition file", 1);
                    util.log("provide definition complete", 1);
                    return {
                        uri,
                        range
                    };
                }
                else {
                    util.log("   fs path not found", 1);
                }
            }

            util.log("provide definition complete", 1);
        }
    }
}


export default function registerPropertyDefinitionProvider(context: ExtensionContext)
{
    context.subscriptions.push(languages.registerDefinitionProvider("javascript", new PropertyDefinitionProvider()));
}
