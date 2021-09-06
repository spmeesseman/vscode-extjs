
import * as vscode from "vscode";
import * as assert from "assert";
import { waitForValidation, insertDocContent, toRange } from "./helper";
import { configuration } from "../../common/configuration";
import { quoteChar } from "../../common/clientUtils";


export async function behindComments(uri: vscode.Uri)
{
	//
	// Should show nothing behind a comment...
	//
	// 1 /**
	// 2  * @class VSCodeExtJS
	// 3  *
	// 4  * The VSCodeExtJS app root namespace.
	// 5  */
	//
	await insertDocContent("VSCodeExtJS.", toRange(2, 3, 2, 3));
	await waitForValidation();
	await testCompletion(uri, new vscode.Position(2, 15), ".", {
		items: [{ label: "common", kind: vscode.CompletionItemKind.Class }]
	}, false, "behind comment method");
	//
	// Remove added text, set document back to initial state
	//
	await insertDocContent("", toRange(2, 3, 2, 15));
	await waitForValidation();
	//
	// Line 355
	// 354 //
	// 355 // Some comments
	// 356 //
	// 357 //
	//
	await testCompletion(uri, new vscode.Position(355, 17), ".", {
		items: [{ label: "common", kind: vscode.CompletionItemKind.Class }]
	}, false, "behind comment method");
	//
	// No space after //
	//
	await testCompletion(uri, new vscode.Position(356, 16), ".", {
		items: [{ label: "common", kind: vscode.CompletionItemKind.Class }]
	}, false, "behind comment method");
}


export async function fullTypeLines(uri: vscode.Uri)
{
	const items = [
		{ label: "type: users", kind: vscode.CompletionItemKind.Property },
		{ label: "type: appadmin", kind: vscode.CompletionItemKind.Property },
		{ label: "type: array", kind: vscode.CompletionItemKind.Property },
		{ label: "type: store", kind: vscode.CompletionItemKind.Property }
	];
	//
	// Line 187 - 191
	// const grid = Ext.create({
	//	   hidden: false,
	//	   disabled: true,
	//
	// });
	//
	await testCompletion(uri, new vscode.Position(189, 3), "t", { items }, true, "full type lines 'tx'");
	//
	// Typing a ':' after an 'xtype:'
	//
	await insertDocContent("type:", toRange(189, 3, 189, 3));
	await waitForValidation();
	try {
		await testCompletion(uri, new vscode.Position(189, 7), ":", { items }, true, "full type lines ':'");
	}
	catch (e) { throw e; }
	finally { await insertDocContent("", toRange(189, 3, 189, 8)); }
	await waitForValidation();
	//
	// Typing a 'quote-char' after a 'type:' text
	//
	const quote = quoteChar();
	await insertDocContent(`type: ${quote}${quote}`, toRange(189, 3, 189, 3));
	await waitForValidation();
	try {
		await testCompletion(uri, new vscode.Position(189, 7), ":", { items });
		await testCompletion(uri, new vscode.Position(189, 9), quote, { items });
		await testCompletion(uri, new vscode.Position(189, 10), quote, { items });
		await testCompletion(uri, new vscode.Position(189, 11), "", { items });
	}
	catch (e) { throw e; }
	finally { await insertDocContent("", toRange(189, 3, 189, 11)); }
	await waitForValidation();
	//
	// Mid-typing type (ty...)
	//
	await insertDocContent("ty", toRange(216, 4, 216, 4));
	await waitForValidation();
	try {
		await testCompletion(uri, new vscode.Position(216, 6), "p", { items }, true, "object 'type' configs and properties mid-word");
		await testCompletion(uri, new vscode.Position(216, 5), "y", { items }, true, "object 'type' configs and properties mid-word");
	}
	catch (e) { throw e; }
	finally { await insertDocContent("", toRange(216, 4, 216, 6)); }
	await waitForValidation();
	//
	// Line 121-123 - should return nothing, since the component is defined
	// in the 1st argument to Ext.create
	//
	// const patient = Ext.create('VSCodeExtJS.common.PatientDropdown', {
	//
	// });
	//
	await testCompletion(uri, new vscode.Position(121, 3), "t", {
		items: []
	}, false, "object 'x/type' already defined");
}


