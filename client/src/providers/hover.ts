
import {
    CancellationToken, ExtensionContext, Hover, HoverProvider, languages, Position,
    ProviderResult, TextDocument, MarkdownString
} from "vscode";
import * as log from "../common/log";
import { ComponentType } from "../../../common";
import { extjsLangMgr } from "../extension";
import { isPrimitive, isComponent, getMethodByPosition, isPositionInRange, toVscodeRange } from "../common/clientUtils";

class ExtJsHoverProvider implements HoverProvider
{
    provideHover(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Hover>
    {
        const { cmpType, property, cmpClass, thisCmp, thisClass, callee } = extjsLangMgr.getLineProperties(document, position, "   ");

        if (property)
        {
            if (cmpClass)
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
                        let cmp = extjsLangMgr.getComponentInstance(property, position, document.uri.fsPath);
                        if (isComponent(cmp)) // && cmp.markdown)
                        {
                            log.value("provide class instance hover info", property, 1);
                            // return new Hover(cmp.markdown);
                            return new Hover(new MarkdownString().appendCodeblock(`{${cmp.componentClass}} Class`));
                        }
                        else if (thisClass && callee && isPrimitive(cmp))
                        {   //
                            // A primitive may have it's component class set to an instance object, e.g.:
                            //
                            //     const pin = phys.getPinNumber();
                            //
                            // Where phys.getPinNumber() returns a string.
                            //
                            // The primitive 'pin' will have it's component class set to 'phys', possibly in this
                            // case an "instance component". The callee 'getPinNumber' is a method within the class
                            // instance 'phys'.
                            //
                            // Get the component instance ('phys'), and then get the method with the name defined
                            // by 'callee' (getPinNumber)...
                            //
                            log.value("provide primitive instance hover info", property, 1);
                            cmp = extjsLangMgr.getComponentInstance(cmp.componentClass, position, document.uri.fsPath);
                            if (isComponent(cmp))
                            {
                                const method = cmp.methods.find(m => m.name === callee);
                                if (method?.returns) {
                                    return new Hover(new MarkdownString().appendCodeblock(method.returns));
                                }
                            }
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
                    const cmp = extjsLangMgr.getComponent(cmpClass, true);
                    if (cmp && cmp.markdown)
                    {
                        log.value("provide class hover info", property, 1);
                        return new Hover(cmp.markdown);
                    }
                }
            }      //
            // else  // Primitive
            // {    // See if we can deduct the type from the @returns doc of the owner method
            //     //
            //     if (cmpType === ComponentType.Property && thisClass)
            //     {
            //         let cmp = extjsLangMgr.getComponentInstance(property, position, document.uri.fsPath);
            //         if (thisClass && callee && isPrimitive(cmp))
            //         {
            //             log.value("provide primitive instance hover info", property, 1);
            //             cmp = extjsLangMgr.getComponentInstance(cmp.componentClass, position, document.uri.fsPath);
            //             if (isComponent(cmp))
            //             {
            //                 const method = cmp.methods.find(m => m.name === callee);
            //                 if (method?.returns) {
            //                     return new Hover(new MarkdownString().appendCodeblock(method.returns));
            //                 }
            //             }
            //         }
            //     }
            // }
        }

        return undefined;
    }

}


export default function registerHoverProvider(context: ExtensionContext)
{
    context.subscriptions.push(languages.registerHoverProvider("javascript", new ExtJsHoverProvider()));
}
