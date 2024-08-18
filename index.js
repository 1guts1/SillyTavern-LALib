import { callPopup, characters, chat, chat_metadata, eventSource, event_types, extractMessageBias, getRequestHeaders, messageFormatting, name1, name2, reloadMarkdownProcessor, saveChatConditional, saveChatDebounced, sendSystemMessage, substituteParams } from '../../../../script.js';
import { getMessageTimeStamp } from '../../../RossAscends-mods.js';
import { extension_settings, getContext } from '../../../extensions.js';
import { findGroupMemberId, groups, selected_group } from '../../../group-chats.js';
import { executeSlashCommands, executeSlashCommandsWithOptions } from '../../../slash-commands.js';
import { SlashCommand } from '../../../slash-commands/SlashCommand.js';
import { SlashCommandAbortController } from '../../../slash-commands/SlashCommandAbortController.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from '../../../slash-commands/SlashCommandArgument.js';
import { SlashCommandClosure } from '../../../slash-commands/SlashCommandClosure.js';
import { SlashCommandClosureResult } from '../../../slash-commands/SlashCommandClosureResult.js';
import { SlashCommandEnumValue } from '../../../slash-commands/SlashCommandEnumValue.js';
import { SlashCommandParser } from '../../../slash-commands/SlashCommandParser.js';
import { debounce, delay, escapeRegex, isFalseBoolean, isTrueBoolean, uuidv4 } from '../../../utils.js';
import { world_info } from '../../../world-info.js';
import { quickReplyApi } from '../../quick-reply/index.js';



/**
 * Parses boolean operands from command arguments.
 * @param {object} args Command arguments
 * @returns {{a: string | number, b: string | number, rule: string}} Boolean operands
 */
function parseBooleanOperands(args) {
    // Resolution order: numeric literal, local variable, global variable, string literal
    /**
     * @param {string} operand Boolean operand candidate
     */
    function getOperand(operand) {
        if (operand === undefined) {
            return '';
        }

        const operandNumber = Number(operand);

        if (!isNaN(operandNumber)) {
            return operandNumber;
        }

        if (args._scope.existsVariable(operand)) {
            const operandVariable = args._scope.getVariable(operand);
            return operandVariable ?? '';
        }

        if (chat_metadata?.variables?.[operand] !== undefined) {
            const operandLocalVariable = chat_metadata.variables[operand];
            return operandLocalVariable ?? '';
        }

        if (extension_settings?.variables?.[operand] !== undefined) {
            const operandGlobalVariable = extension_settings.variables[operand];
            return operandGlobalVariable ?? '';
        }

        const stringLiteral = String(operand);
        return stringLiteral || '';
    }

    const left = getOperand(args.a || args.left || args.first || args.x);
    const right = getOperand(args.b || args.right || args.second || args.y);
    const rule = args.rule;

    return { a: left, b: right, rule };
}

/**
 * Evaluates a boolean comparison rule.
 * @param {string} rule Boolean comparison rule
 * @param {string|number} a The left operand
 * @param {string|number} b The right operand
 * @returns {boolean} True if the rule yields true, false otherwise
 */
function evalBoolean(rule, a, b) {
    if (!rule) {
        toastr.warning('The rule must be specified for the boolean comparison.', 'Invalid command');
        throw new Error('Invalid command.');
    }

    let result = false;

    if (typeof a === 'string' && typeof b !== 'number') {
        const aString = String(a).toLowerCase();
        const bString = String(b).toLowerCase();

        switch (rule) {
            case 'in':
                result = aString.includes(bString);
                break;
            case 'nin':
                result = !aString.includes(bString);
                break;
            case 'eq':
                result = aString === bString;
                break;
            case 'neq':
                result = aString !== bString;
                break;
            default:
                toastr.error('Unknown boolean comparison rule for type string.', 'Invalid /if command');
                throw new Error('Invalid command.');
        }
    } else if (typeof a === 'number') {
        const aNumber = Number(a);
        const bNumber = Number(b);

        switch (rule) {
            case 'not':
                result = !aNumber;
                break;
            case 'gt':
                result = aNumber > bNumber;
                break;
            case 'gte':
                result = aNumber >= bNumber;
                break;
            case 'lt':
                result = aNumber < bNumber;
                break;
            case 'lte':
                result = aNumber <= bNumber;
                break;
            case 'eq':
                result = aNumber === bNumber;
                break;
            case 'neq':
                result = aNumber !== bNumber;
                break;
            default:
                toastr.error('Unknown boolean comparison rule for type number.', 'Invalid command');
                throw new Error('Invalid command.');
        }
    }

    return result;
}


function getListVar(local, global, literal) {
    let list;
    if (local) {
        try {
            list = JSON.parse(chat_metadata?.variables?.[local]);
        } catch { /* empty */ }
    }
    if (!list && global) {
        try {
            list = JSON.parse(extension_settings.variables?.global?.[global]);
        } catch { /* empty */ }
    }
    if (!list && literal) {
        if (typeof literal == 'string') {
            try {
                list = JSON.parse(literal);
            } catch { /* empty */ }
        } else if (typeof literal == 'object') {
            list = literal;
        }
    }
    return list;
}

function getVar(local, global, literal) {
    let value;
    if (local) {
        value = chat_metadata?.variables?.[local];
    }
    if (value === undefined && global) {
        value = extension_settings.variables?.global?.[global];
    }
    if (value === undefined && literal != null) {
        value = literal;
    }
    return value;
}

function getRange(text, value) {
    const re = /^(-?\d+)(?:(-)(-?\d+)?)?$/;
    if (!re.test(text)) {
        throw new Error(`Invalid range: "${text}"`);
    }
    let [_, start, isRange, end] = re.exec(text);
    start = Number(start);
    if (!isRange) {
        if (start == -1) {
            return value.slice(start);
        }
        return value.slice(start, start + 1);
    }
    if (end === undefined) {
        return value.slice(start);
    }
    return value.slice(start, Number(end) + 1);
}




// GROUP: Help
SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'lalib?',
    callback: async () => {
        const converter = reloadMarkdownProcessor();
        const readme = await (await fetch('/scripts/extensions/third-party/SillyTavern-LALib/README.md')).text();
        const html = converter.makeHtml(readme).replace(/<br\s*\/?>/g, '<br style="display:block;">');
        console.log('LALIB', html);
        sendSystemMessage('generic', html);
        return '';
    },
    helpString: 'Lists LALib commands',
}));



// GROUP: Boolean Operations
SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'test',
    callback: (args) => {
        const { a, b, rule } = parseBooleanOperands(args);
        return JSON.stringify(evalBoolean(rule, a, b));
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({ name: 'left',
            description: 'the left operand value',
            typeList: [ARGUMENT_TYPE.VARIABLE_NAME, ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.STRING],
            isRequired: true,
        }),
        SlashCommandNamedArgument.fromProps({ name: 'rule',
            description: 'the boolean operation rule',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
            enumList: [
                new SlashCommandEnumValue('gt',  'a > b'),
                new SlashCommandEnumValue('gte', 'a >= b'),
                new SlashCommandEnumValue('lt',  'a < b'),
                new SlashCommandEnumValue('lte', 'a <= b'),
                new SlashCommandEnumValue('eq',  'a == b'),
                new SlashCommandEnumValue('neq', 'a !== b'),
                new SlashCommandEnumValue('not', '!a'),
                new SlashCommandEnumValue('in',  'a includes b'),
                new SlashCommandEnumValue('nin', 'a not includes b'),
            ],
        }),
        SlashCommandNamedArgument.fromProps({ name: 'right',
            description: 'the right operand value',
            typeList: [ARGUMENT_TYPE.VARIABLE_NAME, ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.STRING],
            isRequired: true,
        }),
    ],
    helpString: `
        <div>
            Compares the value of the left operand <code>a</code> with the value of the right operand <code>b</code>,
            and returns the result of the comparison (true or false).
        </div>
        <div>
            Numeric values and string literals for left and right operands supported.
        </div>
        <div>
            <strong>Available rules:</strong>
            <ul>
                <li>gt => a > b</li>
                <li>gte => a >= b</li>
                <li>lt => a < b</li>
                <li>lte => a <= b</li>
                <li>eq => a == b</li>
                <li>neq => a != b</li>
                <li>not => !a</li>
                <li>in (strings) => a includes b</li>
                <li>nin (strings) => a not includes b</li>
            </ul>
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code class="language-stscript">/setvar key=i 0 | /test left=i rule=let right=10 | /echo</code></pre>
                </li>
            </ul>
        </div>
    `,
    returns: 'true or false',
}));


SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'and',
    callback: (args) => {
        let left = args.left;
        try { left = isTrueBoolean(args.left); } catch { /*empty*/ }
        let right = args.right;
        try { right = isTrueBoolean(args.right); } catch { /*empty*/ }
        return JSON.stringify((left && right) == true);
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({ name: 'left',
            description: 'the left value to evaluate',
            typeList: [ARGUMENT_TYPE.BOOLEAN],
            isRequired: true,
        }),
        SlashCommandNamedArgument.fromProps({ name: 'right',
            description: 'the right value to evaluate',
            typeList: [ARGUMENT_TYPE.BOOLEAN],
            isRequired: true,
        }),
    ],
    helpString: 'Returns true if both left and right are true, otherwise false.',
    returns: 'true or false',
}));


SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'or',
    callback: (args) => {
        let left = args.left;
        try { left = isTrueBoolean(args.left); } catch { /*empty*/ }
        let right = args.right;
        try { right = isTrueBoolean(args.right); } catch { /*empty*/ }
        return JSON.stringify((left || right) == true);
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({ name: 'left',
            description: 'the left value to evaluate',
            typeList: [ARGUMENT_TYPE.BOOLEAN],
            isRequired: true,
        }),
        SlashCommandNamedArgument.fromProps({ name: 'right',
            description: 'the right value to evaluate',
            typeList: [ARGUMENT_TYPE.BOOLEAN],
            isRequired: true,
        }),
    ],
    helpString: 'Returns true if at least one of left and right are true, false if both are false.',
    returns: 'true or false',
}));


SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'not',
    callback: (args, value) => {
        return JSON.stringify(isTrueBoolean(value) != true);
    },
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the value to negate',
            typeList: [ARGUMENT_TYPE.BOOLEAN],
            isRequired: true,
        }),
    ],
    helpString: 'Returns true if value is false, otherwise true.',
    returns: 'true or false',
}));



// GROUP: List Operations
SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'foreach',
    /**
     *
     * @param {import('../../../slash-commands/SlashCommand.js').NamedArguments} args
     * @param {(string|SlashCommandClosure)[]} value
     */
    callback: async (args, value) => {
        let list = getListVar(args.var, args.globalvar, args.list);
        let result;
        const isList = Array.isArray(list);
        if (isList) {
            list = list.map((it, idx) => [idx, it]);
        } else if (typeof list == 'object') {
            list = Object.entries(list);
        }
        /**@type {string|SlashCommandClosure} */
        let command;
        if (value) {
            if (value[0] instanceof SlashCommandClosure) {
                command = value[0];
            } else {
                command = value.join(' ');
            }
        }
        if (Array.isArray(list)) {
            /**@type {SlashCommandClosureResult}*/
            let commandResult;
            for (let [index, item] of list) {
                if (typeof item == 'object') {
                    item = JSON.stringify(item);
                }
                if (command instanceof SlashCommandClosure) {
                    command.scope.setMacro('item', item);
                    command.scope.setMacro('index', index);
                    commandResult = (await command.execute());
                    if (commandResult.isAborted) break;
                } else {
                    commandResult = (await executeSlashCommandsWithOptions(
                        command.replace(/{{item}}/ig, item).replace(/{{index}}/ig, index),
                        {
                            handleExecutionErrors: false,
                            handleParserErrors: false,
                            parserFlags: args._parserFlags,
                            scope: args._scope,
                            abortController: args._abortController,
                        },
                    ));
                    if (commandResult.isAborted) {
                        args._abortController.abort(commandResult.abortReason, true);
                        break;
                    }
                }
                result = commandResult.pipe;
            }
            return result;
        }
        if (typeof result != 'string') {
            result = JSON.stringify(result);
        }
        return result;
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({ name: 'list',
            description: 'the list to iterate over',
            typeList: [ARGUMENT_TYPE.LIST, ARGUMENT_TYPE.DICTIONARY],
        }),
        SlashCommandNamedArgument.fromProps({ name: 'var',
            description: 'name of the chat variable to use as the list',
            typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
        }),
        SlashCommandNamedArgument.fromProps({ name: 'globalvar',
            description: 'name of the global variable to use as the list',
            typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the command to execute for each item, with {{item}} and {{index}} placeholders',
            typeList: [ARGUMENT_TYPE.SUBCOMMAND, ARGUMENT_TYPE.CLOSURE],
            isRequired: true,
        }),
    ],
    splitUnnamedArgument: true,
    helpString: 'Executes the provided command for each item of a list or dictionary, replacing {{item}} and {{index}} with the current item and index.',
    returns: 'result of executing the command on the last item',
}));


SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'map',
    /**
     *
     * @param {import('../../../slash-commands/SlashCommand.js').NamedArguments} args
     * @param {(string|SlashCommandClosure)[]} value
     */
    callback: async (args, value) => {
        let list = getListVar(args.var, args.globalvar, args.list);
        let result;
        const isList = Array.isArray(list);
        if (isList) {
            list = list.map((it, idx) => [idx, it]);
            result = [];
        } else if (typeof list == 'object') {
            list = Object.entries(list);
            result = {};
        }
        /**@type {string|SlashCommandClosure} */
        let command;
        if (value) {
            if (value[0] instanceof SlashCommandClosure) {
                command = value[0];
            } else {
                command = value.join(' ');
            }
        }
        if (Array.isArray(list)) {
            /**@type {SlashCommandClosureResult}*/
            let commandResult;
            for (let [index, item] of list) {
                if (typeof item == 'object') {
                    item = JSON.stringify(item);
                }
                if (command instanceof SlashCommandClosure) {
                    command.scope.setMacro('item', item);
                    command.scope.setMacro('index', index);
                    commandResult = (await command.execute());
                    if (commandResult.isAborted) break;
                } else {
                    commandResult = (await executeSlashCommandsWithOptions(
                        command.replace(/{{item}}/ig, item).replace(/{{index}}/ig, index),
                        {
                            handleExecutionErrors: false,
                            handleParserErrors: false,
                            parserFlags: args._parserFlags,
                            scope: args._scope,
                            abortController: args._abortController,
                        },
                    ));
                    if (commandResult.isAborted) {
                        args._abortController.abort(commandResult.abortReason, true);
                        break;
                    }
                }
                result[index] = commandResult.pipe;
                try { result[index] = JSON.parse(result[index]); } catch { /*empty*/ }
            }
        } else {
            result = list;
        }
        if (isTrueBoolean(args.asList) && !isList) {
            result = Object.keys(result).map(it => result[it]);
        }
        if (typeof result != 'string') {
            result = JSON.stringify(result);
        }
        return result;
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({ name: 'asList',
            description: 'whether to return the results of a dictionary/object as a list',
            typeList: [ARGUMENT_TYPE.BOOLEAN],
            defaultValue: 'false',
            enumList: ['true', 'false'],
        }),
        SlashCommandNamedArgument.fromProps({ name: 'list',
            description: 'the list to map over',
            typeList: [ARGUMENT_TYPE.LIST],
        }),
        SlashCommandNamedArgument.fromProps({ name: 'var',
            description: 'name of the chat variable to use as the list',
            typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
        }),
        SlashCommandNamedArgument.fromProps({ name: 'globalvar',
            description: 'name of the global variable to use as the list',
            typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the command to execute for each item, with {{item}} and {{index}} placeholders',
            typeList: [ARGUMENT_TYPE.SUBCOMMAND, ARGUMENT_TYPE.CLOSURE],
            isRequired: true,
        }),
    ],
    splitUnnamedArgument: true,
    returns: 'list or dictionary of the command results',
    helpString: `
        <div>
            Executes a command for each item of a list or dictionary and returns the list or dictionary of the command results.
        </div>
        <div>
            <strong>Examples:</strong>
            <ul>
                <li>
                    <pre><code class="language-stscript">/map list=[1,2,3] {: /mul {{item}} {{item}} :}</code></pre>
                    Calculates the square of each number.
                </li>
            </ul>
        </div>
    `,
}));


SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'filter',
    /**
     *
     * @param {import('../../../slash-commands/SlashCommand.js').NamedArguments} args
     * @param {(string|SlashCommandClosure)[]} value
     */
    callback: async (args, value) => {
        let list = getListVar(args.var, args.globalvar, args.list);
        let result;
        const isList = Array.isArray(list);
        if (isList) {
            list = list.map((it, idx) => [idx, it]);
            result = [];
        } else if (typeof list == 'object') {
            list = Object.entries(list);
            result = {};
        }
        /**@type {string|SlashCommandClosure} */
        let command;
        if (value) {
            if (value[0] instanceof SlashCommandClosure) {
                command = value[0];
            } else {
                command = value.join(' ');
            }
        }
        if (Array.isArray(list)) {
            /**@type {SlashCommandClosureResult}*/
            let commandResult;
            for (let [index, item] of list) {
                if (typeof item == 'object') {
                    item = JSON.stringify(item);
                }
                let outcome;
                if (command instanceof SlashCommandClosure) {
                    command.scope.setMacro('item', item);
                    command.scope.setMacro('index', index);
                    commandResult = (await command.execute());
                    if (commandResult.isAborted) break;
                } else {
                    commandResult = (await executeSlashCommandsWithOptions(
                        command.toString().replace(/{{item}}/ig, item).replace(/{{index}}/ig, index),
                        {
                            handleExecutionErrors: false,
                            handleParserErrors: false,
                            parserFlags: args._parserFlags,
                            scope: args._scope,
                            abortController: args._abortController,
                        },
                    ));
                    if (commandResult.isAborted) {
                        args._abortController.abort(commandResult.abortReason, true);
                        break;
                    }
                }
                outcome = commandResult.pipe;
                if (isTrueBoolean(outcome)) {
                    if (isList) {
                        result.push(item);
                    } else {
                        result[index] = item;
                    }
                }
            }
        } else {
            result = list;
        }
        if (typeof result != 'string') {
            result = JSON.stringify(result);
        }
        return result;
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({ name: 'list',
            description: 'the list or dictionary to filter',
            typeList: [ARGUMENT_TYPE.LIST, ARGUMENT_TYPE.DICTIONARY],
        }),
        SlashCommandNamedArgument.fromProps({ name: 'var',
            description: 'name of the chat variable containing the list or dictionary',
            typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
        }),
        SlashCommandNamedArgument.fromProps({ name: 'globalvar',
            description: 'name of the global variable containing the list or dictionary',
            typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the command to execute for each item, with {{item}} and {{index}} placeholders',
            typeList: [ARGUMENT_TYPE.SUBCOMMAND, ARGUMENT_TYPE.CLOSURE],
            isRequired: true,
        }),
    ],
    splitUnnamedArgument: true,
    helpString: `
        <div>
            Executes command for each item of a list or dictionary and returns the list or dictionary of only those items where the command returned true.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code class="language-stscript">/filter list=[1,2,3,4,5] {: /test left={{item}} rule=gt right=2 :}</code></pre>
                    returns [3, 4, 5]
                </li>
            </ul>
        </div>
    `,
    returns: 'the filtered list or dictionary',
}));


SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'find',
    /**
     *
     * @param {import('../../../slash-commands/SlashCommand.js').NamedArguments} args
     * @param {(string|SlashCommandClosure)[]} value
     */
    callback: async (args, value) => {
        let list = getListVar(args.var, args.globalvar, args.list);
        let result;
        const isList = Array.isArray(list);
        if (isList) {
            list = list.map((it, idx) => [idx, it]);
            result = [];
        } else if (typeof list === 'object') {
            list = Object.entries(list);
            result = {};
        }
        /**@type {string|SlashCommandClosure} */
        let command;
        if (value) {
            if (value[0] instanceof SlashCommandClosure) {
                command = value[0];
            } else {
                command = value.join(' ');
            }
        }
        if (Array.isArray(list)) {
            /**@type {SlashCommandClosureResult}*/
            let commandResult;
            if (isTrueBoolean(args.last)) {
                list.reverse();
            }
            for (let [index, item] of list) {
                if (typeof item === 'object') {
                    item = JSON.stringify(item);
                }
                let outcome;
                if (command instanceof SlashCommandClosure) {
                    command.scope.setMacro('item', item);
                    command.scope.setMacro('index', index);
                    commandResult = (await command.execute());
                    if (commandResult.isAborted) break;
                } else {
                    commandResult = (await executeSlashCommandsWithOptions(
                        command.replace(/{{item}}/ig, item).replace(/{{index}}/ig, index),
                        {
                            handleExecutionErrors: false,
                            handleParserErrors: false,
                            parserFlags: args._parserFlags,
                            scope: args._scope,
                            abortController: args._abortController,
                        },
                    ));
                    if (commandResult.isAborted) {
                        args._abortController.abort(commandResult.abortReason, true);
                        break;
                    }
                }
                outcome = commandResult.pipe;
                if (isTrueBoolean(outcome)) {
                    if (isTrueBoolean(args.index)) {
                        return index.toString();
                    }
                    if (typeof item != 'string') {
                        return JSON.stringify(item);
                    }
                    return item;
                }
            }
            return '';
        }
        return '';
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({ name: 'list',
            description: 'the list or dictionary to search',
            typeList: [ARGUMENT_TYPE.LIST, ARGUMENT_TYPE.DICTIONARY],
        }),
        SlashCommandNamedArgument.fromProps({ name: 'var',
            description: 'name of the chat variable containing the list or dictionary',
            typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
        }),
        SlashCommandNamedArgument.fromProps({ name: 'globalvar',
            description: 'name of the global variable containing the list or dictionary',
            typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
        }),
        SlashCommandNamedArgument.fromProps({ name: 'index',
            description: 'return the matching item\'s index instead of the item',
            typeList: [ARGUMENT_TYPE.BOOLEAN],
            defaultValue: 'false',
            enumList: ['true', 'false'],
        }),
        SlashCommandNamedArgument.fromProps({ name: 'last',
            description: 'return the last instead of the first matching item',
            typeList: [ARGUMENT_TYPE.BOOLEAN],
            defaultValue: 'false',
            enumList: ['true', 'false'],
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the command to execute for each item, using {{item}} and {{index}} as placeholders',
            typeList: [ARGUMENT_TYPE.SUBCOMMAND, ARGUMENT_TYPE.CLOSURE],
            isRequired: true,
        }),
    ],
    splitUnnamedArgument: true,
    helpString: `
        <div>
            Executes the provided command for each item of a list or dictionary and returns the first item where the command returned true.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code class="language-stscript">/find list=[1,2,3,4,5] {: /test left={{item}} rule=gt right=2 :} | /echo</code></pre>
                    returns 3
                </li>
            </ul>
        </div>
    `,
    returns: 'the first item where the command returned true',
}));


SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'slice',
    callback: (args, value) => {
        const list = getListVar(args.var, args.globalvar, value) ?? getVar(args.var, args.globalvar, value);
        let end = args.end ?? (args.length ? Number(args.start) + Number(args.length) : undefined);
        const result = list.slice(args.start, end);
        if (typeof result != 'string') {
            return JSON.stringify(result);
        }
        return result;
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({ name: 'start',
            description: 'the starting index of the slice, negative numbers start from the back',
            typeList: [ARGUMENT_TYPE.NUMBER],
            isRequired: true,
        }),
        SlashCommandNamedArgument.fromProps({ name: 'end',
            description: 'the ending index of the slice (non-inclusive)',
            typeList: [ARGUMENT_TYPE.NUMBER],
        }),
        SlashCommandNamedArgument.fromProps({ name: 'length',
            description: 'the length of the slice',
            typeList: [ARGUMENT_TYPE.NUMBER],
        }),
        SlashCommandNamedArgument.fromProps({ name: 'var',
            description: 'name of the chat variable to slice',
            typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
        }),
        SlashCommandNamedArgument.fromProps({ name: 'globalvar',
            description: 'name of the global variable to slice',
            typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the value to slice',
            typeList: [ARGUMENT_TYPE.STRING, ARGUMENT_TYPE.LIST],
        }),
    ],
    returns: 'the sliced list or string',
    helpString: `
        <div>
            Retrieves a slice of a list or string.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code class="language-stscript">/slice start=2 length=3 [1,2,3,4,5,6] | /echo</code></pre>
                    returns [3,4,5]
                </li>
                <li>
                    <pre><code class="language-stscript">/slice start=-8 The quick brown fox jumps over the lazy dog | /echo</code></pre>
                    returns lazy dog
                </li>
            </ul>
        </div>
    `,
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'splice',
    callback: (args, value) => {
        const list = getListVar(args.var, args.globalvar, args.value);
        list.splice(args.start, args.delete, ...(value ?? []));
        return JSON.stringify(list);
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({ name: 'start',
            description: 'the starting index of the slice, negative numbers start from the back',
            typeList: [ARGUMENT_TYPE.NUMBER],
            isRequired: true,
        }),
        SlashCommandNamedArgument.fromProps({ name: 'delete',
            description: 'the number of elements to remove in the list from start',
            typeList: [ARGUMENT_TYPE.NUMBER],
        }),
        SlashCommandNamedArgument.fromProps({ name: 'value',
            description: 'the list to operate on',
            typeList: [ARGUMENT_TYPE.LIST],
        }),
        SlashCommandNamedArgument.fromProps({ name: 'var',
            description: 'name of the chat variable to operate on',
            typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
        }),
        SlashCommandNamedArgument.fromProps({ name: 'globalvar',
            description: 'name of the global variable to operate on',
            typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the elements to add, beginning from start',
            typeList: [ARGUMENT_TYPE.STRING, ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.BOOLEAN, ARGUMENT_TYPE.LIST, ARGUMENT_TYPE.DICTIONARY],
        }),
    ],
    splitUnnamedArgument: true,
    returns: 'the new list',
    helpString: `
        <div>
            Creates a new list with some elements removed and / or replaced at a given index.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code class="language-stscript">/splice value=[0,1,2,3,4,5,6] start=3 delete=3 30 40 50 |\n/echo |</code></pre>
                    returns [0,1,2,30,40,50,6]
                </li>
                <li>
                    <pre><code class="language-stscript">/splice value=[0,1,2,3,4,5,6] start=3 delete=3 |\n/echo |</code></pre>
                    returns [0,1,2,6]
                </li>
                <li>
                    <pre><code class="language-stscript">/splice value=[0,1,2,3,4,5,6] start=3 100 |\n/echo |</code></pre>
                    returns [0,1,2,100,3,4,5,6]
                </li>
                <li>
                    <pre><code class="language-stscript">/splice value=[0,1,2,3,4,5,6] start=-1 delete=1 |\n/echo |</code></pre>
                    returns [0,1,2,3,4,5]
                </li>
            </ul>
        </div>
    `,
}));

