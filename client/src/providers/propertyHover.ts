
import {
    CancellationToken, ExtensionContext, Hover, HoverProvider, languages, Position,
    ProviderResult, Range, TextDocument, MarkdownString
} from "vscode";
import { ComponentType, getComponentClass, getConfig, getMethod, getProperty } from "../languageManager";
import * as util from "../common/utils";


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
            if (cmpClass) {
                util.logValue("Provide function hover info", property, 1);
                if (property.startsWith("get") || property.startsWith("set") && property[3] >= "A" && property[3] <= "Z")
                {
                    const gsProperty = util.lowerCaseFirstChar(property.substring(3));
                    let config = getConfig(cmpClass, gsProperty);
                    if (!config) {
                        config = getConfig(cmpClass, property);
                    }
                    if (config && config.markdown) {
                        return new Hover(config.markdown);
                    }
                }
                else
                {
                    const method = getMethod(cmpClass, property);
                    if (method && method.markdown) {
                        return new Hover(method.markdown);
                    }
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

        return undefined;
    }

}


export default function registerPropertyHoverProvider(context: ExtensionContext)
{
    context.subscriptions.push(languages.registerHoverProvider("javascript", new DocHoverProvider()));
}