export async function fullXTypeLines(uri: vscode.Uri)
{
	const items = [
		{ label: "xtype: component", kind: vscode.CompletionItemKind.Property },
		{ label: "xtype: grid", kind: vscode.CompletionItemKind.Property },
		{ label: "xtype: gridpanel", kind: vscode.CompletionItemKind.Property },
		{ label: "xtype: patientdropdown", kind: vscode.CompletionItemKind.Property },
		{ label: "xtype: physiciandropdown", kind: vscode.CompletionItemKind.Property },
		{ label: "xtype: userdropdown", kind: vscode.CompletionItemKind.Property }
	];
	//
	// Line 187 - 191
	// const grid = Ext.create({
	//	   hidden: false,
	//	   disabled: true,
	//
	// });
	//
	await testCompletion(uri, new vscode.Position(189, 3), "x", { items }, true, "full xtype lines 'x'");
	//
	// Typing a ':' after an 'xtype:'
	//
	await insertDocContent("xtype:", toRange(189, 3, 189, 3));
	await waitForValidation();
	try {
		await testCompletion(uri, new vscode.Position(189, 8), ":", { items }, true, "full xtype lines ':'");
	}
	catch (e) { throw e; }
	finally { await insertDocContent("", toRange(189, 3, 189, 9)); }
	await waitForValidation();
	//
	// Typing a 'quote-char' after an 'xtype:' text
	// Remove added text, set document back to initial state
	//
	const quote = quoteChar();
	await insertDocContent(`xtype: ${quote}${quote}`, toRange(189, 3, 189, 3));
	await waitForValidation();
	try {
		await testCompletion(uri, new vscode.Position(189, 8), ":", { items });
		await testCompletion(uri, new vscode.Position(189, 10), quote, { items });
		await testCompletion(uri, new vscode.Position(189, 11), quote, { items });
		await testCompletion(uri, new vscode.Position(189, 12), "", { items });
	}
	catch (e) { throw e; }
	finally { await insertDocContent("", toRange(189, 3, 189, 12)); }
	//
	// Remove added text, set document back to initial state
	//
	await waitForValidation();
	//
	// Mid-typing type (xt...)
	//
	await insertDocContent("xt", toRange(189, 3, 189, 3));
	await waitForValidation();
	await testCompletion(uri, new vscode.Position(189, 5), "y", { items }, true, "object 'xtype' configs and properties mid-word");
	await testCompletion(uri, new vscode.Position(189, 4), "t", { items }, true, "object 'xtype' configs and properties mid-word");
	//
	// Remove added text, set document back to initial state
	//
	await insertDocContent("", toRange(189, 3, 189, 5));
	await waitForValidation();
	//
	// Line 121-123 - should return nothing, since the component is defined
	// in the 1st argument to Ext.create, no 'xtype: ...' items
	//
	// const patient = Ext.create('VSCodeExtJS.common.PatientDropdown', {
	//
	// });
	//
	await testCompletion(uri, new vscode.Position(121, 3), "x", {
		items: []
	}, false, "object 'x/type' already defined");
}


