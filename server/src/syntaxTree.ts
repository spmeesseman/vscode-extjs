
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import * as log from "./log";
import { parseDoc } from "./lib/commentParser";
import {
    ast, IComponent, IConfig, IMethod, IXtype, IProperty, IVariable,
    DeclarationType, IParameter, utils, VariableType, IRequire, IAlias, IObjectRange, IWidget, IType, IMixin, IAlternateClassName, IServerRequest, IJsDoc
} from "../../common";
import {
    isArrayExpression, isIdentifier, isObjectExpression, Comment, isObjectProperty, isExpressionStatement,
    isStringLiteral, ObjectProperty, StringLiteral, isFunctionExpression, ObjectExpression, isNewExpression,
    isVariableDeclaration, isVariableDeclarator, isCallExpression, isMemberExpression, isFunctionDeclaration,
    isThisExpression, isAwaitExpression, SourceLocation, Node, isAssignmentExpression, VariableDeclaration,
    VariableDeclarator, variableDeclarator, variableDeclaration, isBooleanLiteral, ObjectMethod, SpreadElement, isObjectMethod, isSpreadElement, ArrayExpression, Expression, isExpression, isLiteral, isNullLiteral, isRegExpLiteral, isRegexLiteral
} from "@babel/types";

/**
 * Possible object properties that shouldn't be parsed as normal properties
 */
const ignoreProperties = [
    "config", "requires", "privates", "statics", "uses"
];

export const components: IComponent[] = [];


export async function loadExtJsComponent(ast: string | undefined)
{
    if (ast) {
        cacheComponents(JSON.parse(ast));
    }
}


