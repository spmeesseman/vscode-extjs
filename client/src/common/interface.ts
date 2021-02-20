
import { MarkdownString } from "vscode";


export interface IExtJsBase
{
    name: string;
    start: IPosition;
    end: IPosition;
}


export interface IComponent
{
    aliases: string[];
    baseNamespace: string;
    componentClass: string;
    requires?: IRequires;
    widgets: string[];
    xtypes: IXtype[];
    properties: IProperty[];
    configs: IConfig[];
    methods: IMethod[];
    statics: (IProperty | IMethod)[];
    privates: (IProperty | IMethod)[];
    doc?: string;
    markdown?: MarkdownString;
}


export interface IConf
{
    extjsDir: string | string[];
    extjsBase: string;
    workspaceRoot: string;
}


export interface IConfig extends IProperty
{
    setter: string | undefined;
    getter: string | undefined;
}


export interface IMethod extends IProperty
{
    params: string | undefined;
    variables?: IVariable[];
}


export interface IPosition
{
    line: number;
    column: number;
}


export interface IProperty extends IExtJsBase
{
    doc?: string;
    markdown?: MarkdownString;
}


export interface IRequires
{
    value: string[];
    start: IPosition;
    end: IPosition;
}


export interface ISettings
{
    debugClient: boolean;
    debugServer: boolean;
    debugLevel: number;
    include: string[] | string;
}


export enum VariableType
{
    const,
    let,
    var
}


export interface IVariable extends IExtJsBase
{
    componentClass: string;
    instanceClass: string;
    methodName: string;
    type: VariableType; // i.e. "const", "let", "var"
}


export interface IXtype extends IExtJsBase { }