export async function inlineClass(uri: vscode.Uri)
{   //
	// I don't know why the hell a random completion fails in this test.
	// I've tried everything.  Latest is warpping in try/catch and retry
	// on one failure.  Wth.  Marking with asterisks on each fail to see if it's
	// coming at a particular area
	//
	// Inside function
	//
	try {
		await testCompletion(uri, new vscode.Position(95, 3), "A", {
			items: [
				{ label: "AppUtils", kind: vscode.CompletionItemKind.Class }
			]
		}, true, "inline property start A");
	}
	catch {
		await testCompletion(uri, new vscode.Position(95, 3), "A", {
			items: [
				{ label: "AppUtils", kind: vscode.CompletionItemKind.Class }
			]
		}, true, "inline property start A2");
	}

	try {
		await testCompletion(uri, new vscode.Position(95, 3), "E", {
			items: [
				{ label: "Ext", kind: vscode.CompletionItemKind.Class }
			]
		}, true, "inline property start E");
	}
	catch {
		await testCompletion(uri, new vscode.Position(95, 3), "E", {
			items: [
				{ label: "Ext", kind: vscode.CompletionItemKind.Class }
			]
		}, true, "inline property start E2");
	}

	try {
		await testCompletion(uri, new vscode.Position(95, 3), "U", {
			items: [
				{ label: "Utils", kind: vscode.CompletionItemKind.Class }
			]
		}, true, "inline property start U");
	}
	catch {
		await testCompletion(uri, new vscode.Position(95, 3), "U", {
			items: [
				{ label: "Utils", kind: vscode.CompletionItemKind.Class }
			]
		}, true, "inline property start U2");
	}

	try { // **
		await testCompletion(uri, new vscode.Position(95, 3), "V", {
			items: [
				{ label: "VSCodeExtJS", kind: vscode.CompletionItemKind.Class },
				{ label: "VSCodeExtJSApp", kind: vscode.CompletionItemKind.Class }
			]
		}, true, "inline property start V");
	}
	catch {
		await testCompletion(uri, new vscode.Position(95, 3), "V", {
			items: [
				{ label: "VSCodeExtJS", kind: vscode.CompletionItemKind.Class }
			]
		}, true, "inline property start V2");
		await testCompletion(uri, new vscode.Position(95, 3), "V", {
			items: [
				{ label: "VSCodeExtJS", kind: vscode.CompletionItemKind.Class },
				{ label: "VSCodeExtJSApp", kind: vscode.CompletionItemKind.Class }
			]
		}, true, "inline property start V3");
	}

	//
	// Inside function - beginning of line
	//
	try {
		await testCompletion(uri, new vscode.Position(95, 0), "U", {
			items: [
				{ label: "AppUtils", kind: vscode.CompletionItemKind.Class }
			]
		}, true, "inline property start U");
	}
	catch {
		await testCompletion(uri, new vscode.Position(95, 0), "U", {
			items: [
				{ label: "AppUtils", kind: vscode.CompletionItemKind.Class }
			]
		}, true, "inline property start U2");
	}
	try {
		await testCompletion(uri, new vscode.Position(95, 0), "V", {
			items: [
				{ label: "VSCodeExtJS", kind: vscode.CompletionItemKind.Class },
				{ label: "VSCodeExtJSApp", kind: vscode.CompletionItemKind.Class }
			]
		}, true, "inline property start V");
	}
	catch {
		await testCompletion(uri, new vscode.Position(95, 0), "V", {
			items: [
				{ label: "VSCodeExtJS", kind: vscode.CompletionItemKind.Class },
				{ label: "VSCodeExtJSApp", kind: vscode.CompletionItemKind.Class }// ,
				// { label: "VSCodeExtJSEol", kind: vscode.CompletionItemKind.Class }
			]
		}, true, "inline property start V2");
	}
	//
	// Outside function 0 results
	//
	await testCompletion(uri, new vscode.Position(97, 0), "", {
		items: []
	}, false, "inline outside function 0 results");

	//
	// Inside method callee expression (parameter)
	// Line 75
	// VSCodeExtJS.common.PhysicianDropdown.create()
	// Inside create() i.e. create( ... )
	//
	try {
		await testCompletion(uri, new vscode.Position(74, 46), "A", {
			items: [
				{ label: "AppUtils", kind: vscode.CompletionItemKind.Class }
			]
		}, true, "inline property start A");
	}
	catch {
		await testCompletion(uri, new vscode.Position(74, 46), "A", {
			items: [
				{ label: "AppUtils", kind: vscode.CompletionItemKind.Class }
			]
		}, true, "inline property start A2");
	}
	try {
		await testCompletion(uri, new vscode.Position(74, 46), "E", {
			items: [
				{ label: "Ext", kind: vscode.CompletionItemKind.Class }
			]
		}, true, "inline property start E");
	}
	catch {
		await testCompletion(uri, new vscode.Position(74, 46), "E", {
			items: [
				{ label: "Ext", kind: vscode.CompletionItemKind.Class }
			]
		}, true, "inline property start E2");
	}
	try {
		await testCompletion(uri, new vscode.Position(74, 46), "U", {
			items: [
				{ label: "Utils", kind: vscode.CompletionItemKind.Class }
			]
		}, true, "inline property start U");
	}
	catch {
		await testCompletion(uri, new vscode.Position(74, 46), "U", {
			items: [
				{ label: "Utils", kind: vscode.CompletionItemKind.Class }
			]
		}, true, "inline property start U2");
	}
	try {
		await testCompletion(uri, new vscode.Position(74, 46), "V", {
			items: [
				{ label: "VSCodeExtJS", kind: vscode.CompletionItemKind.Class },
				{ label: "VSCodeExtJSApp", kind: vscode.CompletionItemKind.Class }
			]
		}, true, "inline property start V");
	}
	catch {
		await testCompletion(uri, new vscode.Position(74, 46), "V", {
			items: [
				{ label: "VSCodeExtJS", kind: vscode.CompletionItemKind.Class },
				{ label: "VSCodeExtJSApp", kind: vscode.CompletionItemKind.Class }
			]
		}, true, "inline property start V2");
	}

	//
	// After semi-colon ended statement same line
	// Line 75
	// VSCodeExtJS.common.PhysicianDropdown.create();
	// After create(); i.e. .create( ... ); AppUtils.
	//
	try {
		await testCompletion(uri, new vscode.Position(74, 48), "A", {
			items: [
				{ label: "AppUtils", kind: vscode.CompletionItemKind.Class }
			]
		}, true, "inline property start A");
	}
	catch {
		await testCompletion(uri, new vscode.Position(74, 48), "A", {
			items: [
				{ label: "AppUtils", kind: vscode.CompletionItemKind.Class }
			]
		}, true, "inline property start A2");
	}
	try {
		await testCompletion(uri, new vscode.Position(74, 48), "E", {
			items: [
				{ label: "Ext", kind: vscode.CompletionItemKind.Class }
			]
		}, true, "inline property start E");
	}
	catch {
		await testCompletion(uri, new vscode.Position(74, 48), "E", {
			items: [
				{ label: "Ext", kind: vscode.CompletionItemKind.Class }
			]
		}, true, "inline property start E2");
	}
	try {
		await testCompletion(uri, new vscode.Position(74, 48), "U", {
			items: [
				{ label: "Utils", kind: vscode.CompletionItemKind.Class }
			]
		}, true, "inline property start U");
	}
	catch {
		await testCompletion(uri, new vscode.Position(74, 48), "U", {
			items: [
				{ label: "Utils", kind: vscode.CompletionItemKind.Class }
			]
		}, true, "inline property start U2");
	}
	try {
		await testCompletion(uri, new vscode.Position(74, 48), "V", {
			items: [
				{ label: "VSCodeExtJS", kind: vscode.CompletionItemKind.Class },
				{ label: "VSCodeExtJSApp", kind: vscode.CompletionItemKind.Class }
			]
		}, true, "inline property start V");
	}
	catch {
		await testCompletion(uri, new vscode.Position(74, 48), "V", {
			items: [
				{ label: "VSCodeExtJS", kind: vscode.CompletionItemKind.Class },
				{ label: "VSCodeExtJSApp", kind: vscode.CompletionItemKind.Class }
			]
		}, true, "inline property start V2");
	}
}


