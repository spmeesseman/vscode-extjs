
export interface Position
{
    line: number;
    column: number;
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
    start: Position;
    end: Position;
}


export interface IConfig
{
    name: string;
    doc?: string;
    value: string;
    start: Position;
    end: Position;
}


export interface IMethod
{
    value: string;
    doc?: string;
    name: string;
    start: Position;
    end: Position;
}


export interface IProperty
{
    name: string;
    doc?: string;
    value: string;
    start: Position;
    end: Position;
}

export interface IRequires
{
    value: string[];
    start: Position;
    end: Position;
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
}

