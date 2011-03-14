/*jslint indent:4 */
var vows = require('vows');
var assert = require('assert');
var path = require('path');


/**
 * constants
 */
var __moduleTested = '../lib/' + require('path').basename(__filename.replace('_test.js', ''));
var __filenameTested = require('fs').realpathSync(__dirname + '/' + __moduleTested + '.js');
var finder = require(__filenameTested);
var Finder = finder.Finder;

var RESOURCE_DIR = require('fs').realpathSync(path.join(__dirname, '..', 'resource', 'finder_test'));

function createFinder() {
    return (new Finder());
}

function assertEqualDirectories(result, expected, message) {

    var resultFiltered, expectedFiltered;

    resultFiltered = [];
    result.forEach(function (dir) {
        if (dir.indexOf('.svn') < 0 && dir.indexOf('.git') < 0) {
            resultFiltered.push(dir);
        }
    });

    expectedFiltered = [];
    expected.forEach(function (dir) {
        expectedFiltered.push(path.join(RESOURCE_DIR, dir));
    });

    assert.deepEqual(resultFiltered, expectedFiltered, message);
}



/*******************************************************************************
 * JSLint validation
 ******************************************************************************/
try {
    require('lint').vows.createTest([ __filename, __filenameTested ]).export(module);
} catch (e) {
    console.warn('Warning: JSLint not found try `npm install lint`');
}

/*******************************************************************************
 * Finder validation
 ******************************************************************************/