export async function parseExtJsFile(options: IServerRequest)
{
    const fsPath = options.fsPath,
          project = options.project,
          nameSpace = options.nameSpace,
          parsedComponents: IComponent[] = [],
          nodeAst = ast.getComponentsAst(options.text,  options.edits, log.error);

    if (!nodeAst || !nodeAst.ast || !nodeAst.text) {
        return parsedComponents;
    }

    const text = nodeAst.text;

    //
    // Construct our syntax tree to be able to serve the goods
    //
    traverse(nodeAst.ast,
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
                    log.methodStart("parse extjs file", 1, "", true, [["file", fsPath], ["project", project], ["nameSpace", nameSpace]]);

                    //
                    // Ext.define should be in the form:
                    //
                    //     Ext.define('MyApp.view.users.User', { ... });
                    //
                    // Check to make sure the callee args are a string for param 1 and an object for param 2
                    //
                    if (isStringLiteral(args[0]) && isObjectExpression(args[1]))
                    {
                        const dotIdx = args[0].value.indexOf("."),
                              baseNameSpace = dotIdx !== -1 ? args[0].value.substring(0, dotIdx) : args[0].value;

                        const componentInfo: IComponent = {
                            name: args[0].value,
                            baseNameSpace,
                            fsPath,
                            project,
                            nameSpace,
                            componentClass: args[0].value,
                            aliases: [],
                            configs: [],
                            methods: [],
                            objectRanges: [],
                            properties: [],
                            privates: [],
                            singleton: false,
                            start: path.node.loc!.start,
                            statics: [],
                            types: [],
                            end: path.node.loc!.end,
                            bodyStart: args[1].loc!.start,
                            bodyEnd: args[1].loc!.end,
                            widgets: [],
                            xtypes: [],
                            range: utils.toRange(path.node.loc!.start, path.node.loc!.end)
                        };

                        if (isExpressionStatement(path.container)) {
                            componentInfo.doc = getJsDoc(args[0].value, args[0].value, path.container.leadingComments);
                            componentInfo.since = componentInfo.doc?.since;
                            componentInfo.private = componentInfo.doc?.private;
                            componentInfo.deprecated = componentInfo.doc?.deprecated;
                        }

                        parsedComponents.push(componentInfo);

                        log.blank(1);
                        log.value("   Component", args[0].value, 1);

                        const propertyRequires = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === "requires");
                        const propertyUses = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === "uses");
                        const propertyAlias = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === "alias");
                        const propertyAlternateCls = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === "alternateClassName");
                        const propertyXtype = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === "xtype");
                        const propertyType = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === "type");
                        const propertyConfig = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === "config");
                        const propertyStatics = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === "statics");
                        const propertyPrivates = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === "privates");
                        const propertyExtend = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === "extend");
                        const propertyMixins = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === "mixins");
                        const propertySingleton = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === "singleton");
                        const propertyMethod = args[1].properties.filter(p => isObjectProperty(p) && isIdentifier(p.key) && isFunctionExpression(p.value));
                        const propertyProperty = args[1].properties.filter(p => isObjectProperty(p) && isIdentifier(p.key) && !isFunctionExpression(p.value));
                        const propertyObjects = args[1].properties.filter(p => isObjectProperty(p) && !isFunctionExpression(p.value));

                        if (isObjectProperty(propertyExtend))
                        {
                            componentInfo.extend = parseStringLiteral(propertyExtend);
                            if (componentInfo.extend) {
                                logProperties("extend", [ componentInfo.extend ]);
                            }
                        }

                        if (isObjectProperty(propertySingleton))
                        {
                            componentInfo.singleton = parseBooleanLiteral(propertySingleton);
                            if (componentInfo.singleton) {
                                logProperties("singleton", [ componentInfo.singleton.toString() ]);
                            }
                        }

                        if (isObjectProperty(propertyRequires))
                        {
                            componentInfo.requires = {
                                value: parseStringArray(propertyRequires),
                                start: propertyRequires.loc!.start,
                                end: propertyRequires.loc!.end,
                            };
                            logProperties("requires", componentInfo.requires?.value);
                        }

                        if (isObjectProperty(propertyUses))
                        {
                            componentInfo.uses = {
                                value: parseStringArray(propertyUses),
                                start: propertyUses.loc!.start,
                                end: propertyUses.loc!.end,
                            };
                            logProperties("uses", componentInfo.uses?.value);
                        }

                        if (isObjectProperty(propertyMixins))
                        {
                            componentInfo.mixins = {
                                value: parseMixins(propertyMixins),
                                start: propertyMixins.loc!.start,
                                end: propertyMixins.loc!.end,
                            };
                            logProperties("mixins", componentInfo.mixins?.value);
                        }

                        if (isObjectProperty(propertyAlias))
                        {
                            componentInfo.aliases.push(...parseClassDefProperties(propertyAlias, componentInfo.componentClass)[1] as IAlias[]);
                            logProperties("aliases", componentInfo.aliases);
                        }

                        if (isObjectProperty(propertyXtype))
                        {
                            componentInfo.xtypes.push(...parseClassDefProperties(propertyXtype, componentInfo.componentClass)[0] as IXtype[]);
                            logProperties("xtypes", componentInfo.xtypes);
                        }

                        if (isObjectProperty(propertyAlternateCls))
                        {
                            componentInfo.aliases.push(...parseClassDefProperties(propertyAlternateCls, componentInfo.componentClass)[1] as IAlias[]);
                            logProperties("aliases (w/ alternateCls)", componentInfo.aliases);
                        }

                        if (isObjectProperty(propertyType))
                        {
                            componentInfo.types.push(...parseClassDefProperties(propertyType, componentInfo.componentClass)[2] as IType[]);
                            logProperties("types", componentInfo.types);
                        }

                        if (isObjectProperty(propertyConfig))
                        {
                            componentInfo.configs.push(...parseConfig(propertyConfig, componentInfo.componentClass, nameSpace));
                        }
                        logProperties("configs", componentInfo.configs);

                        if (isObjectProperty(propertyPrivates))
                        {
                            componentInfo.privates.push(...parsePropertyBlock(propertyPrivates, componentInfo.componentClass, nameSpace, false, true, text, fsPath));
                        }
                        logProperties("privates", componentInfo.privates);

                        if (isObjectProperty(propertyStatics))
                        {
                            componentInfo.statics.push(...parsePropertyBlock(propertyStatics, componentInfo.componentClass, nameSpace, true, false, text, fsPath));
                        }
                        logProperties("statics", componentInfo.statics);

                        if (propertyProperty && propertyProperty.length)
                        {
                            componentInfo.properties.push(...parseProperties(propertyProperty as ObjectProperty[], componentInfo.componentClass, nameSpace, false, false));
                        }
                        logProperties("properties", componentInfo.properties);

                        if (propertyObjects && propertyObjects.length)
                        {
                            componentInfo.objectRanges.push(...parseObjectRanges(propertyObjects));
                        }

                        if (propertyMethod && propertyMethod.length)
                        {
                            componentInfo.methods.push(...parseMethods(propertyMethod as ObjectProperty[], text, componentInfo.componentClass, false, false, fsPath));
                            componentInfo.methods.forEach((m) => {
                                // componentInfo.objectRanges.push({ start: m.bodyStart, end: m.bodyEnd, type: "ObjectExpression" });
                                componentInfo.objectRanges.push(...m.objectRanges);
                            });
                        }
                        logProperties("methods", componentInfo.methods);

                        //
                        // Type/xtype/model widget definitions
                        //
                        componentInfo.widgets.push(...parseWidgets(args[1], text, componentInfo, "xtype").filter((x) => {
                            for (const x2 of componentInfo.xtypes) {
                                if (x.name === x2.name) {
                                    return false;
                                }
                            }
                            return true;
                        }));

                        componentInfo.widgets.push(...parseWidgets(args[1], text, componentInfo, "type").filter((x) => {
                            for (const x2 of componentInfo.xtypes) {
                                if (x.name === x2.name) {
                                    return false;
                                }
                            }
                            return true;
                        }));
                    }

                    log.methodDone("parse extjs file", 1, "", true);
                }
            }
        }
    });

    cacheComponents(parsedComponents);

    return parsedComponents;
}


