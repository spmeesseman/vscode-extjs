
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import * as log from "./log";
import {
    IComponent, IConfig, IMethod, IXtype, IProperty, IVariable,
    DeclarationType, IParameter, utils, VariableType
} from "../../common";
import {
    isArrayExpression, isIdentifier, isObjectExpression, Comment, isObjectProperty, isExpressionStatement,
    isStringLiteral, ObjectProperty, StringLiteral, isFunctionExpression, ObjectExpression,
    isVariableDeclaration, isVariableDeclarator, isCallExpression, isMemberExpression, isFunctionDeclaration
} from "@babel/types";


const ignoreProperties = [
    "config", "items", "listeners", "requires", "privates", "statics"
];

export function getExtJsComponent(text: string)
{
    const ast = parse(text);
    let componentName = "";

    //
    // Construct our syntax tree to be able to serve the goods
    //
    traverse(ast,
    {
        CallExpression(path)
        {
            const callee = path.node.callee,
                args = path.node.arguments;

            if (callee.type === "MemberExpression")
            {   //
                // Check to see if the callee is 'Ext.define', these are our ExtJs classes...
                //
                if (isIdentifier(callee.object) && callee.object.name === "Ext" && isIdentifier(callee.property) && callee.property.name === "define")
                {
                    log.logBlank(1);
                    log.log("get extjs component", 1);
                    //
                    // Ext.define should be in the form:
                    //
                    //     Ext.define('MyApp.view.users.User', { ... });
                    //
                    // Check to make sure the callee args are a string for param 1 and an object for param 2
                    //
                    if (isStringLiteral(args[0]) && isObjectExpression(args[1]))
                    {
                        componentName = args[0].value;
                    }
                }
            }
        }
    });

    return componentName;
}


