
import { deactivate } from "../../extension";
import { activate, waitForValidation } from "./helper";


suite("Deactivate extension", () =>
{
	suiteSetup(async () =>
    {
		await activate();
	});

	test("Deactivate", async () =>
	{
		deactivate();
		waitForValidation();
	});

});
