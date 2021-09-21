
import { MarkupContent } from "vscode-languageserver";
// import { MarkedString } from "vscode-languageserver-types"
import { IJsDoc } from "../../../common"
import * as log from "./log";


enum MarkdownChars
{
    NewLine = "  \n",
    Bold = "**",
    Code = "    ",
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
    Singleton,
    Text
}


class JsDocParser
{

    private bold(text: string, leadingSpace?: boolean, trailingSpace?: boolean)
    {
        return (leadingSpace ? " " : "") + MarkdownChars.Bold + text + MarkdownChars.Bold +
               (trailingSpace ? " " : "");
    }


    private boldItalic(text: string, leadingSpace?: boolean, trailingSpace?: boolean)
    {
        return (leadingSpace ? " " : "") + MarkdownChars.BoldItalicStart + text +
               MarkdownChars.BoldItalicEnd + (trailingSpace ? " " : "");
    }


    private convertLinks(doc: string)
    {
        return doc.replace(/\{\s*@link [\w]+\s*\}/g, (matched) => {
            return this.boldItalic(matched);
        });
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
		else {
			mode = MarkdownStringMode.Text;
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
        {   //
            // v0.10 - replaced w/ .title property
            //
            // const lineParts = line.trim().split(" ");
            // classLine = this.italic(lineParts[0], false, true);
            // if (lineParts.length > 1)
            // {
            //     lineParts.shift();
            //     classLine += this.bold(lineParts[0], true, true);
            //     if (lineParts.length > 1)
            //     {
            //         lineParts.shift();
            //         classLine += MarkdownChars.NewLine + lineParts.join(" ");
            //     }
            // }
        }
        else {
            this.pushMarkdown(classLine, jsdoc);
        }

        log.value("      insert class line", classLine, 5);
    }


    private handleDeprecatedLine(line: string, jsdoc: IJsDoc)
    {
        let depLine: string,
            match;

        match = line.match(/@deprecated ?(.+)*/);
        if (match)
        {
            const [ _, comment ] = match;
            depLine = `${this.bold("deprecated")} ${comment}`;
        }
        else {
            depLine = this.bold("deprecated");
        }

        jsdoc.deprecated = true;

        if (!jsdoc.body.endsWith(MarkdownChars.NewLine)) {
            this.pushMarkdown(MarkdownChars.NewLine, jsdoc);
        }
        this.pushMarkdown(depLine, jsdoc);

        log.value("      insert deprecated line", line.trim(), 5);
    }


    private handlePrivateLine(line: string, jsdoc: IJsDoc)
    {
        let textLine = line.trim();
        // textLine = this.italic(textLine, false, true);
        jsdoc.private = true;
        if (!jsdoc.body.endsWith(MarkdownChars.NewLine)) {
            this.pushMarkdown(MarkdownChars.NewLine, jsdoc);
        }
        this.pushMarkdown(this.bold("private"), jsdoc);
        log.value("      insert private line", textLine, 5);
    }


    private handleObjectLine(line: string, property: string, jsdoc: IJsDoc)
    {
        let cfgLine = line.trim();

        if (line.startsWith("@"))
        {   //
            // v0.10 - replaced w/ .title property
            //
            // const lineParts = line.split(property);
            // cfgLine = lineParts[0] + this.boldItalic(property) + " " + lineParts[1];
        }
        else {
            if (!jsdoc.body.endsWith(MarkdownChars.NewLine)) {
                this.pushMarkdown(MarkdownChars.NewLine, jsdoc);
            }
            this.pushMarkdown(cfgLine, jsdoc);
        }

        log.value("      insert object line", cfgLine, 5);
    }


    /**
     * 'Parameter' mode is turn on when an `@param` tag is encountered.  It remains turned on
     * until another @ tag is encountered, treating each line as documentation for the param
     *
     * @param line The current line text
     * @param trailers Array of lines that will be inserted after all lines in the parameter
     * documentation have been processed
     * @param useCode Indicates its the first line in the doc
     * @param doc The parsed jsdoc from the ast
     * @param jsdoc The IJsDoc instance
     */
    private handleParamLine(line: string, trailers: string[], doc: string, jsdoc: IJsDoc)
    {
        if (!line.startsWith("@")) // append previous parameter documentation line
        {
            log.value("      insert param text line", line, 5);
            this.pushMarkdown(line, jsdoc);
            return;
        }

        let lineProperty = "",
            lineType = "",
            lineValue: string | undefined,
            docLine: string | undefined;
        //
        // Check for a default value, for example:
        //
        //     @param {Boolean} [debug=true] Set to `true` to...
        //
        // If a default value is found, set 'lineValue' and this is added to the 'trailers'
        // array to be placed at the end of the params documentation body
        //
        let match, body = "No documentation found";
        doc = doc.replace(/\r\n +\*/g, "\r\n").replace(/\n +\*/g, "\n");
        let regex = /@param\s*(\{[\w.*|\/ ]+\})*\s*\[?(\w+)(?: *= *([\w"`' ]*) *)*\]? *([^]+)?$/;
        if ((match = regex.exec(line)) !== null)
        {
            const [ _, mType, mProperty, mDefault, mDocLine ] = match;
            lineType = mType?.replace(/[\{\}]/g, "").replace("*", "any").replace(/\//g, "|").replace(/\|/g, " | ").replace(/ +/g, ' ');
            lineValue = mDefault ;
            lineProperty = mProperty;
            docLine = mDocLine;
            regex = new RegExp(`@param\\s*(?:\\{[\\w\\.*|\\/ ]+\\})*\\s*\\[?${lineProperty}(?: *= *(?:[\\w"\`' ]*) *\\]?)*([^]*?)(?=^@[a-z]+|ENDPARAMS)`, "gm");
            if ((match = regex.exec(doc + "ENDPARAMS")) !== null)
            {
                const [ _, mBody ] = match;
                body = mBody?.trim();
            }
        }
        else {
            return;
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

        let paramLine = `${MarkdownChars.Code}parameter ${lineProperty}: ${lineType}`;
        if (docLine) {
            // paramLine += `${MarkdownChars.NewLine}${MarkdownChars.LongDash} ${docLine}`;
            paramLine += `${MarkdownChars.NewLine}${docLine}`;
        }

        //
        // Put some space between each parameter description
        //
        if (!jsdoc.body.endsWith(MarkdownChars.NewLine)) {
            this.pushMarkdown(MarkdownChars.NewLine, jsdoc);
        }
        if (!jsdoc.body.endsWith(`${MarkdownChars.NewLine}${MarkdownChars.NewLine}`)) {
            this.pushMarkdown(MarkdownChars.NewLine, jsdoc);
        }
    
        this.pushMarkdown(paramLine, jsdoc);

        log.value("      param line", paramLine, 5);

        if (lineValue)
        {
            trailers.push(`${MarkdownChars.NewLine}${this.italic("Defaults to:")} \`${lineValue.replace(/`/g, "")}\`${MarkdownChars.NewLine}${MarkdownChars.NewLine}`);
        }
        else {
            this.pushMarkdown(MarkdownChars.NewLine, jsdoc);
        }
    }


    private handleReturnsLine(line: string, jsdoc: IJsDoc)
    {
        let rtnLine: string,
            match;

        match = line.match(/@return[s]{0,1} +\{([A-Za-z*.]+)\} +(.+)*/);
        if (match)
        {
            const [ _, returns, comment ] = match;
            jsdoc.returns = returns.toLowerCase();
            rtnLine = `${MarkdownChars.Code}returns: ${jsdoc.returns}${MarkdownChars.NewLine}${comment}`;
        }
        else {
            jsdoc.returns = "void";
            rtnLine = `${MarkdownChars.Code}returns: ${jsdoc.returns}`;
        }

        if (!jsdoc.body.endsWith(MarkdownChars.NewLine)) {
            this.pushMarkdown(MarkdownChars.NewLine, jsdoc);
        }
        this.pushMarkdown(rtnLine, jsdoc);

        log.value("      insert returns line", rtnLine, 5);
    }


    private handleSinceLine(line: string, jsdoc: IJsDoc)
    {
        let sinceLine: string;

        let match;
        match = line.match(/@since +[vV]*(?:ersion)* *([0-9.-]+)*/);
        if (match)
        {
            const [ _, version ] = match;
            jsdoc.since = `v${version}`;
            sinceLine = `${MarkdownChars.NewLine}${MarkdownChars.Italic}since version ${version}${MarkdownChars.Italic}`;
        }
        else {
            jsdoc.since = "?";
            sinceLine = `${MarkdownChars.NewLine}${MarkdownChars.Italic}since version ?${MarkdownChars.Italic}`;
        }

        if (!jsdoc.body.endsWith(MarkdownChars.NewLine)) {
            this.pushMarkdown(MarkdownChars.NewLine, jsdoc);
        }
        this.pushMarkdown(sinceLine, jsdoc);
        log.value("      insert since line", sinceLine, 5);
    }


    private handleTagLine(line: string, jsdoc: IJsDoc)
    {
        // let textLine = line.trim().replace("@", "");
        // textLine = this.italic(textLine, false, true);
        // this.pushMarkdown(textLine, jsdoc);
        // log.value("      insert tag line", textLine, 5);
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
        log.value("      insert text line", textLine, 5);

        if (!jsdoc.body.endsWith(MarkdownChars.NewLine)) {
            this.pushMarkdown(MarkdownChars.NewLine, jsdoc);
        }
        this.pushMarkdown(textLine, jsdoc);
    }


    private italic(text: string, leadingSpace?: boolean, trailingSpace?: boolean)
    {
        return (leadingSpace ? " " : "") + MarkdownChars.Italic + text +
            MarkdownChars.Italic + (trailingSpace ? " " : "");
    }


    private populateTitle(property: string, componentClass: string, jsdoc:IJsDoc)
    {   
        //
        // Type title - mocks js ls
        //

        let privateText = "";
        if (jsdoc.private) {
            privateText = `${MarkdownChars.NewLine}private ${jsdoc.pType}`;
        }
        let staticText = "";
        if (jsdoc.static) {
            staticText = `${MarkdownChars.NewLine}static ${jsdoc.pType}`;
        }

        if (jsdoc.pType === "method")
        {
            let params = jsdoc.params.map(p => p.name).join(", ") || "none";
            jsdoc.title = `function ${property}: returns ${jsdoc.returns}${privateText}${staticText}${MarkdownChars.NewLine}parameters:  ${params}`;
        }
        else if (jsdoc.pType === "property")
        {
            jsdoc.title = `property ${property}: ${jsdoc.type}${privateText}${staticText}`;
        }
        else if (jsdoc.pType === "cfg")
        {
            jsdoc.title = `config ${property}: ${jsdoc.type}`;
        }
        else if (jsdoc.pType === "param")
        {
            jsdoc.title = `parameter ${property}: ${jsdoc.type}`;
        }
        else
        {
            let clsShortName = property;
            if (clsShortName.includes(".")) {
                clsShortName = clsShortName.substring(clsShortName.lastIndexOf(".") + 1);
            }
            if (jsdoc.singleton) {
                jsdoc.title = `singleton ${clsShortName}: ${componentClass}${privateText}${staticText}`;
            }
            else {
                jsdoc.title = `${jsdoc.pType} ${clsShortName}: ${componentClass}${privateText}${staticText}`;
            }
        }
    }


    private pushMarkdown(doc: string, jsdoc: IJsDoc)
    {
        jsdoc.body += this.convertLinks(doc);
    }
    

    toIJsDoc(property: string, pType: "property" | "param" | "cfg" | "class" | "method" | "unknown", componentClass: string, isPrivate: boolean, isStatic: boolean, isSingleton: boolean, comment: string | undefined, logPad = ""): IJsDoc
    {
        const jsdoc = getDefaultIJsDoc(pType);

        if (!comment) {
            jsdoc.private = isPrivate;
            jsdoc.static = isStatic;
            jsdoc.singleton = isSingleton;
            this.populateTitle(property, componentClass, jsdoc);
            return jsdoc;
        }

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
              maxLines = 100;
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

            //
            // Skip control comments
            // TODO - these tags should be a configurable setting
            //
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
            line = line.replace(/\n/, "")
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
            else if (!jsdoc.type) {
                const types = this.getTypes(line);
                jsdoc.type = types.vType;
            }

            if (indented && mode !== MarkdownStringMode.Code)
            {
                this.pushMarkdown(indented, jsdoc);
                this.pushMarkdown(`${MarkdownChars.NewLine}<!-- -->`, jsdoc);
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
                this.handleParamLine(line, trailers, commentFmt, jsdoc);
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
            else // mode === MarkdownStringMode.Text
            {
                this.handleTextLine(line, jsdoc);
            }

            ++currentLine;
            if (currentLine >= maxLines) {
                break;
            }
        }

        if (isPrivate && !jsdoc.private) {
            jsdoc.private = !!isPrivate;
        }
        if (isStatic && !jsdoc.static) {
            jsdoc.static = !!isStatic;
        }
        if (isSingleton && !jsdoc.singleton) {
            jsdoc.singleton = !!isSingleton;
        }
        if (jsdoc.pType === "method" && !jsdoc.returns) {
            jsdoc.returns = "void";
        }

        this.populateTitle(property, componentClass, jsdoc);

        log.methodDone("build markdown string from comment", 4, logPad);
        return jsdoc;
    }

}


export function getDefaultIJsDoc(pType: "property" | "param" | "cfg" | "class" | "method" | "unknown"): IJsDoc
{
    return {
        body: "",
        deprecated: false,
        private: false,
        pType,
        returns: "",
        since: "",
        singleton: false,
        static: false,
        params: [],
        title: "",
        type: ""
    };
}


export function parseDoc(property: string, type: "property" | "param" | "cfg" | "class" | "method" | "unknown", componentClass: string, isPrivate: boolean, isStatic: boolean, isSingleton: boolean, doc: string, logPad = "")
{
    return (new JsDocParser()).toIJsDoc(property, type, componentClass, isPrivate, isStatic, isSingleton, doc, logPad)
}
