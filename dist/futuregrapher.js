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
    //[of]:    function normalize(name, baseName) {
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
    //[cf]

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
    //[of]:    function splitPrefix(name) {
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }
    //[cf]

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
        VERSION: '0.9.1'
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
/*****
 *
 *   The contents of this file were written by Kevin Lindsey
 *   copyright 2002 Kevin Lindsey
 *
 *   This file was compacted by jscompact
 *   A Perl utility written by Kevin Lindsey (kevin@kevlindev.com)
 *
 *****/

Array.prototype.foreach=function(func){for(var i=0;i<this.length;i++)func(this[i]);};
Array.prototype.map=function(func){var result=new Array();for(var i=0;i<this.length;i++)result.push(func(this[i]));return result;};
Array.prototype.min=function(){var min=this[0];for(var i=0;i<this.length;i++)if(this[i]<min)min=this[i];return min;}
Array.prototype.max=function(){var max=this[0];for(var i=0;i<this.length;i++)if(this[i]>max)max=this[i];return max;}
AntiZoomAndPan.VERSION="1.2"
function AntiZoomAndPan(){this.init();}
AntiZoomAndPan.prototype.init=function(){var svgRoot=svgDocument.documentElement;this.svgNodes=new Array();this.x_trans=0;this.y_trans=0;this.scale=1;this.lastTM=svgRoot.createSVGMatrix();svgRoot.addEventListener('SVGZoom',this,false);svgRoot.addEventListener('SVGScroll',this,false);svgRoot.addEventListener('SVGResize',this,false);};
AntiZoomAndPan.prototype.appendNode=function(svgNode){this.svgNodes.push(svgNode);};
AntiZoomAndPan.prototype.removeNode=function(svgNode){for(var i=0;i<this.svgNodes.length;i++){if(this.svgNodes[i]===svgNode){this.svgNodes.splice(i,1);break;}}};
AntiZoomAndPan.prototype.handleEvent=function(e){var type=e.type;if(this[type]==null)throw new Error("Unsupported event type: "+type);this[type](e);};
AntiZoomAndPan.prototype.SVGZoom=function(e){this.update();};
AntiZoomAndPan.prototype.SVGScroll=function(e){this.update();};
AntiZoomAndPan.prototype.SVGResize=function(e){this.update();};
AntiZoomAndPan.prototype.update=function(){if(this.svgNodes.length>0){var svgRoot=svgDocument.documentElement;var viewbox=(window.ViewBox!=null)?new ViewBox(svgRoot):null;var matrix=(viewbox!=null)?viewbox.getTM():svgRoot.createSVGMatrix();var trans=svgRoot.currentTranslate;matrix=matrix.scale(1.0/svgRoot.currentScale);matrix=matrix.translate(-trans.x,-trans.y);for(var i=0;i<this.svgNodes.length;i++){var node=this.svgNodes[i];var CTM=matrix.multiply(this.lastTM.multiply(node.getCTM()));var transform="matrix("+[CTM.a,CTM.b,CTM.c,CTM.d,CTM.e,CTM.f].join(",")+")";this.svgNodes[i].setAttributeNS(null,"transform",transform);}this.lastTM=matrix.inverse();}};
EventHandler.VERSION=1.0;
function EventHandler(){this.init();};
EventHandler.prototype.init=function(){};
EventHandler.prototype.handleEvent=function(e){if(this[e.type]==null)throw new Error("Unsupported event type: "+e.type);this[e.type](e);};var svgns="http://www.w3.org/2000/svg";
Mouser.prototype=new EventHandler();
Mouser.prototype.constructor=Mouser;
Mouser.superclass=EventHandler.prototype;
function Mouser(){this.init();}
Mouser.prototype.init=function(){this.svgNode=null;this.handles=new Array();this.shapes=new Array();this.lastPoint=null;this.currentNode=null;this.realize();};
Mouser.prototype.realize=function(){if(this.svgNode==null){var rect=svgDocument.createElementNS(svgns,"rect");this.svgNode=rect;rect.setAttributeNS(null,"x","-32767");rect.setAttributeNS(null,"y","-32767");rect.setAttributeNS(null,"width","65535");rect.setAttributeNS(null,"height","65535");rect.setAttributeNS(null,"fill","none");rect.setAttributeNS(null,"pointer-events","all");rect.setAttributeNS(null,"display","none");svgDocument.documentElement.appendChild(rect);}};
Mouser.prototype.register=function(handle){if(this.handleIndex(handle)==-1){var owner=handle.owner;handle.select(true);this.handles.push(handle);if(owner!=null&&this.shapeIndex(owner)==-1)this.shapes.push(owner);}};
Mouser.prototype.unregister=function(handle){var index=this.handleIndex(handle);if(index!=-1){handle.select(false);this.handles.splice(index,1);}};
Mouser.prototype.registerShape=function(shape){if(this.shapeIndex(shape)==-1){shape.select(true);this.shapes.push(shape);}};
Mouser.prototype.unregisterShape=function(shape){var index=this.shapeIndex(shape);if(index!=-1){shape.select(false);shape.selectHandles(false);shape.showHandles(false);shape.unregisterHandles();this.shapes.splice(index,1);}};
Mouser.prototype.unregisterAll=function(){for(var i=0;i<this.handles.length;i++){this.handles[i].select(false);}this.handles=new Array();};
Mouser.prototype.unregisterShapes=function(){for(var i=0;i<this.shapes.length;i++){var shape=this.shapes[i];shape.select(false);shape.selectHandles(false);shape.showHandles(false);shape.unregisterHandles();}this.shapes=new Array();};
Mouser.prototype.handleIndex=function(handle){var result=-1;for(var i=0;i<this.handles.length;i++){if(this.handles[i]===handle){result=i;break;}}return result;};
Mouser.prototype.shapeIndex=function(shape){var result=-1;for(var i=0;i<this.shapes.length;i++){if(this.shapes[i]===shape){result=i;break;}}return result;};
Mouser.prototype.beginDrag=function(e){this.currentNode=e.target;var svgPoint=this.getUserCoordinate(this.currentNode,e.clientX,e.clientY);this.lastPoint=new Point2D(svgPoint.x,svgPoint.y);this.svgNode.addEventListener("mouseup",this,false);this.svgNode.addEventListener("mousemove",this,false);svgDocument.documentElement.appendChild(this.svgNode);this.svgNode.setAttributeNS(null,"display","inline");};
Mouser.prototype.mouseup=function(e){this.lastPoint=null;this.currentNode=null;this.svgNode.removeEventListener("mouseup",this,false);this.svgNode.removeEventListener("mousemove",this,false);this.svgNode.setAttributeNS(null,"display","none");};
Mouser.prototype.mousemove=function(e){var svgPoint=this.getUserCoordinate(this.currentNode,e.clientX,e.clientY);var newPoint=new Point2D(svgPoint.x,svgPoint.y);var delta=newPoint.subtract(this.lastPoint);var updates=new Array();var updateId=new Date().getTime();this.lastPoint.setFromPoint(newPoint);for(var i=0;i<this.handles.length;i++){var handle=this.handles[i];var owner=handle.owner;handle.translate(delta);if(owner!=null){if(owner.lastUpdate!=updateId){owner.lastUpdate=updateId;updates.push(owner);}}else{updates.push(handle);}}for(var i=0;i<updates.length;i++){updates[i].update();}};
Mouser.prototype.getUserCoordinate=function(node,x,y){var svgRoot=svgDocument.documentElement;var pan=svgRoot.getCurrentTranslate();var zoom=svgRoot.getCurrentScale();var CTM=this.getTransformToElement(node);var iCTM=CTM.inverse();var worldPoint=svgDocument.documentElement.createSVGPoint();worldPoint.x=(x-pan.x)/zoom;worldPoint.y=(y-pan.y)/zoom;return worldPoint.matrixTransform(iCTM);};
Mouser.prototype.getTransformToElement=function(node){var CTM=node.getCTM();while((node=node.parentNode)!=svgDocument){CTM=node.getCTM().multiply(CTM);}return CTM;};
ViewBox.VERSION="1.0";
function ViewBox(svgNode){if(arguments.length>0){this.init(svgNode);}}
ViewBox.prototype.init=function(svgNode){var viewBox=svgNode.getAttributeNS(null,"viewBox");var preserveAspectRatio=svgNode.getAttributeNS(null,"preserveAspectRatio");if(viewBox!=""){var params=viewBox.split(/\s*,\s*|\s+/);this.x=parseFloat(params[0]);this.y=parseFloat(params[1]);this.width=parseFloat(params[2]);this.height=parseFloat(params[3]);}else{this.x=0;this.y=0;this.width=innerWidth;this.height=innerHeight;}this.setPAR(preserveAspectRatio);};
ViewBox.prototype.getTM=function(){var svgRoot=svgDocument.documentElement;var matrix=svgDocument.documentElement.createSVGMatrix();var windowWidth=svgRoot.getAttributeNS(null,"width");var windowHeight=svgRoot.getAttributeNS(null,"height");windowWidth=(windowWidth!="")?parseFloat(windowWidth):innerWidth;windowHeight=(windowHeight!="")?parseFloat(windowHeight):innerHeight;var x_ratio=this.width/windowWidth;var y_ratio=this.height/windowHeight;matrix=matrix.translate(this.x,this.y);if(this.alignX=="none"){matrix=matrix.scaleNonUniform(x_ratio,y_ratio);}else{if(x_ratio<y_ratio&&this.meetOrSlice=="meet"||x_ratio>y_ratio&&this.meetOrSlice=="slice"){var x_trans=0;var x_diff=windowWidth*y_ratio-this.width;if(this.alignX=="Mid")x_trans=-x_diff/2;else if(this.alignX=="Max")x_trans=-x_diff;matrix=matrix.translate(x_trans,0);matrix=matrix.scale(y_ratio);}else if(x_ratio>y_ratio&&this.meetOrSlice=="meet"||x_ratio<y_ratio&&this.meetOrSlice=="slice"){var y_trans=0;var y_diff=windowHeight*x_ratio-this.height;if(this.alignY=="Mid")y_trans=-y_diff/2;else if(this.alignY=="Max")y_trans=-y_diff;matrix=matrix.translate(0,y_trans);matrix=matrix.scale(x_ratio);}else{matrix=matrix.scale(x_ratio);}}return matrix;}
ViewBox.prototype.setPAR=function(PAR){if(PAR){var params=PAR.split(/\s+/);var align=params[0];if(align=="none"){this.alignX="none";this.alignY="none";}else{this.alignX=align.substring(1,4);this.alignY=align.substring(5,9);}if(params.length==2){this.meetOrSlice=params[1];}else{this.meetOrSlice="meet";}}else{this.align="xMidYMid";this.alignX="Mid";this.alignY="Mid";this.meetOrSlice="meet";}};
function Intersection(status){if(arguments.length>0){this.init(status);}}
Intersection.prototype.init=function(status){this.status=status;this.points=new Array();};
Intersection.prototype.appendPoint=function(point){this.points.push(point);};
Intersection.prototype.appendPoints=function(points){this.points=this.points.concat(points);};
Intersection.intersectShapes=function(shape1,shape2){var ip1=shape1.getIntersectionParams();var ip2=shape2.getIntersectionParams();var result;if(ip1!=null&&ip2!=null){if(ip1.name=="Path"){result=Intersection.intersectPathShape(shape1,shape2);}else if(ip2.name=="Path"){result=Intersection.intersectPathShape(shape2,shape1);}else{var method;var params;if(ip1.name<ip2.name){method="intersect"+ip1.name+ip2.name;params=ip1.params.concat(ip2.params);}else{method="intersect"+ip2.name+ip1.name;params=ip2.params.concat(ip1.params);}if(!(method in Intersection))throw new Error("Intersection not available: "+method);result=Intersection[method].apply(null,params);}}else{result=new Intersection("No Intersection");}return result;};
Intersection.intersectPathShape=function(path,shape){return path.intersectShape(shape);};
Intersection.intersectBezier2Bezier2=function(a1,a2,a3,b1,b2,b3){var a,b;var c12,c11,c10;var c22,c21,c20;var TOLERANCE=1e-4;var result=new Intersection("No Intersection");a=a2.multiply(-2);c12=a1.add(a.add(a3));a=a1.multiply(-2);b=a2.multiply(2);c11=a.add(b);c10=new Point2D(a1.x,a1.y);a=b2.multiply(-2);c22=b1.add(a.add(b3));a=b1.multiply(-2);b=b2.multiply(2);c21=a.add(b);c20=new Point2D(b1.x,b1.y);var a=c12.x*c11.y-c11.x*c12.y;var b=c22.x*c11.y-c11.x*c22.y;var c=c21.x*c11.y-c11.x*c21.y;var d=c11.x*(c10.y-c20.y)+c11.y*(-c10.x+c20.x);var e=c22.x*c12.y-c12.x*c22.y;var f=c21.x*c12.y-c12.x*c21.y;var g=c12.x*(c10.y-c20.y)+c12.y*(-c10.x+c20.x);var poly=new Polynomial(-e*e,-2*e*f,a*b-f*f-2*e*g,a*c-2*f*g,a*d-g*g);var roots=poly.getRoots();for(var i=0;i<roots.length;i++){var s=roots[i];if(0<=s&&s<=1){var xRoots=new Polynomial(-c12.x,-c11.x,-c10.x+c20.x+s*c21.x+s*s*c22.x).getRoots();var yRoots=new Polynomial(-c12.y,-c11.y,-c10.y+c20.y+s*c21.y+s*s*c22.y).getRoots();if(xRoots.length>0&&yRoots.length>0){checkRoots:for(var j=0;j<xRoots.length;j++){var xRoot=xRoots[j];if(0<=xRoot&&xRoot<=1){for(var k=0;k<yRoots.length;k++){if(Math.abs(xRoot-yRoots[k])<TOLERANCE){result.points.push(c22.multiply(s*s).add(c21.multiply(s).add(c20)));break checkRoots;}}}}}}}return result;};
Intersection.intersectBezier2Bezier3=function(a1,a2,a3,b1,b2,b3,b4){var a,b,c,d;var c12,c11,c10;var c23,c22,c21,c20;var result=new Intersection("No Intersection");a=a2.multiply(-2);c12=a1.add(a.add(a3));a=a1.multiply(-2);b=a2.multiply(2);c11=a.add(b);c10=new Point2D(a1.x,a1.y);a=b1.multiply(-1);b=b2.multiply(3);c=b3.multiply(-3);d=a.add(b.add(c.add(b4)));c23=new Vector2D(d.x,d.y);a=b1.multiply(3);b=b2.multiply(-6);c=b3.multiply(3);d=a.add(b.add(c));c22=new Vector2D(d.x,d.y);a=b1.multiply(-3);b=b2.multiply(3);c=a.add(b);c21=new Vector2D(c.x,c.y);c20=new Vector2D(b1.x,b1.y);var c10x2=c10.x*c10.x;var c10y2=c10.y*c10.y;var c11x2=c11.x*c11.x;var c11y2=c11.y*c11.y;var c12x2=c12.x*c12.x;var c12y2=c12.y*c12.y;var c20x2=c20.x*c20.x;var c20y2=c20.y*c20.y;var c21x2=c21.x*c21.x;var c21y2=c21.y*c21.y;var c22x2=c22.x*c22.x;var c22y2=c22.y*c22.y;var c23x2=c23.x*c23.x;var c23y2=c23.y*c23.y;var poly=new Polynomial(-2*c12.x*c12.y*c23.x*c23.y+c12x2*c23y2+c12y2*c23x2,-2*c12.x*c12.y*c22.x*c23.y-2*c12.x*c12.y*c22.y*c23.x+2*c12y2*c22.x*c23.x+2*c12x2*c22.y*c23.y,-2*c12.x*c21.x*c12.y*c23.y-2*c12.x*c12.y*c21.y*c23.x-2*c12.x*c12.y*c22.x*c22.y+2*c21.x*c12y2*c23.x+c12y2*c22x2+c12x2*(2*c21.y*c23.y+c22y2),2*c10.x*c12.x*c12.y*c23.y+2*c10.y*c12.x*c12.y*c23.x+c11.x*c11.y*c12.x*c23.y+c11.x*c11.y*c12.y*c23.x-2*c20.x*c12.x*c12.y*c23.y-2*c12.x*c20.y*c12.y*c23.x-2*c12.x*c21.x*c12.y*c22.y-2*c12.x*c12.y*c21.y*c22.x-2*c10.x*c12y2*c23.x-2*c10.y*c12x2*c23.y+2*c20.x*c12y2*c23.x+2*c21.x*c12y2*c22.x-c11y2*c12.x*c23.x-c11x2*c12.y*c23.y+c12x2*(2*c20.y*c23.y+2*c21.y*c22.y),2*c10.x*c12.x*c12.y*c22.y+2*c10.y*c12.x*c12.y*c22.x+c11.x*c11.y*c12.x*c22.y+c11.x*c11.y*c12.y*c22.x-2*c20.x*c12.x*c12.y*c22.y-2*c12.x*c20.y*c12.y*c22.x-2*c12.x*c21.x*c12.y*c21.y-2*c10.x*c12y2*c22.x-2*c10.y*c12x2*c22.y+2*c20.x*c12y2*c22.x-c11y2*c12.x*c22.x-c11x2*c12.y*c22.y+c21x2*c12y2+c12x2*(2*c20.y*c22.y+c21y2),2*c10.x*c12.x*c12.y*c21.y+2*c10.y*c12.x*c21.x*c12.y+c11.x*c11.y*c12.x*c21.y+c11.x*c11.y*c21.x*c12.y-2*c20.x*c12.x*c12.y*c21.y-2*c12.x*c20.y*c21.x*c12.y-2*c10.x*c21.x*c12y2-2*c10.y*c12x2*c21.y+2*c20.x*c21.x*c12y2-c11y2*c12.x*c21.x-c11x2*c12.y*c21.y+2*c12x2*c20.y*c21.y,-2*c10.x*c10.y*c12.x*c12.y-c10.x*c11.x*c11.y*c12.y-c10.y*c11.x*c11.y*c12.x+2*c10.x*c12.x*c20.y*c12.y+2*c10.y*c20.x*c12.x*c12.y+c11.x*c20.x*c11.y*c12.y+c11.x*c11.y*c12.x*c20.y-2*c20.x*c12.x*c20.y*c12.y-2*c10.x*c20.x*c12y2+c10.x*c11y2*c12.x+c10.y*c11x2*c12.y-2*c10.y*c12x2*c20.y-c20.x*c11y2*c12.x-c11x2*c20.y*c12.y+c10x2*c12y2+c10y2*c12x2+c20x2*c12y2+c12x2*c20y2);var roots=poly.getRootsInInterval(0,1);for(var i=0;i<roots.length;i++){var s=roots[i];var xRoots=new Polynomial(c12.x,c11.x,c10.x-c20.x-s*c21.x-s*s*c22.x-s*s*s*c23.x).getRoots();var yRoots=new Polynomial(c12.y,c11.y,c10.y-c20.y-s*c21.y-s*s*c22.y-s*s*s*c23.y).getRoots();if(xRoots.length>0&&yRoots.length>0){var TOLERANCE=1e-4;checkRoots:for(var j=0;j<xRoots.length;j++){var xRoot=xRoots[j];if(0<=xRoot&&xRoot<=1){for(var k=0;k<yRoots.length;k++){if(Math.abs(xRoot-yRoots[k])<TOLERANCE){result.points.push(c23.multiply(s*s*s).add(c22.multiply(s*s).add(c21.multiply(s).add(c20))));break checkRoots;}}}}}}if(result.points.length>0)result.status="Intersection";return result;};
Intersection.intersectBezier2Circle=function(p1,p2,p3,c,r){return Intersection.intersectBezier2Ellipse(p1,p2,p3,c,r,r);};
Intersection.intersectBezier2Ellipse=function(p1,p2,p3,ec,rx,ry){var a,b;var c2,c1,c0;var result=new Intersection("No Intersection");a=p2.multiply(-2);c2=p1.add(a.add(p3));a=p1.multiply(-2);b=p2.multiply(2);c1=a.add(b);c0=new Point2D(p1.x,p1.y);var rxrx=rx*rx;var ryry=ry*ry;var roots=new Polynomial(ryry*c2.x*c2.x+rxrx*c2.y*c2.y,2*(ryry*c2.x*c1.x+rxrx*c2.y*c1.y),ryry*(2*c2.x*c0.x+c1.x*c1.x)+rxrx*(2*c2.y*c0.y+c1.y*c1.y)-2*(ryry*ec.x*c2.x+rxrx*ec.y*c2.y),2*(ryry*c1.x*(c0.x-ec.x)+rxrx*c1.y*(c0.y-ec.y)),ryry*(c0.x*c0.x+ec.x*ec.x)+rxrx*(c0.y*c0.y+ec.y*ec.y)-2*(ryry*ec.x*c0.x+rxrx*ec.y*c0.y)-rxrx*ryry).getRoots();for(var i=0;i<roots.length;i++){var t=roots[i];if(0<=t&&t<=1)result.points.push(c2.multiply(t*t).add(c1.multiply(t).add(c0)));}if(result.points.length>0)result.status="Intersection";return result;};
Intersection.intersectBezier2Line=function(p1,p2,p3,a1,a2){var a,b;var c2,c1,c0;var cl;var n;var min=a1.min(a2);var max=a1.max(a2);var result=new Intersection("No Intersection");a=p2.multiply(-2);c2=p1.add(a.add(p3));a=p1.multiply(-2);b=p2.multiply(2);c1=a.add(b);c0=new Point2D(p1.x,p1.y);n=new Vector2D(a1.y-a2.y,a2.x-a1.x);cl=a1.x*a2.y-a2.x*a1.y;roots=new Polynomial(n.dot(c2),n.dot(c1),n.dot(c0)+cl).getRoots();for(var i=0;i<roots.length;i++){var t=roots[i];if(0<=t&&t<=1){var p4=p1.lerp(p2,t);var p5=p2.lerp(p3,t);var p6=p4.lerp(p5,t);if(a1.x==a2.x){if(min.y<=p6.y&&p6.y<=max.y){result.status="Intersection";result.appendPoint(p6);}}else if(a1.y==a2.y){if(min.x<=p6.x&&p6.x<=max.x){result.status="Intersection";result.appendPoint(p6);}}else if(p6.gte(min)&&p6.lte(max)){result.status="Intersection";result.appendPoint(p6);}}}return result;};
Intersection.intersectBezier2Polygon=function(p1,p2,p3,points){var result=new Intersection("No Intersection");var length=points.length;for(var i=0;i<length;i++){var a1=points[i];var a2=points[(i+1)%length];var inter=Intersection.intersectBezier2Line(p1,p2,p3,a1,a2);result.appendPoints(inter.points);}if(result.points.length>0)result.status="Intersection";return result;};
Intersection.intersectBezier2Rectangle=function(p1,p2,p3,r1,r2){var min=r1.min(r2);var max=r1.max(r2);var topRight=new Point2D(max.x,min.y);var bottomLeft=new Point2D(min.x,max.y);var inter1=Intersection.intersectBezier2Line(p1,p2,p3,min,topRight);var inter2=Intersection.intersectBezier2Line(p1,p2,p3,topRight,max);var inter3=Intersection.intersectBezier2Line(p1,p2,p3,max,bottomLeft);var inter4=Intersection.intersectBezier2Line(p1,p2,p3,bottomLeft,min);var result=new Intersection("No Intersection");result.appendPoints(inter1.points);result.appendPoints(inter2.points);result.appendPoints(inter3.points);result.appendPoints(inter4.points);if(result.points.length>0)result.status="Intersection";return result;};
Intersection.intersectBezier3Bezier3=function(a1,a2,a3,a4,b1,b2,b3,b4){var a,b,c,d;var c13,c12,c11,c10;var c23,c22,c21,c20;var result=new Intersection("No Intersection");a=a1.multiply(-1);b=a2.multiply(3);c=a3.multiply(-3);d=a.add(b.add(c.add(a4)));c13=new Vector2D(d.x,d.y);a=a1.multiply(3);b=a2.multiply(-6);c=a3.multiply(3);d=a.add(b.add(c));c12=new Vector2D(d.x,d.y);a=a1.multiply(-3);b=a2.multiply(3);c=a.add(b);c11=new Vector2D(c.x,c.y);c10=new Vector2D(a1.x,a1.y);a=b1.multiply(-1);b=b2.multiply(3);c=b3.multiply(-3);d=a.add(b.add(c.add(b4)));c23=new Vector2D(d.x,d.y);a=b1.multiply(3);b=b2.multiply(-6);c=b3.multiply(3);d=a.add(b.add(c));c22=new Vector2D(d.x,d.y);a=b1.multiply(-3);b=b2.multiply(3);c=a.add(b);c21=new Vector2D(c.x,c.y);c20=new Vector2D(b1.x,b1.y);var c10x2=c10.x*c10.x;var c10x3=c10.x*c10.x*c10.x;var c10y2=c10.y*c10.y;var c10y3=c10.y*c10.y*c10.y;var c11x2=c11.x*c11.x;var c11x3=c11.x*c11.x*c11.x;var c11y2=c11.y*c11.y;var c11y3=c11.y*c11.y*c11.y;var c12x2=c12.x*c12.x;var c12x3=c12.x*c12.x*c12.x;var c12y2=c12.y*c12.y;var c12y3=c12.y*c12.y*c12.y;var c13x2=c13.x*c13.x;var c13x3=c13.x*c13.x*c13.x;var c13y2=c13.y*c13.y;var c13y3=c13.y*c13.y*c13.y;var c20x2=c20.x*c20.x;var c20x3=c20.x*c20.x*c20.x;var c20y2=c20.y*c20.y;var c20y3=c20.y*c20.y*c20.y;var c21x2=c21.x*c21.x;var c21x3=c21.x*c21.x*c21.x;var c21y2=c21.y*c21.y;var c22x2=c22.x*c22.x;var c22x3=c22.x*c22.x*c22.x;var c22y2=c22.y*c22.y;var c23x2=c23.x*c23.x;var c23x3=c23.x*c23.x*c23.x;var c23y2=c23.y*c23.y;var c23y3=c23.y*c23.y*c23.y;var poly=new Polynomial(-c13x3*c23y3+c13y3*c23x3-3*c13.x*c13y2*c23x2*c23.y+3*c13x2*c13.y*c23.x*c23y2,-6*c13.x*c22.x*c13y2*c23.x*c23.y+6*c13x2*c13.y*c22.y*c23.x*c23.y+3*c22.x*c13y3*c23x2-3*c13x3*c22.y*c23y2-3*c13.x*c13y2*c22.y*c23x2+3*c13x2*c22.x*c13.y*c23y2,-6*c21.x*c13.x*c13y2*c23.x*c23.y-6*c13.x*c22.x*c13y2*c22.y*c23.x+6*c13x2*c22.x*c13.y*c22.y*c23.y+3*c21.x*c13y3*c23x2+3*c22x2*c13y3*c23.x+3*c21.x*c13x2*c13.y*c23y2-3*c13.x*c21.y*c13y2*c23x2-3*c13.x*c22x2*c13y2*c23.y+c13x2*c13.y*c23.x*(6*c21.y*c23.y+3*c22y2)+c13x3*(-c21.y*c23y2-2*c22y2*c23.y-c23.y*(2*c21.y*c23.y+c22y2)),c11.x*c12.y*c13.x*c13.y*c23.x*c23.y-c11.y*c12.x*c13.x*c13.y*c23.x*c23.y+6*c21.x*c22.x*c13y3*c23.x+3*c11.x*c12.x*c13.x*c13.y*c23y2+6*c10.x*c13.x*c13y2*c23.x*c23.y-3*c11.x*c12.x*c13y2*c23.x*c23.y-3*c11.y*c12.y*c13.x*c13.y*c23x2-6*c10.y*c13x2*c13.y*c23.x*c23.y-6*c20.x*c13.x*c13y2*c23.x*c23.y+3*c11.y*c12.y*c13x2*c23.x*c23.y-2*c12.x*c12y2*c13.x*c23.x*c23.y-6*c21.x*c13.x*c22.x*c13y2*c23.y-6*c21.x*c13.x*c13y2*c22.y*c23.x-6*c13.x*c21.y*c22.x*c13y2*c23.x+6*c21.x*c13x2*c13.y*c22.y*c23.y+2*c12x2*c12.y*c13.y*c23.x*c23.y+c22x3*c13y3-3*c10.x*c13y3*c23x2+3*c10.y*c13x3*c23y2+3*c20.x*c13y3*c23x2+c12y3*c13.x*c23x2-c12x3*c13.y*c23y2-3*c10.x*c13x2*c13.y*c23y2+3*c10.y*c13.x*c13y2*c23x2-2*c11.x*c12.y*c13x2*c23y2+c11.x*c12.y*c13y2*c23x2-c11.y*c12.x*c13x2*c23y2+2*c11.y*c12.x*c13y2*c23x2+3*c20.x*c13x2*c13.y*c23y2-c12.x*c12y2*c13.y*c23x2-3*c20.y*c13.x*c13y2*c23x2+c12x2*c12.y*c13.x*c23y2-3*c13.x*c22x2*c13y2*c22.y+c13x2*c13.y*c23.x*(6*c20.y*c23.y+6*c21.y*c22.y)+c13x2*c22.x*c13.y*(6*c21.y*c23.y+3*c22y2)+c13x3*(-2*c21.y*c22.y*c23.y-c20.y*c23y2-c22.y*(2*c21.y*c23.y+c22y2)-c23.y*(2*c20.y*c23.y+2*c21.y*c22.y)),6*c11.x*c12.x*c13.x*c13.y*c22.y*c23.y+c11.x*c12.y*c13.x*c22.x*c13.y*c23.y+c11.x*c12.y*c13.x*c13.y*c22.y*c23.x-c11.y*c12.x*c13.x*c22.x*c13.y*c23.y-c11.y*c12.x*c13.x*c13.y*c22.y*c23.x-6*c11.y*c12.y*c13.x*c22.x*c13.y*c23.x-6*c10.x*c22.x*c13y3*c23.x+6*c20.x*c22.x*c13y3*c23.x+6*c10.y*c13x3*c22.y*c23.y+2*c12y3*c13.x*c22.x*c23.x-2*c12x3*c13.y*c22.y*c23.y+6*c10.x*c13.x*c22.x*c13y2*c23.y+6*c10.x*c13.x*c13y2*c22.y*c23.x+6*c10.y*c13.x*c22.x*c13y2*c23.x-3*c11.x*c12.x*c22.x*c13y2*c23.y-3*c11.x*c12.x*c13y2*c22.y*c23.x+2*c11.x*c12.y*c22.x*c13y2*c23.x+4*c11.y*c12.x*c22.x*c13y2*c23.x-6*c10.x*c13x2*c13.y*c22.y*c23.y-6*c10.y*c13x2*c22.x*c13.y*c23.y-6*c10.y*c13x2*c13.y*c22.y*c23.x-4*c11.x*c12.y*c13x2*c22.y*c23.y-6*c20.x*c13.x*c22.x*c13y2*c23.y-6*c20.x*c13.x*c13y2*c22.y*c23.x-2*c11.y*c12.x*c13x2*c22.y*c23.y+3*c11.y*c12.y*c13x2*c22.x*c23.y+3*c11.y*c12.y*c13x2*c22.y*c23.x-2*c12.x*c12y2*c13.x*c22.x*c23.y-2*c12.x*c12y2*c13.x*c22.y*c23.x-2*c12.x*c12y2*c22.x*c13.y*c23.x-6*c20.y*c13.x*c22.x*c13y2*c23.x-6*c21.x*c13.x*c21.y*c13y2*c23.x-6*c21.x*c13.x*c22.x*c13y2*c22.y+6*c20.x*c13x2*c13.y*c22.y*c23.y+2*c12x2*c12.y*c13.x*c22.y*c23.y+2*c12x2*c12.y*c22.x*c13.y*c23.y+2*c12x2*c12.y*c13.y*c22.y*c23.x+3*c21.x*c22x2*c13y3+3*c21x2*c13y3*c23.x-3*c13.x*c21.y*c22x2*c13y2-3*c21x2*c13.x*c13y2*c23.y+c13x2*c22.x*c13.y*(6*c20.y*c23.y+6*c21.y*c22.y)+c13x2*c13.y*c23.x*(6*c20.y*c22.y+3*c21y2)+c21.x*c13x2*c13.y*(6*c21.y*c23.y+3*c22y2)+c13x3*(-2*c20.y*c22.y*c23.y-c23.y*(2*c20.y*c22.y+c21y2)-c21.y*(2*c21.y*c23.y+c22y2)-c22.y*(2*c20.y*c23.y+2*c21.y*c22.y)),c11.x*c21.x*c12.y*c13.x*c13.y*c23.y+c11.x*c12.y*c13.x*c21.y*c13.y*c23.x+c11.x*c12.y*c13.x*c22.x*c13.y*c22.y-c11.y*c12.x*c21.x*c13.x*c13.y*c23.y-c11.y*c12.x*c13.x*c21.y*c13.y*c23.x-c11.y*c12.x*c13.x*c22.x*c13.y*c22.y-6*c11.y*c21.x*c12.y*c13.x*c13.y*c23.x-6*c10.x*c21.x*c13y3*c23.x+6*c20.x*c21.x*c13y3*c23.x+2*c21.x*c12y3*c13.x*c23.x+6*c10.x*c21.x*c13.x*c13y2*c23.y+6*c10.x*c13.x*c21.y*c13y2*c23.x+6*c10.x*c13.x*c22.x*c13y2*c22.y+6*c10.y*c21.x*c13.x*c13y2*c23.x-3*c11.x*c12.x*c21.x*c13y2*c23.y-3*c11.x*c12.x*c21.y*c13y2*c23.x-3*c11.x*c12.x*c22.x*c13y2*c22.y+2*c11.x*c21.x*c12.y*c13y2*c23.x+4*c11.y*c12.x*c21.x*c13y2*c23.x-6*c10.y*c21.x*c13x2*c13.y*c23.y-6*c10.y*c13x2*c21.y*c13.y*c23.x-6*c10.y*c13x2*c22.x*c13.y*c22.y-6*c20.x*c21.x*c13.x*c13y2*c23.y-6*c20.x*c13.x*c21.y*c13y2*c23.x-6*c20.x*c13.x*c22.x*c13y2*c22.y+3*c11.y*c21.x*c12.y*c13x2*c23.y-3*c11.y*c12.y*c13.x*c22x2*c13.y+3*c11.y*c12.y*c13x2*c21.y*c23.x+3*c11.y*c12.y*c13x2*c22.x*c22.y-2*c12.x*c21.x*c12y2*c13.x*c23.y-2*c12.x*c21.x*c12y2*c13.y*c23.x-2*c12.x*c12y2*c13.x*c21.y*c23.x-2*c12.x*c12y2*c13.x*c22.x*c22.y-6*c20.y*c21.x*c13.x*c13y2*c23.x-6*c21.x*c13.x*c21.y*c22.x*c13y2+6*c20.y*c13x2*c21.y*c13.y*c23.x+2*c12x2*c21.x*c12.y*c13.y*c23.y+2*c12x2*c12.y*c21.y*c13.y*c23.x+2*c12x2*c12.y*c22.x*c13.y*c22.y-3*c10.x*c22x2*c13y3+3*c20.x*c22x2*c13y3+3*c21x2*c22.x*c13y3+c12y3*c13.x*c22x2+3*c10.y*c13.x*c22x2*c13y2+c11.x*c12.y*c22x2*c13y2+2*c11.y*c12.x*c22x2*c13y2-c12.x*c12y2*c22x2*c13.y-3*c20.y*c13.x*c22x2*c13y2-3*c21x2*c13.x*c13y2*c22.y+c12x2*c12.y*c13.x*(2*c21.y*c23.y+c22y2)+c11.x*c12.x*c13.x*c13.y*(6*c21.y*c23.y+3*c22y2)+c21.x*c13x2*c13.y*(6*c20.y*c23.y+6*c21.y*c22.y)+c12x3*c13.y*(-2*c21.y*c23.y-c22y2)+c10.y*c13x3*(6*c21.y*c23.y+3*c22y2)+c11.y*c12.x*c13x2*(-2*c21.y*c23.y-c22y2)+c11.x*c12.y*c13x2*(-4*c21.y*c23.y-2*c22y2)+c10.x*c13x2*c13.y*(-6*c21.y*c23.y-3*c22y2)+c13x2*c22.x*c13.y*(6*c20.y*c22.y+3*c21y2)+c20.x*c13x2*c13.y*(6*c21.y*c23.y+3*c22y2)+c13x3*(-2*c20.y*c21.y*c23.y-c22.y*(2*c20.y*c22.y+c21y2)-c20.y*(2*c21.y*c23.y+c22y2)-c21.y*(2*c20.y*c23.y+2*c21.y*c22.y)),-c10.x*c11.x*c12.y*c13.x*c13.y*c23.y+c10.x*c11.y*c12.x*c13.x*c13.y*c23.y+6*c10.x*c11.y*c12.y*c13.x*c13.y*c23.x-6*c10.y*c11.x*c12.x*c13.x*c13.y*c23.y-c10.y*c11.x*c12.y*c13.x*c13.y*c23.x+c10.y*c11.y*c12.x*c13.x*c13.y*c23.x+c11.x*c11.y*c12.x*c12.y*c13.x*c23.y-c11.x*c11.y*c12.x*c12.y*c13.y*c23.x+c11.x*c20.x*c12.y*c13.x*c13.y*c23.y+c11.x*c20.y*c12.y*c13.x*c13.y*c23.x+c11.x*c21.x*c12.y*c13.x*c13.y*c22.y+c11.x*c12.y*c13.x*c21.y*c22.x*c13.y-c20.x*c11.y*c12.x*c13.x*c13.y*c23.y-6*c20.x*c11.y*c12.y*c13.x*c13.y*c23.x-c11.y*c12.x*c20.y*c13.x*c13.y*c23.x-c11.y*c12.x*c21.x*c13.x*c13.y*c22.y-c11.y*c12.x*c13.x*c21.y*c22.x*c13.y-6*c11.y*c21.x*c12.y*c13.x*c22.x*c13.y-6*c10.x*c20.x*c13y3*c23.x-6*c10.x*c21.x*c22.x*c13y3-2*c10.x*c12y3*c13.x*c23.x+6*c20.x*c21.x*c22.x*c13y3+2*c20.x*c12y3*c13.x*c23.x+2*c21.x*c12y3*c13.x*c22.x+2*c10.y*c12x3*c13.y*c23.y-6*c10.x*c10.y*c13.x*c13y2*c23.x+3*c10.x*c11.x*c12.x*c13y2*c23.y-2*c10.x*c11.x*c12.y*c13y2*c23.x-4*c10.x*c11.y*c12.x*c13y2*c23.x+3*c10.y*c11.x*c12.x*c13y2*c23.x+6*c10.x*c10.y*c13x2*c13.y*c23.y+6*c10.x*c20.x*c13.x*c13y2*c23.y-3*c10.x*c11.y*c12.y*c13x2*c23.y+2*c10.x*c12.x*c12y2*c13.x*c23.y+2*c10.x*c12.x*c12y2*c13.y*c23.x+6*c10.x*c20.y*c13.x*c13y2*c23.x+6*c10.x*c21.x*c13.x*c13y2*c22.y+6*c10.x*c13.x*c21.y*c22.x*c13y2+4*c10.y*c11.x*c12.y*c13x2*c23.y+6*c10.y*c20.x*c13.x*c13y2*c23.x+2*c10.y*c11.y*c12.x*c13x2*c23.y-3*c10.y*c11.y*c12.y*c13x2*c23.x+2*c10.y*c12.x*c12y2*c13.x*c23.x+6*c10.y*c21.x*c13.x*c22.x*c13y2-3*c11.x*c20.x*c12.x*c13y2*c23.y+2*c11.x*c20.x*c12.y*c13y2*c23.x+c11.x*c11.y*c12y2*c13.x*c23.x-3*c11.x*c12.x*c20.y*c13y2*c23.x-3*c11.x*c12.x*c21.x*c13y2*c22.y-3*c11.x*c12.x*c21.y*c22.x*c13y2+2*c11.x*c21.x*c12.y*c22.x*c13y2+4*c20.x*c11.y*c12.x*c13y2*c23.x+4*c11.y*c12.x*c21.x*c22.x*c13y2-2*c10.x*c12x2*c12.y*c13.y*c23.y-6*c10.y*c20.x*c13x2*c13.y*c23.y-6*c10.y*c20.y*c13x2*c13.y*c23.x-6*c10.y*c21.x*c13x2*c13.y*c22.y-2*c10.y*c12x2*c12.y*c13.x*c23.y-2*c10.y*c12x2*c12.y*c13.y*c23.x-6*c10.y*c13x2*c21.y*c22.x*c13.y-c11.x*c11.y*c12x2*c13.y*c23.y-2*c11.x*c11y2*c13.x*c13.y*c23.x+3*c20.x*c11.y*c12.y*c13x2*c23.y-2*c20.x*c12.x*c12y2*c13.x*c23.y-2*c20.x*c12.x*c12y2*c13.y*c23.x-6*c20.x*c20.y*c13.x*c13y2*c23.x-6*c20.x*c21.x*c13.x*c13y2*c22.y-6*c20.x*c13.x*c21.y*c22.x*c13y2+3*c11.y*c20.y*c12.y*c13x2*c23.x+3*c11.y*c21.x*c12.y*c13x2*c22.y+3*c11.y*c12.y*c13x2*c21.y*c22.x-2*c12.x*c20.y*c12y2*c13.x*c23.x-2*c12.x*c21.x*c12y2*c13.x*c22.y-2*c12.x*c21.x*c12y2*c22.x*c13.y-2*c12.x*c12y2*c13.x*c21.y*c22.x-6*c20.y*c21.x*c13.x*c22.x*c13y2-c11y2*c12.x*c12.y*c13.x*c23.x+2*c20.x*c12x2*c12.y*c13.y*c23.y+6*c20.y*c13x2*c21.y*c22.x*c13.y+2*c11x2*c11.y*c13.x*c13.y*c23.y+c11x2*c12.x*c12.y*c13.y*c23.y+2*c12x2*c20.y*c12.y*c13.y*c23.x+2*c12x2*c21.x*c12.y*c13.y*c22.y+2*c12x2*c12.y*c21.y*c22.x*c13.y+c21x3*c13y3+3*c10x2*c13y3*c23.x-3*c10y2*c13x3*c23.y+3*c20x2*c13y3*c23.x+c11y3*c13x2*c23.x-c11x3*c13y2*c23.y-c11.x*c11y2*c13x2*c23.y+c11x2*c11.y*c13y2*c23.x-3*c10x2*c13.x*c13y2*c23.y+3*c10y2*c13x2*c13.y*c23.x-c11x2*c12y2*c13.x*c23.y+c11y2*c12x2*c13.y*c23.x-3*c21x2*c13.x*c21.y*c13y2-3*c20x2*c13.x*c13y2*c23.y+3*c20y2*c13x2*c13.y*c23.x+c11.x*c12.x*c13.x*c13.y*(6*c20.y*c23.y+6*c21.y*c22.y)+c12x3*c13.y*(-2*c20.y*c23.y-2*c21.y*c22.y)+c10.y*c13x3*(6*c20.y*c23.y+6*c21.y*c22.y)+c11.y*c12.x*c13x2*(-2*c20.y*c23.y-2*c21.y*c22.y)+c12x2*c12.y*c13.x*(2*c20.y*c23.y+2*c21.y*c22.y)+c11.x*c12.y*c13x2*(-4*c20.y*c23.y-4*c21.y*c22.y)+c10.x*c13x2*c13.y*(-6*c20.y*c23.y-6*c21.y*c22.y)+c20.x*c13x2*c13.y*(6*c20.y*c23.y+6*c21.y*c22.y)+c21.x*c13x2*c13.y*(6*c20.y*c22.y+3*c21y2)+c13x3*(-2*c20.y*c21.y*c22.y-c20y2*c23.y-c21.y*(2*c20.y*c22.y+c21y2)-c20.y*(2*c20.y*c23.y+2*c21.y*c22.y)),-c10.x*c11.x*c12.y*c13.x*c13.y*c22.y+c10.x*c11.y*c12.x*c13.x*c13.y*c22.y+6*c10.x*c11.y*c12.y*c13.x*c22.x*c13.y-6*c10.y*c11.x*c12.x*c13.x*c13.y*c22.y-c10.y*c11.x*c12.y*c13.x*c22.x*c13.y+c10.y*c11.y*c12.x*c13.x*c22.x*c13.y+c11.x*c11.y*c12.x*c12.y*c13.x*c22.y-c11.x*c11.y*c12.x*c12.y*c22.x*c13.y+c11.x*c20.x*c12.y*c13.x*c13.y*c22.y+c11.x*c20.y*c12.y*c13.x*c22.x*c13.y+c11.x*c21.x*c12.y*c13.x*c21.y*c13.y-c20.x*c11.y*c12.x*c13.x*c13.y*c22.y-6*c20.x*c11.y*c12.y*c13.x*c22.x*c13.y-c11.y*c12.x*c20.y*c13.x*c22.x*c13.y-c11.y*c12.x*c21.x*c13.x*c21.y*c13.y-6*c10.x*c20.x*c22.x*c13y3-2*c10.x*c12y3*c13.x*c22.x+2*c20.x*c12y3*c13.x*c22.x+2*c10.y*c12x3*c13.y*c22.y-6*c10.x*c10.y*c13.x*c22.x*c13y2+3*c10.x*c11.x*c12.x*c13y2*c22.y-2*c10.x*c11.x*c12.y*c22.x*c13y2-4*c10.x*c11.y*c12.x*c22.x*c13y2+3*c10.y*c11.x*c12.x*c22.x*c13y2+6*c10.x*c10.y*c13x2*c13.y*c22.y+6*c10.x*c20.x*c13.x*c13y2*c22.y-3*c10.x*c11.y*c12.y*c13x2*c22.y+2*c10.x*c12.x*c12y2*c13.x*c22.y+2*c10.x*c12.x*c12y2*c22.x*c13.y+6*c10.x*c20.y*c13.x*c22.x*c13y2+6*c10.x*c21.x*c13.x*c21.y*c13y2+4*c10.y*c11.x*c12.y*c13x2*c22.y+6*c10.y*c20.x*c13.x*c22.x*c13y2+2*c10.y*c11.y*c12.x*c13x2*c22.y-3*c10.y*c11.y*c12.y*c13x2*c22.x+2*c10.y*c12.x*c12y2*c13.x*c22.x-3*c11.x*c20.x*c12.x*c13y2*c22.y+2*c11.x*c20.x*c12.y*c22.x*c13y2+c11.x*c11.y*c12y2*c13.x*c22.x-3*c11.x*c12.x*c20.y*c22.x*c13y2-3*c11.x*c12.x*c21.x*c21.y*c13y2+4*c20.x*c11.y*c12.x*c22.x*c13y2-2*c10.x*c12x2*c12.y*c13.y*c22.y-6*c10.y*c20.x*c13x2*c13.y*c22.y-6*c10.y*c20.y*c13x2*c22.x*c13.y-6*c10.y*c21.x*c13x2*c21.y*c13.y-2*c10.y*c12x2*c12.y*c13.x*c22.y-2*c10.y*c12x2*c12.y*c22.x*c13.y-c11.x*c11.y*c12x2*c13.y*c22.y-2*c11.x*c11y2*c13.x*c22.x*c13.y+3*c20.x*c11.y*c12.y*c13x2*c22.y-2*c20.x*c12.x*c12y2*c13.x*c22.y-2*c20.x*c12.x*c12y2*c22.x*c13.y-6*c20.x*c20.y*c13.x*c22.x*c13y2-6*c20.x*c21.x*c13.x*c21.y*c13y2+3*c11.y*c20.y*c12.y*c13x2*c22.x+3*c11.y*c21.x*c12.y*c13x2*c21.y-2*c12.x*c20.y*c12y2*c13.x*c22.x-2*c12.x*c21.x*c12y2*c13.x*c21.y-c11y2*c12.x*c12.y*c13.x*c22.x+2*c20.x*c12x2*c12.y*c13.y*c22.y-3*c11.y*c21x2*c12.y*c13.x*c13.y+6*c20.y*c21.x*c13x2*c21.y*c13.y+2*c11x2*c11.y*c13.x*c13.y*c22.y+c11x2*c12.x*c12.y*c13.y*c22.y+2*c12x2*c20.y*c12.y*c22.x*c13.y+2*c12x2*c21.x*c12.y*c21.y*c13.y-3*c10.x*c21x2*c13y3+3*c20.x*c21x2*c13y3+3*c10x2*c22.x*c13y3-3*c10y2*c13x3*c22.y+3*c20x2*c22.x*c13y3+c21x2*c12y3*c13.x+c11y3*c13x2*c22.x-c11x3*c13y2*c22.y+3*c10.y*c21x2*c13.x*c13y2-c11.x*c11y2*c13x2*c22.y+c11.x*c21x2*c12.y*c13y2+2*c11.y*c12.x*c21x2*c13y2+c11x2*c11.y*c22.x*c13y2-c12.x*c21x2*c12y2*c13.y-3*c20.y*c21x2*c13.x*c13y2-3*c10x2*c13.x*c13y2*c22.y+3*c10y2*c13x2*c22.x*c13.y-c11x2*c12y2*c13.x*c22.y+c11y2*c12x2*c22.x*c13.y-3*c20x2*c13.x*c13y2*c22.y+3*c20y2*c13x2*c22.x*c13.y+c12x2*c12.y*c13.x*(2*c20.y*c22.y+c21y2)+c11.x*c12.x*c13.x*c13.y*(6*c20.y*c22.y+3*c21y2)+c12x3*c13.y*(-2*c20.y*c22.y-c21y2)+c10.y*c13x3*(6*c20.y*c22.y+3*c21y2)+c11.y*c12.x*c13x2*(-2*c20.y*c22.y-c21y2)+c11.x*c12.y*c13x2*(-4*c20.y*c22.y-2*c21y2)+c10.x*c13x2*c13.y*(-6*c20.y*c22.y-3*c21y2)+c20.x*c13x2*c13.y*(6*c20.y*c22.y+3*c21y2)+c13x3*(-2*c20.y*c21y2-c20y2*c22.y-c20.y*(2*c20.y*c22.y+c21y2)),-c10.x*c11.x*c12.y*c13.x*c21.y*c13.y+c10.x*c11.y*c12.x*c13.x*c21.y*c13.y+6*c10.x*c11.y*c21.x*c12.y*c13.x*c13.y-6*c10.y*c11.x*c12.x*c13.x*c21.y*c13.y-c10.y*c11.x*c21.x*c12.y*c13.x*c13.y+c10.y*c11.y*c12.x*c21.x*c13.x*c13.y-c11.x*c11.y*c12.x*c21.x*c12.y*c13.y+c11.x*c11.y*c12.x*c12.y*c13.x*c21.y+c11.x*c20.x*c12.y*c13.x*c21.y*c13.y+6*c11.x*c12.x*c20.y*c13.x*c21.y*c13.y+c11.x*c20.y*c21.x*c12.y*c13.x*c13.y-c20.x*c11.y*c12.x*c13.x*c21.y*c13.y-6*c20.x*c11.y*c21.x*c12.y*c13.x*c13.y-c11.y*c12.x*c20.y*c21.x*c13.x*c13.y-6*c10.x*c20.x*c21.x*c13y3-2*c10.x*c21.x*c12y3*c13.x+6*c10.y*c20.y*c13x3*c21.y+2*c20.x*c21.x*c12y3*c13.x+2*c10.y*c12x3*c21.y*c13.y-2*c12x3*c20.y*c21.y*c13.y-6*c10.x*c10.y*c21.x*c13.x*c13y2+3*c10.x*c11.x*c12.x*c21.y*c13y2-2*c10.x*c11.x*c21.x*c12.y*c13y2-4*c10.x*c11.y*c12.x*c21.x*c13y2+3*c10.y*c11.x*c12.x*c21.x*c13y2+6*c10.x*c10.y*c13x2*c21.y*c13.y+6*c10.x*c20.x*c13.x*c21.y*c13y2-3*c10.x*c11.y*c12.y*c13x2*c21.y+2*c10.x*c12.x*c21.x*c12y2*c13.y+2*c10.x*c12.x*c12y2*c13.x*c21.y+6*c10.x*c20.y*c21.x*c13.x*c13y2+4*c10.y*c11.x*c12.y*c13x2*c21.y+6*c10.y*c20.x*c21.x*c13.x*c13y2+2*c10.y*c11.y*c12.x*c13x2*c21.y-3*c10.y*c11.y*c21.x*c12.y*c13x2+2*c10.y*c12.x*c21.x*c12y2*c13.x-3*c11.x*c20.x*c12.x*c21.y*c13y2+2*c11.x*c20.x*c21.x*c12.y*c13y2+c11.x*c11.y*c21.x*c12y2*c13.x-3*c11.x*c12.x*c20.y*c21.x*c13y2+4*c20.x*c11.y*c12.x*c21.x*c13y2-6*c10.x*c20.y*c13x2*c21.y*c13.y-2*c10.x*c12x2*c12.y*c21.y*c13.y-6*c10.y*c20.x*c13x2*c21.y*c13.y-6*c10.y*c20.y*c21.x*c13x2*c13.y-2*c10.y*c12x2*c21.x*c12.y*c13.y-2*c10.y*c12x2*c12.y*c13.x*c21.y-c11.x*c11.y*c12x2*c21.y*c13.y-4*c11.x*c20.y*c12.y*c13x2*c21.y-2*c11.x*c11y2*c21.x*c13.x*c13.y+3*c20.x*c11.y*c12.y*c13x2*c21.y-2*c20.x*c12.x*c21.x*c12y2*c13.y-2*c20.x*c12.x*c12y2*c13.x*c21.y-6*c20.x*c20.y*c21.x*c13.x*c13y2-2*c11.y*c12.x*c20.y*c13x2*c21.y+3*c11.y*c20.y*c21.x*c12.y*c13x2-2*c12.x*c20.y*c21.x*c12y2*c13.x-c11y2*c12.x*c21.x*c12.y*c13.x+6*c20.x*c20.y*c13x2*c21.y*c13.y+2*c20.x*c12x2*c12.y*c21.y*c13.y+2*c11x2*c11.y*c13.x*c21.y*c13.y+c11x2*c12.x*c12.y*c21.y*c13.y+2*c12x2*c20.y*c21.x*c12.y*c13.y+2*c12x2*c20.y*c12.y*c13.x*c21.y+3*c10x2*c21.x*c13y3-3*c10y2*c13x3*c21.y+3*c20x2*c21.x*c13y3+c11y3*c21.x*c13x2-c11x3*c21.y*c13y2-3*c20y2*c13x3*c21.y-c11.x*c11y2*c13x2*c21.y+c11x2*c11.y*c21.x*c13y2-3*c10x2*c13.x*c21.y*c13y2+3*c10y2*c21.x*c13x2*c13.y-c11x2*c12y2*c13.x*c21.y+c11y2*c12x2*c21.x*c13.y-3*c20x2*c13.x*c21.y*c13y2+3*c20y2*c21.x*c13x2*c13.y,c10.x*c10.y*c11.x*c12.y*c13.x*c13.y-c10.x*c10.y*c11.y*c12.x*c13.x*c13.y+c10.x*c11.x*c11.y*c12.x*c12.y*c13.y-c10.y*c11.x*c11.y*c12.x*c12.y*c13.x-c10.x*c11.x*c20.y*c12.y*c13.x*c13.y+6*c10.x*c20.x*c11.y*c12.y*c13.x*c13.y+c10.x*c11.y*c12.x*c20.y*c13.x*c13.y-c10.y*c11.x*c20.x*c12.y*c13.x*c13.y-6*c10.y*c11.x*c12.x*c20.y*c13.x*c13.y+c10.y*c20.x*c11.y*c12.x*c13.x*c13.y-c11.x*c20.x*c11.y*c12.x*c12.y*c13.y+c11.x*c11.y*c12.x*c20.y*c12.y*c13.x+c11.x*c20.x*c20.y*c12.y*c13.x*c13.y-c20.x*c11.y*c12.x*c20.y*c13.x*c13.y-2*c10.x*c20.x*c12y3*c13.x+2*c10.y*c12x3*c20.y*c13.y-3*c10.x*c10.y*c11.x*c12.x*c13y2-6*c10.x*c10.y*c20.x*c13.x*c13y2+3*c10.x*c10.y*c11.y*c12.y*c13x2-2*c10.x*c10.y*c12.x*c12y2*c13.x-2*c10.x*c11.x*c20.x*c12.y*c13y2-c10.x*c11.x*c11.y*c12y2*c13.x+3*c10.x*c11.x*c12.x*c20.y*c13y2-4*c10.x*c20.x*c11.y*c12.x*c13y2+3*c10.y*c11.x*c20.x*c12.x*c13y2+6*c10.x*c10.y*c20.y*c13x2*c13.y+2*c10.x*c10.y*c12x2*c12.y*c13.y+2*c10.x*c11.x*c11y2*c13.x*c13.y+2*c10.x*c20.x*c12.x*c12y2*c13.y+6*c10.x*c20.x*c20.y*c13.x*c13y2-3*c10.x*c11.y*c20.y*c12.y*c13x2+2*c10.x*c12.x*c20.y*c12y2*c13.x+c10.x*c11y2*c12.x*c12.y*c13.x+c10.y*c11.x*c11.y*c12x2*c13.y+4*c10.y*c11.x*c20.y*c12.y*c13x2-3*c10.y*c20.x*c11.y*c12.y*c13x2+2*c10.y*c20.x*c12.x*c12y2*c13.x+2*c10.y*c11.y*c12.x*c20.y*c13x2+c11.x*c20.x*c11.y*c12y2*c13.x-3*c11.x*c20.x*c12.x*c20.y*c13y2-2*c10.x*c12x2*c20.y*c12.y*c13.y-6*c10.y*c20.x*c20.y*c13x2*c13.y-2*c10.y*c20.x*c12x2*c12.y*c13.y-2*c10.y*c11x2*c11.y*c13.x*c13.y-c10.y*c11x2*c12.x*c12.y*c13.y-2*c10.y*c12x2*c20.y*c12.y*c13.x-2*c11.x*c20.x*c11y2*c13.x*c13.y-c11.x*c11.y*c12x2*c20.y*c13.y+3*c20.x*c11.y*c20.y*c12.y*c13x2-2*c20.x*c12.x*c20.y*c12y2*c13.x-c20.x*c11y2*c12.x*c12.y*c13.x+3*c10y2*c11.x*c12.x*c13.x*c13.y+3*c11.x*c12.x*c20y2*c13.x*c13.y+2*c20.x*c12x2*c20.y*c12.y*c13.y-3*c10x2*c11.y*c12.y*c13.x*c13.y+2*c11x2*c11.y*c20.y*c13.x*c13.y+c11x2*c12.x*c20.y*c12.y*c13.y-3*c20x2*c11.y*c12.y*c13.x*c13.y-c10x3*c13y3+c10y3*c13x3+c20x3*c13y3-c20y3*c13x3-3*c10.x*c20x2*c13y3-c10.x*c11y3*c13x2+3*c10x2*c20.x*c13y3+c10.y*c11x3*c13y2+3*c10.y*c20y2*c13x3+c20.x*c11y3*c13x2+c10x2*c12y3*c13.x-3*c10y2*c20.y*c13x3-c10y2*c12x3*c13.y+c20x2*c12y3*c13.x-c11x3*c20.y*c13y2-c12x3*c20y2*c13.y-c10.x*c11x2*c11.y*c13y2+c10.y*c11.x*c11y2*c13x2-3*c10.x*c10y2*c13x2*c13.y-c10.x*c11y2*c12x2*c13.y+c10.y*c11x2*c12y2*c13.x-c11.x*c11y2*c20.y*c13x2+3*c10x2*c10.y*c13.x*c13y2+c10x2*c11.x*c12.y*c13y2+2*c10x2*c11.y*c12.x*c13y2-2*c10y2*c11.x*c12.y*c13x2-c10y2*c11.y*c12.x*c13x2+c11x2*c20.x*c11.y*c13y2-3*c10.x*c20y2*c13x2*c13.y+3*c10.y*c20x2*c13.x*c13y2+c11.x*c20x2*c12.y*c13y2-2*c11.x*c20y2*c12.y*c13x2+c20.x*c11y2*c12x2*c13.y-c11.y*c12.x*c20y2*c13x2-c10x2*c12.x*c12y2*c13.y-3*c10x2*c20.y*c13.x*c13y2+3*c10y2*c20.x*c13x2*c13.y+c10y2*c12x2*c12.y*c13.x-c11x2*c20.y*c12y2*c13.x+2*c20x2*c11.y*c12.x*c13y2+3*c20.x*c20y2*c13x2*c13.y-c20x2*c12.x*c12y2*c13.y-3*c20x2*c20.y*c13.x*c13y2+c12x2*c20y2*c12.y*c13.x);var roots=poly.getRootsInInterval(0,1);for(var i=0;i<roots.length;i++){var s=roots[i];var xRoots=new Polynomial(c13.x,c12.x,c11.x,c10.x-c20.x-s*c21.x-s*s*c22.x-s*s*s*c23.x).getRoots();var yRoots=new Polynomial(c13.y,c12.y,c11.y,c10.y-c20.y-s*c21.y-s*s*c22.y-s*s*s*c23.y).getRoots();if(xRoots.length>0&&yRoots.length>0){var TOLERANCE=1e-4;checkRoots:for(var j=0;j<xRoots.length;j++){var xRoot=xRoots[j];if(0<=xRoot&&xRoot<=1){for(var k=0;k<yRoots.length;k++){if(Math.abs(xRoot-yRoots[k])<TOLERANCE){result.points.push(c23.multiply(s*s*s).add(c22.multiply(s*s).add(c21.multiply(s).add(c20))));break checkRoots;}}}}}}if(result.points.length>0)result.status="Intersection";return result;};
Intersection.intersectBezier3Circle=function(p1,p2,p3,p4,c,r){return Intersection.intersectBezier3Ellipse(p1,p2,p3,p4,c,r,r);};
Intersection.intersectBezier3Ellipse=function(p1,p2,p3,p4,ec,rx,ry){var a,b,c,d;var c3,c2,c1,c0;var result=new Intersection("No Intersection");a=p1.multiply(-1);b=p2.multiply(3);c=p3.multiply(-3);d=a.add(b.add(c.add(p4)));c3=new Vector2D(d.x,d.y);a=p1.multiply(3);b=p2.multiply(-6);c=p3.multiply(3);d=a.add(b.add(c));c2=new Vector2D(d.x,d.y);a=p1.multiply(-3);b=p2.multiply(3);c=a.add(b);c1=new Vector2D(c.x,c.y);c0=new Vector2D(p1.x,p1.y);var rxrx=rx*rx;var ryry=ry*ry;var poly=new Polynomial(c3.x*c3.x*ryry+c3.y*c3.y*rxrx,2*(c3.x*c2.x*ryry+c3.y*c2.y*rxrx),2*(c3.x*c1.x*ryry+c3.y*c1.y*rxrx)+c2.x*c2.x*ryry+c2.y*c2.y*rxrx,2*c3.x*ryry*(c0.x-ec.x)+2*c3.y*rxrx*(c0.y-ec.y)+2*(c2.x*c1.x*ryry+c2.y*c1.y*rxrx),2*c2.x*ryry*(c0.x-ec.x)+2*c2.y*rxrx*(c0.y-ec.y)+c1.x*c1.x*ryry+c1.y*c1.y*rxrx,2*c1.x*ryry*(c0.x-ec.x)+2*c1.y*rxrx*(c0.y-ec.y),c0.x*c0.x*ryry-2*c0.y*ec.y*rxrx-2*c0.x*ec.x*ryry+c0.y*c0.y*rxrx+ec.x*ec.x*ryry+ec.y*ec.y*rxrx-rxrx*ryry);var roots=poly.getRootsInInterval(0,1);for(var i=0;i<roots.length;i++){var t=roots[i];result.points.push(c3.multiply(t*t*t).add(c2.multiply(t*t).add(c1.multiply(t).add(c0))));}if(result.points.length>0)result.status="Intersection";return result;};
Intersection.intersectBezier3Line=function(p1,p2,p3,p4,a1,a2){var a,b,c,d;var c3,c2,c1,c0;var cl;var n;var min=a1.min(a2);var max=a1.max(a2);var result=new Intersection("No Intersection");a=p1.multiply(-1);b=p2.multiply(3);c=p3.multiply(-3);d=a.add(b.add(c.add(p4)));c3=new Vector2D(d.x,d.y);a=p1.multiply(3);b=p2.multiply(-6);c=p3.multiply(3);d=a.add(b.add(c));c2=new Vector2D(d.x,d.y);a=p1.multiply(-3);b=p2.multiply(3);c=a.add(b);c1=new Vector2D(c.x,c.y);c0=new Vector2D(p1.x,p1.y);n=new Vector2D(a1.y-a2.y,a2.x-a1.x);cl=a1.x*a2.y-a2.x*a1.y;roots=new Polynomial(n.dot(c3),n.dot(c2),n.dot(c1),n.dot(c0)+cl).getRoots();for(var i=0;i<roots.length;i++){var t=roots[i];if(0<=t&&t<=1){var p5=p1.lerp(p2,t);var p6=p2.lerp(p3,t);var p7=p3.lerp(p4,t);var p8=p5.lerp(p6,t);var p9=p6.lerp(p7,t);var p10=p8.lerp(p9,t);if(a1.x==a2.x){if(min.y<=p10.y&&p10.y<=max.y){result.status="Intersection";result.appendPoint(p10);}}else if(a1.y==a2.y){if(min.x<=p10.x&&p10.x<=max.x){result.status="Intersection";result.appendPoint(p10);}}else if(p10.gte(min)&&p10.lte(max)){result.status="Intersection";result.appendPoint(p10);}}}return result;};
Intersection.intersectBezier3Polygon=function(p1,p2,p3,p4,points){var result=new Intersection("No Intersection");var length=points.length;for(var i=0;i<length;i++){var a1=points[i];var a2=points[(i+1)%length];var inter=Intersection.intersectBezier3Line(p1,p2,p3,p4,a1,a2);result.appendPoints(inter.points);}if(result.points.length>0)result.status="Intersection";return result;};
Intersection.intersectBezier3Rectangle=function(p1,p2,p3,p4,r1,r2){var min=r1.min(r2);var max=r1.max(r2);var topRight=new Point2D(max.x,min.y);var bottomLeft=new Point2D(min.x,max.y);var inter1=Intersection.intersectBezier3Line(p1,p2,p3,p4,min,topRight);var inter2=Intersection.intersectBezier3Line(p1,p2,p3,p4,topRight,max);var inter3=Intersection.intersectBezier3Line(p1,p2,p3,p4,max,bottomLeft);var inter4=Intersection.intersectBezier3Line(p1,p2,p3,p4,bottomLeft,min);var result=new Intersection("No Intersection");result.appendPoints(inter1.points);result.appendPoints(inter2.points);result.appendPoints(inter3.points);result.appendPoints(inter4.points);if(result.points.length>0)result.status="Intersection";return result;};
Intersection.intersectCircleCircle=function(c1,r1,c2,r2){var result;var r_max=r1+r2;var r_min=Math.abs(r1-r2);var c_dist=c1.distanceFrom(c2);if(c_dist>r_max){result=new Intersection("Outside");}else if(c_dist<r_min){result=new Intersection("Inside");}else{result=new Intersection("Intersection");var a=(r1*r1-r2*r2+c_dist*c_dist)/(2*c_dist);var h=Math.sqrt(r1*r1-a*a);var p=c1.lerp(c2,a/c_dist);var b=h/c_dist;result.points.push(new Point2D(p.x-b*(c2.y-c1.y),p.y+b*(c2.x-c1.x)));result.points.push(new Point2D(p.x+b*(c2.y-c1.y),p.y-b*(c2.x-c1.x)));}return result;};
Intersection.intersectCircleEllipse=function(cc,r,ec,rx,ry){return Intersection.intersectEllipseEllipse(cc,r,r,ec,rx,ry);};
Intersection.intersectCircleLine=function(c,r,a1,a2){var result;var a=(a2.x-a1.x)*(a2.x-a1.x)+(a2.y-a1.y)*(a2.y-a1.y);var b=2*((a2.x-a1.x)*(a1.x-c.x)+(a2.y-a1.y)*(a1.y-c.y));var cc=c.x*c.x+c.y*c.y+a1.x*a1.x+a1.y*a1.y-2*(c.x*a1.x+c.y*a1.y)-r*r;var deter=b*b-4*a*cc;if(deter<0){result=new Intersection("Outside");}else if(deter==0){result=new Intersection("Tangent");}else{var e=Math.sqrt(deter);var u1=(-b+e)/(2*a);var u2=(-b-e)/(2*a);if((u1<0||u1>1)&&(u2<0||u2>1)){if((u1<0&&u2<0)||(u1>1&&u2>1)){result=new Intersection("Outside");}else{result=new Intersection("Inside");}}else{result=new Intersection("Intersection");if(0<=u1&&u1<=1)result.points.push(a1.lerp(a2,u1));if(0<=u2&&u2<=1)result.points.push(a1.lerp(a2,u2));}}return result;};
Intersection.intersectCirclePolygon=function(c,r,points){var result=new Intersection("No Intersection");var length=points.length;var inter;for(var i=0;i<length;i++){var a1=points[i];var a2=points[(i+1)%length];inter=Intersection.intersectCircleLine(c,r,a1,a2);result.appendPoints(inter.points);}if(result.points.length>0)result.status="Intersection";else result.status=inter.status;return result;};
Intersection.intersectCircleRectangle=function(c,r,r1,r2){var min=r1.min(r2);var max=r1.max(r2);var topRight=new Point2D(max.x,min.y);var bottomLeft=new Point2D(min.x,max.y);var inter1=Intersection.intersectCircleLine(c,r,min,topRight);var inter2=Intersection.intersectCircleLine(c,r,topRight,max);var inter3=Intersection.intersectCircleLine(c,r,max,bottomLeft);var inter4=Intersection.intersectCircleLine(c,r,bottomLeft,min);var result=new Intersection("No Intersection");result.appendPoints(inter1.points);result.appendPoints(inter2.points);result.appendPoints(inter3.points);result.appendPoints(inter4.points);if(result.points.length>0)result.status="Intersection";else result.status=inter1.status;return result;};
Intersection.intersectEllipseEllipse=function(c1,rx1,ry1,c2,rx2,ry2){var a=[ry1*ry1,0,rx1*rx1,-2*ry1*ry1*c1.x,-2*rx1*rx1*c1.y,ry1*ry1*c1.x*c1.x+rx1*rx1*c1.y*c1.y-rx1*rx1*ry1*ry1];var b=[ry2*ry2,0,rx2*rx2,-2*ry2*ry2*c2.x,-2*rx2*rx2*c2.y,ry2*ry2*c2.x*c2.x+rx2*rx2*c2.y*c2.y-rx2*rx2*ry2*ry2];var yPoly=Intersection.bezout(a,b);var yRoots=yPoly.getRoots();var epsilon=1e-3;var norm0=(a[0]*a[0]+2*a[1]*a[1]+a[2]*a[2])*epsilon;var norm1=(b[0]*b[0]+2*b[1]*b[1]+b[2]*b[2])*epsilon;var result=new Intersection("No Intersection");for(var y=0;y<yRoots.length;y++){var xPoly=new Polynomial(a[0],a[3]+yRoots[y]*a[1],a[5]+yRoots[y]*(a[4]+yRoots[y]*a[2]));var xRoots=xPoly.getRoots();for(var x=0;x<xRoots.length;x++){var test=(a[0]*xRoots[x]+a[1]*yRoots[y]+a[3])*xRoots[x]+(a[2]*yRoots[y]+a[4])*yRoots[y]+a[5];if(Math.abs(test)<norm0){test=(b[0]*xRoots[x]+b[1]*yRoots[y]+b[3])*xRoots[x]+(b[2]*yRoots[y]+b[4])*yRoots[y]+b[5];if(Math.abs(test)<norm1){result.appendPoint(new Point2D(xRoots[x],yRoots[y]));}}}}if(result.points.length>0)result.status="Intersection";return result;};
Intersection.intersectEllipseLine=function(c,rx,ry,a1,a2){var result;var origin=new Vector2D(a1.x,a1.y);var dir=Vector2D.fromPoints(a1,a2);var center=new Vector2D(c.x,c.y);var diff=origin.subtract(center);var mDir=new Vector2D(dir.x/(rx*rx),  dir.y/(ry*ry));var mDiff=new Vector2D(diff.x/(rx*rx), diff.y/(ry*ry));var a=dir.dot(mDir);var b=dir.dot(mDiff);var c=diff.dot(mDiff)-1.0;var d=b*b-a*c;if(d<0){result=new Intersection("Outside");}else if(d>0){var root=Math.sqrt(d);var t_a=(-b-root)/a;var t_b=(-b+root)/a;if((t_a<0||1<t_a)&&(t_b<0||1<t_b)){if((t_a<0&&t_b<0)||(t_a>1&&t_b>1))result=new Intersection("Outside");else result=new Intersection("Inside");}else{result=new Intersection("Intersection");if(0<=t_a&&t_a<=1)result.appendPoint(a1.lerp(a2,t_a));if(0<=t_b&&t_b<=1)result.appendPoint(a1.lerp(a2,t_b));}}else{var t=-b/a;if(0<=t&&t<=1){result=new Intersection("Intersection");result.appendPoint(a1.lerp(a2,t));}else{result=new Intersection("Outside");}}return result;};
Intersection.intersectEllipsePolygon=function(c,rx,ry,points){var result=new Intersection("No Intersection");var length=points.length;for(var i=0;i<length;i++){var b1=points[i];var b2=points[(i+1)%length];var inter=Intersection.intersectEllipseLine(c,rx,ry,b1,b2);result.appendPoints(inter.points);}if(result.points.length>0)result.status="Intersection";return result;};
Intersection.intersectEllipseRectangle=function(c,rx,ry,r1,r2){var min=r1.min(r2);var max=r1.max(r2);var topRight=new Point2D(max.x,min.y);var bottomLeft=new Point2D(min.x,max.y);var inter1=Intersection.intersectEllipseLine(c,rx,ry,min,topRight);var inter2=Intersection.intersectEllipseLine(c,rx,ry,topRight,max);var inter3=Intersection.intersectEllipseLine(c,rx,ry,max,bottomLeft);var inter4=Intersection.intersectEllipseLine(c,rx,ry,bottomLeft,min);var result=new Intersection("No Intersection");result.appendPoints(inter1.points);result.appendPoints(inter2.points);result.appendPoints(inter3.points);result.appendPoints(inter4.points);if(result.points.length>0)result.status="Intersection";return result;};
Intersection.intersectLineLine=function(a1,a2,b1,b2){var result;var ua_t=(b2.x-b1.x)*(a1.y-b1.y)-(b2.y-b1.y)*(a1.x-b1.x);var ub_t=(a2.x-a1.x)*(a1.y-b1.y)-(a2.y-a1.y)*(a1.x-b1.x);var u_b=(b2.y-b1.y)*(a2.x-a1.x)-(b2.x-b1.x)*(a2.y-a1.y);if(u_b!=0){var ua=ua_t/u_b;var ub=ub_t/u_b;if(0<=ua&&ua<=1&&0<=ub&&ub<=1){result=new Intersection("Intersection");result.points.push(new Point2D(a1.x+ua*(a2.x-a1.x),a1.y+ua*(a2.y-a1.y)));}else{result=new Intersection("No Intersection");}}else{if(ua_t==0||ub_t==0){result=new Intersection("Coincident");}else{result=new Intersection("Parallel");}}return result;};
Intersection.intersectLinePolygon=function(a1,a2,points){var result=new Intersection("No Intersection");var length=points.length;for(var i=0;i<length;i++){var b1=points[i];var b2=points[(i+1)%length];var inter=Intersection.intersectLineLine(a1,a2,b1,b2);result.appendPoints(inter.points);}if(result.points.length>0)result.status="Intersection";return result;};
Intersection.intersectLineRectangle=function(a1,a2,r1,r2){var min=r1.min(r2);var max=r1.max(r2);var topRight=new Point2D(max.x,min.y);var bottomLeft=new Point2D(min.x,max.y);var inter1=Intersection.intersectLineLine(min,topRight,a1,a2);var inter2=Intersection.intersectLineLine(topRight,max,a1,a2);var inter3=Intersection.intersectLineLine(max,bottomLeft,a1,a2);var inter4=Intersection.intersectLineLine(bottomLeft,min,a1,a2);var result=new Intersection("No Intersection");result.appendPoints(inter1.points);result.appendPoints(inter2.points);result.appendPoints(inter3.points);result.appendPoints(inter4.points);if(result.points.length>0)result.status="Intersection";return result;};
Intersection.intersectPolygonPolygon=function(points1,points2){var result=new Intersection("No Intersection");var length=points1.length;for(var i=0;i<length;i++){var a1=points1[i];var a2=points1[(i+1)%length];var inter=Intersection.intersectLinePolygon(a1,a2,points2);result.appendPoints(inter.points);}if(result.points.length>0)result.status="Intersection";return result;};
Intersection.intersectPolygonRectangle=function(points,r1,r2){var min=r1.min(r2);var max=r1.max(r2);var topRight=new Point2D(max.x,min.y);var bottomLeft=new Point2D(min.x,max.y);var inter1=Intersection.intersectLinePolygon(min,topRight,points);var inter2=Intersection.intersectLinePolygon(topRight,max,points);var inter3=Intersection.intersectLinePolygon(max,bottomLeft,points);var inter4=Intersection.intersectLinePolygon(bottomLeft,min,points);var result=new Intersection("No Intersection");result.appendPoints(inter1.points);result.appendPoints(inter2.points);result.appendPoints(inter3.points);result.appendPoints(inter4.points);if(result.points.length>0)result.status="Intersection";return result;};
Intersection.intersectRayRay=function(a1,a2,b1,b2){var result;var ua_t=(b2.x-b1.x)*(a1.y-b1.y)-(b2.y-b1.y)*(a1.x-b1.x);var ub_t=(a2.x-a1.x)*(a1.y-b1.y)-(a2.y-a1.y)*(a1.x-b1.x);var u_b=(b2.y-b1.y)*(a2.x-a1.x)-(b2.x-b1.x)*(a2.y-a1.y);if(u_b!=0){var ua=ua_t/u_b;result=new Intersection("Intersection");result.points.push(new Point2D(a1.x+ua*(a2.x-a1.x),a1.y+ua*(a2.y-a1.y)));}else{if(ua_t==0||ub_t==0){result=new Intersection("Coincident");}else{result=new Intersection("Parallel");}}return result;};
Intersection.intersectRectangleRectangle=function(a1,a2,b1,b2){var min=a1.min(a2);var max=a1.max(a2);var topRight=new Point2D(max.x,min.y);var bottomLeft=new Point2D(min.x,max.y);var inter1=Intersection.intersectLineRectangle(min,topRight,b1,b2);var inter2=Intersection.intersectLineRectangle(topRight,max,b1,b2);var inter3=Intersection.intersectLineRectangle(max,bottomLeft,b1,b2);var inter4=Intersection.intersectLineRectangle(bottomLeft,min,b1,b2);var result=new Intersection("No Intersection");result.appendPoints(inter1.points);result.appendPoints(inter2.points);result.appendPoints(inter3.points);result.appendPoints(inter4.points);if(result.points.length>0)result.status="Intersection";return result;};
Intersection.bezout=function(e1,e2){var AB=e1[0]*e2[1]-e2[0]*e1[1];var AC=e1[0]*e2[2]-e2[0]*e1[2];var AD=e1[0]*e2[3]-e2[0]*e1[3];var AE=e1[0]*e2[4]-e2[0]*e1[4];var AF=e1[0]*e2[5]-e2[0]*e1[5];var BC=e1[1]*e2[2]-e2[1]*e1[2];var BE=e1[1]*e2[4]-e2[1]*e1[4];var BF=e1[1]*e2[5]-e2[1]*e1[5];var CD=e1[2]*e2[3]-e2[2]*e1[3];var DE=e1[3]*e2[4]-e2[3]*e1[4];var DF=e1[3]*e2[5]-e2[3]*e1[5];var BFpDE=BF+DE;var BEmCD=BE-CD;return new Polynomial(AB*BC-AC*AC,AB*BEmCD+AD*BC-2*AC*AE,AB*BFpDE+AD*BEmCD-AE*AE-2*AC*AF,AB*DF+AD*BFpDE-2*AE*AF,AD*DF-AF*AF);};
function IntersectionParams(name,params){if(arguments.length>0)this.init(name,params);}
IntersectionParams.prototype.init=function(name,params){this.name=name;this.params=params;};
function Point2D(x,y){if(arguments.length>0){this.init(x,y);}}
Point2D.prototype.init=function(x,y){this.x=x;this.y=y;};
Point2D.prototype.add=function(that){return new Point2D(this.x+that.x,this.y+that.y);};
Point2D.prototype.addEquals=function(that){this.x+=that.x;this.y+=that.y;return this;};
Point2D.prototype.scalarAdd=function(scalar){return new Point2D(this.x+scalar,this.y+scalar);};
Point2D.prototype.scalarAddEquals=function(scalar){this.x+=scalar;this.y+=scalar;return this;};
Point2D.prototype.subtract=function(that){return new Point2D(this.x-that.x,this.y-that.y);};
Point2D.prototype.subtractEquals=function(that){this.x-=that.x;this.y-=that.y;return this;};
Point2D.prototype.scalarSubtract=function(scalar){return new Point2D(this.x-scalar,this.y-scalar);};
Point2D.prototype.scalarSubtractEquals=function(scalar){this.x-=scalar;this.y-=scalar;return this;};
Point2D.prototype.multiply=function(scalar){return new Point2D(this.x*scalar,this.y*scalar);};
Point2D.prototype.multiplyEquals=function(scalar){this.x*=scalar;this.y*=scalar;return this;};
Point2D.prototype.divide=function(scalar){return new Point2D(this.x/scalar, this.y/scalar);};
Point2D.prototype.divideEquals=function(scalar){this.x/=scalar;this.y/=scalar;return this;};
Point2D.prototype.eq=function(that){return(this.x==that.x&&this.y==that.y);};
Point2D.prototype.lt=function(that){return(this.x<that.x&&this.y<that.y);};
Point2D.prototype.lte=function(that){return(this.x<=that.x&&this.y<=that.y);};
Point2D.prototype.gt=function(that){return(this.x>that.x&&this.y>that.y);};
Point2D.prototype.gte=function(that){return(this.x>=that.x&&this.y>=that.y);};
Point2D.prototype.lerp=function(that,t){return new Point2D(this.x+(that.x-this.x)*t,this.y+(that.y-this.y)*t);};
Point2D.prototype.distanceFrom=function(that){var dx=this.x-that.x;var dy=this.y-that.y;return Math.sqrt(dx*dx+dy*dy);};
Point2D.prototype.min=function(that){return new Point2D(Math.min(this.x,that.x),Math.min(this.y,that.y));};
Point2D.prototype.max=function(that){return new Point2D(Math.max(this.x,that.x),Math.max(this.y,that.y));};
Point2D.prototype.toString=function(){return this.x+","+this.y;};
Point2D.prototype.setXY=function(x,y){this.x=x;this.y=y;};
Point2D.prototype.setFromPoint=function(that){this.x=that.x;this.y=that.y;};
Point2D.prototype.swap=function(that){var x=this.x;var y=this.y;this.x=that.x;this.y=that.y;that.x=x;that.y=y;};
Polynomial.TOLERANCE=1e-6;
Polynomial.ACCURACY=6;
function Polynomial(){this.init(arguments);}
Polynomial.prototype.init=function(coefs){this.coefs=new Array();for(var i=coefs.length-1;i>=0;i--)this.coefs.push(coefs[i]);};
Polynomial.prototype.eval=function(x){var result=0;for(var i=this.coefs.length-1;i>=0;i--)result=result*x+this.coefs[i];return result;};
Polynomial.prototype.multiply=function(that){var result=new Polynomial();for(var i=0;i<=this.getDegree()+that.getDegree();i++)result.coefs.push(0);for(var i=0;i<=this.getDegree();i++)for(var j=0;j<=that.getDegree();j++)result.coefs[i+j]+=this.coefs[i]*that.coefs[j];return result;};
Polynomial.prototype.divide_scalar=function(scalar){for(var i=0;i<this.coefs.length;i++)this.coefs[i]/=scalar;};
Polynomial.prototype.simplify=function(){for(var i=this.getDegree();i>=0;i--){if(Math.abs(this.coefs[i])<=Polynomial.TOLERANCE)this.coefs.pop();else break;}};
Polynomial.prototype.bisection=function(min,max){var minValue=this.eval(min);var maxValue=this.eval(max);var result;if(Math.abs(minValue)<=Polynomial.TOLERANCE)result=min;else if(Math.abs(maxValue)<=Polynomial.TOLERANCE)result=max;else if(minValue*maxValue<=0){var tmp1=Math.log(max-min);var tmp2=Math.log(10)*Polynomial.ACCURACY;var iters=Math.ceil((tmp1+tmp2)/Math.log(2));for(var i=0;i<iters;i++){result=0.5*(min+max);var value=this.eval(result);if(Math.abs(value)<=Polynomial.TOLERANCE){break;}if(value*minValue<0){max=result;maxValue=value;}else{min=result;minValue=value;}}}return result;};
Polynomial.prototype.toString=function(){var coefs=new Array();var signs=new Array();for(var i=this.coefs.length-1;i>=0;i--){var value=this.coefs[i];if(value!=0){var sign=(value<0)?" - ":" + ";value=Math.abs(value);if(i>0)if(value==1)value="x";else value+="x";if(i>1)value+="^"+i;signs.push(sign);coefs.push(value);}}signs[0]=(signs[0]==" + ")?"":"-";var result="";for(var i=0;i<coefs.length;i++)result+=signs[i]+coefs[i];return result;};
Polynomial.prototype.getDegree=function(){return this.coefs.length-1;};
Polynomial.prototype.getDerivative=function(){var derivative=new Polynomial();for(var i=1;i<this.coefs.length;i++){derivative.coefs.push(i*this.coefs[i]);}return derivative;};
Polynomial.prototype.getRoots=function(){var result;this.simplify();switch(this.getDegree()){case 0:result=new Array();break;case 1:result=this.getLinearRoot();break;case 2:result=this.getQuadraticRoots();break;case 3:result=this.getCubicRoots();break;case 4:result=this.getQuarticRoots();break;default:result=new Array();}return result;};
Polynomial.prototype.getRootsInInterval=function(min,max){var roots=new Array();var root;if(this.getDegree()==1){root=this.bisection(min,max);if(root!=null)roots.push(root);}else{var deriv=this.getDerivative();var droots=deriv.getRootsInInterval(min,max);if(droots.length>0){root=this.bisection(min,droots[0]);if(root!=null)roots.push(root);for(i=0;i<=droots.length-2;i++){root=this.bisection(droots[i],droots[i+1]);if(root!=null)roots.push(root);}root=this.bisection(droots[droots.length-1],max);if(root!=null)roots.push(root);}else{root=this.bisection(min,max);if(root!=null)roots.push(root);}}return roots;};
Polynomial.prototype.getLinearRoot=function(){var result=new Array();var a=this.coefs[1];if(a!=0)result.push(-this.coefs[0]/a);return result;};
Polynomial.prototype.getQuadraticRoots=function(){var results=new Array();if(this.getDegree()==2){var a=this.coefs[2];var b=this.coefs[1]/a;var c=this.coefs[0]/a;var d=b*b-4*c;if(d>0){var e=Math.sqrt(d);results.push(0.5*(-b+e));results.push(0.5*(-b-e));}else if(d==0){results.push(0.5*-b);}}return results;};
Polynomial.prototype.getCubicRoots=function(){var results=new Array();if(this.getDegree()==3){var c3=this.coefs[3];var c2=this.coefs[2]/c3;var c1=this.coefs[1]/c3;var c0=this.coefs[0]/c3;var a=(3*c1-c2*c2)/3;var b=(2*c2*c2*c2-9*c1*c2+27*c0)/27;var offset=c2/3;var discrim=b*b/4 + a*a*a/27;var halfB=b/2;if(Math.abs(discrim)<=Polynomial.TOLERANCE)disrim=0;if(discrim>0){var e=Math.sqrt(discrim);var tmp;var root;tmp=-halfB+e;if(tmp>=0)root=Math.pow(tmp,1/3);else root=-Math.pow(-tmp,1/3);tmp=-halfB-e;if(tmp>=0)root+=Math.pow(tmp,1/3);else root-=Math.pow(-tmp,1/3);results.push(root-offset);}else if(discrim<0){var distance=Math.sqrt(-a/3);var angle=Math.atan2(Math.sqrt(-discrim),-halfB)/3;var cos=Math.cos(angle);var sin=Math.sin(angle);var sqrt3=Math.sqrt(3);results.push(2*distance*cos-offset);results.push(-distance*(cos+sqrt3*sin)-offset);results.push(-distance*(cos-sqrt3*sin)-offset);}else{var tmp;if(halfB>=0)tmp=-Math.pow(halfB,1/3);else tmp=Math.pow(-halfB,1/3);results.push(2*tmp-offset);results.push(-tmp-offset);}}return results;};
Polynomial.prototype.getQuarticRoots=function(){var results=new Array();if(this.getDegree()==4){var c4=this.coefs[4];var c3=this.coefs[3]/c4;var c2=this.coefs[2]/c4;var c1=this.coefs[1]/c4;var c0=this.coefs[0]/c4;var resolveRoots=new Polynomial(1,-c2,c3*c1-4*c0,-c3*c3*c0+4*c2*c0-c1*c1).getCubicRoots();var y=resolveRoots[0];var discrim=c3*c3/4-c2+y;if(Math.abs(discrim)<=Polynomial.TOLERANCE)discrim=0;if(discrim>0){var e=Math.sqrt(discrim);var t1=3*c3*c3/4-e*e-2*c2;var t2=(4*c3*c2-8*c1-c3*c3*c3)/(4*e);var plus=t1+t2;var minus=t1-t2;if(Math.abs(plus)<=Polynomial.TOLERANCE)plus=0;if(Math.abs(minus)<=Polynomial.TOLERANCE)minus=0;if(plus>=0){var f=Math.sqrt(plus);results.push(-c3/4 + (e+f)/2);results.push(-c3/4 + (e-f)/2);}if(minus>=0){var f=Math.sqrt(minus);results.push(-c3/4 + (f-e)/2);results.push(-c3/4 - (f+e)/2);}}else if(discrim<0){}else{var t2=y*y-4*c0;if(t2>=-Polynomial.TOLERANCE){if(t2<0)t2=0;t2=2*Math.sqrt(t2);t1=3*c3*c3/4-2*c2;if(t1+t2>=Polynomial.TOLERANCE){var d=Math.sqrt(t1+t2);results.push(-c3/4 + d/2);results.push(-c3/4 - d/2);}if(t1-t2>=Polynomial.TOLERANCE){var d=Math.sqrt(t1-t2);results.push(-c3/4 + d/2);results.push(-c3/4 - d/2);}}}}return results;};
function Vector2D(x,y){if(arguments.length>0){this.init(x,y);}}
Vector2D.prototype.init=function(x,y){this.x=x;this.y=y;};
Vector2D.prototype.length=function(){return Math.sqrt(this.x*this.x+this.y*this.y);};
Vector2D.prototype.dot=function(that){return this.x*that.x+this.y*that.y;};
Vector2D.prototype.cross=function(that){return this.x*that.y-this.y*that.x;}
Vector2D.prototype.unit=function(){return this.divide(this.length());};
Vector2D.prototype.unitEquals=function(){this.divideEquals(this.length());return this;};
Vector2D.prototype.add=function(that){return new Vector2D(this.x+that.x,this.y+that.y);};
Vector2D.prototype.addEquals=function(that){this.x+=that.x;this.y+=that.y;return this;};
Vector2D.prototype.subtract=function(that){return new Vector2D(this.x-that.x,this.y-that.y);};
Vector2D.prototype.subtractEquals=function(that){this.x-=that.x;this.y-=that.y;return this;};
Vector2D.prototype.multiply=function(scalar){return new Vector2D(this.x*scalar,this.y*scalar);};
Vector2D.prototype.multiplyEquals=function(scalar){this.x*=scalar;this.y*=scalar;return this;};
Vector2D.prototype.divide=function(scalar){return new Vector2D(this.x/ scalar, this.y /scalar);};
Vector2D.prototype.divideEquals=function(scalar){this.x/=scalar;this.y/=scalar;return this;};
Vector2D.prototype.perp=function(){return new Vector2D(-this.y,this.x);};
Vector2D.fromPoints=function(p1,p2){return new Vector2D(p2.x-p1.x,p2.y-p1.y);};
Shape.prototype=new EventHandler();
Shape.prototype.constructor=Shape;
Shape.superclass=EventHandler.prototype;
function Shape(svgNode){if(arguments.length>0){this.init(svgNode);}}
Shape.prototype.init=function(svgNode){this.svgNode=svgNode;this.locked=false;this.visible=true;this.selected=false;this.callback=null;this.lastUpdate=null;}
Shape.prototype.show=function(state){var display=(state)?"inline":"none";this.visible=state;this.svgNode.setAttributeNS(null,"display",display);};
Shape.prototype.refresh=function(){};
Shape.prototype.update=function(){this.refresh();if(this.owner)this.owner.update(this);if(this.callback!=null)this.callback(this);};
Shape.prototype.translate=function(delta){};
Shape.prototype.select=function(state){this.selected=state;};
Shape.prototype.registerHandles=function(){};
Shape.prototype.unregisterHandles=function(){};
Shape.prototype.selectHandles=function(select){};
Shape.prototype.showHandles=function(state){};
Shape.prototype.mousedown=function(e){if(!this.locked){if(e.shiftKey){if(this.selected){mouser.unregisterShape(this);}else{mouser.registerShape(this);this.showHandles(true);this.selectHandles(true);this.registerHandles();}}else{if(this.selected){this.selectHandles(true);this.registerHandles();}else{mouser.unregisterShapes();mouser.registerShape(this);this.showHandles(true);this.selectHandles(false);}}}};
Circle.prototype=new Shape();
Circle.prototype.constructor=Circle;
Circle.superclass=Shape.prototype;
function Circle(svgNode){if(arguments.length>0){this.init(svgNode);}}
Circle.prototype.init=function(svgNode){if(svgNode.localName=="circle"){Circle.superclass.init.call(this,svgNode);var cx=parseFloat(svgNode.getAttributeNS(null,"cx"));var cy=parseFloat(svgNode.getAttributeNS(null,"cy"));var r=parseFloat(svgNode.getAttributeNS(null,"r"));this.center=new Handle(cx,cy,this);this.last=new Point2D(cx,cy);this.radius=new Handle(cx+r,cy,this);}else{throw new Error("Circle.init: Invalid SVG Node: "+svgNode.localName);}};
Circle.prototype.realize=function(){if(this.svgNode!=null){this.center.realize();this.radius.realize();this.center.show(false);this.radius.show(false);this.svgNode.addEventListener("mousedown",this,false);}};
Circle.prototype.translate=function(delta){this.center.translate(delta);this.radius.translate(delta);this.refresh();};
Circle.prototype.refresh=function(){var r=this.radius.point.distanceFrom(this.center.point);this.svgNode.setAttributeNS(null,"cx",this.center.point.x);this.svgNode.setAttributeNS(null,"cy",this.center.point.y);this.svgNode.setAttributeNS(null,"r",r);};
Circle.prototype.registerHandles=function(){mouser.register(this.center);mouser.register(this.radius);};
Circle.prototype.unregisterHandles=function(){mouser.unregister(this.center);mouser.unregister(this.radius);};
Circle.prototype.selectHandles=function(select){this.center.select(select);this.radius.select(select);};
Circle.prototype.showHandles=function(state){this.center.show(state);this.radius.show(state);};
Circle.prototype.getIntersectionParams=function(){return new IntersectionParams("Circle",[this.center.point,parseFloat(this.svgNode.getAttributeNS(null,"r"))]);};
Ellipse.prototype=new Shape();
Ellipse.prototype.constructor=Ellipse;
Ellipse.superclass=Shape.prototype;
function Ellipse(svgNode){if(arguments.length>0){this.init(svgNode);}}
Ellipse.prototype.init=function(svgNode){if(svgNode==null||svgNode.localName!="ellipse")throw new Error("Ellipse.init: Invalid localName: "+svgNode.localName);Ellipse.superclass.init.call(this,svgNode);var cx=parseFloat(svgNode.getAttributeNS(null,"cx"));var cy=parseFloat(svgNode.getAttributeNS(null,"cy"));var rx=parseFloat(svgNode.getAttributeNS(null,"rx"));var ry=parseFloat(svgNode.getAttributeNS(null,"ry"));this.center=new Handle(cx,cy,this);this.radiusX=new Handle(cx+rx,cy,this);this.radiusY=new Handle(cx,cy+ry,this);};
Ellipse.prototype.realize=function(){this.center.realize();this.radiusX.realize();this.radiusY.realize();this.center.show(false);this.radiusX.show(false);this.radiusY.show(false);this.svgNode.addEventListener("mousedown",this,false);};
Ellipse.prototype.refresh=function(){var rx=Math.abs(this.center.point.x-this.radiusX.point.x);var ry=Math.abs(this.center.point.y-this.radiusY.point.y);this.svgNode.setAttributeNS(null,"cx",this.center.point.x);this.svgNode.setAttributeNS(null,"cy",this.center.point.y);this.svgNode.setAttributeNS(null,"rx",rx);this.svgNode.setAttributeNS(null,"ry",ry);};
Ellipse.prototype.registerHandles=function(){mouser.register(this.center);mouser.register(this.radiusX);mouser.register(this.radiusY);};
Ellipse.prototype.unregisterHandles=function(){mouser.unregister(this.center);mouser.unregister(this.radiusX);mouser.unregister(this.radiusY);};
Ellipse.prototype.selectHandles=function(select){this.center.select(select);this.radiusX.select(select);this.radiusY.select(select);};
Ellipse.prototype.showHandles=function(state){this.center.show(state);this.radiusX.show(state);this.radiusY.show(state);};
Ellipse.prototype.getIntersectionParams=function(){return new IntersectionParams("Ellipse",[this.center.point,parseFloat(this.svgNode.getAttributeNS(null,"rx")),parseFloat(this.svgNode.getAttributeNS(null,"ry"))]);};
Handle.prototype=new Shape();
Handle.prototype.constructor=Handle;
Handle.superclass=Shape.prototype;
Handle.NO_CONSTRAINTS=0;
Handle.CONSTRAIN_X=1;
Handle.CONSTRAIN_Y=2;
function Handle(x,y,owner){if(arguments.length>0){this.init(x,y,owner);}}
Handle.prototype.init=function(x,y,owner){Handle.superclass.init.call(this,null);this.point=new Point2D(x,y);this.owner=owner;this.constrain=Handle.NO_CONSTRAINTS;}
Handle.prototype.realize=function(){if(this.svgNode==null){var svgns="http://www.w3.org/2000/svg";var handle=svgDocument.createElementNS(svgns,"rect");var parent;if(this.owner!=null&&this.owner.svgNode!=null){parent=this.owner.svgNode.parentNode;}else{parent=svgDocument.documentElement;}handle.setAttributeNS(null,"x",this.point.x-2);handle.setAttributeNS(null,"y",this.point.y-2);handle.setAttributeNS(null,"width",4);handle.setAttributeNS(null,"height",4);handle.setAttributeNS(null,"stroke","black");handle.setAttributeNS(null,"fill","white");handle.addEventListener("mousedown",this,false);parent.appendChild(handle);this.svgNode=handle;this.show(this.visible);}};
Handle.prototype.unrealize=function(){this.svgNode.removeEventListener("mousedown",this,false);this.svgNode.parentNode.removeChild(this.svgNode);};
Handle.prototype.translate=function(delta){if(this.constrain==Handle.CONSTRAIN_X){this.point.x+=delta.x;}else if(this.constrain==Handle.CONSTRAIN_Y){this.point.y+=delta.y;}else{this.point.addEquals(delta);}this.refresh();};
Handle.prototype.refresh=function(){this.svgNode.setAttributeNS(null,"x",this.point.x-2);this.svgNode.setAttributeNS(null,"y",this.point.y-2);};
Handle.prototype.select=function(state){Handle.superclass.select.call(this,state);if(state){this.svgNode.setAttributeNS(null,"fill","black");}else{this.svgNode.setAttributeNS(null,"fill","white");}};
Handle.prototype.mousedown=function(e){if(!this.locked){if(e.shiftKey){if(this.selected){mouser.unregister(this);}else{mouser.register(this);mouser.beginDrag(e);}}else{if(!this.selected){var owner=this.owner;mouser.unregisterAll();mouser.register(this);}mouser.beginDrag(e);}}};
Lever.prototype=new Shape();
Lever.prototype.constructor=Lever;
Lever.superclass=Shape.prototype;
function Lever(x1,y1,x2,y2,owner){if(arguments.length>0){this.init(x1,y1,x2,y2,owner);}}
Lever.prototype.init=function(x1,y1,x2,y2,owner){Lever.superclass.init.call(this,null);this.point=new Handle(x1,y1,this);this.lever=new LeverHandle(x2,y2,this);this.owner=owner;};
Lever.prototype.realize=function(){if(this.svgNode==null){var svgns="http://www.w3.org/2000/svg";var line=svgDocument.createElementNS(svgns,"line");var parent;if(this.owner!=null&&this.owner.svgNode!=null){parent=this.owner.svgNode.parentNode;}else{parent=svgDocument.documentElement;}line.setAttributeNS(null,"x1",this.point.point.x);line.setAttributeNS(null,"y1",this.point.point.y);line.setAttributeNS(null,"x2",this.lever.point.x);line.setAttributeNS(null,"y2",this.lever.point.y);line.setAttributeNS(null,"stroke","black");parent.appendChild(line);this.svgNode=line;this.point.realize();this.lever.realize();this.show(this.visible);}};
Lever.prototype.refresh=function(){this.svgNode.setAttributeNS(null,"x1",this.point.point.x);this.svgNode.setAttributeNS(null,"y1",this.point.point.y);this.svgNode.setAttributeNS(null,"x2",this.lever.point.x);this.svgNode.setAttributeNS(null,"y2",this.lever.point.y);};
LeverHandle.prototype=new Handle();
LeverHandle.prototype.constructor=LeverHandle;
LeverHandle.superclass=Handle.prototype;
function LeverHandle(x,y,owner){if(arguments.length>0){this.init(x,y,owner);}}
LeverHandle.prototype.realize=function(){if(this.svgNode==null){var svgns="http://www.w3.org/2000/svg";var handle=svgDocument.createElementNS(svgns,"circle");var parent;if(this.owner!=null&&this.owner.svgNode!=null){parent=this.owner.svgNode.parentNode;}else{parent=svgDocument.documentElement;}handle.setAttributeNS(null,"cx",this.point.x);handle.setAttributeNS(null,"cy",this.point.y);handle.setAttributeNS(null,"r",2.5);handle.setAttributeNS(null,"fill","black");handle.addEventListener("mousedown",this,false);parent.appendChild(handle);this.svgNode=handle;this.show(this.visible);}};
LeverHandle.prototype.refresh=function(){this.svgNode.setAttributeNS(null,"cx",this.point.x);this.svgNode.setAttributeNS(null,"cy",this.point.y);};
LeverHandle.prototype.select=function(state){LeverHandle.superclass.select.call(this,state);this.svgNode.setAttributeNS(null,"fill","black");};
Line.prototype=new Shape();
Line.prototype.constructor=Line;
Line.superclass=Shape.prototype;
function Line(svgNode){if(arguments.length>0){this.init(svgNode);}}
Line.prototype.init=function(svgNode){if(svgNode==null||svgNode.localName!="line")throw new Error("Line.init: Invalid localName: "+svgNode.localName);Line.superclass.init.call(this,svgNode);var x1=parseFloat(svgNode.getAttributeNS(null,"x1"));var y1=parseFloat(svgNode.getAttributeNS(null,"y1"));var x2=parseFloat(svgNode.getAttributeNS(null,"x2"));var y2=parseFloat(svgNode.getAttributeNS(null,"y2"));this.p1=new Handle(x1,y1,this);this.p2=new Handle(x2,y2,this);};
Line.prototype.realize=function(){this.p1.realize();this.p2.realize();this.p1.show(false);this.p2.show(false);this.svgNode.addEventListener("mousedown",this,false);};
Line.prototype.refresh=function(){this.svgNode.setAttributeNS(null,"x1",this.p1.point.x);this.svgNode.setAttributeNS(null,"y1",this.p1.point.y);this.svgNode.setAttributeNS(null,"x2",this.p2.point.x);this.svgNode.setAttributeNS(null,"y2",this.p2.point.y);};
Line.prototype.registerHandles=function(){mouser.register(this.p1);mouser.register(this.p2);};
Line.prototype.unregisterHandles=function(){mouser.unregister(this.p1);mouser.unregister(this.p2);};
Line.prototype.selectHandles=function(select){this.p1.select(select);this.p2.select(select);};
Line.prototype.showHandles=function(state){this.p1.show(state);this.p2.show(state);};
Line.prototype.cut=function(t){var cutPoint=this.p1.point.lerp(this.p2.point,t);var newLine=this.svgNode.cloneNode(true);this.p2.point.setFromPoint(cutPoint);this.p2.update();if(this.svgNode.nextSibling!=null)this.svgNode.parentNode.insertBefore(newLine,this.svgNode.nextSibling);else this.svgNode.parentNode.appendChild(newLine);var line=new Line(newLine);line.realize();line.p1.point.setFromPoint(cutPoint);line.p1.update();};
Line.prototype.getIntersectionParams=function(){return new IntersectionParams("Line",[this.p1.point,this.p2.point]);};
function Token(type,text){if(arguments.length>0){this.init(type,text);}}
Token.prototype.init=function(type,text){this.type=type;this.text=text;};
Token.prototype.typeis=function(type){return this.type==type;}
Path.prototype=new Shape();
Path.prototype.constructor=Path;
Path.superclass=Shape.prototype;
Path.COMMAND=0;
Path.NUMBER=1;
Path.EOD=2;
Path.PARAMS={A:["rx","ry","x-axis-rotation","large-arc-flag","sweep-flag","x","y"],a:["rx","ry","x-axis-rotation","large-arc-flag","sweep-flag","x","y"],C:["x1","y1","x2","y2","x","y"],c:["x1","y1","x2","y2","x","y"],H:["x"],h:["x"],L:["x","y"],l:["x","y"],M:["x","y"],m:["x","y"],Q:["x1","y1","x","y"],q:["x1","y1","x","y"],S:["x2","y2","x","y"],s:["x2","y2","x","y"],T:["x","y"],t:["x","y"],V:["y"],v:["y"],Z:[],z:[]};
function Path(svgNode){if(arguments.length>0){this.init(svgNode);}}
Path.prototype.init=function(svgNode){if(svgNode==null||svgNode.localName!="path")throw new Error("Path.init: Invalid localName: "+svgNode.localName);Path.superclass.init.call(this,svgNode);this.segments=null;this.parseData(svgNode.getAttributeNS(null,"d"));};
Path.prototype.realize=function(){for(var i=0;i<this.segments.length;i++){this.segments[i].realize();}this.svgNode.addEventListener("mousedown",this,false);};
Path.prototype.unrealize=function(){for(var i=0;i<this.segments.length;i++){this.segments[i].unrealize();}this.svgNode.removeEventListener("mousedown",this,false);};
Path.prototype.refresh=function(){var d=new Array();for(var i=0;i<this.segments.length;i++){d.push(this.segments[i].toString());}this.svgNode.setAttributeNS(null,"d",d.join(" "));};
Path.prototype.registerHandles=function(){for(var i=0;i<this.segments.length;i++){this.segments[i].registerHandles();}};
Path.prototype.unregisterHandles=function(){for(var i=0;i<this.segments.length;i++){this.segments[i].unregisterHandles();}};
Path.prototype.selectHandles=function(select){for(var i=0;i<this.segments.length;i++){this.segments[i].selectHandles(select);}};
Path.prototype.showHandles=function(state){for(var i=0;i<this.segments.length;i++){this.segments[i].showHandles(state);}};
Path.prototype.appendPathSegment=function(segment){segment.previous=this.segments[this.segments.length-1];this.segments.push(segment);};
Path.prototype.parseData=function(d){var tokens=this.tokenize(d);var index=0;var token=tokens[index];var mode="BOD";this.segments=new Array();while(!token.typeis(Path.EOD)){var param_length;var params=new Array();if(mode=="BOD"){if(token.text=="M"||token.text=="m"){index++;param_length=Path.PARAMS[token.text].length;mode=token.text;}else{throw new Error("Path data must begin with a moveto command");}}else{if(token.typeis(Path.NUMBER)){param_length=Path.PARAMS[mode].length;}else{index++;param_length=Path.PARAMS[token.text].length;mode=token.text;}}if((index+param_length)<tokens.length){for(var i=index;i<index+param_length;i++){var number=tokens[i];if(number.typeis(Path.NUMBER))params[params.length]=number.text;else throw new Error("Parameter type is not a number: "+mode+","+number.text);}var segment;var length=this.segments.length;var previous=(length==0)?null:this.segments[length-1];switch(mode){case"A":segment=new AbsoluteArcPath(params,this,previous);break;case"C":segment=new AbsoluteCurveto3(params,this,previous);break;case"c":segment=new RelativeCurveto3(params,this,previous);break;case"H":segment=new AbsoluteHLineto(params,this,previous);break;case"L":segment=new AbsoluteLineto(params,this,previous);break;case"l":segment=new RelativeLineto(params,this,previous);break;case"M":segment=new AbsoluteMoveto(params,this,previous);break;case"m":segment=new RelativeMoveto(params,this,previous);break;case"Q":segment=new AbsoluteCurveto2(params,this,previous);break;case"q":segment=new RelativeCurveto2(params,this,previous);break;case"S":segment=new AbsoluteSmoothCurveto3(params,this,previous);break;case"s":segment=new RelativeSmoothCurveto3(params,this,previous);break;case"T":segment=new AbsoluteSmoothCurveto2(params,this,previous);break;case"t":segment=new RelativeSmoothCurveto2(params,this,previous);break;case"Z":segment=new RelativeClosePath(params,this,previous);break;case"z":segment=new RelativeClosePath(params,this,previous);break;default:throw new Error("Unsupported segment type: "+mode);};this.segments.push(segment);index+=param_length;token=tokens[index];if(mode=="M")mode="L";if(mode=="m")mode="l";}else{throw new Error("Path data ended before all parameters were found");}}}
Path.prototype.tokenize=function(d){var tokens=new Array();while(d!=""){if(d.match(/^([ \t\r\n,]+)/)){d=d.substr(RegExp.$1.length);}else if(d.match(/^([aAcChHlLmMqQsStTvVzZ])/)){tokens[tokens.length]=new Token(Path.COMMAND,RegExp.$1);d=d.substr(RegExp.$1.length);}else if(d.match(/^(([-+]?[0-9]+(\.[0-9]*)?|[-+]?\.[0-9]+)([eE][-+]?[0-9]+)?)/)){tokens[tokens.length]=new Token(Path.NUMBER,parseFloat(RegExp.$1));d=d.substr(RegExp.$1.length);}else{throw new Error("Unrecognized segment command: "+d);}}tokens[tokens.length]=new Token(Path.EOD,null);return tokens;}
Path.prototype.intersectShape=function(shape){var result=new Intersection("No Intersection");for(var i=0;i<this.segments.length;i++){var inter=Intersection.intersectShapes(this.segments[i],shape);result.appendPoints(inter.points);}if(result.points.length>0)result.status="Intersection";return result;};
Path.prototype.getIntersectionParams=function(){return new IntersectionParams("Path",[]);};
function AbsolutePathSegment(command,params,owner,previous){if(arguments.length>0)this.init(command,params,owner,previous);};
AbsolutePathSegment.prototype.init=function(command,params,owner,previous){this.command=command;this.owner=owner;this.previous=previous;this.handles=new Array();var index=0;while(index<params.length){var handle=new Handle(params[index],params[index+1],owner);this.handles.push(handle);index+=2;}};
AbsolutePathSegment.prototype.realize=function(){for(var i=0;i<this.handles.length;i++){var handle=this.handles[i];handle.realize();handle.show(false);}};
AbsolutePathSegment.prototype.unrealize=function(){for(var i=0;i<this.handles.length;i++){this.handles[i].unrealize();}};
AbsolutePathSegment.prototype.registerHandles=function(){for(var i=0;i<this.handles.length;i++){mouser.register(this.handles[i]);}};
AbsolutePathSegment.prototype.unregisterHandles=function(){for(var i=0;i<this.handles.length;i++){mouser.unregister(this.handles[i]);}};
AbsolutePathSegment.prototype.selectHandles=function(select){for(var i=0;i<this.handles.length;i++){this.handles[i].select(select);}};
AbsolutePathSegment.prototype.showHandles=function(state){for(var i=0;i<this.handles.length;i++){this.handles[i].show(state);}};
AbsolutePathSegment.prototype.toString=function(){var points=new Array();var command="";if(this.previous==null||this.previous.constructor!=this.constuctor)command=this.command;for(var i=0;i<this.handles.length;i++){points.push(this.handles[i].point.toString());}return command+points.join(" ");};
AbsolutePathSegment.prototype.getLastPoint=function(){return this.handles[this.handles.length-1].point;};
AbsolutePathSegment.prototype.getIntersectionParams=function(){return null;};
AbsoluteArcPath.prototype=new AbsolutePathSegment();
AbsoluteArcPath.prototype.constructor=AbsoluteArcPath;
AbsoluteArcPath.superclass=AbsolutePathSegment.prototype;
function AbsoluteArcPath(params,owner,previous){if(arguments.length>0){this.init("A",params,owner,previous);}}
AbsoluteArcPath.prototype.init=function(command,params,owner,previous){var point=new Array();var y=params.pop();var x=params.pop();point.push(x,y);AbsoluteArcPath.superclass.init.call(this,command,point,owner,previous);this.rx=parseFloat(params.shift());this.ry=parseFloat(params.shift());this.angle=parseFloat(params.shift());this.arcFlag=parseFloat(params.shift());this.sweepFlag=parseFloat(params.shift());};
AbsoluteArcPath.prototype.toString=function(){var points=new Array();var command="";if(this.previous.constructor!=this.constuctor)command=this.command;return command+[this.rx,this.ry,this.angle,this.arcFlag,this.sweepFlag,this.handles[0].point.toString()].join(",");};
AbsoluteArcPath.prototype.getIntersectionParams=function(){return new IntersectionParams("Ellipse",[this.getCenter(),this.rx,this.ry]);};
AbsoluteArcPath.prototype.getCenter=function(){var startPoint=this.previous.getLastPoint();var endPoint=this.handles[0].point;var rx=this.rx;var ry=this.ry;var angle=this.angle*Math.PI/180;var c=Math.cos(angle);var s=Math.sin(angle);var TOLERANCE=1e-6;var halfDiff=startPoint.subtract(endPoint).divide(2);var x1p=halfDiff.x*c+halfDiff.y*s;var y1p=halfDiff.x*-s+halfDiff.y*c;var x1px1p=x1p*x1p;var y1py1p=y1p*y1p;var lambda=(x1px1p/ (rx*rx) ) + ( y1py1p /(ry*ry));if(lambda>1){var factor=Math.sqrt(lambda);rx*=factor;ry*=factor;}var rxrx=rx*rx;var ryry=ry*ry;var rxy1=rxrx*y1py1p;var ryx1=ryry*x1px1p;var factor=(rxrx*ryry-rxy1-ryx1)/(rxy1+ryx1);if(Math.abs(factor)<TOLERANCE)factor=0;var sq=Math.sqrt(factor);if(this.arcFlag==this.sweepFlag)sq=-sq;var mid=startPoint.add(endPoint).divide(2);var cxp=sq*rx*y1p/ry;var cyp=sq*-ry*x1p/rx;return new Point2D(cxp*c-cyp*s+mid.x,cxp*s+cyp*c+mid.y);};
AbsoluteCurveto2.prototype=new AbsolutePathSegment();
AbsoluteCurveto2.prototype.constructor=AbsoluteCurveto2;
AbsoluteCurveto2.superclass=AbsolutePathSegment.prototype;
function AbsoluteCurveto2(params,owner,previous){if(arguments.length>0){this.init("Q",params,owner,previous);}}
AbsoluteCurveto2.prototype.getControlPoint=function(){return this.handles[0].point;};
AbsoluteCurveto2.prototype.getIntersectionParams=function(){return new IntersectionParams("Bezier2",[this.previous.getLastPoint(),this.handles[0].point,this.handles[1].point]);};
AbsoluteCurveto3.prototype=new AbsolutePathSegment();
AbsoluteCurveto3.prototype.constructor=AbsoluteCurveto3;
AbsoluteCurveto3.superclass=AbsolutePathSegment.prototype;
function AbsoluteCurveto3(params,owner,previous){if(arguments.length>0){this.init("C",params,owner,previous);}}
AbsoluteCurveto3.prototype.getLastControlPoint=function(){return this.handles[1].point;};
AbsoluteCurveto3.prototype.getIntersectionParams=function(){return new IntersectionParams("Bezier3",[this.previous.getLastPoint(),this.handles[0].point,this.handles[1].point,this.handles[2].point]);};
AbsoluteHLineto.prototype=new AbsolutePathSegment();
AbsoluteHLineto.prototype.constructor=AbsoluteHLineto;
AbsoluteHLineto.superclass=AbsolutePathSegment.prototype;
function AbsoluteHLineto(params,owner,previous){if(arguments.length>0){this.init("H",params,owner,previous);}}
AbsoluteHLineto.prototype.init=function(command,params,owner,previous){var prevPoint=previous.getLastPoint();var point=new Array();point.push(params.pop(),prevPoint.y);AbsoluteHLineto.superclass.init.call(this,command,point,owner,previous);};
AbsoluteHLineto.prototype.toString=function(){var points=new Array();var command="";if(this.previous.constructor!=this.constuctor)command=this.command;return command+this.handles[0].point.x;};
AbsoluteLineto.prototype=new AbsolutePathSegment();
AbsoluteLineto.prototype.constructor=AbsoluteLineto;
AbsoluteLineto.superclass=AbsolutePathSegment.prototype;
function AbsoluteLineto(params,owner,previous){if(arguments.length>0){this.init("L",params,owner,previous);}}
AbsoluteLineto.prototype.toString=function(){var points=new Array();var command="";if(this.previous.constructor!=this.constuctor)if(this.previous.constructor!=AbsoluteMoveto)command=this.command;return command+this.handles[0].point.toString();};
AbsoluteLineto.prototype.getIntersectionParams=function(){return new IntersectionParams("Line",[this.previous.getLastPoint(),this.handles[0].point]);};
AbsoluteMoveto.prototype=new AbsolutePathSegment();
AbsoluteMoveto.prototype.constructor=AbsoluteMoveto;
AbsoluteMoveto.superclass=AbsolutePathSegment.prototype;
function AbsoluteMoveto(params,owner,previous){if(arguments.length>0){this.init("M",params,owner,previous);}}
AbsoluteMoveto.prototype.toString=function(){return"M"+this.handles[0].point.toString();};
AbsoluteSmoothCurveto2.prototype=new AbsolutePathSegment();
AbsoluteSmoothCurveto2.prototype.constructor=AbsoluteSmoothCurveto2;
AbsoluteSmoothCurveto2.superclass=AbsolutePathSegment.prototype;
function AbsoluteSmoothCurveto2(params,owner,previous){if(arguments.length>0){this.init("T",params,owner,previous);}}
AbsoluteSmoothCurveto2.prototype.getControlPoint=function(){var lastPoint=this.previous.getLastPoint();var point;if(this.previous.command.match(/^[QqTt]$/)){var ctrlPoint=this.previous.getControlPoint();var diff=ctrlPoint.subtract(lastPoint);point=lastPoint.subtract(diff);}else{point=lastPoint;}return point;};
AbsoluteSmoothCurveto2.prototype.getIntersectionParams=function(){return new IntersectionParams("Bezier2",[this.previous.getLastPoint(),this.getControlPoint(),this.handles[0].point]);};
AbsoluteSmoothCurveto3.prototype=new AbsolutePathSegment();
AbsoluteSmoothCurveto3.prototype.constructor=AbsoluteSmoothCurveto3;
AbsoluteSmoothCurveto3.superclass=AbsolutePathSegment.prototype;
function AbsoluteSmoothCurveto3(params,owner,previous){if(arguments.length>0){this.init("S",params,owner,previous);}}
AbsoluteSmoothCurveto3.prototype.getFirstControlPoint=function(){var lastPoint=this.previous.getLastPoint();var point;if(this.previous.command.match(/^[SsCc]$/)){var lastControl=this.previous.getLastControlPoint();var diff=lastControl.subtract(lastPoint);point=lastPoint.subtract(diff);}else{point=lastPoint;}return point;};
AbsoluteSmoothCurveto3.prototype.getLastControlPoint=function(){return this.handles[0].point;};
AbsoluteSmoothCurveto3.prototype.getIntersectionParams=function(){return new IntersectionParams("Bezier3",[this.previous.getLastPoint(),this.getFirstControlPoint(),this.handles[0].point,this.handles[1].point]);};
RelativePathSegment.prototype=new AbsolutePathSegment();
RelativePathSegment.prototype.constructor=RelativePathSegment;
RelativePathSegment.superclass=AbsolutePathSegment.prototype;
function RelativePathSegment(command,params,owner,previous){if(arguments.length>0)this.init(command,params,owner,previous);}
RelativePathSegment.prototype.init=function(command,params,owner,previous){this.command=command;this.owner=owner;this.previous=previous;this.handles=new Array();var lastPoint;if(this.previous)lastPoint=this.previous.getLastPoint();else lastPoint=new Point2D(0,0);var index=0;while(index<params.length){var handle=new Handle(lastPoint.x+params[index],lastPoint.y+params[index+1],owner);this.handles.push(handle);index+=2;}};
RelativePathSegment.prototype.toString=function(){var points=new Array();var command="";var lastPoint;if(this.previous)lastPoint=this.previous.getLastPoint();else lastPoint=new Point2D(0,0);if(this.previous==null||this.previous.constructor!=this.constructor)command=this.command;for(var i=0;i<this.handles.length;i++){var point=this.handles[i].point.subtract(lastPoint);points.push(point.toString());}return command+points.join(" ");};
RelativeClosePath.prototype=new RelativePathSegment();
RelativeClosePath.prototype.constructor=RelativeClosePath;
RelativeClosePath.superclass=RelativePathSegment.prototype;
function RelativeClosePath(params,owner,previous){if(arguments.length>0){this.init("z",params,owner,previous);}}
RelativeClosePath.prototype.getLastPoint=function(){var current=this.previous;var point;while(current){if(current.command.match(/^[mMzZ]$/)){point=current.getLastPoint();break;}current=current.previous;}return point;};
RelativeClosePath.prototype.getIntersectionParams=function(){return new IntersectionParams("Line",[this.previous.getLastPoint(),this.getLastPoint()]);};
RelativeCurveto2.prototype=new RelativePathSegment();
RelativeCurveto2.prototype.constructor=RelativeCurveto2;
RelativeCurveto2.superclass=RelativePathSegment.prototype;
function RelativeCurveto2(params,owner,previous){if(arguments.length>0){this.init("q",params,owner,previous);}}
RelativeCurveto2.prototype.getControlPoint=function(){return this.handles[0].point;};
RelativeCurveto2.prototype.getIntersectionParams=function(){return new IntersectionParams("Bezier2",[this.previous.getLastPoint(),this.handles[0].point,this.handles[1].point]);};
RelativeCurveto3.prototype=new RelativePathSegment();
RelativeCurveto3.prototype.constructor=RelativeCurveto3;
RelativeCurveto3.superclass=RelativePathSegment.prototype;
function RelativeCurveto3(params,owner,previous){if(arguments.length>0){this.init("c",params,owner,previous);}}
RelativeCurveto3.prototype.getLastControlPoint=function(){return this.handles[1].point;};
RelativeCurveto3.prototype.getIntersectionParams=function(){return new IntersectionParams("Bezier3",[this.previous.getLastPoint(),this.handles[0].point,this.handles[1].point,this.handles[2].point]);};
RelativeLineto.prototype=new RelativePathSegment();
RelativeLineto.prototype.constructor=RelativeLineto;
RelativeLineto.superclass=RelativePathSegment.prototype;
function RelativeLineto(params,owner,previous){if(arguments.length>0){this.init("l",params,owner,previous);}}
RelativeLineto.prototype.toString=function(){var points=new Array();var command="";var lastPoint;var point;if(this.previous)lastPoint=this.previous.getLastPoint();else lastPoint=new Point(0,0);point=this.handles[0].point.subtract(lastPoint);if(this.previous.constructor!=this.constuctor)if(this.previous.constructor!=RelativeMoveto)cmd=this.command;return cmd+point.toString();};
RelativeLineto.prototype.getIntersectionParams=function(){return new IntersectionParams("Line",[this.previous.getLastPoint(),this.handles[0].point]);};
RelativeMoveto.prototype=new RelativePathSegment();
RelativeMoveto.prototype.constructor=RelativeMoveto;
RelativeMoveto.superclass=RelativePathSegment.prototype;
function RelativeMoveto(params,owner,previous){if(arguments.length>0){this.init("m",params,owner,previous);}}
RelativeMoveto.prototype.toString=function(){return"m"+this.handles[0].point.toString();};
RelativeSmoothCurveto2.prototype=new RelativePathSegment();
RelativeSmoothCurveto2.prototype.constructor=RelativeSmoothCurveto2;
RelativeSmoothCurveto2.superclass=RelativePathSegment.prototype;
function RelativeSmoothCurveto2(params,owner,previous){if(arguments.length>0){this.init("t",params,owner,previous);}}
RelativeSmoothCurveto2.prototype.getControlPoint=function(){var lastPoint=this.previous.getLastPoint();var point;if(this.previous.command.match(/^[QqTt]$/)){var ctrlPoint=this.previous.getControlPoint();var diff=ctrlPoint.subtract(lastPoint);point=lastPoint.subtract(diff);}else{point=lastPoint;}return point;};
RelativeSmoothCurveto2.prototype.getIntersectionParams=function(){return new IntersectionParams("Bezier2",[this.previous.getLastPoint(),this.getControlPoint(),this.handles[0].point]);};
RelativeSmoothCurveto3.prototype=new RelativePathSegment();
RelativeSmoothCurveto3.prototype.constructor=RelativeSmoothCurveto3;
RelativeSmoothCurveto3.superclass=RelativePathSegment.prototype;
function RelativeSmoothCurveto3(params,owner,previous){if(arguments.length>0){this.init("s",params,owner,previous);}}
RelativeSmoothCurveto3.prototype.getFirstControlPoint=function(){var lastPoint=this.previous.getLastPoint();var point;if(this.previous.command.match(/^[SsCc]$/)){var lastControl=this.previous.getLastControlPoint();var diff=lastControl.subtract(lastPoint);point=lastPoint.subtract(diff);}else{point=lastPoint;}return point;};
RelativeSmoothCurveto3.prototype.getLastControlPoint=function(){return this.handles[0].point;};
RelativeSmoothCurveto3.prototype.getIntersectionParams=function(){return new IntersectionParams("Bezier3",[this.previous.getLastPoint(),this.getFirstControlPoint(),this.handles[0].point,this.handles[1].point]);};
Polygon.prototype=new Shape();
Polygon.prototype.constructor=Polygon;
Polygon.superclass=Shape.prototype;
function Polygon(svgNode){if(arguments.length>0){this.init(svgNode);}}
Polygon.prototype.init=function(svgNode){if(svgNode.localName=="polygon"){Polygon.superclass.init.call(this,svgNode);var points=svgNode.getAttributeNS(null,"points").split(/[\s,]+/);this.handles=new Array();for(var i=0;i<points.length;i+=2){var x=parseFloat(points[i]);var y=parseFloat(points[i+1]);this.handles.push(new Handle(x,y,this));}}else{throw new Error("Polygon.init: Invalid SVG Node: "+svgNode.localName);}};
Polygon.prototype.realize=function(){if(this.svgNode!=null){for(var i=0;i<this.handles.length;i++){this.handles[i].realize();this.handles[i].show(false);}this.svgNode.addEventListener("mousedown",this,false);}};
Polygon.prototype.refresh=function(){var points=new Array();for(var i=0;i<this.handles.length;i++){points.push(this.handles[i].point.toString());}this.svgNode.setAttributeNS(null,"points",points.join(" "));};
Polygon.prototype.registerHandles=function(){for(var i=0;i<this.handles.length;i++)mouser.register(this.handles[i]);};
Polygon.prototype.unregisterHandles=function(){for(var i=0;i<this.handles.length;i++)mouser.unregister(this.handles[i]);};
Polygon.prototype.selectHandles=function(select){for(var i=0;i<this.handles.length;i++)this.handles[i].select(select);};
Polygon.prototype.showHandles=function(state){for(var i=0;i<this.handles.length;i++)this.handles[i].show(state);};
Polygon.prototype.pointInPolygon=function(point){var length=this.handles.length;var counter=0;var x_inter;var p1=this.handles[0].point;for(var i=1;i<=length;i++){var p2=this.handles[i%length].point;if(point.y>Math.min(p1.y,p2.y)){if(point.y<=Math.max(p1.y,p2.y)){if(point.x<=Math.max(p1.x,p2.x)){if(p1.y!=p2.y){x_inter=(point.y-p1.y)*(p2.x-p1.x)/(p2.y-p1.y)+p1.x;if(p1.x==p2.x||point.x<=x_inter){counter++;}}}}}p1=p2;}return(counter%2==1);};
Polygon.prototype.getIntersectionParams=function(){var points=new Array();for(var i=0;i<this.handles.length;i++){points.push(this.handles[i].point);}return new IntersectionParams("Polygon",[points]);};
Polygon.prototype.getArea=function(){var area=0;var length=this.handles.length;var neg=0;var pos=0;for(var i=0;i<length;i++){var h1=this.handles[i].point;var h2=this.handles[(i+1)%length].point;area+=(h1.x*h2.y-h2.x*h1.y);}return area/2;};
Polygon.prototype.getCentroid=function(){var length=this.handles.length;var area6x=6*this.getArea();var x_sum=0;var y_sum=0;for(var i=0;i<length;i++){var p1=this.handles[i].point;var p2=this.handles[(i+1)%length].point;var cross=(p1.x*p2.y-p2.x*p1.y);x_sum+=(p1.x+p2.x)*cross;y_sum+=(p1.y+p2.y)*cross;}return new Point2D(x_sum/ area6x, y_sum /area6x);};
Polygon.prototype.isClockwise=function(){return this.getArea()<0;};
Polygon.prototype.isCounterClockwise=function(){return this.getArea()>0;};
Polygon.prototype.isConcave=function(){var positive=0;var negative=0;var length=this.handles.length;for(var i=0;i<length;i++){var p0=this.handles[i].point;var p1=this.handles[(i+1)%length].point;var p2=this.handles[(i+2)%length].point;var v0=Vector2D.fromPoints(p0,p1);var v1=Vector2D.fromPoints(p1,p2);var cross=v0.cross(v1);if(cross<0){negative++;}else{positive++;}}return(negative!=0&&positive!=0);};
Polygon.prototype.isConvex=function(){return!this.isConcave();};
Rectangle.prototype=new Shape();
Rectangle.prototype.constructor=Rectangle;
Rectangle.superclass=Shape.prototype;
function Rectangle(svgNode){if(arguments.length>0){this.init(svgNode);}}
Rectangle.prototype.init=function(svgNode){if(svgNode.localName=="rect"){Rectangle.superclass.init.call(this,svgNode);var x=parseFloat(svgNode.getAttributeNS(null,"x"));var y=parseFloat(svgNode.getAttributeNS(null,"y"));var width=parseFloat(svgNode.getAttributeNS(null,"width"));var height=parseFloat(svgNode.getAttributeNS(null,"height"));this.p1=new Handle(x,y,this);this.p2=new Handle(x+width,y+height,this);}else{throw new Error("Rectangle.init: Invalid SVG Node: "+svgNode.localName);}};
Rectangle.prototype.realize=function(){if(this.svgNode!=null){this.p1.realize();this.p2.realize();this.p1.show(false);this.p2.show(false);this.svgNode.addEventListener("mousedown",this,false);}};
Rectangle.prototype.refresh=function(){var min=this.p1.point.min(this.p2.point);var max=this.p1.point.max(this.p2.point);this.svgNode.setAttributeNS(null,"x",min.x);this.svgNode.setAttributeNS(null,"y",min.y);this.svgNode.setAttributeNS(null,"width",max.x-min.x);this.svgNode.setAttributeNS(null,"height",max.y-min.y);};
Rectangle.prototype.registerHandles=function(){mouser.register(this.p1);mouser.register(this.p2);};
Rectangle.prototype.unregisterHandles=function(){mouser.unregister(this.p1);mouser.unregister(this.p2);};
Rectangle.prototype.selectHandles=function(select){this.p1.select(select);this.p2.select(select);};
Rectangle.prototype.showHandles=function(state){this.p1.show(state);this.p2.show(state);};
Rectangle.prototype.getIntersectionParams=function(){return new IntersectionParams("Rectangle",[this.p1.point,this.p2.point]);};

