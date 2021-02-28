
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
    ignoreErrors: [],
    include: [],
    intellisenseIncludeDeprecated: true,
    intellisenseIncludePrivate: false,
    sdkDirectory: undefined,
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
    debugLevel: number;
    ignoreErrors: IError[];
    include: string[] | string;
    intellisenseIncludeDeprecated: boolean;
    intellisenseIncludePrivate: boolean;
    sdkDirectory: string | undefined;
    validateXTypes: boolean;
    validationDelay: number;
}
