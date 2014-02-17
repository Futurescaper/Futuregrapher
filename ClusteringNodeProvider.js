if(Meteor.isClient)

    ClusteringNodeProvider = function (graph) {

        var _nodelib = new d3nodes(graph);
        var _linklib = new d3links(graph);
        
        this.d3nodes = function () { return _nodelib; };
        this.d3links = function () { return _linklib; };
        
        this.getVisNodes = function () {
            return _nodelib.getNodes();
        }
        
        this.getVizLinks = function () {
        }
        
        this.getVizClusters = function () {
        }

        
        //[of]:        function convexHulls(nodes, index, offset) {
        function convexHulls(nodes, index, offset) {
            var hulls = {};
            
            // create point sets
            for (var k=0; k<nodes.length; ++k) {
                var n = nodes[k];
                if (n.size) continue;
        
                var i = index(n),
                l = hulls[i] || (hulls[i] = []);
                l.push([n.x-offset, n.y-offset]);
                l.push([n.x-offset, n.y+offset]);
                l.push([n.x+offset, n.y-offset]);
                l.push([n.x+offset, n.y+offset]);
            }
            
            // create convex hulls
            var hullset = [];
            for (i in hulls) {
                hullset.push({group: i, path: d3.geom.hull(hulls[i])});
            }
            
            return hullset;
        }
        //[cf]

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
        
        
        this.onNodeMouseover = function (d) { return _nodelib.onNodeMouseover(d); }
        this.onNodeMouseout = function (d) { return _nodelib.onNodeMouseout(d); }
        this.onNodeMousedown = function (d) { return _nodelib.onNodeMousedown(d); }
        this.onNodeMouseup = function (d) { return _nodelib.onNodeMouseup(d); }
        this.onNodeClick = function (d) { return _nodelib.onNodeClick(d); }
        this.onNodeDblClick = function (d) { return _nodelib.onNodeDblClick(d); }
        this.onNodeRightClick = function (d) { return _nodelib.onNodeRightClick(d); }
        
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
        
        this.addNode = function (settings) {
            return _nodelib.addNode(settings);
        };
        
        this.removeNode = function (id, tag, fade, forceRemove) {
            return _nodelib.removeNode(id, tag, fade, forceRemove);
        };
        
        this.removeNodeByIndex = function (index) {
            return _nodelib.removeNodeByIndex(index);
        }
        
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
        
        this.addLink = function (options) {
            return _linklib.addLink(options);
        };
        
        this.removeLink = function (from, to) {
            return _linklib.removeLink(from, to);
        };
        
        this.getSharedLinks = function (nodes) {
            return _linklib.getSharedLinks(nodes);
        };
        
        /* End link methods */
        
        
        this.getCenter = function () {
            return _nodelib.getCenter();
        };
        
        this.clear = function () {
            _nodelib.clear();
            //_linklib.clear();
        }
        
        
        //[cf]

    }
