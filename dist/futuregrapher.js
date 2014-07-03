(function(global, define) {
  var globalDefine = global.define;
/**
 * almond 0.2.0 Copyright (c) 2011, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        aps = [].slice;

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);

                name = baseParts.concat(name.split("/"));

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (waiting.hasOwnProperty(name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!defined.hasOwnProperty(name) && !defining.hasOwnProperty(name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (typeof callback === 'function') {

            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (defined.hasOwnProperty(depName) ||
                           waiting.hasOwnProperty(depName) ||
                           defining.hasOwnProperty(depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback.apply(defined[name], args);

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 15);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        config = cfg;
        return req;
    };

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        waiting[name] = [name, deps, callback];
    };

    define.amd = {
        jQuery: true
    };
}());
define("../vendor/almond", function(){});

define('futuregrapher/core',[],function() {
  var futuregrapher = {
    VERSION: '0.9.0'
  };

  return futuregrapher;
});
// This is a poor mans type checker. It allows you to check the contents of an object. It is disabled per default, 
// because of the performance penalty but you can turn it on in case you have a suspicious bug and maybe
// it will help you catch it. 

define('futuregrapher/typechecker',[],function() {

    TypeChecker = {
        enabled: false,
        logToConsole: false,
        
        // if strongCheck is true, no properties are allowed but the ones specified.
        checkProperties: function (object, requiredProperties, optionalProperties, strongCheck) {
            if (!this.enabled) return;

            var log = this.logToConsole ? function (m) { console.log(m); } : function () {};
            
            var keys = _.keys(object);

            var requiredNames = _.pluck(requiredProperties, "propertyName");
            _.each(requiredNames, function (n) { 
                if (keys.indexOf(n) === -1) {
                    var errorMessage = "Required property '" + n + "' was not found";
                    log(errorMessage);
                    throw new Meteor.Error(errorMessage); 
                }
            });

            if (strongCheck) {
                var legalNames = requiredNames.concat(_.pluck(optionalProperties, "propertyName"));

                _.each(keys, function (k) { 
                    if (legalNames.indexOf(k) === -1) {
                        var errorMessage = "Property '" + k + "' is not among allowed properties";
                        log(errorMessage);
                        throw new Meteor.Error(errorMessage); 
                    }
                });
            }            
            
            var validators = {};
            _.each(requiredProperties.concat(optionalProperties), function (p) { validators[p.propertyName] = p; });
            
            _.each(object, function (val, key) { 
                if (!validators[key].validate(val)) {
                    var errorMessage = "Property '" + key + "' should be a " + validators[key].typeName + ". Value was: " + val;
                    log(errorMessage);
                    throw new Meteor.Error(errorMessage); 
                }
            });
        },
        
        object: function (propertyName) {
            return {
                typeName: "object",
                propertyName: propertyName,
                validate: function (value) { return typeof value === "object";  }
            };
        },

        array: function (propertyName) {
            return {
                typeName: "array",
                propertyName: propertyName,
                validate: function (value) { return value instanceof Array; }
            };
        },
        
        string: function (propertyName) {
            return {
                typeName: "string",
                propertyName: propertyName,
                validate: function (value) { return _.isNull(value) || typeof value === "string";  }
            };
        },
        
        number: function (propertyName) {
            return {
                typeName: "number",
                propertyName: propertyName,
                validate: function (value) { return typeof value === "number" && !isNaN(value);  }
            };
        },
        
        nonNegativeNumber: function (propertyName) {
            return {
                typeName: "non-negative number",
                propertyName: propertyName,
                validate: function (value) { return typeof value === "number" && value >= 0;  }
            };
        },

        boolean: function (propertyName) {
            return {
                typeName: "boolean",
                propertyName: propertyName,
                validate: function (value) { return typeof value === "boolean";  }
            };
        },

        color: function (propertyName) {
            return {
                typeName: "color",
                propertyName: propertyName,
                validate: function (value) { return !_.isUndefined(value);  }   // TODO: Validate that this is indeed a color.. 
            };
        }
    };

    return TypeChecker;
});

// These are the default options that the renderer will use if not overridden in the options parameter
// for the constructor.

define('futuregrapher/svgrendererdefaultoptions',['require'],function(require) {
    var defaultSvgRendererOptions = {
        layerIds: ["clusters", "links", "nodes", "labels"]  // First one becomes the bottom layer
    };

    return defaultSvgRendererOptions;
});
// This class renders and updates arrays of NodeCircles etc. to SVG using D3.

define('futuregrapher/svgrenderer',['require','futuregrapher/svgrendererdefaultoptions'],function(require) {
    var defaultSvgRendererOptions = require('futuregrapher/svgrendererdefaultoptions');

    var SvgRenderer = function (containerElement, options) {
        options = $.extend(true, {}, defaultSvgRendererOptions, options);
    
        var svg, defs;
        var layers = {};
        var previousRadiusFactor;   // Used to check if we need to update sizes
        
        this.containerElement = function () { return containerElement; };
        this.width = function () { return containerElement.width(); };
        this.height = function () { return containerElement.height(); };
    
        //[of]:        function makeHull(d, xScale, yScale) {
        function makeHull(d, xScale, yScale, radiusFactor) {
            var nodes = d.nodeCircles;
            var nodePoints = [];
        
            _.each(nodes, function (n) {
                var offset = (n.radius || 5) * radiusFactor;
                var x = n.x || 0;
                var y = n.y || 0;
                nodePoints.push([xScale(x) - offset, yScale(y) - offset]);
                nodePoints.push([xScale(x) - offset, yScale(y) + offset]);
                nodePoints.push([xScale(x) + offset, yScale(y) - offset]);
                nodePoints.push([xScale(x) + offset, yScale(y) + offset]);
            });
        
            var clusterCurve = d3.svg.line()
                .interpolate("cardinal-closed")
                .tension(0.85);
        
            return clusterCurve(d3.geom.hull(nodePoints));
        }
        //[cf]
        //[of]:        function makeLinkPath(d, xScale, yScale, radiusFactor) {
        function makeLinkPath(d, xScale, yScale, radiusFactor) {
            var sx = xScale(d.source.x);
            var sy = yScale(d.source.y);
            var tx = xScale(d.target.x);
            var ty = yScale(d.target.y);
        
            var sr = (d.source.radius + d.source.borderWidth) * radiusFactor,
                tr = (d.target.radius + d.target.borderWidth) * radiusFactor,
                dx = tx - sx,
                dy = ty - sy,
                dr = Math.sqrt(dx * dx + dy * dy) || 0.001,
                xs = dir ? sx + dx * (sr / dr) : sx,
                ys = dir ? sy + dy * (sr / dr) : sy,
                xt = dir ? tx - dx * (tr / dr) : tx,
                yt = dir ? ty - dy * (tr / dr) : ty;
            
            if (d.curvature === 0) {
                if (sx === tx && sy === ty)
                    return "M " + xs + " " + ys + " A 10 10 0 1 " + (xt > xs ? "1" : "0") + " " + (xt + 1) + " " + (yt + 1);
        
                var sr = (d.source.radius + d.source.borderWidth) * radiusFactor;
                var tr = (d.target.radius + d.target.borderWidth) * radiusFactor;
        
                var a = tx - sx, b = ty - sy;
                var centerDist = Math.sqrt(a*a + b*b);
                
                var normalizedVectorX = (tx - sx) / centerDist;
                var normalizedVectorY = (ty - sy) / centerDist;
                
                var rsx = sx + sr * normalizedVectorX;
                var rsy = sy + sr * normalizedVectorY;
                var rtx = tx - tr * normalizedVectorX;
                var rty = ty - tr * normalizedVectorY;
                
                var result = "M " + rsx + " " + rsy + " L " + rtx + " " + rty;
                
                if(result.indexOf("NaN") !== -1)
                    console.log("STOP");
                
                return result;
            } else {
                //[of]:        Original curve
                //[c]Original curve
                
                var dir = true;
                
                if(xs == xt && ys == yt)  // loop it
                    return "M " + xs + " " + ys + " A 10 10 0 1 " + (xt > xs ? "1" : "0") + " " + (xt + 1) + " " + (yt + 1);
                
                // All of this logic comes from:
                // - http://www.kevlindev.com/gui/math/intersection/index.htm#Anchor-Introductio-4219 - for intersection of ellipse and circle
                // - http://www.w3.org/TR/SVG/implnote.html#ArcImplementationNotes - for calculating the center of the ellipse
                
                // calculate center of ellipse
                var x1p = (sx - tx) / 2;
                var y1p = (sy - ty) / 2;
                
                var sq = Math.sqrt(
                    ((dr * dr * dr * dr) - (dr * dr * y1p * y1p) - (dr * dr * x1p * x1p)) /
                    ((dr * dr * y1p * y1p) + (dr * dr * x1p * x1p)));
                
                if(xt < xs)
                    sq *= -1;
                
                var cxp = sq * y1p;
                var cyp = sq * (-1 * x1p);
                var cx = cxp + (sx + tx) / 2;
                var cy = cyp + (sy + ty) / 2;
                
                var result = Intersection.intersectCircleEllipse({ x: tx, y: ty}, tr, { x: cx, y: cy }, dr, dr);
                if(result.points.length) {
                    // find the correct point (closest to source) and use that as our target
                    var min = 1000000;
                    var pt;
                    $.each(result.points, function(i, point) {
                        var dist = Math.sqrt(Math.pow(point.x - sx, 2) + Math.pow(point.y - sy, 2));
                        if(dist < min) {
                            min = dist;
                            pt = point;
                        }
                    });
                
                    if(pt) {
                        xt = pt.x;
                        yt = pt.y;
                    }
                }
                
                result = Intersection.intersectCircleEllipse({ x: sx, y: sy}, sr, { x: cx, y: cy }, dr, dr);
                
                if(result.points.length) {
                    // find the correct point (closest to source) and use that as our target
                    var min = 1000000;
                    var pt;
                    $.each(result.points, function(i, point) {
                        var dist = Math.sqrt(Math.pow(point.x - tx, 2) + Math.pow(point.y - ty, 2));
                        if(dist < min) {
                            min = dist;
                            pt = point;
                        }
                    });
                    
                    if(pt) {
                        sx = pt.x;
                        sy = pt.y;
                    }
                }
                
                return "M " + sx + " " + sy + " A " + dr + " " + dr + " 0 0 " + (xt > xs ? "1" : "0") + " " + xt + " " + yt;
                //[cf]
                //[of]:        Simple curve
                //[c]Simple curve
                
                /*
                var sr = (d.source.radius + d.source.borderWidth) * radiusFactor;
                var tr = (d.target.radius + d.target.borderWidth) * radiusFactor;
                
                var a = tx - sx, b = ty - sy;
                var centerDist = Math.sqrt(a*a + b*b);
                
                var normalizedVectorX = (tx - sx) / centerDist;
                var normalizedVectorY = (ty - sy) / centerDist;
                
                var rsx = sx + sr * normalizedVectorX;
                var rsy = sy + sr * normalizedVectorY;
                var rtx = tx - tr * normalizedVectorX;
                var rty = ty - tr * normalizedVectorY;
                
                var dx = rtx - rsx,
                    dy = rty - rsy,
                    dr = Math.sqrt(dx * dx + dy * dy) * 2;
                
                return "M" + rsx + "," + rsy + "A" + dr + "," + dr + " 0 0,1 " + rtx + "," + rty;        
                */
                //[cf]
            }
        }
        
        
        //[cf]
        //[of]:        function linkTween(xScale, yScale, radiusFactor, d, i, a) {
        function linkTween(xScale, yScale, radiusFactor, d, i, a) {
            return function (b) {
                if(!d || !b)
                    return a;
        
                // calculate the standard string-based interpolation value
                var path = makeLinkPath(d, xScale, yScale, radiusFactor);
                if(!path)
                    return "";
        
                var x = d3.interpolateString(a, path);
        
                // fix the sweep-path value
                var result = x(b);
                var vals = result.split(' ');
                if (vals[3] == "A") {   // If this is a curved link
                    vals[7] = Math.floor(parseFloat(vals[7]));
                    vals[8] = Math.floor(parseFloat(vals[8]));
                }
                
                // and join it back together
                return vals.join(' ');
            }
        };
        //[cf]
        //[of]:        function makeMarkerDefs(linkLines) {
        function makeMarkerDefs(linkLines) {
            var sizeColorCombos = {};
            
            _.each(linkLines, function (ll) {
                if (ll.marker) {
                    var size = Math.max(1, ll.width).toFixed(0);    // Make sure we don't have any negative link widths.
                    var color = d3.rgb(ll.color).toString(); // This is necessary to convert "red" into "ff0000" etc.
                    var opacity = ll.opacity;
                    var sizeColorCombo = size + "-" + color.substr(1) + Math.floor(opacity * 255).toString(16);
                    
                    sizeColorCombos[sizeColorCombo] = { id: sizeColorCombo, size: size, color: color, opacity: opacity };
                }
            });
            
            return _.map(sizeColorCombos, function (sizeColorCombo, id) { return sizeColorCombo; });
        }
        //[cf]
        //[of]:        function getTextAnchor(labelText, xScale) {
        function getTextAnchor(labelText, centroidX) {
            if (labelText.anchor === "auto") {
                return labelText.x < centroidX ? "end" : "start";
            } else {
                return labelText.anchor;
            }
        }
        //[cf]
    
        //[of]:        function attachEvents(selection, renderItems) {
        // This is an attempt to make a general purpose attach-eventhandlers-to-visual-element function. This is hard though.
        // If you want to support a complex set of events like click, double-click and drag, you will probably have better luck
        // with creating handlers for mousedown and mouseup and keeping track of timing, double click etc. yourself.
        
        function attachEvents(selection, renderItems) {
            var dragBehavior;
        
            // We want to know all the different types of events that exist in any of the elements. This cryptic oneliner does that.
            // Say we have one element with handlers for click and mouseover, and another one with handlers for mouseover and mouseout.
            // We will want an array that says ["click", "mouseover", "mouseout"]. We will have to attach all three events to all elements
            // because there is no (trivial) way to attach event handlers per element. The handlers will actually be functions that check
            // if the given handler exists and only then call it.
            var allEvents = _.uniq(_.flatten(_.map(_.pluck(renderItems, "eventHandlers"), function (eh) { return _.keys(eh); })));
        
            // Add all the handlers except for click and dblclick which we take special care of below.
            _.each(allEvents, function (ce) {
                if (ce === "click" || ce === "dblclick")
                    return;
                
                // drag events aren't native to the browser so we need to attach D3's dragBehavior if such handlers exist.
                if (ce === "dragstart" || ce === "drag" || ce === "dragend") {
                    if (!dragBehavior) {
                        dragBehavior = d3.behavior.drag()
                            .origin(function() { 
                                var t = d3.select(this);
                                return {x: t.attr("x"), y: t.attr("y")};
                            })
                    }
                    
                    dragBehavior.on(ce, function (d, i) {
                        d.eventHandlers[ce](d, i, d3.event);
                        //d3.event.stopPropagation();
                    });
                } else {
                    selection.on(ce, function (d, i) {
                        if (d.eventHandlers.hasOwnProperty(ce)) {
                            d.eventHandlers[ce](d, i, d3.event);
                            d3.event.stopPropagation();
                        }
                    });
                }
            });
        
            if (dragBehavior)
                selection.call(dragBehavior);
            
            var doubleClickDelay = 300;
            var singleClickTimer;
            var storedEvent;
            
            // Now, as for click and dblclick, we want to make sure they can work together. If only one of them is supplied, there is no problem
            // because we can simply attach to that event. However, if both are in use, we need to wait after the first click and see if the user
            // indeed meant to double click or not. If no secondary click is recorded within doubleClickDelay milliseconds, it's considered a single click.
            selection.on("click", function (d, i) {
                if (d.eventHandlers.hasOwnProperty("click") && d.eventHandlers.hasOwnProperty("dblclick")) {
                    if (singleClickTimer) {
                        d.eventHandlers.dblclick(d, i, d3.event);
                        clearTimeout(singleClickTimer);
                        singleClickTimer = null;
                    } else {
                        storedEvent = d3.event;
                        singleClickTimer = setTimeout(function () {
                            d.eventHandlers.click(d, i, storedEvent);
                            singleClickTimer = null;
                        }, doubleClickDelay);
                    }
                    d3.event.stopPropagation();
                } else if (d.eventHandlers.hasOwnProperty("click")) {
                    d.eventHandlers.click(d, i, d3.event);
                    d3.event.stopPropagation();
                }
            });
            
            selection.on("dblclick", function (d, i) {
                if (d.eventHandlers.hasOwnProperty("dblclick") && !d.eventHandlers.hasOwnProperty("click")) {
                    d.eventHandlers.dblclick(d, i, d3.event);
                    d3.event.stopPropagation();
                }
            });
        }
        //[cf]
    
        //[of]:        this.getLayer = function (name) {
        this.getLayer = function (name) {
            return layers[name];
        };
        //[cf]
        
        //[of]:        this.update = function (clusterHulls, linkLines, nodeCircles, labelTexts, xScale, yScale, radiusFactor, transitionDuration) {
        this.update = function (clusterHulls, linkLines, nodeCircles, labelTexts, xScale, yScale, radiusFactor, transitionDuration) {
            transitionDuration = transitionDuration === undefined ? 250 : transitionDuration;
        
            // This is used to know where labels with anchor="auto" should go.
            var centroidX = d3.mean(nodeCircles, function (nc) { return nc.x; });
            
            //[of]:    Clusters
            //[c]Clusters
            
            if (TypeChecker.enabled) {
                _.each(clusterHulls, function (ch) { TypeChecker.checkProperties(ch, ch.propertyTypes, ch.optionalPropertyTypes, true); });
            }
            
            var cluster = layers.clusters.selectAll("path.cluster")
                .data(clusterHulls, function (d) { return d.id; });
            
            var clusterEnter = cluster.enter().append("svg:path");
            clusterEnter
                .attr("class", "cluster")
                .attr("data-id", function (d) { return d.id; })
                .style("fill", function (d) { return d.color; })
                .style("stroke", function (d) { return d.borderColor; })
                .style("opacity", 1e-6)
                .append("svg:title");
            
            attachEvents(clusterEnter, clusterHulls);
            
            cluster.exit().transition().duration(transitionDuration)
                .style("opacity", 1e-6)
                .remove();
            
            cluster.transition().duration(transitionDuration)
                .attr("d", function (d) { return makeHull(d, xScale, yScale, radiusFactor); })
                .style("opacity", function (d) { return d.opacity; })
                .style("fill", function (d) { return d.color; })
                .style("stroke", function (d) { return d.borderColor; });
            
            cluster.select("title")
                .text(function (d) { return d.hoverText; });    
            
            
            
            //[cf]
            //[of]:    Link markers
            //[c]Link markers
            
            var markerDefs = makeMarkerDefs(linkLines);
            
            var marker = defs.selectAll("marker.generated")
                .data(markerDefs, function (d) { return d.id })
            
            marker.enter()
                .append('svg:marker')
                    .attr("id", function (d) { return "marker-" + d.id; })
                    .attr("class", "generated")
                    .attr('preserveAspectRatio', 'xMinYMin')
                    .attr('markerUnits', 'userSpaceOnUse')
                    .attr("orient", "auto")
                .append("svg:path");
            
            marker
                    .attr("markerWidth", function (d) { return 5 * d.size * radiusFactor; })
                    .attr("markerHeight", function (d) { return 3 * d.size * radiusFactor; })
                    .attr("viewBox", function (d) { return  "0 0 " + (10 * d.size * radiusFactor) + " " + (10 * d.size * radiusFactor); })
                    .attr("refX", function (d) { return 10 * d.size * radiusFactor; })
                    .attr("refY", function (d) { return 10 * d.size * radiusFactor; })
                    .attr("fill", function (d) { return d.color; })
                    .attr("opacity", function (d) { return d.opacity; })
                .select("path")
                    .attr("d", function (d) { return "M0,0L" + (10 * d.size * radiusFactor) + "," + (10 * d.size * radiusFactor) + "L0," + (10 * d.size * radiusFactor) + "z"});
            
            marker.exit()
                .remove();
            
            //[cf]
            //[of]:    Links
            //[c]Links
            
            if (TypeChecker.enabled) {
                _.each(linkLines, function (ll) { TypeChecker.checkProperties(ll, ll.propertyTypes, ll.optionalPropertyTypes, true); });
            }
            
            var link = layers.links.selectAll("path.link")
                .data(linkLines, function (d) { return d.id; });
            
            var linkEnter = link.enter().append("svg:path");
            linkEnter.attr("class", "link")
                .attr("data-id", function (d) { return d.id; })
                .style("stroke-opacity", 1e-6)
                .style("stroke-width", 1e-6)
                .style("fill", "none")
                .append("svg:title");
            
            attachEvents(linkEnter, linkLines);
            
            link.exit().transition().duration(transitionDuration)
                .style("stroke-opacity", 1e-6)
                .style("stroke-width", 1e-6)
                .remove();
            
            link
                .attr("stroke-dasharray", function (d) { return d.dashPattern; })
                .attr("marker-end", function (d) { 
                    if (!d.marker) return null;
                    var sizeColorCombo =  + d.width.toFixed(0) + "-" + d3.rgb(d.color).toString().substr(1) + Math.floor(d.opacity * 255).toString(16);
                    return "url(#marker-" + sizeColorCombo + ")";
                })
            
            link.transition().duration(transitionDuration)
                .attrTween("d", linkTween.bind(null, xScale, yScale, radiusFactor))
                .style("stroke-opacity", function (d) { return d.opacity; })
                .style("stroke-width", function (d) { return d.width * radiusFactor; })
                .style("stroke", function (d) { return d.color; });
                
            link.select("title")
                .text(function (d) { return d.hoverText; });    
            
            //[cf]
            //[of]:    Nodes
            //[c]Nodes
            
            if (TypeChecker.enabled) {
                _.each(nodeCircles, function (nc) { TypeChecker.checkProperties(nc, nc.propertyTypes, nc.optionalPropertyTypes, true); });
            }
            
            var node = layers.nodes.selectAll("circle.node")
                .data(nodeCircles, function (d) { return d.id; });
            
            var nodeEnter = node.enter().append("svg:circle");
            nodeEnter
                .attr("class", "node")
                .attr("data-id", function (d) { return d.id; })
                .attr("cx", function (d) { var sx = xScale(d.x); return isNaN(sx) ? 0 : sx; })
                .attr("cy", function (d) { var sy = yScale(d.y); return isNaN(sy) ? 0 : sy; })
                .attr("r", 1e-6)
                .style("opacity", 1e-6)
                .append("svg:title");
            
            attachEvents(nodeEnter, nodeCircles);
            
            node.exit().transition().duration(transitionDuration)
                .attr("r", 1e-6)
                .style("opacity", 1e-6)
                .remove();
            
            node.transition().duration(transitionDuration)
                .attr("cx", function (d) { var sx = xScale(d.x); return isNaN(sx) ? 0 : sx; })
                .attr("cy", function (d) { var sy = yScale(d.y); return isNaN(sy) ? 0 : sy; })
                .attr("r", function (d) { return d.radius * radiusFactor; })
                .style("stroke-width", function (d) { return d.borderWidth * radiusFactor; })
                .style("opacity", function (d) { return d.opacity; })
                .style("fill", function (d) { return d.color; })
                .style("stroke", function (d) { return d.borderColor; });
            
            node.select("title")
                .text(function (d) { return d.hoverText; });    
            
            //[cf]
            //[of]:    Labels
            //[c]Labels
            
            if (TypeChecker.enabled) {
                _.each(labelTexts, function (lt) { TypeChecker.checkProperties(lt, lt.propertyTypes, lt.optionalPropertyTypes, true); });
            }
            
            var label = layers.labels.selectAll("g.label")
                .data(labelTexts, function (d) { return d.id; });
            
            var labelEnter = label.enter().append("svg:g");
            labelEnter
                .attr("class", "label")
                .attr("data-id", function (d) { return d.id; })
                .attr("transform", function (d) { return "translate(" + [xScale(d.x), yScale(d.y)] + ")"; })
                .style("opacity", 1e-6)
                .append("svg:text")
                .attr("x", function (d) { return d.offsetX * radiusFactor; })
                .attr("y", function (d) { return d.offsetY * radiusFactor; })
                .style("font-size", function (d) { return d.fontSize * radiusFactor; })
            
            attachEvents(labelEnter, labelTexts);
            
            label.exit().transition().duration(transitionDuration)
                .style("opacity", 1e-6)
                .remove();
            
            label.transition().duration(transitionDuration)
                .attr("transform", function (d) { return "translate(" + [xScale(d.x), yScale(d.y)] + ")"; })
                .style("opacity", function (d) { return d.opacity; })
            
            label.select("text")
                .text(function (d) { return d.text; })
                .transition().duration(transitionDuration)
                .attr("text-anchor", function (d) { return getTextAnchor(d, centroidX); })
                .attr("x", function (d) { return (getTextAnchor(d, centroidX) === "end" ? -d.offsetX : d.offsetX) * radiusFactor; })
                .attr("y", function (d) { return d.offsetY * radiusFactor; })
                .style("font-size", function (d) { return d.fontSize * radiusFactor; })
                .style("fill", function (d) { return d.color; });
            //    .style("stroke-width", function (d) { return 0.5 * radiusFactor; })
            //    .style("stroke", function (d) { return d.borderColor; });
            
            //[cf]
            
            previousRadiusFactor = radiusFactor;
        };
        //[cf]
        //[of]:        this.updatePositions = function (clusterHulls, linkLines, nodeCircles, labelTexts, xScale, yScale, radiusFactor) {
        this.updatePositions = function (clusterHulls, linkLines, nodeCircles, labelTexts, xScale, yScale, radiusFactor) {
        
            // This is used to know where labels with anchor="auto" should go.
            var centroidX = d3.mean(nodeCircles, function (nc) { return nc.x; });
        
            //[of]:    Clusters
            //[c]Clusters
            
            var cluster = layers.clusters.selectAll("path.cluster")
                .data(clusterHulls, function (d) { return d.id; });
            
            cluster
                .attr("d", function (d) { return makeHull(d, xScale, yScale, radiusFactor); });
            
            //[cf]
            //[of]:    Link markers
            //[c]Link markers
            
            var markerDefs = makeMarkerDefs(linkLines);
            
            var marker = defs.selectAll("marker.generated")
                .data(markerDefs, function (d) { return d.id })
            
            marker.enter()
                .append('svg:marker')
                    .attr("id", function (d) { return d.id; })
                    .attr("class", "generated")
                    .attr('preserveAspectRatio', 'xMinYMin')
                    .attr('markerUnits', 'userSpaceOnUse')
                    .attr("orient", "auto")
                .append("svg:path");
            
            marker
                    .attr("markerWidth", function (d) { return 5 * d.size * radiusFactor; })
                    .attr("markerHeight", function (d) { return 3 * d.size * radiusFactor; })
                    .attr("viewBox", function (d) { return  "0 0 " + (10 * d.size * radiusFactor) + " " + (10 * d.size * radiusFactor); })
                    .attr("refX", function (d) { return 10 * d.size * radiusFactor; })
                    .attr("refY", function (d) { return 10 * d.size * radiusFactor; })
                    .attr("fill", function (d) { return d.color; })
                .select("path")
                    .attr("d", function (d) { return "M0,0L" + (10 * d.size * radiusFactor) + "," + (10 * d.size * radiusFactor) + "L0," + (10 * d.size * radiusFactor) + "z"});
            
            marker.exit()
                .remove();
            
            //[cf]
            //[of]:    Links
            //[c]Links
            
            if (TypeChecker.enabled) {
                _.each(linkLines, function (ll) { TypeChecker.checkProperties(ll, ll.propertyTypes, ll.optionalPropertyTypes, true); });
            }
            
            var link = layers.links.selectAll("path.link")
                .data(linkLines, function (d) { return d.id; });
            
            link
                .attr("d", function (d) { return makeLinkPath(d, xScale, yScale, radiusFactor); })
            
            if (radiusFactor !== previousRadiusFactor) {
                link
                    .style("stroke-width", function (d) { return d.width * radiusFactor; });
            }
            //[cf]
            //[of]:    Nodes
            //[c]Nodes
            
            if (TypeChecker.enabled) {
                _.each(nodeCircles, function (nc) { TypeChecker.checkProperties(nc, nc.propertyTypes, nc.optionalPropertyTypes, true); });
            }
            
            var node = layers.nodes.selectAll("circle.node")
                .data(nodeCircles, function (d) { return d.id; });
            
            node
                .attr("cx", function (d) { var sx = xScale(d.x); return isNaN(sx) ? 0 : sx; })
                .attr("cy", function (d) { var sy = yScale(d.y); return isNaN(sy) ? 0 : sy; })
            
            if (radiusFactor !== previousRadiusFactor) {
                node
                    .attr("r", function (d) { return d.radius * radiusFactor; })
                    .style("stroke-width", function (d) { return d.borderWidth * radiusFactor; });
            }
            //[cf]
            //[of]:    Labels
            //[c]Labels
            
            if (TypeChecker.enabled) {
                _.each(labelTexts, function (lt) { TypeChecker.checkProperties(lt, lt.propertyTypes, lt.optionalPropertyTypes, true); });
            }
            
            var label = layers.labels.selectAll("g.label")
                .data(labelTexts, function (d) { return d.id; });
            
            label
                .attr("transform", function (d) { return "translate(" + [xScale(d.x), yScale(d.y)] + ")"; });
            
            label.select("text")
                .attr("text-anchor", function (d) { return getTextAnchor(d, centroidX); })
                .attr("x", function (d) { return (getTextAnchor(d, centroidX) === "end" ? -d.offsetX : d.offsetX) * radiusFactor; })
                .attr("y", function (d) { return d.offsetY * radiusFactor; })
                .style("font-size", function (d) { return d.fontSize * radiusFactor; });
            
            //[cf]
            
            previousRadiusFactor = radiusFactor;
        };
        //[cf]
        
        //[of]:        function initialize() {
        function initialize() {
            svg = d3.select(containerElement[0]).append("svg")
                .attr("width", containerElement.width())
                .attr("height", containerElement.height());
            
            defs = svg.append("svg:defs");
                        
            layers = {};
            _.each(options.layerIds, function (layerId) {
                layers[layerId] = svg.append("svg:g")
                    .attr("id", layerId)
                    .attr("class", "layer");
            });
        }
        //[cf]
        initialize();
    };

    return SvgRenderer;
});
define('futuregrapher/defaultgraphvisoptions',['require'],function(require) {

    // This describer simply returns interpolated values between the two nodes.
    // If a node is hovered, links that point to it will have markers.
    var defaultLinkDescriber = function (visLink, sourceNodeCircle, targetNodeCircle, radiusFactor) {
        return {
            width: (sourceNodeCircle.radius + targetNodeCircle.radius) / 10,
            color: d3.interpolateRgb(sourceNodeCircle.color, targetNodeCircle.color)(0.5),
            opacity: (sourceNodeCircle.opacity + targetNodeCircle.opacity) / 2,
        };
    };
    
    var defaultGraphVisOptions = {
        // General settings
        enableZoom: true,
        enablePan: true,
        enableForce: true,
        forceParameters: {
            linkDistance: 20,
            linkStrength: 1,
            friction: 0.9,
            charge: -30,
            chargeDistance: Infinity,
            theta: 0.8,
            gravity: 0.1
        },
        enableCollisionDetection: true,
        enableClusterForce: false,
        zoomExtent: [0.25, 4],
        zoomDensityScale: d3.scale.linear().domain([0.25, 4]).range([0.5, 2]),
        updateOnlyPositionsOnZoom: true,        // If false, a complete update() will take place during zoom. More flexible but slower.
        updateOnlyPositionsOnTick: true,        // Likewise, for force ticks.
    
        // Event handling
        onUpdatePreProcess: null,
        onUpdateAutoZoom: null,
        onUpdatePreRender: null,
        onClick: null,
        onNodeClick: null,
        onNodeDoubleClick: null,
        onNodeMouseOver: null,
        onNodeMouseOut: null,
        onNodeDragStart: null,
        onNodeDrag: null,
        onNodeDragEnd: null,
        onClusterNodeClick: null,
        onClusterNodeDoubleClick: null,     // If unset, will default to "expand cluster".
        onClusterNodeMouseOver: null,
        onClusterNodeMouseOut: null,
        onClusterNodeDragStart: null,
        onClusterNodeDrag: null,
        onClusterNodeDragEnd: null,
        onLinkClick: null,
        onLinkDoubleClick: null,
        onLinkMouseOver: null,
        onLinkMouseOut: null,
        onClusterClick: null,
        onClusterDoubleClick: null, // If unset, will default to "collapse cluster".
        onClusterMouseOver: null,
        onClusterMouseOut: null,
        
        // Visual element describing
        
        defaultNodeDescription: {
            radius: 10,
            color: "#888",
            borderColor: "#333",
            borderWidth: 2,
            opacity: 1,
            hoverText: null,
            label: null,
            fixed: false
        },
        describeVisNode: null,
    
        defaultLinkDescription: {
            width: 1,
            color: "#333",
            opacity: 1,
            marker: false,
            curvature: 0,
            dashPattern: null,
            hoverText: null
        },
        describeVisLink: defaultLinkDescriber,
    
        // Collapsed clusters become node circles
        defaultCollapsedClusterDescription: {
            radius: 20,
            color: "#aaa",
            borderColor: "#fff",
            borderWidth: 2,
            opacity: 1,
            hoverText: null,
            label: null,
            fixed: false
        },
        describeCollapsedCluster: null,
    
        // Expanded clusters become cluster hulls
        defaultExpandedClusterDescription: {
            color: "#a88",
            borderColor: null,
            opacity: 0.2,
            hoverText: null
        },
        describeExpandedCluster: null,
    
        defaultClusterLinkDescription: {
            width: 2,
            color: "#222",
            opacity: 1,
            marker: false,
            curvature: 0,
            dashPattern: null,
            hoverText: null
        },
        describeClusterLink: null
    };

    return defaultGraphVisOptions;
});

