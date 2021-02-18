
import { IMethod, IConfig } from "../common/interface";
import * as util from "../common/utils";

import {
    CancellationToken, ExtensionContext, Hover, HoverProvider, languages, Position,
    ProviderResult, Range, TextDocument, MarkdownString
} from "vscode";

import {
    ComponentType, getComponent, getComponentClass, getConfig, getMethod,
    getProperty, getComponentByAlias
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
        if (lineText.match(new RegExp(`${property}\\([\\W\\w]*\\)\\s*;\\s*$`)))
        {
            const cmpClass = getComponentClass(property, ComponentType.Method, lineText);
            if (cmpClass)
            {
                util.logValue("Provide function hover info", property, 1);
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
                    if (util.isGetterSetter(property))
                    {   //
                        // Extract the property name from the getter/setter.  Note the actual config
                        // property will be a lower-case-first-leter version of the extracted property
                        //
                        const gsProperty = util.lowerCaseFirstChar(property.substring(3));
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
            if (cmpClass) {
                const config = getConfig(cmpClass, property);
                if (config && config.markdown) {
                    util.logValue("Provide config hover info", property, 1);
                    return new Hover(config.markdown);
                }
                else {
                    const prop = getProperty(cmpClass, property);
                    if (prop && prop.markdown) {
                        util.logValue("Provide property hover info", property, 1);
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
            const lineCls = lineText?.substring(0, lineText.indexOf(property) + property.length).trim();
            const cmp = getComponent(lineCls) || getComponentByAlias(lineCls);
            if (cmp && cmp.markdown) {
                util.logValue("Provide class hover info", property, 1);
                return new Hover(cmp.markdown);
            }
        }

        return undefined;
    }

}


export default function registerPropertyHoverProvider(context: ExtensionContext)
{
    context.subscriptions.push(languages.registerHoverProvider("javascript", new DocHoverProvider()));
}