const shuffleList = (value)=>{
    const list = getListVar(null, null, value);
    for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
};
SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'shuffle',
    callback: (args, value) => {
        return JSON.stringify(shuffleList(value));
    },
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the list to shuffle',
            typeList: [ARGUMENT_TYPE.LIST],
            isRequired: true,
        }),
    ],
    helpString: 'Returns a shuffled list.',
    returns: 'the shuffled list',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'pick',
    callback: (args, value) => {
        const list = shuffleList(value);
        const items = Number(args.items ?? '1');
        const asList = args.list ?? false;
        const picks = list.slice(0, items);
        if (items > 1 || asList) {
            return JSON.stringify(picks);
        }
        const pick = picks[0];
        if (typeof pick != 'string') {
            return JSON.stringify(pick);
        }
        return pick;
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({ name: 'items',
            description: 'how many items to pick (if greater than one, will return a list)',
            typeList: [ARGUMENT_TYPE.NUMBER],
            defaultValue: '1',
        }),
        SlashCommandNamedArgument.fromProps({ name: 'list',
            description: 'whether to return a list, even if only one item is picked',
            typeList: [ARGUMENT_TYPE.BOOLEAN],
            enumList: ['true', 'false'],
            defaultValue: 'false',
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the list to pick from',
            typeList: [ARGUMENT_TYPE.LIST],
            isRequired: true,
        }),
    ],
    helpString: 'Picks one random item or <code>items</code> number of random items from a list (no duplicates).',
    returns: 'the picked item or list of picked items',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'reverse',
    callback: (args, value) => {
        const list = getListVar(null, null, value);
        list.reverse();
        return JSON.stringify(list);
    },
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the list to reverse',
            typeList: [ARGUMENT_TYPE.LIST],
            isRequired: true,
        }),
    ],
    helpString: 'Returns a reversed list.',
    returns: 'the reversed list',
}));


SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'dict',
    callback: (args, value) => {
        const result = {};
        const list = getListVar(args.var, args.globalvar, value);
        for (const [key, val] of list) {
            result[key] = val;
        }
        return JSON.stringify(result);
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({ name: 'var',
            description: 'name of the chat variable to use as input',
            typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
        }),
        SlashCommandNamedArgument.fromProps({ name: 'globalvar',
            description: 'name of the global variable to use as input',
            typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'a list of lists, where each inner list has at least two elements',
            typeList: [ARGUMENT_TYPE.LIST],
            isRequired: true,
        }),
    ],
    returns: 'dictionary created from the input list of lists',
    helpString: `
        <div>
            Takes a list of lists (each item must be a list of at least two items) and creates a dictionary by using each
            items first item as key and each items second item as value.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code class="language-stscript">/let x [
    ["a", 1],
    ["b", 2],
    ["c", 3]
] |
/dict {{var::x}} |
/echo
</code></pre>
                    returns {a:1, b:2, c:3}
                </li>
            </ul>
        </div>
    `,
}));


SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'keys',
    callback: async (args, value) => {
        let list = getListVar(args.var, args.globalvar, value);
        return JSON.stringify(Object.keys(list));
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({ name: 'var',
            description: 'name of the chat variable to get keys from',
            typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
        }),
        SlashCommandNamedArgument.fromProps({ name: 'globalvar',
            description: 'name of the global variable to get keys from',
            typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the dictionary/object to get keys from',
            typeList: [ARGUMENT_TYPE.DICTIONARY],
        }),
    ],
    returns: 'list of keys in the dictionary/object',
    helpString: 'Return the list of keys of a dictionary / object.',
}));



// GROUP: Split & Join
SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'split',
    callback: (args, value)=>{
        value = getListVar(args.var, args.globalvar, value) ?? getVar(args.var, args.globalvar, value);
        let find = args.find ?? ',';
        if (find.match(/^\/.+\/[a-z]*$/)) {
            find = new RegExp(find.replace(/^\/(.+)\/([a-z]*)$/, '$1'), find.replace(/^\/(.+)\/([a-z]*)$/, '$2'));
        }
        return JSON.stringify(value.split(find).map(it=>isTrueBoolean(args.trim ?? 'true') ? it.trim() : it));
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({ name: 'find',
            description: 'the text to split at',
            typeList: [ARGUMENT_TYPE.STRING],
            defaultValue: ',',
        }),
        SlashCommandNamedArgument.fromProps({ name: 'trim',
            description: 'whether to trim the resulting values',
            typeList: [ARGUMENT_TYPE.BOOLEAN],
            defaultValue: 'true',
            enumList: ['true', 'false'],
        }),
        SlashCommandNamedArgument.fromProps({ name: 'var',
            description: 'name of the chat variable to split',
            typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
        }),
        SlashCommandNamedArgument.fromProps({ name: 'globalvar',
            description: 'name of the global variable to split',
            typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the value to split',
            typeList: [ARGUMENT_TYPE.STRING],
        }),
    ],
    returns: 'list of the split values',
    helpString: `
        <div>
            Splits value into list at every occurrence of find. Supports regex <code>find="/\\s/"</code>
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code>/split find="/\\s/" The quick brown fox jumps over the lazy dog | /echo</code></pre>
                </li>
            </ul>
        </div>
    `,
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'join',
    callback: (args, value) => {
        let list = getListVar(args.var, args.globalvar, value);
        if (Array.isArray(list)) {
            const glue = (args.glue ?? ', ')
                .replace(/{{space}}/g, ' ')
            ;
            return list.join(glue);
        }
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({ name: 'glue',
            description: 'the string to join the list items with',
            typeList: [ARGUMENT_TYPE.STRING],
            defaultValue: ', ',
        }),
        SlashCommandNamedArgument.fromProps({ name: 'var',
            description: 'name of the chat variable containing the list',
            typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
        }),
        SlashCommandNamedArgument.fromProps({ name: 'globalvar',
            description: 'name of the global variable containing the list',
            typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the list to join',
            typeList: [ARGUMENT_TYPE.LIST],
        }),
    ],
    returns: 'a single string containing the joined list items',
    helpString: `
        <div>
            Joins the items of a list with glue into a single string. Use <code>glue={{space}}</code> to join with a space.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code class="language-stscript">/join ["apple", "banana", "cherry"]</code></pre>
                    returns "apple, banana, cherry"
                </li>
                <li>
                    <pre><code class="language-stscript">/join glue=" | " ["apple", "banana", "cherry"]</code></pre>
                    returns "apple | banana | cherry"
                </li>
            </ul>
        </div>
    `,
}));



// GROUP: Text Operations
SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'trim',
    callback: (args, value) => {
        return value?.trim();
    },
    returns: 'the trimmed text',
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'text to trim',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        }),
    ],
    helpString: 'Removes whitespace at the start and end of the text.',
}));


SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'diff',
    callback: async (args, value) => {
        /**@type {HTMLScriptElement} */
        let script = document.querySelector('script[src*="SillyTavern-LALib/lib/wiked-diff.js"]');
        if (!script) {
            await new Promise(resolve=>{
                script = document.createElement('script');
                script.addEventListener('load', resolve);
                script.src = '/scripts/extensions/third-party/SillyTavern-LALib/lib/wiked-diff.js';
                document.body.append(script);
            });
            const style = document.createElement('style');
            style.innerHTML = `
                html > body {
                    #dialogue_popup.wide_dialogue_popup.large_dialogue_popup:has(.lalib--diffContainer) {
                        aspect-ratio: unset;
                    }
                    .lalib--diffWrapper {
                        display: flex;
                        flex-direction: column;
                        height: 100%;
                        overflow: hidden;
                        align-items: stretch;
                        gap: 1em;
                        > .lalib--diffNotes {
                            flex: 0 0 auto;
                            align-self: center;
                            max-height: 20vh;
                            overflow: auto;
                            text-align: left;
                            font-size: 88%;
                            white-space: pre-wrap;
                        }
                        .lalib--diffContainer {
                            display: flex;
                            flex-direction: row;
                            gap: 1em;
                            text-align: left;
                            overflow: hidden;
                            flex: 1 1 auto;
                            > .lalib--diffOld, > .lalib--diffNew {
                                font-size: 88%;
                                line-height: 1.6;
                                white-space: pre-wrap;
                            }
                            > .lalib--diffOld, > .lalib--diffNew, .lalib--diffDiff {
                                flex: 1 1 0;
                                overflow: auto;
                                background-color: var(--greyCAIbg);
                            }
                        }
                        .lalib--diffButtons {
                            display: flex;
                            flex-direction: row;
                            gap: 1em;
                            justify-content: center;
                            > .lalib--diffButton {
                                white-space: nowrap;
                            }
                        }
                    }
                    .wikEdDiffFragment {
                        background-color: transparent;
                        border: none;
                        box-shadow: none;
                        padding: 0;
                        text-align: left;
                        * {
                            text-shadow: none !important;
                        }
                        .wikEdDiffInsert {
                            font-weight: normal;
                            background-color: rgb(200, 255, 200);
                        }
                        .wikEdDiffDelete {
                            font-weight: normal;
                            background-color: rgb(255, 150, 150);
                            text-decoration: line-through;
                        }
                        .wikEdDiffBlock {
                            font-weight: normal;
                            color: rgb(0, 0, 0);
                        }
                    }
                }
            `;
            document.body.append(style);
        }
        const makeDiffer = ()=>{
            const differ = new WikEdDiff();
            window.wikEdDiffConfig = window.wikEdDiffConfig ?? {};
            differ.config.fullDiff = true;
            differ.config.charDiff = false;
            // differ.config.unlinkMax = 50;
            return differ;
        };
        let oldText = args.old;
        let newText = args.new;
        if (isTrueBoolean(args.stripcode)) {
            const stripcode = (text)=>text.split('```').filter((_,idx)=>idx % 2 == 0).join('');
            oldText = stripcode(oldText);
            newText = stripcode(newText);
        }
        const differ = makeDiffer();
        const diffHtml = differ.diff(oldText, newText);
        let diff;
        const updateDebounced = debounce((newText)=>diff.innerHTML = makeDiffer().diff(oldText, newText));
        const dom = document.createElement('div'); {
            dom.classList.add('lalib--diffWrapper');
            if (args.notes && args.notes.length) {
                const notes = document.createElement('div'); {
                    notes.classList.add('lalib--diffNotes');
                    notes.textContent = args.notes;
                    dom.append(notes);
                }
            }
            const container = document.createElement('div'); {
                container.classList.add('lalib--diffContainer');
                if (isTrueBoolean(args.all)) {
                    const old = document.createElement('div'); {
                        old.classList.add('lalib--diffOld');
                        old.textContent = oldText;
                        container.append(old);
                    }
                    const ne = document.createElement('textarea'); {
                        ne.classList.add('lalib--diffNew');
                        ne.value = newText;
                        ne.addEventListener('input', ()=>{
                            newText = ne.value;
                            updateDebounced(ne.value);
                        });
                        container.append(ne);
                    }
                }
                diff = document.createElement('div'); {
                    diff.classList.add('lalib--diffDiff');
                    diff.innerHTML = diffHtml;
                    container.append(diff);
                }
                dom.append(container);
            }
            if (isTrueBoolean(args.buttons)) {
                const buttons = document.createElement('div'); {
                    buttons.classList.add('lalib--diffButtons');
                    const btnOld = document.createElement('div'); {
                        btnOld.classList.add('lalib--diffButton');
                        btnOld.classList.add('menu_button');
                        btnOld.textContent = 'Use Old Text';
                        btnOld.addEventListener('click', ()=>{
                            result = oldText;
                            document.querySelector('#dialogue_popup_ok').click();
                        });
                        buttons.append(btnOld);
                    }
                    const btnNew = document.createElement('div'); {
                        btnNew.classList.add('lalib--diffButton');
                        btnNew.classList.add('menu_button');
                        btnNew.textContent = 'Use New Text';
                        btnNew.addEventListener('click', ()=>{
                            result = newText;
                            document.querySelector('#dialogue_popup_ok').click();
                        });
                        buttons.append(btnNew);
                    }
                    dom.append(buttons);
                }
            }
        }
        let result = '';
        await callPopup(dom, 'text', null, { wide:true, large:true, okButton:'Close' });
        return result;
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'all',
            description: 'show new, old, and diff side by side',
            typeList: [ARGUMENT_TYPE.BOOLEAN],
            defaultValue: 'true',
            enumList: ['true', 'false'],
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'buttons',
            description: 'add buttons to pick which text to return',
            typeList: [ARGUMENT_TYPE.BOOLEAN],
            defaultValue: 'true',
            enumList: ['true', 'false'],
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'stripcode',
            description: 'remove all codeblocks before diffing',
            typeList: [ARGUMENT_TYPE.BOOLEAN],
            defaultValue: 'true',
            enumList: ['true', 'false'],
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'notes',
            description: 'show additional notes or comments above the comparison',
            typeList: [ARGUMENT_TYPE.STRING],
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'old',
            description: 'the old text to compare',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'new',
            description: 'the new text to compare',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        }),
    ],
    helpString: 'Compares old text vs new text and displays the difference between the two. Use <code>all=true</code> to show new, old, and diff side by side. Use <code>buttons=true</code> to add buttons to pick which text to return. Use <code>stripcode=true</code> to remove all codeblocks before diffing. Use <code>notes="some text"</code> to show additional notes or comments above the comparison.',
}));


SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'json-pretty',
    callback: (args, value) => {
        return JSON.stringify(JSON.parse(value), null, 4);
    },
    returns: 'formatted JSON',
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'JSON to pretty print',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        }),
    ],
    helpString: 'Pretty print JSON.',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'substitute',
    callback: (args, value) => {
        return substituteParams(value, name1, name2);
    },
    returns: 'text with macros replaced',
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'text to substitute macros in',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        }),
    ],
    helpString: 'Substitute macros in text.',
}));


SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'wordcount',
    callback: (args, value) => {
        const words = Array.from(new Intl.Segmenter(args.language ?? 'en', { granularity:'word' }).segment(value))
            .filter(it=>it.isWordLike);
        return words.length.toString();
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'language',
            description: 'Two character language code according to IETF BCP 47',
            typeList: [ARGUMENT_TYPE.STRING],
            defaultValue: 'en',
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the text to count words in',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        }),
    ],
    returns: 'the number of words',
    helpString: 'Count the number of words in text. Language defaults to "en". Supply a two character language according to IETF BCP 47 language tags for other languages.',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'sentencecount',
    callback: (args, value) => {
        const words = Array.from(new Intl.Segmenter(args.language ?? 'en', { granularity:'sentence' }).segment(value));
        return words.length.toString();
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'language',
            description: 'Two character language code according to IETF BCP 47',
            typeList: [ARGUMENT_TYPE.STRING],
            defaultValue: 'en',
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the text to count sentences in',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        }),
    ],
    returns: 'the number of sentences',
    helpString: 'Count the number of sentences in text. Language defaults to "en". Supply a two character language according to IETF BCP 47 language tags for other languages.',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'segment',
    callback: (args, value) => {
        args.granularity = args.granularity ?? 'word';
        const segments = Array.from(new Intl.Segmenter(args.language ?? 'en', { granularity: args.granularity }).segment(value))
            .filter(it=>args.granularity != 'word' || it.isWordLike)
            .map(it=>it.segment)
        ;
        return JSON.stringify(segments);
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'granularity',
            description: 'The unit to segment the text into: grapheme, word or sentence',
            typeList: [ARGUMENT_TYPE.STRING],
            enumList: ['grapheme', 'word', 'sentence'],
            defaultValue: 'word',
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'language',
            description: 'Two character language code according to IETF BCP 47',
            typeList: [ARGUMENT_TYPE.STRING],
            defaultValue: 'en',
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the text to segment',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        }),
    ],
    returns: 'list of the segments (graphemes, words, or sentences)',
    helpString: 'Return the graphemes (characters, basically), words or sentences found in the text. Supply a two character language according to IETF BCP 47 language tags for other languages.',
}));



// GROUP: Regular Expressions
const makeRegex = (value)=>{
    return new RegExp(
        value
            .replace(/^\/(.+)\/([a-z]*)$/, '$1')
        ,
        value
            .replace(/^\/(.+)\/([a-z]*)$/, '$2')
        ,
    );
};

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 're-escape',
    callback: (args, value) => escapeRegex(value),
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({ description: 'text to escape',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        }),
    ],
    returns: 'regex-escaped string',
    helpString: `
        <div>Escapes text to be used literally inside a regex.</div>
        <div>
            <strong>Examples:</strong>
            <ul>
                <li>
                    <pre><code class="language-stscript">/re-escape foo/bar foo.bar |\n/echo</code></pre>
                    Will echo <code>foo\\/bar foo\\.bar</code>.
                </li>
                <li>
                    <pre><code class="language-stscript">/re-escape {{char}} |\n/re-replace find=/\\b{{pipe}}\\b/g replace=FOO {{lastMessage}} |\n/echo</code></pre>
                </li>
            </ul>
        </div>
    `,
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 're-test',
    callback: (args, value) => {
        try {
            const re = makeRegex(args.find);
            const text = getVar(args.var, args.globalvar, value) ?? '';
            return JSON.stringify(re.test(text));
        } catch (ex) {
            toastr.error(ex.message);
        }
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'find',
            description: 'the regular expression to test against',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'var',
            description: 'name of the chat variable to test',
            typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'globalvar',
            description: 'name of the global variable to test',
            typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the value to test',
            typeList: [ARGUMENT_TYPE.STRING],
        }),
    ],
    returns: 'true or false',
    helpString: 'Tests if the provided variable or value matches a regular expression.',
}));


SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 're-replace',
    callback: async (namedArgs, value) => {
        if (namedArgs.find == null) {
            throw new Error('/re-replace requires find= to be set.');
        }
        const text = getVar(namedArgs.var, namedArgs.globalvar, value);
        const re = makeRegex(namedArgs.find);
        if (namedArgs.cmd) {
            const replacements = [];
            /**@type {(function():Promise<string>)[]}*/
            const cmds = [];
            if (namedArgs.cmd instanceof SlashCommandClosure) {
                /**@type {SlashCommandClosure} */
                const closure = namedArgs.cmd;
                text.toString().replace(re, (...matches) => {
                    const copy = closure.getCopy();
                    matches.slice(0, -2).forEach((match, idx) => {
                        copy.scope.setMacro(`$${idx}`, match ?? '');
                    });
                    copy.scope.setMacro('$index', matches.slice(-2)[0]);
                    copy.scope.setMacro('$text', matches.slice(-1)[0]);
                    cmds.push(async () => (await copy.execute())?.pipe);
                    return '';
                });
            } else {
                text.toString().replace(re, (...matches) => {
                    const cmd = namedArgs.cmd.replace(/\$(\d+)/g, (_, idx) => matches[idx]);
                    cmds.push(async () => (await executeSlashCommandsWithOptions(
                        cmd,
                        {
                            handleExecutionErrors: false,
                            handleParserErrors: false,
                            parserFlags: namedArgs._parserFlags,
                            scope: namedArgs._scope,
                            abortController: namedArgs._abortController,
                        },
                    ))?.pipe);
                    return '';
                });
            }
            for (const cmd of cmds) {
                replacements.push(await cmd());
            }
            return text.toString().replace(re, () => replacements.shift());
        } else if (namedArgs.replace != null) {
            return text.toString().replace(re, namedArgs.replace);
        }
        console.warn('[LALIB]', namedArgs, value, text);
        throw new Error('/re-replace requires either replace= or cmd= to be set.');
    },
    returns: 'the new text',
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'find',
            description: 'the regular expression (/pattern/flags)',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'replace',
            description: 'the replacement text',
            typeList: [ARGUMENT_TYPE.STRING],
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'cmd',
            description: 'a closure or slash command to execute for each match',
            typeList: [ARGUMENT_TYPE.CLOSURE, ARGUMENT_TYPE.SUBCOMMAND],
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'var',
            description: 'name of the chat variable to perform the replacement on',
            typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'globalvar',
            description: 'name of the global variable to perform the replacement on',
            typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the value to perform the replacement on',
            typeList: [ARGUMENT_TYPE.STRING],
        }),
    ],
    helpString: `
        <div>
            Searches the provided variable or value with the regular expression and replaces matches with the replace value or the return value of the provided closure or slash command. For text replacements and slash commands, use <code>$1</code>, <code>$2</code>, ... to reference capturing groups. In closures use <code>{{$1}}</code>, <code>{{$2}}</code>, ... to reference capturing groups.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code class="language-stscript">/re-replace find=/\\s+/ replace=" " The quick   brown  fox  jumps over the lazy dog | /echo</code></pre>
                    replaces multiple whitespace with a single space
                </li>
                <li>
                    <pre><code class="language-stscript">/re-replace find=/([a-z]+) ([a-z]+)/ cmd="/echo $2 $1" the quick brown fox | /echo</code></pre>
                    swaps words using a slash command on each match
                </li>
            </ul>
        </div>
    `,
}));



// GROUP: Accessing & Manipulating Structured Data
SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'getat',
    callback: (args, value) => {
        let index = getListVar(null, null, args.index) ?? [args.index];
        if (!Array.isArray(index)) {
            index = [index];
        }
        const list = getListVar(args.var, args.globalvar, value);
        let result = list;
        while (index.length > 0 && result !== undefined) {
            const ci = index.shift();
            result = Array.isArray(result) ? result.slice(ci)[0] : result[ci];
            try { result = JSON.parse(result); } catch { /*empty*/ }
        }
        if (typeof result != 'string') {
            return JSON.stringify(result);
        }
        return result;
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'index',
            description: 'the index, field name, or list of indices/field names to retrieve',
            typeList: [ARGUMENT_TYPE.STRING, ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.LIST],
            isRequired: true,
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'var',
            description: 'name of the chat variable to retrieve from',
            typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'globalvar',
            description: 'name of the global variable to retrieve from',
            typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the value to retrieve from (if not using a variable)',
            typeList: [ARGUMENT_TYPE.STRING],
        }),
    ],
    helpString: 'Retrieves an item from a list or a property from a dictionary.',
    returns: 'the retrieved item or property value',
}));


SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'setat',
    callback: async (args, value) => {
        try { value = JSON.parse(value); } catch { /*empty*/ }
        let index = getListVar(null, null, args.index) ?? [args.index];
        const list = getListVar(args.var, args.globalvar, args.value) ?? (Number.isNaN(Number(index[0])) ? {} : []);
        if (!Array.isArray(index)) {
            index = [index];
        }
        let current = list;
        while (index.length > 0) {
            const ci = index.shift();
            if (index.length > 0 && current[ci] === undefined) {
                if (Number.isNaN(Number(index[0]))) {
                    current[ci] = {};
                } else {
                    current[ci] = [];
                }
            }
            if (index.length == 0) {
                current[ci] = value;
            }
            const prev = current;
            current = current[ci];
            try {
                current = JSON.parse(current);
                prev[ci] = current;
            } catch { /*empty*/ }
        }
        if (list !== undefined) {
            let result = (typeof list != 'string') ? JSON.stringify(list) : list;
            if (args.var) {
                await executeSlashCommands(`/setvar key="${args.var}" ${result.replace(/\|/g, '\\|')}`);
            }
            if (args.globalvar) {
                await executeSlashCommands(`/setglobalvar key="${args.globalvar}" ${result.replace(/\|/g, '\\|')}`);
            }
            return result;
        }
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'index',
            description: 'the index or key to set the value at',
            typeList: [ARGUMENT_TYPE.STRING, ARGUMENT_TYPE.LIST],
            isRequired: true,
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'var',
            description: 'name of the chat variable to update',
            typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'globalvar',
            description: 'name of the global variable to update',
            typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'value',
            description: 'the value to update',
            typeList: [ARGUMENT_TYPE.LIST, ARGUMENT_TYPE.DICTIONARY],
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the value to set',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        }),
    ],
    helpString: `
        <div>
            Sets an item in a list or a property in a dictionary.
        </div>
        <div>
            <strong>Examples:</strong>
            <ul>
                <li>
                    <pre><code class="language-stscript">/setat value=[1,2,3] index=1 X</code></pre>
                    returns <code>[1,"X",3]</code>
                </li>
                <li>
                    <pre><code class="language-stscript">/setat var=myVariable index=[1,2,"someProperty"] foobar</code></pre>
                    sets the value of <code>myVariable[1][2].someProperty</code> to "foobar" (the variable will be updated and the resulting value of myVariable will be returned)
                </li>
            </ul>
            Can be used to create structures that do not already exist.
        </div>
    `,
    returns: 'the updated list or dictionary',
}));