export async function inlineClassAsParam(uri: vscode.Uri)
{   //
	// Line 109
	// me.testFn2();
	// Insert a first parameter that will be a class completion
	//
	await insertDocContent("VSCodeExtJS.", toRange(108, 13, 108, 13));
	await waitForValidation();
	//
	// Line 109
	// me.testFn2(me.testFn4(...
	//
	await testCompletion(uri, new vscode.Position(108, 25), ".", {
		items: [
			{ label: "common", kind: vscode.CompletionItemKind.Class },
			{ label: "AppUtilities", kind: vscode.CompletionItemKind.Class },
			{ label: "view", kind: vscode.CompletionItemKind.Class },
			{ label: "main", kind: vscode.CompletionItemKind.Class },
			{ label: "mixins", kind: vscode.CompletionItemKind.Class },
			{ label: "model", kind: vscode.CompletionItemKind.Class },
			{ label: "store", kind: vscode.CompletionItemKind.Class }
		]
	}, true, "inline class as a 1st parameter");
	//
	// Insert a first parameter
	//
	await insertDocContent(", AppUtils.", toRange(108, 24, 108, 25));
	await waitForValidation();
	//
	// 2nd parameter
	//
	await testCompletion(uri, new vscode.Position(108, 35), ".", {
		items: [
			{ label: "alertError", kind: vscode.CompletionItemKind.Method },
			{ label: "publicProperty", kind: vscode.CompletionItemKind.Property }
		]
	}, true, "inline class as a 2nd parameter");
	//
	// Remove added text, set document back to initial state
	//
	await insertDocContent("", toRange(108, 13, 108, 35));
	await waitForValidation();
}


export async function inlineModelField(uri: vscode.Uri)
{   //
	// Inside object - 'u' trigger
	// Line 248-250
	// const user = VSCodeExtJS.model.User.create({
	//
	// });
	//
	await testCompletion(uri, new vscode.Position(248, 3), "", {
		items: [
			{ label: "dtexpires date (m/d/Y H:i:s)", kind: vscode.CompletionItemKind.Field },
			{ label: "id number", kind: vscode.CompletionItemKind.Field },
			{ label: "password string", kind: vscode.CompletionItemKind.Field },
			{ label: "userid string", kind: vscode.CompletionItemKind.Field }
		]
	}, true, "inline model fields");
}


export async function inlineProperty(uri: vscode.Uri)
{   //
	// Inside object - 'u' trigger
	// Line 121-123
	// const phys = Ext.create('VSCodeExtJS.common.PatientDropdown', {
	//
	// });
	//
	await testCompletion(uri, new vscode.Position(121, 3), "u", {
		items: [
			{ label: "userName UserDropdown config", kind: vscode.CompletionItemKind.Property }
		]
	}, true, "inherited define properties inside patient object");
	//
	// Inside object
	// Line 124-126
	// const phys = Ext.create('VSCodeExtJS.common.PhysicianDropdown', {
	//
	// });
	//
	await testCompletion(uri, new vscode.Position(124, 3), "", {
		items: [
			{ label: "userName UserDropdown config", kind: vscode.CompletionItemKind.Property },
			{ label: "readOnly UserDropdown", kind: vscode.CompletionItemKind.Property }
		]
	}, true, "inherited define properties inside physician object");
}


export async function instanceConfigProperties(uri: vscode.Uri)
{   //
	// Line 109
	// me.
	//
	await testCompletion(uri, new vscode.Position(108, 5), ".", {
		items: [
			{ label: "setTest config setter", kind: vscode.CompletionItemKind.Method },
			{ label: "getTest config getter", kind: vscode.CompletionItemKind.Method },
			{ label: "test config", kind: vscode.CompletionItemKind.Property },
			{ label: "test2 config", kind: vscode.CompletionItemKind.Property }
		]
	}, true, "config property");
}


export async function invalidXTypeObject(uri: vscode.Uri)
{
	await insertDocContent("xtype: invalidXtype,\r\n\t\t", toRange(189, 3, 189, 3));
	await waitForValidation();
	await testCompletion(uri, new vscode.Position(190, 3), "u", {
		items: []
	}, true, "invalid xtype object");
	await insertDocContent("", toRange(189, 3, 190, 3));
	await waitForValidation();
}


