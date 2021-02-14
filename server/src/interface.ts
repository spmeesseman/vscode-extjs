
export interface Position
{
    line: number;
    column: number;
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