// NodeCircle is the class used for rendering nodes and cluster-representation "nodes".
// These are passed to a renderer in the update() and updatePositions calls. 

define('futuregrapher/nodecircle',['require','futuregrapher/typechecker'],function(require) {
    var TypeChecker = require('futuregrapher/typechecker');

    var NodeCircle = function (id, visData) {
        this.id = id.toString();
        this.visData = visData;
    };

    // These properties must be present for rendering
    NodeCircle.prototype.propertyTypes = [
        TypeChecker.string("id"),
        TypeChecker.object("visData"),  // This field can contain a VisNode or a VisCluster.
        TypeChecker.number("x"), // Note: x and y are NOT scaled to screen space because they are manipulated by d3.force
        TypeChecker.number("y"), // Scaling takes place in SvgRenderer.update, which is why it takes the scales as parameters.
        TypeChecker.nonNegativeNumber("radius"),
        TypeChecker.color("color"),
        TypeChecker.color("borderColor"),
        TypeChecker.nonNegativeNumber("borderWidth"),
        TypeChecker.nonNegativeNumber("opacity"),
        TypeChecker.string("hoverText"),
        TypeChecker.boolean("fixed"),
        TypeChecker.object("eventHandlers")
    ];

    // These are added to nodes by d3.force, so we should allow them
    NodeCircle.prototype.optionalPropertyTypes = [
        TypeChecker.number("index"), 
        TypeChecker.number("px"), 
        TypeChecker.number("py"), 
        TypeChecker.number("weight")
    ];

    // Update certain properties on the NodeCircle. Type checking makes sure no unknown properties are added (if it's enabled)
    NodeCircle.prototype.updateProperties = function (properties) {
        TypeChecker.checkProperties(properties, [], this.propertyTypes, true);
        _.extend(this, properties);
    }

    return NodeCircle;
});

