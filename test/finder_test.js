var vows = require('vows');
var assert = require('assert');
var path = require('path');
var Finder = require('../lib/finder').Finder;
 
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


/**
 * HashTest class
 */
var FinderTest = vows.describe('Finder class').addBatch({
    "fetch() / with no filter" : {
        topic : function (item) {
            var finder = createFinder();
            
            finder.reset().fetch(RESOURCE_DIR, this.callback);
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
            var finder, report, test;
            test = this;
            report = {};
            
            finder = createFinder();
            finder.reset().type(Finder.FILE).fetch(RESOURCE_DIR, function (error, result) {
                report.testFile = result;
                finder.reset().type(Finder.DIR).fetch(RESOURCE_DIR, function (error, result) {
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
            var finder, report, test;
            test = this;
            report = {};
            
            finder = createFinder();
            finder.reset().names('*.ext').fetch(RESOURCE_DIR, function (error, result) {
                report.testName1 = result;
                finder.reset().names('*1').fetch(RESOURCE_DIR, function (error, result) {
                    report.testName2 = result;
                    test.callback(null, report);
                });
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
            var finder, report, test;
            test = this;
            report = {};
            
            finder = createFinder();
            finder.reset().filter(function (file) {
                return file.file.indexOf('file3') >= 0;
            }).fetch(RESOURCE_DIR, function (error, result) {
                report.testFilter1 = result;
                finder.filter(function (file) {
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
            var finder, report, test;
            test = this;
            report = {};
            
            finder = createFinder();
            finder.reset().exclude('dir*').fetch(RESOURCE_DIR, function (error, result) {
                report.testExclude1 = result;
                finder.reset().exclude('*2').fetch(RESOURCE_DIR, function (error, result) {
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
    },
    
    
    "fetchSync() / with no filter" : {
        topic : function (item) {
            var finder = createFinder();
            
            return finder.fetchSync(RESOURCE_DIR);
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
            var finder, report, test;
            report = {};
            
            finder = createFinder();
            report.testFile = finder.reset().type(Finder.FILE).fetchSync(RESOURCE_DIR);
            report.testDir = finder.reset().type(Finder.DIR).fetchSync(RESOURCE_DIR);
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
            var finder, report, test;
            test = this;
            report = {};
            
            finder = createFinder();
            report.testName1 = finder.reset().names('*.ext').fetchSync(RESOURCE_DIR);
            report.testName2 = finder.reset().names('*1').fetchSync(RESOURCE_DIR);
            
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
            var finder, report, test;
            test = this;
            report = {};
            
            finder = createFinder();
            report.testFilter1 = finder.reset().filter(function (file) {
                return file.file.indexOf('file3') >= 0;
            }).fetchSync(RESOURCE_DIR);

            report.testFilter2 = finder.filter(function (file) {
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
            var finder, report, test;
            test = this;
            report = {};
            
            finder = createFinder();
            report.testExclude1 = finder.reset().exclude('dir*').fetchSync(RESOURCE_DIR);
            report.testExclude2 = finder.reset().exclude('*2').fetchSync(RESOURCE_DIR);
            
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