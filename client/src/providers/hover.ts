
import {
    CancellationToken, ExtensionContext, Hover, HoverProvider, languages, Position,
    ProviderResult, TextDocument, MarkdownString, Range, commands
} from "vscode";
import * as log from "../common/log";
import { ComponentType, DeclarationType, utils, VariableType } from "../../../common";
import { extjsLangMgr } from "../extension";
import { isPrimitive, isComponent, getMethodByPosition, getWorkspaceProjectName, toVscodePosition, toIPosition } from "../common/clientUtils";

class ExtJsHoverProvider implements HoverProvider
{
    async provideHover(document: TextDocument, position: Position, token: CancellationToken)
    {
        log.methodStart("provide hover", 1, "", true, [["file", document.uri.fsPath]]);

        //
        // It's possible the indexer initiated a re-indexing since editing the document is
        // what triggers thecompletion item request, so wait for it to finish b4 proceeding
        //
        await commands.executeCommand("vscode-extjs:waitReady", "   ", 3);
        //
        // Indexer finished, proceed...
        //

        let hover: Hover | undefined;
        if (!utils.isExtJsFile(document.getText())) {
            log.write("   hover disabled due to non extjs file", 2);
            return;
        }

        const { cmpType, property, cmpClass, thisClass, thisCmp, callee, text, lineText, project } = extjsLangMgr.getLineProperties(document, position, "   ");

        log.values([
            ["component class", cmpClass], ["this class", thisClass], ["callee", callee],
            ["component type", cmpType], ["property", property], ["project", project]
        ], 2, "   ");

        if (property && cmpClass)
        {
            if (cmpType === ComponentType.Method)
            {
                const method = extjsLangMgr.getMethod(cmpClass, property, project, false, "   ", 2);
                if (method) {
                    log.value("   provide class hover info", property, 2);
                    const returnsText = method.returns?.replace(/\{/g, "").replace(/\} ?/g, " - ").toLowerCase(),
                          returns = method.returns ? `: returns ${returnsText}` : "";
                    hover = new Hover(new MarkdownString().appendCodeblock(`function ${text}${returns}`).appendMarkdown(method.markdown ? method.markdown.value : ""));
                }
            }
            else if (cmpType === ComponentType.Property)
            {
                const prop = extjsLangMgr.getProperty(cmpClass, property, project, false, "   ", 2);
                if (prop) {
                    log.value("   provide property hover info", property, 2);
                    hover = new Hover(new MarkdownString().appendCodeblock(`property ${text}: ${prop.componentClass}`).appendMarkdown(prop.markdown ? prop.markdown.value : ""));
                }
                else {
                    let cmp = extjsLangMgr.getComponentInstance(property, project, position, document.uri.fsPath, "   ");
                    if (isComponent(cmp)) // && cmp.markdown)
                    {
                        log.value("   provide class instance hover info", property, 2);
                        let varType = "instance";
                        if (thisCmp) {
                            const thisMethod = getMethodByPosition(position, thisCmp),
                                thisVar = thisMethod?.variables.find((v) => v.name === property);
                            if (thisVar) {
                                varType = DeclarationType[thisVar.declaration];
                            }
                        }
                        hover = new Hover(new MarkdownString().appendCodeblock(`${varType} ${text}: ${cmp.componentClass}`).appendMarkdown(cmp.markdown ? cmp.markdown.value : ""));
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
                        cmp = extjsLangMgr.getComponentInstance(cmp.componentClass, project, position, document.uri.fsPath, "   ", 2);
                        if (isComponent(cmp))
                        {
                            let varType = "any ";
                            const method = cmp.methods.find(m => m.name === callee);
                            if (method?.returns) { // the type of the current property is the @return type of the fn
                                if (thisCmp) {
                                    const thisMethod = getMethodByPosition(position, thisCmp),
                                          thisVar = thisMethod?.variables.find((v) => v.name === property);
                                    if (thisVar) {
                                        varType = DeclarationType[thisVar.declaration] + " ";
                                    }
                                }
                                const hoverDoc = `${varType}${text}: ${method.returns.replace(/\{/g, "").replace(/\} ?/g, " - ").toLowerCase()}`;
                                hover = new Hover(new MarkdownString().appendCodeblock(hoverDoc).appendMarkdown(cmp.markdown ? cmp.markdown.value : ""));
                            }
                        }
                    }
                }
            }
            else if (cmpType === ComponentType.Config)
            {
                const config = extjsLangMgr.getConfig(cmpClass, property, project, "   ", 2);
                if (config) {
                    log.value("   provide class hover info", property, 2);
                    hover = new Hover(new MarkdownString().appendCodeblock(`config ${text}: ${config.componentClass}`).appendMarkdown(config.markdown ? config.markdown.value : ""));
                }
            }
            else if (cmpType & ComponentType.Class)
            {
                const cmp = extjsLangMgr.getComponent(cmpClass, project, "   ", 2, toIPosition(position), thisCmp);
                if (isComponent(cmp))
                {
                    log.value("   provide class hover info", property, 2);
                    let typeName = "class";
                    if (!lineText.includes("type:") && extjsLangMgr.getXtypeNames().find((x) => x === text)) {
                        typeName = "xtype";
                    }
                    else if (cmp.singleton) {
                        typeName = "singleton";
                    }
                    else if (!lineText.includes("xtype:") && extjsLangMgr.getStoreTypeNames().find((x) => x.replace("store.", "") === text)) {
                        typeName = "store";
                    }
                    else if (!lineText.includes("xtype:") && extjsLangMgr.getModelTypeNames().find((m) => m.replace("model.", "") === text)) {
                        typeName = "model";
                    }
                    hover = new Hover(new MarkdownString().appendCodeblock(`${typeName} ${text}: ${cmp.componentClass}`).appendMarkdown(cmp.markdown ? cmp.markdown.value : ""));
                }
            }
        }

        log.methodDone("provide hover", 1, "", true);
        return hover;
    }

}


export default function registerHoverProvider(context: ExtensionContext)
{
    context.subscriptions.push(languages.registerHoverProvider("javascript", new ExtJsHoverProvider()));
}
