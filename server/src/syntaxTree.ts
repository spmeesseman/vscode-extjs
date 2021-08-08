
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import * as log from "./log";
import {
    IComponent, IConfig, IMethod, IXtype, IProperty, IVariable,
    DeclarationType, IParameter, utils, VariableType, IRange, IRequire
} from "../../common";
import {
    isArrayExpression, isIdentifier, isObjectExpression, Comment, isObjectProperty, isExpressionStatement,
    isStringLiteral, ObjectProperty, StringLiteral, isFunctionExpression, ObjectExpression, isNewExpression,
    isVariableDeclaration, isVariableDeclarator, isCallExpression, isMemberExpression, isFunctionDeclaration,
    isThisExpression, isAwaitExpression, SourceLocation
} from "@babel/types";


const ignoreProperties = [
    "config", "items", "listeners", "requires", "privates", "statics"
];

export const componentClassToWidgetsMapping: { [componentClass: string]: string[] | undefined } = {};
export const widgetToComponentClassMapping: { [widget: string]: string | undefined } = {};



export async function loadExtJsComponent(ast: string | undefined)
{
    if (ast)
    {
        const components: IComponent[] = JSON.parse(ast);
        for (const c of components)
        {
            componentClassToWidgetsMapping[c.componentClass] = c.widgets;
            c.widgets.forEach((xtype: string) => {
                widgetToComponentClassMapping[xtype] = c.componentClass;
            });
        }
    }
}


export async function parseExtJsFile(fsPath: string, text: string, project?: string, isFramework?: boolean)
{
    let ast: any;

    try {
        ast = parse(text);
    }
    catch (ex) {
        log.error(ex.toString());
    }

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
                    log.methodStart("parse extjs file", 1, "", true, [["file", fsPath]]);

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

                        const dotIdx = args[0].value.indexOf("."),
                              baseNameSpace = dotIdx !== -1 ? args[0].value.substring(0, dotIdx) : args[0].value;

                        const componentInfo: IComponent = {
                            name: project || args[0].value,
                            baseNameSpace,
                            fsPath,
                            isFramework,
                            nameSpace: project || baseNameSpace,
                            componentClass: args[0].value,
                            xtypes: [],
                            aliases: [],
                            widgets: [],
                            methods: [],
                            objectRanges: [],
                            properties: [],
                            configs: [],
                            statics: [],
                            privates: [],
                            start: path.node.loc!.start,
                            end: path.node.loc!.end,
                            bodyStart: args[1].loc!.start,
                            bodyEnd: args[1].loc!.end
                        };

                        if (isExpressionStatement(path.container)) {
                            componentInfo.doc = getComments(path.container.leadingComments);
                            componentInfo.since = getSince(componentInfo.doc);
                            componentInfo.private = componentInfo.doc?.includes("@private");
                            componentInfo.deprecated = componentInfo.doc?.includes("@deprecated");
                        }

                        components.push(componentInfo);

                        log.blank(1);
                        log.value("   Component", args[0].value, 1);

                        const propertyRequires = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === "requires");
                        const propertyAlias = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === "alias");
                        const propertyAlternateCls = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === "alternateClassName");
                        const propertyXtype = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === "xtype");
                        const propertyConfig = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === "config");
                        const propertyStatics = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === "statics");
                        const propertyPrivates = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === "privates");
                        const propertyExtend = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === "extend");
                        const propertyMethod = args[1].properties.filter(p => isObjectProperty(p) && isIdentifier(p.key) && isFunctionExpression(p.value));
                        const propertyProperty = args[1].properties.filter(p => isObjectProperty(p) && isIdentifier(p.key) && !isFunctionExpression(p.value));
                        const propertyObjects = args[1].properties.filter(p => isObjectProperty(p) && !isFunctionExpression(p.value));

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
                        }

                        if (isObjectProperty(propertyAlternateCls))
                        {
                            const widgets = parseClassDefProperties(propertyAlternateCls);
                            componentInfo.widgets.push(...widgets[0]); // xtype array
                            componentInfo.widgets.push(...widgets[1]); // alias array
                        }

                        if (isObjectProperty(propertyXtype))
                        {
                            componentInfo.widgets.push(...parseClassDefProperties(propertyXtype)[0]);
                        }

                        logProperties("aliases", componentInfo.aliases);
                        logProperties("widgets", componentInfo.widgets);

                        if (isObjectProperty(propertyConfig))
                        {
                            componentInfo.configs.push(...parseConfig(propertyConfig, componentInfo.componentClass));
                        }
                        logProperties("configs", componentInfo.configs);

                        if (isObjectProperty(propertyPrivates))
                        {
                            componentInfo.privates.push(...parseConfig(propertyPrivates, componentInfo.componentClass));
                        }
                        logProperties("privates", componentInfo.privates);

                        if (isObjectProperty(propertyStatics))
                        {
                            componentInfo.privates.push(...parseConfig(propertyStatics, componentInfo.componentClass));
                        }
                        logProperties("statics", componentInfo.statics);

                        if (propertyProperty && propertyProperty.length)
                        {
                            componentInfo.properties.push(...parseProperties(propertyProperty as ObjectProperty[], componentInfo.componentClass));
                        }
                        logProperties("properties", componentInfo.properties);

                        if (propertyObjects && propertyObjects.length)
                        {
                            propertyObjects.forEach((o) => {
                                componentInfo.objectRanges.push({
                                    start: o.loc!.start,
                                    end: o.loc!.end
                                });
                            });
                        }

                        if (propertyMethod && propertyMethod.length)
                        {
                            componentInfo.methods.push(...parseMethods(propertyMethod as ObjectProperty[], !isFramework ? text : undefined, componentInfo.componentClass));
                        }
                        logProperties("methods", componentInfo.methods);

                        componentInfo.xtypes.push(...parseXTypes(args[1], text, componentInfo.componentClass));
                        logProperties("xtypes", componentInfo.xtypes);

                        componentInfo.aliases.push(...parseXTypes(args[1], text, componentInfo.componentClass, "alias"));
                        logProperties("aliases", componentInfo.aliases);
                    }

                    log.methodDone("parse extjs file", 1, "", true);
                }
            }
        }
    });

    for (const c of components)
    {
        componentClassToWidgetsMapping[c.componentClass] = c.widgets;
        c.widgets.forEach((xtype: string) => {
            widgetToComponentClassMapping[xtype] = c.componentClass;
        });
    }

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


