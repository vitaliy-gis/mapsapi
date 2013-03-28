/**
 * Main build script of 2GIS Maps API 2.0
 *
 * Version 2.0.0
 *
 * Copyright (c) 2013, 2GIS, Andrey Chizh
 */
var fs = require('fs'),
    jshint = require('jshint').JSHINT,
    uglify = require('uglify-js'),
    argv = require('optimist').argv;

var config = require('./config.js').config,
    packages = require('./packages.js').packages,
    hint = require('./hint.js');

/**
 * Global data stores
 */
var modules,
    copyrights;

/**
 * Get content of all modules
 * Must run only 1 time on start app or run CLI script
 *
 * @param {Object} params
 * @returns {Object}
 */
function getModulesContent(params) {
    var modules = {};

    for (vendor in params) {
        if (params.hasOwnProperty(vendor)) {
            var deps = params[vendor].deps,
                path = params[vendor].path;

            for (var mod in deps) {
                if (deps.hasOwnProperty(mod)) {
                    var moduleContent = {},
                        src = deps[mod].src;

                    for (var i = 0, count = src.length; i < count; i++) {
                        var srcPath = path + src[i];
                        moduleContent[srcPath] = fs.readFileSync(srcPath, 'utf8') + '\n\n';
                    }

                    modules[mod] = moduleContent;
                }
            }
        }
    }

    return modules;
}

/**
 * Get content of all copyrights
 * Must run only 1 time on start app or run CLI script
 *
 * @param {Object} params
 * @returns {String}
 */
function getCopyrightsContent(params) {
    var copyrights = '';

    for (var i = 0, count = params.length; i < count; i++) {
        copyrights += fs.readFileSync(params[i], 'utf8') + '\n';
    }

    return copyrights;
}

/**
 * Generates a list of modules by build name
 *
 * @param {String|Null} pkg
 * @returns {Array}
 */
function parcePackageName(pkg) {
    var modulesList = [];

    if (pkg && packages.hasOwnProperty(pkg) && packages[pkg].modules.length > 1) {
        modulesList = packages[pkg].modules;
    } else if (pkg && (modules.hasOwnProperty(pkg) || pkg.indexOf(',') > 0)) {
        modulesList = pkg.split(',');
    } else {
        for (var mod in modules) {
            if (modules.hasOwnProperty(mod)) {
                modulesList.push(mod);
            }
        }
    }

    return modulesList;
}

/**
 * Generates build content
 *
 * @param {Array} build
 * @param {Boolean} isMsg
 * @returns {String}
 */
function makePackage(pkg, isMsg) {
    var modulesResult = '',
        loadModules = {},
        modulesList = parcePackageName(pkg);

    for (var i = 0, count = modulesList.length; i < count; i++) {
        var moduleName = modulesList[i];
        var moduleContent = modules[moduleName];

        if (isMsg) {
            console.log('  * ' + moduleName);
        }

        for (var name in moduleContent) {
            if (moduleContent.hasOwnProperty(name)) {
                if (!loadModules[name]) {
                    modulesResult += moduleContent[name];
                    loadModules[name] = true;
                }
            }
        }
    }

    if (isMsg) {
        console.log('\nConcatenating ' + modulesList.length + ' modules...\n');
    }

    return copyrights + config.intro + modulesResult + config.outro;
}

/**
 * Minify source files
 *
 * @param {String} content
 * @return {String}
 */
function minifyPackage(content) {
    var min = uglify.minify(content, {
        warnings: true,
        fromString: true
    }).code;

    return copyrights + min;
}

/**
 * Write file to disc
 *
 * @param {String} path
 * @param {String} content
 */
function writeFile(path, content) {
    fs.writeFileSync(path, content);
}

/**
 * Check JS files for errors
 *
 * @param {Object} modules
 * @return {Number}
 */
function lintFiles(modules) {
    var errorsCount = 0;

    for (mod in modules) {
        if (modules.hasOwnProperty(mod)) {
            var fileList = modules[mod];
            for (file in fileList) {
                if (fileList.hasOwnProperty(file)) {
                    jshint(fileList[file], hint.config, hint.namespace);
                    var errors = jshint.errors;

                    for (var i = 0, count = errors.length; i < count; i++) {
                        var e = errors[i];
                        console.log(file + '    line ' + e.line + ' col ' + e.character + '    ' + e.reason);
                        errorsCount++;
                    }
                }
            }
        }
    }

    return errorsCount;
}


/**
 * Lint (CLI command)
 */
exports.lint = function() {
    var errorsCount, str;

    console.log('\nCheck all source JS files for errors with JSHint...\n');

    modules = getModulesContent(config.source);
    errorsCount = lintFiles(modules);
    str = (errorsCount > 0) ? '\n' : '';

    console.log(str + 'JSHint find ' + errorsCount + ' errors.\n');
};

/**
 * Build (CLI command)
 */
exports.build = function() {
    var dest = config.dest.custom,
        pkg = argv.p || argv.m || null;

    modules = getModulesContent(config.source);
    copyrights = getCopyrightsContent(config.copyrights);

    if (pkg === 'public') {
        dest = config.dest.public;
        console.log('Build public GitHub full package!\n');
    }

    console.log('Build modules:');

    var srcContent = makePackage(pkg, true);
    writeFile(dest.src, srcContent);

    console.log('Compressing...\n');

    var minContent = minifyPackage(srcContent);
    writeFile(dest.min, minContent);

    console.log('Uncompressed size: ' + (srcContent.length/1024).toFixed(1) + ' KB');
    console.log('Compressed size:   ' + (minContent.length/1024).toFixed(1) + ' KB');

    console.log('\nBuild successfully completed!');
};

/**
 * Init (web app)
 */
exports.init = function() {
    modules = getModulesContent(config.source);
    copyrights = getCopyrightsContent(config.copyrights);
};

/**
 * Get content (web app)
 */
exports.get = function(build, isDebug, callback) {
    var content = makePackage(build);
    if (!isDebug) {
        content = minifyPackage(content);
    }
    callback(content);
};