function cacheComponents(componentsToCache: IComponent[])
{
    for (const c of componentsToCache)
    {
        const idx = components.findIndex((cc) => cc.componentClass === c.componentClass && c.project === cc.project);
        if (idx >= 0) {
            components.splice(idx, 1, c);
        }
        else {
            components.push(c);
        }
    }
}


function getJsDoc(property: string, componentClass: string, comments: readonly Comment[] | null)
{
    let commentsStr = "";
    comments?.forEach((c) => {
        commentsStr += c.value;
    });
    return commentsStr ? parseDoc(property, componentClass, commentsStr, "   ") : undefined;
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
    let matches;
    const regex = new RegExp(`${propertyName}\\s*:\\s*( +async +)*\\s*function\\s*\\(`);
    if ((matches = regex.exec(subText)))
    {
        if (matches[1]) {
            subText = subText.replace(matches[0], `${matches[1].trim()} function ${propertyName} (`);
        }
        else {
            subText = subText.replace(matches[0], `function ${propertyName} (`);
        }
    }

    try{
        return parse(subText);
    }
    catch (e) {
        log.error(["failed to parse variables for method " + methodName, e.toString()]);
    }
}


function getPropertyValue(opjProperty: ObjectProperty)
{
    let value: any;
    if (isStringLiteral(opjProperty.value)) {
        value = opjProperty.value.value;
    }
    else {
        try {
            if (isExpression(opjProperty.value)) {
                value = ast.jsAstToLiteralObject(opjProperty.value);
            }
        }
        catch (e) {
            console.log(e);
        }
    }
    return value;
}


function isJsDocObject(object: any): object is (IMethod | IProperty | IConfig)
{
    return "doc" in object;
}


function logProperties(property: string, properties: (IMethod | IProperty | IConfig | IXtype | IRequire | IAlias | IXtype | IWidget | string)[] | undefined)
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
                if (isJsDocObject(p) && p.doc) {
                    log.write(p.doc.body.replace(/\n/g, "<br>"), 5);
                }
            }
        });
    }
}


function parseClassDefProperties(propertyNode: ObjectProperty, componentClass: string): (IXtype | IAlias | IAlternateClassName | IType)[][]
{
    const xtypes: IXtype[] = [];
    const aliases: (IAlias|IAlternateClassName)[] = [];
    const types: IType[] = [];
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
                xtypes.push({
                    name: propertyValue,
                    start: it.loc!.start,
                    end: it.loc!.end,
                    componentClass,
                    type: propertyName,
                    parentProperty: "",
                    range: utils.toRange(it.loc!.start, it.loc!.end)
                });
                break;
            case "type":
                types.push({
                    name: propertyValue,
                    start: it.loc!.start,
                    end: it.loc!.end,
                    componentClass,
                    type: propertyName,
                    parentProperty: "",
                    range: utils.toRange(it.loc!.start, it.loc!.end)
                });
                break;
            case "alias":
            case "alternateClassName":
                const m = propertyValue.match(/(.+)\.(.+)/);
                if (m) {
                    const [_, nameSpace, name] = m;
                    if (nameSpace === "widget")
                    {
                        xtypes.push({
                            name,
                            start: it.loc!.start,
                            end: it.loc!.end,
                            componentClass,
                            type: "xtype",
                            parentProperty: "",
                            range: utils.toRange(it.loc!.start, it.loc!.end)
                        });
                    }
                    aliases.push({
                        name: propertyValue,
                        start: it.loc!.start,
                        end: it.loc!.end,
                        componentClass,
                        type: propertyName,
                        nameSpace,
                        parentProperty: "",
                        range: utils.toRange(it.loc!.start, it.loc!.end)
                    });
                }
                else {
                    aliases.push({
                        name: propertyValue,
                        start: it.loc!.start,
                        end: it.loc!.end,
                        componentClass,
                        type: propertyName,
                        nameSpace: "",
                        parentProperty: "",
                        range: utils.toRange(it.loc!.start, it.loc!.end)
                    });
                }
                break;
            default:
                break;
        }
    });

    return [ xtypes, aliases, types ];
}