export async function parseExtJsFile(fsPath: string, text: string, isFramework?: boolean)
{
    const ast = parse(text);
    const components: IComponent[] = [];

    //
    // Construct our syntax tree to be able to serve the goods
    //
    traverse(ast,
    {
        CallExpression(path)
        {
            const callee = path.node.callee,
                args = path.node.arguments;

            if (callee.type === "MemberExpression")
            {   //
                // Check to see if the callee is 'Ext.define'
                //
                if (isIdentifier(callee.object) && callee.object.name === "Ext" && isIdentifier(callee.property) && callee.property.name === "define")
                {
                    log.logMethodStart("parse extjs file", 1, "", true, [["file", fsPath]]);

                    //
                    // Ext.define should be in the form:
                    //
                    //     Ext.define('MyApp.view.users.User', { ... });
                    //
                    // Check to make sure the callee args are a string for param 1 and an object for param 2
                    //
                    if (isStringLiteral(args[0]) && isObjectExpression(args[1]))
                    {
                        if (isFramework === undefined)
                        {
                            isFramework = args[0].value.startsWith("Ext.") && !args[0].value.startsWith("Ext.csi.");
                        }

                        const dotIdx = args[0].value.indexOf(".");
                        const componentInfo: IComponent = {
                            baseNamespace: dotIdx !== -1 ? args[0].value.substring(0, dotIdx) : args[0].value,
                            componentClass: args[0].value,
                            xtypes: [],
                            aliases: [],
                            widgets: [],
                            methods: [],
                            properties: [],
                            configs: [],
                            statics: [],
                            privates: [],
                            fsPath,
                            isFramework
                        };

                        if (isExpressionStatement(path.container)) {
                            componentInfo.doc = getComments(path.container.leadingComments);
                            componentInfo.since = getSince(componentInfo.doc);
                            componentInfo.private = componentInfo.doc?.includes("@private");
                            componentInfo.deprecated = componentInfo.doc?.includes("@deprecated");
                        }

                        components.push(componentInfo);

                        log.logBlank(1);
                        log.logValue("   Component", args[0].value, 1);

                        const propertyRequires = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === "requires");
                        const propertyAlias = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && (p.key.name === "alias" || p.key.name === "alternateClassName"));
                        const propertyXtype = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === "xtype");
                        const propertyConfig = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === "config");
                        const propertyStatics = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === "statics");
                        const propertyPrivates = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === "privates");
                        const propertyExtend = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === "extend");
                        const propertyMethod = args[1].properties.filter(p => isObjectProperty(p) && isIdentifier(p.key) && isFunctionExpression(p.value));
                        const propertyProperty = args[1].properties.filter(p => isObjectProperty(p) && isIdentifier(p.key) && !isFunctionExpression(p.value));

                        if (isObjectProperty(propertyExtend))
                        {
                            componentInfo.extend = parseExtend(propertyExtend);
                            if (componentInfo.extend) {
                                logProperties("extend", [ componentInfo.extend ]);
                            }
                        }

                        if (isObjectProperty(propertyRequires))
                        {
                            componentInfo.requires = {
                                value: parseRequires(propertyRequires),
                                start: propertyRequires.loc!.start,
                                end: propertyRequires.loc!.end,
                            };
                            logProperties("requires", componentInfo.requires?.value);
                        }

                        if (isObjectProperty(propertyAlias))
                        {
                            const widgets = parseClassDefProperties(propertyAlias);
                            componentInfo.widgets.push(...widgets[0]); // xtype array
                            componentInfo.widgets.push(...widgets[1]); // alias array
                            componentInfo.aliases.push(...widgets[1]); // alias array
                        }

                        if (isObjectProperty(propertyXtype))
                        {
                            componentInfo.widgets.push(...parseClassDefProperties(propertyXtype)[0]);
                        }

                        logProperties("aliases", componentInfo.aliases);
                        logProperties("widgets", componentInfo.widgets);

                        if (isObjectProperty(propertyConfig))
                        {
                            componentInfo.configs.push(...parseConfig(propertyConfig));
                        }
                        logProperties("configs", componentInfo.configs);

                        if (isObjectProperty(propertyPrivates))
                        {
                            componentInfo.privates.push(...parseConfig(propertyPrivates));
                        }
                        logProperties("privates", componentInfo.privates);

                        if (isObjectProperty(propertyStatics))
                        {
                            componentInfo.privates.push(...parseConfig(propertyStatics));
                        }
                        logProperties("statics", componentInfo.statics);

                        if (propertyProperty && propertyProperty.length)
                        {
                            componentInfo.properties.push(...parseProperties(propertyProperty as ObjectProperty[]));
                        }
                        logProperties("properties", componentInfo.properties);

                        if (propertyMethod && propertyMethod.length)
                        {
                            componentInfo.methods.push(...parseMethods(propertyMethod as ObjectProperty[], !isFramework ? text : undefined));
                        }
                        logProperties("methods", componentInfo.methods);

                        if (componentInfo.xtypes)
                        {
                            componentInfo.xtypes.push(...parseXTypes(args[1], text));
                        }
                        logProperties("xtypes", componentInfo.xtypes);
                    }

                    log.logMethodDone("parse extjs file", 1, "", true);
                }
            }
        }
    });

    return components;
}


function getComments(comments: readonly Comment[] | null)
{
    let commentsStr = "";
    comments?.forEach((c) => {
        commentsStr += c.value;
    });
    return commentsStr;
}


function getSince(doc?: string)
{
    let since: string | undefined;
    if (doc?.includes("@since"))
    {
        const matches = doc.match(/@since (v*[\d\.]{2,10})/i);
        if (matches && matches[1])
        {
            since = matches[1];
        }
    }
    return since;
}


