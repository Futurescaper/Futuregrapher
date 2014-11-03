define(function(require) {
    var defaultGraphVisOptions = require('futuregrapher/defaultgraphvisoptions');
    var NodeCircle = require('futuregrapher/nodecircle');
    var LinkLine = require('futuregrapher/linkline');
    var LabelText = require('futuregrapher/labeltext');
    var ClusterHull = require('futuregrapher/clusterhull');

    var GraphVis = function (renderer, options) {
        var self = this;
        options = $.extend(true, {}, defaultGraphVisOptions, options);
    
        var visNodes, visNodeLookups, visLinks, visClusters;
        
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

        var zoomBehavior = d3.behavior.zoom()
            .x(xScale)
            .y(yScale)
            .scaleExtent(options.zoomExtent)
            .on("zoom", zoomed);
    
        this.unscaleCoords = function(screenCoords) {
            var unscaledX = xScale.invert(screenCoords[0]);
            var unscaledY = yScale.invert(screenCoords[1]);
            
            return [unscaledX, unscaledY];
        };

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
            if (options.onClusterClick)
                clusterHull.eventHandlers.click = options.onClusterClick;
        
            // If a double click handler is provided, use it. Otherwise, default behavior is to collapse the cluster when double-clicking.
            if (options.onClusterDoubleClick)
                clusterHull.eventHandlers.dblclick = options.onClusterDoubleClick;
            else
                clusterHull.eventHandlers.dblclick = function () {
                    visCluster.isCollapsed = true;
                    self.update();
                };
        
            if (options.onClusterMouseOver)
                clusterHull.eventHandlers.mouseover = options.onClusterMouseOver;
            if (options.onClusterMouseOut)
                clusterHull.eventHandlers.mouseout = options.onClusterMouseOut;
        
            clusterHull.nodeCircles = [];   // Do this so we can safely push nodeCircle's in here, even if we're reusing an old ClusterHull.
        
            var dynamicDescription = options.describeExpandedCluster ? options.describeExpandedCluster(visCluster, [/* TODO: nodecircles */], radiusFactor) : {};
            var description = _.extend({}, options.defaultExpandedClusterDescription, dynamicDescription);
        
            clusterHull.updateProperties(description);
        
            return clusterHull;
        }
        
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
                if (options.onNodeClick)
                    nodeCircle.eventHandlers.click = options.onNodeClick;
                if (options.onNodeDoubleClick)
                    nodeCircle.eventHandlers.dblclick = options.onNodeDoubleClick;
                if (options.onNodeMouseOver)
                    nodeCircle.eventHandlers.mouseover = options.onNodeMouseOver;
                if (options.onNodeMouseOut)
                    nodeCircle.eventHandlers.mouseout = options.onNodeMouseOut;
                if (options.onNodeMouseDown)
                    nodeCircle.eventHandlers.mousedown = options.onNodeMouseDown;
                if (options.onNodeMouseUp)
                    nodeCircle.eventHandlers.mouseup = options.onNodeMouseUp;
                if (options.onNodeDragStart)
                    nodeCircle.eventHandlers.dragstart = options.onNodeDragStart;
                if (options.onNodeDrag)
                    nodeCircle.eventHandlers.drag = options.onNodeDrag;
                if (options.onNodeDragEnd)
                    nodeCircle.eventHandlers.dragend = options.onNodeDragEnd;
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

        function nodeCircleAndLabelTextFromCollapsedCluster(visCluster, clusterVisNodes, clusterVisLinks) {
            var nodeCircle, labelText;
            var id = "placeholder-" + visCluster.id;
        
            var oldNodeCircle = _.find(nodeCircles, function (nc) { return nc.id === id; });
            if (oldNodeCircle)
                nodeCircle = oldNodeCircle;
            else {
                nodeCircle = new NodeCircle(id, { visCluster: visCluster, visNodes: clusterVisNodes, visLinks: clusterVisLinks });
        
                // If this cluster was just collapsed, nodeCircles (== the node circles of last render cycle) will contain nodeCircle instances
                // for the individual nodes in the cluster. We need to position this new placeholder in the centroid of those.
                var oldClusterNodeCircles = _.filter(nodeCircles, function (nc) {
                    return nc.visData && nc.visData.clusterId === visCluster.id;
                });

                if (oldClusterNodeCircles.length) {
                    nodeCircle.x = d3.mean(oldClusterNodeCircles, function (nc) { return nc.x; });
                    nodeCircle.y = d3.mean(oldClusterNodeCircles, function (nc) { return nc.y; });
                }
        
                nodeCircle.eventHandlers = {};    
                if (options.onClusterNodeClick)
                    nodeCircle.eventHandlers.click = options.onClusterNodeClick;
                
                if (options.onClusterNodeDoubleClick)
                    nodeCircle.eventHandlers.dblclick = options.onClusterNodeDoubleClick; 
                else
                    nodeCircle.eventHandlers.dblclick = function () {
                        visCluster.isCollapsed = false; 
                        self.update(); 
                    }
                
                if (options.onClusterNodeMouseOver)
                    nodeCircle.eventHandlers.mouseover = options.onClusterNodeMouseOver;
                if (options.onClusterNodeMouseOut)
                    nodeCircle.eventHandlers.mouseout = options.onClusterNodeMouseOut;
                if (options.onClusterNodeDragStart)
                    nodeCircle.eventHandlers.dragstart = options.onClusterNodeDragStart;
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

        function linkLineFromVisLinkAndNodeCircles(visLink, sourceNodeCircle, targetNodeCircle) {
            var linkLine;
            var id = sourceNodeCircle.id + "->" + targetNodeCircle.id;
        
            var oldLinkLine = _.find(linkLines, function (ll) { return ll.id === id; });
            if (oldLinkLine)
                linkLine = oldLinkLine;
            else {
                linkLine = new LinkLine(id, sourceNodeCircle, targetNodeCircle, visLink);
        
                linkLine.eventHandlers = {};    
                if (options.onLinkClick)
                    linkLine.eventHandlers.click = options.onLinkClick;
                if (options.onLinkDoubleClick)
                    linkLine.eventHandlers.dblclick = options.onLinkDoubleClick;
                if (options.onLinkMouseOver)
                    linkLine.eventHandlers.mouseover = options.onLinkMouseOver;
                if (options.onLinkMouseOut)
                    linkLine.eventHandlers.mouseout = options.onLinkMouseOut;
            }
        
            var dynamicDescription = options.describeVisLink ? options.describeVisLink(visLink, sourceNodeCircle, targetNodeCircle, radiusFactor) : {};
            var description = _.extend({}, options.defaultLinkDescription, dynamicDescription);
        
            linkLine.updateProperties(description);
        
            return linkLine;
        }

        function linkLineFromClusterLink(sourceNodeCircle, targetNodeCircle, visLinks) {
            var linkLine;
            var id = sourceNodeCircle.id + "->" + targetNodeCircle.id;
        
            var oldLinkLine = _.find(linkLines, function (ll) { return ll.id === id; });
            if (oldLinkLine)
                linkLine = oldLinkLine;
            else {
                linkLine = new LinkLine(id, sourceNodeCircle, targetNodeCircle, visLinks);
        
                linkLine.eventHandlers = {};    
                if (options.onLinkClick)
                    linkLine.eventHandlers.click = options.onLinkClick;
                if (options.onLinkDoubleClick)
                    linkLine.eventHandlers.dblclick = options.onLinkDoubleClick;
                if (options.onLinkMouseOver)
                    linkLine.eventHandlers.mouseover = options.onLinkMouseOver;
                if (options.onLinkMouseOut)
                    linkLine.eventHandlers.mouseout = options.onLinkMouseOut;
            }
        
            var dynamicDescription = options.describeClusterLink ? options.describeClusterLink(visLinks, sourceNodeCircle, targetNodeCircle, radiusFactor) : {};
            var description = _.extend({}, options.defaultClusterLinkDescription, dynamicDescription);
        
            linkLine.updateProperties(description);
        
            return linkLine;
        }

        this.update = function (newVisNodes, newVisLinks, newVisClusters, transitionDuration, updateType) {
            if (newVisNodes) {
                visNodes = newVisNodes;
                visNodeLookups = {};
                _.each(visNodes, function(vn) {
                    visNodeLookups[vn.id] = vn;
                });
            }

            if (newVisLinks)
                visLinks = newVisLinks;
            if (newVisClusters)
                visClusters = newVisClusters;
            if (_.isUndefined(transitionDuration))
                transitionDuration = 250;
            if (!updateType)
                updateType = "update";
        
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
        
            var newClusterHulls = [];   // We'll only create hulls for expanded clusters
            var collapsedClusters = {};  // Collapsed ones go in here to turn into placeholder NodeCircles
            _.each(visClusters, function (vc) {
                if (!vc.isCollapsed)
                    newClusterHulls.push(clusterHullFromVisCluster(vc));
                else
                    collapsedClusters[vc.id] = { visNodes: [], visLinks: [] };
            });
            
            var newNodeCircles = {};
            var newLabelTexts = [];
            _.each(visNodes, function (visNode) {
                if (visNode.clusterId) {
                    var clusterHull = _.find(newClusterHulls, function (ch) { return ch.id === visNode.clusterId; });
                    
                    if (clusterHull) {
                        var nodeCombination = nodeCircleAndLabelTextFromVisNode(visNode);
                        var nodeCircle = nodeCombination.nodeCircle;
                        newNodeCircles[nodeCircle.id] = nodeCircle;
                        clusterHull.nodeCircles.push(nodeCircle);
            
                        if (nodeCombination.labelText)
                            newLabelTexts.push(nodeCombination.labelText);
                    }
                    else {
                        if (!collapsedClusters.hasOwnProperty(visNode.clusterId))
                            throw "Node '" + visNode.id + "' refers to a cluster '" + visNode.clusterId + "' that wasn't defined";
                        
                        collapsedClusters[visNode.clusterId].visNodes.push(visNode);
                    }
                } else {
                    var nodeCombination = nodeCircleAndLabelTextFromVisNode(visNode);
                    newNodeCircles[nodeCombination.nodeCircle.id] = nodeCombination.nodeCircle;
                    if (nodeCombination.labelText)
                        newLabelTexts.push(nodeCombination.labelText);
                }
            });
            
            _.each(collapsedClusters, function (collapsedCluster, clusterId) {
                var visCluster = _.find(visClusters, function (vc) { return vc.id === clusterId; });
                var nodeCombination = nodeCircleAndLabelTextFromCollapsedCluster(visCluster, collapsedCluster.visNodes, collapsedCluster.visLinks);
                newNodeCircles[nodeCombination.nodeCircle.id] = nodeCombination.nodeCircle;
                if (nodeCombination.labelText)
                    newLabelTexts.push(nodeCombination.labelText);
            });

            var clusterLinks = {};
            
            var newLinkLines = [];
            _.each(visLinks, function (visLink) {
                var sourceVisNode = visNodeLookups[visLink.sourceNodeId]; //_.find(visNodes, function (vn) { return vn.id === visLink.sourceNodeId; });
                if (!sourceVisNode)
                    throw "Link refers to a source node '" + visLink.sourceNodeId + "' that wasn't found";
            
                var targetVisNode = visNodeLookups[visLink.targetNodeId]; //_.find(visNodes, function (vn) { return vn.id === visLink.targetNodeId; });
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
                    sourceNodeCircle = newNodeCircles['placeholder-' + sourceVisCluster.id]; //_.find(newNodeCircles, function (nc) { return nc.id === "placeholder-" + sourceVisCluster.id; });
                }
                else
                    sourceNodeCircle = newNodeCircles[sourceVisNode.id]; //_.find(newNodeCircles, function (nc) { return nc.id === sourceVisNode.id; });

                if (targetVisCluster && targetVisCluster.isCollapsed) {
                    isClusterLink = true;
                    targetNodeCircle = newNodeCircles['placeholder-' + targetVisCluster.id]; //_.find(newNodeCircles, function (nc) { return nc.id === "placeholder-" + targetVisCluster.id; });
                }
                else
                    targetNodeCircle = newNodeCircles[targetVisNode.id]; //_.find(newNodeCircles, function (nc) { return nc.id === targetVisNode.id; });

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

            // convert newNodeCircles to array
            newNodeCircles = _.map(newNodeCircles, function(c) { return c; });

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
                if(radiusFactor == Infinity)
                    radiusFactor = 1.0;
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

        this.updatePositions = function (updateType) {
            if (options.onUpdateAutoZoom) {
                var renderElements = { clusterHulls: clusterHulls, linkLines: linkLines, nodeCircles: nodeCircles, labelTexts: labelTexts };
                var updatedZoom = options.onUpdateAutoZoom(renderElements, zoomBehavior.scale(), zoomBehavior.translate());
                
                if (updatedZoom.scale) zoomBehavior.scale(updatedZoom.scale);
                if (updatedZoom.translate) zoomBehavior.translate(updatedZoom.translate);
        
                radiusFactor = zoomDensityScale(zoomBehavior.scale());
                if(radiusFactor == Infinity)
                    radiusFactor = 1.0;
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
        };

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

        this.resumeForce = function () {
            force.resume();
        };

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

        this.stopForce = function () {
            if (force) force.stop();
        };

        this.zoomPan = function (scale, translate) {
            zoomBehavior.scale(scale).translate(translate);
            zoomed();
        };

        this.getVisNode = function(id) {
            if(nodeCircles)
                return _.findWhere(nodeCircles, { id: id.toString() });
        };
    
        function initialize() {
            var container = d3.select(renderer.containerElement()[0]);
            
            if (options.enableZoom) {
                container
                    .call(zoomBehavior)
                    .on("dblclick.zoom", null);
            }
        
            if (options.onClick)
                container.on("click", options.onClick);
            if (options.onMouseDown)
                container.on("mousedown", options.onMouseDown);
            if (options.onMouseUp)
                container.on("mouseup", options.onMouseUp);
            if (options.onMouseMove)
                container.on("mousemove", options.onMouseMove);
        }

        initialize();
    };
    
    return GraphVis;
});