/*****
 *
 *   Intersection.js
 *
 *   copyright 2002, Kevin Lindsey
 *
 *****/

/*****
 *
 *   constructor
 *
 *****/
function Intersection(status) {
    if ( arguments.length > 0 ) {
        this.init(status);
    }
}


/*****
 *
 *   init
 *
 *****/
Intersection.prototype.init = function(status) {
    this.status = status;
    this.points = new Array();
};


/*****
 *
 *   appendPoint
 *
 *****/
Intersection.prototype.appendPoint = function(point) {
    this.points.push(point);
};


/*****
 *
 *   appendPoints
 *
 *****/
Intersection.prototype.appendPoints = function(points) {
    this.points = this.points.concat(points);
};


/*****
 *
 *   class methods
 *
 *****/

/*****
 *
 *   intersectShapes
 *
 *****/
Intersection.intersectShapes = function(shape1, shape2) {
    var ip1 = shape1.getIntersectionParams();
    var ip2 = shape2.getIntersectionParams();
    var result;

    if ( ip1 != null && ip2 != null ) {
        if ( ip1.name == "Path" ) {
            result = Intersection.intersectPathShape(shape1, shape2);
        } else if ( ip2.name == "Path" ) {
            result = Intersection.intersectPathShape(shape2, shape1);
        } else {
            var method;
            var params;

            if ( ip1.name < ip2.name ) {
                method = "intersect" + ip1.name + ip2.name;
                params = ip1.params.concat( ip2.params );
            } else {
                method = "intersect" + ip2.name + ip1.name;
                params = ip2.params.concat( ip1.params );
            }

            if ( !(method in Intersection) )
                throw new Error("Intersection not available: " + method);

            result = Intersection[method].apply(null, params);
        }
    } else {
        result = new Intersection("No Intersection");
    }

    return result;
};