// LinkLine is the class used for rendering links/eges between nodes.
// These are passed to a renderer in the update() and updatePositions calls. 

define('futuregrapher/linkline',['require','futuregrapher/typechecker'],function(require) {
    var TypeChecker = require('futuregrapher/typechecker');

    var LinkLine = function (id, source, target, visData) {
        this.id = id.toString();
        this.source = source;
        this.target = target;
        this.visData = visData;
    };
    
    // These properties must be present for rendering
    LinkLine.prototype.propertyTypes = [
        TypeChecker.string("id"),
        TypeChecker.object("source"), // These should be NodeCircle instances. (Names cannot change because of d3.force)
        TypeChecker.object("target"),  //  -   "   -
        TypeChecker.object("visData"),  // Can be a VisLink or an array of VisLinks if this links from and/or to a cluster
        TypeChecker.nonNegativeNumber("width"),
        TypeChecker.color("color"),
        TypeChecker.nonNegativeNumber("opacity"),
        TypeChecker.boolean("marker"),
        TypeChecker.number("curvature"),
        TypeChecker.string("dashPattern"),
        TypeChecker.string("hoverText"),
        TypeChecker.object("eventHandlers")
    ];
    
    LinkLine.prototype.optionalPropertyTypes = [];
    
    LinkLine.prototype.updateProperties = function (properties) {
        TypeChecker.checkProperties(properties, [], this.propertyTypes, true);
        _.extend(this, properties);
    }
    
    return LinkLine;
});