function getReturns(doc?: string)
{
    let returns: string | undefined;
    if (doc?.includes("@return"))
    {
        const matches = doc.match(/@return[s](.+)/i);
        if (matches && matches[1])
        {
            returns = matches[1];
        }
    }
    return returns?.trim();
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
    if (since)
    {
        if (since[0] !== "v") {
            since = "v" + since;
        }
    }
    return since?.toLowerCase();
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
        log.error(["failed to parse variables for method " + methodName, e.toString()]);
    }
}


function isDocObject(object: any): object is (IMethod | IProperty | IConfig)
{
    return "doc" in object;
}


function logProperties(property: string, properties: (IMethod | IProperty | IConfig | IXtype | IRequire | string)[] | undefined)
{
    if (properties)
    {
        log.value("   # of " + property + " found", properties.length, 2);
        properties.forEach((p) =>
        {
            if (typeof p === "string")
            {
                log.write("      " + p, 3);
            }
            else if (p !== undefined)
            {
                log.write("      " + p.name, 3);
                if (isDocObject(p) && p.doc) {
                    log.write(p.doc.replace(/\n/g, "<br>"), 5);
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


function parseConfig(propertyConfig: ObjectProperty, componentClass: string)
{
    const configs: IConfig[] = [];
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
                        getter: "get" + utils.toProperCase(name),
                        setter: "set" + utils.toProperCase(name),
                        componentClass
                    });
                }
            }
            return p;
        }, configs);
    }
    return configs;
}


function parseExtend(propertyExtend: ObjectProperty): string | undefined
{
    if (isStringLiteral(propertyExtend.value))
    {
        return propertyExtend.value.value;
    }
}