/*****
 *
 *   intersectPathShape
 *
 *****/
Intersection.intersectPathShape = function(path, shape) {
    return path.intersectShape(shape);
};


/*****
 *
 *   intersectBezier2Bezier2
 *
 *****/
Intersection.intersectBezier2Bezier2 = function(a1, a2, a3, b1, b2, b3) {
    var a, b;
    var c12, c11, c10;
    var c22, c21, c20;
    var result = new Intersection("No Intersection");
    var poly;

    a = a2.multiply(-2);
    c12 = a1.add(a.add(a3));

    a = a1.multiply(-2);
    b = a2.multiply(2);
    c11 = a.add(b);

    c10 = new Point2D(a1.x, a1.y);

    a = b2.multiply(-2);
    c22 = b1.add(a.add(b3));

    a = b1.multiply(-2);
    b = b2.multiply(2);
    c21 = a.add(b);

    c20 = new Point2D(b1.x, b1.y);

    if ( c12.y == 0 ) {
        var v0 = c12.x*(c10.y - c20.y);
        var v1 = v0 - c11.x*c11.y;
        var v2 = v0 + v1;
        var v3 = c11.y*c11.y;

        poly = new Polynomial(
            c12.x*c22.y*c22.y,
            2*c12.x*c21.y*c22.y,
            c12.x*c21.y*c21.y - c22.x*v3 - c22.y*v0 - c22.y*v1,
            -c21.x*v3 - c21.y*v0 - c21.y*v1,
            (c10.x - c20.x)*v3 + (c10.y - c20.y)*v1
        );
    } else {
        var v0 = c12.x*c22.y - c12.y*c22.x;
        var v1 = c12.x*c21.y - c21.x*c12.y;
        var v2 = c11.x*c12.y - c11.y*c12.x;
        var v3 = c10.y - c20.y;
        var v4 = c12.y*(c10.x - c20.x) - c12.x*v3;
        var v5 = -c11.y*v2 + c12.y*v4;
        var v6 = v2*v2;

        poly = new Polynomial(
            v0*v0,
            2*v0*v1,
            (-c22.y*v6 + c12.y*v1*v1 + c12.y*v0*v4 + v0*v5) / c12.y,
            (-c21.y*v6 + c12.y*v1*v4 + v1*v5) / c12.y,
            (v3*v6 + v4*v5) / c12.y
        );
    }

    var roots = poly.getRoots();
    for ( var i = 0; i < roots.length; i++ ) {
        var s = roots[i];

        if ( 0 <= s && s <= 1 ) {
            var xRoots = new Polynomial(
                c12.x,
                c11.x,
                c10.x - c20.x - s*c21.x - s*s*c22.x
            ).getRoots();
            var yRoots = new Polynomial(
                c12.y,
                c11.y,
                c10.y - c20.y - s*c21.y - s*s*c22.y
            ).getRoots();

            if ( xRoots.length > 0 && yRoots.length > 0 ) {
                var TOLERANCE = 1e-4;

                checkRoots:
                    for ( var j = 0; j < xRoots.length; j++ ) {
                        var xRoot = xRoots[j];

                        if ( 0 <= xRoot && xRoot <= 1 ) {
                            for ( var k = 0; k < yRoots.length; k++ ) {
                                if ( Math.abs( xRoot - yRoots[k] ) < TOLERANCE ) {
                                    result.points.push( c22.multiply(s*s).add(c21.multiply(s).add(c20)) );
                                    break checkRoots;
                                }
                            }
                        }
                    }
            }
        }
    }

    if ( result.points.length > 0 ) result.status = "Intersection";

    return result;
};