function parseConfig(propertyConfig: ObjectProperty, componentClass: string, nameSpace: string)
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
                    const doc = getJsDoc(name, componentClass, it.leadingComments);
                    p.push({
                        doc, name,
                        since: doc?.since,
                        private: doc?.private || false,
                        deprecated: doc?.deprecated || false,
                        start: it.loc!.start,
                        end: it.loc!.end,
                        getter: "get" + utils.toProperCase(name),
                        setter: "set" + utils.toProperCase(name),
                        componentClass,
                        range: utils.toRange(it.loc!.start, it.loc!.end),
                        value: {
                            start: it.value.loc!.start,
                            end: it.value.loc!.end,
                            value: getPropertyValue(it)
                        }
                    });
                }
            }
            return p;
        }, configs);
    }
    return configs;
}


function parseStringLiteral(property: ObjectProperty): string | undefined
{
    if (isStringLiteral(property.value))
    {
        return property.value.value;
    }
}


function parseBooleanLiteral(property: ObjectProperty): boolean
{
    if (isBooleanLiteral(property.value))
    {
        return property.value.value;
    }
    return false;
}


function getMethodObjectRanges(m: ObjectProperty, methodName: string): IObjectRange[]
{
    const objectRanges: IObjectRange[] = [];

    if (isFunctionExpression(m.value))
    {
        const propertyObjects = m.value.body.body.filter(p => isExpressionStatement(p) || isVariableDeclaration(p) || isAssignmentExpression(p));
        if (propertyObjects && propertyObjects.length)
        {

            const pushRanges = (args: any) =>
            {
                for (const a of args)
                {
                    if (isObjectExpression(a))
                    {
                        objectRanges.push({
                            start: a.loc!.start,
                            end: a.loc!.end,
                            type: a.type,
                            name: methodName
                        });
                    }
                }
            };

            propertyObjects.forEach((o) =>
            {
                if (isVariableDeclaration(o))
                {
                    for (const d of o.declarations)
                    {
                        if (isCallExpression(d.init) || isNewExpression(d.init))
                        {
                            pushRanges(d.init.arguments);
                        }
                        if (isAwaitExpression(d.init))
                        {
                            if (isCallExpression(d.init.argument))
                            {
                                pushRanges(d.init.argument.arguments);
                            }
                            else {
                                log.error("Unhandled Object Range: unexpected await syntax", [["method name", methodName]]);
                            }
                        }
                    }
                }
                else if (isExpressionStatement(o))
                {
                    if (isCallExpression(o.expression)) {
                        pushRanges(o.expression.arguments);
                    }
                    else if (isAssignmentExpression(o.expression) && isCallExpression(o.expression.right)) {
                        pushRanges(o.expression.right.arguments);
                    }
                }
            });
        }
    }

    return objectRanges;
}


