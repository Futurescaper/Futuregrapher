if(Meteor.isClient)
    d3selector = function (graph) {
        var nodes = [];
        var links = [];

        this.toggleNode = function(node) {
            this.setNode(node, !this.isNodeSelected(node.id));
            return node.selected;
        };

        this.toggleLink = function(link) {
            this.setLink(link, !this.isLinkSelected(link.id));
            return link.selected;
        };

        this.setNode = function(node, on) {
            if(on) {
                node.originalColor = graph._nodes.select('g.node[id="' + node.id + '"] circle').style('fill');
                graph._nodes.select('g.node[id="' + node.id + '"] circle')
                    .transition()
                    .duration(50)
                    .style('fill', graph.d3styles().colors.nodeSelected || '#ff0000')
                    .style('stroke', '#800000');
                nodes.push(node);
            }
            else {
                graph._nodes.select('g.node[id="' + node.id + '"] circle')
                    .transition()
                    .duration(50)
                    .style('fill', node.originalColor)
                    .style('stroke', function(d) { return graph.d3nodes().getNodeBorderColor(d); });

                for(var i = 0; i < nodes.length; i++)
                    if(nodes[i].id == node.id) {
                        nodes.splice(i, 1);
                        break;
                    }
            }
        };

        this.setLink = function(link, on) {
            if(on) {
                graph.visLinks.select('g.links path[source="' + link.source.id + '"][target="' + link.target.id + '"]')
                    .transition()
                    .duration(50)
                    .style("stroke-width", function (d) { return 4 * graph.d3links().getLinkWidth(d) / graph.scale; });
                links.push(link);
            }
            else {
                graph.visLinks.select('g.links path[source="' + link.source.id + '"][target="' + link.target.id + '"]')
                    .transition()
                    .duration(50)
                    .style('stroke-width', function (d) { return graph.d3links().getLinkWidth(d) / graph.scale; });

                for(var i = 0; i < links.length; i++)
                    if(links[i].id == link.id) {
                        links.splice(i, 1);
                        break;
                    }
            }
        };

        this.getNode = function(index) {
            return nodes[index];
        };

        this.getLink = function(index) {
            return links[index];
        };

        this.isNodeSelected = function(id) {
            return $.grep(nodes, function(t) { return t.id == id; }).length > 0;
        };

        this.isLinkSelected = function(id) {
            return $.grep(links, function(t) { return t.id == id; }).length > 0;
        };

        this.getNodeCount = function() {
            return nodes.length;
        };

        this.getLinkCount = function() {
            return links.length;
        };

        this.clear = function() {
            this.clearNodes();
            this.clearLinks();
        };

        this.clearNodes = function() {
            for(var i = 0; i < nodes.length; i++) {
                var n = nodes[i];
                graph._nodes.select('g.node[id="' + n.id + '"] circle')
                    //.transition()
                    //.duration(50)
                    .style('fill', function(d) { return d.originalColor; })
                    .style('stroke', function(d) { return graph.d3nodes().getNodeBorderColor(d); });
            }

            nodes = [];
        };

        this.clearLinks = function() {
            for(var i = 0; i < links.length; i++) {
                var link = links[i];
                graph.visLinks.select('g.links path[source="' + link.source.id + '"][target="' + link.target.id + '"]')
                    //.transition()
                    //.duration(50)
                    .style('stroke-width', function(d) { return 1; });
            }

            links = [];
        };

        this.refresh = function() {
            for(var i = 0; i < nodes.length; i++) {
                var n = nodes[i];
                graph._nodes.select('g.node[id="' + n.id + '"] circle')
                    //.transition()
                    //.duration(50)
                    .style('fill', graph.d3styles().colors.nodeSelected || '#ff0000')
                    .style('stroke', '#800000');
            }
        };
    }