/*****
 *
 *   intersectBezier2Bezier3
 *
 *****/
Intersection.intersectBezier2Bezier3 = function(a1, a2, a3, b1, b2, b3, b4) {
    var a, b,c, d;
    var c12, c11, c10;
    var c23, c22, c21, c20;
    var result = new Intersection("No Intersection");

    a = a2.multiply(-2);
    c12 = a1.add(a.add(a3));

    a = a1.multiply(-2);
    b = a2.multiply(2);
    c11 = a.add(b);

    c10 = new Point2D(a1.x, a1.y);

    a = b1.multiply(-1);
    b = b2.multiply(3);
    c = b3.multiply(-3);
    d = a.add(b.add(c.add(b4)));
    c23 = new Vector2D(d.x, d.y);

    a = b1.multiply(3);
    b = b2.multiply(-6);
    c = b3.multiply(3);
    d = a.add(b.add(c));
    c22 = new Vector2D(d.x, d.y);

    a = b1.multiply(-3);
    b = b2.multiply(3);
    c = a.add(b);
    c21 = new Vector2D(c.x, c.y);

    c20 = new Vector2D(b1.x, b1.y);

    var c10x2 = c10.x*c10.x;
    var c10y2 = c10.y*c10.y;
    var c11x2 = c11.x*c11.x;
    var c11y2 = c11.y*c11.y;
    var c12x2 = c12.x*c12.x;
    var c12y2 = c12.y*c12.y;
    var c20x2 = c20.x*c20.x;
    var c20y2 = c20.y*c20.y;
    var c21x2 = c21.x*c21.x;
    var c21y2 = c21.y*c21.y;
    var c22x2 = c22.x*c22.x;
    var c22y2 = c22.y*c22.y;
    var c23x2 = c23.x*c23.x;
    var c23y2 = c23.y*c23.y;

    var poly = new Polynomial(
        -2*c12.x*c12.y*c23.x*c23.y + c12x2*c23y2 + c12y2*c23x2,
        -2*c12.x*c12.y*c22.x*c23.y - 2*c12.x*c12.y*c22.y*c23.x + 2*c12y2*c22.x*c23.x +
            2*c12x2*c22.y*c23.y,
        -2*c12.x*c21.x*c12.y*c23.y - 2*c12.x*c12.y*c21.y*c23.x - 2*c12.x*c12.y*c22.x*c22.y +
            2*c21.x*c12y2*c23.x + c12y2*c22x2 + c12x2*(2*c21.y*c23.y + c22y2),
        2*c10.x*c12.x*c12.y*c23.y + 2*c10.y*c12.x*c12.y*c23.x + c11.x*c11.y*c12.x*c23.y +
            c11.x*c11.y*c12.y*c23.x - 2*c20.x*c12.x*c12.y*c23.y - 2*c12.x*c20.y*c12.y*c23.x -
            2*c12.x*c21.x*c12.y*c22.y - 2*c12.x*c12.y*c21.y*c22.x - 2*c10.x*c12y2*c23.x -
            2*c10.y*c12x2*c23.y + 2*c20.x*c12y2*c23.x + 2*c21.x*c12y2*c22.x -
            c11y2*c12.x*c23.x - c11x2*c12.y*c23.y + c12x2*(2*c20.y*c23.y + 2*c21.y*c22.y),
        2*c10.x*c12.x*c12.y*c22.y + 2*c10.y*c12.x*c12.y*c22.x + c11.x*c11.y*c12.x*c22.y +
            c11.x*c11.y*c12.y*c22.x - 2*c20.x*c12.x*c12.y*c22.y - 2*c12.x*c20.y*c12.y*c22.x -
            2*c12.x*c21.x*c12.y*c21.y - 2*c10.x*c12y2*c22.x - 2*c10.y*c12x2*c22.y +
            2*c20.x*c12y2*c22.x - c11y2*c12.x*c22.x - c11x2*c12.y*c22.y + c21x2*c12y2 +
            c12x2*(2*c20.y*c22.y + c21y2),
        2*c10.x*c12.x*c12.y*c21.y + 2*c10.y*c12.x*c21.x*c12.y + c11.x*c11.y*c12.x*c21.y +
            c11.x*c11.y*c21.x*c12.y - 2*c20.x*c12.x*c12.y*c21.y - 2*c12.x*c20.y*c21.x*c12.y -
            2*c10.x*c21.x*c12y2 - 2*c10.y*c12x2*c21.y + 2*c20.x*c21.x*c12y2 -
            c11y2*c12.x*c21.x - c11x2*c12.y*c21.y + 2*c12x2*c20.y*c21.y,
        -2*c10.x*c10.y*c12.x*c12.y - c10.x*c11.x*c11.y*c12.y - c10.y*c11.x*c11.y*c12.x +
            2*c10.x*c12.x*c20.y*c12.y + 2*c10.y*c20.x*c12.x*c12.y + c11.x*c20.x*c11.y*c12.y +
            c11.x*c11.y*c12.x*c20.y - 2*c20.x*c12.x*c20.y*c12.y - 2*c10.x*c20.x*c12y2 +
            c10.x*c11y2*c12.x + c10.y*c11x2*c12.y - 2*c10.y*c12x2*c20.y -
            c20.x*c11y2*c12.x - c11x2*c20.y*c12.y + c10x2*c12y2 + c10y2*c12x2 +
            c20x2*c12y2 + c12x2*c20y2
    );
    var roots = poly.getRootsInInterval(0,1);

    for ( var i = 0; i < roots.length; i++ ) {
        var s = roots[i];
        var xRoots = new Polynomial(
            c12.x,
            c11.x,
            c10.x - c20.x - s*c21.x - s*s*c22.x - s*s*s*c23.x
        ).getRoots();
        var yRoots = new Polynomial(
            c12.y,
            c11.y,
            c10.y - c20.y - s*c21.y - s*s*c22.y - s*s*s*c23.y
        ).getRoots();

        if ( xRoots.length > 0 && yRoots.length > 0 ) {
            var TOLERANCE = 1e-4;

            checkRoots:
                for ( var j = 0; j < xRoots.length; j++ ) {
                    var xRoot = xRoots[j];

                    if ( 0 <= xRoot && xRoot <= 1 ) {
                        for ( var k = 0; k < yRoots.length; k++ ) {
                            if ( Math.abs( xRoot - yRoots[k] ) < TOLERANCE ) {
                                result.points.push(
                                    c23.multiply(s*s*s).add(c22.multiply(s*s).add(c21.multiply(s).add(c20)))
                                );
                                break checkRoots;
                            }
                        }
                    }
                }
        }
    }

    if ( result.points.length > 0 ) result.status = "Intersection";

    return result;

};