// GROUP: Exception Handling
SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'try',
    /**
     *
     * @param {import('../../../slash-commands/SlashCommand.js').NamedArguments} args
     * @param {(string|SlashCommandClosure)[]} value
     */
    callback: async (args, value) => {
        /**@type {string|SlashCommandClosure} */
        let command;
        if (value) {
            if (value[0] instanceof SlashCommandClosure) {
                command = value[0];
            } else {
                command = value.join(' ');
            }
        }
        try {
            let result;
            if (command instanceof SlashCommandClosure) {
                result = await command.execute();
            } else {
                result = await executeSlashCommandsWithOptions(
                    command,
                    {
                        handleExecutionErrors: false,
                        handleParserErrors: false,
                        parserFlags: args._parserFlags,
                        scope: args._scope,
                        abortController: args._abortController,
                    },
                );
            }
            return JSON.stringify({
                isException: false,
                result: result.pipe,
            });
        } catch (ex) {
            return JSON.stringify({
                isException: true,
                exception: ex?.message ?? ex,
            });
        }
    },
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the command to try',
            typeList: [ARGUMENT_TYPE.SUBCOMMAND, ARGUMENT_TYPE.CLOSURE],
            isRequired: true,
        }),
    ],
    splitUnnamedArgument: true,
    helpString: `
        <div>
            Attempts to execute the provided command and catches any exceptions thrown. Use with <code>/catch</code>.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code class="language-stscript">/try {: /divide 10 0 :} |
/catch {: /echo An error occurred: {{exception}} :}</code></pre>
                </li>
            </ul>
        </div>
    `,
    returns: 'an object with properties `isException` and `result` or `exception`',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'catch',
    /**
     *
     * @param {import('../../../slash-commands/SlashCommand.js').NamedArguments} args
     * @param {(string|SlashCommandClosure)[]} value
     */
    callback: async (args, value) => {
        /**@type {string|SlashCommandClosure} */
        let command;
        if (value) {
            if (value[0] instanceof SlashCommandClosure) {
                command = value[0];
            } else {
                command = value.join(' ');
            }
        }
        let data;
        try {
            data = JSON.parse(args._scope.pipe);
        } catch (ex) {
            console.warn('[LALIB]', '[CATCH]', 'failed to parse pipe', args._scope.pipe, ex);
        }
        if (data?.isException) {
            let result;
            if (command instanceof SlashCommandClosure) {
                command.scope.setMacro('exception', data.exception);
                command.scope.setMacro('error', data.exception);
                result = await command.execute();
            } else {
                result = await executeSlashCommandsWithOptions(
                    command.replace(/{{(exception|error)}}/ig, data.exception),
                    {
                        handleExecutionErrors: false,
                        handleParserErrors: false,
                        parserFlags: args._parserFlags,
                        scope: args._scope,
                        abortController: args._abortController,
                    },
                );
            }
            return result.pipe;
        } else {
            return data?.result;
        }
    },
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the command to execute if an exception occurred',
            typeList: [ARGUMENT_TYPE.SUBCOMMAND, ARGUMENT_TYPE.CLOSURE],
            isRequired: true,
        }),
    ],
    splitUnnamedArgument: true,
    helpString: `
        <div>
            Used with the \`/try\` command to handle exceptions. Use \`{{exception}}\` or \`{{error}}\` to get the exception's message.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code class="language-stscript">/try {: /divide 10 0 :} |
/catch {: /echo An error occurred: {{exception}} :}</code></pre>
                </li>
            </ul>
        </div>
    `,
    returns: 'the result of the catch command, or the original result if no exception occurred',
}));



// GROUP: Null Handling
SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'ifempty',
    callback: (args, value) => {
        const list = getListVar(null, null, args.value);
        if (list) {
            if (Array.isArray(list)) {
                if (list.length == 0) return value;
            } else if (typeof list == 'object') {
                if (Object.keys(list).length == 0) return value;
            }
        } else {
            const val = getVar(null, null, args.value);
            if ((val?.length ?? 0) == 0) return value;
        }
        return args.value;
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'value',
            description: 'the value to check',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the fallback value',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        }),
    ],
    helpString: 'Returns the fallback value if value is empty (empty string, empty list, empty dictionary).',
    returns: 'the value or the fallback value',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'ifnullish',
    callback: (args, value) => {
        if ((args.value?.length ?? 0) == 0) return value;
        return args.value;
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'value',
            description: 'the value to check',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the fallback value',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        }),
    ],
    helpString: 'Returns the fallback value if value is nullish (empty string).',
    returns: 'the value or the fallback value',
}));



// GROUP: Copy & Download
SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'copy',
    callback: (args, value) => {
        const ta = document.createElement('textarea'); {
            ta.value = value;
            ta.style.position = 'fixed';
            ta.style.inset = '0';
            document.body.append(ta);
            ta.focus();
            ta.select();
            try {
                document.execCommand('copy');
            } catch (err) {
                console.error('Unable to copy to clipboard', err);
            }
            ta.remove();
        }
    },
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the value to copy',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        }),
    ],
    helpString: 'Copies value into clipboard.',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'download',
    callback: (args, value) => {
        const blob = new Blob([value], { type:'text' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); {
            a.href = url;
            const name = args.name ?? `SillyTavern-${new Date().toISOString()}`;
            const ext = args.ext ?? 'txt';
            a.download = `${name}.${ext}`;
            a.click();
        }
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'name',
            description: 'the filename for the downloaded file',
            typeList: [ARGUMENT_TYPE.STRING],
            defaultValue: `SillyTavern-${new Date().toISOString()}`,
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'ext',
            description: 'the file extension for the downloaded file',
            typeList: [ARGUMENT_TYPE.STRING],
            defaultValue: 'txt',
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the value to download as a text file',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        }),
    ],
    helpString: 'Downloads value as a text file.',
}));



// GROUP: DOM Interaction
SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'dom',
    callback: (args, query) => {
        /**@type {HTMLElement} */
        let target;
        try {
            target = document.querySelector(query);
        } catch (ex) {
            toastr.error(ex?.message ?? ex);
        }
        if (!target) {
            toastr.warning(`No element found for query: ${query}`);
            return '';
        }
        switch (args.action) {
            case 'click': {
                target.click();
                break;
            }
            case 'value': {
                if (target.value === undefined) {
                    toastr.warning(`Cannot set value on ${target.tagName}`);
                    return '';
                }
                target.value = args.value;
                target.dispatchEvent(new Event('change', { bubbles:true }));
                target.dispatchEvent(new Event('input', { bubbles:true }));
                target.dispatchEvent(new Event('mouseup', { bubbles:true }));
                return '';
            }
            case 'property': {
                if (Object.keys(args).includes('value')) {
                    target[args.property] = args.value;
                }
                if (target[args.property] === undefined) {
                    toastr.warning(`Property "${args.property}" does not exist on ${target.tagName}`);
                    return '';
                }
                const propVal = target[args.property];
                if (typeof propVal != 'string') {
                    return JSON.stringify(propVal);
                }
                return propVal ?? '';
            }
            case 'attribute': {
                if (Object.keys(args).includes('value')) {
                    target.setAttribute(args.attribute, args.value);
                }
                return target.getAttribute(args.attribute) ?? '';
            }
            case 'call': {
                if (target[args.property] === undefined || !(target[args.property] instanceof Function)) {
                    toastr.warning(`Property "${args.property}" does not exist or is not callable on ${target.tagName}`);
                    return '';
                }
                return target[args.property]() ?? '';
            }
        }
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'action',
            description: 'the action to perform',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
            enumList: ['click', 'value', 'property', 'attribute', 'call'],
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'value',
            description: 'new value to set (for action=value or action=property or action=attribute)',
            typeList: [ARGUMENT_TYPE.STRING],
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'property',
            description: 'property name to get/set/call (for action=property or action=call)',
            typeList: [ARGUMENT_TYPE.STRING],
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'attribute',
            description: 'attribute name to get/set (for action=attribute)',
            typeList: [ARGUMENT_TYPE.STRING],
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'CSS selector to target an element',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        }),
    ],
    returns: 'the result of the action, if any',
    helpString: `
        <div>
            Click on an element, change its value, retrieve a property, or retrieve an attribute. To select the targeted element, use CSS selectors.
        </div>
        <div>
            <strong>Examples:</strong>
            <ul>
                <li><pre><code class="language-stscript">/dom action=click #expandMessageActions</code></pre></li>
                <li><pre><code class="language-stscript">/dom action=value value=0 #avatar_style</code></pre></li>
            </ul>
        </div>
    `,
}));



// GROUP: Characters
SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'char-get',
    /**
     * @param {{index:string}} args
     * @param {string} value
     */
    callback: (args, value)=>{
        let char;
        if (value) {
            char = characters.find(it=>it.avatar.toLowerCase() == value.toLowerCase() || it.name.toLowerCase() == value.toLowerCase());
        } else {
            char = characters[getContext().characterId];
        }
        /**@type {import('../../../char-data.js').v1CharData|string|boolean|number} */
        let result = char;
        if (args.index) {
            result = char[args.index];
        }
        if (result == null || result == undefined) return '';
        if (typeof result != 'string') return JSON.stringify(result);
        return result.toString();
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({ name: 'index',
            description: 'the field to retrieve',
            typeList: [ARGUMENT_TYPE.STRING],
            enumProvider: ()=>Object.keys(characters[0] ?? {}).map(it=>new SlashCommandEnumValue(it)),
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({ description: 'character avatar (filename) or name',
            typeList: [ARGUMENT_TYPE.STRING],
            defaultValue: 'current character',
            enumProvider: ()=>characters.map(it=>new SlashCommandEnumValue(it.name, it.avatar)),
        }),
    ],
    returns: 'char object or property',
    helpString: `
        <div>
            Get a character object or one of its properties.
        </div>
        <div>
            <strong>Examples:</strong>
            <ul>
                <li><pre><code class="language-stscript">/char-get Seraphina |\n/getat index=description |\n/echo</code></pre></li>
                <li><pre><code class="language-stscript">/char-get index=description Seraphina |\n/echo</code></pre></li>
            </ul>
        </div>
    `,
}));



// GROUP: Group Chats
SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'memberpos',
    callback: async(args, value) => {
        if (!selected_group) {
            toastr.warning('Cannot run /memberpos command outside of a group chat.');
            return '';
        }
        const group = groups.find(it=>it.id == selected_group);
        const name = value.replace(/^(.+?)(\s+(\d+))?$/, '$1');
        const char = characters[findGroupMemberId(name)];
        let index = value.replace(/^(.+?)(\s+(\d+))?$/, '$2');
        let currentIndex = group.members.findIndex(it=>it == char.avatar);
        if (index === null) {
            return currentIndex.toString();
        }
        index = Math.min(group.members.length - 1, parseInt(index));
        while (currentIndex < index) {
            await executeSlashCommands(`/memberdown ${name}`);
            currentIndex++;
        }
        while (currentIndex > index) {
            await executeSlashCommands(`/memberup ${name}`);
            currentIndex--;
        }
        return currentIndex.toString();
    },
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'name of the group member',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        }),
        SlashCommandArgument.fromProps({
            description: 'new position index for the member',
            typeList: [ARGUMENT_TYPE.NUMBER],
            isRequired: true,
        }),
    ],
    helpString: 'Move group member to position (index starts with 0).',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'group-get',
    /**
     * @param {{index:string, chars:string}} args
     * @param {string} value
     */
    callback: (args, value)=>{
        const group = groups.find(it=>value ? (it.name.toLowerCase() == value.toLowerCase()) : (it.id == getContext().groupId));
        /**@type {object|string|boolean|number} */
        let result = structuredClone(group);
        if (isTrueBoolean(args.chars)) {
            result.members = result.members.map(ava=>characters.find(it=>it.avatar == ava));
        }
        if (args.index) {
            result = result[args.index];
        }
        if (result == null || result == undefined) return '';
        if (typeof result != 'string') return JSON.stringify(result);
        return result.toString();
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({ name: 'index',
            description: 'the field to retrieve',
            typeList: [ARGUMENT_TYPE.STRING],
            enumProvider: ()=>Object.keys(groups[0] ?? {}).map(it=>new SlashCommandEnumValue(it)),
        }),
        SlashCommandNamedArgument.fromProps({ name: 'chars',
            description: 'resolve characters',
            typeList: [ARGUMENT_TYPE.BOOLEAN],
            defaultValue: 'false',
            enumList: ['true', 'false'],
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({ description: 'group name',
            typeList: [ARGUMENT_TYPE.STRING],
            defaultValue: 'current group',
            enumProvider: ()=>groups.map(it=>new SlashCommandEnumValue(it.name, it.members.join(', '))),
        }),
    ],
    returns: 'char object or property',
    helpString: `
        <div>
            Get a group object or one of its properties.
        </div>
        <div>
            <strong>Examples:</strong>
            <ul>
                <li><pre><code class="language-stscript">/group-get MyGroup |\n/getat index=description |\n/echo</code></pre></li>
                <li><pre><code class="language-stscript">/group-get index=description MyGroup |\n/echo</code></pre></li>
                <li><pre><code class="language-stscript">/group-get index=members chars=true MyGroup |\n/echo</code></pre></li>
            </ul>
        </div>
    `,
}));



