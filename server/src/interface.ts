

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
    debugClient: boolean;
    debugServer: boolean;
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
    markdown?: string;
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
    statics: (IProperty | IMethod)[];
    privates: (IProperty | IMethod)[];
    doc?: string;
    markdown?: string;
}
