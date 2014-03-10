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

    this.showUi = function (element, x, y) {
        var menu = graph.visUi.append("svg:g")
            .attr("class", "menu")
            .attr("transform", "translate(" + (x + 3) + ".5, " + (y - 33) + ".5)");
        
        function addButton(buttonX, buttonY, iconCode, clickFunction) {
            var button = menu.append("svg:g")
                .attr("transform" ,"translate(" + buttonX + ", " + buttonY + ")");
            
            button.append("svg:rect")
                .attr("width", 30)
                .attr("height", 30)
                .attr("fill", "#f8f8f8")
                .attr("stroke", "#e7e7e7")
                .attr("stroke-width", 1)
            
            var icon = button.append("svg:text")
                .attr("x", 3)
                .attr("y", 24)
                .attr('font-family', 'FontAwesome')
                .attr('font-size', 27)
                .style("fill", "#777")
                .text(iconCode)
                .on("mouseover", function (d) { icon.transition(250).style("fill", "#333"); })
                .on("mouseout", function (d) { icon.transition(250).style("fill", "#777"); })
                .on("click", clickFunction);
        }
        
        function editElement(el) { console.log("Edit " + el.title); };
        function deleteElement(el) { console.log("Delete " + el.title); };
        
        addButton(0, 0, "\uf040", editElement.bind(null, element));
        addButton(34, 0, "\uf00d", deleteElement.bind(null, element));
    };
        
    this.hideUi = function () {
        graph.visUi.selectAll("g.menu").remove();
    };

    this.setNode = function(node, on) {
        if(on) {
            node.originalColor = graph._nodes.select('g.node[id="' + node.id + '"] circle').style('fill');
            graph._nodes.select('g.node[id="' + node.id + '"] circle')
                //.transition()
                //.duration(50)
                .style('fill', graph.d3styles().colors.nodeSelected || '#ff0000')
                .style('stroke', '#800000');
            nodes.push(node);
            
            var mouse = d3.mouse(graph.vis[0][0]);
            this.showUi(node, mouse[0], mouse[1]);
        }
        else {
            graph._nodes.select('g.node[id="' + node.id + '"] circle')
                //.transition()
                //.duration(50)
                .style('fill', node.originalColor)
                .style('stroke', function(d) { return graph.getNodeBorderColor(d); });

            for(var i = 0; i < nodes.length; i++)
                if(nodes[i].id == node.id) {
                    nodes.splice(i, 1);
                    break;
                }
        }
    };

    this.setLink = function(link, on, color) {
        if(on) {
            link._strokeWidth = graph.visLinks.select('g.links path[source="' + link.source.id + '"][target="' + link.target.id + '"]').style('stroke-width');

            var l = graph.visLinks.select('g.links path[source="' + link.source.id + '"][target="' + link.target.id + '"]')
                //.transition()
                //.duration(50)
                .style("stroke-width", function (d) { return 4 * graph.getLinkWidth(d) / graph.scale; })
                .attr('marker-end', function(link) { return link.directional ? 'url(#' + graph.getMarkerUrl(link) + ')' : ''; });

            if(color) {
                l.style('stroke', color)
                    .attr('marker-end', function(link) { return link.directional ? 'url(#tracker)' : ''; });
            }
            links.push(link);

            var mouse = d3.mouse(graph.vis[0][0]);
            this.showUi(link, mouse[0], mouse[1]);
        }
        else {
            graph.visLinks.select('g.links path[source="' + link.source.id + '"][target="' + link.target.id + '"]')
                //.transition()
                //.duration(50)
                .style('stroke-width', function (d) { return link._strokeWidth || graph.getLinkWidth(d) / graph.scale; })
                .style('stroke', function(l) { return graph.getLinkColor(l, graph.d3styles().colors.linkMin, graph.d3styles().colors.linkMax); })
                .attr('marker-end', 'url(#' + graph.settings.markerId + '_default)');

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
        
        this.hideUi();
    };

    this.clearNodes = function() {
        for(var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            graph._nodes.select('g.node[id="' + n.id + '"] circle')
                //.transition()
                //.duration(50)
                .style('fill', function(d) { return d.originalColor; })
                .style('stroke', function(d) { return graph.getNodeBorderColor(d); });
        }

        nodes = [];
    };

    this.clearLinks = function() {
        for(var i = 0; i < links.length; i++) {
            var link = links[i];
            var l = graph.visLinks.select('g.links path[source="' + link.source.id + '"][target="' + link.target.id + '"]')
                //.transition()
                //.duration(50)
                .style('stroke-width', function(d) { return link._strokeWidth || graph.d3links().getLinkWidth(d) / graph.scale; })
                .style('stroke', function(l) { return graph.getLinkColor(l); })
                .attr('marker-end', function(link) { return link.directional ? 'url(#' + graph.getMarkerUrl(link) + ')' : ''; });
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
                .style('stroke', function(d) { return graph.getNodeBorderColor(d); });
        }
    };
}