// GROUP: Conditionals - switch
SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'switch',
    callback: (namedArgs, unnamedArgs) => {
        const val = getVar(namedArgs.var, namedArgs.globalvar, unnamedArgs.toString());
        return JSON.stringify({
            switch: val,
            break: false,
        });
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'var',
            description: 'name of the chat variable to use as the switch value',
            typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'globalvar',
            description: 'name of the global variable to use as the switch value',
            typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the value to use as the switch value',
            typeList: [ARGUMENT_TYPE.STRING, ARGUMENT_TYPE.NUMBER],
        }),
    ],
    helpString: 'Use with /case to conditionally execute commands based on a value.',
    returns: 'an object containing the switch value',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'case',
    /**
     *
     * @param {import('../../../slash-commands/SlashCommand.js').NamedArguments} args
     * @param {(string|SlashCommandClosure)[]} value
     */
    callback: async (args, value) => {
        /**@type {string|SlashCommandClosure} */
        let command;
        if (value) {
            if (value[0] instanceof SlashCommandClosure) {
                command = value[0];
            } else {
                command = value.join(' ');
            }
        }
        let data;
        try {
            data = JSON.parse(args._scope.pipe);
        } catch (ex) {
            console.warn('[LALIB]', '[CASE]', 'failed to parse pipe', args._scope.pipe, ex);
        }
        if (data?.break) return args._scope.pipe;
        if (data?.switch !== undefined) {
            if (data.switch == args.value || args.value === undefined) {
                data.break = true;
                args._scope.pipe = JSON.stringify(data);
                if (command instanceof SlashCommandClosure) {
                    command.scope.setMacro('value', data.switch);
                    return (await command.execute())?.pipe;
                }
                const commandResult = await executeSlashCommandsWithOptions(
                    command.toString().replace(/{{value}}/ig, data.switch),
                    {
                        handleExecutionErrors: false,
                        handleParserErrors: false,
                        parserFlags: args._parserFlags,
                        scope: args._scope,
                        abortController: args._abortController,
                    },
                );
                return commandResult.pipe;
            }
        }
        return args._scope.pipe;
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'value',
            description: 'the value to compare against the switch value',
            typeList: [ARGUMENT_TYPE.STRING, ARGUMENT_TYPE.NUMBER],
            isRequired: true,
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the command to execute if the value matches the switch value',
            typeList: [ARGUMENT_TYPE.CLOSURE, ARGUMENT_TYPE.SUBCOMMAND],
            isRequired: true,
        }),
    ],
    splitUnnamedArgument: true,
    helpString: 'Execute a command if the provided value matches the switch value from /switch.',
    returns: 'the result of the executed command, or the unchanged pipe if no match',
}));



// GROUP: Conditionals - if
SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'ife',
    /**
     *
     * @param {import('../../../slash-commands/SlashCommand.js').NamedArguments} args
     * @param {(string|SlashCommandClosure)[]} value
     */
    callback: async (args, value) => {
        /**@type {string|SlashCommandClosure} */
        let command;
        if (value) {
            if (value[0] instanceof SlashCommandClosure) {
                command = value[0];
            } else {
                command = value.join(' ');
            }
        }
        let result;
        if (command instanceof SlashCommandClosure) {
            result = await command.execute();
        } else {
            result = await executeSlashCommandsWithOptions(
                command,
                {
                    handleExecutionErrors: false,
                    handleParserErrors: false,
                    parserFlags: args._parserFlags,
                    scope: args._scope,
                    abortController: args._abortController,
                },
            );
        }
        return JSON.stringify({
            if: isTrueBoolean(result?.pipe),
            isHandled: false,
        });
    },
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the command to evaluate',
            typeList: [ARGUMENT_TYPE.CLOSURE, ARGUMENT_TYPE.SUBCOMMAND],
            isRequired: true,
        }),
    ],
    splitUnnamedArgument: true,
    helpString: '<div>Use with /then, /elseif, and /else. The provided command must return true or false.</div>',
    returns: 'an object with a boolean "if" property',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'elseif',
    /**
     *
     * @param {import('../../../slash-commands/SlashCommand.js').NamedArguments} args
     * @param {(string|SlashCommandClosure)[]} value
     */
    callback: async (args, value) => {
        /**@type {string|SlashCommandClosure} */
        let command;
        if (value) {
            if (value[0] instanceof SlashCommandClosure) {
                command = value[0];
            } else {
                command = value.join(' ');
            }
        }
        let data;
        try {
            data = JSON.parse(args._scope.pipe);
        } catch (ex) {
            console.warn('[LALIB]', '[ELSEIF]', 'failed to parse pipe', args._scope.pipe, ex);
        }
        if (data?.if !== undefined) {
            if (!data.if) {
                let result;
                if (command instanceof SlashCommandClosure) {
                    result = await command.execute();
                } else {
                    result = await executeSlashCommandsWithOptions(
                        command,
                        {
                            handleExecutionErrors: false,
                            handleParserErrors: false,
                            parserFlags: args._parserFlags,
                            scope: args._scope,
                            abortController: args._abortController,
                        },
                    );
                }
                return JSON.stringify({
                    if: isTrueBoolean(result?.pipe),
                });
            }
        }
        return args._scope.pipe;
    },
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the command to evaluate',
            typeList: [ARGUMENT_TYPE.CLOSURE, ARGUMENT_TYPE.SUBCOMMAND],
            isRequired: true,
        }),
    ],
    splitUnnamedArgument: true,
    helpString: '<div>Use with /ife, /then, and /else. The provided command must return true or false.</div>',
    returns: 'an object with a boolean "if" property',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'else',
    /**
     *
     * @param {import('../../../slash-commands/SlashCommand.js').NamedArguments} args
     * @param {(string|SlashCommandClosure)[]} value
     */
    callback: async (args, value) => {
        /**@type {string|SlashCommandClosure} */
        let command;
        if (value) {
            if (value[0] instanceof SlashCommandClosure) {
                command = value[0];
            } else {
                command = value.join(' ');
            }
        }
        let data;
        try {
            data = JSON.parse(args._scope.pipe);
        } catch (ex) {
            console.warn('[LALIB]', '[ELSE]', 'failed to parse pipe', args.value, ex);
        }
        if (data?.if !== undefined && !data?.isHandled) {
            if (!data.if) {
                data.isHandled = true;
                let result;
                if (command instanceof SlashCommandClosure) {
                    result = await command.execute();
                } else {
                    result = await executeSlashCommandsWithOptions(
                        command,
                        {
                            handleExecutionErrors: false,
                            handleParserErrors: false,
                            parserFlags: args._parserFlags,
                            scope: args._scope,
                            abortController: args._abortController,
                        },
                    );
                }
                return result.pipe ?? JSON.stringify(data);
            }
        }
        return args._scope.pipe;
    },
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the command to execute',
            typeList: [ARGUMENT_TYPE.CLOSURE, ARGUMENT_TYPE.SUBCOMMAND],
            isRequired: true,
        }),
    ],
    splitUnnamedArgument: true,
    helpString: '<div>Use with /ife, /elseif, and /then. The provided command will be executed if the previous /if or /elseif was false.</div>',
    returns: 'the result of the executed command',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'then',
    /**
     *
     * @param {import('../../../slash-commands/SlashCommand.js').NamedArguments} args
     * @param {(string|SlashCommandClosure)[]} value
     */
    callback: async (args, value) => {
        /**@type {string|SlashCommandClosure} */
        let command;
        if (value) {
            if (value[0] instanceof SlashCommandClosure) {
                command = value[0];
            } else {
                command = value.join(' ');
            }
        }
        let data;
        try {
            data = JSON.parse(args._scope.pipe);
        } catch (ex) {
            console.warn('[LALIB]', '[THEN]', 'failed to parse pipe', args._scope.pipe, ex);
        }
        if (data?.if !== undefined && !data?.isHandled) {
            if (data.if) {
                data.isHandled = true;
                let result;
                if (command instanceof SlashCommandClosure) {
                    result = await command.execute();
                } else {
                    result = await executeSlashCommandsWithOptions(
                        command,
                        {
                            handleExecutionErrors: false,
                            handleParserErrors: false,
                            parserFlags: args._parserFlags,
                            scope: args._scope,
                            abortController: args._abortController,
                        },
                    );
                }
                return result.pipe ?? JSON.stringify(data);
            }
        }
        return args._scope.pipe;
    },
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the command to execute',
            typeList: [ARGUMENT_TYPE.CLOSURE, ARGUMENT_TYPE.SUBCOMMAND],
            isRequired: true,
        }),
    ],
    splitUnnamedArgument: true,
    helpString: '<div>Use with /ife, /elseif, and /else. The provided command will be executed if the previous /if or /elseif was true.</div>',
    returns: 'the result of the executed command',
}));



const getBookNamesWithSource = ()=>{
    const context = getContext();
    return {
        global: world_info.globalSelect ?? [],
        chat: chat_metadata.world_info ?? null,
        character: characters[context.characterId]?.data?.character_book?.name ?? null,
        characterAuxiliary: world_info.charLore?.find(it=>it.name == characters[context.characterId]?.avatar?.split('.')?.slice(0,-1)?.join('.'))?.extraBooks ?? [],
        group: groups
            .find(it=>it.id == context.groupId)
            ?.members
            ?.map(m=>[m, characters.find(it=>it.avatar == m)?.data?.character_book?.name])
            ?.reduce((dict,cur)=>{
                dict[cur[0]] = {
                    character: cur[1] ?? null,
                    auxiliary: world_info.charLore?.find(it=>it.name == cur[0].split('.').slice(0,-1).join('.'))?.extraBooks ?? [],
                };
                return dict;
            }, {})
            ?? {},
    };
};
const getBookNames = ()=>{
    const context = getContext();
    const names = [
        ...(world_info.globalSelect ?? []),
        chat_metadata.world_info,
        characters[context.characterId]?.data?.character_book?.name,
        ...world_info.charLore?.find(it=>it.name == characters[context.characterId]?.avatar?.split('.')?.slice(0,-1)?.join('.'))?.extraBooks ?? [],
        ...(groups
            .find(it=>it.id == context.groupId)
            ?.members
            ?.map(m=>[
                characters.find(it=>it.avatar == m)?.data?.character_book?.name,
                ...(world_info.charLore?.find(it=>it.name == m.split('.').slice(0,-1).join('.'))?.extraBooks ?? []),
            ])
                ?? []
        ),
    ].filter(it=>it);
    return names;
};
// GROUP: World Info
SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'wi-list-books',
    callback: async (namedArgs) => {
        if (isTrueBoolean(namedArgs.source)) {
            return JSON.stringify(getBookNamesWithSource());
        }
        return JSON.stringify(getBookNames());
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'source',
            description: 'whether to include the activation source for each book',
            typeList: [ARGUMENT_TYPE.BOOLEAN],
            defaultValue: 'false',
            enumList: ['true', 'false'],
        }),
    ],
    helpString: 'Get a list of currently active World Info books. Use <code>source=true</code> to get a dictionary of lists where the keys are the activation sources.',
    returns: 'a list of book names, or a dictionary of lists with activation sources as keys',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'wi-list-entries',
    callback: async (args, value) => {
        const loadBook = async (name) => {
            const result = await fetch('/api/worldinfo/get', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({ name }),
            });
            if (result.ok) {
                const data = await result.json();
                data.entries = Object.keys(data.entries).map(it => {
                    data.entries[it].book = name;
                    return data.entries[it];
                });
                data.book = name;
                return data;
            } else {
                toastr.warning(`Failed to load World Info book: ${name}`);
            }
        };
        let names;
        let isNameGiven = false;
        if (value?.length) {
            names = [value.trim()];
            isNameGiven = true;
        } else {
            names = getBookNames();
        }
        const books = {};
        for (const book of names) {
            books[book] = await loadBook(book);
        }
        if (isTrueBoolean(args.flat) || isNameGiven) {
            return JSON.stringify(Object.keys(books).map(it => books[it].entries).flat());
        }
        return JSON.stringify(books);
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'flat',
            description: 'whether to list all entries in a flat list',
            typeList: [ARGUMENT_TYPE.BOOLEAN],
            defaultValue: 'false',
            enumList: ['true', 'false'],
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the name of the book to list entries from',
            typeList: [ARGUMENT_TYPE.STRING],
        }),
    ],
    helpString: 'Get a list of World Info entries from currently active books or from the book with the provided name. Use <code>flat=true</code> to list all entries in a flat list instead of a dictionary with entries per book.',
    returns: 'a dictionary of book entries, or a flat list of entries',
}));



// GROUP: Costumes / Sprites
SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'costumes',
    callback: async (namedArgs, unnamedArgs) => {
        const response = await fetch('/api/plugins/costumes/', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ folder: unnamedArgs, recurse: namedArgs.recurse ?? true }),
        });
        if (!response.ok) {
            toastr.error(`Failed to retrieve costumes: ${response.status} - ${response.statusText}`);
            return '[]';
        }
        return await response.text();
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'recurse',
            description: 'whether to recurse into subfolders (SillyTavern can only load expressions from the first subfolder level)',
            typeList: [ARGUMENT_TYPE.BOOLEAN],
            defaultValue: 'true',
            enumList: ['true', 'false'],
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the folder to list costumes from',
            typeList: [ARGUMENT_TYPE.STRING],
        }),
    ],
    helpString: 'Get a list of costume / sprite folders, recursive by default.',
    returns: 'a list of costume/sprite folders',
}));