/*****
 *
 *   intersectBezier2Circle
 *
 *****/
Intersection.intersectBezier2Circle = function(p1, p2, p3, c, r) {
    return Intersection.intersectBezier2Ellipse(p1, p2, p3, c, r, r);
};


/*****
 *
 *   intersectBezier2Ellipse
 *
 *****/
Intersection.intersectBezier2Ellipse = function(p1, p2, p3, ec, rx, ry) {
    var a, b;       // temporary variables
    var c2, c1, c0; // coefficients of quadratic
    var result = new Intersection("No Intersection");

    a = p2.multiply(-2);
    c2 = p1.add(a.add(p3));

    a = p1.multiply(-2);
    b = p2.multiply(2);
    c1 = a.add(b);

    c0 = new Point2D(p1.x, p1.y);

    var rxrx  = rx*rx;
    var ryry  = ry*ry;
    var roots = new Polynomial(
        ryry*c2.x*c2.x + rxrx*c2.y*c2.y,
        2*(ryry*c2.x*c1.x + rxrx*c2.y*c1.y),
        ryry*(2*c2.x*c0.x + c1.x*c1.x) + rxrx*(2*c2.y*c0.y+c1.y*c1.y) -
            2*(ryry*ec.x*c2.x + rxrx*ec.y*c2.y),
        2*(ryry*c1.x*(c0.x-ec.x) + rxrx*c1.y*(c0.y-ec.y)),
        ryry*(c0.x*c0.x+ec.x*ec.x) + rxrx*(c0.y*c0.y + ec.y*ec.y) -
            2*(ryry*ec.x*c0.x + rxrx*ec.y*c0.y) - rxrx*ryry
    ).getRoots();

    for ( var i = 0; i < roots.length; i++ ) {
        var t = roots[i];

        if ( 0 <= t && t <= 1 )
            result.points.push( c2.multiply(t*t).add(c1.multiply(t).add(c0)) );
    }

    if ( result.points.length > 0 ) result.status = "Intersection";

    return result;
};


