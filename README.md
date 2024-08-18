# LALib

Library of STScript commands.


- Boolean Operations (test, and, or, not)
- List Operations (foreach, map, filter, find, slice, splice, shuffle, pick, reverse, dict, keys)
- Split & Join (split, join)
- Text Operations (trim, diff, json-pretty, substitute, wordcount, sentencecount, segment)
- Regular Expressions (re-escape, re-test, re-replace)
- Accessing & Manipulating Structured Data (getat, setat)
- Exception Handling (try, catch)
- Null Handling (ifempty, ifnullish)
- Copy & Download (copy, download)
- DOM Interaction (dom)
- Characters (char-get)
- Group Chats (memberpos, group-get)
- Conditionals - switch (switch, case)
- Conditionals - if (ife, elseif, else, then)
- World Info (wi-list-books, wi-list-entries)
- Costumes / Sprites (costumes)
- Quick Replies (qr-edit, qr-add)
- Chat Messages (swipes-get, swipes-list, swipes-count, swipes-index, swipes-add, swipes-del, swipes-go, swipes-swipe, message-edit, message-move, message-on, message-off, message-listeners, role-swap)
- Time & Date (timestamp)
- Async (fireandforget, sfx)





## Requirements

- [Costumes Plugin](https://github.com/LenAnderson/SillyTavern-Costumes.git) for `/costumes` command.






## Commands







### Help



#### `/lalib?`

Lists LALib commands

##### Examples

```stscript
/lalib?
```







### Boolean Operations



#### `/test`
- `[left:variable_name|number|string]`  
 the left operand value
- `[rule=gt|gte|lt|lte|eq|neq|not|in|nin]`  
 the boolean operation rule
- `[right:variable_name|number|string]`  
 the right operand value

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


##### Examples

```stscript
/setvar key=x 1 |
/setvar key=y 2 |
/test left={{getvar::x}} rule=eq right={{getvar::y}} |
/echo The result will be "false": {{pipe}}
```

```stscript
/setvar key=x 1 |
/setvar key=y 2 |
/test left={{getvar::x}} rule=lt right={{getvar::y}} |
/echo The result will be "true": {{pipe}}
```





#### `/and`
- `[left:boolean]`  
 the left value to evaluate
- `[right:boolean]`  
 the right value to evaluate

Returns true if both left and right are true, otherwise false.

##### Examples

```stscript
/and left=true right=false |
/echo The result will be "false": {{pipe}}
```

```stscript
/and left=true right=true |
/echo The result will be "true": {{pipe}}
```





#### `/or`
- `[left:boolean]`  
 the left value to evaluate
- `[right:boolean]`  
 the right value to evaluate

Returns true if at least one of left and right are true, false if both are false.

##### Examples

```stscript
/or left=true right=false |
/echo The result will be "true": {{pipe}}
```

```stscript
/or left=false right=false |
/echo The result will be "false": {{pipe}}
```





#### `/not`
- `(boolean)`  
 the value to negate

Returns true if value is false, otherwise true.

##### Examples

```stscript
/not true |
/echo The result will be "false": {{pipe}}
```

```stscript
/not false |
/echo The result will be "true": {{pipe}}
```







### List Operations



#### `/foreach`
- `[list:list|dictionary]?`  
 *optional* the list to iterate over
- `[var:variable_name]?`  
 *optional* name of the chat variable to use as the list
- `[globalvar:variable_name]?`  
 *optional* name of the global variable to use as the list
- `(subcommand|closure)`  
 the command to execute for each item, with {{item}} and {{index}} placeholders

Executes the provided command for each item of a list or dictionary, replacing {{item}} and {{index}} with the current item and index.

##### Examples

```stscript
/setvar key=x ["A", "B", "C"] |
/foreach var=x {:
    /echo Item {{index}} is {{item}} |
    /delay 400
:}
```

```stscript
/foreach list={"a":"foo","b":"bar"} {:
    /echo Item {{index}} is {{item}} |
    /delay 400
:}
```





#### `/map`
- `[asList=true|false]? = false`  
 *optional* whether to return the results of a dictionary/object as a list
- `[list:list]?`  
 *optional* the list to map over
- `[var:variable_name]?`  
 *optional* name of the chat variable to use as the list
- `[globalvar:variable_name]?`  
 *optional* name of the global variable to use as the list
- `(subcommand|closure)`  
 the command to execute for each item, with {{item}} and {{index}} placeholders

<div>
Executes a command for each item of a list or dictionary and returns the list or dictionary of the command results.
</div>


##### Examples

```stscript
/setvar key=x [1,2,3] |
/map var=x {:
    /mul {{item}} {{item}}
:} |
/echo Squares: {{pipe}}
```

```stscript
/map list={"a":"foo","b":"bar"} {:
    /return This is item {{index}} with value {{item}}
:} |
/echo
```

```stscript
/map asList=True list={"a":"foo","b":"bar"} {:
    /return This is item {{index}} with value {{item}}
:} |
/echo
```





#### `/filter`
- `[list:list|dictionary]?`  
 *optional* the list or dictionary to filter
- `[var:variable_name]?`  
 *optional* name of the chat variable containing the list or dictionary
- `[globalvar:variable_name]?`  
 *optional* name of the global variable containing the list or dictionary
- `(subcommand|closure)`  
 the command to execute for each item, with {{item}} and {{index}} placeholders

<div>
Executes command for each item of a list or dictionary and returns the list or dictionary of only those items where the command returned true.
</div>


##### Examples

```stscript
/setvar key=x [1,2,3,4,5,6,7,8,9,10] |
/filter var=x {:
    /mod {{item}} 2 |
    /test left={{pipe}} rule=eq right=0
:} |
/echo Only even numbers: {{pipe}}
```

```stscript
/filter list={"a":"foo","b":"bar"} {:
    /test left={{item}} rule=in right=a
:} |
/echo Only items that include an "a": {{pipe}}
```





#### `/find`
- `[list:list|dictionary]?`  
 *optional* the list or dictionary to search
- `[var:variable_name]?`  
 *optional* name of the chat variable containing the list or dictionary
- `[globalvar:variable_name]?`  
 *optional* name of the global variable containing the list or dictionary
- `[index=true|false]? = false`  
 *optional* return the matching item's index instead of the item
- `[last=true|false]? = false`  
 *optional* return the last instead of the first matching item
- `(subcommand|closure)`  
 the command to execute for each item, using {{item}} and {{index}} as placeholders

<div>
Executes the provided command for each item of a list or dictionary and returns the first item where the command returned true.
</div>


##### Examples

```stscript
/setvar key=x [2,4,6,8,10] |
/find var=x {:
    /test left={{item}} rule=gt right=5
:} |
/echo The first item greater than 5: {{pipe}}
```

```stscript
/find list={"a":"foo","b":"bar","c":"foobar","d":"barfoo"} {:
    /len {{item}} |
    /test left={{pipe}} rule=gt right=3
:} |
/echo The first item longer than 3 characters: {{pipe}}
```





#### `/slice`
- `[start:number]`  
 the starting index of the slice, negative numbers start from the back
- `[end:number]?`  
 *optional* the ending index of the slice (non-inclusive)
- `[length:number]?`  
 *optional* the length of the slice
- `[var:variable_name]?`  
 *optional* name of the chat variable to slice
- `[globalvar:variable_name]?`  
 *optional* name of the global variable to slice
- `(string|list)?`  
 *optional* the value to slice

<div>
Retrieves a slice of a list or string.
</div>


##### Examples

```stscript
/setvar key=x [1,2,3,4,5] |
/slice var=x start=2 |
/echo The result will be "[3,4,5]": {{pipe}}
```

```stscript
/slice start=-3 foo bar |
/echo The result will be "bar": {{pipe}}
```





#### `/splice`
- `[start:number]`  
 the starting index of the slice, negative numbers start from the back
- `[delete:number]?`  
 *optional* the number of elements to remove in the list from start
- `[value:list]?`  
 *optional* the list to operate on
- `[var:variable_name]?`  
 *optional* name of the chat variable to operate on
- `[globalvar:variable_name]?`  
 *optional* name of the global variable to operate on
- `(string|number|boolean|list|dictionary)?`  
 *optional* the elements to add, beginning from start

<div>
Creates a new list with some elements removed and / or replaced at a given index.
</div>


##### Examples

```stscript
/splice value=[0,1,2,3,4,5,6] start=3 delete=3 30 40 50 |
/echo |
// result will be: [0,1,2,30,40,50,6] |
```

```stscript
/splice value=[0,1,2,3,4,5,6] start=3 delete=3 |
/echo |
// result will be: [0,1,2,6] |
```

```stscript
/splice value=[0,1,2,3,4,5,6] start=3 100 |
/echo |
// result will be: [0,1,2,100,3,4,5,6] |
```

```stscript
/splice value=[0,1,2,3,4,5,6] start=-1 delete=1 |
/echo |
// result will be: [0,1,2,3,4,5] |
```





#### `/shuffle`
- `(list)`  
 the list to shuffle

Returns a shuffled list.

##### Examples

```stscript
/shuffle [1,2,3,4,5] |
/echo
```





#### `/pick`
- `[items:number]? = 1`  
 *optional* how many items to pick (if greater than one, will return a list)
- `[list=true|false]? = false`  
 *optional* whether to return a list, even if only one item is picked
- `(list)`  
 the list to pick from

Picks one random item or <code>items</code> number of random items from a list (no duplicates).

##### Examples

```stscript
/pick [1,2,3,4] |
/echo
```

```stscript
/pick items=2 [1,2,3,4] |
/echo
```

```stscript
/pick list=true [1,2,3,4] |
/echo
```





#### `/reverse`
- `(list)`  
 the list to reverse

Returns a reversed list.

##### Examples

```stscript
/reverse [1,2,3] |
/echo result will be [3,2,1]: {{pipe}}
```





#### `/dict`
- `[var:variable_name]?`  
 *optional* name of the chat variable to use as input
- `[globalvar:variable_name]?`  
 *optional* name of the global variable to use as input
- `(list)`  
 a list of lists, where each inner list has at least two elements

<div>
Takes a list of lists (each item must be a list of at least two items) and creates a dictionary by using each
items first item as key and each items second item as value.
</div>


##### Examples

```stscript
/setvar key=x [
    ["a", 1],
    ["b", 2],
    ["c", 3]
] |
/dict var=x |
/echo
```





#### `/keys`
- `[var:variable_name]?`  
 *optional* name of the chat variable to get keys from
- `[globalvar:variable_name]?`  
 *optional* name of the global variable to get keys from
- `(dictionary)?`  
 *optional* the dictionary/object to get keys from

Return the list of keys of a dictionary / object.

##### Examples

```stscript
/keys list={"a":"foo","b":"bar","c":"foobar","d":"barfoo"} |
/echo
```







### Split & Join



#### `/split`
- `[find:string]? = ,`  
 *optional* the text to split at
- `[trim=true|false]? = true`  
 *optional* whether to trim the resulting values
- `[var:variable_name]?`  
 *optional* name of the chat variable to split
- `[globalvar:variable_name]?`  
 *optional* name of the global variable to split
- `(string)?`  
 *optional* the value to split

<div>
Splits value into list at every occurrence of find. Supports regex <code>find="/\\s/"</code>
</div>


##### Examples

```stscript
/split foo, bar |
/echo The result will be ["foo", "bar"]: {{pipe}}
```

```stscript
/split find=/o.+?o/g The quick brown fox jumps over the lazy dog. |
/echo The result will be ["The quick br", "x jumps", "g."]: {{pipe}}
```





#### `/join`
- `[glue:string]? = , `  
 *optional* the string to join the list items with
- `[var:variable_name]?`  
 *optional* name of the chat variable containing the list
- `[globalvar:variable_name]?`  
 *optional* name of the global variable containing the list
- `(list)?`  
 *optional* the list to join

<div>
Joins the items of a list with glue into a single string. Use <code>glue={{space}}</code> to join with a space.
</div>


##### Examples

```stscript
/setvar key=x ["a","b","c"] |
/join var=x |
/echo The result will be "a, b, c": {{pipe}}
```

```stscript
/join glue=::: ["foo", "bar"] |
/echo The result will be "foo:::bar": {{pipe}}
```







### Text Operations



#### `/trim`
- `(string)`  
 text to trim

Removes whitespace at the start and end of the text.

##### Examples

```stscript
/return [" foo", "bar "] |
/getat index=0 |
/trim |
/echo
```





#### `/diff`
- `[all=true|false]? = true`  
 *optional* show new, old, and diff side by side
- `[buttons=true|false]? = true`  
 *optional* add buttons to pick which text to return
- `[stripcode=true|false]? = true`  
 *optional* remove all codeblocks before diffing
- `[notes:string]?`  
 *optional* show additional notes or comments above the comparison
- `[old:string]`  
 the old text to compare
- `[new:string]`  
 the new text to compare

Compares old text vs new text and displays the difference between the two. Use <code>all=true</code> to show new, old, and diff side by side. Use <code>buttons=true</code> to add buttons to pick which text to return. Use <code>stripcode=true</code> to remove all codeblocks before diffing. Use <code>notes="some text"</code> to show additional notes or comments above the comparison.

##### Examples

```stscript
/echo comparing the last two messages |

/sub {{lastMessageId}} 1 |
/messages names=off |
/split find=``` |
/getat index=-1 |
/let old {{pipe}} |
/setvar key=old {{var::old}} |

/messages names=off {{lastMessageId}} |
/split find=``` |
/getat index=-1 |
/let new {{pipe}} |
/setvar key=new {{var::new}} |

/diff old={{var::old}} new={{var::new}}
```

```stscript
/diff old="The quick brown fox jumps over the lazy dog." new="The fast spotted fox jumps across the sleeping dog." notes="Foxes and dogs." all=true
```





#### `/json-pretty`
- `(string)`  
 JSON to pretty print

Pretty print JSON.

##### Examples

```stscript
/json-pretty {"a":1, "b":[1,2,3]} |
/send ```json{{newline}}{{pipe}}{{newline}}```
```





#### `/substitute`
- `(string)`  
 text to substitute macros in

Substitute macros in text.

##### Examples

```stscript
/setvar key=x char |
/setvar key=y user |
/substitute {{{{getvar::x}}}} |
/echo x turns into the char name: {{pipe}} |
/delay 500 |
/substitute {{{{getvar::y}}}} |
/echo and y turns into the persona name: {{pipe}} |
```





#### `/wordcount`
- `[language:string]? = en`  
 *optional* Two character language code according to IETF BCP 47
- `(string)`  
 the text to count words in

Count the number of words in text. Language defaults to "en". Supply a two character language according to IETF BCP 47 language tags for other languages.

##### Examples

```stscript
/wordcount The quick brown fox jumps over the lazy dog. |
/echo The result will be nine: {{pipe}}
```





#### `/sentencecount`
- `[language:string]? = en`  
 *optional* Two character language code according to IETF BCP 47
- `(string)`  
 the text to count sentences in

Count the number of sentences in text. Language defaults to "en". Supply a two character language according to IETF BCP 47 language tags for other languages.

##### Examples

```stscript
/sentencecount The quick brown fox jumps over the lazy dog. Does the quick brown fox jump over the lazy dog? |
/echo The result will be two: {{pipe}}
```





#### `/segment`
- `[granularity=grapheme|word|sentence]? = word`  
 *optional* The unit to segment the text into: grapheme, word or sentence
- `[language:string]? = en`  
 *optional* Two character language code according to IETF BCP 47
- `(string)`  
 the text to segment

Return the graphemes (characters, basically), words or sentences found in the text. Supply a two character language according to IETF BCP 47 language tags for other languages.

##### Examples

```stscript
/segment granularity=sentence  The fox. The dog. |
/echo The two sentences are: {{pipe}}
```

```stscript
/segment granularity=word  The fox. The dog. |
/echo The four word are: {{pipe}}
```







### Regular Expressions



#### `/re-escape`
- `(string)`  
 text to escape

<div>Escapes text to be used literally inside a regex.</div>


##### Examples

```stscript
/re-escape foo/bar foo.bar |
/echo
```

```stscript
/re-escape {{char}} |
/re-replace find=/\b{{pipe}}\b/g replace=FOO {{lastMessage}} |
/echo
```





#### `/re-test`
- `[find:string]`  
 the regular expression to test against
- `[var:variable_name]?`  
 *optional* name of the chat variable to test
- `[globalvar:variable_name]?`  
 *optional* name of the global variable to test
- `(string)?`  
 *optional* the value to test

Tests if the provided variable or value matches a regular expression.

##### Examples

```stscript
/re-test find=/dog/i The quick brown fox jumps over the lazy dog. |
/echo result will be true: {{pipe}}
```

```stscript
// pipes in the regex must to be escaped |
/re-test find=/dog\|cat/i The quick brown fox jumps over the lazy dog. |
/echo result will be true: {{pipe}}
```

```stscript
// if you want to find a literal pipe, you have to also escape the backslash escaping it |
/re-test find=/dog\\\|cat/i The quick brown fox jumps over the lazy dog. |
/echo result will be false: {{pipe}}
```

```stscript
// or you can put quote around the regex and forget about escaping... |
/re-test find="/dog|cat/i" The quick brown fox jumps over the lazy dog. |
/echo result will be true ("dog" or "cat"): {{pipe}} |
/delay 500 |
/re-test find="/dog\|cat/i" The quick brown fox jumps over the lazy dog. |
/echo result will be false (only matching "dog\|cat"): {{pipe}}
```





#### `/re-replace`
- `[find:string]`  
 the regular expression (/pattern/flags)
- `[replace:string]?`  
 *optional* the replacement text
- `[cmd:closure|subcommand]?`  
 *optional* a closure or slash command to execute for each match
- `[var:variable_name]?`  
 *optional* name of the chat variable to perform the replacement on
- `[globalvar:variable_name]?`  
 *optional* name of the global variable to perform the replacement on
- `(string)?`  
 *optional* the value to perform the replacement on

<div>
Searches the provided variable or value with the regular expression and replaces matches with the replace value or the return value of the provided closure or slash command. For text replacements and slash commands, use <code>$1</code>, <code>$2</code>, ... to reference capturing groups. In closures use <code>{{$1}}</code>, <code>{{$2}}</code>, ... to reference capturing groups.
</div>


##### Examples

```stscript
// simple find and replace |
/re-replace find=/dog/i replace=cat The quick brown fox jumps over the lazy dog. |
/echo result will be "[...] the lazy cat.": {{pipe}}
```

```stscript
// Use $1, $2, ... to reference capturing groups. |
/re-replace find="/\b(\w+)\b dog/i" replace="cat $1" The quick brown fox jumps over the lazy dog. |
/echo result will be "[...] over the cat lazy.": {{pipe}}
```

```stscript
// You can also use the return value of another command or closure as the replacement text. |
// In closures use {{$1}}, {{$2}}, ... to reference capturing groups. |
/re-replace
    find=/(fox\|dog)/ig
    cmd={:
        /input replace {{$1}} with:
    :}
    The quick brown fox jumps over the lazy dog.
|
/echo who jumps over who now? {{pipe}}
```







### Accessing & Manipulating Structured Data



#### `/getat`
- `[index:string|number|list]`  
 the index, field name, or list of indices/field names to retrieve
- `[var:variable_name]?`  
 *optional* name of the chat variable to retrieve from
- `[globalvar:variable_name]?`  
 *optional* name of the global variable to retrieve from
- `(string)?`  
 *optional* the value to retrieve from (if not using a variable)

Retrieves an item from a list or a property from a dictionary.

##### Examples

```stscript
/setvar key=x {
    "a": [
        1,
        2,
        {
            "b": "foo",
            "c": "bar"
        }
    ],
    "d": "D"
} |
/getat var=x index=d |
/echo The result will be "D": {{pipe}}
```

```stscript
/return {
    "a": [
        1,
        2,
        {
            "b": "foo",
            "c": "bar"
        }
    ],
    "d": "D"
} |
/getat index=["a", 2, "b"] |
/echo The result will be "foo": {{pipe}}
```

```stscript
/return {
    "a": [
        1,
        2,
        {
            "b": "foo",
            "c": "bar"
        }
    ],
    "d": "D"
} |
/getat index=a |
/getat index=2 |
/getat index=c |
/echo The result will be "bar": {{pipe}}
```





#### `/setat`
- `[index:string|list]`  
 the index or key to set the value at
- `[var:variable_name]?`  
 *optional* name of the chat variable to update
- `[globalvar:variable_name]?`  
 *optional* name of the global variable to update
- `[value:list|dictionary]?`  
 *optional* the value to update
- `(string)`  
 the value to set

<div>
Sets an item in a list or a property in a dictionary.
</div>


##### Examples

```stscript
/setvar key=x {
    "a": [
        1,
        2,
        {
            "b": "foo",
            "c": "bar"
        }
    ],
    "d": "D"
} |
/setat var=x index=d new value for D |
/echo {{getvar::x}}
```

```stscript
/setvar key=x {
    "a": [
        1,
        2,
        {
            "b": "foo",
            "c": "bar"
        }
    ],
    "d": "D"
} |
/setat var=x index=["a", 2, "c"] new value for bar |
/echo {{getvar::x}}
```

```stscript
/flushvar x |
/setat var=x index=["a","b",2] creating new objects or list |
/echo {{getvar::x}}
```







### Exception Handling



#### `/try`
- `(subcommand|closure)`  
 the command to try

<div>
Attempts to execute the provided command and catches any exceptions thrown. Use with <code>/catch</code>.
</div>


##### Examples

```stscript
/echo Try this first while being connected to an LLM, then without a connection. |
/setvar key=myPrompt Say hello! |
/try {:
	/getvar myPrompt |
	/gen {{pipe}}
:} |
/catch pipe={{pipe}} {:
	/echo something went wrong: {{error}} |
	/return "gen failed :("
:} |
/echo {{pipe}}
```





#### `/catch`
- `(subcommand|closure)`  
 the command to execute if an exception occurred

<div>
Used with the \`/try\` command to handle exceptions. Use \`{{exception}}\` or \`{{error}}\` to get the exception's message.
</div>


##### Examples

```stscript
see /try
```







### Null Handling



#### `/ifempty`
- `[value:string]`  
 the value to check
- `(string)`  
 the fallback value

Returns the fallback value if value is empty (empty string, empty list, empty dictionary).

##### Examples

```stscript
/ifempty value=[] [1,2,3] |
/echo will be [1,2,3]: {{pipe}}
```

```stscript
/setvar key=x |
/setvar key=y bar |
/ifempty value={{getvar::x}} foo |
/echo will be foo: {{pipe}} |
/ifempty value={{getvar::y}} foo |
/echo will be bar: {{pipe}} |
```





#### `/ifnullish`
- `[value:string]`  
 the value to check
- `(string)`  
 the fallback value

Returns the fallback value if value is nullish (empty string).

##### Examples

```stscript
/ifnullish value=[] [1,2,3] |
/echo will be []: {{pipe}}
```

```stscript
/setvar key=x |
/setvar key=y bar |
/ifnullish value={{getvar::x}} foo |
/echo will be foo: {{pipe}} |
/ifnullish value={{getvar::y}} foo |
/echo will be bar: {{pipe}} |
```







### Copy & Download



#### `/copy`
- `(string)`  
 the value to copy

Copies value into clipboard.

##### Examples

```stscript
/copy this text is now in your clipboard
```

```stscript
/copy {{lastMessage}}
```





#### `/download`
- `[name:string]? = ...`  
 *optional* the filename for the downloaded file
- `[ext:string]? = txt`  
 *optional* the file extension for the downloaded file
- `(string)`  
 the value to download as a text file

Downloads value as a text file.

##### Examples

```stscript
/download Let's download this text.
```

```stscript
/download name=TheLastMessage ext=md {{lastMessage}}
```







### DOM Interaction



#### `/dom`
- `[action=click|value|property|attribute|call]`  
 the action to perform
- `[value:string]?`  
 *optional* new value to set (for action=value or action=property or action=attribute)
- `[property:string]?`  
 *optional* property name to get/set/call (for action=property or action=call)
- `[attribute:string]?`  
 *optional* attribute name to get/set (for action=attribute)
- `(string)`  
 CSS selector to target an element

<div>
Click on an element, change its value, retrieve a property, or retrieve an attribute. To select the targeted element, use CSS selectors.
</div>


##### Examples

```stscript
/dom action=click #fast_ui_mode |
/echo Toggled "No Blur Effect" setting
```

```stscript
/dom action=value value=0 #avatar_style |
/echo Avatar style has been set to "Circle"
```

```stscript
/dom action=property property=value #avatar_style |
/echo Current avatar style: {{pipe}}
```

```stscript
/dom action=attribute attribute=is_system #chat > .mes:last-child |
/echo Is the last message a system message? {{pipe}}
```







### Characters



#### `/char-get`
- `[index:string]?`  
 *optional* the field to retrieve
- `(string)? = current character`  
 *optional* character avatar (filename) or name

<div>
Get a character object or one of its properties.
</div>


##### Examples

```stscript
/char-get Seraphina |
/getat index=description |
/echo
```

```stscript
/char-get index=description Seraphina |
/echo
```







### Group Chats



#### `/memberpos`
- `(string)`  
 name of the group member
- `(number)`  
 new position index for the member

Move group member to position (index starts with 0).

##### Examples

```stscript
/memberpos Alice 3 |
/echo Alice has been moved to position 3
```





#### `/group-get`
- `[index:string]?`  
 *optional* the field to retrieve
- `[chars=true|false]? = false`  
 *optional* resolve characters
- `(string)? = current group`  
 *optional* group name

<div>
Get a group object or one of its properties.
</div>


##### Examples

```stscript
/group-get MyGroup |
/getat index=description |
/echo
```

```stscript
/group-get index=description MyGroup |
/echo
```

```stscript
/group-get index=members chars=true MyGroup |
/echo
```







### Conditionals - switch



#### `/switch`
- `[var:variable_name]?`  
 *optional* name of the chat variable to use as the switch value
- `[globalvar:variable_name]?`  
 *optional* name of the global variable to use as the switch value
- `(string|number)?`  
 *optional* the value to use as the switch value

Use with /case to conditionally execute commands based on a value.

##### Examples

```stscript
/setvar key=x foo |
/switch var=x |
    /case pipe={{pipe}} value=1 {: /echo value is one :} |
    /case pipe={{pipe}} value=foo {: /echo value is foo :} |
    /case pipe={{pipe}} value=bar {: /echo value is bar :} |
/echo done
```





#### `/case`
- `[value:string|number]`  
 the value to compare against the switch value
- `(closure|subcommand)`  
 the command to execute if the value matches the switch value

Execute a command if the provided value matches the switch value from /switch.

##### Examples

```stscript
see /switch
```







### Conditionals - if



#### `/ife`
- `(closure|subcommand)`  
 the command to evaluate

<div>Use with /then, /elseif, and /else. The provided command must return true or false.</div>

##### Examples

```stscript
/setvar key=x foo |
/ife {: /test left=x rule=eq right=1 :} |
    /then {: /echo value is one :} |
/elseif {: /test left=x rule=eq right=foo :} |
    /then {: /echo value is foo :} |
/elseif {: /test left=x rule=eq right=bar :} |
    /then {: /echo value is bar :} |
/else {: /echo value is something else :} |
```





#### `/elseif`
- `(closure|subcommand)`  
 the command to evaluate

<div>Use with /ife, /then, and /else. The provided command must return true or false.</div>

##### Examples

```stscript
see /ife
```





#### `/else`
- `(closure|subcommand)`  
 the command to execute

<div>Use with /ife, /elseif, and /then. The provided command will be executed if the previous /if or /elseif was false.</div>

##### Examples

```stscript
see /ife
```





#### `/then`
- `(closure|subcommand)`  
 the command to execute

<div>Use with /ife, /elseif, and /else. The provided command will be executed if the previous /if or /elseif was true.</div>

##### Examples

```stscript
see /ife
```







### World Info



#### `/wi-list-books`
- `[source=true|false]? = false`  
 *optional* whether to include the activation source for each book

Get a list of currently active World Info books. Use <code>source=true</code> to get a dictionary of lists where the keys are the activation sources.

##### Examples

```stscript
/wi-list-books |
/echo The currently active WI books are: {{pipe}}
```

```stscript
/wi-list-books source=true |
/json-pretty |
/comment Currently active WI books:{{newline}}```json{{newline}}{{pipe}}{{newline}}```
```





#### `/wi-list-entries`
- `[flat=true|false]? = false`  
 *optional* whether to list all entries in a flat list
- `(string)?`  
 *optional* the name of the book to list entries from

Get a list of World Info entries from currently active books or from the book with the provided name. Use <code>flat=true</code> to list all entries in a flat list instead of a dictionary with entries per book.

##### Examples

```stscript
/wi-list-entries |
/map list={{pipe}} {:
    /getat index=entries {{item}} |
    /map list={{pipe}} {:
        /getat index=comment {{item}}
    :}
:} |
/echo Overview of WI entries in currently active books: {{pipe}}
```







### Costumes / Sprites



#### `/costumes`
- `[recurse=true|false]? = true`  
 *optional* whether to recurse into subfolders (SillyTavern can only load expressions from the first subfolder level)
- `(string)?`  
 *optional* the folder to list costumes from

Get a list of costume / sprite folders, recursive by default.

##### Examples

```stscript
/costumes Alice | /echo Alice's costumes: {{pipe}}
```

```stscript
/costumes Alice/Winter | /echo Alice's winter costumes: {{pipe}}
```

```stscript
/costumes recurse=false Alice | /echo Alice's top-level costumes only: {{pipe}}
```







### Quick Replies



#### `/qr-edit`
- `[set:string]?`  
 *optional* the name of the quick reply set
- `[label:string]?`  
 *optional* the label of the quick reply
- `(string)?`  
 *optional* the label of the quick reply

Show the Quick Reply editor. If no QR set is provided, tries to find a QR in one of the active sets.

##### Examples

```stscript
/qr-edit My QR From An Active Set
```

```stscript
/qr-edit set=MyQrSet label=MyQr
```





#### `/qr-add`
- `[set:string]?`  
 *optional* the name of the quick reply set
- `[label:string]?`  
 *optional* the label of the quick reply
- `(string)?`  
 *optional* the label of the quick reply

Create a new Quick Reply and open its editor. If no QR set is provided, tries to find a QR in one of the active sets.

##### Examples

```stscript
/qr-add New QR In Active Set
```

```stscript
/qr-add set=MyQrSet label=MyNewQr
```







### Chat Messages



#### `/swipes-get`
- `[message:number]?`  
 *optional* the message ID to get swipes from
- `(number)`  
 the index of the swipe to get

Get the n-th swipe (zero-based index) from the last message or the message with the given message ID.

##### Examples

```stscript
/swipes-get 5 |
/echo Swipe number five: {{pipe}}
```

```stscript
/sub {{lastMessageId}} 2 |
/swipes-countget message={{pipe}} 5 |
/echo swipe number five: {{pipe}}
```





#### `/swipes-list`
- `[message:number]?`  
 *optional* the message ID to get swipes from

Get a list of all swipes from the last message or the message with the given message ID.

##### Examples

```stscript
/swipes-list |
/echo
```

```stscript
/sub {{lastMessageId}} 2 |
/swipes-list message={{pipe}} |
/echo
```





#### `/swipes-count`
- `[message:number]?`  
 *optional* the message ID to get swipes from

Get the number of all swipes from the last message or the message with the given message ID.

##### Examples

```stscript
/swipes-count |
/echo
```

```stscript
/sub {{lastMessageId}} 2 |
/swipes-count message={{pipe}} |
/echo
```





#### `/swipes-index`
- `[message:number]?`  
 *optional* the message ID to get the swipe index from

Get the current swipe index from the last message or the message with the given message ID.

##### Examples

```stscript
/swipes-index |
/echo
```

```stscript
/sub {{lastMessageId}} 2 |
/swipes-index message={{pipe}} |
/echo
```





#### `/swipes-add`
- `[message:number]?`  
 *optional* the ID of the message to add the swipe to
- `(string)`  
 the text to add as a new swipe

Add a new swipe to the last message or the message with the provided messageId.

##### Examples

```stscript
/sendas name=Alice foo |
/delay 1000 |
/swipes-add bar
```





#### `/swipes-del`
- `[message:number]?`  
 *optional* the id of the message to delete the swipe from
- `(number)?`  
 *optional* the index of the swipe to delete (0-based)

Delete the current swipe or the swipe at the specified index (0-based).

##### Examples

```stscript
/sendas name=Alice foo |
/delay 1000 |
/swipes-add bar |
/delay 1000 |
/swipes-del
```

```stscript
/sendas name=Alice foo |
/delay 1000 |
/swipes-add bar |
/delay 1000 |
/swipes-add foobar |
/delay 1000 |
/swipes-del 0
```





#### `/swipes-go`
- `[message:number]?`  
 *optional* the message ID to go to the swipe for
- `(number)`  
 the index of the swipe to go to

Go to the swipe. 0-based index.

##### Examples

```stscript
/sendas name=Alice foo |
/delay 1000 |
/swipes-add bar |
/delay 1000 |
/swipes-add foobar |
/delay 1000 |
/swipes-go 0
```





#### `/swipes-swipe`

Trigger a new swipe on the last message.

##### Examples

```stscript
/swipes-swipe |
/echo swiping has finished
```





#### `/message-edit`
- `[message:number]?`  
 *optional* the message ID to edit
- `[append=true|false]? = false`  
 *optional* whether to append the new text to the end of the message
- `(string)`  
 the new text for the message

Edit the current message or the message at the provided message ID. Use <code>append=true</code> to add the provided text at the end of the message. Use <code>{{space}}</code> to add space at the beginning of the text.

##### Examples

```stscript
/sendas name=Alice foo |
/delay 1000 |
/message-edit bar
```

```stscript
/sendas name=Alice foo |
/delay 1000 |
/message-edit append=true bar
```





#### `/message-move`
- `[from:number]`  
 the message ID to move
- `[to:number]?`  
 *optional* where to move the message
- `[up:number]?`  
 *optional* number of slots to move the message up (decrease message ID)
- `[down:number]?`  
 *optional* number of slots to move the message down (increase message ID)

<div>
Move a message up or down in the chat.
</div>


##### Examples

```stscript
/message-move from={{lastMessageId}} to=10 |
```

```stscript
/message-move from={{lastMessageId}} up=2 |
```

```stscript
/message-move from=3 down=10 |
```





#### `/message-on`
- `[event:string]`  
 event type to listen for
- `[callback:closure]`  
 closure to run when triggered
- `[quiet:boolean]? = true`  
 *optional* whether to show toast messages when event listeners are attached
- `(string)`  
 CSS selector to target an element in the last message

<div>
Add event listeners to the last chat message.
</div>
<div>
Stops listening when changing to another chat.
</div>


##### Examples

```stscript
/message-on event=click quiet=false callback={:
	/$ take=textContent {{target}} |
	/let prompt Continue by weaving the following suggestion into your next response: {{pipe}} |
	/inputhistory-add {{var::prompt}} |
	/send {{var::prompt}} |
	/trigger |
:} .custom-suggestion |
/setvar key=listenerId |
```





#### `/message-off`
- `[id:string]?`  
 *optional* listener ID
- `[event:string]?`  
 *optional* event type to listen for
- `[query:string]?`  
 *optional* CSS selector to target an element in the last message
- `[quiet:boolean]? = true`  
 *optional* whether to show toast messages when event listeners are attached

<div>
Remove an event listener added with /message-on.
</div>


##### Examples

```stscript
/message-off id={{getvar::listenerId}}
```





#### `/message-listeners`

Lists all currently active listeners.

##### Examples

```stscript
/message-on event=click callback={: /echo {{target}} :} .custom-suggestion |
/message-listeners |
/echo |
```





#### `/role-swap`
- `(number|range)?`  
 *optional* message id or range to swap

<div>
Swap roles (user/AI) for all messages in the chat, or for a selected message or range of messages.
</div>


##### Examples

```stscript
// All messages: |
/role-swap
```

```stscript
// Last message: |
/role-swap {{lastMessageId}}
```

```stscript
// Last message: |
/role-swap -1
```

```stscript
// Second to last message: |
/role-swap -2
```

```stscript
// First 10 messages: |
/role-swap 0-10
```

```stscript
// Last 10 messages: |
/role-swap -10-
```

```stscript
// All messages except last 10: |
/role-swap 0--10
```







### Time & Date



#### `/timestamp`

Returns the number of milliseconds midnight at the beginning of January 1, 1970, UTC.

##### Examples

```stscript
/timestamp |
/echo
```







### Async



#### `/fireandforget`
- `(closure|subcommand)`  
 the closure or command to execute

Execute a closure or command without waiting for it to finish.

##### Examples

```stscript
/fireandforget {:
    /delay 1000 |
    /echo firing |
    /delay 1000 |
    /echo still firing
:} |
/echo outside
```





#### `/sfx`
- `[volume:number]? = 1.0`  
 *optional* playback volume
- `[await:boolean]? = false`  
 *optional* whether to wait for the sound to finish playing before continuing
- `(string)`  
 url to audio file

<div>
Plays an audio file.
</div>


##### Examples

```stscript
/sfx /user/audio/mySound.wav
```

```stscript
/sfx volume=1.25 await=true /user/audio/mySound.wav |
/echo finished playing sound
```







### Undocumented



#### `/fetch`
- `(string)`  
 the url to fetch

UNDOCUMENTED

##### Examples

```stscript
/fetch http://example.com |
/echo
```





#### `/$`
- `[query:string]?`  
 *optional* css selector to query the provided html
- `[take:string]? = outerHTML`  
 *optional* property to take from the resulting element
- `[call:string]?`  
 *optional* method to call on the resulting element
- `(string)`  
 the html to operate on

UNDOCUMENTED

##### Examples

```stscript
/fetch http://example.com |
/$ query=h1 take=textContent |
/echo
```





#### `/$$`
- `[query:string]?`  
 *optional* css selector to query the provided html
- `[take:string]? = outerHTML`  
 *optional* property to take from the resulting elements
- `[call:string]?`  
 *optional* method to call on the resulting elements
- `(string)`  
 the html to operate on

UNDOCUMENTED

##### Examples

```stscript
/fetch http://example.com |
/$$ query=p call=remove |
/echo
```