// LabelText is the class used for rendering the labels for nodes. 
// They have coordinates (x, y) as well as offset coordinates. The force engine will update the raw coords, so the offset
// should speficy how far away from the node the label should be rendered.
// These are passed to a renderer in the update() and updatePositions calls. 

define('futuregrapher/labeltext',['require','futuregrapher/typechecker'],function(require) {
    var TypeChecker = require('futuregrapher/typechecker');

    var LabelText = function (id, data) {
        this.id = id.toString();
        this.data = data;
    };
    
    // These properties must be present for rendering
    LabelText.prototype.propertyTypes = [
        TypeChecker.string("id"),
        TypeChecker.object("data"),
        TypeChecker.string("text"),
        TypeChecker.number("x"), // Note: x and y are NOT scaled to screen space because they are manipulated by d3.force
        TypeChecker.number("y"), // Scaling takes place in SvgRenderer.update, which is why it takes the scales as parameters.
        TypeChecker.number("offsetX"),
        TypeChecker.number("offsetY"),
        TypeChecker.string("anchor"),   // This can be "start", "end" or "auto". If set to auto, the label will be adjusted to the centroid of the nodes.
        TypeChecker.nonNegativeNumber("fontSize"),
        TypeChecker.color("color"),
        TypeChecker.color("borderColor"),
        TypeChecker.nonNegativeNumber("opacity"),
        TypeChecker.string("hoverText"),
        TypeChecker.object("eventHandlers")
    ];
    
    LabelText.prototype.optionalPropertyTypes = [];
    
    LabelText.prototype.updateProperties = function (properties) {
        TypeChecker.checkProperties(properties, [], this.propertyTypes, true);
        _.extend(this, properties);
    }

    return LabelText;
});


// ClusterHull is the class used for rendering the solid "blobs" behind a cluster of nodes.
// These are passed to a renderer in the update() and updatePositions calls. 