function parseObjectRanges(props: (ObjectMethod | ObjectProperty | SpreadElement)[]): IObjectRange[]
{
    const objectRanges: IObjectRange[] = [];

    const pushRanges = (props: (ObjectMethod | ObjectProperty | SpreadElement)[] | undefined) =>
    {
        props?.forEach((m) =>
        {
            if (isObjectProperty(m))
            {
                const name = isIdentifier(m.key) ? m.key.name : undefined;
                if (name && ignoreProperties.indexOf(name) === -1)
                {
                    if (isObjectExpression(m.value))
                    {
                        objectRanges.push({
                            start: m.loc!.start,
                            end: m.loc!.end,
                            type: m.type,
                            name
                        });
                        pushRanges(m.value.properties.filter(p => isObjectProperty(p) && !isFunctionExpression(p.value)));
                    }
                    else if (isArrayExpression(m.value))
                    {
                        for (const e of m.value.elements)
                        {
                            if (isObjectExpression(e))
                            {
                                objectRanges.push({
                                    start: e.loc!.start,
                                    end: e.loc!.end,
                                    type: e.type,
                                    name: undefined
                                });
                                pushRanges(e.properties.filter(p => isObjectProperty(p) && !isFunctionExpression(p.value)));
                            }
                        }
                    }
                }
            }
            else if (isObjectMethod(m) && isObjectExpression(m.body.body))
            {
                objectRanges.push({
                    start: m.loc!.start,
                    end: m.loc!.end,
                    type: m.type,
                    name: undefined
                });
            }
            else if (isSpreadElement(m))
            {
                if (isObjectExpression(m.argument))
                {
                    objectRanges.push({
                        start: m.loc!.start,
                        end: m.loc!.end,
                        type: m.type,
                        name: undefined
                    });
                }
                else if (isArrayExpression(m.argument))
                {
                    for (const e of m.argument.elements)
                    {
                        if (isObjectExpression(e))
                        {
                            objectRanges.push({
                                start: e.loc!.start,
                                end: e.loc!.end,
                                type: e.type,
                                name: undefined
                            });
                        }
                    }
                }
            }
        });
    };

    pushRanges(props);

    return objectRanges;
}



function getVariableType(cls: string): VariableType
{
    switch (cls)
    {
        case "arr":
        case "array":
            return VariableType._arr;
        case "bool":
        case "boolean":
            return VariableType._boolean;
        case "int":
        case "number":
            return VariableType._number;
        case "object":
            return VariableType._object;
        case "string":
            return VariableType._string;
        default:
            if (cls === "*") {
                cls = "any";
                return VariableType._any;
            }
    }
    return VariableType._class;
}


function parseMethods(propertyMethods: ObjectProperty[], text: string | undefined, componentClass: string, isStatic: boolean, isPrivate: boolean, fsPath: string): IMethod[]
{
    const methods: IMethod[] = [];

    //
    // We don't want to parse the framework method's parameters and variables, set
    // text to undefined if this is a framework file...
    //
    if (componentClass.startsWith("Ext.") &&  (fsPath.includes("@sencha") || fsPath.toLowerCase().includes("extjs"))) {
        text = undefined;
    }

    for (const m of propertyMethods)
    {
        if (isFunctionExpression(m.value))
        {
            const propertyName = isIdentifier(m.key) ? m.key.name : undefined;
            if (propertyName)
            {
                const doc = getJsDoc(propertyName, componentClass, m.leadingComments),
                      params = parseParams(m, propertyName, text, componentClass, doc),
                      variables = parseVariables(m, propertyName, text, componentClass, (m.value.loc?.start.line || 1) - 1, params);
                methods.push({
                    componentClass,
                    doc,
                    params,
                    name: propertyName,
                    start: m.loc!.start,
                    end: m.loc!.end,
                    variables,
                    returns: doc?.returns,
                    since: doc?.since,
                    private: doc?.private || isPrivate,
                    deprecated: doc?.deprecated || false,
                    objectRanges: getMethodObjectRanges(m, propertyName),
                    bodyStart: m.value.loc!.start,
                    bodyEnd: m.value.loc!.end,
                    static: doc?.static || isStatic,
                    range: utils.toRange(m.loc!.start, m.loc!.end),
                    value: undefined
                });
            }
        }
    }
    return methods;
}


function parseMixins(propertyMixins: ObjectProperty)
{
    const mixins: IMixin[] = [];
    if (isArrayExpression(propertyMixins.value))
    {
        mixins.push(...parseStringArray(propertyMixins));
    }
    else if (isObjectExpression(propertyMixins.value))
    {
        propertyMixins.value.properties.reduce<IMixin[]>((p, it) =>
        {
            if (it?.type === "ObjectProperty") {
                mixins.push(...parseStringArray(it));
            }
            return p;
        }, mixins);
    }
    return mixins;
}