var FinderTest = vows.describe('Finder class').addBatch({
    "type()": {
        topic: function () {
            return createFinder();
        },
        'should return this' : function (topic) {
            assert.equal(topic.type('file'), topic);
        },
        'should throw error if parameter is wrong' : function (topic) {
            assert.throws(function () {
                topic.type('non_valid');
            });
        }
    },
    "names()": {
        topic: function () {
            return createFinder();
        },
        'should return this' : function (topic) {
            assert.doesNotThrow(function () {
                topic.names('namepattern');
            });
            assert.equal(topic.names('namepattern'), topic);
        },
        'should throw error if parameter is wrong' : function (topic) {
            assert.throws(function () {
                topic.names({});
            });
            assert.throws(function () {
                topic.names(1);
            });
            assert.throws(function () {
                topic.names(function () {});
            });
        }
    },
    "filter()": {
        topic: function () {
            return createFinder();
        },
        'should return this' : function (topic) {
            assert.doesNotThrow(function () {
                topic.filter(function () {});
            });
            assert.equal(topic.filter(function () {}), topic);
        },
        'should throw error if parameter is wrong' : function (topic) {
            var query = createFinder();
            assert.throws(function () {
                query.filter({});
            });
            assert.throws(function () {
                query.filter(1);
            });
            assert.throws(function () {
                query.filter('name');
            });
        }
    },

    "fetch() / with no filter" : {
        topic : function (item) {
            var query = createFinder();

            query.reset().fetch(RESOURCE_DIR, this.callback);
        },
        'should return an array of directories' : function (topic) {
            assertEqualDirectories(topic, [
                'dir1',
                'dir1/dir1',
                'dir1/dir1/file3.ext',
                'dir1/dir2',
                'dir1/dir2/file3.ext',
                'dir1/file1',
                'dir1/file2.ext',
                'file.ext',
                'file1'
            ]);
        }
    },
    "fetch() / with type filter" : {
        topic : function (item) {
            var query, report, test;
            test = this;
            report = {};

            query = createFinder();
            query.reset().type(Finder.FILE).fetch(RESOURCE_DIR, function (error, result) {
                report.testFile = result;
                query.reset().type(Finder.DIR).fetch(RESOURCE_DIR, function (error, result) {
                    report.testDir = result;
                    test.callback(null, report);
                });
            });
        },
        'should return a set of files if Finder.FILE' : function (topic) {
            assertEqualDirectories(topic.testFile, [
                'dir1/dir1/file3.ext',
                'dir1/dir2/file3.ext',
                'dir1/file1',
                'dir1/file2.ext',
                'file.ext',
                'file1'
            ]);
        },
        'should return a set of directories if Finder.DIR' : function (topic) {
            assertEqualDirectories(topic.testDir, [
                'dir1',
                'dir1/dir1',
                'dir1/dir2'
            ]);
        }
    },
    "fetch() / with name filter" : {
        topic : function (item) {
            var query, report, test;
            test = this;
            report = {};

            query = createFinder();
            query.reset().names('*.ext').fetch(RESOURCE_DIR, function (error, result) {
                report.testName1 = result;
                query.reset().names('*1').fetch(RESOURCE_DIR, function (error, result) {
                    report.testName2 = result;
                    test.callback(null, report);
                });
            });
        },
        'should throw error if parameter is wrong' : function (topic) {
            var query = createFinder();
            assert.throws(function () {
                query.type('non_valid');
            });
        },
        'should return a set of files or directories satisfying pattern' : function (topic) {
            assertEqualDirectories(topic.testName1, [
                'dir1/dir1/file3.ext',
                'dir1/dir2/file3.ext',
                'dir1/file2.ext',
                'file.ext'
            ]);
            assertEqualDirectories(topic.testName2, [
                'dir1',
                'dir1/dir1',
                'dir1/file1',
                'file1'
            ]);
        }
    },
    "fetch() / with custom filter" : {
        topic : function (item) {
            var query, report, test;
            test = this;
            report = {};

            query = createFinder();
            query.reset().filter(function (file) {
                return file.file.indexOf('file3') >= 0;
            }).fetch(RESOURCE_DIR, function (error, result) {
                report.testFilter1 = result;
                query.filter(function (file) {
                    return false;
                }).fetch(RESOURCE_DIR, function (error, result) {
                    report.testFilter2 = result;
                    test.callback(null, report);
                });
            });
        },
        'should return a set of files or directories satisfying pattern' : function (topic) {
            assertEqualDirectories(topic.testFilter1, [
                'dir1/dir1/file3.ext',
                'dir1/dir2/file3.ext'
            ]);
            assertEqualDirectories(topic.testFilter2, []);
        }
    },
    "fetch() / with exclude filter" : {
        topic : function (item) {
            var query, report, test;
            test = this;
            report = {};

            query = createFinder();
            query.reset().exclude('dir*').fetch(RESOURCE_DIR, function (error, result) {
                report.testExclude1 = result;
                query.reset().exclude('*2').fetch(RESOURCE_DIR, function (error, result) {
                    report.testExclude2 = result;
                    test.callback(null, report);
                });
            });
        },
        'should return a set of files and dir without the excluded directories' : function (topic) {
            assertEqualDirectories(topic.testExclude1, [
                'file.ext',
                'file1'
            ]);
            assertEqualDirectories(topic.testExclude2, [
                'dir1',
                'dir1/dir1',
                'dir1/dir1/file3.ext',
                'dir1/file1',
                'dir1/file2.ext',
                'file.ext',
                'file1'
            ]);
        }
    }
}).addBatch({
    "fetchSync() / with no filter" : {
        topic : function (item) {
            var query = createFinder();

            return query.fetchSync(RESOURCE_DIR);
        },
        'should return an array of directories' : function (topic) {
            assertEqualDirectories(topic, [
                'dir1',
                'dir1/dir1',
                'dir1/dir1/file3.ext',
                'dir1/dir2',
                'dir1/dir2/file3.ext',
                'dir1/file1',
                'dir1/file2.ext',
                'file.ext',
                'file1'
            ]);
        }
    },
    "fetchSync() / with type filter" : {
        topic : function (item) {
            var query, report, test;
            report = {};

            query = createFinder();
            report.testFile = query.reset().type(Finder.FILE).fetchSync(RESOURCE_DIR);
            report.testDir = query.reset().type(Finder.DIR).fetchSync(RESOURCE_DIR);
            return report;
        },
        'should return a set of files if Finder.FILE' : function (topic) {
            assertEqualDirectories(topic.testFile, [
                'dir1/dir1/file3.ext',
                'dir1/dir2/file3.ext',
                'dir1/file1',
                'dir1/file2.ext',
                'file.ext',
                'file1'
            ]);
        },
        'should return a set of directories if Finder.DIR' : function (topic) {
            assertEqualDirectories(topic.testDir, [
                'dir1',
                'dir1/dir1',
                'dir1/dir2'
            ]);
        }
    },
    "fetchSync() / with name filter" : {
        topic : function (item) {
            var query, report, test;
            test = this;
            report = {};

            query = createFinder();
            report.testName1 = query.reset().names('*.ext').fetchSync(RESOURCE_DIR);
            report.testName2 = query.reset().names('*1').fetchSync(RESOURCE_DIR);

            return report;
        },
        'should return a set of files or directories satisfying pattern' : function (topic) {
            assertEqualDirectories(topic.testName1, [
                'dir1/dir1/file3.ext',
                'dir1/dir2/file3.ext',
                'dir1/file2.ext',
                'file.ext'
            ]);
            assertEqualDirectories(topic.testName2, [
                'dir1',
                'dir1/dir1',
                'dir1/file1',
                'file1'
            ]);
        }
    },
    "fetchSync() / with custom filter" : {
        topic : function (item) {
            var query, report, test;
            test = this;
            report = {};

            query = createFinder();
            report.testFilter1 = query.reset().filter(function (file) {
                return file.file.indexOf('file3') >= 0;
            }).fetchSync(RESOURCE_DIR);

            report.testFilter2 = query.filter(function (file) {
                return false;
            }).fetchSync(RESOURCE_DIR);

            return report;
        },
        'should return a set of files or directories satisfying pattern' : function (topic) {
            assertEqualDirectories(topic.testFilter1, [
                'dir1/dir1/file3.ext',
                'dir1/dir2/file3.ext'
            ]);
            assertEqualDirectories(topic.testFilter2, []);
        }
    },
    "fetchSync() / with exclude filter" : {
        topic : function (item) {
            var query, report, test;
            test = this;
            report = {};

            query = createFinder();
            report.testExclude1 = query.reset().exclude('dir*').fetchSync(RESOURCE_DIR);
            report.testExclude2 = query.reset().exclude('*2').fetchSync(RESOURCE_DIR);

            return report;
        },
        'should return a set of files and dir without the excluded directories' : function (topic) {
            assertEqualDirectories(topic.testExclude1, [
                'file.ext',
                'file1'
            ]);
            assertEqualDirectories(topic.testExclude2, [
                'dir1',
                'dir1/dir1',
                'dir1/dir1/file3.ext',
                'dir1/file1',
                'dir1/file2.ext',
                'file.ext',
                'file1'
            ]);
        }
    }
});

exports.FinderTest = FinderTest;