// GROUP: Quick Replies
SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'qr-edit',
    callback: async (namedArgs, unnamedArgs) => {
        let set = namedArgs.set;
        let label = namedArgs.label ?? unnamedArgs.toString();
        if (set === undefined) {
            const sets = [...quickReplyApi.listGlobalSets(), ...quickReplyApi.listChatSets()];
            for (const setName of sets) {
                if (quickReplyApi.listQuickReplies(setName).includes(label)) {
                    set = setName;
                    break;
                }
            }
        }
        quickReplyApi.getQrByLabel(set, label)?.showEditor();
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'set',
            description: 'the name of the quick reply set',
            typeList: [ARGUMENT_TYPE.STRING],
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'label',
            description: 'the label of the quick reply',
            typeList: [ARGUMENT_TYPE.STRING],
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the label of the quick reply',
            typeList: [ARGUMENT_TYPE.STRING],
        }),
    ],
    helpString: 'Show the Quick Reply editor. If no QR set is provided, tries to find a QR in one of the active sets.',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'qr-add',
    callback: async (namedArgs, unnamedArgs) => {
        let set = namedArgs.set ?? quickReplyApi.listGlobalSets()[0] ?? quickReplyApi.listChatSets()[0];
        if (set === undefined) {
            toastr.error('No Quick Reply Set given and no active Quick Reply Sets to add the new Quick Reply to.');
            return '';
        }
        let label = namedArgs.label ?? unnamedArgs.toString();
        quickReplyApi.createQuickReply(set, label)?.showEditor();
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'set',
            description: 'the name of the quick reply set',
            typeList: [ARGUMENT_TYPE.STRING],
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'label',
            description: 'the label of the quick reply',
            typeList: [ARGUMENT_TYPE.STRING],
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the label of the quick reply',
            typeList: [ARGUMENT_TYPE.STRING],
        }),
    ],
    helpString: 'Create a new Quick Reply and open its editor. If no QR set is provided, tries to find a QR in one of the active sets.',
}));



// GROUP: Chat Messages
SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'swipes-get',
    aliases: ['getswipe'],
    callback: (args, value) => {
        const idx = args.message && !isNaN(Number(args.message)) ? Number(args.message) : chat.length - 1;
        return chat[idx]?.swipes?.[Number(value)] ?? '';
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'message',
            description: 'the message ID to get swipes from',
            typeList: [ARGUMENT_TYPE.NUMBER],
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the index of the swipe to get',
            typeList: [ARGUMENT_TYPE.NUMBER],
            isRequired: true,
        }),
    ],
    helpString: 'Get the n-th swipe (zero-based index) from the last message or the message with the given message ID.',
    returns: 'swipe text',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'swipes-list',
    callback: (args, value) => {
        const idx = args.message && !isNaN(Number(args.message)) ? Number(args.message) : chat.length - 1;
        return JSON.stringify(chat[idx]?.swipes ?? []);
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'message',
            description: 'the message ID to get swipes from',
            typeList: [ARGUMENT_TYPE.NUMBER],
        }),
    ],
    helpString: 'Get a list of all swipes from the last message or the message with the given message ID.',
    returns: 'a list of swipes',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'swipes-count',
    callback: (args, value) => {
        const idx = args.message && !isNaN(Number(args.message)) ? Number(args.message) : chat.length - 1;
        return `${chat[idx]?.swipes?.length ?? 0}`;
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'message',
            description: 'the message ID to get swipes from',
            typeList: [ARGUMENT_TYPE.NUMBER],
        }),
    ],
    helpString: 'Get the number of all swipes from the last message or the message with the given message ID.',
    returns: 'the number of swipes',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'swipes-index',
    callback: (args, value) => {
        const idx = args.message && !isNaN(Number(args.message)) ? Number(args.message) : chat.length - 1;
        return `${chat[idx]?.swipe_id ?? 0}`;
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'message',
            description: 'the message ID to get the swipe index from',
            typeList: [ARGUMENT_TYPE.NUMBER],
        }),
    ],
    helpString: 'Get the current swipe index from the last message or the message with the given message ID.',
    returns: 'the current swipe index',
}));


SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'swipes-add',
    callback: (namedArgs, unnamedArgs) => {
        const idx = namedArgs.message && !isNaN(Number(namedArgs.message)) ? Number(namedArgs.message) : chat.length - 1;
        const mes = chat[idx];
        const mesDom = document.querySelector(`#chat .mes[mesid="${idx}"]`);
        // close current message editor
        document.querySelector('#curEditTextarea')?.closest('.mes')?.querySelector('.mes_edit_cancel')?.click();
        if (mes.swipe_id === null || mes.swipe_id === undefined) {
            mes.swipe_id = 0;
        }
        if (!mes.swipes) {
            mes.swipes = [mes.mes];
        }
        if (!mes.swipe_info) {
            mes.swipe_info = [{
                send_date: mes.send_date,
                gen_started: mes.gen_started,
                gen_finished: mes.gen_finished,
                extra: structuredClone(mes.extra),
            }];
        }
        mes.swipes.push(unnamedArgs.toString());
        mes.swipe_info.push({
            send_date: getMessageTimeStamp(),
            gen_started: null,
            gen_finished: null,
            extra: {
                bias: extractMessageBias(unnamedArgs.toString()),
                gen_id: Date.now(),
                api: 'manual',
                model: 'slash command',
            },
        });
        mes.swipe_id = mes.swipes.length - 1;
        mes.mes = unnamedArgs.toString();
        mesDom.querySelector('.mes_text').innerHTML = messageFormatting(
            mes.mes,
            mes.name,
            mes.is_system,
            mes.is_user,
            Number(mesDom.getAttribute('mesid')),
        );
        [...mesDom.querySelectorAll('.swipe_right .swipes-counter')].forEach(it=>it.textContent = `${mes.swipe_id + 1}/${mes.swipes.length}`);
        saveChatConditional();
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'message',
            description: 'the ID of the message to add the swipe to',
            typeList: [ARGUMENT_TYPE.NUMBER],
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the text to add as a new swipe',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        }),
    ],
    helpString: 'Add a new swipe to the last message or the message with the provided messageId.',
}));


SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'swipes-del',
    callback: async (args, value) => {
        const idx = args.message && !isNaN(Number(args.message)) ? Number(args.message) : chat.length - 1;
        const mes = chat[idx];
        const mesDom = document.querySelector(`#chat .mes[mesid="${idx}"]`);
        // close current message editor
        document.querySelector('#curEditTextarea')?.closest('.mes')?.querySelector('.mes_edit_cancel')?.click();
        if (mes.swipe_id === undefined || (mes.swipes?.length ?? 0) < 2) {
            return '';
        }
        const swipeId = Number(value == '' ? mes.swipe_id : value);
        if (swipeId + 1 < mes.swipes.length) {
            mes.swipe_id = swipeId;
        } else {
            mes.swipe_id = swipeId - 1;
        }
        mes.swipes.splice(swipeId, 1);
        mes.mes = mes.swipes[mes.swipe_id];
        mes.extra = structuredClone(mes.swipe_info?.[mes.swipe_id]?.extra);
        mes.send_date = mes.swipe_info?.[mes.swipe_id]?.send_date;
        mes.gen_started = mes.swipe_info?.[mes.swipe_id]?.gen_started;
        mes.gen_finished = mes.swipe_info?.[mes.swipe_id]?.gen_finished;
        mesDom.querySelector('.mes_text').innerHTML = messageFormatting(
            mes.mes,
            mes.name,
            mes.is_system,
            mes.is_user,
            Number(mesDom.getAttribute('mesid')),
        );
        mesDom.querySelector('.swipe_right .swipes-counter').textContent = `${mes.swipe_id + 1}/${mes.swipes.length}`;
        saveChatConditional();
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'message',
            description: 'the id of the message to delete the swipe from',
            typeList: [ARGUMENT_TYPE.NUMBER],
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the index of the swipe to delete (0-based)',
            typeList: [ARGUMENT_TYPE.NUMBER],
        }),
    ],
    helpString: 'Delete the current swipe or the swipe at the specified index (0-based).',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'swipes-go',
    callback: (args, value) => {
        const idx = args.message && !isNaN(Number(args.message)) ? Number(args.message) : chat.length - 1;
        const mes = chat[idx];
        const mesDom = document.querySelector(`#chat .mes[mesid="${idx}"]`);
        // close current message editor
        document.querySelector('#curEditTextarea')?.closest('.mes')?.querySelector('.mes_edit_cancel')?.click();
        if (mes.swipe_id === undefined || (mes.swipes?.length ?? 0) < 2) {
            return '';
        }
        const swipeId = Number(value);
        mes.swipe_id = swipeId;
        mes.mes = mes.swipes[mes.swipe_id];
        mes.extra = structuredClone(mes.swipe_info?.[mes.swipe_id]?.extra);
        mes.send_date = mes.swipe_info?.[mes.swipe_id]?.send_date;
        mes.gen_started = mes.swipe_info?.[mes.swipe_id]?.gen_started;
        mes.gen_finished = mes.swipe_info?.[mes.swipe_id]?.gen_finished;
        mesDom.querySelector('.mes_text').innerHTML = messageFormatting(
            mes.mes,
            mes.name,
            mes.is_system,
            mes.is_user,
            Number(mesDom.getAttribute('mesid')),
        );
        mesDom.querySelector('.swipe_right .swipes-counter').textContent = `${mes.swipe_id + 1}/${mes.swipes.length}`;
        saveChatConditional();
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'message',
            description: 'the message ID to go to the swipe for',
            typeList: [ARGUMENT_TYPE.NUMBER],
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the index of the swipe to go to',
            typeList: [ARGUMENT_TYPE.NUMBER],
            isRequired: true,
        }),
    ],
    helpString: 'Go to the swipe. 0-based index.',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'swipes-swipe',
    callback: async (args, value) => {
        const id = chat.length - 1;
        const currentMessage = document.querySelector(`#chat [mesid="${id}"]`);
        await executeSlashCommands('/swipes-count | /sub {{pipe}} 1 | /swipes-go');
        currentMessage.querySelector('.swipe_right:not(.stus--btn)').click();
        let ended = false;
        const listener = ()=>{ ended = true; };
        eventSource.once(event_types.GENERATION_ENDED, listener);
        while (!ended) {
            if (/**@type {SlashCommandAbortController}*/(args._abortController)?.signal?.aborted) {
                eventSource.removeListener(event_types.GENERATION_ENDED, listener);
                return '';
            }
            await delay(200);
        }
        await delay(200);
        return chat[id].mes;
    },
    helpString: 'Trigger a new swipe on the last message.',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'message-edit',
    callback: async(args, value) => {
        /**@type {HTMLTextAreaElement}*/
        const input = document.querySelector('#send_textarea');
        const restoreFocus = document.activeElement == input;
        value = value.replace(/{{space}}/g, ' ');
        document.querySelector(`#chat [mesid="${args.message ?? chat.length - 1}"] .mes_edit`).click();
        if (isTrueBoolean(args.append)) {
            document.querySelector('#curEditTextarea').value += value;
        } else {
            document.querySelector('#curEditTextarea').value = value;
        }
        document.querySelector(`#chat [mesid="${args.message ?? chat.length - 1}"] .mes_edit_done`).click();
        if (restoreFocus) input.focus();
        await delay(500);
        return '';
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'message',
            description: 'the message ID to edit',
            typeList: [ARGUMENT_TYPE.NUMBER],
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'append',
            description: 'whether to append the new text to the end of the message',
            typeList: [ARGUMENT_TYPE.BOOLEAN],
            defaultValue: 'false',
            enumList: ['true', 'false'],
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the new text for the message',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        }),
    ],
    helpString: 'Edit the current message or the message at the provided message ID. Use <code>append=true</code> to add the provided text at the end of the message. Use <code>{{space}}</code> to add space at the beginning of the text.',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'message-move',
    /**
     * @param {{from:string, to:string, up:string, down:string}} args
     */
    callback: async(args)=>{
        let idx = parseInt(args.from);
        let dest = parseInt(args.to);
        if (args.up !== undefined) {
            dest = idx - parseInt(args.up);
        } else if (args.down !== undefined) {
            dest = idx + parseInt(args.down);
        }
        /**@type {HTMLTextAreaElement}*/
        const input = document.querySelector('#send_textarea');
        const restoreFocus = document.activeElement == input;
        const edit = /**@type {HTMLElement}*/(document.querySelector(`#chat [mesid="${args.from}"] .mes_edit`));
        const done = /**@type {HTMLElement}*/(document.querySelector(`#chat [mesid="${args.from}"] .mes_edit_done`));
        edit.click();
        if (idx < dest) {
            const btn = /**@type {HTMLElement}*/(document.querySelector(`#chat [mesid="${args.from}"] .mes_edit_down`));
            while (idx < dest && idx + 1 < chat.length) {
                btn.click();
                idx++;
            }
        } else if (idx > dest) {
            const btn = /**@type {HTMLElement}*/(document.querySelector(`#chat [mesid="${args.from}"] .mes_edit_up`));
            while (idx > dest && idx > 0) {
                btn.click();
                idx--;
            }
        }
        done.click();
        if (restoreFocus) input.focus();
        await delay(500);
        return '';
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'from',
            description: 'the message ID to move',
            typeList: [ARGUMENT_TYPE.NUMBER],
            isRequired: true,
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'to',
            description: 'where to move the message',
            typeList: [ARGUMENT_TYPE.NUMBER],
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'up',
            description: 'number of slots to move the message up (decrease message ID)',
            typeList: [ARGUMENT_TYPE.NUMBER],
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'down',
            description: 'number of slots to move the message down (increase message ID)',
            typeList: [ARGUMENT_TYPE.NUMBER],
        }),
    ],
    helpString: `
        <div>
            Move a message up or down in the chat.
        </div>
        <div>
            <strong>Examples:</strong>
            <ul>
                <li>
                    <pre><code class="language-stscript">/message-move from={{lastMessageId}} to=10 |</code></pre>
                    <pre><code class="language-stscript">/message-move from={{lastMessageId}} up=2 |</code></pre>
                    <pre><code class="language-stscript">/message-move from=3 down=10 |</code></pre>
                </li>
            </ul>
        </div>
    `,
}));

