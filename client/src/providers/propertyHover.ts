
import {
    CancellationToken, ExtensionContext, Hover, HoverProvider, languages, Position,
    ProviderResult, Range, TextDocument
} from "vscode";
import { IMethod, IConfig, utils, ComponentType } from "../../../common";
import * as log from "../common/log";
import { extjsLangMgr } from "../extension";

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
            const cmpClass = extjsLangMgr.getComponentClass(property, position, ComponentType.Method, lineText);
            if (cmpClass)
            {
                log.value("provide function hover info", property, 1);
                let method: IMethod | IConfig | undefined = extjsLangMgr.getMethod(cmpClass, property);
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
                        method = extjsLangMgr.getConfig(cmpClass, gsProperty);
                        if (!method) {
                            method = extjsLangMgr.getConfig(cmpClass, property);
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
            const cmpClass = extjsLangMgr.getComponentClass(property, position, ComponentType.Config | ComponentType.Property, lineText);
            if (cmpClass)
            {
                const config = extjsLangMgr.getConfig(cmpClass, property);
                if (config && config.markdown)
                {
                    log.value("provide config hover info", property, 1);
                    return new Hover(config.markdown);
                }
                else {
                    const prop = extjsLangMgr.getProperty(cmpClass, property);
                    if (prop && prop.markdown) {
                        log.value("provide property hover info", property, 1);
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
            let cmp = extjsLangMgr.getComponent(lineCls) || extjsLangMgr.getComponentByAlias(lineCls);

            if (cmp && cmp.markdown)
            {
                log.value("provide class hover info", property, 1);
                return new Hover(cmp.markdown);
            }

            cmp = extjsLangMgr.getComponentInstance(property, position, document.uri.fsPath);
            if (cmp && cmp.markdown)
            {
                log.value("provide class instance hover info", property, 1);
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