function getObjectRanges(m: ObjectProperty): IRange[]
{
    const objectRanges: IRange[] = [];

    if (isFunctionExpression(m.value))
    {
        const propertyObjects = m.value.body.body.filter(p => isExpressionStatement(p) || isVariableDeclaration(p));
        if (propertyObjects && propertyObjects.length)
        {
            propertyObjects.forEach((o) =>
            {
                if (isVariableDeclaration(o))
                {
                    for (const d of o.declarations)
                    {
                        if (isCallExpression(d.init) || isNewExpression(d.init))
                        {
                            for (const a of d.init.arguments)
                            {
                                if (isObjectExpression(a))
                                {
                                    objectRanges.push({
                                        start: a.loc!.start,
                                        end: a.loc!.end
                                    });
                                }
                            }
                        }
                        // TODO - 'Await' expression
                    }
                }
                else if (isExpressionStatement(o) && isCallExpression(o.expression))
                {
                    for (const a of o.expression.arguments)
                    {
                        if (isObjectExpression(a))
                        {
                            objectRanges.push({
                                start: a.loc!.start,
                                end: a.loc!.end
                            });
                        }
                    }
                }
            });
        }
    }

    return objectRanges;
}


function parseMethods(propertyMethods: ObjectProperty[], text: string | undefined, componentClass: string): IMethod[]
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
                      params = parseParams(m, propertyName, text, componentClass, doc);
                methods.push({
                    componentClass, doc, params,
                    name: propertyName,
                    start: m.loc!.start,
                    end: m.loc!.end,
                    variables: parseVariables(m, propertyName, text, componentClass, (m.value.loc?.start.line || 1) - 1),
                    returns: getReturns(doc),
                    since: getSince(doc),
                    private: doc?.includes("@private"),
                    deprecated: doc?.includes("@deprecated"),
                    objectRanges: getObjectRanges(m),
                    bodyStart: m.value.loc!.start,
                    bodyEnd: m.value.loc!.end
                });
            }
        }
    }
    return methods;
}


function parseProperties(propertyProperties: ObjectProperty[], componentClass: string): IProperty[]
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
                    deprecated: doc?.includes("@deprecated"),
                    componentClass
                });
            }
        }
    });
    return properties;
}


function parseRequires(propertyRequires: ObjectProperty)
{
    const requires: IRequire[] = [];
    if (isArrayExpression(propertyRequires.value))
    {
        propertyRequires.value.elements
            .reduce<IRequire[]>((p, it) => {
            if (it?.type === "StringLiteral") {
                p.push({
                    name: it.value,
                    start: it.loc?.start,
                    end: it.loc?.end
                });
            }
            return p;
        }, requires);
    }
    return requires;
}


function parseParams(objEx: ObjectProperty, methodName: string, text: string | undefined, parentCls: string, doc: string): IParameter[]
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
                    methodName,
                    componentClass: parentCls
                });
            }
        }
    }

    //
    // Look into the method comments, see if we can extract type information about the parameters
    //
    if (doc && params.length)
    {
        for (const p of params)
        {
            const paramDoc = doc.match(new RegExp(`@param\\s*(\\{[\\w\\.]+\\})*\\s*${p.name}[^\\r\\n]*`));
            if (paramDoc)
            {
                // p.doc = "@param " + paramDoc[0].substring(paramDoc[0].indexOf(p.name) + p.name.length).trim();
                p.doc = paramDoc[0].trim();
                if (paramDoc[1]) // captures type in for {Boolean}, {String}, etc
                {
                    p.componentClass = paramDoc[1].replace(/[\{\}]/g, "");
                    switch (p.componentClass.toLowerCase())
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
                            if (p.componentClass === "*") {
                                p.componentClass = "any";
                                p.type = VariableType._any;
                            }
                            else {
                                p.type = VariableType._class;
                            }
                            break;
                    }
                }
            }
        }
    }

    return params;
}