/** @type {{listen:()=>void, unlisten:()=>void, event:string, query:string, id:string}[]} */
const messageOnListeners = [];
const messageOnUnlistenListen = ()=>messageOnListeners.forEach(it=>{
    it.unlisten();
    it.listen();
});
eventSource.on(event_types.CHAT_CHANGED, ()=>{
    messageOnListeners.forEach(it=>it.unlisten());
    while (messageOnListeners.pop());
});
eventSource.on(event_types.USER_MESSAGE_RENDERED, ()=>messageOnUnlistenListen());
eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, ()=>messageOnUnlistenListen());
eventSource.on(event_types.MESSAGE_SWIPED, ()=>messageOnUnlistenListen());
eventSource.on(event_types.MESSAGE_UPDATED, ()=>messageOnUnlistenListen());
eventSource.on(event_types.MESSAGE_DELETED, ()=>messageOnUnlistenListen());
SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'message-on',
    /**
     * @param {{event:string, callback:SlashCommandClosure, quiet:string}} args
     * @param {string} value
     */
    callback: (args, value)=>{
        if (!args.event) throw new Error('/message-on requires event= to be set');
        if (!args.callback) throw new Error('/message-on requires callback= to be set');
        if (!value) throw new Error('/message-on requires a CSS query to select targeted elements');
        const listen = ()=>{
            const els = [...document.querySelector('#chat .last_mes').querySelectorAll(value)];
            for (const el of els) {
                el.addEventListener(args.event, listener, { once:true });
            }
            if (isFalseBoolean(args.quiet)) {
                toastr.info(`Event listener attached to ${els.length} elements.`, '/message-on');
            }
        };
        const els = [...document.querySelector('#chat .last_mes').querySelectorAll(value)];
        const unlisten = ()=>{
            for (const el of els) {
                el?.removeEventListener(args.event, listener);
            }
        };
        const listener = async(evt)=>{
            args.callback.scope.setMacro('target', evt.currentTarget.outerHTML);
            await args.callback.execute();
        };
        listen();
        const id = uuidv4();
        messageOnListeners.push({ listen, unlisten, event:args.event, query:value, id });
        return id;
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({ name: 'event',
            description: 'event type to listen for',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        }),
        SlashCommandNamedArgument.fromProps({ name: 'callback',
            description: 'closure to run when triggered',
            typeList: [ARGUMENT_TYPE.CLOSURE],
            isRequired: true,
        }),
        SlashCommandNamedArgument.fromProps({ name: 'quiet',
            description: 'whether to show toast messages when event listeners are attached',
            typeList: [ARGUMENT_TYPE.BOOLEAN],
            isRequired: false,
            defaultValue: 'true',
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({ description: 'CSS selector to target an element in the last message',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        }),
    ],
    returns: 'listener ID',
    helpString: `
        <div>
            Add event listeners to the last chat message.
        </div>
        <div>
            Stops listening when changing to another chat.
        </div>
        <div>
            <strong>Examples:</strong>
            <ul>
                <li>
                    <pre><code class="language-stscript">/message-on event=click quiet=false callback={:\n    /$ take=textContent {{target}} |\n    /let prompt Continue by weaving the following suggestion into your next response: {{pipe}} |\n    /inputhistory-add {{var::prompt}} |\n    /send {{var::prompt}} |\n    /trigger\n:} .custom-suggestion |\n/setvar key=listenerId |</code></pre>
                </li>
            </ul>
        </div>
    `,
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'message-off',
    /**
     *
     * @param {{event:string, query:string, id:string, quiet:string}} args
     */
    callback: (args, value)=>{
        const event = args.event ?? '';
        const query = args.query ?? '';
        const id = args.id ?? '';
        if (event == '' && query == '' && id == '') throw new Error('/message-off requires event= or query= or id= to be set');
        const check = it=>{
            return (event == '' || it.event == event) && (query == '' || it.query == query) && (id == '' || it.id == id);
        };
        const listeners = messageOnListeners.filter(check);
        let count = 0;
        for (const listener of listeners) {
            count++;
            listener.unlisten();
            messageOnListeners.splice(messageOnListeners.indexOf(listener), 1);
        }
        if (isFalseBoolean(args.quiet)) {
            toastr.info(`${count} listeners removed.`, '/message-off');
        }
        return '';
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({ name: 'id',
            description: 'listener ID',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: false,
        }),
        SlashCommandNamedArgument.fromProps({ name: 'event',
            description: 'event type to listen for',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: false,
        }),
        SlashCommandNamedArgument.fromProps({ name: 'query',
            description: 'CSS selector to target an element in the last message',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: false,
        }),
        SlashCommandNamedArgument.fromProps({ name: 'quiet',
            description: 'whether to show toast messages when event listeners are attached',
            typeList: [ARGUMENT_TYPE.BOOLEAN],
            isRequired: false,
            defaultValue: 'true',
        }),
    ],
    helpString: `
        <div>
            Remove an event listener added with /message-on.
        </div>
        <div>
            <strong>Examples:</strong>
            <ul>
                <li>
                    All messages:
                    <pre><code class="language-stscript">/message-off id={{getvar::listenerId}}</code></pre>
                </li>
            </ul>
        </div>
    `,
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'message-listeners',
    callback: (args, value)=>{
        return JSON.stringify(messageOnListeners.map(it=>({ id:it.id, query:it.query, event:it.event })));
    },
    helpString: 'Lists all currently active listeners.',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'role-swap',
    callback: (args, value)=>{
        const chatRange = value.length == 0 ? chat : getRange(value, chat);
        for (const mes of chatRange) {
            mes.is_user = !mes.is_user;
            document.querySelector(`#chat .mes[mesid="${chat.indexOf(mes)}"]`)?.setAttribute('is_user', mes.is_user);
        }
        saveChatDebounced();
    },
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({ description: 'message id or range to swap',
            typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.RANGE],
        }),
    ],
    helpString: `
        <div>
        Swap roles (user/AI) for all messages in the chat, or for a selected message or range of messages.
        </div>
        <div>
            <strong>Examples:</strong>
            <ul>
                <li>
                    All messages:
                    <pre><code class="language-stscript">/role-swap</code></pre>
                </li>
                <li>
                    Last message:
                    <pre><code class="language-stscript">/role-swap {{lastMessageId}}</code></pre>
                </li>
                <li>
                    Last message:
                    <pre><code class="language-stscript">/role-swap -1</code></pre>
                </li>
                <li>
                    Second to last message:
                    <pre><code class="language-stscript">/role-swap -2</code></pre>
                </li>
                <li>
                    First 10 messages:
                    <pre><code class="language-stscript">/role-swap 0-10</code></pre>
                </li>
                <li>
                    Last 10 messages:
                    <pre><code class="language-stscript">/role-swap -10-</code></pre>
                </li>
                <li>
                    All messages except last 10:
                    <pre><code class="language-stscript">/role-swap 0--10</code></pre>
                </li>
            </ul>
        </div>
    `,
}));



// GROUP: Time & Date
SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'timestamp',
    callback: (args, value) => {
        return JSON.stringify(new Date().getTime());
    },
    helpString: 'Returns the number of milliseconds midnight at the beginning of January 1, 1970, UTC.',
    returns: 'timestamp',
}));



// GROUP: Async
SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'fireandforget',
    /**
     *
     * @param {import('../../../slash-commands/SlashCommand.js').NamedArguments} args
     * @param {(string|SlashCommandClosure)[]} value
     */
    callback: (args, value) => {
        /**@type {string|SlashCommandClosure} */
        let command;
        if (value) {
            if (value[0] instanceof SlashCommandClosure) {
                command = value[0];
            } else {
                command = value.join(' ');
            }
        }
        if (command instanceof SlashCommandClosure) {
            /**@type {SlashCommandClosure} */
            const closure = command;
            closure.scope.parent = args._scope;
            closure.execute();
        } else {
            executeSlashCommandsWithOptions(
                command,
                {
                    handleExecutionErrors: true,
                    handleParserErrors: false,
                    parserFlags: args._parserFlags,
                    scope: args._scope,
                },
            );
        }
    },
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the closure or command to execute',
            typeList: [ARGUMENT_TYPE.CLOSURE, ARGUMENT_TYPE.SUBCOMMAND],
            isRequired: true,
        }),
    ],
    splitUnnamedArgument: true,
    helpString: 'Execute a closure or command without waiting for it to finish.',
}));



//GROUP: Audio
SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'sfx',
    /**
     *
     * @param {{volume:string, await:string}} args
     * @param {string} value
     * @returns
     */
    callback: async(args, value)=>{
        const response = await fetch(value, { headers: { responseType: 'arraybuffer' } });
        if (!response.ok) {
            throw new Error(`${response.status} - ${response.statusText}: /sfx ${value}`);
        }
        const con = new AudioContext();
        const src = con.createBufferSource();
        src.buffer = await con.decodeAudioData(await response.arrayBuffer());
        const volume = con.createGain();
        volume.gain.value = Number(args.volume ?? '1');
        volume.connect(con.destination);
        src.connect(volume);
        src.start();
        if (isTrueBoolean(args.await)) {
            await new Promise(resolve=>src.addEventListener('ended', resolve));
        }
        return '';
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({ name: 'volume',
            description: 'playback volume',
            typeList: [ARGUMENT_TYPE.NUMBER],
            defaultValue: '1.0',
        }),
        SlashCommandNamedArgument.fromProps({ name: 'await',
            description: 'whether to wait for the sound to finish playing before continuing',
            typeList: [ARGUMENT_TYPE.BOOLEAN],
            defaultValue: 'false',
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({ description: 'url to audio file',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        }),
    ],
    helpString: `
        <div>
            Plays an audio file.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code class="language-stscript">/sfx volume=1.5 await=true /user/audio/mySound.wav | /echo finished playing sound</code></pre>
                </li>
            </ul>
        </div>
    `,
}));



// GROUP: Undocumented
SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'fetch',
    callback: async (args, value) => {
        if (!window.stfetch) {
            toastr.error('Userscript missing: SillyTavern - Fetch');
            throw new Error('Userscript missing: SillyTavern - Fetch');
        }
        try {
            const response = await window.stfetch({ url: value });
            return response.responseText;
        }
        catch (ex) {
            console.warn('[LALIB]', '[FETCH]', ex);
        }
    },
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the url to fetch',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        }),
    ],
    helpString: 'UNDOCUMENTED',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: '$',
    callback: (args, value) => {
        const dom = document.createRange().createContextualFragment(value);
        let el;
        if (args.query) {
            el = dom.querySelector(args.query);
        } else if (dom.children.length == 1) {
            el = dom.children[0];
        } else {
            el = document.createElement('div');
            el.append(...dom.children);
        }
        if (args.call) {
            el[args.call]();
            return [...dom.children].map(it => it.outerHTML).join('\n');
        } else {
            const result = el?.[args.take ?? 'outerHTML'];
            if (typeof result != 'string') {
                return JSON.stringify(result);
            }
            return result;
        }
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'query',
            description: 'css selector to query the provided html',
            typeList: [ARGUMENT_TYPE.STRING],
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'take',
            description: 'property to take from the resulting element',
            typeList: [ARGUMENT_TYPE.STRING],
            defaultValue: 'outerHTML',
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'call',
            description: 'method to call on the resulting element',
            typeList: [ARGUMENT_TYPE.STRING],
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the html to operate on',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        }),
    ],
    helpString: 'UNDOCUMENTED',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: '$$',
    callback: (args, value) => {
        const dom = document.createRange().createContextualFragment(value);
        let els;
        if (args.query) {
            els = Array.from(dom.querySelectorAll(args.query));
        } else {
            els = Array.from(dom.children);
        }
        if (args.call) {
            els.forEach(el => el[args.call]());
            return [...dom.children].map(it => it.outerHTML).join('\n');
        } else {
            const result = els.map(el => el?.[args.take ?? 'outerHTML']);
            if (typeof result != 'string') {
                return JSON.stringify(result);
            }
            return result;
        }
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'query',
            description: 'css selector to query the provided html',
            typeList: [ARGUMENT_TYPE.STRING],
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'take',
            description: 'property to take from the resulting elements',
            typeList: [ARGUMENT_TYPE.STRING],
            defaultValue: 'outerHTML',
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'call',
            description: 'method to call on the resulting elements',
            typeList: [ARGUMENT_TYPE.STRING],
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the html to operate on',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        }),
    ],
    helpString: 'UNDOCUMENTED',
}));
