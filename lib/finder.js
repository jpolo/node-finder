/*jslint nodejs:true, indent:4 */
/**
 * Imports
 */
var fs = require('fs'),
    path = require('path'),
    slice = Array.prototype.slice,
    isArray = Array.isArray,
    args = function (_args) {
        return isArray(_args) ? _args : slice.call(_args);
    };

var NameFilter, Finder;

function _matchNoPatterns(str, patterns) {
    var i, length, pattern;

    for (i = 0, length = patterns.length; i < length; i += 1) {
        pattern = patterns[i];
        if (pattern.test(str)) {
            return false;
        }
    }

    return true;
}

function _walkRecursiveAsync(filePath, filter, callback, _depth, _env) {
    _env.leafs += 1;
    fs.stat(filePath, function (error, stats) {
        var fileInfo = {file: filePath, stat: stats, depth: _depth};

        //There is an error
        if (error) {
            _env.leafs -= 1;
            if (_env.leafs <= 0) {
                callback(null, _env.result);
            }
            return;
        }

        //For file
        if (stats.isFile()) {
            if (filter(fileInfo)) {
                _env.result.push(fileInfo);
            }

            _env.leafs -= 1;
            if (_env.leafs <= 0) {
                callback(null, _env.result);
                return;
            }

        //For directory
        } else if (stats.isDirectory()) {
            if (filter(fileInfo)) {
                if (_depth > 0) {
                    _env.result.push(fileInfo);
                }

                // Directory - walk recursive
                fs.readdir(filePath, function (error, files) {
                    var i, length;

                    _env.leafs -= 1;
                    for (i = 0; i < files.length; i += 1) {
                        _walkRecursiveAsync(path.join(filePath, files[i]), filter, callback, _depth + 1, _env);
                    }

                    //Check if finished
                    if (_env.leafs <= 0) {
                        callback(null, _env.result);
                        return;
                    }
                });
            } else {
                _env.leafs -= 1;
            }
        } else {
            console.log('TODO implement this type' + stats);
        }


        if (_env.leafs <= 0) {
            callback(null, _env.result);
        }
    });
}

function _walkRecursiveSync(filePath, filter, _depth) {

    var fileInfo, results;

    results = [];
    fileInfo = {file: filePath, stat: fs.statSync(filePath), depth: _depth};

    if (fileInfo.stat.isFile()) {
        if (filter(fileInfo)) {
            results.push(fileInfo);
        }
    } else if (fileInfo.stat.isDirectory()) {
        if (filter(fileInfo)) {
            if (_depth > 0) {
                results.push(fileInfo);
            }

            // Directory - walk recursive
            fs.readdirSync(filePath).forEach(function (file) {
                results = results.concat(_walkRecursiveSync(path.join(filePath, file), filter, _depth + 1));
            });
        }
    }
    return results;
}

/*******************************************************************************
 * NameFilter class
 *
 *
 * Usage:
 *
 * @class
 ******************************************************************************/
/**
 * @constructor
 */
function NameFilter(matchMode, names) {
    names = slice.call(arguments);
    this._matchMode = NameFilter.MODE_ALL;
    if (matchMode === NameFilter.MODE_ALL || matchMode === NameFilter.MODE_ANY) {
        this._matchMode = matchMode;
        names = names.slice(1);
    }
    this._names = [];
    this.addNames(names);
}

/**
 *
 * @param names
 * @return
 */
NameFilter.prototype.addNames = function (names) {
    names = slice.call(arguments);
    if (isArray(names[0])) {
        names = names[0];
    }
    names.forEach(function (filter) {
        if (filter instanceof NameFilter) {
            this._names.push(filter);
        } else {
            this._names.push(NameFilter._toRegExp(filter));
        }
    }, this);
    return this;
};

/**
 *
 * @param {string} str
 * @return {boolean}
 */
NameFilter.prototype.test = function (str) {
    var i, length, pattern, patterns = this._names;
    if (this._matchMode === NameFilter.MODE_ALL) {
        for (i = 0, length = patterns.length; i < length; i += 1) {
            pattern = patterns[i];
            if (!pattern.test(str)) {//Can be RegExp or other NameFilter
                return false;
            }
        }

        return true;
    } else {
        for (i = 0, length = patterns.length; i < length; i += 1) {
            pattern = patterns[i];
            if (pattern.test(str)) {//Can be RegExp or other NameFilter
                return true;
            }
        }

        return false;
    }
};

NameFilter.MODE_ALL = false;
NameFilter.MODE_ANY = true;