export async function localClassInstances(uri: vscode.Uri)
{
	const incDeprecated = configuration.get<boolean>("intellisenseIncludeDeprecated"),
			incPrivate = configuration.get<boolean>("intellisenseIncludePrivate");
	//
	// const phys = Ext.create("VSCodeExtJS.common.PhysicianDropdown"...)
	// Line 83
	// phys.delete();
	//
	await configuration.update("intellisenseIncludeDeprecated", false);
	await configuration.update("intellisenseIncludePrivate", false);
	await testCompletion(uri, new vscode.Position(82, 7), ".", {
		items: [
			{ label: "getPinNumber (since v1.0.0)", kind: vscode.CompletionItemKind.Method }
		]
	});
	//
	// Line 84
	// let pin2 = phys.getPinNumber();
	//
	await testCompletion(uri, new vscode.Position(83, 18), ".", {
		items: [
			{ label: "getPinNumber (since v1.0.0)", kind: vscode.CompletionItemKind.Method }
		]
	});
	//
	// const phys2 = new VSCodeExtJS.common.PhysicianDropdown...
	// Line 90
	// let pin3 = phys2.getPinNumber();
	//
	await testCompletion(uri, new vscode.Position(89, 19), ".", {
		items: [
			{ label: "getPinNumber (since v1.0.0)", kind: vscode.CompletionItemKind.Method }
		]
	});
	//
	// Show deprecated
	//
	await configuration.update("intellisenseIncludeDeprecated", true);
	await testCompletion(uri, new vscode.Position(82, 7), ".", {
		items: [
			{ label: "getPinNumber (since v1.0.0)", kind: vscode.CompletionItemKind.Method },
			{ label: "getPin (deprecated)", kind: vscode.CompletionItemKind.Method }
		]
	});
	await testCompletion(uri, new vscode.Position(82, 7), ".", {
		items: [
			{ label: "getPinNumberInternal (private) (since v1.0.2)", kind: vscode.CompletionItemKind.Method }
		]
	}, false);
	//
	// Show private
	//
	await configuration.update("intellisenseIncludePrivate", true);
	await testCompletion(uri, new vscode.Position(82, 7), ".", {
		items: [
			{ label: "getPinNumber (since v1.0.0)", kind: vscode.CompletionItemKind.Method },
			{ label: "getPin (deprecated)", kind: vscode.CompletionItemKind.Method },
			// { label: "getPinNumberInternal (private)", kind: vscode.CompletionItemKind.Method },
			{ label: "getPinNumberInternal (private) (since v1.0.2)", kind: vscode.CompletionItemKind.Method }
		]
	});
	//
	// Line 82
	// const pin = phys.getPinNumber();
	//
	await testCompletion(uri, new vscode.Position(81, 19), ".", {
		items: [
			{ label: "getPinNumber (since v1.0.0)", kind: vscode.CompletionItemKind.Method },
			{ label: "getPin (deprecated)", kind: vscode.CompletionItemKind.Method },
			// { label: "getPinNumberInternal (private)", kind: vscode.CompletionItemKind.Method },
			{ label: "getPinNumberInternal (private) (since v1.0.2)", kind: vscode.CompletionItemKind.Method }
		]
	});
	//
	// Line 145
	//
	// 143 ...
	// 144 let cmp = this.down('physiciandropdown');
	// 145 cmp.load("test");cmp.load("test2");
	//
	await testCompletion(uri, new vscode.Position(145, 6), ".", {
		items: [
			{ label: "getPinNumber (since v1.0.0)", kind: vscode.CompletionItemKind.Method },
			{ label: "getPin (deprecated)", kind: vscode.CompletionItemKind.Method },
			// { label: "getPinNumberInternal (private)", kind: vscode.CompletionItemKind.Method },
			{ label: "getPinNumberInternal (private) (since v1.0.2)", kind: vscode.CompletionItemKind.Method }
		]
	});
	await testCompletion(uri, new vscode.Position(145, 23), ".", {
		items: [
			{ label: "getPinNumber (since v1.0.0)", kind: vscode.CompletionItemKind.Method },
			{ label: "getPin (deprecated)", kind: vscode.CompletionItemKind.Method },
			// { label: "getPinNumberInternal (private)", kind: vscode.CompletionItemKind.Method },
			{ label: "getPinNumberInternal (private) (since v1.0.2)", kind: vscode.CompletionItemKind.Method }
		]
	});
	//
	// Revert settings
	//
	await configuration.update("intellisenseIncludeDeprecated", incDeprecated);
	await configuration.update("intellisenseIncludePrivate", incPrivate);
}


export async function localInheritedMethods(uri: vscode.Uri)
{
	const incDeprecated = configuration.get<boolean>("intellisenseIncludeDeprecated");
	await configuration.update("intellisenseIncludeDeprecated", true);
	//
	// const phys = Ext.create("VSCodeExtJS.common.PhysicianDropdown"...)
	// Line 83
	// phys.*
	//
	await testCompletion(uri, new vscode.Position(82, 7), ".", {
		items: [
			{ label: "save", kind: vscode.CompletionItemKind.Method },
			{ label: "load", kind: vscode.CompletionItemKind.Method },
			{ label: "delete", kind: vscode.CompletionItemKind.Method },
			{ label: "getPin (deprecated)", kind: vscode.CompletionItemKind.Method }
		]
	});

	await configuration.update("intellisenseIncludeDeprecated", false);
	await testCompletion(uri, new vscode.Position(82, 7), ".", {
		items: [
			{ label: "getPin (deprecated)", kind: vscode.CompletionItemKind.Method }
		]
	}, false);

	await configuration.update("intellisenseIncludeDeprecated", incDeprecated);
}