define('futuregrapher/clusterhull',['require','futuregrapher/typechecker'],function(require) {
    var TypeChecker = require('futuregrapher/typechecker');

    var ClusterHull = function (id, data) {
        this.id = id.toString();
        this.data = data;
    };
    
    // These properties must be present for rendering
    ClusterHull.prototype.propertyTypes = [
        TypeChecker.string("id"),
        TypeChecker.object("data"),
        TypeChecker.array("nodeCircles"),
        TypeChecker.color("color"),
        TypeChecker.color("borderColor"),
        TypeChecker.nonNegativeNumber("opacity"),
        TypeChecker.string("hoverText"),
        TypeChecker.object("eventHandlers")
    ];
    
    ClusterHull.prototype.optionalPropertyTypes = [];
    
    ClusterHull.prototype.updateProperties = function (properties) {
        TypeChecker.checkProperties(properties, [], this.propertyTypes, true);
        _.extend(this, properties);
    }

    return ClusterHull;
});




define('futuregrapher/graphvis',['require','futuregrapher/defaultgraphvisoptions','futuregrapher/nodecircle','futuregrapher/linkline','futuregrapher/labeltext','futuregrapher/clusterhull'],function(require) {
    var defaultGraphVisOptions = require('futuregrapher/defaultgraphvisoptions');
    var NodeCircle = require('futuregrapher/nodecircle');
    var LinkLine = require('futuregrapher/linkline');
    var LabelText = require('futuregrapher/labeltext');
    var ClusterHull = require('futuregrapher/clusterhull');

    var GraphVis = function (renderer, options) {
        var self = this;
        options = $.extend(true, {}, defaultGraphVisOptions, options);
    
        var visNodes, visLinks, visClusters;
        
        var clusterHulls = [];
        var linkLines = [];
        var nodeCircles = [];
        var labelTexts = [];
        
        var force;
    
        var xScale = d3.scale.linear()
            .domain([0, renderer.width()])
            .range([0, renderer.width()]);
    
        var yScale = d3.scale.linear()
            .domain([0, renderer.height()])
            .range([0, renderer.height()]);
    
        var zoomDensityScale = options.zoomDensityScale;
        var radiusFactor = zoomDensityScale(1);
    
        //[of]:        function zoomed() {
        // This function is called by zoomBehavior and this.zoomPan to update the graph
        function zoomed() {
            var newRadiusFactor = zoomDensityScale(zoomBehavior.scale());
            var radiusFactorChanged = newRadiusFactor !== radiusFactor;
            
            radiusFactor = newRadiusFactor;
            
            if (options.updateOnlyPositionsOnZoom)
                self.updatePositions("zoom");
            else
                self.update(null, null, null, 0, "zoom");
            
            // If force and collision detection is enabled, and this call changed the density (radiusFactor),
            // nodes might be colliding so we need to resume the force.
            if (options.enableForce && options.enableCollisionDetection && force && radiusFactorChanged)
                force.resume();
            
            if (d3.event && d3.event.sourceEvent) {
                d3.event.sourceEvent.stopPropagation();
            }
        }
        //[cf]
        var zoomBehavior = d3.behavior.zoom()
            .x(xScale)
            .y(yScale)
            .scaleExtent(options.zoomExtent)
            .on("zoom", zoomed);
    
        //[of]:        this.unscaleCoords = function(screenCoords) {
        this.unscaleCoords = function(screenCoords) {
            var unscaledX = xScale.invert(screenCoords[0]);
            var unscaledY = yScale.invert(screenCoords[1]);
            
            return [unscaledX, unscaledY];
        };
        //[cf]
    
        //[of]:        function clusterHullFromVisCluster(visCluster) {
        function clusterHullFromVisCluster(visCluster) {
            var clusterHull;
            var id = visCluster.id;
        
            var oldClusterHull = _.find(clusterHulls, function (ch) { return ch.id === id; });
            if (oldClusterHull) {
                clusterHull = oldClusterHull;
            } else {
                clusterHull = new ClusterHull(id, null);
            }
        
            clusterHull.eventHandlers = {};    
            if (options.onClusterClick) { clusterHull.eventHandlers.click = options.onClusterClick; }
        
            // If a double click handler is provided, use it. Otherwise, default behavior is to collapse the cluster when double-clicking.
            if (options.onClusterDoubleClick) { 
                clusterHull.eventHandlers.dblclick = options.onClusterDoubleClick; 
            } else {
                clusterHull.eventHandlers.dblclick = function (d) { 
                    visCluster.isCollapsed = true;
                    self.update();
                };
            }
        
            if (options.onClusterMouseOver) { clusterHull.eventHandlers.mouseover = options.onClusterMouseOver; }
            if (options.onClusterMouseOut) { clusterHull.eventHandlers.mouseout = options.onClusterMouseOut; }
        
            clusterHull.nodeCircles = [];   // Do this so we can safely push nodeCircle's in here, even if we're reusing an old ClusterHull.
        
            var dynamicDescription = options.describeExpandedCluster ? options.describeExpandedCluster(visCluster, [/* TODO: nodecircles */], radiusFactor) : {};
            var description = _.extend({}, options.defaultExpandedClusterDescription, dynamicDescription);
        
            clusterHull.updateProperties(description);
        
            return clusterHull;
        }
        
        //[cf]
        //[of]:        function labelTextFromLabelDescription(label, id, x, y, nodeCircleColor, nodeCircleBorderColor, nodeCircleOpacity) {
        function labelTextFromLabelDescription(label, id, x, y, nodeCircleColor, nodeCircleBorderColor, nodeCircleOpacity) {
            var offsetX = _.isUndefined(label.offsetX) ? 0 : label.offsetX;
            var offsetY = _.isUndefined(label.offsetY) ? 0 : label.offsetY;
            var anchor = label.anchor || "start";
            var fontSize = label.fontSize || 14;
            var color = label.color || nodeCircleColor;
            var borderColor = label.borderColor || nodeCircleBorderColor;
            var opacity = _.isUndefined(label.opacity) ? nodeCircleOpacity : description.opacity;
            var hoverText = label.hoverText || null;
            
            var eventHandlers = {};
        
            var result = new LabelText(id, null);
        
            var defaults = { 
                x: x, 
                y: y, 
                offsetX: 0,
                offsetY: 0,
                anchor: "start", 
                fontSize: 14, 
                color: nodeCircleColor, 
                borderColor: nodeCircleBorderColor, 
                opacity: nodeCircleOpacity,
                hoverText: "",
                eventHandlers: {}
            };
            
            result.updateProperties(defaults);
            result.updateProperties(label);
        
            return result;
        }
        //[cf]
        //[of]:        function nodeCircleAndLabelTextFromVisNode(visNode) {
        function nodeCircleAndLabelTextFromVisNode(visNode) {
            var nodeCircle, labelText;
            var id = visNode.id;
        
            var oldNodeCircle = _.find(nodeCircles, function (nc) { return nc.id === id; });
            if (oldNodeCircle)
                nodeCircle = oldNodeCircle;
            else {
                nodeCircle = new NodeCircle(id, visNode);
        
                // If this node was part of a cluster that was just expanded, we want to create it somewhere close to where the
                // placeholder node was. nodeCircles containes the nodeCircle's of the previous render cycle, so it will exist in there.
                if (visNode.clusterId) {
                    var previousPlaceholderNodeCircle = _.find(nodeCircles, function (nc) { return nc.id === "placeholder-" + visNode.clusterId });
                    if (previousPlaceholderNodeCircle) {
                        nodeCircle.x = previousPlaceholderNodeCircle.x + Math.floor(Math.random() * 10 - 5);
                        nodeCircle.y = previousPlaceholderNodeCircle.y + Math.floor(Math.random() * 10 - 5);
                    }
                }        
        
                nodeCircle.eventHandlers = {};    
                if (options.onNodeClick) { nodeCircle.eventHandlers.click = options.onNodeClick; }
                if (options.onNodeDoubleClick) { nodeCircle.eventHandlers.dblclick = options.onNodeDoubleClick; }
                if (options.onNodeMouseOver) { nodeCircle.eventHandlers.mouseover = options.onNodeMouseOver; }
                if (options.onNodeMouseOut) { nodeCircle.eventHandlers.mouseout = options.onNodeMouseOut; }
                if (options.onNodeMouseDown) { nodeCircle.eventHandlers.mousedown = options.onNodeMouseDown; }
                if (options.onNodeMouseUp) { nodeCircle.eventHandlers.mouseup = options.onNodeMouseUp; }
                if (options.onNodeDragStart) { nodeCircle.eventHandlers.dragstart = options.onNodeDragStart; }
                if (options.onNodeDrag) { nodeCircle.eventHandlers.drag = options.onNodeDrag; }
                if (options.onNodeDragEnd) { nodeCircle.eventHandlers.dragend = options.onNodeDragEnd; }
            }
        
            var dynamicDescription = options.describeVisNode ? options.describeVisNode(visNode, radiusFactor) : {};
            var description = _.extend({}, options.defaultNodeDescription, dynamicDescription);
        
            if (_.isNumber(description.x)) {
                nodeCircle.x = description.x;   // This is a bit silly because it will happen in updateProperties below. However, we need it for the label which is constructed first.
                nodeCircle.px = description.x;  // Do this to avoid anxiety-attack style movements from force when we've fixed coords
            } else if (!_.isNumber(nodeCircle.x)) { // If there was no description, and we didn't have one from before, create a random one.
                var w = renderer.width();
                var x = w / 2 + (Math.random() * (w / 2) - w / 4)
                nodeCircle.x = x;
                nodeCircle.px = x;
            }
            
            if (_.isNumber(description.y)) {
                nodeCircle.y = description.y;
                nodeCircle.py = description.y;
            } else if (!_.isNumber(nodeCircle.y)) {
                var h = renderer.height();
                var y = h / 2 + (Math.random() * (h / 2) - h / 4);
                nodeCircle.y = y;
                nodeCircle.py = y;
            }
        
            if (!_.isUndefined(description.label)) {
        
                // It might be defined, but still null so check for that as well.
                if (!_.isNull(description.label))
                    labelText = labelTextFromLabelDescription(description.label, id, nodeCircle.x, nodeCircle.y, description.color, description.borderColor, description.opacity);
        
                delete description.label;
            }
        
            nodeCircle.updateProperties(description);
        
            return {
                nodeCircle: nodeCircle,
                labelText: labelText
            };
        }
        //[cf]
        //[of]:        function nodeCircleAndLabelTextFromCollapsedCluster(visCluster, clusterVisNodes) {
        function nodeCircleAndLabelTextFromCollapsedCluster(visCluster, clusterVisNodes, clusterVisLinks) {
            var nodeCircle, labelText;
            var id = "placeholder-" + visCluster.id;
        
            var oldNodeCircle = _.find(nodeCircles, function (nc) { return nc.id === id; });
            if (oldNodeCircle) {
                nodeCircle = oldNodeCircle;
            } else {
                nodeCircle = new NodeCircle(id, { visCluster: visCluster, visNodes: clusterVisNodes, visLinks: clusterVisLinks });
        
                // If this cluster was just collapsed, nodeCircles (== the node circles of last render cycle) will contain nodeCircle instances
                // for the individual nodes in the cluster. We need to position this new placeholder in the centroid of those.
                var oldClusterNodeCircles = _.filter(nodeCircles, function (nc) { return nc.visData && nc.visData.clusterId === visCluster.id; });
                if (oldClusterNodeCircles.length) {
                    nodeCircle.x = d3.mean(oldClusterNodeCircles, function (nc) { return nc.x; });
                    nodeCircle.y = d3.mean(oldClusterNodeCircles, function (nc) { return nc.y; });
                }
        
                nodeCircle.eventHandlers = {};    
                if (options.onClusterNodeClick) { nodeCircle.eventHandlers.click = options.onClusterNodeClick; }
                
                if (options.onClusterNodeDoubleClick) { 
                    nodeCircle.eventHandlers.dblclick = options.onClusterNodeDoubleClick; 
                } else {
                    nodeCircle.eventHandlers.dblclick = function (d) {
                        visCluster.isCollapsed = false; 
                        self.update(); 
                    }
                }
                
                if (options.onClusterNodeMouseOver) { nodeCircle.eventHandlers.mouseover = options.onClusterNodeMouseOver; }
                if (options.onClusterNodeMouseOut) { nodeCircle.eventHandlers.mouseout = options.onClusterNodeMouseOut; }
                if (options.onClusterNodeDragStart) { nodeCircle.eventHandlers.dragstart = options.onClusterNodeDragStart; }
            }
        
            var dynamicDescription = options.describeCollapsedCluster ? options.describeCollapsedCluster(visCluster, clusterVisNodes, radiusFactor) : {};
            var description = _.extend({}, options.defaultCollapsedClusterDescription, dynamicDescription);
        
            if (!_.isNumber(nodeCircle.x) || !_.isNumber(nodeCircle.y)) {
                if (description.x)
                    nodeCircle.x = description.x;
                else {
                    var w = renderer.width();
                    nodeCircle.x = w / 2 + (Math.random() * (w / 2) - w / 4);
                }
                
                if (description.y) 
                    nodeCircle.y = description.y;
                else {
                    var h = renderer.height();
                    nodeCircle.y = h / 2 + (Math.random() * (h / 2) - h / 4);
                }
            }
        
            if (!_.isUndefined(description.label)) {
        
                // It might be defined but still null so check for that as well.
                if (!_.isNull(description.label))
                    labelText = labelTextFromLabelDescription(description.label, id, nodeCircle.x, nodeCircle.y, description.color, description.borderColor, description.opacity);
        
                delete description.label;
            }
        
            nodeCircle.updateProperties(description);
        
            return {
                nodeCircle: nodeCircle,
                labelText: labelText
            };
        }
        //[cf]
        //[of]:        function linkLineFromVisLinkAndNodeCircles(visLink, sourceNodeCircle, targetNodeCircle) {
        function linkLineFromVisLinkAndNodeCircles(visLink, sourceNodeCircle, targetNodeCircle) {
            var linkLine;
            var id = sourceNodeCircle.id + "->" + targetNodeCircle.id;
        
            var oldLinkLine = _.find(linkLines, function (ll) { return ll.id === id; });
            if (oldLinkLine)
                linkLine = oldLinkLine;
            else {
                linkLine = new LinkLine(id, sourceNodeCircle, targetNodeCircle, visLink);
        
                linkLine.eventHandlers = {};    
                if (options.onLinkClick) { linkLine.eventHandlers.click = options.onLinkClick; }
                if (options.onLinkDoubleClick) { linkLine.eventHandlers.dblclick = options.onLinkDoubleClick; }
                if (options.onLinkMouseOver) { linkLine.eventHandlers.mouseover = options.onLinkMouseOver; }
                if (options.onLinkMouseOut) { linkLine.eventHandlers.mouseout = options.onLinkMouseOut; }
            }
        
            var dynamicDescription = options.describeVisLink ? options.describeVisLink(visLink, sourceNodeCircle, targetNodeCircle, radiusFactor) : {};
            var description = _.extend({}, options.defaultLinkDescription, dynamicDescription);
        
            linkLine.updateProperties(description);
        
            return linkLine;
        }
        //[cf]
        //[of]:        function linkLineFromClusterLink(sourceNodeCircle, targetNodeCircle, visLinks) {
        function linkLineFromClusterLink(sourceNodeCircle, targetNodeCircle, visLinks) {
            var linkLine;
            var id = sourceNodeCircle.id + "->" + targetNodeCircle.id;
        
            var oldLinkLine = _.find(linkLines, function (ll) { return ll.id === id; });
            if (oldLinkLine)
                linkLine = oldLinkLine;
            else {
                linkLine = new LinkLine(id, sourceNodeCircle, targetNodeCircle, visLinks);
        
                linkLine.eventHandlers = {};    
                if (options.onLinkClick) { linkLine.eventHandlers.click = options.onLinkClick; }
                if (options.onLinkDoubleClick) { linkLine.eventHandlers.dblclick = options.onLinkDoubleClick; }
                if (options.onLinkMouseOver) { linkLine.eventHandlers.mouseover = options.onLinkMouseOver; }
                if (options.onLinkMouseOut) { linkLine.eventHandlers.mouseout = options.onLinkMouseOut; }
            }
        
            var dynamicDescription = options.describeClusterLink ? options.describeClusterLink(visLinks, sourceNodeCircle, targetNodeCircle, radiusFactor) : {};
            var description = _.extend({}, options.defaultClusterLinkDescription, dynamicDescription);
        
            linkLine.updateProperties(description);
        
            return linkLine;
        }
        //[cf]
    
        //[of]:        this.update = function (newVisNodes, newVisLinks, newVisClusters, transitionDuration, updateType) {
        this.update = function (newVisNodes, newVisLinks, newVisClusters, transitionDuration, updateType) {
            if (newVisNodes) visNodes = newVisNodes;
            if (newVisLinks) visLinks = newVisLinks;
            if (newVisClusters) visClusters = newVisClusters;
            if (_.isUndefined(transitionDuration)) transitionDuration = 250;
            if (!updateType) updateType = "update";
        
            if (options.onUpdatePreProcess) {
                var params = {
                    visNodes: visNodes,
                    visLinks: visLinks,
                    visClusters: visClusters,
                    transitionDuration: transitionDuration
                };
                
                options.onUpdatePreProcess(params, updateType);
                
                visNodes = params.visNodes;
                visLinks = params.visLinks;
                visClusters = params.visClusters;
                transitionDuration = params.transitionDuration;
            }
        
            //[of]:    Create cluster hulls
            //[c]Create cluster hulls
            
            var newClusterHulls = [];   // We'll only create hulls for expanded clusters
            var collapsedClusters = {};  // Collapsed ones go in here to turn into placeholder NodeCircles
            _.each(visClusters, function (vc) {
                if (!vc.isCollapsed)
                    newClusterHulls.push(clusterHullFromVisCluster(vc));
                else
                    collapsedClusters[vc.id] = { visNodes: [], visLinks: [] };
            });
            
            //[cf]
            //[of]:    Create node circles and label texts
            //[c]Create node circles and label texts
            
            var newNodeCircles = [];
            var newLabelTexts = [];
            _.each(visNodes, function (visNode) {
                if (visNode.clusterId) {
                    var clusterHull = _.find(newClusterHulls, function (ch) { return ch.id === visNode.clusterId; });
                    
                    if (clusterHull) {
                        var nodeCombination = nodeCircleAndLabelTextFromVisNode(visNode);
                        var nodeCircle = nodeCombination.nodeCircle;
                        newNodeCircles.push(nodeCircle);
                        clusterHull.nodeCircles.push(nodeCircle);
            
                        if (nodeCombination.labelText)
                            newLabelTexts.push(nodeCombination.labelText);
                    } else {
                        if (!collapsedClusters.hasOwnProperty(visNode.clusterId))
                            throw "Node '" + visNode.id + "' refers to a cluster '" + visNode.clusterId + "' that wasn't defined";
                        
                        collapsedClusters[visNode.clusterId].visNodes.push(visNode);
                    }
                } else {
                    var nodeCombination = nodeCircleAndLabelTextFromVisNode(visNode);
                    newNodeCircles.push(nodeCombination.nodeCircle);
                    if (nodeCombination.labelText)
                        newLabelTexts.push(nodeCombination.labelText);
                }
            });
            
            _.each(collapsedClusters, function (collapsedCluster, clusterId) {
                var visCluster = _.find(visClusters, function (vc) { return vc.id === clusterId; });
                var nodeCombination = nodeCircleAndLabelTextFromCollapsedCluster(visCluster, collapsedCluster.visNodes, collapsedCluster.visLinks);
                newNodeCircles.push(nodeCombination.nodeCircle);
                if (nodeCombination.labelText)
                    newLabelTexts.push(nodeCombination.labelText);
            });
            //[cf]
            //[of]:    Create link lines
            //[c]Create link lines
            
            var clusterLinks = {};
            
            var newLinkLines = [];
            _.each(visLinks, function (visLink) {
                var sourceVisNode = _.find(visNodes, function (vn) { return vn.id === visLink.sourceNodeId; });
                if (!sourceVisNode)
                    throw "Link refers to a source node '" + visLink.sourceNodeId + "' that wasn't found";
            
                var targetVisNode = _.find(visNodes, function (vn) { return vn.id === visLink.targetNodeId; });
                if (!targetVisNode)
                    throw "Link refers to a target node '" + visLink.targetNodeId + "' that wasn't found";
            
                var sourceVisCluster, targetVisCluster;
                if (sourceVisNode.clusterId)
                    sourceVisCluster = _.find(visClusters, function (vc) { return vc.id === sourceVisNode.clusterId; });
            
                if (targetVisNode.clusterId)
                    targetVisCluster = _.find(visClusters, function (vc) { return vc.id === targetVisNode.clusterId; });
            
                var isClusterLink = false;
                var sourceNodeCircle, targetNodeCircle;
            
                if (sourceVisCluster && sourceVisCluster.isCollapsed) {
                    isClusterLink = true;
                    sourceNodeCircle = _.find(newNodeCircles, function (nc) { return nc.id === "placeholder-" + sourceVisCluster.id; });
                }
                else {
                    sourceNodeCircle = _.find(newNodeCircles, function (nc) { return nc.id === sourceVisNode.id; });
                }
                
                if (targetVisCluster && targetVisCluster.isCollapsed) {
                    isClusterLink = true;
                    targetNodeCircle = _.find(newNodeCircles, function (nc) { return nc.id === "placeholder-" + targetVisCluster.id; });
                } else {
                    targetNodeCircle = _.find(newNodeCircles, function (nc) { return nc.id === targetVisNode.id; });
                }
                
                if (isClusterLink) {
                    var id = sourceNodeCircle.id + "->" + targetNodeCircle.id;
                    if (!clusterLinks.hasOwnProperty(id))
                        clusterLinks[id] = { source: sourceNodeCircle, target: targetNodeCircle, visLinks: [] };
                    
                    clusterLinks[id].visLinks.push(visLink);
                } else {
                    var linkLine = linkLineFromVisLinkAndNodeCircles(visLink, sourceNodeCircle, targetNodeCircle);
                    newLinkLines.push(linkLine);
                }
            });
            
            _.each(clusterLinks, function (clusterLink) {
                var linkLine = linkLineFromClusterLink(clusterLink.source, clusterLink.target, clusterLink.visLinks);
                newLinkLines.push(linkLine);
            });
            
            //[cf]
        
            // If there is a structural difference compared to last run, and we've started the physics engine,
            // we need to update the nodes and links on it and call force.start. 
            var updateForce = false;
            if (force)
                updateForce = !_.isEqual(nodeCircles, newNodeCircles) || !_.isEqual(linkLines, newLinkLines);
        
            nodeCircles = newNodeCircles;
            linkLines = newLinkLines;
            labelTexts = newLabelTexts;
            clusterHulls = newClusterHulls;
        
            if (options.onUpdateAutoZoom) {
                var renderElements = { clusterHulls: clusterHulls, linkLines: linkLines, nodeCircles: nodeCircles, labelTexts: labelTexts };
                var updatedZoom = options.onUpdateAutoZoom(renderElements, zoomBehavior.scale(), zoomBehavior.translate());
                
                if (updatedZoom.scale) zoomBehavior.scale(updatedZoom.scale);
                if (updatedZoom.translate) zoomBehavior.translate(updatedZoom.translate);
                radiusFactor = zoomDensityScale(zoomBehavior.scale());
            }
        
            if (options.onUpdatePreRender) {
                var params = {
                    clusterHulls: clusterHulls, 
                    linkLines: linkLines, 
                    nodeCircles: nodeCircles, 
                    labelTexts: labelTexts, 
                    xScale: xScale, 
                    yScale: yScale, 
                    radiusFactor: radiusFactor, 
                    transitionDuration: transitionDuration 
                };
        
                options.onUpdatePreRender(params, updateType);
        
                clusterHulls = params.clusterHulls;
                linkLines = params.linkLines;
                nodeCircles = params.nodeCircles;
                labelTexts = params.labelTexts;
                xScale = params.xScale;
                yScale = params.yScale;
                radiusFactor = params.radiusFactor;
                transitionDuration = params.transitionDuration;
            }
        
            if (updateForce) {
                force.nodes(nodeCircles);
                force.links(linkLines);
                force.start();
            }
            
            renderer.update(clusterHulls, linkLines, nodeCircles, labelTexts, xScale, yScale, radiusFactor, transitionDuration);
        };
        //[cf]
        //[of]:        this.updatePositions = function (updateType) {
        this.updatePositions = function (updateType) {
            if (options.onUpdateAutoZoom) {
                var renderElements = { clusterHulls: clusterHulls, linkLines: linkLines, nodeCircles: nodeCircles, labelTexts: labelTexts };
                var updatedZoom = options.onUpdateAutoZoom(renderElements, zoomBehavior.scale(), zoomBehavior.translate());
                
                if (updatedZoom.scale) zoomBehavior.scale(updatedZoom.scale);
                if (updatedZoom.translate) zoomBehavior.translate(updatedZoom.translate);
        
                radiusFactor = zoomDensityScale(zoomBehavior.scale());
            }
        
            if (options.onUpdatePreRender) {
                var params = {
                    clusterHulls: clusterHulls, 
                    linkLines: linkLines, 
                    nodeCircles: nodeCircles, 
                    labelTexts: labelTexts, 
                    xScale: xScale, 
                    yScale: yScale, 
                    radiusFactor: radiusFactor, 
                    transitionDuration: transitionDuration 
                };
        
                options.onUpdatePreRender(params, updateType);
        
                clusterHulls = params.clusterHulls;
                linkLines = params.linkLines;
                nodeCircles = params.nodeCircles;
                labelTexts = params.labelTexts;
                xScale = params.xScale;
                yScale = params.yScale;
                radiusFactor = params.radiusFactor;
                transitionDuration = params.transitionDuration;
            }
        
            renderer.updatePositions(clusterHulls, linkLines, nodeCircles, labelTexts, xScale, yScale, radiusFactor);
        }
        //[cf]
    
        //[of]:        function cluster(alpha) {
        function cluster(alpha) {
            return function(d) {
                if (d.id.indexOf("placeholder") === 0) return;
                //if (!d.data.clusterId) return;
                
                var centralClusterNode = _.find(nodeCircles, function (nc) { return nc.visData.clusterId === d.data.clusterId; }); // For now, just use the first one found
                if (centralClusterNode === d) return;
                var x = d.x - centralClusterNode.x,
                    y = d.y - centralClusterNode.y,
                    l = Math.sqrt(x * x + y * y),
                    r = ((d.radius + centralClusterNode.radius) / zoomBehavior.scale()) * radiusFactor;
                if (l != r) {
                    l = (l - r) / l * alpha;
                    if (!d.fixed) {
                        d.x -= x *= l;
                        d.y -= y *= l;
                    }
                    if (!centralClusterNode.fixed) {
                        centralClusterNode.x += x;
                        centralClusterNode.y += y;
                    }
                }
            };
        }
        //[cf]
        //[of]:        function collide(alpha) {
        function collide(alpha) {
            var padding = 10; // separation between same-color nodes
            var clusterPadding = 20; // separation between different-color nodes
            var maxRadius = 12;
         
            var quadtree = d3.geom.quadtree(nodeCircles);
            return function(d) {
                var r = ((d.radius + maxRadius + Math.max(padding, clusterPadding)) / zoomBehavior.scale()) * radiusFactor,
                    nx1 = d.x - r,
                    nx2 = d.x + r,
                    ny1 = d.y - r,
                    ny2 = d.y + r;
        
                quadtree.visit(function(quad, x1, y1, x2, y2) {
                    if (quad.point && (quad.point !== d)) {
                        var x = d.x - quad.point.x,
                            y = d.y - quad.point.y,
                            l = Math.sqrt(x * x + y * y),
                            r = ((d.radius + quad.point.radius + (d.visData.clusterId === quad.point.visData.clusterId ? padding : clusterPadding)) / zoomBehavior.scale()) * radiusFactor;
        
                        if (l < r) {
                            l = (l - r) / l * alpha;
                            if (!d.fixed) {
                                d.x -= x *= l;
                                d.y -= y *= l;
                            }
                            if (!quad.point.fixed) {
                                quad.point.x += x;
                                quad.point.y += y;
                            }
                        }
                    }
                    return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
                });
            };
        }
        //[cf]
        //[of]:        function tick(e) {
        function tick(e) {
            if (options.enableClusterForce)
                _(nodeCircles).each(cluster(0.01));
            
            if (options.enableCollisionDetection)
                _(nodeCircles).each(collide(0.5));
        
            // Move labels according to nodes.
            _(labelTexts).each(function (lt) {
                var nodeCircle = _.find(nodeCircles, function (nc) { return nc.id === lt.id; });
                lt.x = nodeCircle.x;
                lt.y = nodeCircle.y;
            });
        
            if (options.updateOnlyPositionsOnTick)
                self.updatePositions("tick");
            else
                self.update(null, null, null, 0, "tick");
        }
        //[cf]
    
        //[of]:        this.startForce = function () {
        this.startForce = function () {
            if (force) {
                force.start();
            } else {
                force = d3.layout.force()
                    .nodes(nodeCircles)
                    .links(linkLines)
                    .size([renderer.width(), renderer.height()])
                    .linkDistance(options.forceParameters.linkDistance)
                    .linkStrength(options.forceParameters.linkStrength)
                    .friction(options.forceParameters.friction)
                    .charge(options.forceParameters.charge)
                    //.chargeDistance(options.forceParameters.chargeDistance)   // This doesn't seem to be supported in this version of D3.
                    .theta(options.forceParameters.theta)
                    .gravity(options.forceParameters.gravity)
                    .on("tick", tick)
                    .start();
            }
        };
        //[cf]
        //[of]:        this.resumeForce = function () {
        this.resumeForce = function () {
            force.resume();
        }
        //[cf]
        //[of]:        this.updateForceDynamics = function (newForceParameters) {
        this.updateForceDynamics = function (newForceParameters) {
            _.extend(options.forceParameters, newForceParameters);
        
            if (force) {
                force
                    .linkDistance(options.forceParameters.linkDistance)
                    .linkStrength(options.forceParameters.linkStrength)
                    .friction(options.forceParameters.friction)
                    .charge(options.forceParameters.charge)
                    //.chargeDistance(options.forceParameters.chargeDistance)   // This doesn't seem to be supported in this version of D3.
                    .theta(options.forceParameters.theta)
                    .gravity(options.forceParameters.gravity)
        
                // These properties only take effect in force.start(), so do that.
                if (newForceParameters.hasOwnProperty("linkDistance") || 
                    newForceParameters.hasOwnProperty("linkStrength") || 
                    newForceParameters.hasOwnProperty("charge"))
                    force.start();
            }
        };
        //[cf]
        //[of]:        this.stopForce = function () {
        this.stopForce = function () {
            if (force) force.stop();
        }
        //[cf]
    
        //[of]:        this.zoomPan = function (scale, translate) {
        this.zoomPan = function (scale, translate) {
            zoomBehavior.scale(scale).translate(translate);
            zoomed();
        };
        //[cf]
    
        this.getVisNode = function(id) {
            if(nodeCircles)
                return _.findWhere(nodeCircles, { id: id.toString() });
        };
    
        //[of]:        function initialize() {
        function initialize() {
            var container = d3.select(renderer.containerElement()[0]);
            
            if (options.enableZoom) {
                container
                    .call(zoomBehavior)
                    .on("dblclick.zoom", null);
            }
        
            if (options.onClick) { container.on("click", options.onClick); }
            if (options.onMouseDown) { container.on("mousedown", options.onMouseDown); }
            if (options.onMouseUp) { container.on("mouseup", options.onMouseUp); }
            if (options.onMouseMove) { container.on("mousemove", options.onMouseMove); }
            
        }
        //[cf]
        initialize();
    };
    
    return GraphVis;
});
define('futuregrapher/visnode',['require'],function(require) {
    
    var VisNode = function (id, data, clusterId) {
        this.id = id;
        this.data = data;
        this.clusterId = clusterId;
    };

    return VisNode;
});
define('futuregrapher/vislink',['require'],function(require) {

    var VisLink = function (sourceNodeId, targetNodeId, data) {
        this.sourceNodeId = sourceNodeId;
        this.targetNodeId = targetNodeId;
        this.data = data;
    };
    
    return VisLink;
});    

