# VSCODE-EXTJS CHANGE LOG

## Version 0.4.0 (August 17th, 2021)

### Bug Fixes

- **Completion:** incorrect jsdoc is sometimes displayed in child cls mid-classpath list
- **Indexer:** re-index command should only re-index  folders in the current workspace, not entire index tree.
- **Completion:** performing an edit inside of an expression and selecting a completion item does not replace the right side part of the expression path
- **Diagnostics:** the 'ensure xtype' command does not uses the quote char set in settings
- **Completion:** if typing in the value of an xtype property, it gets listed in the completion items after the debounce expiration
- **Completion:** typing into string literal value of xtype property does not populate completion
- **Completion:** xtype insertion is invalid if text folowing the text xtype is present, i.e. ':' or ' '
- **Completion:** extended configs and properties are not added when in the main Ext.define object
- **Completion:** xtype properties and configs are not available for parameter reassignments
- **Completion:** xtype intellisense only works when current editor line is below the xtype definition line
- **Completion:** selecting xtype item with text 'xtype' already present outputs 'xtype: xtype: .....'
- **Completion:** item label tags are only sometimes shown
- **Intellisense:** completion fails if property is preceeded by a keyword, e.g. await
- **Validator:** should not validate an extjs file if the project has no app.json or .extjsrc
- **Providers:** the 'goto definitions' does not work for alternate class name strings
- **Validation:** invalid requires block validation error for reference to an alternateClassName or alias

### Documentation

- **Readme:** add section about initial indexing
- **Readme:** update open source projects list

### Features

- **Validation:** add validation for 'uses' component config
- **Indexer:** handle await expression for variables
- **Completion:** mixins parsed and applied to intellisense

### Performance Enhancements

- **Completion:** reduce # of completion items sent to VSCode engine
- **Indexer:** indexing counts reduced while editing
- **Indexer:** async filesystem cache storage

### Refactoring

- **Completion:** add main namespace class aliases to list of preselects
- **Completion:** only show xtype completion when it is not already defined within an object
- **Logging:** improve logging indentation and levels output

### Build System

- **GitHub Release:** fix - vsix fails to upload with guthub release

## Version 0.3.1 (August 12th, 2021)

### Bug Fixes

- **Providers:** occassionally the 'got to definition' provider just jumps to the top of the current file
- **AST Parser:** static properties are not correctly parsed
- **Providers:** goto type definition for an Ext framework component does not work from a string literal
- **Logging:** the indentation in the logging is incorrect on hover
- **Logging:** logged values are not aligned in some places
- **Providers:** type definition provider for instance property within a method throws unhandled exception
- **AST Parser:** the alternateClassName property is not parsed correctly when it doesn't contain the string '.widget'.

### Refactoring

- **Cache:** change cache mechanism to separate workspace projects
- **AST Parser:** add parsing for 'type' store alias
- **Providers:** validate class that begin with Ext. but are not core framework

## Version 0.3.0 (August 8th, 2021)

### Bug Fixes

- **Hover Provider:** diagnostic quick fix window provided by other extensions is inaccessible due to being overridden by jsdoc hover

### Features

- **Intellisense:** add object property/config intellisense
- **Validation:** add requires array validation

## Version 0.2.1 (August 8th, 2021)

### Bug Fixes

- **Hover Provider:** throws 'Cannot read property nameSpace of undefined' exception in non-ExtJs JavaScript files.

### Documentation

- **Readme:** update todos

## Version 0.2.0 (August 7th, 2021)

### Bug Fixes

- the 'fix requires' quick fix doesn't work if there's no existing requires block
- intellisense should be disabled in strings and comments

### Features

- add 'ignore' options for diagnostic quick fixes

## Version 0.1.1 (August 4th, 2021)

### Documentation

- **Readme:** content update

### Visuals

- update marketplace icon

## Version 0.1.0 (August 3rd, 2021)

### Bug Fixes

- class mappings wrong if 2+ projects define the same alternate class name

### Performance Enhancements

- file system watchers watch only configured classpaths, as opposed to entire workspace directory

### Refactoring

- prompt before re-indexing project when app.json or other config file changes

## Version 0.16.0 (August 1st, 2021)

- initial release
