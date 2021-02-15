
import {
    CancellationToken, ExtensionContext, Hover, HoverProvider, languages, Position,
    ProviderResult, Range, TextDocument, MarkdownString
} from "vscode";
import { getExtjsComponentByConfig, getExtjsConfigByComponent, getExtjsConfigByMethod } from "../common/ExtjsLanguageManager";
import * as util from "../common/Utils";

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
            const cmpClass = getCmpClass(property, lineText);
            if (cmpClass) {
                util.logValue("Provide function hover info", property, 1);
                if (property.startsWith("get") || property.startsWith("set") && property[3] >= "A" && property[3] <= "Z")
                {
                    const gsProperty = property.substring(3).replace(/(?:^\w|[A-Za-z]|\b\w)/g, (letter, index) => {
                        return index !== 0 ? letter : letter.toLowerCase();
                    });
                    let config = getExtjsConfigByComponent(cmpClass, gsProperty);
                    if (!config) {
                        config = getExtjsConfigByComponent(cmpClass, property);
                    }
                    if (config && config.doc) {
                        return new Hover(commentToMarkdown(gsProperty, config.doc));
                    }
                }
                else
                {
                    const method = getExtjsConfigByMethod(cmpClass, property);
                    if (method && method.doc) {
                        return new Hover(commentToMarkdown(property, method.doc));
                    }
                }
            }
        }

        //
        // Properties / configs
        //
        else if (lineText.match(new RegExp(`.${property}\\s*[;\\)]+\\s*$`)))
        {
            const cmpClass = getCmpClass(property, lineText);
            if (cmpClass) {
                const config = getExtjsConfigByComponent(cmpClass, property);
                if (config && config.doc) {
                    util.logValue("Provide property/config hover info", property, 1);
                    return new Hover(commentToMarkdown(property, config.doc));
                }
            }
        }

        return undefined;
    }

}


function getCmpClass(property: string, txt: string)
{
    let cmpClass = "this", // getExtjsComponentByConfig(property);
        cmpClassPre, cmpClassPreIdx = -1, cutAt = 0;
    //
    // Get class name prependature to hovered property
    //
    // classPre could be something like:
    //
    //     Ext.csi.view.common.
    //     Ext.csi.store.
    //     Ext.form.field.
    //     MyApp.view.myview.
    //
    cmpClassPre = txt.substring(0, txt.indexOf(property));
    cmpClassPreIdx = cmpClassPre.lastIndexOf(" ") + 1;
    //
    // Remove the trailing '.' for the component name
    //
    cmpClass = cmpClassPre.substr(0, cmpClassPre.length - 1);
    if (cmpClassPreIdx > 0)
    {
        cmpClassPre = cmpClassPre.substring(cmpClassPreIdx);
    }

    for (let i = cmpClass.length - 1; i >= 0 ; i--)
    {
        if (cmpClass[i] < "A" || cmpClass > "z")
        {
            if (cmpClass[i] < "0" || cmpClass > "1") {
                if (cmpClass[i] !== ".") {
                    cutAt = i;
                    break;
                }
            }
        }
    }

    cmpClass = cmpClass.substring(cutAt).replace(/^\w./g, "").trim();

    if (!cmpClass || cmpClass === "this")
    {
        cmpClass = "VSCodeExtJS"; // TODO set main class name somewhere for reference
    }

    util.logBlank(1);
    util.logValue("class", cmpClass, 1);
    return cmpClass;
}


enum MarkdownStringMode
{
    Config,
    Method,
    Normal,
    Property,
    Param
}


function commentToMarkdown(property: string, comment: string): MarkdownString
{
    const markdown = new MarkdownString();
    const newLine = "  \n";
    const longDash = "&#8212;";
    let mode: MarkdownStringMode = MarkdownStringMode.Normal;

    //
    // JSDoc comments in the following form:
    //
    //     /**
    //     * @property propName
    //     * The property description
    //     * @returns {Boolean}
    //     */
    //
    //     /**
    //     * @method methodName
    //     * The method description
    //     * @property prop1 Property 1 description
    //     * @property prop2 Property 2 description
    //     * @returns {Boolean}
    //     */
    //
    // VSCode Hover API takes Clojure based markdown text.  See:
    //
    //     https://clojure.org/community/editing
    //

    util.log("   build markdown string from comment", 1);
    util.logValue("      ", comment, 3);

    const commentFmt = comment?.trim()
        //
        // Clean up beginning of string /**\n...
        //
        .replace(/^[\* \t\n\r]+/, "");
        //
        // Format line breaks to Clojure standard
        //
        // .replace(/\n/, newLine)
        // //
        // // Remove leading "* " for each line in the comment
        // //
        // .replace(/\* /, "")
        // //
        // // Bold @ tags
        // //
        // .replace(/@[a-z]+ /, function(match) {
        //     return "_**" + match.trim() + "**_ ";
        // })
        // .trim();

    const docLines = commentFmt.split("* ");
    docLines.forEach((line) =>
    {
        util.log("   process unformatted line:", 4);
        util.log("      " + line, 4);

        line = line
        //
        // Format line breaks to Clojure standard
        //
        .replace(/\n/, newLine)
        //
        // Remove leading "* " for each line in the comment
        //
        .replace(/\* /, "")
        //
        // Bold @ tags
        //
        // .replace(/@[a-z]+ /, function(match) {
        //     return "_**" + match.trim() + "**_ ";
        // })
        .trim();

        util.log("   formatted line:", 4);
        util.log("      " + line, 4);

        if (mode === MarkdownStringMode.Normal && line.startsWith("@"))
        {

            const lineParts = line.split(property);
            const partOne = lineParts[0].trim();
            markdown.appendMarkdown(lineParts[0] + "_**" + property + "**_ " + lineParts[1]);

            util.logValue("      found @ tag", partOne, 4);

            switch (partOne)
            {
                case "@cfg":
                    mode = MarkdownStringMode.Config;
                    break;
                case "@property":
                    mode = MarkdownStringMode.Property;
                    break;
                default:
                    break;
            }
        }
        else if (mode === MarkdownStringMode.Config)
        {
            const cfgLine = newLine + " " + line.trim();
            util.logValue("      config line", cfgLine.trim(), 4);
            markdown.appendMarkdown(cfgLine);
            mode = MarkdownStringMode.Normal;
        }
        else if (mode === MarkdownStringMode.Property)
        {
            const propLine = newLine + " " + line.trim();
            util.logValue("      property line", propLine.trim(), 4);
            markdown.appendMarkdown(propLine);
            mode = MarkdownStringMode.Normal;
        }
        else if (mode === MarkdownStringMode.Param)
        {
            const propLine = longDash + " " + line.trim();
            util.logValue("      param line", propLine.trim(), 4);
            markdown.appendMarkdown(propLine);
            mode = MarkdownStringMode.Normal;
        }
        else if (mode === MarkdownStringMode.Method)
        {
            const methodLine = longDash + " " + line.trim();
            util.logValue("      method line", methodLine.trim(), 4);
            markdown.appendMarkdown(methodLine);
            mode = MarkdownStringMode.Normal;
        }
        else
        {
            const textLine = line.trim();
            util.logValue("      text line", textLine, 4);
            markdown.appendText(newLine + textLine);
            mode = MarkdownStringMode.Normal;
        }
    });

    return markdown;
}


export default function registerDocHoverProvider(context: ExtensionContext)
{
    context.subscriptions.push(languages.registerHoverProvider("javascript", new DocHoverProvider()));
}
