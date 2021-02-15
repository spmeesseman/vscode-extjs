
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
            if (cmpClass[i] < "0" || cmpClass > "9") {
                if (cmpClass[i] !== ".") {
                    cutAt = i;
                    console.log(i);
                    break;
                }
            }
        }
    }

    cmpClass = cmpClass.substring(cutAt).replace(/[^\w.]+/g, "").trim();

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
    Code,
    Config,
    Method,
    Normal,
    Property,
    Param,
    Returns
}


function commentToMarkdown(property: string, comment: string): MarkdownString
{
    const markdown = new MarkdownString(),
          newLine = "  \n",
          longDash = "&#8212;",
          black = "\\u001b[30m",
          red = "\\u001b[31",
          Green = "\\u001b[32m",
          yellow = "\\u001b[33m",
          blue = "\\u001b[34m",
          magenta = "\\u001b[35",
          cyan = "\\u001b[36m",
          white = "\\u001b[37m";
    let mode = MarkdownStringMode.Normal,
        indented = "", lineProperty = "", lineType = "", lineTrail = "", hdrMode = true;

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

    const docLines = commentFmt.split(/\r{0,1}\n{1}\s*\*( |$)/);
    docLines.forEach((line) =>
    {
        util.log("   process unformatted line:", 4);
        util.log("      " + line, 4);

        if (!line.trim()) {
            return; // continue forEach()
        }

        if (markdown.value.length > 0 && mode !== MarkdownStringMode.Code) {
            markdown.appendMarkdown(newLine);
        }

        line = line
        //
        // Remove line breaks, we format later depending on comment parts, done w/ Clojure
        // standard line breaks
        //
        .replace(/\n/, "")
        //
        // Remove leading "* " for each line in the comment
        //
        .replace(/\* /, "")
        .replace(/\s*\*$/, ""); // <- Blank lines
        //
        // Italicize @ tags
        //
        // .replace(/@[a-z]+ /, function(match) {
        //     return "_" + match.trim() + "_";
        // });
        // .trim();

        util.log("   formatted line:", 4);
        util.log("      " + line, 4);

        if (!line.trim()) {
            return; // continue forEach()
        }

        if (mode === MarkdownStringMode.Code)
        {
            if (line.length > 3 && line.substring(0, 3) === "   " || line[0] === "\t")
            {
                util.logValue("      indented line", line, 4);
                indented += newLine + line.trim();
                return; // continue forEach()
            }
            else {
                markdown.appendCodeblock(indented.trim());
                mode = MarkdownStringMode.Normal;
                indented = "";
            }
        }

        hdrMode = line.startsWith("@");
        if (hdrMode)
        {
            const lineParts = line.split(property);
            const partOne = lineParts[0].trim();
            switch (partOne)
            {
                case "@cfg":
                    mode = MarkdownStringMode.Config;
                    break;
                case "@property":
                    mode = MarkdownStringMode.Property;
                    break;
                case "@param":
                    mode = MarkdownStringMode.Param;
                    break;
                case "@returns":
                    mode = MarkdownStringMode.Returns;
                    break;
                default:
                    mode = MarkdownStringMode.Normal;
                    break;
            }
            util.logValue("      found @ tag", partOne, 4);
            util.logValue("      set mode", mode.toString(), 4);
        }

        if (mode !== MarkdownStringMode.Param)
        {
            lineType = "";
            lineProperty = "";
            lineTrail = "";
        }

        if (mode === MarkdownStringMode.Config || mode === MarkdownStringMode.Property || mode === MarkdownStringMode.Method)
        {
            let cfgLine = "";
            if (hdrMode) {
                const lineParts = line.split(property);
                cfgLine = lineParts[0] + "_**" + property + "**_ " + lineParts[1];
            }
            else {
                cfgLine = line.trim();
            }
            util.logValue("      add line", cfgLine.trim(), 4);
            markdown.appendMarkdown(cfgLine);
        }
        else if (mode === MarkdownStringMode.Param)
        {
            let type;
            const lineParts = line.split(property);
            let propLine = line.trim();
            const partTwo = lineParts[1].trim(),
                      partTwoParts = partTwo.split(" ");
            if (partTwoParts[0].search(/\{[A-Z]\}/i) === -1)
            {
                lineType = "";
                lineProperty = partTwoParts[0];
                if (partTwoParts.length > 1)
                {
                    lineTrail = partTwoParts.join(" ");
                }
                else {
                    lineTrail = "";
                }
            }
            else {
                lineType = partTwoParts[0];
                lineProperty = partTwoParts[1];
                if (partTwoParts.length > 1)
                {
                    lineTrail = partTwoParts.join(" ");
                }
            }
            util.logValue("          name", lineProperty, 4);
            util.logValue("          type", lineType, 4);

            propLine = propLine.replace(/\{[A-Z]\}/, "");
            util.logValue("      param line", propLine.trim(), 4);
            markdown.appendMarkdown(propLine);
            mode = MarkdownStringMode.Normal;
        }
        else
        {
            const textLine = line;
            if (textLine.length > 3 && textLine.substring(0, 3) === "   " || textLine[0] === "\t")
            {
                util.logValue("      indented line", textLine, 4);
                if (!indented) {
                    indented += newLine;
                }
                indented += textLine.trim();
                mode = MarkdownStringMode.Code;
            }
            else
            {
                util.logValue("      text line", textLine, 4);
                markdown.appendText(textLine);
                mode = MarkdownStringMode.Normal;
            }
        }
    });

    return markdown;
}


export default function registerDocHoverProvider(context: ExtensionContext)
{
    context.subscriptions.push(languages.registerHoverProvider("javascript", new DocHoverProvider()));
}
