
import { MarkdownString } from "vscode";


export interface IExtJsBase
{
    name: string;
    start: IPosition;
    end: IPosition;
}


export interface IPosition
{
    line: number;
    column: number;
}


export interface IConf
{
    extjsDir: string | string[];
    extjsBase: string;
    workspaceRoot: string;
}


export interface ISettings
{
    debug: boolean;
    debugLevel: number;
    include: string[] | string;
}


export interface IXtype extends IExtJsBase
{

}


export interface IConfig extends IProperty
{
    setter: string | undefined;
    getter: string | undefined;
}



export interface IMethod extends IProperty
{
    params: string | undefined;
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


export interface IComponent
{
    baseNamespace: string;
    componentClass: string;
    requires?: IRequires;
    widgets: string[];
    xtypes: IXtype[];
    properties: IProperty[];
    configs: IConfig[];
    methods: IMethod[];
    markdown?: MarkdownString;
}
