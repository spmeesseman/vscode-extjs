
export enum DeclarationType
{
    const,
    let,
    var
}


export enum VariableType
{
    _any,
    _arr,
    _boolean,
    _number,
    _object,
    _string
}

export interface IExtJsBase
{
    componentClass: string;
    name: string;
    start: IPosition;
    end: IPosition;
    fsPath?: string;
}


export interface IComponent extends IExtJsBase
{
    aliases: string[];
    baseNameSpace: string;
    configs: IConfig[];
    deprecated?: boolean;
    doc?: string;
    extend?: string;
    isFramework: boolean;
    markdown?: any;
    methods: IMethod[];
    nameSpace: string;
    private?: boolean;
    privates: (IProperty | IMethod)[];
    properties: IProperty[];
    requires?: IRequires;
    since?: string;
    statics: (IProperty | IMethod)[];
    widgets: string[];
    xtypes: IXtype[];
}


export interface IConf
{
    archivePath?: string;
    bootstrap?: any;
    builds?: any;
    cache?: any;
    classic?: any;
    classpath: string | string[];
    css?: any;
    development?: any;
    fashion?: any;
    framework?: string;
    id?: string;
    ignore?: string[];
    indexHtmlPath?: string;
    language?: any;
    loader?: any;
    modern?: any;
    name: string;
    output?: any;
    production?: any;
    resource?: any;
    resources?: any;
    requires?: string[];
    url?: string;
    version?: string;
}


export interface IConfig extends IProperty
{
    setter: string;
    getter: string;
}


export interface IError
{
	code: number | undefined;
	fsPath: string | undefined;
}


export interface IMethod extends IProperty
{
    params?: IParameter[];
    variables?: IVariable[];
}


export interface IParameter extends IExtJsBase
{
    doc?: string;
    markdown?: any;
    methodName: string;
    declaration?: DeclarationType;
    type?: VariableType;
}


export interface IPosition
{
    line: number;
    column: number;
}


export interface IProperty extends IExtJsBase
{
    doc?: string;
    markdown?: any;
    private?: boolean;
    deprecated?: boolean;
    since?: string;
}


export interface IRequires
{
    value: string[];
    start: IPosition;
    end: IPosition;
}


export const defaultSettings: ISettings =
{   //
    // ** IMPORTANT NOTE **
    // Update this constant when the ISettings definition changes
    //
    debugClient: false,
    debugServer: false,
    debugLevel: 1,
    include: [],
    intellisenseIncludeDeprecated: true,
    intellisenseIncludePrivate: false,
    validateXTypes: true,
    validationDelay: 1250,
    ignoreErrors: []
};


export interface ISettings
{   //
    // ** IMPORTANT NOTE **
    // Be sure to update 'defaultSettings' above when adding/removing properties from this
    // interface definition
    //
    debugClient: boolean;
    debugServer: boolean;
    debugLevel: number;
    include: string[] | string;
    intellisenseIncludeDeprecated: boolean;
    intellisenseIncludePrivate: boolean;
    validateXTypes: boolean;
    validationDelay: number;
    ignoreErrors: IError[];
}


export interface IVariable extends IExtJsBase
{
    methodName: string;
    declaration?: DeclarationType;
    type?: VariableType;
}


export interface IXtype extends IExtJsBase {}
