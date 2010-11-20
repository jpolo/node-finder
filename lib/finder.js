/*jslint indent:4 */
/**
 * Imports
 */
var fs = require('fs');
var path = require('path');

function _matchAllPatterns(str, patterns) {
    var i, length;

    for (i = 0, length = patterns.length; i < length; i += 1) {
        if (!str.match(patterns[i])) {
            return false;
        }
    }

    return true;
}

function _matchNoPatterns(str, patterns) {
    var i, length;

    for (i = 0, length = patterns.length; i < length; i += 1) {
        if (str.match(patterns[i])) {
            return false;
        }
    }

    return true;
}

function _toRegexp(stringOrRegexp) {
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
                regexp += '(?=[^\.])';
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
}

function _walkRecursiveAsync(filePath, filter, callback, _depth, _env) {    
    _env.leafs += 1;
    fs.stat(filePath, function (error, stats) {
        var fileInfo = {file: filePath, stat: stats, depth: _depth};

        if (error) {  
            _env.leafs -= 1;
            return;
        }

        if (stats.isFile()) {
            if (filter(fileInfo)) {
                _env.result.push(fileInfo);
            }

            _env.leafs -= 1;
            if (_env.leafs <= 0) {
                callback(null, _env.result);
                return;
            }
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
 * finderInstance.type(Finder.FILE).names('*.js').fetch(function (error, files) {
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
    this._names = [];
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
    var patterns, thisFinder;
    thisFinder = this;
    patterns = Array.isArray(arguments[0]) ? arguments[0] : Array.prototype.slice.call(arguments);
    patterns.forEach(function (pattern) {
        thisFinder._names.push(_toRegexp(pattern));
    });
    return this;
};

/**
 * Exclude by name
 * 
 * @param {string|RegExp, ...}
 * @return this
 */
Finder.prototype.notNames = function () {
    var patterns, thisFinder;
    thisFinder = this;
    patterns = Array.isArray(arguments[0]) ? arguments[0] : Array.prototype.slice.call(arguments);
    patterns.forEach(function (pattern) {
        thisFinder._namesNot.push(_toRegexp(pattern));
    });
    return this;
};

/**
 * Add a custom filter
 * 
 * @param {Function} filter
 * @return this
 */
Finder.prototype.filter = function (filter) {
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
    var patterns, thisFinder;
    thisFinder = this;
    patterns = Array.isArray(arguments[0]) ? arguments[0] : Array.prototype.slice.call(arguments);
    patterns.forEach(function (pattern) {
        thisFinder._excludes.push(_toRegexp(pattern));
    });
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
    if (!Array.isArray(directories)) {
        directories = [directories];
    }

    if (directories.length === 0) {
        callback(null, []);
        return this;
    }

    var results, thisFinder, onWalkCount, onWalk;

    thisFinder = this;
    results = [];
    onWalkCount = directories.length;
    onWalk = function (error, files) {
        onWalkCount -= 1;
        results = results.concat(files);
        if (onWalkCount <= 0 && callback) {
            results = results.filter(thisFinder._postFilter, thisFinder);
            results = results.map(function (result) {
                return result.file;
            });
            results.sort();

            callback(null, results);
        }
    };

    directories.forEach(function (directory) {
        _walkRecursiveAsync(
            directory, 
            thisFinder._preFilter.bind(thisFinder), 
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
    if (!Array.isArray(directories)) {
        directories = [directories];
    }

    if (directories.length === 0) {
        return [];
    }

    var results = [], directoryResult = [], thisFinder = this;

    directories.forEach(function (directory) {
        var directoryResult = _walkRecursiveSync(
                directory, 
                thisFinder._preFilter.bind(thisFinder),
                0
        );

        directoryResult = directoryResult.filter(thisFinder._postFilter, thisFinder);
        directoryResult = directoryResult.map(function (result) {
            return result.file;
        });

        results = results.concat(directoryResult);
    });
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

    if (!_matchAllPatterns(filePathBase, this._names)) {
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



exports.Finder = Finder;