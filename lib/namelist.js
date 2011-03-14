function _matchAllPatterns(str, patterns) {
    var i, length;

    for (i = 0, length = patterns.length; i < length; i += 1) {
        var pattern = patterns[i];
        if (pattern instanceof NameList) {
            if (!pattern.matches(str)) {
                return false;
            }
        } else {
            if (!str.match(pattern)) {
                return false;
            }
        }
    }

    return true;
}

function _matchAnyPattern(str, patterns) {
    var i, length;

    for (i = 0, length = patterns.length; i < length; i += 1) {
        var pattern = patterns[i];
        if (pattern instanceof NameList) {
            if (pattern.matches(str)) {
                return true;
            }
        } else {
            if (str.match(pattern)) {
                return true;
            }
        }
    }

    return false;
}

function NameList(matchMode, names) {
    names = Array.prototype.slice.call(arguments);
    this._matchMode = NameList.MODE_ALL;
    if (matchMode === NameList.MODE_ALL || matchMode === NameList.MODE_ANY) {
        this._matchMode = matchMode;
        names = names.slice(1);
    }
    this._names = [];
    this.addNames(names);
}

NameList.prototype.addNames = function(names) {
    var _this = this;
    names = Array.prototype.slice.call(arguments);
    if (Array.isArray(names[0])) {
        names = names[0];
    }
    names.forEach(function(name) {
        if (name instanceof NameList) {
            _this._names.push(name);
        } else if(typeof(name) === 'string' || (name instanceof RegExp)) {
            _this._names.push(NameList._toRegexp(name));
        } else {
            throw new Error(pattern.toString() + ' should be a NameList, string or RegExp');
        }
    });
    return this;
};

NameList.prototype.matches = function(str) {
    if (this._matchMode === NameList.MODE_ALL) {
        return _matchAllPatterns(str, this._names);
    } else {
        return _matchAnyPattern(str, this._names);
    }
};

NameList.MODE_ALL = false;
NameList.MODE_ANY = true;

NameList._toRegexp = function(stringOrRegexp) {
    if (stringOrRegexp instanceof RegExp) {
        return stringOrRegexp;
    }

    if (stringOrRegexp.match('/^([^a-zA-Z0-9\\\\]).+?\\1[ims]?$/')) {
        return stringOrRegexp;
    }

    var strictLeadingDot = true,
        strictWildcardSlash = true,
        firstByte = true,
        escaping = false,
        inCurlies = 0,
        regexp = '',
        char, i;
    for (i = 0; i < stringOrRegexp.length; i += 1) {
        char = stringOrRegexp[i];
        if (firstByte) {
            if (strictLeadingDot && char !== '.') {
                regexp += "(?=[^\\.])";// (?=[^\.])
            }

            firstByte = false;
        }

        if (char === '/') {
            firstByte = true;
        }

        if (char === '.' || char === '(' || char === ')' || char === '|' || char === '+' || char === '^' || char === '$') {
            regexp += "\\" + char + "";
        } else if (char === '*') {
            regexp += escaping ? '\\*' : (strictWildcardSlash ? '[^/]*' : '.*');
        } else if (char === '?') {
            regexp += escaping ? '\\?' : (strictWildcardSlash ? '[^/]' : '.');
        } else if (char === '{') {
            regexp += escaping ? '\\{' : '(';
            if (!escaping) {
                inCurlies += 1;
            }
        } else if (char === '}' && inCurlies) {
            regexp += escaping ? '}' : ')';
            if (!escaping) {
                inCurlies -= 1;
            }
        } else if (char === ',' && inCurlies) {
            regexp += escaping ? ',' : '|';
        } else if (char === '\\') {
            if (escaping) {
                regexp += '\\\\';
                escaping = false;
            } else {
                escaping = true;
            }

            continue;
        } else {
            regexp += char;
        }
        escaping = false;
    }

    return new RegExp('^' + regexp + '$');
};

module.exports = NameList;