function parseVariables(objEx: ObjectProperty, methodName: string, text: string | undefined, parentCls: string, lineOffset: number): IVariable[]
{
    const variables: IVariable[] = [];
    if (!text || !methodName) {
        return variables;
    }

    const _add = ((v: IVariable) =>
    {
        log.value("added variable", v.name, 5);
        log.value("   method", v.methodName, 5);
        log.value("   instance cls", v.componentClass, 5);
        const start = v.start, end = v.end;
        start.line += lineOffset;
        end.line += lineOffset;
        variables.push(v);
    });

    const ast = getMethodAst(objEx, methodName, text);
    traverse(ast,
    {
        VariableDeclaration(path)
        {
            const node = path.node;

            if (!isVariableDeclaration(node) || !node.declarations || node.declarations.length === 0) {
                return;
            }

            for (const dec of node.declarations)
            {
                if (!isVariableDeclarator(dec) || !isIdentifier(dec.id)) {
                    return;
                }

                const varName = dec.id.name;
                let isNewExp = false,
                    callee,
                    args,
                    callerCls = "";

                if (isNewExpression(dec.init))
                {
                    callee = dec.init.callee;
                    args = dec.init.arguments;
                    isNewExp = true;
                }
                else if (isCallExpression(dec.init))
                {
                    callee = dec.init.callee;
                    args = dec.init.arguments;
                }
                else if (isThisExpression(dec.init))
                {
                    _add({
                        name: varName,
                        declaration: DeclarationType[node.kind],
                        start: node.declarations[0].loc!.start,
                        end: node.declarations[0].loc!.end,
                        componentClass: parentCls,
                        methodName
                    });
                    continue;
                }
                else if (isAwaitExpression(dec.init))
                {
                    // TODO !!
                    continue;
                }
                else {
                    continue;
                }

                //
                // Member expression example:
                //
                //     VSCodeExtJS.common.PhysicianDropdown.create
                //
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
                        // Build the fill class name by traversing down each MemberExpression until the
                        // Identifier is found, in this example 'VSCodeExtJS'.
                        //
                        let object: any = callee.object;
                        if (isMemberExpression(object) && isIdentifier(object.property))
                        {
                            let foundObj = true;
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
                                    foundObj = false;
                                    break;
                                }
                            }
                            if (!foundObj) {
                                continue;
                            }
                            //
                            // Add the base identifier to caller cls name, e.g. "VSCodeExtJS" in the comments
                            // example.  We looped until we found it but it has not been added yet.
                            //
                            if (isIdentifier(object)) {
                                callerCls = object.name + "." + callerCls;
                            }
                        }
                        else if (isThisExpression(object))
                        {
                            callerCls = "this";
                        }
                        else {
                            continue;
                        }
                    }
                    else {
                        callerCls = callee.object.name;
                    }
                }

                //
                // Filter unsupported properties
                //
                if (!isMemberExpression(callee) || !isIdentifier(callee.property) || !callerCls)
                {
                    continue;
                }

                //
                // Get instance component class
                //
                let instCls = "Primitive";
                const isFramework = callerCls === "Ext";
                if (isFramework)
                {
                    if (!isStringLiteral(args[0])) {
                        continue;
                    }
                    else {
                        instCls = args[0].value;
                    }
                }
                else {
                    instCls = callerCls;
                }
                //
                // In the case of "new" keyword, the callee property is the last part of the class name.
                // Whereas other scenario is "full_classname".create, where "create" is the callee property.
                //
                if (isNewExp)
                {
                    instCls += ("." + callee.property.name);
                }

                //
                // Add thr variable to the component's IVariables array
                //
                _add({
                    name: varName,
                    declaration: DeclarationType[node.kind],
                    start: node.declarations[0].loc!.start,
                    end: node.declarations[0].loc!.end,
                    componentClass: instCls,
                    methodName
                });
            }
        }
    });

    return variables;
}


function parseXTypes(objEx: ObjectExpression, text: string, componentClass: string, nodeName = "xtype"): IXtype[]
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
    //        alias: "myAlias",
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
        ObjectProperty(_path)
        {
            const _node = _path.node;
            const valueNode = _node.value;

            if (!isIdentifier(_node.key)) {
                return;
            }

            if (_node.key.name !== nodeName) {
                return;
            }

            if (!isStringLiteral(valueNode) && !isArrayExpression(valueNode)) {
                return;
            }

            const _add = ((v: StringLiteral) =>
            {
                const start = v.loc!.start;
                const end = v.loc!.end;

                if (start.line === 1) {
                    start.column += + column - 2;
                }
                if (end.line === 1) {
                    end.column += + column - 2;
                }
                start.line += line;
                end.line += line;

                log.write("   push xtype " + v.value, 3);

                xType.push({
                    name: v.value,
                    start,
                    end,
                    componentClass
                });
            });

            if (isStringLiteral(valueNode)) {
                _add(valueNode);
            }
            else
            {
                valueNode.elements.forEach(it => {
                    if (isStringLiteral(it)) {
                        _add(it);
                    }
                });
            }
        }
    });

    return xType;
}
