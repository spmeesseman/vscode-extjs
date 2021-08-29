
import {
    CancellationToken, ExtensionContext, Hover, HoverProvider, languages, Position,
    TextDocument, MarkdownString, commands
} from "vscode";
import * as log from "../common/log";
import { ComponentType, DeclarationType, IComponent, IConfig, IJsDoc, utils } from "../../../common";
import { extjsLangMgr } from "../extension";
import { isPrimitive, isComponent, getMethodByPosition, toIPosition, shouldIgnoreType } from "../common/clientUtils";


class ExtJsHoverProvider implements HoverProvider
{
    async provideHover(document: TextDocument, position: Position, token: CancellationToken)
    {
        let hover: Hover | undefined;
        const hoverText = document.getText(document.getWordRangeAtPosition(position)),
              hoverLineText = document.lineAt(position).text;

        if (/type *\:/.test(hoverLineText) && await shouldIgnoreType(hoverText)) {
            return;
        }
        if (!utils.isExtJsFile(document.getText())) {
            return;
        }

        log.methodStart("provide hover", 1, "", true, [["file", document.uri.fsPath]]);

        //
        // It's possible the indexer initiated a re-indexing since editing the document is
        // what triggers thecompletion item request, so wait for it to finish b4 proceeding
        //
        await commands.executeCommand("vscode-extjs:waitReady", "   ", 3);
        //
        // Indexer finished, proceed...
        //

        const { cmpType, property, cmpClass, thisClass, thisCmp, callee, text, lineText, project } = extjsLangMgr.getLineProperties(document, position, "   ", 2);

        log.values([
            ["component class", cmpClass], ["this class", thisClass], ["callee", callee],
            ["component type", cmpType], ["property", property], ["project", project]
        ], 2, "   ");

        if (property && cmpClass && thisCmp && cmpType !== ComponentType.None)
        {
            if (cmpType === ComponentType.Method)
            {
                const method = extjsLangMgr.getMethod(cmpClass, property, project, false, "   ", 2);
                log.value("   provide class hover info", property, 2);
                if (method) { // it could happen, if this fires immediately following en edit
                    let returns = "";
                    if (method.returns) {
                        const returnsText = method.returns?.replace(/\{/g, "").replace(/\} ?/g, " - ").toLowerCase();
                        returns = method.returns ? `: returns ${returnsText}` : "";
                    }
                    hover = this.getHover(`function ${text}${returns}`, method.doc);
                }
            }
            else if (cmpType === ComponentType.Property)
            {
                const prop = extjsLangMgr.getProperty(cmpClass, property, project, false, "   ", 2);
                if (prop) {
                    log.value("   provide property hover info", property, 2);
                    hover = this.getHover(`property ${text}: ${prop.componentClass}`, prop.doc);
                }
                else {
                    let cmp = extjsLangMgr.getComponentInstance(property, project, position, document.uri.fsPath, "   ", 2);
                    if (isComponent(cmp)) // && cmp.markdown)
                    {
                        log.value("   provide class instance hover info", property, 2);
                        let varType = "instance";
                        const thisMethod = getMethodByPosition(position, thisCmp),
                            thisVar = thisMethod?.variables.find((v) => v.name === property);
                        if (thisVar) {
                            varType = DeclarationType[thisVar.declaration];
                        }
                        hover = this.getHover(`${varType} ${text}: ${cmp.componentClass}`, cmp.doc);
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
                                const thisMethod = getMethodByPosition(position, thisCmp),
                                        thisVar = thisMethod?.variables.find((v) => v.name === property);
                                if (thisVar) {
                                    varType = DeclarationType[thisVar.declaration] + " ";
                                }
                                const hoverDoc = `${varType}${text}: ${method.returns.replace(/\{/g, "").replace(/\} ?/g, " - ").toLowerCase()}`;
                                hover = this.getHover(hoverDoc, method.doc);
                            }
                        }
                    }
                }
            }
            else if (cmpType === ComponentType.Config)
            {
                const config = extjsLangMgr.getConfig(cmpClass, property, project, "   ", 2) as IConfig;
                log.value("   provide class hover info", property, 2);
                hover = this.getHover(`config ${text}: ${config.componentClass}`, config.doc);
            }
            else // if (cmpType & ComponentType.Class)
            {
                const cmp = extjsLangMgr.getComponent(cmpClass, project, "   ", 2, toIPosition(position), thisCmp) as IComponent;
                log.value("   provide class hover info", property, 2);
                let typeName = "class";
                if (cmp.singleton) {
                    typeName = "singleton";
                }
                else if (!lineText.includes("xtype:") && (lineText.includes("store:") || extjsLangMgr.getStoreTypeNames(project).find((x) => x.replace("store.", "") === text))) {
                    typeName = "store";
                }
                else if (!lineText.includes("xtype:") && (lineText.includes("model:") || extjsLangMgr.getModelTypeNames(project).find((m) => m.replace("model.", "") === text))) {
                    typeName = "model";
                }
                // else if (lineText.includes("xtype:") && extjsLangMgr.getXtypeNames().find((x) => x === text)) {
                //     typeName = "xtype";
                // }
                // else if (!lineText.includes("xtype:") && lineText.includes("type:") && extjsLangMgr.getXtypeNames().find((x) => x === text)) {
                //     typeName = "type";
                // }
                let clsShortName = text;
                if (lineText.includes(`.${text}`) || lineText.includes(`${text}.`)) {
                    clsShortName = cmp.componentClass.substring(cmp.componentClass.lastIndexOf(".") + 1);
                }
                hover = this.getHover(`${typeName} ${clsShortName}: ${cmp.componentClass}`, cmp.doc);
            }
        }

        log.methodDone("provide hover", 1, "", true);
        return hover;
    }


    private getHover(title: any, jsdoc: IJsDoc | undefined)
    {
        if (jsdoc && jsdoc.body)
        {
            return new Hover(new MarkdownString().appendCodeblock(title || jsdoc.title).appendMarkdown(jsdoc.body));
        }
        else {
            return new Hover(new MarkdownString().appendCodeblock(title));
        }
    }

}


export default function registerHoverProvider(context: ExtensionContext)
{
    context.subscriptions.push(languages.registerHoverProvider("javascript", new ExtJsHoverProvider()));
}
