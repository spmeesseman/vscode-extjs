
import { parse } from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import * as util from "./util";
import { IExtjsComponent, Position, IXtype, IConfig, IMethod, IRequestProperty } from "./interface";
import {
    isArrayExpression, isCallExpression, isIdentifier, isMemberExpression, isObjectExpression,
    isObjectMember, ObjectMethod, Comment, isObjectProperty, isStringLiteral, ObjectExpression,
    ObjectProperty, StringLiteral, MemberExpression, isObjectMethod, isFunctionExpression
} from "@babel/types";
import { connection } from "./server";


export async function getExtJsComponent(text: string)
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
                // Check to see if the callee is 'Ext.define'
                //
                if (isIdentifier(callee.object) && callee.object.name === "Ext" && isIdentifier(callee.property) && callee.property.name === "define")
                {
                    util.log("Parse ExtJs file", 1);
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


export async function parseExtJsFile(text: string)
{
    const ast = parse(text);
    const components: IExtjsComponent[] = [];

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
                    util.log("Parse ExtJs file", 1);

                    //
                    // Ext.define should be in the form:
                    //
                    //     Ext.define('MyApp.view.users.User', { ... });
                    //
                    // Check to make sure the callee args are a string for param 1 and an object for param 2
                    //
                    if (isStringLiteral(args[0]) && isObjectExpression(args[1]))
                    {
                        const componentInfo: IExtjsComponent = {
                            componentClass: args[0].value,
                            xtypes: [],
                            widgets: [],
                            methods: [],
                            configs: []
                        };
                        components.push(componentInfo);

                        util.log(" ", 1);
                        util.logValue("   Component", args[0].value, 1);

                        const propertyRequires = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === "requires");
                        const propertyAlias = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === "alias");
                        const propertyXtype = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === "xtype");
                        const propertyConfig = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === "config");
                        const propertyMethod = args[1].properties.filter(p => isObjectProperty(p) && isIdentifier(p.key) && isFunctionExpression(p.value));
                        //
                        // TODO properties on object hasOwnProperty()
                        //
                        const propertyProperty = args[1].properties.filter(p => isObjectProperty(p) && isIdentifier(p.key) && !isFunctionExpression(p.value));

                        if (isObjectProperty(propertyRequires)) {
                            componentInfo.requires = {
                                value: parseRequires(propertyRequires),
                                start: propertyRequires.loc!.start,
                                end: propertyRequires.loc!.end,
                            };
                        }

                        if (isObjectProperty(propertyAlias)) {
                            componentInfo.widgets.push(...parseXtype(propertyAlias));
                        }

                        if (isObjectProperty(propertyXtype))
                        {
                            componentInfo.widgets.push(...parseXtype(propertyXtype));
                        }

                        if (isObjectProperty(propertyConfig))
                        {
                            componentInfo.configs.push(...parseConfig(propertyConfig));
                        }

                        if (propertyMethod && propertyMethod.length)
                        {
                            componentInfo.methods.push(...parseMethods(propertyMethod as ObjectProperty[]));
                        }

                        util.logValue("   # of requires found", componentInfo.requires?.value?.length, 2);
                        util.logValue("   # of widgets found", componentInfo.widgets?.length, 2);
                        if (componentInfo.configs)
                        {
                            util.logValue("   # of configs found", componentInfo.configs.length, 2);
                            componentInfo.configs.forEach((c) => {
                                util.log("      " + c.name, 3);
                                if (c.doc) {
                                    util.log(c.doc, 4);
                                }
                            });
                        }
                        if (componentInfo.methods)
                        {
                            util.logValue("   # of methods found", componentInfo.methods.length, 2);
                            componentInfo.methods.forEach((m) => {
                                util.log("      " + m.name, 3);
                                if (m.doc) {
                                    util.log(m.doc, 4);
                                }
                            });
                        }

                        // createXType(args[1], text)
                        // .then((x) => {
                        //     componentInfo.xtypes.push(x);
                        // });

                        //
                        const line = args[1].loc!.start.line - 1;
                        const column = args[1].loc!.start.column;
                        const subText = "a(" + text.substring(args[1].start!, args[1].end!) + ")";

                        const _ast = parse(subText);
                        traverse(_ast, {
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

                                componentInfo.xtypes.push({
                                    value: valueNode.value,
                                    start,
                                    end
                                });
                            }
                        });
                    }
                }
            }
        }
    });
    return components;
}

/*
function createXType(objEx: ObjectExpression, text: string): Promise<IXtype>
{
    return new Promise ((resolve, reject) => {
        const line = objEx.loc!.start.line - 1;
        const column = objEx.loc!.start.column;
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

                resolve({
                    value: valueNode.value,
                    start,
                    end
                });
            }
        });
    });
}
*/

function getComments(comments: readonly Comment[] | null)
{
    let commentsStr = "";

    comments?.forEach((c) => {
        commentsStr += c.value;
    });

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
    // commentsStr = commentsStr?.trim()
    //     .replace(/^[\* \t\n\r]+/, "")
    //     //
    //     // FOrmat line breaks to CLojure standard
    //     //
    //     .replace(/\n/, "  \n")
    //     //
    //     // Remove leading "* " for each line in the comment
    //     //
    //     .replace(/\* /, "")
    //     //
    //     // Bold @ tags
    //     //
    //     .replace(/@[a-z]+ /, function(match) {
    //         return "_**" + match.trim() + "**_ ";
    //     })
    //     .trim();

    // const docLines = config.doc.split("* ");
    // docLines.forEach((line) => {
    //     markdown.appendCodeblock(line);
    // });

    return commentsStr;
}



function parseMethods(propertyMethods: ObjectProperty[]): IMethod[]
{
    const methods: IMethod[] = [];
    propertyMethods.forEach((m) =>
    {
        if (isFunctionExpression(m.value))
        {
            const propertyName = isIdentifier(m.key) ? m.key.name : undefined;
            if (propertyName)
            {
                methods.push({
                    name: propertyName,
                    value: "",
                    doc: getComments(m.leadingComments),
                    start: m.loc!.start,
                    end: m.loc!.end
                });
            }
        }
    });
    return methods;
}


function parseConfig(propertyConfig: ObjectProperty)
{
    const requires: IConfig[] = [];
    if (isObjectExpression(propertyConfig.value))
    {
        propertyConfig.value.properties.reduce<IConfig[]>((p, it) =>
        {
            if (it?.type === "ObjectProperty") {
                const propertyName = isIdentifier(it.key) ? it.key.name : undefined;
                if (propertyName)
                {
                    p.push({
                        name: propertyName,
                        value: "",
                        doc: getComments(it.leadingComments),
                        start: it.loc!.start,
                        end: it.loc!.end
                    });
                }
            }
            return p;
        }, requires);
    }
    return requires;
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


function parseXtype(propertyNode: ObjectProperty)
{
    const xtypes: string[] = [];
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
                break;
            default:
                break;
        }
    });

    return xtypes;
}
