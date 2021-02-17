
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


export interface IJSDoc
{

}


export interface IConfig
{
    name: string;
    doc?: string;
    jsDoc?: IJSDoc;
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


export interface IRequestProperty
{
    value: string[];
    start: Position;
    end: Position;
}


export interface IExtjsComponent
{
    componentClass: string;
    requires?: IRequestProperty;
    widgets: string[];
    xtypes: IXtype[];
    configs: IConfig[];
    methods: IMethod[];
}