/*****
 *
 *   intersectBezier2Line
 *
 *****/
Intersection.intersectBezier2Line = function(p1, p2, p3, a1, a2) {
    var a, b;             // temporary variables
    var c2, c1, c0;       // coefficients of quadratic
    var cl;               // c coefficient for normal form of line
    var n;                // normal for normal form of line
    var min = a1.min(a2); // used to determine if point is on line segment
    var max = a1.max(a2); // used to determine if point is on line segment
    var result = new Intersection("No Intersection");

    a = p2.multiply(-2);
    c2 = p1.add(a.add(p3));

    a = p1.multiply(-2);
    b = p2.multiply(2);
    c1 = a.add(b);

    c0 = new Point2D(p1.x, p1.y);

    // Convert line to normal form: ax + by + c = 0
    // Find normal to line: negative inverse of original line's slope
    n = new Vector2D(a1.y - a2.y, a2.x - a1.x);

    // Determine new c coefficient
    cl = a1.x*a2.y - a2.x*a1.y;

    // Transform cubic coefficients to line's coordinate system and find roots
    // of cubic
    roots = new Polynomial(
        n.dot(c2),
        n.dot(c1),
        n.dot(c0) + cl
    ).getRoots();

    // Any roots in closed interval [0,1] are intersections on Bezier, but
    // might not be on the line segment.
    // Find intersections and calculate point coordinates
    for ( var i = 0; i < roots.length; i++ ) {
        var t = roots[i];

        if ( 0 <= t && t <= 1 ) {
            // We're within the Bezier curve
            // Find point on Bezier
            var p4 = p1.lerp(p2, t);
            var p5 = p2.lerp(p3, t);

            var p6 = p4.lerp(p5, t);

            // See if point is on line segment
            // Had to make special cases for vertical and horizontal lines due
            // to slight errors in calculation of p6
            if ( a1.x == a2.x ) {
                if ( min.y <= p6.y && p6.y <= max.y ) {
                    result.status = "Intersection";
                    result.appendPoint( p6 );
                }
            } else if ( a1.y == a2.y ) {
                if ( min.x <= p6.x && p6.x <= max.x ) {
                    result.status = "Intersection";
                    result.appendPoint( p6 );
                }
            } else if ( p6.gte(min) && p6.lte(max) ) {
                result.status = "Intersection";
                result.appendPoint( p6 );
            }
        }
    }

    return result;
};


/*****
 *
 *   intersectBezier2Polygon
 *
 *****/
Intersection.intersectBezier2Polygon = function(p1, p2, p3, points) {
    var result = new Intersection("No Intersection");
    var length = points.length;

    for ( var i = 0; i < length; i++ ) {
        var a1 = points[i];
        var a2 = points[(i+1) % length];
        var inter = Intersection.intersectBezier2Line(p1, p2, p3, a1, a2);

        result.appendPoints(inter.points);
    }

    if ( result.points.length > 0 ) result.status = "Intersection";

    return result;
};


/*****
 *
 *   intersectBezier2Rectangle
 *
 *****/
Intersection.intersectBezier2Rectangle = function(p1, p2, p3, r1, r2) {
    var min        = r1.min(r2);
    var max        = r1.max(r2);
    var topRight   = new Point2D( max.x, min.y );
    var bottomLeft = new Point2D( min.x, max.y );

    var inter1 = Intersection.intersectBezier2Line(p1, p2, p3, min, topRight);
    var inter2 = Intersection.intersectBezier2Line(p1, p2, p3, topRight, max);
    var inter3 = Intersection.intersectBezier2Line(p1, p2, p3, max, bottomLeft);
    var inter4 = Intersection.intersectBezier2Line(p1, p2, p3, bottomLeft, min);

    var result = new Intersection("No Intersection");

    result.appendPoints(inter1.points);
    result.appendPoints(inter2.points);
    result.appendPoints(inter3.points);
    result.appendPoints(inter4.points);

    if ( result.points.length > 0 ) result.status = "Intersection";

    return result;
};


/*****
 *
 *   intersectBezier3Bezier3
 *
 *****/
