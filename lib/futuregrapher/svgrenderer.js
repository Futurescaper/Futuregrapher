// This class renders and updates arrays of NodeCircles etc. to SVG using D3.

define(function(require) {
    var defaultSvgRendererOptions = require('futuregrapher/svgrendererdefaultoptions');
    require("../../vendor/intersect.js");

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
                .attr("cx", function (d) { return 100; var sx = xScale(d.x); return isNaN(sx) ? 0 : sx; })
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