export async function none(uri: vscode.Uri)
{	//
	// Outside object range
	//
	await testCompletion(uri, new vscode.Position(222, 1), "V", {
		items: []
	}, true, "outside completion ranges");
	await waitForValidation();
}


export async function privates(uri: vscode.Uri)
{
	const incPrivate = configuration.get<boolean>("intellisenseIncludePrivate");
	await configuration.update("intellisenseIncludePrivate", true);
	//
	// const phys = Ext.create("VSCodeExtJS.common.PhysicianDropdown"...)
	// Line 83
	// phys.*
	//
	await testCompletion(uri, new vscode.Position(82, 7), ".", {
		items: [
			{ label: "stopAllPriv (private) (since v0.5.0)", kind: vscode.CompletionItemKind.Method },
			{ label: "privateVariable (private)", kind: vscode.CompletionItemKind.Property }
		]
	}, true, "privates block properties and methods");

	await configuration.update("intellisenseIncludePrivate", incPrivate);
}


export async function propertyValues(uri: vscode.Uri)
{
	const xtypeEol = configuration.get<boolean>("intellisenseXtypeEol", true);
	await configuration.update("intellisenseXtypeEol", true);
	//
	// Line 167
	// Within main object
	// dockedItems: [
	// {
	//     xtype: "physiciandropdown"
	// }...
	//
	await insertDocContent("\t\treadOnly:", toRange(166, 0, 166, 11));
	await waitForValidation();
	await testCompletion(uri, new vscode.Position(166, 11), ":", {
		items: [
			{ label: "false", kind: vscode.CompletionItemKind.Value },
			{ label: "true", kind: vscode.CompletionItemKind.Value }
		]
	}, true, "readOnly property values by xtype");
	//
	// Turn off xtype Eol setting
	//
	await configuration.update("intellisenseXtypeEol", false);
	await testCompletion(uri, new vscode.Position(166, 11), ":", {
		items: [
			{ label: "false", kind: vscode.CompletionItemKind.Value },
			{ label: "true", kind: vscode.CompletionItemKind.Value }
		]
	}, true, "readOnly property values by xtype");
	//
	// Re-enable xtype Eol setting
	//
	await configuration.update("intellisenseXtypeEol", true);
	//
	// Xtype string value
	//
	await insertDocContent("\t\tuserName:", toRange(166, 0, 166, 11));
	await waitForValidation();
	await testCompletion(uri, new vscode.Position(166, 11), ":", {
		items: [
			{ label: "String Value", kind: vscode.CompletionItemKind.Value }
		]
	}, true, "userName property value by xtype");
	await insertDocContent("", toRange(166, 0, 166, 11));
	//
	// Type/store object, boolean true/false type defined by doc comment
	// Line 208
	//
	await insertDocContent("\t\tautoLoad:", toRange(207, 4, 207, 15));
	await waitForValidation();
	await testCompletion(uri, new vscode.Position(207, 15), ":", {
		items: [
			{ label: "false", kind: vscode.CompletionItemKind.Value },
			{ label: "true", kind: vscode.CompletionItemKind.Value }
		]
	}, true, "autoLoad property values by type");
	await insertDocContent("", toRange(207, 4, 207, 15));
	//
	// Type/store object, no doc defined type, defined by default value
	// Line 208
	//
	await insertDocContent("\t\tsortOnLoad:", toRange(207, 4, 207, 17));
	await waitForValidation();
	await testCompletion(uri, new vscode.Position(207, 17), ":", {
		items: [
			{ label: "false", kind: vscode.CompletionItemKind.Value },
			{ label: "true", kind: vscode.CompletionItemKind.Value }
		]
	}, false, "sortOnLoad property values by default value");
	await insertDocContent("", toRange(207, 4, 207, 17));
	//
	// Type/store object, no doc defined type, undefined default value
	// Line 208
	//
	await insertDocContent("\t\tmodel:", toRange(207, 4, 207, 12));
	await waitForValidation();
	await testCompletion(uri, new vscode.Position(207, 12), ":", {
		items: []
	}, false, "model property values, no default type");
	await insertDocContent("", toRange(207, 4, 207, 12));
	//
	//
	// Grid / object value
	//
	// await insertDocContent("fields:", toRange(207, 4, 207, 4));
	// await waitForValidation();
	// await testCompletion(docUri, new vscode.Position(207, 10), ":", {
	// 	items: [
	// 		{ label: "Array Value", kind: vscode.CompletionItemKind.Value },
	// 		{ label: "Object Value", kind: vscode.CompletionItemKind.Value }
	// 	]
	// }, true, "object 'type' configs and properties");
	// //
	// // Remove added text, set document back to initial state
	// //
	// await insertDocContent("", toRange(207, 4, 207, 12));
	//
	// Revert settings
	//
	await configuration.update("intellisenseXtypeEol", xtypeEol);
}


