
import { parse } from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import {
    isArrayExpression, isCallExpression, isIdentifier, isMemberExpression, isObjectExpression,
    isObjectProperty, isStringLiteral, ObjectExpression, ObjectProperty, StringLiteral
} from "@babel/types";


interface Position {
    line: number;
    column: number;
}


interface IXtype {
    value: string;
    start: Position;
    end: Position;
}


interface IRequestProperty {
    value: string[];
    start: Position;
    end: Position;
}


interface IExtjsComponent {
    componentClass: string;
    requires?: IRequestProperty;
    widgets: string[];
    xtypes: IXtype[];
}


function isRequiresObjectProperty(nodePath: NodePath<ObjectProperty>)
{
    if (!isObjectExpression(nodePath.parentPath)) {
        return false;
    }
    if (!isCallExpression(nodePath.parentPath.parentPath.node)) {
        return false;
    }
    const callee = nodePath.parentPath.parentPath.node.callee;
    if (!isMemberExpression(callee)) {
        return false;
    }
    if (!isIdentifier(callee.object) || callee.object.name !== "Ext") {
        return false;
    }
    if (!isIdentifier(callee.property) || callee.property.name !== "define") {
        return false;
    }
    return true;
}


function isExtjsDefineObjectExpression(nodePath: NodePath<ObjectExpression>)
{
    if (!isCallExpression(nodePath.parentPath.node)) {
        return false;
    }
    const callee = nodePath.parentPath.node.callee;
    if (!isMemberExpression(callee)) {
        return false;
    }
    if (!isIdentifier(callee.object) || callee.object.name !== "Ext") {
        return false;
    }
    if (!isIdentifier(callee.property) || callee.property.name !== "define") {
        return false;
    }
    return true;
}


export async function parseExtJsFile(text: string)
{
    const ast = parse(text);
    const components: IExtjsComponent[] = [];

    traverse(ast,
        {
        // ObjectExpression(nodePath, parent) {
        //     if (isExtjsDefineObjectExpression(nodePath)) {
        //         const properties = nodePath.node.properties;
        //         const propertyRequires = properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === 'requires');
        //         const propertyAlias = properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === 'alias');
        //         const propertyXtype = properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === 'xtype');

            //         debugger;
            //     }
            // },
            CallExpression(path)
            {
                const callee = path.node.callee,
                    args = path.node.arguments;

                if (callee.type === "MemberExpression")
                {
                    if (isIdentifier(callee.object) && callee.object.name === "Ext" && isIdentifier(callee.property) && callee.property.name === "define")
                    {
                        if (isStringLiteral(args[0]) && isObjectExpression(args[1]))
                        {
                            const componentInfo: IExtjsComponent = {
                                componentClass: args[0].value,
                                xtypes: [],
                                widgets: [],
                            };
                            components.push(componentInfo);
                            const propertyRequires = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === "requires");
                            const propertyAlias = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === "alias");
                            const propertyXtype = args[1].properties.find(p => isObjectProperty(p) && isIdentifier(p.key) && p.key.name === "xtype");
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
                            if (isObjectProperty(propertyXtype)) {
                                componentInfo.widgets.push(...parseXtype(propertyXtype));
                            }

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


function parseRequires(propertyRequires: ObjectProperty)
{
    const requires: string[] = [];
    if (isArrayExpression(propertyRequires.value)) {
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