define('futuregrapher/viscluster',['require'],function(require) {

    var VisCluster = function (id, data, isCollapsed) {
        this.id = id;
        this.data = data;
        this.isCollapsed = isCollapsed;
    };

    return VisCluster;
});

define('futuregrapher/autozoomer',['require'],function(require) {
    var autoZoomer = function (renderer) {
        var enabled = true;
        var margin = 20;
        var zoomExtent = [0.25, 4];
        var terminateAt;
        var fix = null;
    
        function zoom (renderElements, scale, translate) {
            if (!enabled) return {};
                
            // If we're in "fixed" mode, just return that.
            if (fix) return fix;
                
            // If we've passed the planned death time, disable ourselves.
            if (terminateAt && new Date().getTime() > terminateAt) {
                terminateAt = null;
                enabled = false;
                return {};
            }
                
            var xExtent = d3.extent(renderElements.nodeCircles, function (nc) { return nc.x; });
            var yExtent = d3.extent(renderElements.nodeCircles, function (nc) { return nc.y; });
    
            if (!xExtent[0] || !yExtent[0])     // If there are no nodes, don't modify anything.
                return {};
    
            var canvasWidth = renderer.width() - margin * 2;
            var canvasHeight = renderer.height() - margin * 2;
            
            var canvasCenterX = canvasWidth / 2;
            var canvasCenterY = canvasHeight / 2;
    
            var nodeSpaceWidth = xExtent[1] - xExtent[0];
            var nodeSpaceHeight = yExtent[1] - yExtent[0];
            
            var nodeCenterX = xExtent[0] + nodeSpaceWidth / 2;
            var nodeCenterY = yExtent[0] + nodeSpaceHeight / 2;
            
            var newScale = Math.min(canvasHeight / nodeSpaceHeight, canvasWidth / nodeSpaceWidth);
            
            if (newScale < zoomExtent[0]) scale = zoomExtent[0];
            if (newScale > zoomExtent[1]) scale = zoomExtent[1];
            
            var x = canvasCenterX - nodeCenterX * newScale + margin;
            var y = canvasCenterY - nodeCenterY * newScale + margin;
    
            return {
                scale: newScale,
                translate: [x, y]
            };
        }
    
        zoom.enable = function () {
            fix = null;     // Enable means not fixed mode.
            enabled = true;
            return zoom;
        }
        
        zoom.disable = function () {
            enabled = false;
            return zoom;
        }
        
        zoom.enabled = function () {
            return enabled;
        }
    
        // Set an object to return: { scale: ..., translate: [...] }
        zoom.fix = function (newFix) {
            if (!arguments.length) return fix;
            
            fix = newFix;
            enabled = true;
            terminateAt = null;
            return zoom;
        }
    
        zoom.margin = function (newMargin) {
            if (!arguments.length) return margin;
            
            margin = newMargin;
            return zoom;
        };
        
        zoom.zoomExtent = function (newZoomExtent) {
            if (!arguments.length) return zoomExtent;
            
            zoomExtent = newZoomExtent;
            return zoom;
        };
        
        zoom.terminateIn = function (milliseconds) {
            var now = new Date().getTime();
            if (!arguments.length) return terminateAt - now;  // Return the number of milliseconds left before we terminate
    
            fix = null;     // Enable means not fixed mode.
            enabled = true;
            terminateAt = now + milliseconds;
            return zoom;
        };
    
        return zoom;
    };

    return autoZoomer;
});