export async function statics(uri: vscode.Uri)
{   //
	// Line 193
	// VSCodeExtJS.common.PhysicianDropdown.stopAll
	//
	await testCompletion(uri, new vscode.Position(192, 38), ".", {
		items: [
			{ label: "stopAll (static) (since v0.4.0)", kind: vscode.CompletionItemKind.Method },
			{ label: "staticVariable (static)", kind: vscode.CompletionItemKind.Property }
		]
	}, true, "statics block properties and methods");
}


export async function subClass(uri: vscode.Uri)
{   //
	// Line 75-76
	// VSCodeExtJS.*
	//
	await testCompletion(uri, new vscode.Position(74, 14), ".", {
		items: [
			{ label: "common", kind: vscode.CompletionItemKind.Class },
			{ label: "AppUtilities", kind: vscode.CompletionItemKind.Class }
		]
	}, true, "middle classpath inline");
	//
	// Line 72
	// VSCodeExtJS.AppUtilities.*
	//
	await testCompletion(uri, new vscode.Position(71, 27), ".", {
		items: [
			{ label: "alertError", kind: vscode.CompletionItemKind.Method }
		]
	});
	//
	// Line 75-76
	// VSCodeExtJS.common.*
	//
	await testCompletion(uri, new vscode.Position(74, 21), ".", {
		items: [
			{ label: "PhysicianDropdown", kind: vscode.CompletionItemKind.Class },
			{ label: "UserDropdown (since v1.0.0)", kind: vscode.CompletionItemKind.Class }
		]
	});
}


export async function subClassMethods(uri: vscode.Uri)
{   //
	// Line 72
	// VSCodeExtJS.AppUtilities.*
	//
	await testCompletion(uri, new vscode.Position(71, 27), ".", {
		items: [
			{ label: "alertError", kind: vscode.CompletionItemKind.Method }
		]
	});
}


export async function testCompletion(uri: vscode.Uri, position: vscode.Position, triggerChar: string, expectedCompletionList: vscode.CompletionList, shouldShow = true, testDesc?: string)
{

	const actualCompletionList = (await vscode.commands.executeCommand(
		"vscode.executeCompletionItemProvider",
		uri,
		position,
		triggerChar
	)) as vscode.CompletionList;

	// const logKind = "Property";
	// const logDescRgx = /type lines '\:'/;
	// if (testDesc && logDescRgx.test(testDesc))
	// {
	// 	console.log("####################################");
	// 	console.log(uri.path);
	// 	console.log("actual items length", actualCompletionList.items.length);
	// 	console.log("expected items length", expectedCompletionList.items.length);
	// 	console.log("####################################");
	// 	actualCompletionList.items.forEach((actualItem) => {
	// 		// if (actualItem.kind && vscode.CompletionItemKind[actualItem.kind] === logKind) {
	// 			console.log(actualItem.label, actualItem.kind ? vscode.CompletionItemKind[actualItem.kind] : "");
	// 		// }
	// 	});
	// }

	if (testDesc !== "no_fail")
	{
		assert.ok(actualCompletionList.items.length >= expectedCompletionList.items.length);

		expectedCompletionList.items.forEach((expectedItem, i) => {
			assert.strictEqual(
				actualCompletionList.items.filter((item) =>
				{   //
					// No idea what happened, but vscode engine updated to 1.60 and all of a sudden
					// getting weird errors 'item.label.replace is not a function'.  and its a
					// string.  no idea.  Every single release something like this happens that
					// has to be worked around and its getting very very annoying.  So now we have
					// to catch whatever is going on here as the engine is returning some funky
					// completion items.  Even JSON.stringified 'item' and item.label came out just
					// fine.  No idea how that could be.
					//
					try {
						return item.kind === expectedItem.kind && (item.label.replace(/ /g, "") === expectedItem.label.replace(/ /g, "") ||
							   item.insertText?.toString().replace(/ /g, "") === expectedItem.insertText?.toString().replace(/ /g, ""));
					}
					catch {
					}
				}).length, shouldShow ? 1 : 0, expectedItem.label + " not found" + (testDesc ? ` (${testDesc})` : "")
			);
		});
	}
}


export async function thisMethod(uri: vscode.Uri)
{   //
	// Line 71
	// this.*
	//
	await testCompletion(uri, new vscode.Position(70, 7), ".", {
		items: [
			{ label: "setTest config setter", kind: vscode.CompletionItemKind.Method },
			{ label: "getTest config getter", kind: vscode.CompletionItemKind.Method },
			{ label: "test config", kind: vscode.CompletionItemKind.Property },
			{ label: "test2 config", kind: vscode.CompletionItemKind.Property }
		]
	}, true, "this methods");
}


