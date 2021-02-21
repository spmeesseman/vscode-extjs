
import { IMethod, IConfig, utils } from "../../../common";
import * as log from "../common/log";

import {
    CancellationToken, ExtensionContext, Hover, HoverProvider, languages, Position,
    ProviderResult, Range, TextDocument
} from "vscode";

import {
    ComponentType, getComponent, getComponentClass, getConfig, getMethod,
    getProperty, getComponentByAlias, getClassFromPath, getClassFromFile
} from "../languageManager";


class DocHoverProvider implements HoverProvider
{
    provideHover(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Hover>
    {
        const range = document.getWordRangeAtPosition(position);
        if (range === undefined) {
            return;
        }
        const line = position.line,
              nextLine = document.lineAt(line + 1),
              property = document.getText(range),
              lineText = document.getText(new Range(new Position(line, 0), nextLine.range.start));

        //
        // Methods
        //
        if (lineText.match(new RegExp(`${property}\\s*\\([ \\W\\w\\{]*\\)\\s*;\\s*$`)))
        {
            const cmpClass = getComponentClass(property, ComponentType.Method, lineText);
            if (cmpClass)
            {
                log.logValue("provide function hover info", property, 1);
                let method: IMethod | IConfig | undefined = getMethod(cmpClass, property);
                if (!method)
                {   //
                    // A config property:
                    //
                    //     user: null
                    //
                    // Will have the folloiwng getter/setter created by the framework if not defined
                    // on the object:
                    //
                    //     getUser()
                    //     setUser(value)
                    //
                    // Check for these config methods, see if they exist for this property
                    //
                    if (utils.isGetterSetter(property))
                    {   //
                        // Extract the property name from the getter/setter.  Note the actual config
                        // property will be a lower-case-first-leter version of the extracted property
                        //
                        const gsProperty = utils.lowerCaseFirstChar(property.substring(3));
                        method = getConfig(cmpClass, gsProperty);
                        if (!method) {
                            method = getConfig(cmpClass, property);
                        }
                    }
                }
                if (method && method.markdown) {
                    return new Hover(method.markdown);
                }
            }
        }

        //
        // Properties / configs
        //
        else if (lineText.match(new RegExp(`.${property}\\s*[;\\)]+\\s*$`)))
        {
            const cmpClass = getComponentClass(property, ComponentType.Config | ComponentType.Property, lineText);
            if (cmpClass)
            {
                const config = getConfig(cmpClass, property);
                if (config && config.markdown)
                {
                    log.logValue("provide config hover info", property, 1);
                    return new Hover(config.markdown);
                }
                else {
                    const prop = getProperty(cmpClass, property);
                    if (prop && prop.markdown) {
                        log.logValue("provide property hover info", property, 1);
                        return new Hover(prop.markdown);
                    }
                }
            }
        }

        //
        // Classes
        //
        else if (lineText.match(new RegExp(`(.|^\\s*)${property}.[\\W\\w]*$`)))
        {
            const pIdx = lineText.indexOf(property),
                  lineCls = lineText?.substring(0, pIdx + property.length).trim()
                                     .replace(/[\s\w]+=[\s]*(new)*\s*/, "");
            let cmp = getComponent(lineCls) || getComponentByAlias(lineCls);

            if (cmp && cmp.markdown)
            {
                log.logValue("provide class hover info", property, 1);
                return new Hover(cmp.markdown);
            }

            //
            // Check instance properties
            //

            const thisCls = getClassFromFile(document.uri.fsPath);
            if (!thisCls) {
                return;
            }

            cmp = getComponent(thisCls) || getComponentByAlias(thisCls);
            if (!cmp) {
                return;
            }

            for (const variable of cmp.privates)
            {

            }

            for (const variable of cmp.statics)
            {

            }

            for (const method of cmp.methods)
            {
                if (method.variables)
                {
                    for (const variable of method.variables)
                    {
                        if (variable.name === property)
                        {
                            const instanceCmp = getComponent(variable.componentClass) || getComponentByAlias(variable.componentClass);
                            if (instanceCmp && instanceCmp.markdown)
                            {
                                log.logValue("provide instance class hover info", property, 1);
                                return new Hover(instanceCmp.markdown);
                            }
                        }
                    }
                }
            }
        }

        //
        // Local instance classes
        //
        else
        {
            const fsPath = document.uri.fsPath,
                  thisCls = getClassFromPath(fsPath),
                  pIdx = lineText.indexOf(property),
                  lineCls = lineText?.substring(0, pIdx + property.length).trim()
                                     .replace(/[\s\w]+=[\s]*(new)*\s*/, ""),
                  cmp = getComponent(thisCls) || getComponentByAlias(thisCls);

        }

        return undefined;
    }

}


export default function registerPropertyHoverProvider(context: ExtensionContext)
{
    context.subscriptions.push(languages.registerHoverProvider("javascript", new DocHoverProvider()));
}
