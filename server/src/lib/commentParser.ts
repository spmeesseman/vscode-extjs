
import { MarkupContent } from "vscode-languageserver";
// import { MarkedString } from "vscode-languageserver-types"
import { IJsDoc } from "../../../common"
import * as log from "../log";


enum MarkdownChars
{
    NewLine = "  \n",
    TypeWrapBegin = "[",
    TypeWrapEnd = "]",
    Bold = "**",
    Italic = "*",
    BoldItalicStart = "_**",
    BoldItalicEnd = "**_",
    LongDash = "&#8212;",
    Black = "\\u001b[30m",
    Red = "\\u001b[31",
    Green = "\\u001b[32m",
    Yellow = "\\u001b[33m",
    Blue = "\\u001b[34m", // "<span style=\"color:blue\">"  "</style>"
    Magenta = "\\u001b[35",
    Cyan = "\\u001b[36m",
    White = "\\u001b[37m"
}

enum MarkdownStringMode
{
    Class,
    Code,
    Config,
    Deprecated,
    Link,
    Method,
    Normal,
    Private,
    Property,
    Param,
    Returns,
    Since,
    Singleton
}


class CommentParser
{

    private boldItalic(text: string, leadingSpace?: boolean, trailingSpace?: boolean)
    {
        return (leadingSpace ? " " : "") + MarkdownChars.BoldItalicStart + text +
               MarkdownChars.BoldItalicEnd + (trailingSpace ? " " : "");
    }


    private bold(text: string, leadingSpace?: boolean, trailingSpace?: boolean)
    {
        return (leadingSpace ? " " : "") + MarkdownChars.Bold + text + MarkdownChars.Bold +
               (trailingSpace ? " " : "");
    }


	private getMode(line: string): MarkdownStringMode | undefined
	{
		let mode;
		if (line.startsWith("@"))
		{
			const tag = line.trim().substring(0, line.indexOf(" ") !== -1 ? line.indexOf(" ") : line.length);
			switch (tag)
			{
				case "@cfg":
				case "@config":
					mode = MarkdownStringMode.Config;
					break;
				case "@class":
					mode = MarkdownStringMode.Class;
					break;
				// case "{@link":
				//     mode = MarkdownStringMode.Link;
				//     break;
				case "@property":
					mode = MarkdownStringMode.Property;
					break;
				case "@param":
					mode = MarkdownStringMode.Param;
					break;
				case "@returns":
				case "@return":
					mode = MarkdownStringMode.Returns;
					break;
				case "@method":
					mode = MarkdownStringMode.Method;
					break;
				case "@since":
					mode = MarkdownStringMode.Since;
					break;
				case "@deprecated":
					mode = MarkdownStringMode.Deprecated;
					break;
				case "@private":
					mode = MarkdownStringMode.Private;
					break;
				case "@singleton":
					mode = MarkdownStringMode.Singleton;
					break;
				case "@inheritdoc":
				default:
					break;
			}
			log.value("      found @ tag", tag, 4);
			log.value("      set mode", mode?.toString(), 4);
		}
		else if (line.length > 3 && (line.substring(0, 3) === "   " || line[0] === "\t"))
		{
			mode = MarkdownStringMode.Code;
		}
		return mode;
	}


    private getTypes(doc: string)
    {
        let vType = "unknown";
        let pType: "property" | "param" | "cfg" | "class" | "method" = "class";
        const match = doc.match(/@(property|param|cfg|class|method) +\{([A-Za-z]+)\} +\w+/);
        if (match) {
            const [ _, paramType, varType  ] = match;
            pType = paramType as "property" | "param" | "cfg" | "class" | "method";
            vType = varType.toLowerCase();
        }
        return {
            vType, pType
        };
    }


	private handleClassLine(line: string, jsdoc: IJsDoc)
    {
        let classLine = line.trim();

        if (classLine.match(/@[\w]+ /))
        {
            const lineParts = line.trim().split(" ");
            classLine = this.italic(lineParts[0], false, true);
            if (lineParts.length > 1)
            {
                lineParts.shift();
                classLine += this.bold(lineParts[0], true, true);
                if (lineParts.length > 1)
                {
                    lineParts.shift();
                    classLine += MarkdownChars.NewLine + lineParts.join(" ");
                }
            }
        }

        this.pushMarkdown(classLine, jsdoc);

        log.value("      insert class line", classLine, 5);
    }