Intersection.intersectBezier3Bezier3 = function(a1, a2, a3, a4, b1, b2, b3, b4) {
    var a, b, c, d;         // temporary variables
    var c13, c12, c11, c10; // coefficients of cubic
    var c23, c22, c21, c20; // coefficients of cubic
    var result = new Intersection("No Intersection");

    // Calculate the coefficients of cubic polynomial
    a = a1.multiply(-1);
    b = a2.multiply(3);
    c = a3.multiply(-3);
    d = a.add(b.add(c.add(a4)));
    c13 = new Vector2D(d.x, d.y);

    a = a1.multiply(3);
    b = a2.multiply(-6);
    c = a3.multiply(3);
    d = a.add(b.add(c));
    c12 = new Vector2D(d.x, d.y);

    a = a1.multiply(-3);
    b = a2.multiply(3);
    c = a.add(b);
    c11 = new Vector2D(c.x, c.y);

    c10 = new Vector2D(a1.x, a1.y);

    a = b1.multiply(-1);
    b = b2.multiply(3);
    c = b3.multiply(-3);
    d = a.add(b.add(c.add(b4)));
    c23 = new Vector2D(d.x, d.y);

    a = b1.multiply(3);
    b = b2.multiply(-6);
    c = b3.multiply(3);
    d = a.add(b.add(c));
    c22 = new Vector2D(d.x, d.y);

    a = b1.multiply(-3);
    b = b2.multiply(3);
    c = a.add(b);
    c21 = new Vector2D(c.x, c.y);

    c20 = new Vector2D(b1.x, b1.y);

    var c10x2 = c10.x*c10.x;
    var c10x3 = c10.x*c10.x*c10.x;
    var c10y2 = c10.y*c10.y;
    var c10y3 = c10.y*c10.y*c10.y;
    var c11x2 = c11.x*c11.x;
    var c11x3 = c11.x*c11.x*c11.x;
    var c11y2 = c11.y*c11.y;
    var c11y3 = c11.y*c11.y*c11.y;
    var c12x2 = c12.x*c12.x;
    var c12x3 = c12.x*c12.x*c12.x;
    var c12y2 = c12.y*c12.y;
    var c12y3 = c12.y*c12.y*c12.y;
    var c13x2 = c13.x*c13.x;
    var c13x3 = c13.x*c13.x*c13.x;
    var c13y2 = c13.y*c13.y;
    var c13y3 = c13.y*c13.y*c13.y;
    var c20x2 = c20.x*c20.x;
    var c20x3 = c20.x*c20.x*c20.x;
    var c20y2 = c20.y*c20.y;
    var c20y3 = c20.y*c20.y*c20.y;
    var c21x2 = c21.x*c21.x;
    var c21x3 = c21.x*c21.x*c21.x;
    var c21y2 = c21.y*c21.y;
    var c22x2 = c22.x*c22.x;
    var c22x3 = c22.x*c22.x*c22.x;
    var c22y2 = c22.y*c22.y;
    var c23x2 = c23.x*c23.x;
    var c23x3 = c23.x*c23.x*c23.x;
    var c23y2 = c23.y*c23.y;
    var c23y3 = c23.y*c23.y*c23.y;
    var poly = new Polynomial(
        -c13x3*c23y3 + c13y3*c23x3 - 3*c13.x*c13y2*c23x2*c23.y +
            3*c13x2*c13.y*c23.x*c23y2,
        -6*c13.x*c22.x*c13y2*c23.x*c23.y + 6*c13x2*c13.y*c22.y*c23.x*c23.y + 3*c22.x*c13y3*c23x2 -
            3*c13x3*c22.y*c23y2 - 3*c13.x*c13y2*c22.y*c23x2 + 3*c13x2*c22.x*c13.y*c23y2,
        -6*c21.x*c13.x*c13y2*c23.x*c23.y - 6*c13.x*c22.x*c13y2*c22.y*c23.x + 6*c13x2*c22.x*c13.y*c22.y*c23.y +
            3*c21.x*c13y3*c23x2 + 3*c22x2*c13y3*c23.x + 3*c21.x*c13x2*c13.y*c23y2 - 3*c13.x*c21.y*c13y2*c23x2 -
            3*c13.x*c22x2*c13y2*c23.y + c13x2*c13.y*c23.x*(6*c21.y*c23.y + 3*c22y2) + c13x3*(-c21.y*c23y2 -
            2*c22y2*c23.y - c23.y*(2*c21.y*c23.y + c22y2)),
        c11.x*c12.y*c13.x*c13.y*c23.x*c23.y - c11.y*c12.x*c13.x*c13.y*c23.x*c23.y + 6*c21.x*c22.x*c13y3*c23.x +
            3*c11.x*c12.x*c13.x*c13.y*c23y2 + 6*c10.x*c13.x*c13y2*c23.x*c23.y - 3*c11.x*c12.x*c13y2*c23.x*c23.y -
            3*c11.y*c12.y*c13.x*c13.y*c23x2 - 6*c10.y*c13x2*c13.y*c23.x*c23.y - 6*c20.x*c13.x*c13y2*c23.x*c23.y +
            3*c11.y*c12.y*c13x2*c23.x*c23.y - 2*c12.x*c12y2*c13.x*c23.x*c23.y - 6*c21.x*c13.x*c22.x*c13y2*c23.y -
            6*c21.x*c13.x*c13y2*c22.y*c23.x - 6*c13.x*c21.y*c22.x*c13y2*c23.x + 6*c21.x*c13x2*c13.y*c22.y*c23.y +
            2*c12x2*c12.y*c13.y*c23.x*c23.y + c22x3*c13y3 - 3*c10.x*c13y3*c23x2 + 3*c10.y*c13x3*c23y2 +
            3*c20.x*c13y3*c23x2 + c12y3*c13.x*c23x2 - c12x3*c13.y*c23y2 - 3*c10.x*c13x2*c13.y*c23y2 +
            3*c10.y*c13.x*c13y2*c23x2 - 2*c11.x*c12.y*c13x2*c23y2 + c11.x*c12.y*c13y2*c23x2 - c11.y*c12.x*c13x2*c23y2 +
            2*c11.y*c12.x*c13y2*c23x2 + 3*c20.x*c13x2*c13.y*c23y2 - c12.x*c12y2*c13.y*c23x2 -
            3*c20.y*c13.x*c13y2*c23x2 + c12x2*c12.y*c13.x*c23y2 - 3*c13.x*c22x2*c13y2*c22.y +
            c13x2*c13.y*c23.x*(6*c20.y*c23.y + 6*c21.y*c22.y) + c13x2*c22.x*c13.y*(6*c21.y*c23.y + 3*c22y2) +
            c13x3*(-2*c21.y*c22.y*c23.y - c20.y*c23y2 - c22.y*(2*c21.y*c23.y + c22y2) - c23.y*(2*c20.y*c23.y + 2*c21.y*c22.y)),
        6*c11.x*c12.x*c13.x*c13.y*c22.y*c23.y + c11.x*c12.y*c13.x*c22.x*c13.y*c23.y + c11.x*c12.y*c13.x*c13.y*c22.y*c23.x -
            c11.y*c12.x*c13.x*c22.x*c13.y*c23.y - c11.y*c12.x*c13.x*c13.y*c22.y*c23.x - 6*c11.y*c12.y*c13.x*c22.x*c13.y*c23.x -
            6*c10.x*c22.x*c13y3*c23.x + 6*c20.x*c22.x*c13y3*c23.x + 6*c10.y*c13x3*c22.y*c23.y + 2*c12y3*c13.x*c22.x*c23.x -
            2*c12x3*c13.y*c22.y*c23.y + 6*c10.x*c13.x*c22.x*c13y2*c23.y + 6*c10.x*c13.x*c13y2*c22.y*c23.x +
            6*c10.y*c13.x*c22.x*c13y2*c23.x - 3*c11.x*c12.x*c22.x*c13y2*c23.y - 3*c11.x*c12.x*c13y2*c22.y*c23.x +
            2*c11.x*c12.y*c22.x*c13y2*c23.x + 4*c11.y*c12.x*c22.x*c13y2*c23.x - 6*c10.x*c13x2*c13.y*c22.y*c23.y -
            6*c10.y*c13x2*c22.x*c13.y*c23.y - 6*c10.y*c13x2*c13.y*c22.y*c23.x - 4*c11.x*c12.y*c13x2*c22.y*c23.y -
            6*c20.x*c13.x*c22.x*c13y2*c23.y - 6*c20.x*c13.x*c13y2*c22.y*c23.x - 2*c11.y*c12.x*c13x2*c22.y*c23.y +
            3*c11.y*c12.y*c13x2*c22.x*c23.y + 3*c11.y*c12.y*c13x2*c22.y*c23.x - 2*c12.x*c12y2*c13.x*c22.x*c23.y -
            2*c12.x*c12y2*c13.x*c22.y*c23.x - 2*c12.x*c12y2*c22.x*c13.y*c23.x - 6*c20.y*c13.x*c22.x*c13y2*c23.x -
            6*c21.x*c13.x*c21.y*c13y2*c23.x - 6*c21.x*c13.x*c22.x*c13y2*c22.y + 6*c20.x*c13x2*c13.y*c22.y*c23.y +
            2*c12x2*c12.y*c13.x*c22.y*c23.y + 2*c12x2*c12.y*c22.x*c13.y*c23.y + 2*c12x2*c12.y*c13.y*c22.y*c23.x +
            3*c21.x*c22x2*c13y3 + 3*c21x2*c13y3*c23.x - 3*c13.x*c21.y*c22x2*c13y2 - 3*c21x2*c13.x*c13y2*c23.y +
            c13x2*c22.x*c13.y*(6*c20.y*c23.y + 6*c21.y*c22.y) + c13x2*c13.y*c23.x*(6*c20.y*c22.y + 3*c21y2) +
            c21.x*c13x2*c13.y*(6*c21.y*c23.y + 3*c22y2) + c13x3*(-2*c20.y*c22.y*c23.y - c23.y*(2*c20.y*c22.y + c21y2) -
            c21.y*(2*c21.y*c23.y + c22y2) - c22.y*(2*c20.y*c23.y + 2*c21.y*c22.y)),
        c11.x*c21.x*c12.y*c13.x*c13.y*c23.y + c11.x*c12.y*c13.x*c21.y*c13.y*c23.x + c11.x*c12.y*c13.x*c22.x*c13.y*c22.y -
            c11.y*c12.x*c21.x*c13.x*c13.y*c23.y - c11.y*c12.x*c13.x*c21.y*c13.y*c23.x - c11.y*c12.x*c13.x*c22.x*c13.y*c22.y -
            6*c11.y*c21.x*c12.y*c13.x*c13.y*c23.x - 6*c10.x*c21.x*c13y3*c23.x + 6*c20.x*c21.x*c13y3*c23.x +
            2*c21.x*c12y3*c13.x*c23.x + 6*c10.x*c21.x*c13.x*c13y2*c23.y + 6*c10.x*c13.x*c21.y*c13y2*c23.x +
            6*c10.x*c13.x*c22.x*c13y2*c22.y + 6*c10.y*c21.x*c13.x*c13y2*c23.x - 3*c11.x*c12.x*c21.x*c13y2*c23.y -
            3*c11.x*c12.x*c21.y*c13y2*c23.x - 3*c11.x*c12.x*c22.x*c13y2*c22.y + 2*c11.x*c21.x*c12.y*c13y2*c23.x +
            4*c11.y*c12.x*c21.x*c13y2*c23.x - 6*c10.y*c21.x*c13x2*c13.y*c23.y - 6*c10.y*c13x2*c21.y*c13.y*c23.x -
            6*c10.y*c13x2*c22.x*c13.y*c22.y - 6*c20.x*c21.x*c13.x*c13y2*c23.y - 6*c20.x*c13.x*c21.y*c13y2*c23.x -
            6*c20.x*c13.x*c22.x*c13y2*c22.y + 3*c11.y*c21.x*c12.y*c13x2*c23.y - 3*c11.y*c12.y*c13.x*c22x2*c13.y +
            3*c11.y*c12.y*c13x2*c21.y*c23.x + 3*c11.y*c12.y*c13x2*c22.x*c22.y - 2*c12.x*c21.x*c12y2*c13.x*c23.y -
            2*c12.x*c21.x*c12y2*c13.y*c23.x - 2*c12.x*c12y2*c13.x*c21.y*c23.x - 2*c12.x*c12y2*c13.x*c22.x*c22.y -
            6*c20.y*c21.x*c13.x*c13y2*c23.x - 6*c21.x*c13.x*c21.y*c22.x*c13y2 + 6*c20.y*c13x2*c21.y*c13.y*c23.x +
            2*c12x2*c21.x*c12.y*c13.y*c23.y + 2*c12x2*c12.y*c21.y*c13.y*c23.x + 2*c12x2*c12.y*c22.x*c13.y*c22.y -
            3*c10.x*c22x2*c13y3 + 3*c20.x*c22x2*c13y3 + 3*c21x2*c22.x*c13y3 + c12y3*c13.x*c22x2 +
            3*c10.y*c13.x*c22x2*c13y2 + c11.x*c12.y*c22x2*c13y2 + 2*c11.y*c12.x*c22x2*c13y2 -
            c12.x*c12y2*c22x2*c13.y - 3*c20.y*c13.x*c22x2*c13y2 - 3*c21x2*c13.x*c13y2*c22.y +
            c12x2*c12.y*c13.x*(2*c21.y*c23.y + c22y2) + c11.x*c12.x*c13.x*c13.y*(6*c21.y*c23.y + 3*c22y2) +
            c21.x*c13x2*c13.y*(6*c20.y*c23.y + 6*c21.y*c22.y) + c12x3*c13.y*(-2*c21.y*c23.y - c22y2) +
            c10.y*c13x3*(6*c21.y*c23.y + 3*c22y2) + c11.y*c12.x*c13x2*(-2*c21.y*c23.y - c22y2) +
            c11.x*c12.y*c13x2*(-4*c21.y*c23.y - 2*c22y2) + c10.x*c13x2*c13.y*(-6*c21.y*c23.y - 3*c22y2) +
            c13x2*c22.x*c13.y*(6*c20.y*c22.y + 3*c21y2) + c20.x*c13x2*c13.y*(6*c21.y*c23.y + 3*c22y2) +
            c13x3*(-2*c20.y*c21.y*c23.y - c22.y*(2*c20.y*c22.y + c21y2) - c20.y*(2*c21.y*c23.y + c22y2) -
                c21.y*(2*c20.y*c23.y + 2*c21.y*c22.y)),
        -c10.x*c11.x*c12.y*c13.x*c13.y*c23.y + c10.x*c11.y*c12.x*c13.x*c13.y*c23.y + 6*c10.x*c11.y*c12.y*c13.x*c13.y*c23.x -
            6*c10.y*c11.x*c12.x*c13.x*c13.y*c23.y - c10.y*c11.x*c12.y*c13.x*c13.y*c23.x + c10.y*c11.y*c12.x*c13.x*c13.y*c23.x +
            c11.x*c11.y*c12.x*c12.y*c13.x*c23.y - c11.x*c11.y*c12.x*c12.y*c13.y*c23.x + c11.x*c20.x*c12.y*c13.x*c13.y*c23.y +
            c11.x*c20.y*c12.y*c13.x*c13.y*c23.x + c11.x*c21.x*c12.y*c13.x*c13.y*c22.y + c11.x*c12.y*c13.x*c21.y*c22.x*c13.y -
            c20.x*c11.y*c12.x*c13.x*c13.y*c23.y - 6*c20.x*c11.y*c12.y*c13.x*c13.y*c23.x - c11.y*c12.x*c20.y*c13.x*c13.y*c23.x -
            c11.y*c12.x*c21.x*c13.x*c13.y*c22.y - c11.y*c12.x*c13.x*c21.y*c22.x*c13.y - 6*c11.y*c21.x*c12.y*c13.x*c22.x*c13.y -
            6*c10.x*c20.x*c13y3*c23.x - 6*c10.x*c21.x*c22.x*c13y3 - 2*c10.x*c12y3*c13.x*c23.x + 6*c20.x*c21.x*c22.x*c13y3 +
            2*c20.x*c12y3*c13.x*c23.x + 2*c21.x*c12y3*c13.x*c22.x + 2*c10.y*c12x3*c13.y*c23.y - 6*c10.x*c10.y*c13.x*c13y2*c23.x +
            3*c10.x*c11.x*c12.x*c13y2*c23.y - 2*c10.x*c11.x*c12.y*c13y2*c23.x - 4*c10.x*c11.y*c12.x*c13y2*c23.x +
            3*c10.y*c11.x*c12.x*c13y2*c23.x + 6*c10.x*c10.y*c13x2*c13.y*c23.y + 6*c10.x*c20.x*c13.x*c13y2*c23.y -
            3*c10.x*c11.y*c12.y*c13x2*c23.y + 2*c10.x*c12.x*c12y2*c13.x*c23.y + 2*c10.x*c12.x*c12y2*c13.y*c23.x +
            6*c10.x*c20.y*c13.x*c13y2*c23.x + 6*c10.x*c21.x*c13.x*c13y2*c22.y + 6*c10.x*c13.x*c21.y*c22.x*c13y2 +
            4*c10.y*c11.x*c12.y*c13x2*c23.y + 6*c10.y*c20.x*c13.x*c13y2*c23.x + 2*c10.y*c11.y*c12.x*c13x2*c23.y -
            3*c10.y*c11.y*c12.y*c13x2*c23.x + 2*c10.y*c12.x*c12y2*c13.x*c23.x + 6*c10.y*c21.x*c13.x*c22.x*c13y2 -
            3*c11.x*c20.x*c12.x*c13y2*c23.y + 2*c11.x*c20.x*c12.y*c13y2*c23.x + c11.x*c11.y*c12y2*c13.x*c23.x -
            3*c11.x*c12.x*c20.y*c13y2*c23.x - 3*c11.x*c12.x*c21.x*c13y2*c22.y - 3*c11.x*c12.x*c21.y*c22.x*c13y2 +
            2*c11.x*c21.x*c12.y*c22.x*c13y2 + 4*c20.x*c11.y*c12.x*c13y2*c23.x + 4*c11.y*c12.x*c21.x*c22.x*c13y2 -
            2*c10.x*c12x2*c12.y*c13.y*c23.y - 6*c10.y*c20.x*c13x2*c13.y*c23.y - 6*c10.y*c20.y*c13x2*c13.y*c23.x -
            6*c10.y*c21.x*c13x2*c13.y*c22.y - 2*c10.y*c12x2*c12.y*c13.x*c23.y - 2*c10.y*c12x2*c12.y*c13.y*c23.x -
            6*c10.y*c13x2*c21.y*c22.x*c13.y - c11.x*c11.y*c12x2*c13.y*c23.y - 2*c11.x*c11y2*c13.x*c13.y*c23.x +
            3*c20.x*c11.y*c12.y*c13x2*c23.y - 2*c20.x*c12.x*c12y2*c13.x*c23.y - 2*c20.x*c12.x*c12y2*c13.y*c23.x -
            6*c20.x*c20.y*c13.x*c13y2*c23.x - 6*c20.x*c21.x*c13.x*c13y2*c22.y - 6*c20.x*c13.x*c21.y*c22.x*c13y2 +
            3*c11.y*c20.y*c12.y*c13x2*c23.x + 3*c11.y*c21.x*c12.y*c13x2*c22.y + 3*c11.y*c12.y*c13x2*c21.y*c22.x -
            2*c12.x*c20.y*c12y2*c13.x*c23.x - 2*c12.x*c21.x*c12y2*c13.x*c22.y - 2*c12.x*c21.x*c12y2*c22.x*c13.y -
            2*c12.x*c12y2*c13.x*c21.y*c22.x - 6*c20.y*c21.x*c13.x*c22.x*c13y2 - c11y2*c12.x*c12.y*c13.x*c23.x +
            2*c20.x*c12x2*c12.y*c13.y*c23.y + 6*c20.y*c13x2*c21.y*c22.x*c13.y + 2*c11x2*c11.y*c13.x*c13.y*c23.y +
            c11x2*c12.x*c12.y*c13.y*c23.y + 2*c12x2*c20.y*c12.y*c13.y*c23.x + 2*c12x2*c21.x*c12.y*c13.y*c22.y +
            2*c12x2*c12.y*c21.y*c22.x*c13.y + c21x3*c13y3 + 3*c10x2*c13y3*c23.x - 3*c10y2*c13x3*c23.y +
            3*c20x2*c13y3*c23.x + c11y3*c13x2*c23.x - c11x3*c13y2*c23.y - c11.x*c11y2*c13x2*c23.y +
            c11x2*c11.y*c13y2*c23.x - 3*c10x2*c13.x*c13y2*c23.y + 3*c10y2*c13x2*c13.y*c23.x - c11x2*c12y2*c13.x*c23.y +
            c11y2*c12x2*c13.y*c23.x - 3*c21x2*c13.x*c21.y*c13y2 - 3*c20x2*c13.x*c13y2*c23.y + 3*c20y2*c13x2*c13.y*c23.x +
            c11.x*c12.x*c13.x*c13.y*(6*c20.y*c23.y + 6*c21.y*c22.y) + c12x3*c13.y*(-2*c20.y*c23.y - 2*c21.y*c22.y) +
            c10.y*c13x3*(6*c20.y*c23.y + 6*c21.y*c22.y) + c11.y*c12.x*c13x2*(-2*c20.y*c23.y - 2*c21.y*c22.y) +
            c12x2*c12.y*c13.x*(2*c20.y*c23.y + 2*c21.y*c22.y) + c11.x*c12.y*c13x2*(-4*c20.y*c23.y - 4*c21.y*c22.y) +
            c10.x*c13x2*c13.y*(-6*c20.y*c23.y - 6*c21.y*c22.y) + c20.x*c13x2*c13.y*(6*c20.y*c23.y + 6*c21.y*c22.y) +
            c21.x*c13x2*c13.y*(6*c20.y*c22.y + 3*c21y2) + c13x3*(-2*c20.y*c21.y*c22.y - c20y2*c23.y -
            c21.y*(2*c20.y*c22.y + c21y2) - c20.y*(2*c20.y*c23.y + 2*c21.y*c22.y)),
        -c10.x*c11.x*c12.y*c13.x*c13.y*c22.y + c10.x*c11.y*c12.x*c13.x*c13.y*c22.y + 6*c10.x*c11.y*c12.y*c13.x*c22.x*c13.y -
            6*c10.y*c11.x*c12.x*c13.x*c13.y*c22.y - c10.y*c11.x*c12.y*c13.x*c22.x*c13.y + c10.y*c11.y*c12.x*c13.x*c22.x*c13.y +
            c11.x*c11.y*c12.x*c12.y*c13.x*c22.y - c11.x*c11.y*c12.x*c12.y*c22.x*c13.y + c11.x*c20.x*c12.y*c13.x*c13.y*c22.y +
            c11.x*c20.y*c12.y*c13.x*c22.x*c13.y + c11.x*c21.x*c12.y*c13.x*c21.y*c13.y - c20.x*c11.y*c12.x*c13.x*c13.y*c22.y -
            6*c20.x*c11.y*c12.y*c13.x*c22.x*c13.y - c11.y*c12.x*c20.y*c13.x*c22.x*c13.y - c11.y*c12.x*c21.x*c13.x*c21.y*c13.y -
            6*c10.x*c20.x*c22.x*c13y3 - 2*c10.x*c12y3*c13.x*c22.x + 2*c20.x*c12y3*c13.x*c22.x + 2*c10.y*c12x3*c13.y*c22.y -
            6*c10.x*c10.y*c13.x*c22.x*c13y2 + 3*c10.x*c11.x*c12.x*c13y2*c22.y - 2*c10.x*c11.x*c12.y*c22.x*c13y2 -
            4*c10.x*c11.y*c12.x*c22.x*c13y2 + 3*c10.y*c11.x*c12.x*c22.x*c13y2 + 6*c10.x*c10.y*c13x2*c13.y*c22.y +
            6*c10.x*c20.x*c13.x*c13y2*c22.y - 3*c10.x*c11.y*c12.y*c13x2*c22.y + 2*c10.x*c12.x*c12y2*c13.x*c22.y +
            2*c10.x*c12.x*c12y2*c22.x*c13.y + 6*c10.x*c20.y*c13.x*c22.x*c13y2 + 6*c10.x*c21.x*c13.x*c21.y*c13y2 +
            4*c10.y*c11.x*c12.y*c13x2*c22.y + 6*c10.y*c20.x*c13.x*c22.x*c13y2 + 2*c10.y*c11.y*c12.x*c13x2*c22.y -
            3*c10.y*c11.y*c12.y*c13x2*c22.x + 2*c10.y*c12.x*c12y2*c13.x*c22.x - 3*c11.x*c20.x*c12.x*c13y2*c22.y +
            2*c11.x*c20.x*c12.y*c22.x*c13y2 + c11.x*c11.y*c12y2*c13.x*c22.x - 3*c11.x*c12.x*c20.y*c22.x*c13y2 -
            3*c11.x*c12.x*c21.x*c21.y*c13y2 + 4*c20.x*c11.y*c12.x*c22.x*c13y2 - 2*c10.x*c12x2*c12.y*c13.y*c22.y -
            6*c10.y*c20.x*c13x2*c13.y*c22.y - 6*c10.y*c20.y*c13x2*c22.x*c13.y - 6*c10.y*c21.x*c13x2*c21.y*c13.y -
            2*c10.y*c12x2*c12.y*c13.x*c22.y - 2*c10.y*c12x2*c12.y*c22.x*c13.y - c11.x*c11.y*c12x2*c13.y*c22.y -
            2*c11.x*c11y2*c13.x*c22.x*c13.y + 3*c20.x*c11.y*c12.y*c13x2*c22.y - 2*c20.x*c12.x*c12y2*c13.x*c22.y -
            2*c20.x*c12.x*c12y2*c22.x*c13.y - 6*c20.x*c20.y*c13.x*c22.x*c13y2 - 6*c20.x*c21.x*c13.x*c21.y*c13y2 +
            3*c11.y*c20.y*c12.y*c13x2*c22.x + 3*c11.y*c21.x*c12.y*c13x2*c21.y - 2*c12.x*c20.y*c12y2*c13.x*c22.x -
            2*c12.x*c21.x*c12y2*c13.x*c21.y - c11y2*c12.x*c12.y*c13.x*c22.x + 2*c20.x*c12x2*c12.y*c13.y*c22.y -
            3*c11.y*c21x2*c12.y*c13.x*c13.y + 6*c20.y*c21.x*c13x2*c21.y*c13.y + 2*c11x2*c11.y*c13.x*c13.y*c22.y +
            c11x2*c12.x*c12.y*c13.y*c22.y + 2*c12x2*c20.y*c12.y*c22.x*c13.y + 2*c12x2*c21.x*c12.y*c21.y*c13.y -
            3*c10.x*c21x2*c13y3 + 3*c20.x*c21x2*c13y3 + 3*c10x2*c22.x*c13y3 - 3*c10y2*c13x3*c22.y + 3*c20x2*c22.x*c13y3 +
            c21x2*c12y3*c13.x + c11y3*c13x2*c22.x - c11x3*c13y2*c22.y + 3*c10.y*c21x2*c13.x*c13y2 -
            c11.x*c11y2*c13x2*c22.y + c11.x*c21x2*c12.y*c13y2 + 2*c11.y*c12.x*c21x2*c13y2 + c11x2*c11.y*c22.x*c13y2 -
            c12.x*c21x2*c12y2*c13.y - 3*c20.y*c21x2*c13.x*c13y2 - 3*c10x2*c13.x*c13y2*c22.y + 3*c10y2*c13x2*c22.x*c13.y -
            c11x2*c12y2*c13.x*c22.y + c11y2*c12x2*c22.x*c13.y - 3*c20x2*c13.x*c13y2*c22.y + 3*c20y2*c13x2*c22.x*c13.y +
            c12x2*c12.y*c13.x*(2*c20.y*c22.y + c21y2) + c11.x*c12.x*c13.x*c13.y*(6*c20.y*c22.y + 3*c21y2) +
            c12x3*c13.y*(-2*c20.y*c22.y - c21y2) + c10.y*c13x3*(6*c20.y*c22.y + 3*c21y2) +
            c11.y*c12.x*c13x2*(-2*c20.y*c22.y - c21y2) + c11.x*c12.y*c13x2*(-4*c20.y*c22.y - 2*c21y2) +
            c10.x*c13x2*c13.y*(-6*c20.y*c22.y - 3*c21y2) + c20.x*c13x2*c13.y*(6*c20.y*c22.y + 3*c21y2) +
            c13x3*(-2*c20.y*c21y2 - c20y2*c22.y - c20.y*(2*c20.y*c22.y + c21y2)),
        -c10.x*c11.x*c12.y*c13.x*c21.y*c13.y + c10.x*c11.y*c12.x*c13.x*c21.y*c13.y + 6*c10.x*c11.y*c21.x*c12.y*c13.x*c13.y -
            6*c10.y*c11.x*c12.x*c13.x*c21.y*c13.y - c10.y*c11.x*c21.x*c12.y*c13.x*c13.y + c10.y*c11.y*c12.x*c21.x*c13.x*c13.y -
            c11.x*c11.y*c12.x*c21.x*c12.y*c13.y + c11.x*c11.y*c12.x*c12.y*c13.x*c21.y + c11.x*c20.x*c12.y*c13.x*c21.y*c13.y +
            6*c11.x*c12.x*c20.y*c13.x*c21.y*c13.y + c11.x*c20.y*c21.x*c12.y*c13.x*c13.y - c20.x*c11.y*c12.x*c13.x*c21.y*c13.y -
            6*c20.x*c11.y*c21.x*c12.y*c13.x*c13.y - c11.y*c12.x*c20.y*c21.x*c13.x*c13.y - 6*c10.x*c20.x*c21.x*c13y3 -
            2*c10.x*c21.x*c12y3*c13.x + 6*c10.y*c20.y*c13x3*c21.y + 2*c20.x*c21.x*c12y3*c13.x + 2*c10.y*c12x3*c21.y*c13.y -
            2*c12x3*c20.y*c21.y*c13.y - 6*c10.x*c10.y*c21.x*c13.x*c13y2 + 3*c10.x*c11.x*c12.x*c21.y*c13y2 -
            2*c10.x*c11.x*c21.x*c12.y*c13y2 - 4*c10.x*c11.y*c12.x*c21.x*c13y2 + 3*c10.y*c11.x*c12.x*c21.x*c13y2 +
            6*c10.x*c10.y*c13x2*c21.y*c13.y + 6*c10.x*c20.x*c13.x*c21.y*c13y2 - 3*c10.x*c11.y*c12.y*c13x2*c21.y +
            2*c10.x*c12.x*c21.x*c12y2*c13.y + 2*c10.x*c12.x*c12y2*c13.x*c21.y + 6*c10.x*c20.y*c21.x*c13.x*c13y2 +
            4*c10.y*c11.x*c12.y*c13x2*c21.y + 6*c10.y*c20.x*c21.x*c13.x*c13y2 + 2*c10.y*c11.y*c12.x*c13x2*c21.y -
            3*c10.y*c11.y*c21.x*c12.y*c13x2 + 2*c10.y*c12.x*c21.x*c12y2*c13.x - 3*c11.x*c20.x*c12.x*c21.y*c13y2 +
            2*c11.x*c20.x*c21.x*c12.y*c13y2 + c11.x*c11.y*c21.x*c12y2*c13.x - 3*c11.x*c12.x*c20.y*c21.x*c13y2 +
            4*c20.x*c11.y*c12.x*c21.x*c13y2 - 6*c10.x*c20.y*c13x2*c21.y*c13.y - 2*c10.x*c12x2*c12.y*c21.y*c13.y -
            6*c10.y*c20.x*c13x2*c21.y*c13.y - 6*c10.y*c20.y*c21.x*c13x2*c13.y - 2*c10.y*c12x2*c21.x*c12.y*c13.y -
            2*c10.y*c12x2*c12.y*c13.x*c21.y - c11.x*c11.y*c12x2*c21.y*c13.y - 4*c11.x*c20.y*c12.y*c13x2*c21.y -
            2*c11.x*c11y2*c21.x*c13.x*c13.y + 3*c20.x*c11.y*c12.y*c13x2*c21.y - 2*c20.x*c12.x*c21.x*c12y2*c13.y -
            2*c20.x*c12.x*c12y2*c13.x*c21.y - 6*c20.x*c20.y*c21.x*c13.x*c13y2 - 2*c11.y*c12.x*c20.y*c13x2*c21.y +
            3*c11.y*c20.y*c21.x*c12.y*c13x2 - 2*c12.x*c20.y*c21.x*c12y2*c13.x - c11y2*c12.x*c21.x*c12.y*c13.x +
            6*c20.x*c20.y*c13x2*c21.y*c13.y + 2*c20.x*c12x2*c12.y*c21.y*c13.y + 2*c11x2*c11.y*c13.x*c21.y*c13.y +
            c11x2*c12.x*c12.y*c21.y*c13.y + 2*c12x2*c20.y*c21.x*c12.y*c13.y + 2*c12x2*c20.y*c12.y*c13.x*c21.y +
            3*c10x2*c21.x*c13y3 - 3*c10y2*c13x3*c21.y + 3*c20x2*c21.x*c13y3 + c11y3*c21.x*c13x2 - c11x3*c21.y*c13y2 -
            3*c20y2*c13x3*c21.y - c11.x*c11y2*c13x2*c21.y + c11x2*c11.y*c21.x*c13y2 - 3*c10x2*c13.x*c21.y*c13y2 +
            3*c10y2*c21.x*c13x2*c13.y - c11x2*c12y2*c13.x*c21.y + c11y2*c12x2*c21.x*c13.y - 3*c20x2*c13.x*c21.y*c13y2 +
            3*c20y2*c21.x*c13x2*c13.y,
        c10.x*c10.y*c11.x*c12.y*c13.x*c13.y - c10.x*c10.y*c11.y*c12.x*c13.x*c13.y + c10.x*c11.x*c11.y*c12.x*c12.y*c13.y -
            c10.y*c11.x*c11.y*c12.x*c12.y*c13.x - c10.x*c11.x*c20.y*c12.y*c13.x*c13.y + 6*c10.x*c20.x*c11.y*c12.y*c13.x*c13.y +
            c10.x*c11.y*c12.x*c20.y*c13.x*c13.y - c10.y*c11.x*c20.x*c12.y*c13.x*c13.y - 6*c10.y*c11.x*c12.x*c20.y*c13.x*c13.y +
            c10.y*c20.x*c11.y*c12.x*c13.x*c13.y - c11.x*c20.x*c11.y*c12.x*c12.y*c13.y + c11.x*c11.y*c12.x*c20.y*c12.y*c13.x +
            c11.x*c20.x*c20.y*c12.y*c13.x*c13.y - c20.x*c11.y*c12.x*c20.y*c13.x*c13.y - 2*c10.x*c20.x*c12y3*c13.x +
            2*c10.y*c12x3*c20.y*c13.y - 3*c10.x*c10.y*c11.x*c12.x*c13y2 - 6*c10.x*c10.y*c20.x*c13.x*c13y2 +
            3*c10.x*c10.y*c11.y*c12.y*c13x2 - 2*c10.x*c10.y*c12.x*c12y2*c13.x - 2*c10.x*c11.x*c20.x*c12.y*c13y2 -
            c10.x*c11.x*c11.y*c12y2*c13.x + 3*c10.x*c11.x*c12.x*c20.y*c13y2 - 4*c10.x*c20.x*c11.y*c12.x*c13y2 +
            3*c10.y*c11.x*c20.x*c12.x*c13y2 + 6*c10.x*c10.y*c20.y*c13x2*c13.y + 2*c10.x*c10.y*c12x2*c12.y*c13.y +
            2*c10.x*c11.x*c11y2*c13.x*c13.y + 2*c10.x*c20.x*c12.x*c12y2*c13.y + 6*c10.x*c20.x*c20.y*c13.x*c13y2 -
            3*c10.x*c11.y*c20.y*c12.y*c13x2 + 2*c10.x*c12.x*c20.y*c12y2*c13.x + c10.x*c11y2*c12.x*c12.y*c13.x +
            c10.y*c11.x*c11.y*c12x2*c13.y + 4*c10.y*c11.x*c20.y*c12.y*c13x2 - 3*c10.y*c20.x*c11.y*c12.y*c13x2 +
            2*c10.y*c20.x*c12.x*c12y2*c13.x + 2*c10.y*c11.y*c12.x*c20.y*c13x2 + c11.x*c20.x*c11.y*c12y2*c13.x -
            3*c11.x*c20.x*c12.x*c20.y*c13y2 - 2*c10.x*c12x2*c20.y*c12.y*c13.y - 6*c10.y*c20.x*c20.y*c13x2*c13.y -
            2*c10.y*c20.x*c12x2*c12.y*c13.y - 2*c10.y*c11x2*c11.y*c13.x*c13.y - c10.y*c11x2*c12.x*c12.y*c13.y -
            2*c10.y*c12x2*c20.y*c12.y*c13.x - 2*c11.x*c20.x*c11y2*c13.x*c13.y - c11.x*c11.y*c12x2*c20.y*c13.y +
            3*c20.x*c11.y*c20.y*c12.y*c13x2 - 2*c20.x*c12.x*c20.y*c12y2*c13.x - c20.x*c11y2*c12.x*c12.y*c13.x +
            3*c10y2*c11.x*c12.x*c13.x*c13.y + 3*c11.x*c12.x*c20y2*c13.x*c13.y + 2*c20.x*c12x2*c20.y*c12.y*c13.y -
            3*c10x2*c11.y*c12.y*c13.x*c13.y + 2*c11x2*c11.y*c20.y*c13.x*c13.y + c11x2*c12.x*c20.y*c12.y*c13.y -
            3*c20x2*c11.y*c12.y*c13.x*c13.y - c10x3*c13y3 + c10y3*c13x3 + c20x3*c13y3 - c20y3*c13x3 -
            3*c10.x*c20x2*c13y3 - c10.x*c11y3*c13x2 + 3*c10x2*c20.x*c13y3 + c10.y*c11x3*c13y2 +
            3*c10.y*c20y2*c13x3 + c20.x*c11y3*c13x2 + c10x2*c12y3*c13.x - 3*c10y2*c20.y*c13x3 - c10y2*c12x3*c13.y +
            c20x2*c12y3*c13.x - c11x3*c20.y*c13y2 - c12x3*c20y2*c13.y - c10.x*c11x2*c11.y*c13y2 +
            c10.y*c11.x*c11y2*c13x2 - 3*c10.x*c10y2*c13x2*c13.y - c10.x*c11y2*c12x2*c13.y + c10.y*c11x2*c12y2*c13.x -
            c11.x*c11y2*c20.y*c13x2 + 3*c10x2*c10.y*c13.x*c13y2 + c10x2*c11.x*c12.y*c13y2 +
            2*c10x2*c11.y*c12.x*c13y2 - 2*c10y2*c11.x*c12.y*c13x2 - c10y2*c11.y*c12.x*c13x2 + c11x2*c20.x*c11.y*c13y2 -
            3*c10.x*c20y2*c13x2*c13.y + 3*c10.y*c20x2*c13.x*c13y2 + c11.x*c20x2*c12.y*c13y2 - 2*c11.x*c20y2*c12.y*c13x2 +
            c20.x*c11y2*c12x2*c13.y - c11.y*c12.x*c20y2*c13x2 - c10x2*c12.x*c12y2*c13.y - 3*c10x2*c20.y*c13.x*c13y2 +
            3*c10y2*c20.x*c13x2*c13.y + c10y2*c12x2*c12.y*c13.x - c11x2*c20.y*c12y2*c13.x + 2*c20x2*c11.y*c12.x*c13y2 +
            3*c20.x*c20y2*c13x2*c13.y - c20x2*c12.x*c12y2*c13.y - 3*c20x2*c20.y*c13.x*c13y2 + c12x2*c20y2*c12.y*c13.x
    );
    var roots = poly.getRootsInInterval(0,1);

    for ( var i = 0; i < roots.length; i++ ) {
        var s = roots[i];
        var xRoots = new Polynomial(
            c13.x,
            c12.x,
            c11.x,
            c10.x - c20.x - s*c21.x - s*s*c22.x - s*s*s*c23.x
        ).getRoots();
        var yRoots = new Polynomial(
            c13.y,
            c12.y,
            c11.y,
            c10.y - c20.y - s*c21.y - s*s*c22.y - s*s*s*c23.y
        ).getRoots();

        if ( xRoots.length > 0 && yRoots.length > 0 ) {
            var TOLERANCE = 1e-4;

            checkRoots:
                for ( var j = 0; j < xRoots.length; j++ ) {
                    var xRoot = xRoots[j];

                    if ( 0 <= xRoot && xRoot <= 1 ) {
                        for ( var k = 0; k < yRoots.length; k++ ) {
                            if ( Math.abs( xRoot - yRoots[k] ) < TOLERANCE ) {
                                result.points.push(
                                    c23.multiply(s*s*s).add(c22.multiply(s*s).add(c21.multiply(s).add(c20)))
                                );
                                break checkRoots;
                            }
                        }
                    }
                }
        }
    }

    if ( result.points.length > 0 ) result.status = "Intersection";

    return result;
};


