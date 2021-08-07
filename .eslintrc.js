/*
👋 Hi! This file was autogenerated by tslint-to-eslint-config.
https://github.com/typescript-eslint/tslint-to-eslint-config

It represents the closest reasonable ESLint configuration to this
project's original TSLint configuration.

We recommend eventually switching this configuration to extend from
the recommended rulesets in typescript-eslint. 
https://github.com/typescript-eslint/tslint-to-eslint-config/blob/master/docs/FAQs.md

Happy linting! 💖
*/
module.exports = {
    root: true,
    env: {
        es6: true,
        node: true
    },
    parser: "@typescript-eslint/parser",
    parserOptions: {
        project: [
            "tsconfig.json", "client/tsconfig.json", "server/tsconfig.json", "common/tsconfig.json"
        ],
        sourceType: "module",
        "ecmaVersion": 6
    },
    ignorePatterns: ["testFixture", "lib", "*.js", "*.json" ],
    overrides: [
    {
        "files": ["client/**/*.ts", "common/**/*.js", "server/**/*.js"],
        "excludedFiles": ["testFixture", "lib", "*.js" ]
    }],
    settings: {
    },
    plugins: [
        "eslint-plugin-jsdoc",
        "eslint-plugin-no-null",
        "eslint-plugin-import",
        "eslint-plugin-prefer-arrow",
        "@typescript-eslint",
        "@typescript-eslint/tslint"
    ],
    rules: {
        "@typescript-eslint/adjacent-overload-signatures": "warn",
        "@typescript-eslint/array-type": [
            "warn",
            {
                default: "array"
            }
        ],
        "@typescript-eslint/ban-types": [
            "warn",
            {
                types: {
                    Object: {
                        message: "Avoid using the `Object` type. Did you mean `object`?"
                    },
                    Function: {
                        message: "Avoid using the `Function` type. Prefer a specific function type, like `() => void`, or use `ts.AnyFunction`."
                    },
                    Boolean: {
                        message: "Avoid using the `Boolean` type. Did you mean `boolean`?"
                    },
                    Number: {
                        message: "Avoid using the `Number` type. Did you mean `number`?"
                    },
                    String: {
                        message: "Avoid using the `String` type. Did you mean `string`?"
                    }
                }
            }
        ],
        "@typescript-eslint/consistent-type-assertions": "off",
        "@typescript-eslint/consistent-type-definitions": "warn",
        "@typescript-eslint/dot-notation": "warn",
        "@typescript-eslint/explicit-member-accessibility": [
            "off",
            {
                accessibility: "explicit"
            }
        ],
        "@typescript-eslint/indent": "off",
        "@typescript-eslint/member-delimiter-style": [
            "warn",
            {
                multiline: {
                    delimiter: "semi",
                    requireLast: true
                },
                singleline: {
                    delimiter: "semi",
                    requireLast: false
                }
            }
        ],
        "@typescript-eslint/member-ordering": "off",
        "@typescript-eslint/naming-convention": "warn",
        "@typescript-eslint/no-empty-function": "off",
        "@typescript-eslint/no-empty-interface": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-inferrable-types": "warn",
        "@typescript-eslint/no-misused-new": "warn",
        "@typescript-eslint/no-namespace": "off",
        "@typescript-eslint/no-parameter-properties": "off",
        "@typescript-eslint/no-shadow": [
            "off",
            {
                hoist: "all"
            }
        ],
        "@typescript-eslint/no-this-alias": "off",
        "@typescript-eslint/no-unnecessary-qualifier": "warn",
        "@typescript-eslint/no-unnecessary-type-assertion": "warn",
        "@typescript-eslint/no-unused-expressions": "warn",
        "@typescript-eslint/no-use-before-define": "off",
        "@typescript-eslint/no-var-requires": "off",
        "@typescript-eslint/prefer-for-of": "off",
        "@typescript-eslint/prefer-function-type": "warn",
        "@typescript-eslint/prefer-namespace-keyword": "warn",
        "@typescript-eslint/quotes": [
            "warn",
            "double",
            {
                avoidEscape: true
            }
        ],
        "@typescript-eslint/semi": [
            "warn",
            "always"
        ],
        "@typescript-eslint/triple-slash-reference": [
            "off",
            {
                path: "always",
                types: "prefer-import",
                lib: "always"
            }
        ],
        "@typescript-eslint/type-annotation-spacing": "warn",
        "@typescript-eslint/unified-signatures": "warn",
        "arrow-body-style": "off",
        "arrow-parens": [
            "off",
            "always"
        ],
        "brace-style": [
            "off",
            "1tbs"
        ],
        "comma-dangle": "off",
        "complexity": "off",
        "constructor-super": "warn",
        "curly": [
            "warn",
            "multi-line"
        ],
        "eol-last": "off",
        "eqeqeq": [
            "warn",
            "always"
        ],
        "guard-for-in": "off",
        "id-blacklist": [
            "warn",
            "any",
            "Number",
            "number",
            "String",
            "string",
            "Boolean",
            "boolean",
            "Undefined",
            "undefined"
        ],
        "id-match": "warn",
        "import/no-extraneous-dependencies": [
            "warn", {
                "devDependencies": false,
                "packageDir": [
                    "./", "./server", "./client" 
                ]
            }
        ],
        "import/no-internal-modules": "off",
        "import/order": "off",
        "jsdoc/check-alignment": "warn",
        "jsdoc/check-indentation": "off",
        "jsdoc/newline-after-description": "warn",
        "linebreak-style": "off",
        "max-classes-per-file": "off",
        "max-len": "off",
        "new-parens": "warn",
        "no-bitwise": "off",
        "no-caller": "warn",
        "no-cond-assign": "off",
        "no-console": "off",
        "no-debugger": "off",
        "no-duplicate-case": "warn",
        "no-duplicate-imports": "warn",
        "no-empty": "off",
        "no-eval": "warn",
        "no-extra-bind": "warn",
        "no-fallthrough": "warn",
        "no-invalid-this": "off",
        "no-multiple-empty-lines": "off",
        "no-new-func": "warn",
        "no-new-wrappers": "warn",
        "no-null/no-null": "off",
        "no-redeclare": "warn",
        "no-return-await": "warn",
        "no-sequences": "off",
        "no-sparse-arrays": "warn",
        "no-template-curly-in-string": "warn",
        "no-throw-literal": "warn",
        "no-trailing-spaces": "warn",
        "no-undef-init": "warn",
        "no-underscore-dangle": "off",
        "no-unsafe-finally": "warn",
        "no-unused-labels": "warn",
        "no-var": "warn",
        "object-shorthand": "warn",
        "one-var": [
            "off",
            "never"
        ],
        "prefer-arrow/prefer-arrow-functions": "off",
        "prefer-const": "warn",
        "prefer-object-spread": "warn",
        "quote-props": [
            "warn",
            "consistent-as-needed"
        ],
        "radix": "off",
        "space-before-function-paren": "off",
        "space-in-parens": [
            "warn",
            "never"
        ],
        "spaced-comment": [
            "warn",
            "always",
            {
                markers: [
                    "/"
                ]
            }
        ],
        "use-isnan": "warn",
        "valid-typeof": "off",
        "@typescript-eslint/tslint/config": [
            "error",
            {
                rules: {
                    "ban": [
                        true,
                        "setInterval"
                    ],
                    "whitespace": [
                        true,
                        "check-branch",
                        "check-decl",
                        "check-operator",
                        "check-module",
                        "check-separator",
                        "check-type"
                    ]
                }
            }
        ]
    }
};