    private handleDeprecatedLine(line: string, jsdoc: IJsDoc)
    {
        let textLine = line.trim();
        textLine = this.italic(textLine, false, true);

        jsdoc.deprecated = true;
        this.pushMarkdown(MarkdownChars.NewLine + textLine, jsdoc);

        log.value("      insert deprecated line", textLine, 5);
    }


    private handlePrivateLine(line: string, jsdoc: IJsDoc)
    {
        let textLine = line.trim();
        textLine = this.italic(textLine, false, true);

        jsdoc.private = true;
        this.pushMarkdown(MarkdownChars.NewLine + textLine, jsdoc);

        log.value("      insert private line", textLine, 5);
    }


    private handleObjectLine(line: string, property: string, jsdoc: IJsDoc)
    {
        let cfgLine = "";

        if (line.startsWith("@")) {
            const lineParts = line.split(property);
            cfgLine = lineParts[0] + this.boldItalic(property) + " " + lineParts[1];
        }
        else {
            cfgLine = line.trim();
        }

        this.pushMarkdown(MarkdownChars.NewLine + cfgLine, jsdoc);

        log.value("      insert object line", cfgLine, 5);
    }


    private handleParamLine(line: string, trailers: string[], useCode: boolean, doc: string, jsdoc: IJsDoc)
    {
        if (!line.startsWith("@"))
        {
            log.value("      insert param text line", line, 5);
            this.pushMarkdown(line, jsdoc);
            return;
        }

        let lineProperty = "", lineType = "",
            lineValue: string | undefined, lineTrail = "";
        const lineParts = line.split(" ");
        //
        // Examples:
        //
        //     @param {Object} opt Delivery options.
        //     @param {String} msg The specific error message.
        //     Some more descriptive text about the above property.
        //     @param {Boolean} [show=true]  Show the button to open a help desk ticket
        //     Some more descriptive text about the above property.
        //
        // Trailing line text i.e. 'Some more descriptive text about the above property' gets
        // stored into 'lineTrail'.  THis is placed "before" the default value extracted from a
        // first line i.e. [show=true].
        //
        if (lineParts.length > 1)
        {   //
            // Check for no type i.e. @param propName the description here
            //
            if (!lineParts[1].match(/\{[A-Z(\[\])]+\}/i))
            {
                lineType = "";
                lineProperty = lineParts[1];
                if (lineParts.length > 2)
                {
                    lineParts.shift();
                    lineParts.shift();
                    lineTrail = lineParts.join(" ");
                }
                else {
                    lineParts.shift();
                    lineTrail = "";
                }
            }
            //
            // Has type i.e. @param {String} propName the description here
            //
            else if (lineParts.length > 2)
            {
                lineType = lineParts[1];
                lineProperty = lineParts[2];
                if (lineParts.length > 3)
                {
                    lineParts.shift();
                    lineParts.shift();
                    lineParts.shift();
                    lineTrail = lineParts.join(" ");
                }
            }
        }

        //
        // If no property name was found, then there's nothing to add to the markdown, exit
        // lineProperty is property or [property=value]
        //
        if (!lineProperty) {
            return;
        }
        
        if (lineProperty.indexOf("=") !== -1) {
            lineProperty = lineProperty.substring(0, lineProperty.indexOf("=")).replace(/[\[\]=]/g, "").trim();
        }

        //
        // Check for a default value, for example:
        //
        //     @param {Boolean} [debug=true] Set to `true` to...
        //
        // If a default value is found, set 'lineValue' and this is added to the 'trailers'
        // array to be placed at the end of the params documentation body
        //
        let match, body = "";
        doc = doc.replace(/\r\n +\*/g, "\r\n").replace(/\n +\*/g, "\n");
        const regex = new RegExp(`@param\\s*(\\{[\\w\\.]+\\})*\\s*\\[?${lineProperty}(?: *= *([\\w"\`' ]*) *\\]?)*([^]*?)(?=^@param|@return|@since|@[a-z]+|ENDPARAMS)`, "gm");
        if ((match = regex.exec(doc + "ENDPARAMS")) !== null)
        {
            const [ _, mType, mDefault, mBody ] = match;
            body = mBody?.trim();
            lineType = mType?.replace(/[\{\}]/g, "").replace("*", "any").toLowerCase();
            lineValue = mDefault ;
        }

        log.value("          name", lineProperty, 5);
        if (lineType) {
            log.value("          type", lineType, 5);
        }

        jsdoc.params.push({
            name: lineProperty,
            default: lineValue ? lineValue.replace(/`/g, "") : undefined,
            type: lineType,
            body,
            title: `${lineType} ${lineProperty}${lineValue ? ": defaults to " + lineValue : ""}`
        });

        let paramLine: string;

        if (!useCode)
        {
            paramLine = this.italic("@param", false, true) + this.boldItalic(lineProperty, false, true) +
                        this.italic(MarkdownChars.TypeWrapBegin + lineType + MarkdownChars.TypeWrapEnd);
            if (lineTrail) {
                paramLine += (" " + MarkdownChars.LongDash + lineTrail);
            }
            if (!jsdoc.body.endsWith(MarkdownChars.NewLine))
            {
                this.pushMarkdown(MarkdownChars.NewLine, jsdoc);
            }
            this.pushMarkdown(paramLine, jsdoc);
        }
        else {
            paramLine = lineProperty + " " + MarkdownChars.TypeWrapBegin + lineType + MarkdownChars.TypeWrapEnd;
            if (lineTrail) {
                paramLine += " - " + lineTrail;
            }
            // this.pushMarkdown(`    ${paramLine}`, jsdoc);
            this.pushMarkdown(paramLine, jsdoc);
        }

        log.value("      param line", paramLine, 5);

        if (lineValue)
        {
            trailers.push(MarkdownChars.NewLine + "- " + this.italic("Defaults to:") + " `" +
                        lineValue.replace(/`/g, "") + "`" +  MarkdownChars.NewLine +  MarkdownChars.NewLine);
        }
        else {
            this.pushMarkdown(MarkdownChars.NewLine, jsdoc);
        }
    }


    private handleReturnsLine(line: string, jsdoc: IJsDoc)
    {
        const rtnLineParts = line.trim().split(" ");
        let rtnLine = MarkdownChars.Italic + rtnLineParts[0] + MarkdownChars.Italic + " ";

        rtnLineParts.shift();
        rtnLine += rtnLineParts.join(" ");

        let match;
        match = rtnLine.match(/\*@return[s]{0,1}\* \{([A-Za-z]+)\}/);
        if (match) {
            const [ _, returns ] = match;
            jsdoc.returns = returns.toLowerCase();
        }

        rtnLine = rtnLine.replace(/\*@return[s]{0,1}\* \{[A-Za-z]+\}/, (matched) => {
            return matched.replace(/\{[A-Za-z]+\}/, (matched2) => {
                return this.italic(matched2.replace("{", MarkdownChars.TypeWrapBegin)
                                    .replace("}", MarkdownChars.TypeWrapEnd));
            });
        });

        this.pushMarkdown(MarkdownChars.NewLine + rtnLine, jsdoc);

        log.value("      insert returns line", rtnLine, 5);
    }


    private handleSinceLine(line: string, jsdoc: IJsDoc)
    {
        let textLine = line.trim();
        const lineParts = line.trim().split(" ");
        textLine = this.italic(lineParts[0], false, true);
        if (lineParts.length > 1)
        {
            lineParts.shift();
            if (!lineParts[0].startsWith("v") && !lineParts[0].startsWith("V")) {
                lineParts[0] = "v" + lineParts[0];
            }
            textLine += lineParts.join(" ");

            jsdoc.since = lineParts[0];
            this.pushMarkdown(MarkdownChars.NewLine + textLine, jsdoc);

            log.value("      insert since line", textLine, 5);
        }
    }


    private handleTagLine(line: string, jsdoc: IJsDoc)
    {
        let textLine = line.trim();
        textLine = this.italic(textLine, false, true);
        this.pushMarkdown(textLine, jsdoc);
        log.value("      insert tag line", textLine, 5);
    }


    private handleTextLine(line: string, jsdoc: IJsDoc)
    {
        let textLine = line.trim();
        if (textLine.match(/@[\w]+ /))
        {
            const lineParts = line.trim().split(" ");
            textLine = this.italic(lineParts[0], false, true);
            if (lineParts.length > 1) {
                lineParts.shift();
                textLine += lineParts.join(" ");
            }
        }
        if (textLine.match(/\{\s*@link [\w]+\s*\}/))
        {
            textLine = textLine.replace(/\{\s*@link [\w]+\s*\}/, (matched) => {
                return this.boldItalic(matched);
        });
        }
        log.value("      insert text line", textLine, 5);
        this.pushMarkdown(MarkdownChars.NewLine + textLine, jsdoc);
    }


    private italic(text: string, leadingSpace?: boolean, trailingSpace?: boolean)
    {
        return (leadingSpace ? " " : "") + MarkdownChars.Italic + text +
            MarkdownChars.Italic + (trailingSpace ? " " : "");
    }


    private pushMarkdown(doc: string, jsdoc: IJsDoc)
    {
        jsdoc.body += doc;
    }


    toIJsDoc(property: string, componentClass: string, comment: string | undefined, logPad = ""): IJsDoc | undefined
    {
        if (!comment || !property) {
            return;
        }

        const jsdoc: IJsDoc = {
            body: "",
            deprecated: false,
            private: false,
            pType: "unknown",
            returns: "",
            since: "",
            singleton: false,
            static: false,
            params: [],
            title: "",
            type: ""
        };

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

        log.methodStart("build markdown string from comment", 4, logPad, false, [["comment", comment]]);

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

        const docLines = commentFmt.split(/\r{0,1}\n{1}\s*\*( |$)/),
              maxLines = 75;
        let mode: MarkdownStringMode | undefined,
            indented = "",
            previousMode: MarkdownStringMode | undefined,
            trailers: string[] = [],
            currentLine = 0;

        for (let line of docLines)
        {
            if (!line.trim()) {
                continue;
            }

            if (currentLine === 0 && (line.includes("eslint") || line.includes("vscode-extjs"))) {
                continue;
            }

            if (jsdoc.body.length > 0 && mode !== MarkdownStringMode.Code) {
                this.pushMarkdown(MarkdownChars.NewLine, jsdoc);
            }

            //
            // Remove line breaks, we format later depending on comment parts, done w/ Clojure
            // standard line breaks
            //
            line = line
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

            log.value("   process line", line, 4);

            if (!line.trim()) {
                continue;
            }

            mode = this.getMode(line);
            
            if (!jsdoc.pType || jsdoc.pType === "unknown") {
                const types = this.getTypes(line);
                jsdoc.pType = types.pType;
                jsdoc.type = types.vType;
            }

            if (indented && mode !== MarkdownStringMode.Code)
            {
                this.pushMarkdown(indented, jsdoc);
                indented = "";
            }

            //
            // If 'mode' defined, and strings exist in the 'trailers' array, then then we are done
            // processing previous tag block.  e.g.:
            //
            //     @param {Boolean} [show=true]  Show the button to open a help desk ticket
            //     User can select whether or not to submit a ticket.
            //     [ TRAILERS GO HERE ]
            //     @param {Boolean} [ask=true]  Prompt for input   ( <--- processing this line)
            //
            if (mode !== undefined && mode !== MarkdownStringMode.Code && trailers.length)
            {
                trailers.forEach((t) => {
                    this.pushMarkdown(t, jsdoc);
                });
                trailers = [];
            }

            mode = mode !== undefined ? mode : previousMode;

            previousMode = mode;

            if (mode === MarkdownStringMode.Config || mode === MarkdownStringMode.Property || mode === MarkdownStringMode.Method)
            {
                this.handleObjectLine(line, property, jsdoc);
            }
            else if (mode === MarkdownStringMode.Class)
            {
                this.handleClassLine(line, jsdoc);
            }
            else if (mode === MarkdownStringMode.Param)
            {
                this.handleParamLine(line, trailers, currentLine === 0, commentFmt, jsdoc);
            }
            else if (mode === MarkdownStringMode.Code)
            {
                log.value("      indented line", line, 5);
                indented += MarkdownChars.NewLine + line;
            }
            else if (mode === MarkdownStringMode.Returns)
            {
                this.handleReturnsLine(line, jsdoc);
            }
            else if (mode === MarkdownStringMode.Deprecated)
            {
                this.handleDeprecatedLine(line, jsdoc);
            }
            else if (mode === MarkdownStringMode.Private)
            {
                this.handlePrivateLine(line, jsdoc);
            }
            else if (mode === MarkdownStringMode.Since)
            {
                this.handleSinceLine(line, jsdoc);
            }
            else if (mode === MarkdownStringMode.Singleton)
            {
                this.handleTagLine(line, jsdoc);
            }
            else
            {
                this.handleTextLine(line, jsdoc);
            }

            ++currentLine;
            if (currentLine >= maxLines) {
                break;
            }
        }

        //
        // Type title - mocks js ls
        //
        let clsShortName = property;
        if (clsShortName.includes(".")) {
            clsShortName = clsShortName.substring(clsShortName.lastIndexOf(".") + 1);
        }
        jsdoc.title = `${jsdoc.pType} ${clsShortName}: ${componentClass}`;

        log.methodDone("build markdown string from comment", 4, logPad);
        return jsdoc;
    }

}


export function parseDoc(property: string, componentClass: string, doc: string, logPad = "")
{
    return (new CommentParser()).toIJsDoc(property, componentClass, doc, logPad)
}
