# ExtJs Language Server - Intellisense, Code Completion, and More

## NOT YET RELEASED!!  DO NOT INSTALL

[![authors](https://img.shields.io/badge/authors-scott%20meesseman-6F02B5.svg?logo=visual%20studio%20code)](https://www.littlesm.com)
[![Installs](https://vsmarketplacebadge.apphb.com/installs-short/spmeesseman.vscode-extjs.svg)](https://marketplace.visualstudio.com/items?itemName=spmeesseman.vscode-extjs)
[![Downloads](https://vsmarketplacebadge.apphb.com/downloads-short/spmeesseman.vscode-extjs.svg)](https://marketplace.visualstudio.com/items?itemName=spmeesseman.vscode-extjs)
[![Ratings](https://vsmarketplacebadge.apphb.com/rating-short/spmeesseman.vscode-extjs.svg)](https://marketplace.visualstudio.com/items?itemName=spmeesseman.vscode-extjs&ssr=false#review-details)
[![PayPalDonate](https://img.shields.io/badge/paypal-donate-green.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=YWZXT3KE2L4BA&item_name=extjs&currency_code=USD)

[![GitHub issues open](https://img.shields.io/github/issues-raw/spmeesseman/vscode%2dextjs.svg?logo=github)](https://github.com/spmeesseman/vscode-extjs/issues)
[![GitHub issues closed](https://img.shields.io/github/issues-closed-raw/spmeesseman/vscode%2dextjs.svg?logo=github)](https://github.com/spmeesseman/vscode-extjs/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/spmeesseman/vscode%2dextjs.svg?logo=github)](https://github.com/spmeesseman/vscode-extjs/pulls)
[![GitHub last commit](https://img.shields.io/github/last-commit/spmeesseman/vscode%2dextjs.svg?logo=github)](https://github.com/spmeesseman/vscode-extjs)
[![app-publisher](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-app--publisher-e10000.svg)](https://github.com/perryjohnsoninc/app-publisher)

## Table of Contents

- [ExtJs Language Server - Intellisense, Code Completion, and More](#extjs-language-server---intellisense-code-completion-and-more)
  - [NOT YET RELEASED!!  DO NOT INSTALL](#not-yet-released--do-not-install)
  - [Table of Contents](#table-of-contents)
  - [Description](#description)
  - [Configuration](#configuration)
    - [The app.json ExtJs Project File](#the-appjson-extjs-project-file)
    - [The .extjsrc.json Configuration File](#the-extjsrcjson-configuration-file)
    - [The include Setting](#the-include-setting)
    - [Required Configuration Properties](#required-configuration-properties)
      - [Required Configuration Property - `name`](#required-configuration-property---name)
      - [Required Configuration Property - `classpath`](#required-configuration-property---classpath)
  - [Versus the Sencha Extension](#versus-the-sencha-extension)
  - [ESLint](#eslint)
  - [Caching](#caching)
  - [Thank You](#thank-you)
  - [Feedback & Contributing](#feedback--contributing)
    - [Rate It - Leave Some Stars](#rate-it---leave-some-stars)
  - [Other Code Extensions by spmeesseman](#other-code-extensions-by-spmeesseman)
  - [Donations](#donations)
  - [TODO](#todo)

## Description

ExtJs Intellisense and Language Server, because Sencha can't.

- Supports multi-root workspace
- Automatic parsing, no manual configuration needed
- Method, Config, and Property JSDoc/Comments Hover
- Code Completion Intellisense with Inline JSDoc/Comments
- Method Signature Intellisense with Inline JSDoc/Comments
- Method Parameter Validation
- XType Validation and Completion (Credits to Original Author **qzsiniong**)
- Method and Class Validation

_**IMPORTANT NOTE**_: This extension is a work in progress, ~ 50-60% done on all the functionality I'd like to complete.  Please don;t go nuts o the bug reporting, again thisis **incomplete**, but, still good enough to get benefit from using.

## Configuration

Assuming a standard JavaScript linter is already in place, the ExtJs Language Server attempts to provide the missing functionality that a standard JavaScript Language Server cannot handle due to the nature of the ExtJS class definitions, which are basically just one function expression per class file as far as a standard JavaScript parser is concerned.

A standard linter used in most all JavaScript projects is [ESLint](https://github.com/eslint/eslint), some quick install details can be found in the [section below](#eslint).  Don't use the *Sencha ESLint Plugin* for linting in your ExtJS projects, it's garbage and will slow everything down like nothing I've ever seen.

This language server looks at your entire workspace, whether single or multi root, and locates ExtJS files in one of three ways, or any combination thereof:

1. app.json / workspace.json
2. .extjsrc.json
3. settings.json / VSCode Settings

### The app.json ExtJs Project File

The **app.json** file is a part of all Sencha Cmd and Sencha ext-gen generated Open Tooling projects.  If an **app.json** file is located, the namespaces and classpaths are extracted and added to indexing.  If a corresponding **workspace.json** file is located in the same directory as an **app.json** file, classpaths are extracted from the *packages.dir* property and added to indexing.  The *packages.dir* property should be a comma delimited string of package paths included in the application classpath, these normally specify the paths to the packages included in the *requires* array property of the **app.json** file.

### The .extjsrc.json Configuration File

The **.extjsrc.json** / **.extjsrc** file is a custom file that can be placed into any directory.  If an **.extjsrc** file is located, the namespace and classpaths are extracted and added to indexing.

The **.extjsrc** file can contain any of the defined properties of a Sencha ExtJS project **app.json** file, but must in the least contain the following two properties:

1. name
2. classpath

### The include Setting

The **include** path(s) can be set to a string or an array of strings of additional paths to be indexed.  These strings must be in the form:

    NAME|RELATIVE_DIRECTORY

The `NAME` part represents the `name` field [described below](#required-configuration-property---name).  The `RELATIVE_DIRECTORY` is a directory that is *relative* to the workspace folders and represents the `classpath` field [described below](#required-configuration-property---classpath).

### Required Configuration Properties

Whether or not an [app.json](#the-appjson-extjs-project-file), [.extjsrc.json](#the-extjsrcjson-configuration-file), or [include](#the-include-setting) path is used, there are two required properties that must be present for any of the cofiguration types.  For **include** paths, see the [section above](#the-include-setting) describing how to specify both of these properties in the Settings entries.  These twp properties are `name` and `classpath`...

#### Required Configuration Property - `name`

The `name` is a string specifying the project name, or main project namespace.  FOr example, if your ExtJS files are defined like:

    VSCodeExtJs.view.common.Users
    VSCodeExtJs.view.common.Admins

Then the default namespace / project name, in most cases, would be "VSCodeExtJS".  This field corresponds to the `name` property of an [app.json](#the-appjson-extjs-project-file) file.

#### Required Configuration Property - `classpath`

The `classpath` is a string, or an array of strings, of where the ExtJS JavaScript files can be located.  This field corresponds to the `classpath` property of an [app.json](#the-appjson-extjs-project-file) file.

Note that classpaths defined in `toolkit` object properties in [app.json](#the-appjson-extjs-project-file) will be merged into the main object classpath for indexing.

That's it, ExtJS Languge Server should start indexing your files once a valid configuration file has been found.

## Versus the Sencha Extension

This extension is unable to perform the app/workspace commands using Sencha Cmd that the Sencha extension provides.

Aside from that, the ExtJs Language Server provides everything else it is capable of:

1. `Intellisense` and `Code Completion` for class members and local controller variables created with Ext.create.
2. `Go To Definition` for classes and class string literals.
3. Static configuration file for specifying project name and classpaths to parse.

And, in addition:

1. Free :)
2. `Multi-Root Workspace` Support.
3. `Intellisense` with Full `JSDoc`.
4. Method Signature / inline parameter helper with `JsDoc`.
5. `Hover JsDoc` for all classes, methods, properties, configs, xtypes and class string literals.
6. Static vs. Instance `Intellisense`.
7. `Go To Definition` for xtype string literals (credits to [qzsiniong](#thank-you)).
8. `XType validation` and `requires` field checking (credits to [qzsiniong](#thank-you)).
9. Command Pallette command for fixing invalidated xtype declarations (credits to [qzsiniong](#thank-you)).
10. Diagnostic `Quick Fix` and Command Pallette command for fixing invalidated xtype declarations.
11. Parses [app.json](#the-appjson-extjs-project-file), *workspace.json*, and *package.json* files for `auto-import of classpaths`, including dependencies.
12. Turn on/off the inclusion of deprecated class members into `Intellisense` directly in VSCode Settings.
13. Turn on/off the inclusion of private class members into `Intellisense` directly in VSCode Settings.
14. Configure specific classpaths for Indexing directly in VSCode Settings.
15. `Since`, `Deprecated`, and `Private` `JsDoc` tags and `Intellisense` tags.
16. Parsing performance is slightly slower the first time the extensionl loads, but subsequent usage sees parsing performance @ ~ 1.4-1.5x faster.
17. Parses ES2016+ syntax using latest Babel code parser and AST traversal.
18. Configurable validation timeout useful for slower systems.
19. Miscellaneous custom validations.
20. Doesn't require yet another .sencha directory to be created.

## ESLint

Always use [ESLint](https://github.com/eslint/eslint) for JavaScript/TypeScript projects.  It is **GREAT**.  To install ESLint to a project, run the following command from the root project directory containing the package.json file:

    npm install --save-dev eslint

**Or** install globally:

    npm install -g eslint

A configuration file is required in the root project directory, usually the same directory that the *package.json* file would be in.  The file can be a JavaScript ot a JSON file:

    .eslintrc.js
    .eslintrc.json

To create a default connfiguration file in a project that does not contain one, run the following command from the root project directory containing the *package.json* file:

    npx eslint --init

You should now have an [.extjsrc.js](#the-extjsrcjson-configuration-file) file in the directory the command has been ran in.

Add your ExtJS globals to the config file, or any other globals not understood by eslint, primarily *Ext* ad your project namespace:

    "globals": {
        "Ext": "readonly",
        "MyApp": "writable",
        "SharedArrayBuffer": "readonly",
        "ArrayBuffer": "readonly",
        "DataView": "readonly"
    }

Linting is dynamic as you edit files.  But also create a task in package.json for linting reports.  For example, if the JavaScript code is located in the directory *app*:

    "scripts": {
        ...existing scripts...
        "lint": "eslint -c .eslintrc.json --ext .js ./app"
    }

**NOTE**: Do not use the *Sencha ESLint Plugin* for linting, it's garbage and will slow everything down like nothing I've ever seen.

## Caching

The first time the extension activates, it will index all ExtJS files found within the workspace.  This could take a while depending on the # of ExtJS projects/files found.  The ExtJS Language Server will cache the syntax tree after the initial build, improving performance by 2-3x over what it is without caching once the initial index is built.

## Thank You

Whenever I start a project I always look for a good base to start from and for this extension I lucked out and found a perfect base project written by **qzsiniong** from GitHub, his project is located [here](https://github.com/qzsiniong/vscode-extjs).

## Feedback & Contributing

- Please report any bugs, suggestions or documentation requests via the
  [Issues](https://github.com/spmeesseman/vscode-extjs/issues)
- Feel free to submit
  [Pull Requests](https://github.com/spmeesseman/vscode-extjs/pulls)
- [Contributors](https://github.com/spmeesseman/vscode-extjs/graphs/contributors)

### Rate It - Leave Some Stars

Please rate your experience with stars... [like five of them ;)](https://marketplace.visualstudio.com/items?itemName=spmeesseman.vscode-extjs&ssr=false#review-details)

## Other Code Extensions by spmeesseman

| Package           | Repository                                                     | Marketplace                                                                                                          |
| ----------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| vscode-taskexplorer | [GitHub](https://github.com/spmeesseman/vscode-taskexplorer) | [Visual Studio Marketplace](https://marketplace.visualstudio.com/itemdetails?itemName=spmeesseman.vscode-taskexplorer) |
| vscode-vslauncher | [GitHub](https://github.com/spmeesseman/vscode-vslauncher)     | [Visual Studio Marketplace](https://marketplace.visualstudio.com/itemdetails?itemName=spmeesseman.vscode-vslauncher) |
| svn-scm-ext       | [GitHub](https://github.com/spmeesseman/svn-scm-ext)           | [Visual Studio Marketplace](https://marketplace.visualstudio.com/itemdetails?itemName=spmeesseman.svn-scm-ext)       |

## Donations

If my work and this extension has made your life easier, consider a [donation](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=YWZXT3KE2L4BA&item_name=extjs&currency_code=USD).  All donations go straight to the *Single Dad ATM*.

## TODO

- Intellisense should be disabled in comments within a method (if not in a methid, is fine)
- goto definition for jsdoc parameter types (surrounded with{})
- If jsdoc isnt present for an overridden method, then check for parent method jsdoc
- Handle the @inheritdoc tag
- Handle links in jsdoc
- If there's a jsdoc hover popup, the QUickFix diloag doesnt display, jsdoc popup overrides it somehow?
- The "% done" status label is showing a ton of decimal l=places i.e. xx.3333333333333333333333% complete
- the 'fix requires' feature doesnt work if there's no existing requires block.  it should add one if not there.
- When Sencha Cmd is building, the indexer goes nuts, is it the build dir?