/*****
 *
 *   intersectBezier3Circle
 *
 *****/
Intersection.intersectBezier3Circle = function(p1, p2, p3, p4, c, r) {
    return Intersection.intersectBezier3Ellipse(p1, p2, p3, p4, c, r, r);
};


/*****
 *
 *   intersectBezier3Ellipse
 *
 *****/
Intersection.intersectBezier3Ellipse = function(p1, p2, p3, p4, ec, rx, ry) {
    var a, b, c, d;       // temporary variables
    var c3, c2, c1, c0;   // coefficients of cubic
    var result = new Intersection("No Intersection");

    // Calculate the coefficients of cubic polynomial
    a = p1.multiply(-1);
    b = p2.multiply(3);
    c = p3.multiply(-3);
    d = a.add(b.add(c.add(p4)));
    c3 = new Vector2D(d.x, d.y);

    a = p1.multiply(3);
    b = p2.multiply(-6);
    c = p3.multiply(3);
    d = a.add(b.add(c));
    c2 = new Vector2D(d.x, d.y);

    a = p1.multiply(-3);
    b = p2.multiply(3);
    c = a.add(b);
    c1 = new Vector2D(c.x, c.y);

    c0 = new Vector2D(p1.x, p1.y);

    var rxrx  = rx*rx;
    var ryry  = ry*ry;
    var poly = new Polynomial(
        c3.x*c3.x*ryry + c3.y*c3.y*rxrx,
        2*(c3.x*c2.x*ryry + c3.y*c2.y*rxrx),
        2*(c3.x*c1.x*ryry + c3.y*c1.y*rxrx) + c2.x*c2.x*ryry + c2.y*c2.y*rxrx,
        2*c3.x*ryry*(c0.x - ec.x) + 2*c3.y*rxrx*(c0.y - ec.y) +
            2*(c2.x*c1.x*ryry + c2.y*c1.y*rxrx),
        2*c2.x*ryry*(c0.x - ec.x) + 2*c2.y*rxrx*(c0.y - ec.y) +
            c1.x*c1.x*ryry + c1.y*c1.y*rxrx,
        2*c1.x*ryry*(c0.x - ec.x) + 2*c1.y*rxrx*(c0.y - ec.y),
        c0.x*c0.x*ryry - 2*c0.y*ec.y*rxrx - 2*c0.x*ec.x*ryry +
            c0.y*c0.y*rxrx + ec.x*ec.x*ryry + ec.y*ec.y*rxrx - rxrx*ryry
    );
    var roots = poly.getRootsInInterval(0,1);

    for ( var i = 0; i < roots.length; i++ ) {
        var t = roots[i];

        result.points.push(
            c3.multiply(t*t*t).add(c2.multiply(t*t).add(c1.multiply(t).add(c0)))
        );
    }

    if ( result.points.length > 0 ) result.status = "Intersection";

    return result;
};


/*****
 *
 *   intersectBezier3Line
 *
 *   Many thanks to Dan Sunday at SoftSurfer.com.  He gave me a very thorough
 *   sketch of the algorithm used here.  Without his help, I'm not sure when I
 *   would have figured out this intersection problem.
 *
 *****/
Intersection.intersectBezier3Line = function(p1, p2, p3, p4, a1, a2) {
    var a, b, c, d;       // temporary variables
    var c3, c2, c1, c0;   // coefficients of cubic
    var cl;               // c coefficient for normal form of line
    var n;                // normal for normal form of line
    var min = a1.min(a2); // used to determine if point is on line segment
    var max = a1.max(a2); // used to determine if point is on line segment
    var result = new Intersection("No Intersection");

    // Start with Bezier using Bernstein polynomials for weighting functions:
    //     (1-t^3)P1 + 3t(1-t)^2P2 + 3t^2(1-t)P3 + t^3P4
    //
    // Expand and collect terms to form linear combinations of original Bezier
    // controls.  This ends up with a vector cubic in t:
    //     (-P1+3P2-3P3+P4)t^3 + (3P1-6P2+3P3)t^2 + (-3P1+3P2)t + P1
    //             /\                  /\                /\       /\
    //             ||                  ||                ||       ||
    //             c3                  c2                c1       c0

    // Calculate the coefficients
    a = p1.multiply(-1);
    b = p2.multiply(3);
    c = p3.multiply(-3);
    d = a.add(b.add(c.add(p4)));
    c3 = new Vector2D(d.x, d.y);

    a = p1.multiply(3);
    b = p2.multiply(-6);
    c = p3.multiply(3);
    d = a.add(b.add(c));
    c2 = new Vector2D(d.x, d.y);

    a = p1.multiply(-3);
    b = p2.multiply(3);
    c = a.add(b);
    c1 = new Vector2D(c.x, c.y);

    c0 = new Vector2D(p1.x, p1.y);

    // Convert line to normal form: ax + by + c = 0
    // Find normal to line: negative inverse of original line's slope
    n = new Vector2D(a1.y - a2.y, a2.x - a1.x);

    // Determine new c coefficient
    cl = a1.x*a2.y - a2.x*a1.y;

    // ?Rotate each cubic coefficient using line for new coordinate system?
    // Find roots of rotated cubic
    roots = new Polynomial(
        n.dot(c3),
        n.dot(c2),
        n.dot(c1),
        n.dot(c0) + cl
    ).getRoots();

    // Any roots in closed interval [0,1] are intersections on Bezier, but
    // might not be on the line segment.
    // Find intersections and calculate point coordinates
    for ( var i = 0; i < roots.length; i++ ) {
        var t = roots[i];

        if ( 0 <= t && t <= 1 ) {
            // We're within the Bezier curve
            // Find point on Bezier
            var p5 = p1.lerp(p2, t);
            var p6 = p2.lerp(p3, t);
            var p7 = p3.lerp(p4, t);

            var p8 = p5.lerp(p6, t);
            var p9 = p6.lerp(p7, t);

            var p10 = p8.lerp(p9, t);

            // See if point is on line segment
            // Had to make special cases for vertical and horizontal lines due
            // to slight errors in calculation of p10
            if ( a1.x == a2.x ) {
                if ( min.y <= p10.y && p10.y <= max.y ) {
                    result.status = "Intersection";
                    result.appendPoint( p10 );
                }
            } else if ( a1.y == a2.y ) {
                if ( min.x <= p10.x && p10.x <= max.x ) {
                    result.status = "Intersection";
                    result.appendPoint( p10 );
                }
            } else if ( p10.gte(min) && p10.lte(max) ) {
                result.status = "Intersection";
                result.appendPoint( p10 );
            }
        }
    }

    return result;
};


/*****
 *
 *   intersectBezier3Polygon
 *
 *****/
Intersection.intersectBezier3Polygon = function(p1, p2, p3, p4, points) {
    var result = new Intersection("No Intersection");
    var length = points.length;

    for ( var i = 0; i < length; i++ ) {
        var a1 = points[i];
        var a2 = points[(i+1) % length];
        var inter = Intersection.intersectBezier3Line(p1, p2, p3, p4, a1, a2);

        result.appendPoints(inter.points);
    }

    if ( result.points.length > 0 ) result.status = "Intersection";

    return result;
};


/*****
 *
 *   intersectBezier3Rectangle
 *
 *****/
Intersection.intersectBezier3Rectangle = function(p1, p2, p3, p4, r1, r2) {
    var min        = r1.min(r2);
    var max        = r1.max(r2);
    var topRight   = new Point2D( max.x, min.y );
    var bottomLeft = new Point2D( min.x, max.y );

    var inter1 = Intersection.intersectBezier3Line(p1, p2, p3, p4, min, topRight);
    var inter2 = Intersection.intersectBezier3Line(p1, p2, p3, p4, topRight, max);
    var inter3 = Intersection.intersectBezier3Line(p1, p2, p3, p4, max, bottomLeft);
    var inter4 = Intersection.intersectBezier3Line(p1, p2, p3, p4, bottomLeft, min);

    var result = new Intersection("No Intersection");

    result.appendPoints(inter1.points);
    result.appendPoints(inter2.points);
    result.appendPoints(inter3.points);
    result.appendPoints(inter4.points);

    if ( result.points.length > 0 ) result.status = "Intersection";

    return result;
};


/*****
 *
 *   intersectCircleCircle
 *
 *****/
Intersection.intersectCircleCircle = function(c1, r1, c2, r2) {
    var result;

    // Determine minimum and maximum radii where circles can intersect
    var r_max = r1 + r2;
    var r_min = Math.abs(r1 - r2);

    // Determine actual distance between circle circles
    var c_dist = c1.distanceFrom( c2 );

    if ( c_dist > r_max ) {
        result = new Intersection("Outside");
    } else if ( c_dist < r_min ) {
        result = new Intersection("Inside");
    } else {
        result = new Intersection("Intersection");

        var a = (r1*r1 - r2*r2 + c_dist*c_dist) / ( 2*c_dist );
        var h = Math.sqrt(r1*r1 - a*a);
        var p = c1.lerp(c2, a/c_dist);
        var b = h / c_dist;

        result.points.push(
            new Point2D(
                p.x - b * (c2.y - c1.y),
                p.y + b * (c2.x - c1.x)
            )
        );
        result.points.push(
            new Point2D(
                p.x + b * (c2.y - c1.y),
                p.y - b * (c2.x - c1.x)
            )
        );
    }

    return result;
};


/*****
 *
 *   intersectCircleEllipse
 *
 *****/
Intersection.intersectCircleEllipse = function(cc, r, ec, rx, ry) {
    return Intersection.intersectEllipseEllipse(cc, r, r, ec, rx, ry);
};


/*****
 *
 *   intersectCircleLine
 *
 *****/
Intersection.intersectCircleLine = function(c, r, a1, a2) {
    var result;
    var a  = (a2.x - a1.x) * (a2.x - a1.x) +
        (a2.y - a1.y) * (a2.y - a1.y);
    var b  = 2 * ( (a2.x - a1.x) * (a1.x - c.x) +
        (a2.y - a1.y) * (a1.y - c.y)   );
    var cc = c.x*c.x + c.y*c.y + a1.x*a1.x + a1.y*a1.y -
        2 * (c.x * a1.x + c.y * a1.y) - r*r;
    var deter = b*b - 4*a*cc;

    if ( deter < 0 ) {
        result = new Intersection("Outside");
    } else if ( deter == 0 ) {
        result = new Intersection("Tangent");
        // NOTE: should calculate this point
    } else {
        var e  = Math.sqrt(deter);
        var u1 = ( -b + e ) / ( 2*a );
        var u2 = ( -b - e ) / ( 2*a );

        if ( (u1 < 0 || u1 > 1) && (u2 < 0 || u2 > 1) ) {
            if ( (u1 < 0 && u2 < 0) || (u1 > 1 && u2 > 1) ) {
                result = new Intersection("Outside");
            } else {
                result = new Intersection("Inside");
            }
        } else {
            result = new Intersection("Intersection");

            if ( 0 <= u1 && u1 <= 1)
                result.points.push( a1.lerp(a2, u1) );

            if ( 0 <= u2 && u2 <= 1)
                result.points.push( a1.lerp(a2, u2) );
        }
    }

    return result;
};


/*****
 *
 *   intersectCirclePolygon
 *
 *****/
Intersection.intersectCirclePolygon = function(c, r, points) {
    var result = new Intersection("No Intersection");
    var length = points.length;
    var inter;

    for ( var i = 0; i < length; i++ ) {
        var a1 = points[i];
        var a2 = points[(i+1) % length];

        inter = Intersection.intersectCircleLine(c, r, a1, a2);
        result.appendPoints(inter.points);
    }

    if ( result.points.length > 0 )
        result.status = "Intersection";
    else
        result.status = inter.status;

    return result;
};


/*****
 *
 *   intersectCircleRectangle
 *
 *****/
Intersection.intersectCircleRectangle = function(c, r, r1, r2) {
    var min        = r1.min(r2);
    var max        = r1.max(r2);
    var topRight   = new Point2D( max.x, min.y );
    var bottomLeft = new Point2D( min.x, max.y );

    var inter1 = Intersection.intersectCircleLine(c, r, min, topRight);
    var inter2 = Intersection.intersectCircleLine(c, r, topRight, max);
    var inter3 = Intersection.intersectCircleLine(c, r, max, bottomLeft);
    var inter4 = Intersection.intersectCircleLine(c, r, bottomLeft, min);

    var result = new Intersection("No Intersection");

    result.appendPoints(inter1.points);
    result.appendPoints(inter2.points);
    result.appendPoints(inter3.points);
    result.appendPoints(inter4.points);

    if ( result.points.length > 0 )
        result.status = "Intersection";
    else
        result.status = inter1.status;

    return result;
};


/*****
 *
 *   intersectEllipseEllipse
 *
 *   This code is based on MgcIntr2DElpElp.cpp written by David Eberly.  His
 *   code along with many other excellent examples are avaiable at his site:
 *   http://www.magic-software.com
 *
 *   NOTE: Rotation will need to be added to this function
 *
 *****/
Intersection.intersectEllipseEllipse = function(c1, rx1, ry1, c2, rx2, ry2) {
    var a = [
        ry1*ry1, 0, rx1*rx1, -2*ry1*ry1*c1.x, -2*rx1*rx1*c1.y,
        ry1*ry1*c1.x*c1.x + rx1*rx1*c1.y*c1.y - rx1*rx1*ry1*ry1
    ];
    var b = [
        ry2*ry2, 0, rx2*rx2, -2*ry2*ry2*c2.x, -2*rx2*rx2*c2.y,
        ry2*ry2*c2.x*c2.x + rx2*rx2*c2.y*c2.y - rx2*rx2*ry2*ry2
    ];

    var yPoly   = Intersection.bezout(a, b);
    var yRoots  = yPoly.getRoots();
    var epsilon = 1e-3;
    var norm0   = ( a[0]*a[0] + 2*a[1]*a[1] + a[2]*a[2] ) * epsilon;
    var norm1   = ( b[0]*b[0] + 2*b[1]*b[1] + b[2]*b[2] ) * epsilon;
    var result  = new Intersection("No Intersection");

    for ( var y = 0; y < yRoots.length; y++ ) {
        var xPoly = new Polynomial(
            a[0],
            a[3] + yRoots[y] * a[1],
            a[5] + yRoots[y] * (a[4] + yRoots[y]*a[2])
        );
        var xRoots = xPoly.getRoots();

        for ( var x = 0; x < xRoots.length; x++ ) {
            var test =
                ( a[0]*xRoots[x] + a[1]*yRoots[y] + a[3] ) * xRoots[x] +
                    ( a[2]*yRoots[y] + a[4] ) * yRoots[y] + a[5];
            if ( Math.abs(test) < norm0 ) {
                test =
                    ( b[0]*xRoots[x] + b[1]*yRoots[y] + b[3] ) * xRoots[x] +
                        ( b[2]*yRoots[y] + b[4] ) * yRoots[y] + b[5];
                if ( Math.abs(test) < norm1 ) {
                    result.appendPoint( new Point2D( xRoots[x], yRoots[y] ) );
                }
            }
        }
    }

    if ( result.points.length > 0 ) result.status = "Intersection";

    return result;
};


/*****
 *
 *   intersectEllipseLine
 *
 *   NOTE: Rotation will need to be added to this function
 *
 *****/
Intersection.intersectEllipseLine = function(c, rx, ry, a1, a2) {
    var result;
    var origin = new Vector2D(a1.x, a1.y);
    var dir    = Vector2D.fromPoints(a1, a2);
    var center = new Vector2D(c.x, c.y);
    var diff   = origin.subtract(center);
    var mDir   = new Vector2D( dir.x/(rx*rx),  dir.y/(ry*ry)  );
    var mDiff  = new Vector2D( diff.x/(rx*rx), diff.y/(ry*ry) );

    var a = dir.dot(mDir);
    var b = dir.dot(mDiff);
    var c = diff.dot(mDiff) - 1.0;
    var d = b*b - a*c;

    if ( d < 0 ) {
        result = new Intersection("Outside");
    } else if ( d > 0 ) {
        var root = Math.sqrt(d);
        var t_a  = (-b - root) / a;
        var t_b  = (-b + root) / a;

        if ( (t_a < 0 || 1 < t_a) && (t_b < 0 || 1 < t_b) ) {
            if ( (t_a < 0 && t_b < 0) || (t_a > 1 && t_b > 1) )
                result = new Intersection("Outside");
            else
                result = new Intersection("Inside");
        } else {
            result = new Intersection("Intersection");
            if ( 0 <= t_a && t_a <= 1 )
                result.appendPoint( a1.lerp(a2, t_a) );
            if ( 0 <= t_b && t_b <= 1 )
                result.appendPoint( a1.lerp(a2, t_b) );
        }
    } else {
        var t = -b/a;
        if ( 0 <= t && t <= 1 ) {
            result = new Intersection("Intersection");
            result.appendPoint( a1.lerp(a2, t) );
        } else {
            result = new Intersection("Outside");
        }
    }

    return result;
};


/*****
 *
 *   intersectEllipsePolygon
 *
 *****/
Intersection.intersectEllipsePolygon = function(c, rx, ry, points) {
    var result = new Intersection("No Intersection");
    var length = points.length;

    for ( var i = 0; i < length; i++ ) {
        var b1 = points[i];
        var b2 = points[(i+1) % length];
        var inter = Intersection.intersectEllipseLine(c, rx, ry, b1, b2);

        result.appendPoints(inter.points);
    }

    if ( result.points.length > 0 )
        result.status = "Intersection";

    return result;
};


/*****
 *
 *   intersectEllipseRectangle
 *
 *****/
Intersection.intersectEllipseRectangle = function(c, rx, ry, r1, r2) {
    var min        = r1.min(r2);
    var max        = r1.max(r2);
    var topRight   = new Point2D( max.x, min.y );
    var bottomLeft = new Point2D( min.x, max.y );

    var inter1 = Intersection.intersectEllipseLine(c, rx, ry, min, topRight);
    var inter2 = Intersection.intersectEllipseLine(c, rx, ry, topRight, max);
    var inter3 = Intersection.intersectEllipseLine(c, rx, ry, max, bottomLeft);
    var inter4 = Intersection.intersectEllipseLine(c, rx, ry, bottomLeft, min);

    var result = new Intersection("No Intersection");

    result.appendPoints(inter1.points);
    result.appendPoints(inter2.points);
    result.appendPoints(inter3.points);
    result.appendPoints(inter4.points);

    if ( result.points.length > 0 )
        result.status = "Intersection";

    return result;
};


/*****
 *
 *   intersectLineLine
 *
 *****/
Intersection.intersectLineLine = function(a1, a2, b1, b2) {
    var result;

    var ua_t = (b2.x - b1.x) * (a1.y - b1.y) - (b2.y - b1.y) * (a1.x - b1.x);
    var ub_t = (a2.x - a1.x) * (a1.y - b1.y) - (a2.y - a1.y) * (a1.x - b1.x);
    var u_b  = (b2.y - b1.y) * (a2.x - a1.x) - (b2.x - b1.x) * (a2.y - a1.y);

    if ( u_b != 0 ) {
        var ua = ua_t / u_b;
        var ub = ub_t / u_b;

        if ( 0 <= ua && ua <= 1 && 0 <= ub && ub <= 1 ) {
            result = new Intersection("Intersection");
            result.points.push(
                new Point2D(
                    a1.x + ua * (a2.x - a1.x),
                    a1.y + ua * (a2.y - a1.y)
                )
            );
        } else {
            result = new Intersection("No Intersection");
        }
    } else {
        if ( ua_t == 0 || ub_t == 0 ) {
            result = new Intersection("Coincident");
        } else {
            result = new Intersection("Parallel");
        }
    }

    return result;
};


/*****
 *
 *   intersectLinePolygon
 *
 *****/
Intersection.intersectLinePolygon = function(a1, a2, points) {
    var result = new Intersection("No Intersection");
    var length = points.length;

    for ( var i = 0; i < length; i++ ) {
        var b1 = points[i];
        var b2 = points[(i+1) % length];
        var inter = Intersection.intersectLineLine(a1, a2, b1, b2);

        result.appendPoints(inter.points);
    }

    if ( result.points.length > 0 ) result.status = "Intersection";

    return result;
};


/*****
 *
 *   intersectLineRectangle
 *
 *****/
Intersection.intersectLineRectangle = function(a1, a2, r1, r2) {
    var min        = r1.min(r2);
    var max        = r1.max(r2);
    var topRight   = new Point2D( max.x, min.y );
    var bottomLeft = new Point2D( min.x, max.y );

    var inter1 = Intersection.intersectLineLine(min, topRight, a1, a2);
    var inter2 = Intersection.intersectLineLine(topRight, max, a1, a2);
    var inter3 = Intersection.intersectLineLine(max, bottomLeft, a1, a2);
    var inter4 = Intersection.intersectLineLine(bottomLeft, min, a1, a2);

    var result = new Intersection("No Intersection");

    result.appendPoints(inter1.points);
    result.appendPoints(inter2.points);
    result.appendPoints(inter3.points);
    result.appendPoints(inter4.points);

    if ( result.points.length > 0 )
        result.status = "Intersection";

    return result;
};


/*****
 *
 *   intersectPolygonPolygon
 *
 *****/
Intersection.intersectPolygonPolygon = function(points1, points2) {
    var result = new Intersection("No Intersection");
    var length = points1.length;

    for ( var i = 0; i < length; i++ ) {
        var a1 = points1[i];
        var a2 = points1[(i+1) % length];
        var inter = Intersection.intersectLinePolygon(a1, a2, points2);

        result.appendPoints(inter.points);
    }

    if ( result.points.length > 0 )
        result.status = "Intersection";

    return result;

};


/*****
 *
 *   intersectPolygonRectangle
 *
 *****/
Intersection.intersectPolygonRectangle = function(points, r1, r2) {
    var min        = r1.min(r2);
    var max        = r1.max(r2);
    var topRight   = new Point2D( max.x, min.y );
    var bottomLeft = new Point2D( min.x, max.y );

    var inter1 = Intersection.intersectLinePolygon(min, topRight, points);
    var inter2 = Intersection.intersectLinePolygon(topRight, max, points);
    var inter3 = Intersection.intersectLinePolygon(max, bottomLeft, points);
    var inter4 = Intersection.intersectLinePolygon(bottomLeft, min, points);

    var result = new Intersection("No Intersection");

    result.appendPoints(inter1.points);
    result.appendPoints(inter2.points);
    result.appendPoints(inter3.points);
    result.appendPoints(inter4.points);

    if ( result.points.length > 0 )
        result.status = "Intersection";

    return result;
};


/*****
 *
 *   intersectRayRay
 *
 *****/
Intersection.intersectRayRay = function(a1, a2, b1, b2) {
    var result;

    var ua_t = (b2.x - b1.x) * (a1.y - b1.y) - (b2.y - b1.y) * (a1.x - b1.x);
    var ub_t = (a2.x - a1.x) * (a1.y - b1.y) - (a2.y - a1.y) * (a1.x - b1.x);
    var u_b  = (b2.y - b1.y) * (a2.x - a1.x) - (b2.x - b1.x) * (a2.y - a1.y);

    if ( u_b != 0 ) {
        var ua = ua_t / u_b;

        result = new Intersection("Intersection");
        result.points.push(
            new Point2D(
                a1.x + ua * (a2.x - a1.x),
                a1.y + ua * (a2.y - a1.y)
            )
        );
    } else {
        if ( ua_t == 0 || ub_t == 0 ) {
            result = new Intersection("Coincident");
        } else {
            result = new Intersection("Parallel");
        }
    }

    return result;
};


/*****
 *
 *   intersectRectangleRectangle
 *
 *****/
Intersection.intersectRectangleRectangle = function(a1, a2, b1, b2) {
    var min        = a1.min(a2);
    var max        = a1.max(a2);
    var topRight   = new Point2D( max.x, min.y );
    var bottomLeft = new Point2D( min.x, max.y );

    var inter1 = Intersection.intersectLineRectangle(min, topRight, b1, b2);
    var inter2 = Intersection.intersectLineRectangle(topRight, max, b1, b2);
    var inter3 = Intersection.intersectLineRectangle(max, bottomLeft, b1, b2);
    var inter4 = Intersection.intersectLineRectangle(bottomLeft, min, b1, b2);

    var result = new Intersection("No Intersection");

    result.appendPoints(inter1.points);
    result.appendPoints(inter2.points);
    result.appendPoints(inter3.points);
    result.appendPoints(inter4.points);

    if ( result.points.length > 0 )
        result.status = "Intersection";

    return result;
};


/*****
 *
 *   bezout
 *
 *   This code is based on MgcIntr2DElpElp.cpp written by David Eberly.  His
 *   code along with many other excellent examples are avaiable at his site:
 *   http://www.magic-software.com
 *
 *****/
Intersection.bezout = function(e1, e2) {
    var AB    = e1[0]*e2[1] - e2[0]*e1[1];
    var AC    = e1[0]*e2[2] - e2[0]*e1[2];
    var AD    = e1[0]*e2[3] - e2[0]*e1[3];
    var AE    = e1[0]*e2[4] - e2[0]*e1[4];
    var AF    = e1[0]*e2[5] - e2[0]*e1[5];
    var BC    = e1[1]*e2[2] - e2[1]*e1[2];
    var BE    = e1[1]*e2[4] - e2[1]*e1[4];
    var BF    = e1[1]*e2[5] - e2[1]*e1[5];
    var CD    = e1[2]*e2[3] - e2[2]*e1[3];
    var DE    = e1[3]*e2[4] - e2[3]*e1[4];
    var DF    = e1[3]*e2[5] - e2[3]*e1[5];
    var BFpDE = BF + DE;
    var BEmCD = BE - CD;

    return new Polynomial(
        AB*BC - AC*AC,
        AB*BEmCD + AD*BC - 2*AC*AE,
        AB*BFpDE + AD*BEmCD - AE*AE - 2*AC*AF,
        AB*DF + AD*BFpDE - 2*AE*AF,
        AD*DF - AF*AF
    );
};

define("futuregrapher/../../vendor/intersect.js", function(){});

// This class renders and updates arrays of NodeCircles etc. to SVG using D3.

define('futuregrapher/svgrenderer',['require','futuregrapher/svgrendererdefaultoptions','../../vendor/intersect.js'],function(require) {
    var defaultSvgRendererOptions = require('futuregrapher/svgrendererdefaultoptions');
    require("../../vendor/intersect.js");

    // Polyfill for Function.prototype.bind in case it doesn't exist.
    if (!Function.prototype.bind) {
        Function.prototype.bind = function (oThis) {
            if (typeof this !== "function") {
                // closest thing possible to the ECMAScript 5
                // internal IsCallable function
                throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
            }
            
            var aArgs = Array.prototype.slice.call(arguments, 1), 
                fToBind = this, 
                fNOP = function () {},
                fBound = function () {
                    return fToBind.apply(this instanceof fNOP && oThis
                        ? this
                        : oThis,
                        aArgs.concat(Array.prototype.slice.call(arguments)));
                };
            
            fNOP.prototype = this.prototype;
            fBound.prototype = new fNOP();
            
            return fBound;
        };
    }
    
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
