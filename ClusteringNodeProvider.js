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

        //[of]:        this.addNode = function (settings) {
        this.addNode = function (settings) {
            // Temporary hard-coded cluster:
            if(settings.title.indexOf("social") !== -1)
                settings.clusterId = "social";
            else
                settings.clusterId = null;
            
            var node = _nodelib.addNode(settings);
        
            if(settings.clusterId) {
                if(!clusters.hasOwnProperty(settings.clusterId)) {
                    var nodes = [node];
                    
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
                        id: settings.clusterId,
                        collapsed: true,
                        nodes: nodes,
                        makeHull: makeHull
                    };
                    clusters[settings.clusterId] = cluster;
        
                    var placeholderNode = {
                        id: "cluster-" + cluster.id,
                        title: cluster.id + " [cluster]",
                        value: { size: 1, color: 1 },
                        ratio: { size: 0, color: 0 },
                        radius: graph.settings.maxRadius,
                        isClusterPlaceholder: true,
                        clusterId: settings.clusterId,
                        cluster: cluster
                    };
                    
                    cluster.placeholderNode = placeholderNode;
                    visNodes.push(placeholderNode);
                }
                else {
                    clusters[settings.clusterId].nodes.push(node);
                }
            }
            else {
                visNodes.push(node);
            }
            
            return node;
        };
        //[cf]
        //[of]:        this.removeNode = function (id, tag, fade, forceRemove) {
        this.removeNode = function (id, tag, fade, forceRemove) {
            return _nodelib.removeNode(id, tag, fade, forceRemove);
        };
        //[cf]
        //[of]:        this.removeNodeByIndex = function (index) {
        this.removeNodeByIndex = function (index) {
            return _nodelib.removeNodeByIndex(index);
        }
        //[cf]
        
        //[of]:        this.addLink = function (options) {
        this.addLink = function (options) {
            var link = _linklib.addLink(options);
            
            if(!(link.source.clusterId || link.target.clusterId))
                visLinks.push(link);
            
            return link;
        };
        //[cf]
        //[of]:        this.removeLink = function (from, to) {
        this.removeLink = function (from, to) {
            return _linklib.removeLink(from, to);
        };
        //[cf]


        this.onNodeMouseover = function (d) { 
            if(d.isClusterPlaceholder) {
                console.log("Console placeholder hovered!");
                return;
            }

            return _nodelib.onNodeMouseover(d); 
        }
        
        this.onNodeMouseout = function (d) { 
            if(d.isClusterPlaceholder) {
                console.log("Console placeholder unhovered!");
                return;
            }

            return _nodelib.onNodeMouseout(d); 
        }
        
        this.onNodeMousedown = function (d) { 
            return _nodelib.onNodeMousedown(d); 
        }
        
        this.onNodeMouseup = function (d) { 
            return _nodelib.onNodeMouseup(d); 
        }
        
        this.onNodeClick = function (d) { 
            if(d.isClusterPlaceholder) {
                // Expand the cluster
                
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


        //[of]:        Compatibility stuff
        //[c]Compatibility stuff
        
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
        this.getLinkColor = function (d) { return _linklib.getLinkColor(d); }
        
        this.calculatePath = function (d, b) { return _linklib.calculatePath(d, b); }
        
        this.updateLinkColors = function () { _linklib.updateLinkColors(); }
        
        
        
        this.getNodeColor = function (d) { return _nodelib.getNodeColor(d); }
        this.getNodeBorderColor = function (d) { return _nodelib.getNodeBorderColor(d); }
        this.getNodeRadius = function (d) { return _nodelib.getNodeRadius(d); }
        
        this.getNodeTooltip = function (d) { return _nodelib.getNodeTooltip(d); }
        
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
        
        this.moveNodes = function (positions, time, ignoreLinks) {
            return _nodelib.moveNodes(positions, time, ignoreLinks);
        };
        
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
        
        
        //[cf]

    }
}