function getMethodAst(objEx: ObjectProperty, methodName: string, text: string | undefined)
{
    if (!text) {
        return undefined;
    }

    let subText = text.substring(objEx.start!, objEx.end!);
    const propertyName = isIdentifier(objEx.key) ? objEx.key.name : undefined;

    if (!propertyName || !subText) {
        return undefined;
    }

    //
    // Convert json style function definition to javascript function prototype for babel parse
    //
    //     testFn: function(a, b, c) { ... }
    //         to:
    //     function testFn(a, b, c) { ... }
    //
    subText = subText.replace(new RegExp(`${propertyName}\\s*:\\s*function\\s*\\(`), `function ${propertyName} (`);

    try{
        return parse(subText);
    }
    catch (e) {
        log.logError(["failed to parse variables for method " + methodName, e.toString()]);
    }
}


function isDocObject(object: any): object is (IMethod | IProperty | IConfig)
{
    return "doc" in object;
}


function logProperties(property: string, properties: (IMethod | IProperty | IConfig | IXtype | string)[] | undefined)
{
    if (properties)
    {
        log.logValue("   # of " + property + " found", properties.length, 2);
        properties.forEach((p) =>
        {
            if (typeof p === "string")
            {
                log.log("      " + p, 3);
            }
            else if (p !== undefined)
            {
                log.log("      " + p.name, 3);
                if (isDocObject(p) && p.doc) {
                    log.log(p.doc.replace(/\n/g, "<br>"), 5);
                }
            }
        });
    }
}


function parseClassDefProperties(propertyNode: ObjectProperty): string[][]
{
    const xtypes: string[] = [];
    const aliases: string[] = [];
    const aliasNodes: StringLiteral[] = [];

    if (isStringLiteral(propertyNode.value)) {
        aliasNodes.push(propertyNode.value);
    }

    if (isArrayExpression(propertyNode.value))
    {
        propertyNode.value.elements.forEach(it => {
            if (isStringLiteral(it)) {
                aliasNodes.push(it);
            }
        });
    }

    aliasNodes.forEach(it =>
    {
        const propertyValue = it.value;
        const propertyName = isIdentifier(propertyNode.key) ? propertyNode.key.name : undefined;
        switch (propertyName)
        {
            case "xtype":
                xtypes.push(propertyValue);
                break;
            case "alias":
            case "alternateClassName":
                const m = propertyValue.match(/(.+)\.(.+)/);
                if (m) {
                    const [_, namespace, name] = m;
                    switch (namespace) {
                        case "widget":
                            xtypes.push(name);
                            break;
                        default:
                            break;
                    }
                }
                else {
                    aliases.push(propertyValue);
                }
                break;
            default:
                break;
        }
    });

    return [ xtypes, aliases ];
}


function parseConfig(propertyConfig: ObjectProperty)
{
    const requires: IConfig[] = [];
    if (isObjectExpression(propertyConfig.value))
    {
        propertyConfig.value.properties.reduce<IConfig[]>((p, it) =>
        {
            if (it?.type === "ObjectProperty") {
                const name = isIdentifier(it.key) ? it.key.name : undefined;
                if (name)
                {
                    const doc = getComments(it.leadingComments);
                    p.push({
                        doc, name,
                        since: getSince(doc),
                        private: doc?.includes("@private"),
                        deprecated: doc?.includes("@deprecated"),
                        start: it.loc!.start,
                        end: it.loc!.end,
                        getter: "get" + utils.properCase(name),
                        setter: "set" + utils.properCase(name)
                    });
                }
            }
            return p;
        }, requires);
    }
    return requires;
}


function parseExtend(propertyExtend: ObjectProperty): string | undefined
{
    if (isStringLiteral(propertyExtend.value))
    {
        return propertyExtend.value.value;
    }
}