export async function typeProperties(uri: vscode.Uri)
{   //
	// Line 203 - 207 Store filter object
	// Within main object
	// 199
	// 200    store2:
	// 201    {
	// 202        type: "users",
	// 203        filters: [
	// 204        {
	// 205            property: "userid",
	// 206
	// 207        }],
	// 208
	// 209        sorters: [
	// 210        {
	// 211           ...
	//
	// await testCompletion(docUri, new vscode.Position(205, 5), "", {
	// 	items: [
	// 		{ label: "operator", kind: vscode.CompletionItemKind.Property },
	// 		{ label: "property", kind: vscode.CompletionItemKind.Property },
	// 		{ label: "value", kind: vscode.CompletionItemKind.Property }
	// 	]
	// });
	await testCompletion(uri, new vscode.Position(207, 4), "a", {
		items: [
			{ label: "autoDestroy AbstractStore config", kind: vscode.CompletionItemKind.Property },
			{ label: "autoFilter AbstractStore config", kind: vscode.CompletionItemKind.Property },
			{ label: "autoSort AbstractStore config", kind: vscode.CompletionItemKind.Property },
			{ label: "autoLoad ProxyStore config", kind: vscode.CompletionItemKind.Property },
			{ label: "autoSync ProxyStore config", kind: vscode.CompletionItemKind.Property }
		]
	}, true, "object 'type' configs and properties");
	//
	await testCompletion(uri, new vscode.Position(207, 4), "f", {
		items: [
			{ label: "fields ProxyStore config", kind: vscode.CompletionItemKind.Property },
			{ label: "filters AbstractStore config", kind: vscode.CompletionItemKind.Property }
		]
	}, true, "object 'type' configs and properties");
	//
	// Do objects with no type or xtype def, line 217
	//
	await testCompletion(uri, new vscode.Position(216, 4), "z", {
		items: []
	}, false, "no type, send non t/x key");
}


export async function xTypeProperties(uri: vscode.Uri)
{
    //
	// Line 167
	// Within main object
	// dockedItems: [
	// {
	//     xtype: "physiciandropdown"
	// }...
	//
	await testCompletion(uri, new vscode.Position(166, 3), "u", {
		items: [
			{ label: "userName UserDropdown config", kind: vscode.CompletionItemKind.Property }
		]
	});
	await testCompletion(uri, new vscode.Position(166, 3), "r", {
		items: [
			{ label: "readOnly UserDropdown", kind: vscode.CompletionItemKind.Property },
		]
	}, true, "inherited xtype properties inside physician object");
	//
	// And 171 for patientdropdown
	//
	await testCompletion(uri, new vscode.Position(170, 3), "u", {
		items: [
			{ label: "userName UserDropdown config", kind: vscode.CompletionItemKind.Property }
		]
	});
	await testCompletion(uri, new vscode.Position(170, 3), "r", {
		items: [
			{ label: "readOnly UserDropdown", kind: vscode.CompletionItemKind.Property },
		]
	}, true, "inherited xtype properties inside patient object");
	//
	// And 175 for userdropdown (props are defined on userdropdown, not inherited)
	//
	await testCompletion(uri, new vscode.Position(174, 3), "u", {
		items: [
			{ label: "userName config", kind: vscode.CompletionItemKind.Property }
		]
	});
	await testCompletion(uri, new vscode.Position(174, 3), "r", {
		items: [
			{ label: "readOnly", kind: vscode.CompletionItemKind.Property },
		]
	});
	//
	// And 182 for an ExtJs component 'textfield'
	//
	await testCompletion(uri, new vscode.Position(181, 3), "a", {
		items: [
			{ label: "allowBlank", kind: vscode.CompletionItemKind.Property },
			{ label: "maxHeight Component config", kind: vscode.CompletionItemKind.Property }
		]
	});
	await testCompletion(uri, new vscode.Position(181, 3), "m", {
		items: [
			{ label: "maxHeight Component config", kind: vscode.CompletionItemKind.Property }
		]
	});
	await testCompletion(uri, new vscode.Position(181, 3), "f", {
		items: [
			{ label: "fieldBodyCls", kind: vscode.CompletionItemKind.Property },
			{ label: "fieldCls Base", kind: vscode.CompletionItemKind.Property },
			{ label: "rawToValue Base", kind: vscode.CompletionItemKind.Property }
			//
			// TODO - Mixin properties (e.g. Ext.form.field.Labelable - fieldLabel)
			//
			// { label: "fieldLabel", kind: vscode.CompletionItemKind.Property }
		]
	});
	//
	// Line 121-123
	// Within a function body
	// const patient = Ext.create('VSCodeExtJS.common.PatientDropdown', {
	//    ...typing here should give 'userName' config and 'readOnly' property,
	//    ...inherited from UserDropdown
	// });
	//
	await testCompletion(uri, new vscode.Position(158, 3), "u", {
		items: [
			{ label: "userName UserDropdown config", kind: vscode.CompletionItemKind.Property }
		]
	});
	await testCompletion(uri, new vscode.Position(158, 3), "r", {
		items: [
			{ label: "readOnly UserDropdown", kind: vscode.CompletionItemKind.Property },
		]
	});
	//
	//
	// Do objects with no type or xtype def, line 217
	//
	await testCompletion(uri, new vscode.Position(189, 3), "z", {
		items: []
	}, false, "no xtype, send non t/x key 2");
}