define('futuregrapher/autoradiusscale',['require'],function(require) {
    var autoRadiusScale = function () {
        var maxRadius = 10,
            maxInputValue = 100;
    
        function rescale() {
            return scale;
        }
        
        function scale(x) {
            return Math.sqrt(maxRadius * maxRadius * (x / maxInputValue));
        }
        
        scale.maxRadius = function (x) {
            if (!arguments.length) return maxRadius;
            maxRadius = x;
            return rescale();
        };
        
        scale.maxInputValue = function (x) {
            if (!arguments.length) return maxInputValue;
            maxInputValue = x;
            return rescale();
        };
        
        return rescale();
    }

    return autoRadiusScale;
});

define('futuregrapher/gradientscale',['require'],function(require) {
    var gradientScale = function () {
        var domain = [0, 1],
            range = ["#333", "#aaa"],
            domainScale = d3.scale.linear(),
            rangeScale = d3.scale.linear().range(range);
    
        function rescale() {
            domainScale
                .domain(domain)
                .range([0, range.length - 1]);
                
            rangeScale
                .domain(d3.range(0, range.length))
                .range(range);
            
            return scale;
        }
        
        function scale(x) {
            return rangeScale(domainScale(x));
        }
        
        scale.domain = function (x) {
            if (!arguments.length) return domain;
            domain = x;
            return rescale();
        };
        
        scale.range = function (x) {
            if (!arguments.length) return range;
            range = x;
            return rescale();
        };
        
        return rescale();
    }

    return gradientScale;
});
define('futuregrapher',['require','futuregrapher/core','futuregrapher/typechecker','futuregrapher/svgrenderer','futuregrapher/graphvis','futuregrapher/visnode','futuregrapher/vislink','futuregrapher/viscluster','futuregrapher/nodecircle','futuregrapher/labeltext','futuregrapher/linkline','futuregrapher/clusterhull','futuregrapher/autozoomer','futuregrapher/autoradiusscale','futuregrapher/gradientscale'],function(require) {
    var futuregrapher = require('futuregrapher/core');
    futuregrapher.TypeChecker = require('futuregrapher/typechecker');

    futuregrapher.SvgRenderer = require('futuregrapher/svgrenderer');
    futuregrapher.GraphVis = require('futuregrapher/graphvis');

    futuregrapher.VisNode = require('futuregrapher/visnode');
    futuregrapher.VisLink = require('futuregrapher/vislink');
    futuregrapher.VisCluster = require('futuregrapher/viscluster');

    futuregrapher.NodeCircle = require('futuregrapher/nodecircle');
    futuregrapher.LabelText = require('futuregrapher/labeltext');
    futuregrapher.LinkLine = require('futuregrapher/linkline');
    futuregrapher.ClusterHull = require('futuregrapher/clusterhull');
    
    futuregrapher.autoZoomer = require('futuregrapher/autozoomer');
    futuregrapher.autoRadiusScale = require('futuregrapher/autoradiusscale');
    futuregrapher.gradientScale = require('futuregrapher/gradientscale');
    
    return futuregrapher;
});

  var library = require('futuregrapher');
  if(typeof module !== 'undefined' && module.exports) {
    module.exports = library;
  } else if(globalDefine) {
    (function (define) {
      define(function () { return library; });
    }(globalDefine));
  } else if(typeof Meteor !== 'undefined') {
    futuregrapher = library;
  } else {
    global['futuregrapher'] = library;
  }
}(this));