function parseProperties(propertyProperties: ObjectProperty[], componentClass: string, nameSpace: string, isStatic: boolean, isPrivate: boolean): IProperty[]
{
    const properties: IProperty[] = [];
    propertyProperties.forEach((p) =>
    {
        if (!isFunctionExpression(p.value))
        {
            const name = isIdentifier(p.key) ? p.key.name : undefined;
            if (name && ignoreProperties.indexOf(name) === -1)
            {
                const doc = getJsDoc(name, componentClass, p.leadingComments);
                properties.push({
                    doc, name,
                    start: p.loc!.start,
                    end: p.loc!.end,
                    since: doc?.since,
                    private: doc?.private || isPrivate,
                    deprecated: doc?.deprecated || false,
                    componentClass,
                    static: doc?.static || isStatic,
                    range: utils.toRange(p.loc!.start, p.loc!.end),
                    value: {
                        start: p.value.loc!.start,
                        end: p.value.loc!.end,
                        value: getPropertyValue(p)
                    }
                });
            }
        }
    });
    return properties;
}


function parseStringArray(property: ObjectProperty)
{
    const values: IRequire[] = [];
    if (isArrayExpression(property.value))
    {
        property.value.elements
            .reduce<IRequire[]>((p, it) => {
            if (it?.type === "StringLiteral") {
                p.push({
                    name: it.value,
                    start: it.loc?.start || { line: 1, column: 0 },
                    end: it.loc?.end || { line: 1, column: 0 }
                });
            }
            return p;
        }, values);
    }
    return values;
}


function parseParams(objEx: ObjectProperty, methodName: string, text: string | undefined, parentCls: string, jsdoc: IJsDoc | undefined): IParameter[]
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
                    start: p.loc!.start,
                    end: p.loc!.end,
                    methodName,
                    componentClass: parentCls,
                    type: VariableType._any,
                    range: utils.toRange(p.loc!.start, p.loc!.end)
                });
            }
        }
    }

    if (jsdoc)
    {
        for (const p of params)
        {
            for (const docParam of jsdoc.params)
            {
                if (docParam.name === p.name)
                {
                    p.doc = docParam.body;
                    p.docTitle = docParam.title;
                    p.componentClass = docParam.type; // match[1].replace(/[\{\}]/g, "");
                    p.type = getVariableType(p.componentClass.toLowerCase());
                }
            }
        }
    }

    return params;
}


function parsePropertyBlock(staticsConfig: ObjectProperty, componentClass: string, nameSpace: string, isStatic: boolean, isPrivate: boolean, text: string | undefined, fsPath: string)
{
    const block: (IMethod| IProperty)[] = [];
    if (isObjectExpression(staticsConfig.value))
    {
        const propertyMethod = staticsConfig.value.properties.filter(p => isObjectProperty(p) && isIdentifier(p.key) && isFunctionExpression(p.value));
        const propertyProperty = staticsConfig.value.properties.filter(p => isObjectProperty(p) && isIdentifier(p.key) && !isFunctionExpression(p.value));

        block.push(...parseMethods(propertyMethod as ObjectProperty[], text, componentClass, isStatic, isPrivate, fsPath));
        block.push(...parseProperties(propertyProperty as ObjectProperty[], componentClass, nameSpace, isStatic, isPrivate));
    }
    return block;
}


function parseVariables(objEx: ObjectProperty, methodName: string, text: string | undefined, parentCls: string, lineOffset: number, params?: IParameter[]): IVariable[]
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
        ExpressionStatement(path)
        {   //
            // If a method parameter is reset, the intellisense should change
            // on this variable if editing below the reassignment.  Record the position
            // of the reassignment and the new variable type it has become
            //
            const node = path.node;
            if (!isAssignmentExpression(node.expression)) {
                return;
            }
            if (isIdentifier(node.expression.left))
            {
                if (isCallExpression(node.expression.right))
                {
                    try {
                        const declarator = variableDeclarator(node.expression.left, node.expression.right),
                              declaration = variableDeclaration("let", [ declarator ]);
                        declarator.loc = { ...node.expression.right.loc } as SourceLocation;
                        const variable = parseVariable(declaration, declarator, node.expression.left.name, methodName, parentCls);
                        if (variable) {
                            _add(variable);
                        }
                    }
                    catch (e) {
                        log.error(e);
                    }
                }
                if (params)
                {
                    for (const p of params)
                    {
                        if (p.name === node.expression.left.name) {
                            //
                            // TODO - parameter reassignment
                            //
                            // const variable = parseVariable(node.expression.r, dec, dec.id.name, methodName, dec.id.name);
                            // if (variable) {
                            //     _add(variable);
                            //     p.reassignments.push(variable);
                            // }
                        }
                    }
                }
            }
        },

        VariableDeclaration(path)
        {
            const node = path.node;

            if (!isVariableDeclaration(node) || !node.declarations || node.declarations.length === 0) {
                return;
            }
            //
            // If variables are comma separated then the # of declarations will be > 1
            //
            //     e.g.:
            //
            //         const me = this,
            //               view = me.getView();
            //
            for (const dec of node.declarations)
            {
                if (!isVariableDeclarator(dec) || !isIdentifier(dec.id)) {
                    return;
                }

                const variable = parseVariable(node, dec, dec.id.name, methodName, parentCls);
                if (variable) {
                    _add(variable);
                }
            }
        }
    });

    return variables;
}


