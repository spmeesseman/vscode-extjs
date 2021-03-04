
import { configuration } from "./configuration";
import { IError } from "../../../common";


let ignoreErrors: IError[] | undefined = configuration?.get<IError[]>("ignoreErrors");
if (!ignoreErrors) {
	ignoreErrors = [];
}


async function addIgnoreError(error: IError)
{
	ignoreErrors?.push(error);
	await configuration?.update("ignoreErrors", ignoreErrors);
}


export { addIgnoreError };
