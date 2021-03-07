
import {
    CancellationToken, ExtensionContext, Hover, HoverProvider, languages, Position,
    ProviderResult, TextDocument
} from "vscode";
import * as log from "../common/log";
import { ComponentType } from "../../../common";
import { extjsLangMgr } from "../extension";

class ExtJsHoverProvider implements HoverProvider
{
    provideHover(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Hover>
    {
        const { cmpType, property, cmpClass } = extjsLangMgr.getLineProperties(document, position, "   ");

        if (property && cmpClass)
        {
            if (cmpType === ComponentType.Method)
            {
                const method = extjsLangMgr.getMethod(cmpClass, property);
                if (method && method.markdown) {
                    log.value("provide class hover info", property, 1);
                    return new Hover(method.markdown);
                }
            }
            else if (cmpType === ComponentType.Property)
            {
                const prop = extjsLangMgr.getProperty(cmpClass, property);
                if (prop) {
                    if (prop.markdown) {
                        log.value("provide property hover info", property, 1);
                        return new Hover(prop.markdown);
                    }
                }
                else {
                    const cmp = extjsLangMgr.getComponentInstance(property, position, document.uri.fsPath);
                    if (cmp && cmp.markdown)
                    {
                        log.value("provide class instance hover info", property, 1);
                        return new Hover(cmp.markdown);
                    }
                }
            }
            else if (cmpType === ComponentType.Config)
            {
                const config = extjsLangMgr.getConfig(cmpClass, property);
                if (config && config.markdown) {
                    log.value("provide class hover info", property, 1);
                    return new Hover(config.markdown);
                }
            }
            else if (cmpType === ComponentType.Class)
            {
                const cmp = extjsLangMgr.getComponent(cmpClass, position, true);
                if (cmp && cmp.markdown)
                {
                    log.value("provide class hover info", property, 1);
                    return new Hover(cmp.markdown);
                }
            }
        }

        return undefined;
    }

}


export default function registerHoverProvider(context: ExtensionContext)
{
    context.subscriptions.push(languages.registerHoverProvider("javascript", new ExtJsHoverProvider()));
}
