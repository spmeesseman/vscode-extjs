
import {
    ExtensionContext, languages, Position, CancellationToken, ProviderResult, ParameterInformation,
    TextDocument, SignatureHelpProvider, SignatureHelp, SignatureHelpContext, SignatureInformation
} from "vscode";
import { extjsLangMgr } from "../extension";
import { isComponent } from "../common/clientUtils";
import * as log from "../common/log";
import { IComponent, IMethod, utils } from "../../../common";


class MethodSignatureProvider implements SignatureHelpProvider
{
	provideSignatureHelp(document: TextDocument, position: Position, token: CancellationToken, context: SignatureHelpContext): ProviderResult<SignatureHelp>
	{
        const sigHelp = new SignatureHelp();
        let lineText = document.lineAt(position).text.substr(0, position.character),
            pLoc = lineText.lastIndexOf("(");

        if (pLoc !== -1)
        {
            pLoc = lineText.lastIndexOf("(", pLoc - 1);
            if (pLoc !== -1)
            {
                lineText = lineText.substring(pLoc + 1);
            }
        }

        //
        // Check for "(" since VSCode 24/7 Intellisense will trigger every character no matter what
        // the trigger char(s) is for this provider.  24/7 Intellisense can be turned off in settings.json:
        //
        //    "editor.quickSuggestions": false
        //
        if (lineText && lineText.includes("(") && !lineText.endsWith(")"))
        {
            log.methodStart("provide method signature", 2, "", true, [["line text", lineText]]);
            //
            // Create signature information
            //
            const sigInfo = this.getSignatureInfo(lineText, position, document.uri.fsPath);
            if (sigInfo)
            {
                sigHelp.signatures = [sigInfo];
                //
                // Set the current parameter index
                //
                let commaIdx = lineText.indexOf(",");
                sigHelp.activeParameter = 0;
                while (commaIdx !== -1) {
                    ++sigHelp.activeParameter;
                    commaIdx = lineText.indexOf(",", commaIdx + 1);
                }
            }
            log.methodDone("provide method signature", 2, "", true);
        }

        return sigHelp;
    }


    getSignatureInfo(lineText: string, position: Position, fsPath: string): SignatureInformation | undefined
    {
		let signature = "";
        const params: ParameterInformation[] = [],
			  matches = lineText.match(/([\w]+\.)/g),
              methodName = lineText.substring(lineText.lastIndexOf(".") + 1, lineText.indexOf("("));

		//
		// Create signature parameter information
		//
        if (matches)
        {
            let ns = extjsLangMgr.getNamespaceFromFile(fsPath);
            let cls = "";
            const _add = (method: IMethod) =>
            {
                if (method.name === methodName && method.params)
                {
                    for (const p of method.params)
                    {
                        params.push(new ParameterInformation(p.name, p.markdown || p.doc));
                    }
                    return true;
                }
            };

            for (const m of matches)
            {
                cls += m;
            }
            cls = cls.substring(0, cls.length - 1); // remove trailing .
            if (!ns) {
                ns = cls;
            }
            const cmp = extjsLangMgr.getComponent(cls, ns, true) || extjsLangMgr.getComponentInstance(cls, ns, position, fsPath);

            if (isComponent(cmp))
            {
                for (const m of cmp.methods)
                {
                    if (_add(m) === true) break;
                }
                if (params.length === 0) // check statics
                {
                    for (const s of cmp.statics)
                    {
                        if (utils.isMethod(s))
                        {
                            if (_add(s) === true) break;
                        }
                    }
                }
            }
        }

		let sigInfo: SignatureInformation | undefined;
        if (params.length > 0)
        {   //
            // Build method signature string in the form:
            //
            //     param1, param2, param3, ...
            //
            params.forEach((p) => {
                if (signature) {
                    signature += ", ";
                }
                signature += p.label;
            });
            sigInfo = new SignatureInformation(signature);
		    sigInfo.parameters = params;
        }

        return sigInfo;
    }
}


function registerMethodSignatureProvider(context: ExtensionContext)
{
    context.subscriptions.push(
        languages.registerSignatureHelpProvider("javascript", new MethodSignatureProvider())
    );
}


export default registerMethodSignatureProvider;