function parseVariable(node: VariableDeclaration, dec: VariableDeclarator, varName: string, methodName: string, parentCls: string): IVariable | undefined
{
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
        return {
            name: varName,
            declaration: DeclarationType[node.kind],
            start: node.declarations[0].loc!.start,
            end: node.declarations[0].loc!.end,
            componentClass: parentCls,
            methodName,
            range: utils.toRange(node.declarations[0].loc!.start, node.declarations[0].loc!.end)
        };
    }
    else if (isAwaitExpression(dec.init))
    {
        if (isCallExpression(dec.init.argument)) {
            callee = dec.init.argument.callee;
            args = dec.init.argument.arguments;
        }
        else {
            log.error("Unhandled Variable: unexpected await syntax", [["method name", methodName]]);
            return;
        }
    }
    else {
        return;
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
                    return;
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
                return;
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
        return;
    }

    //
    // Get instance component class
    //
    let instCls = "Primitive";
    const isFramework = callerCls === "Ext";
    if (isFramework)
    {
        if (!isStringLiteral(args[0])) {
            return;
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
    return {
        name: varName,
        declaration: DeclarationType[node.kind],
        start: node.declarations[0].loc!.start,
        end: node.declarations[0].loc!.end,
        componentClass: instCls,
        methodName,
        range: utils.toRange(node.declarations[0].loc!.start, node.declarations[0].loc!.end)
    };
}


function parseWidgets(objEx: ObjectExpression, text: string, component: IComponent, nodeName: "type" | "xtype")
{
    let lastProperty = "Ext.define";
    const xType: (IXtype | IType)[] = [];
    const line = objEx.loc!.start.line - 1;
    const column = objEx.loc!.start.column;

    const _add = ((v: StringLiteral, parentProperty: string) =>
    {   //
        // CHeck the widgets we parsed on this component so we don't add something
        // that the user is currently typing in
        //
        // let xtypeExists = false;
        // component.widgets.forEach((w: string) => {
        //     if (w === v.value) {
        //         xtypeExists = true;
        //         return false; // break forEach()
        //     }
        // });
        // if (!xtypeExists) {
        //     return;
        // }

        //
        // Don't add the main xtype/type declaration (do main 'type' decs exist??)
        //
        if (nodeName === "type") {
            if (component.types.find(t => t.name === v.value)) {
                return;
            }
        }
        else if (nodeName === "xtype") {
            if (component.xtypes.find(x => x.name === v.value)) {
                return;
            }
        }

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

        log.write(`   push ${nodeName} ${v.value}`, 3);

        xType.push({
            name: v.value,
            start,
            end,
            componentClass: component.componentClass,
            type: nodeName,
            parentProperty,
            range: utils.toRange(start, end)
        });
    });

    const _process = (n: ObjectProperty, v: any) =>
    {
        if (!isIdentifier(n.key)) {
            return;
        }

        if (n.key.name !== nodeName || !isStringLiteral(v)) { // && !isArrayExpression(v))) {
            lastProperty = n.key.name;
            return;
        }

        if (isStringLiteral(v)) {
            _add(v, lastProperty);
        }
        // else
        // {
        //     v.elements.forEach(it => {
        //         if (isStringLiteral(it)) {
        //             _add(it, lastProperty);
        //         }
        //         // else {
        //         //     _process(it);
        //         // }
        //     });
        // }
    };

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
    traverse(parse(subText), {
        ObjectProperty(_path) {
            _process(_path.node, _path.node.value);
        }
    });

    return xType;
}
