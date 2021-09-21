
export interface IError
{
	code: number | undefined;
	fsPath: string | undefined;
}


export const defaultSettings: ISettings =
{   //
    // ** IMPORTANT NOTE **
    // Update this constant when the ISettings definition changes
    //
    debugClient: false,
    debugServer: false,
    debugLevel: 1,
    docURL: {},
    exclude: [],
    frameworkDirectory: undefined,
    ignoreErrors: [],
    ignoreTypes: [],
    include: [],
    intellisenseIncludeDeprecated: true,
    intellisenseIncludePrivate: false,
    intellisenseXtypeEol: true,
    quoteCharacter: "single",
    toolkit: "classic",
    validateXTypes: true,
    validationDelay: 1250
};


export interface ISettings
{   //
    // ** IMPORTANT NOTE **
    // Be sure to update 'defaultSettings' above when adding/removing properties from this
    // interface definition
    //
    debugClient: boolean;
    debugServer: boolean;
    debugLevel: 1 | 2 | 3 | 4 | 5;
    docURL: any;
    exclude: string[];
    ignoreErrors: IError[];
    ignoreTypes: string[];
    include: string[];
    intellisenseIncludeDeprecated: boolean;
    intellisenseIncludePrivate: boolean;
    intellisenseXtypeEol: boolean;
    frameworkDirectory: string | undefined;
    quoteCharacter: "single" | "double";
    toolkit: "classic" | "modern";
    validateXTypes: boolean;
    validationDelay: number;
}
