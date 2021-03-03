
import {
    CancellationToken, DefinitionProvider, ExtensionContext, languages, Location,
    LocationLink, Position, ProviderResult, Range, TextDocument, Uri,
} from "vscode";
import { extjsLangMgr } from "../extension";
import * as log from "../common/log";
import { utils, ComponentType } from "../../../common";


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
              nextLine = document.lineAt(line + 1);
        let lineText = document.getText(new Range(new Position(line, 0), nextLine.range.start))
                               .trim().replace(/[\s\w]+=[\s]*(new)*\s*/, ""),
            property = document.getText(range);

        if (property === "this")
        {
            // TODO - this definition
        }

        //
        // Class string literals
        // Match string literal class, e.g.:
        //
        //     Ext.create("Ext.data.Connection", {
        //     Ext.create("Ext.panel.Panel", {
        //     requires: [ "MyApp.common.Utilities" ]
        //
        if (lineText.match(new RegExp(`["']{1}[\\w.]*.${property}[\\w.]*["']{1}`)) ||
            lineText.match(new RegExp(`["']{1}[\\w.]*${property}.[\\w.]*["']{1}`)))
        {
            cmpType = ComponentType.Class;
            //
            // Strip off everything outside the quotes to get our full class name, i.e.
            //
            //     MyApp.common.Utilities
            //
            lineText = lineText.replace(/^[^"']*["']{1}/, "").replace(/["']{1}[\w\W]*$/, "");
            //
            // Set the property to the last piece of the class name.  We want the effect that clicking
            // anywhere within the string references th  entore component class, not just the "part" that
            // gets looked at when doing a goto def for a non-quoted class variable/path
            //
            const strParts = lineText.split(".");
            property = strParts[strParts.length - 1];
        }
        //
        // Methods
        // Match function/method signature type, e.g.
        //
        //     testFn();
        //
        else if (lineText.match(new RegExp(`${property}\\s*\\([ \\W\\w\\{]*\\)\\s*;\\s*$`)))
        {
            cmpType = ComponentType.Method;
        }
        //
        // Properties / configs
        //
        else if (lineText.match(new RegExp(`.${property}\\s*[;\\)]+\\s*$`)))
        {
            cmpType = ComponentType.Property;
        }
        //
        // Classes (non string literal)
        //
        else if (lineText.match(new RegExp(`(.|^\\s*)${property}.[\\W\\w]*$`)))
        {
            cmpType = ComponentType.Class;
        }

        if (cmpType !== ComponentType.None)
        {
            let cmpClass: string | undefined;

            log.write("provide definition", 1);
            log.value("   property", property, 2);
            log.value("   component type", cmpType, 2);

            if (cmpType === ComponentType.Class)
            {
                cmpClass = lineText.substring(0, lineText.indexOf(property) + property.length);
            }
            else
            {
                cmpClass = extjsLangMgr.getComponentClass(property, cmpType, lineText);
                if (!cmpClass)
                {   //
                    // If this is a method, check for getter/setter for a config property...
                    //
                    if (cmpType === ComponentType.Method && (property.startsWith("get") || property.startsWith("set")))
                    {
                        log.write("   method not found, look for getter/setter config", 2);
                        property = utils.lowerCaseFirstChar(property.substring(3));
                        cmpType = ComponentType.Config;
                        log.value("      config name", property, 2);
                        cmpClass = extjsLangMgr.getComponentClass(property, cmpType, lineText);
                    }
                    //
                    // If this is a property, check for a config property...
                    //
                    else if (cmpType === ComponentType.Property)
                    {
                        log.write("   property not found, look for config", 2);
                        cmpType = ComponentType.Config;
                        cmpClass = extjsLangMgr.getComponentClass(property, cmpType, lineText);
                    }
                }
            }

            if (cmpClass)
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
                        property = utils.lowerCaseFirstChar(property.substring(3));
                        cmpType = ComponentType.Config;
                        pObject = extjsLangMgr.getConfig(cmpClass, property);
                        log.value("      config name", property, 2);
                    }
                    if (pObject)
                    {
                        log.write("   setting position", 2);
                        log.value("      start line", pObject.start?.line, 3);
                        log.value("      end line", pObject.end?.line, 3);
                        start = new Position(pObject.start?.line, pObject.start?.column);
                        end = new Position(pObject.end?.line, pObject.end?.column);
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

            log.write("provide definition complete", 1);
        }
    }
}


export default function registerPropertyDefinitionProvider(context: ExtensionContext)
{
    context.subscriptions.push(languages.registerDefinitionProvider("javascript", new PropertyDefinitionProvider()));
}
