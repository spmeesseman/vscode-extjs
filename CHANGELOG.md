# VSCODE-EXTJS CHANGE LOG

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