NameFilter._toRegExp = function (stringOrRegexp) {
    if (stringOrRegexp instanceof RegExp) {
        return stringOrRegexp;
    }

    if (typeof(stringOrRegexp) !== 'string') {
        throw new Error(stringOrRegexp + ' should be a string or RegExp');
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

/*******************************************************************************
 * Finder class
 *
 *
 * Usage:
 *
 * <pre>
 *
 * //Async
 *
 * var finderInstance = new Finder();
 * finderInstance.type(Finder.FILE).names('*.js').fetch(__dirname, function (error, files) {
 *  files.forEach(function (file) {
 *      console.log(file);
 *  });
 * });
 *
 * //Sync
 *
 * console.log(finderInstance.type(Finder.DIR).notNames('.svn').fetchSync());
 *
 * </pre>
 *
 * @class
 ******************************************************************************/
/**
 * Finder constructor
 *
 * @constructor
 */
function Finder() {
    this.reset();
}

Finder.FILE = 'file';
Finder.DIR = 'dir';
Finder.ANY = 'any';

/**
 * Reset all parameters
 *
 * @return this
 */
Finder.prototype.reset = function () {
    this._type = Finder.ANY;

    this._nameList = new NameFilter(NameFilter.MODE_ALL);
    this._namesNot = [];

    this._filters = [];

    this._includes = [];
    this._excludes = [];

    this._depthMin = null;
    this._depthMax = null;
    return this;
};

/**
 * Filter by type
 *
 * @param {int} type Finder.DIR|Finder.FILE|Finder.ANY
 * @return this
 */
Finder.prototype.type = function (type) {
    if (type !== Finder.DIR && type !== Finder.FILE && type !== Finder.ANY) {
        throw new Error('type should be in [Finder.DIR, Finder.FILE, Finder.ANY]');
    }
    this._type = type;
    return this;
};

/**
 * Filter with depth between depthMin and depthMax
 *
 * @param {int} depthMin
 * @param {int} depthMax
 * @return this
 */
Finder.prototype.depth = function (depthMin, depthMax) {
    if (depthMin !== undefined && (typeof(depthMin) !== 'number' || depthMin < 0)) {
        throw new Error('depthMin should be a positive number');
    }
    if (depthMax !== undefined && (typeof(depthMax) !== 'number' || depthMax < 0)) {
        throw new Error('depthMax should be a positive number');
    }

    this._depthMin = depthMin;
    this._depthMax = depthMax;
    return this;
};

/**
 * Include by name
 *
 * @param {string|RegExp, ...}
 * @return this
 */
Finder.prototype.names = function () {
    this._nameList.addNames.apply(this._nameList, arguments);
    return this;
};

/**
 * Exclude by name
 *
 * @param {string|RegExp, ...}
 * @return this
 */
Finder.prototype.notNames = function () {
    var patterns = args(arguments);
    patterns.forEach(function (pattern) {
        this._namesNot.push(NameFilter._toRegExp(pattern));
    }, this);
    return this;
};

/**
 * Add a custom filter
 *
 * @param {Function} filter
 * @return this
 */
Finder.prototype.filter = function (filter) {
    if (!(filter instanceof Function)) {
        throw new Error('filter should be Function');
    }
    this._filters.push(filter);
    return this;
};

/**
 * Exclude directories from the
 *
 * @param {string|RegExp, ...}
 * @return
 */
Finder.prototype.exclude = function () {
    var patterns = args(arguments),
        excludes = this._excludes;
    patterns.forEach(function (pattern) {
        excludes.push(NameFilter._toRegExp(pattern));
    }, this);
    return this;
};

/**
 * Fetch results asynchronously
 *
 * @param {Array|string} directories
 * @param {Function} callback
 * @return this
 */
Finder.prototype.fetch = function (directories, callback) {
    if (!isArray(directories)) {
        directories = [directories];
    }

    if (directories.length === 0) {
        callback(null, []);
        return this;
    }

    var onWalkCount, onWalk,
        results = [],
        preFilter = this._preFilter.bind(this);

    onWalkCount = directories.length;
    onWalk = function (error, files) {
        onWalkCount -= 1;
        results = results.concat(files);
        if (onWalkCount <= 0 && callback) {
            results = results.filter(this._postFilter, this);
            results = results.map(function (result) {
                return result.file;
            });
            results.sort();

            callback(null, results);
        }
    }.bind(this);

    directories.forEach(function (directory) {
        _walkRecursiveAsync(
            directory,
            preFilter,
            onWalk,
            0, {
                result: [],
                leafs: 0
            }
        );
    });
    return this;
};

/**
 * Fetch results synchronously
 *
 * @param {Array|string} directories
 * @return
 */
Finder.prototype.fetchSync = function (directories) {
    if (!isArray(directories)) {
        directories = [directories];
    }

    if (directories.length === 0) {
        return [];
    }

    var results = [], directoryResult = [], preFilter = this._preFilter.bind(this);

    directories.forEach(function (directory) {
        var directoryResult = _walkRecursiveSync(
                directory,
                preFilter,
                0);

        directoryResult = directoryResult.filter(this._postFilter, this);
        directoryResult = directoryResult.map(function (result) {
            return result.file;
        });

        results = results.concat(directoryResult);
    }, this);
    results.sort();

    return results;
};

Finder.prototype._postFilter = function (file) {
    var filePath, filePathBase, stat, depth, i;

    //filter type
    stat = file.stat;
    if (this._type !== Finder.ANY) {
        if ((this._type === Finder.FILE) && !stat.isFile()) {
            return false;
        }
        if ((this._type === Finder.DIR) && !stat.isDirectory()) {
            return false;
        }
    }

    //Filter depth
    depth = file.depth;
    if (this._depthMin !== null && depth < this._depthMin) {
        return false;
    }

    //Name filters
    filePath = file.file;
    filePathBase = path.basename(filePath);

    if (!this._nameList.test(filePathBase)) {
        return false;
    }

    if (!_matchNoPatterns(filePathBase, this._namesNot)) {
        return false;
    }

    //Custom filters
    for (i = 0; i < this._filters.length; i += 1) {
        if (!this._filters[i](file)) {
            return false;
        }
    }

    return true;
};

Finder.prototype._preFilter = function (file) {
    if (!_matchNoPatterns(path.basename(file.file), this._excludes)) {
        return false;
    }

    //Filter depth
    if (this._depthMax !== null && file.depth > this._depthMax) {
        return false;
    }

    return true;
};



/**
 * Exports
 */
exports.Finder = Finder;
exports.NameFilter = NameFilter;