function parseMethods(propertyMethods: ObjectProperty[], text: string | undefined): IMethod[]
{
    const methods: IMethod[] = [];
    for (const m of propertyMethods)
    {
        if (isFunctionExpression(m.value))
        {
            const propertyName = isIdentifier(m.key) ? m.key.name : undefined;
            if (propertyName)
            {
                const doc = getComments(m.leadingComments),
                      params = parseParams(m, propertyName, text);
                if (doc && params.length)
                {
                    for (const p of params)
                    {
                        const paramDoc = doc.match(new RegExp(`@param\\s*(\\{\\w+\\})*\\s*${p.name}[^\\r\\n]*`));
                        if (paramDoc)
                        {
                            p.doc = paramDoc[0].substring(paramDoc[0].indexOf(p.name) + p.name.length).trim();
                            if (paramDoc[1]) // captures type in for {Boolean}, {String}, etc
                            {
                                const type = paramDoc[1].replace(/[\{\}]/g, "").toLowerCase();
                                switch (type)
                                {
                                    case "bool":
                                    case "boolean":
                                        p.type = VariableType._boolean;
                                        break;
                                    case "int":
                                    case "number":
                                        p.type = VariableType._number;
                                        break;
                                    case "object":
                                        p.type = VariableType._object;
                                        break;
                                    case "string":
                                        p.type = VariableType._string;
                                        break;
                                    default:
                                        p.type = VariableType._any;
                                        break;
                                }
                            }
                        }
                    }
                }
                methods.push({
                    doc, params,
                    name: propertyName,
                    start: m.loc!.start,
                    end: m.loc!.end,
                    variables: parseVariables(m, propertyName, text),
                    since: getSince(doc),
                    private: doc?.includes("@private"),
                    deprecated: doc?.includes("@deprecated")
                });
            }
        }
    }
    return methods;
}


function parseProperties(propertyProperties: ObjectProperty[]): IProperty[]
{
    const properties: IProperty[] = [];
    propertyProperties.forEach((m) =>
    {
        if (!isFunctionExpression(m.value))
        {
            const name = isIdentifier(m.key) ? m.key.name : undefined;
            if (name && ignoreProperties.indexOf(name) === -1)
            {
                const doc = getComments(m.leadingComments);
                properties.push({
                    doc, name,
                    start: m.loc!.start,
                    end: m.loc!.end,
                    since: getSince(doc),
                    private: doc?.includes("@private"),
                    deprecated: doc?.includes("@deprecated")
                });
            }
        }
    });
    return properties;
}


function parseRequires(propertyRequires: ObjectProperty)
{
    const requires: string[] = [];
    if (isArrayExpression(propertyRequires.value))
    {
        propertyRequires.value.elements
            .reduce<string[]>((p, it) => {
            if (it?.type === "StringLiteral") {
                p.push(it.value);
            }
            return p;
        }, requires);
    }
    return requires;
}


function parseParams(objEx: ObjectProperty, methodName: string, text: string | undefined): IParameter[]
{
    const params: IParameter[] = [];
    if (!text || !methodName) {
        return params;
    }

    const ast = getMethodAst(objEx, methodName, text),
          node = ast?.program.body[0];

    if (isFunctionDeclaration(node))
    {
        const fnParams = node.params;
        for (const p of fnParams)
        {
            if (isIdentifier(p))
            {
                params.push({
                    name: p.name,
                    declaration: DeclarationType.var,
                    start: p.loc!.start,
                    end: p.loc!.end,
                    methodName
                });
            }
        }
    }

    return params;
}


