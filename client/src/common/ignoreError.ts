
import { configuration } from "./configuration";
import { IError } from "../../../common";


let ignoreErrors: IError[] | undefined = configuration?.get<IError[]>("ignoreErrors");
if (!ignoreErrors) {
	ignoreErrors = [];
}


function isErrorIgnored(code: number, fsPath: string): boolean
{
	if (!ignoreErrors || ignoreErrors.length === 0) {
		return false;
	}

	for (const iError of ignoreErrors)
	{
		if (iError.code === code) {
			if (!fsPath || !iError.fsPath || iError.fsPath === fsPath) {
				return true;
			}
		}
	}

	return false;
}


async function addIgnoreError(error: IError)
{
	ignoreErrors?.push(error);
	await configuration?.update("ignoreErrors", ignoreErrors);
}


export { addIgnoreError, isErrorIgnored };
