
import {
    CancellationToken, ExtensionContext, Hover, HoverProvider, languages, Position,
    ProviderResult, TextDocument, MarkdownString, Range
} from "vscode";
import * as log from "../common/log";
import { ComponentType } from "../../../common";
import { extjsLangMgr } from "../extension";
import { isPrimitive, isComponent } from "../common/clientUtils";

class ExtJsHoverProvider implements HoverProvider
{
    provideHover(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Hover>
    {
        log.methodStart("provide hover", 2, "", true, [["file", document.uri.fsPath]]);

        let hover: Hover | undefined;
        const nameSpace = extjsLangMgr.getNamespaceFromFile(document.uri.fsPath, undefined, "   ");
        if (!nameSpace) {
            log.write("   hover disabled due to non extjs file", 2);
            return;
        }

        // const diagnostics = languages.getDiagnostics(document.uri),
        //       range = document.getWordRangeAtPosition(position) || new Range(position, position);
        // log.value("   # of diagnostics", diagnostics.length, 2);
        //
        // for (const diagnostic of diagnostics)
        // {
        //     if (diagnostic.source !== "vscode-extjs" && diagnostic.range.intersection(range))
        //     {
        //         if (diagnostic.relatedInformation?.values.length) {
        //             // for (const rInfo of diagnostic.relatedInformation) {
        //                 log.write("   hover disabled due to existing non-extjs diagnostic quick-fixes", 2);
        //                 return;
        //             // }
        //         }
        //     }
        // }

        const { cmpType, property, cmpClass, thisClass, callee } = extjsLangMgr.getLineProperties(document, position, "   ");

        log.values([
            /* ["# of diagnostics", diagnostics.length], */ ["component class", cmpClass], ["this class", thisClass],
            ["component type", cmpType], ["property", property], ["namespace", nameSpace], ["callee", callee]
        ], 2, "   ");

        if (property && cmpClass && nameSpace)
        {
            if (cmpType === ComponentType.Method)
            {
                const method = extjsLangMgr.getMethod(cmpClass, property, nameSpace, false, "   ");
                if (method && method.markdown) {
                    log.value("   provide class hover info", property, 2);
                    hover = new Hover(method.markdown);
                }
            }
            else if (cmpType === ComponentType.Property)
            {
                const prop = extjsLangMgr.getProperty(cmpClass, property, nameSpace, false, "   ");
                if (prop) {
                    if (prop.markdown) {
                        log.value("   provide property hover info", property, 2);
                        hover = new Hover(prop.markdown);
                    }
                }
                else {
                    let cmp = extjsLangMgr.getComponentInstance(property, nameSpace, position, document.uri.fsPath, "   ");
                    if (isComponent(cmp)) // && cmp.markdown)
                    {
                        log.value("   provide class instance hover info", property, 2);
                        // return new Hover(cmp.markdown);
                        hover = new Hover(new MarkdownString().appendCodeblock(`{${cmp.componentClass}} Class`));
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
                        log.value("provide primitive instance hover info", property, 2);
                        cmp = extjsLangMgr.getComponentInstance(cmp.componentClass, nameSpace, position, document.uri.fsPath, "   ");
                        if (isComponent(cmp))
                        {
                            const method = cmp.methods.find(m => m.name === callee);
                            if (method?.returns) {
                                hover = new Hover(new MarkdownString().appendCodeblock(method.returns));
                            }
                        }
                    }
                }
            }
            else if (cmpType === ComponentType.Config)
            {
                const config = extjsLangMgr.getConfig(cmpClass, property, nameSpace, "   ");
                if (config && config.markdown) {
                    log.value("   provide class hover info", property, 2);
                    hover = new Hover(config.markdown);
                }
            }
            else if (cmpType === ComponentType.Class)
            {
                const cmp = extjsLangMgr.getComponent(cmpClass, nameSpace, true, "   ");
                if (cmp && cmp.markdown)
                {
                    log.value("   provide class hover info", property, 2);
                    hover = new Hover(cmp.markdown);
                }
            }
        }

        log.methodDone("provide hover", 2, "", true);
        return hover;
    }

}


export default function registerHoverProvider(context: ExtensionContext)
{
    context.subscriptions.push(languages.registerHoverProvider("javascript", new ExtJsHoverProvider()));
}