function parseVariables(objEx: ObjectProperty, methodName: string, text: string | undefined): IVariable[]
{
    const variables: IVariable[] = [];
    if (!text || !methodName) {
        return variables;
    }

    const ast = getMethodAst(objEx, methodName, text);
    traverse(ast,
    {
        VariableDeclaration(path)
        {
            const node = path.node;

            if (!isVariableDeclaration(node) || !node.declarations || node.declarations.length === 0) {
                return;
            }

            const dec = node.declarations[0];

            if (!isVariableDeclarator(dec) || !isIdentifier(dec.id) || !isCallExpression(dec.init)) {
                return;
            }

            const varName = dec.id.name;
            const callee = dec.init.callee;
            const args = dec.init.arguments;
            let callerCls = "";

            if (isMemberExpression(callee))
            {
                if (!isIdentifier(callee.object))
                {   //
                    // Example:
                    //
                    //     VSCodeExtJS.common.PhysicianDropdown.create
                    //
                    // The current callee.property is 'create', type 'MemberExpression'.
                    //
                    // The current callee.object is 'PhysicianDropdown', type 'MemberExpression'.
                    //
                    // Build the fill class name by traversiong down each MemberExpression until the
                    // Identifier is found, in this example 'VSCodeExtJS'.
                    //
                    let object: any = callee.object;
                    if (isMemberExpression(object) && isIdentifier(object.property))
                    {
                        callerCls = object.property.name;
                        object = object.object;
                        while (isMemberExpression(object))
                        {
                            if (isIdentifier(object.property))
                            {
                                callerCls = object.property.name + "." + callerCls;
                                object = object.object;
                            }
                            else {
                                return;
                            }
                        }
                        //
                        // Add the base indetifier to caller cls name, e.g. "VSCodeExtJS" in the comments
                        // example.  We looped until we found it but it has not been added yet.
                        //
                        if (isIdentifier(object)) {
                            callerCls = object.name + "." + callerCls;
                        }
                    }
                    else {
                        return;
                    }
                }
                else {
                    callerCls = callee.object.name;
                }
            }

            if (!isMemberExpression(callee) || !isIdentifier(callee.property) || callee.property.name !== "create" || !callerCls)
            {
                // if (!isStringLiteral(args[0]) || args[0].value !== "this") {
                    return;
                // }
            }

            let value = "";
            const isFramework = callerCls === "Ext";

            if (isFramework || callerCls.startsWith("VSCodeExtJS"))
            {
                if (isFramework)
                {
                    if (!isStringLiteral(args[0])) {
                        return;
                    }
                    else {
                        value = args[0].value;
                    }
                }
                else {
                    value = callerCls;
                }
            }

            if (value)
            {
                log.logValue("added variable", varName, 5);
                log.logValue("   method", methodName, 5);
                log.logValue("   instance cls", value, 5);

                variables.push({
                    name: varName,
                    declaration: DeclarationType[node.kind],
                    start: node.declarations[0].loc!.start,
                    end: node.declarations[0].loc!.end,
                    componentClass: value,
                    methodName
                });
            }
        }
    });

    return variables;
}


function parseXTypes(objEx: ObjectExpression, text: string): IXtype[]
{
    const xType: IXtype[] = [];
    const line = objEx.loc!.start.line - 1;
    const column = objEx.loc!.start.column;

    //
    // Get the substring from the doc text, just the jso w/o the Ext.define() wrap so we can
    // get a Babel ObjectProperty
    //
    // For example, we want an object in the form to pass to parse():
    //
    //    {
    //        alias: "myalias",
    //        requires: [
    //            "MyApp.view.users.User"
    //        ],
    //        ....
    //    }
    //
    const subText = "a(" + text.substring(objEx.start!, objEx.end!) + ")";

    const _ast = parse(subText);
    traverse(_ast,
    {
        ObjectProperty(_path) {
            const _node = _path.node;
            const valueNode = _node.value;
            if (!isIdentifier(_node.key)) {
                return;
            }
            if (_node.key.name !== "xtype") {
                return;
            }
            if (!isStringLiteral(valueNode)) {
                return;
            }

            const start = valueNode.loc!.start;
            const end = valueNode.loc!.end;

            if (start.line === 1) {
                start.column += + column - 2;
            }
            if (end.line === 1) {
                end.column += + column - 2;
            }
            start.line += line;
            end.line += line;

            log.log("   push xtype " + valueNode.value, 3);

            xType.push({
                name: valueNode.value,
                start,
                end
            });
        }
    });

    return xType;
}
