if(Meteor.isClient) {
    ClusteringNodeProvider = function (graph) {

        var _nodelib = new d3nodes(graph);
        var visNodes = [];
        this.getVisNodes = function () { return visNodes; }
        this.getAllNodes = function () { return _nodelib.getNodes(); }

        var _linklib = new d3links(graph);
        var visLinks = [];
        this.getVisLinks = function () { return visLinks; }
        this.getAllLinks = function () { return _linklib.getLinks(); }

        var clusters = {};
        var visClusters = [];
        this.getVisClusters = function () { return visClusters; }

        function getOrCreateCluster(clusterId) {
            if(!clusters.hasOwnProperty(clusterId)) {
                var nodes = [];
                
                function makeHull() {
                    var nodePoints = [];
                    
                    _(nodes).each(function (n) {
                        var offset = n.radius || 5;
                        var x = n.x || 0;
                        var y = n.y || 0;
                        nodePoints.push([x - offset, y - offset]);
                        nodePoints.push([x - offset, y + offset]);
                        nodePoints.push([x + offset, y - offset]);
                        nodePoints.push([x + offset, y + offset]);
                     });
                    
                    return d3.geom.hull(nodePoints);
                }
                
                var cluster = {
                    id: clusterId,
                    collapsed: true,
                    nodes: nodes,
                    makeHull: makeHull
                };
                clusters[clusterId] = cluster;
    
                var placeholderNode = {
                    id: "cluster-" + clusterId,
                    title: clusterId,
                    color: "#ff8888",
                    value: { size: 1, color: 1 },
                    ratio: { size: 0, color: 0 },
                    data: [],
                    radius: graph.settings.maxRadius,
                    visible: true,
                    isClusterPlaceholder: true,
                    clusterId: clusterId,
                    cluster: cluster
                };
                
                cluster.placeholderNode = placeholderNode;
                visNodes.push(placeholderNode);
            }
            
            return clusters[clusterId];
        }

        this.setCluster = function (clusterId, title, color) {
            var cluster = getOrCreateCluster(clusterId);
            cluster.placeholderNode.title = title;
            cluster.placeholderNode.color = color;
        }

        this.updateClusters = function () {
            for (var clusterId in clusters) {
                if (!clusters.hasOwnProperty(clusterId)) continue;

                var cluster = clusters[clusterId];

                // remove the placeholder node
                var placeholderIndex = visNodes.indexOf(cluster.placeholderNode);
                visNodes.splice(placeholderIndex, 1);
                
            }
            
            // Clear clusters
            clusters = {};
            
            // And rebuild them
            _(_nodelib.getNodes()).each(function (node) {
                if (node.clusterId) {
                    var cluster = getOrCreateCluster(node.clusterId);
                    cluster.nodes.push(node);
                }
                else {
                    if(visNodes.indexOf(node) === -1)
                        visNodes.push(node);
                }
            });
            
        }
        
        this.addNode = function (settings) {
            var node = _nodelib.addNode(settings);
        
            if(settings.clusterId) {
                var cluster = getOrCreateCluster(settings.clusterId);
                cluster.nodes.push(node);
            }
            else {
                visNodes.push(node);
            }
            
            return node;
        };
        
        this.removeNode = function (id, tag, fade, forceRemove) {
            return _nodelib.removeNode(id, tag, fade, forceRemove);
        };
        
        this.removeNodeByIndex = function (index) {
            return _nodelib.removeNodeByIndex(index);
        }
        
        this.addLink = function (options) {
            var link = _linklib.addLink(options);
            
            if (link.source.clusterId) {
                if (link.target.clusterId && link.source.clusterId === link.target.clusterId) {
                    // Same cluster. Don't add this link to vis.
                    return link;
                }
        
                link.sourceNode = link.source;
                link.source = clusters[link.source.clusterId].placeholderNode;
            }  
            
            if (link.target.clusterId) {
                link.targetNode = link.target;
                link.target = clusters[link.target.clusterId].placeholderNode;
            }
        
            visLinks.push(link);
            return link;
        };
        
        this.removeLink = function (from, to) {
            return _linklib.removeLink(from, to);
        };

        this.getCluster = function (clusterId) {
            return clusters[clusterId];
        }

        this.getNodeColor = function (d) { 
            if(d.isClusterPlaceholder) {
                return d.color;
            }
            else
                return _nodelib.getNodeColor(d); 
        }
        
        this.getNodeBorderColor = function (d) { return _nodelib.getNodeBorderColor(d); }
        this.getNodeRadius = function (d) { return _nodelib.getNodeRadius(d); }
        
        this.getNodeTooltip = function (d) { return _nodelib.getNodeTooltip(d); }

        this.onNodeMouseover = function (d) { 
            if(d.isClusterPlaceholder) return;

            return _nodelib.onNodeMouseover(d); 
        }
        
        this.onNodeMouseout = function (d) { 
            if(d.isClusterPlaceholder) return;

            return _nodelib.onNodeMouseout(d); 
        }
        
        this.onNodeMousedown = function (d) { 
            if(d.isClusterPlaceholder) return;

            return _nodelib.onNodeMousedown(d); 
        }
        
        this.onNodeMouseup = function (d) { 
            if(d.isClusterPlaceholder) return;

            return _nodelib.onNodeMouseup(d); 
        }
        
        this.onNodeClick = function (d) { 
            if(d.isClusterPlaceholder) {
                return; // For now, do nothing when clicking a placeholder node.
                
                // Add all the contained nodes to vis
                _(d.cluster.nodes).each(function (n) {
                    visNodes.push(n);
                });
                
                // remove the placeholder
                var placeholderIndex = visNodes.indexOf(d);
                visNodes.splice(placeholderIndex, 1);
                
                // Add cluster to vis
                visClusters.push(d.cluster);
                
                d.cluster.collapsed = false;
                graph.update();
                return;
            }
            else {            
                return _nodelib.onNodeClick(d); 
            }
        }
        
        this.onNodeDblClick = function (d) { return _nodelib.onNodeDblClick(d); }
        this.onNodeRightClick = function (d) { return _nodelib.onNodeRightClick(d); }

        this.moveNodes = function (positions, time, ignoreLinks) {
            graph.force.stop();
            graph.fixedMode = true;
        
            var center = graph.getCenter();
            var node = null;
            $.each(positions, function (i, position) {
                $.each(visNodes, function (j, n) {
                    if (position.id == n.id) {
                        node = n;
                        n.fixed = true;
                        if (position.radius)
                            n._radius = position.radius;
                        if (position.opacity >= 0.0)
                            n.opacity = position.opacity;
                        if (position.color)
                            n.color = n._color = position.color;
                        if (position.labelColor)
                            n.labelColor = position.labelColor;
                        if (position.labelSize)
                            n.fontSize = position.labelSize;
                        if (position.labelOpacity)
                            n.labelOpacity = position.labelOpacity;

                        n.anchor = position.anchor;

                        var r = n._radius || n.radius;
                        if (position.x)
                            n.x = position.x; // Math.max(n.radius, Math.min(position.x, graph.width - r));
                        if (position.y)
                            n.y = position.y; // Math.max(n.radius, Math.min(position.y, graph.height - r));
        
                        return false;
                    }
                });
        
                if (node) {
                    graph.d3().selectAll('g.node[id="' + position.id + '"]')
                        .each(function (d) { d.fixed = true; })
                        .transition()
                        .delay(function (d, i) { return i * 2; })
                        .duration(time || 500)
                        .attr('cx', function(d) { return d.x; }).attr('cy', function(d) { return d.y; })
                        .attr('transform', function (d) { return 'translate(' + d.x + ',' + d.y + ')'; });
        
                    var x = graph.d3().selectAll('g.node[id="' + position.id + '"] circle')
                        .transition()
                        .delay(function (d, i) { return i * 2; })
                        .duration(time || 500);
        
                    if(position.radius)
                        x = x.attr('r', node._radius || node.radius);
                    if(position.opacity >= 0.0)
                        x = x.style('opacity', position.opacity || 1.0);
                    if(position.color)
                        x.style('fill', position.color);
                    if(position.stroke)
                        x.style('stroke', position.stroke);
                    else if(position.color) {
                        node.color = position.color;
                        x.style('stroke', graph.getNodeBorderColor(node));
                    }
                    var opacity = (node.labelOpacity || node.opacity || 1.0);
                    graph.d3().selectAll('g.label[id="' + position.id + '"]')
                        //.transition()
                        //.duration(time || 500)
                        .style('opacity', opacity);
        
                    graph.d3().selectAll('g.label[id="' + position.id + '"] text')
                        //.transition()
                        //.duration(time || 500)
                        .style('opacity', opacity)
                        //.text(function(d) { return opacity > 0 ? d.title : ''; })
                        //.style('font-size', function(d) { return jQuery.isNumeric(d.fontSize) ? d.fontSize + 'em' : d.fontSize })
                        .attr('text-anchor', function(d) { return position.anchor||(d.x < center.x ? 'end' : 'start') })
                        .attr('fill', function(d) { return position.labelColor || graph.getNodeBorderColor(d); } /*LABEL FIX:node.labelColor*/);
                }
            });
        
            if (ignoreLinks)
                graph._links
                    .transition()
                    //.delay(function (d, i) { return i * 2; })
                    .duration(time || 500)
                    .style('opacity', 1.0)
                    .attrTween('d', _linklib.calculatePathTween); //function (d) { return graph.linklib().calculatePath(d); });
            else
                graph._links
                    .transition()
                    .duration(time || 500)
                    .style('opacity', function (d) {
                        // figure out what the opacity is for this link
                        var id = d.source.id;
                        var opacity = 0.0;
                        $.each(positions, function (i, p) {
                            if (p.id == id) {
                                if (p.links) {
                                    $.each(p.links, function (j, link) {
                                        if (link.id == d.target.id) {
                                            if (link.opacity)
                                                opacity = link.opacity;
                                            return false;
                                        }
                                    });
                                }
                            }
                        });
                        d._opacity = opacity;
                        return opacity;
                    })
                    .attr('stroke', function (d) {
                        // figure out what the color is for this link
                        var id = d.source.id;
                        var color = d.color;
                        $.each(positions, function (i, p) {
                            if (p.id == id) {
                                if (p.links) {
                                    $.each(p.links, function (j, link) {
                                        if (link.id == d.target.id) {
                                            if (link.color)
                                                color = link.color;
                                            return false;
                                        }
                                    });
                                }
                            }
                        });
                        return color;
                    })
                    .attr('stroke-width', function (d) {
                        // figure out what the color is for this link
                        var id = d.source.id;
                        var width = 2;
                        $.each(positions, function (i, p) {
                            if (p.id == id) {
                                if (p.links) {
                                    $.each(p.links, function (j, link) {
                                        if (link.id == d.target.id) {
                                            if (link.width) {
                                                width = link.width;
                                            }
                                            return false;
                                        }
                                    });
                                }
                            }
                        });
                        return parseInt(width||1);
                    })
                    .attrTween('d', _linklib.calculatePathTween);
        
            // Update labels
            graph.d3()
                .selectAll('g.label')
                .transition()
                .delay(function (d, i) { return i * 2; })
                .duration(time || 500)
                .attr('transform', function (node) { return graph.d3labels().transformLabel(node, center); });
        };

        
        this.updateMarkers = function () { _linklib.updateMarkers(); }
        
        this.calculate = function(filterKey) {
            _nodelib.calculateNodes(filterKey);
            _linklib.calculateLinks(filterKey);
        };
        
        
        this.onLinkMouseover = function (d) { return _linklib.onLinkMouseover(d); }
        this.onLinkMouseout = function (d) { return _linklib.onLinkMouseout(d); }
        this.onLinkClick = function (d) { return _linklib.onLinkClick(d); }
        
        this.getMarkerUrl = function (d) { return _linklib.getMarkerUrl(d); }
        
        this.getLinkWidth = function (d) { return _linklib.getLinkWidth(d); }
        this.getLinkColor = function (d, minColor, maxColor) { return _linklib.getLinkColor(d, minColor, maxColor); }
        
        this.calculatePath = function (d, b) { return _linklib.calculatePath(d, b); }
        
        this.updateLinkColors = function () { _linklib.updateLinkColors(); }
        
        
        
        
        this.updateSizesForZoom = function (scale) {
            _nodelib.updateNodeSizesForZoom(scale);
            _linklib.updateLinkSizesForZoom(scale);
        }
        
        /* Node methods */
        
        this.animateNodeClick = function(node, time, callback) {
            return _nodelib.animateNodeClick(node, time, callback);
        };
        
        this.setNodeTitle = function (node, title) {
            return _nodelib.setNodeTitle(node, title);
        };
        
        this.updateNodeColors = function () {
            return _nodelib.updateColors();
        }
        
        this.getNode = function (id) {
            return _nodelib.getNode(id);
        };
        
        this.getNodeByTitle = function(title) {
            return _nodelib.getNodeByTitle(title);
        };
        
        this.getNodeBorderColor = function (d, opacity) {
            return _nodelib.getNodeBorderColor(d, opacity);
        }
        
        this.viewClusters = function (pct) {
            return _nodelib.viewClusters(pct);
        };
        
        /* End node methods */
        
        /* Link methods */
        
        
        this.getSharedLinks = function (nodes) {
            return _linklib.getSharedLinks(nodes);
        };
        
        /* End link methods */
        
        
        this.getCenter = function () {
            return _nodelib.getCenter();
        };
        
        this.clear = function () {
            _nodelib.clear();
            _linklib.clear();
        }
        
        
    }
}
