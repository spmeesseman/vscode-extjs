
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


export interface IXtype
{
    value: string;
    start: IPosition;
    end: IPosition;
}


export interface IConfig
{
    name: string;
    doc?: string;
    markdown?:string;
    value: string;
    start: IPosition;
    end: IPosition;
}


export interface IMethod
{
    value: string;
    doc?: string;
    markdown?: string;
    name: string;
    start: IPosition;
    end: IPosition;
}


export interface IProperty
{
    name: string;
    doc?: string;
    markdown?: string;
    value: string;
    start: IPosition;
    end: IPosition;
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
    markdown?: string;
}
