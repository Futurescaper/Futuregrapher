if(Meteor.isClient)
d3highlights = function (graph) {
    this.fadeOut = function (opacity, time) {

        // cancel all pending transitions
        graph.vis
            .selectAll("*")
            .transition()
            .duration(0);

        graph.d3().selectAll('g.node circle')
            .transition()
            .duration(time || 0)
            .style('opacity', opacity||0);

        graph.d3().selectAll('g.links path')
            .transition()
            .duration(time || 0)
            .style('opacity', opacity||0);

        graph.d3().selectAll('g.labels text')
            .transition()
            .duration(time || 0)
            .style('opacity', opacity||0);
    };

    this.fadeIn = function (time) {
        // cancel all pending transitions
        /*graph.vis
            .selectAll("*")
            .transition()
            .duration(0);
        */

        graph.d3().selectAll('g.node circle')
            //.transition()
            //.duration(time || 0)
            .style('fill', function(d) { return d.color; })
            .style('opacity', function(d) { return d.visible ? 1 : 0 });

        graph.d3().selectAll('g.links path')
            //.transition()
            //.duration(time || 0)
            .style('opacity', function(d) { return d.source.visible && d.target.visible ? 1 : 0 });

        graph.d3().selectAll('g.label text')
            .text(function(d) { return d.hideLabel || !d.visible ? '' : d.title; });
    };

    this.displayNodes = function(options, time) {
        if(!options || !options.nodes)
            return this.fadeIn(time||10);

        // make sure everything is visible before we start
        this.fadeIn();

        // get the full list of nodes that we'll be including
        var nodes = options.nodes.length ? options.nodes : [options.nodes];
        var sourceNodes = nodes.slice(0);

        if(options.links == 'all' || options.links == 'node') {
            $.each(nodes, function(i, node) {
                $.each(node.from, function(j, from) {
                    nodes.push(from.source);
                });
                $.each(node.to, function(j, to) {
                    nodes.push(to.target);
                });
            });
        }

        // fade out all other nodes and labels
        $.each(graph.nodes, function(i, node) {
            if($.grep(nodes, function(n) { return /*n.visible &&*/ n.id == node.id; }).length > 0) {
                // show the label
                graph.d3()
                    .selectAll('g.label[id="' + node.id + '"] text')
                    .text(function(d) { return (d.hideLabel && !options.showLabels) ? '' : d.title; });
                return;
            }

            graph.d3()
                .selectAll('g.node[id="' + node.id + '"] circle')
                //.transition()
                //.duration(options.time||0)
                .style('opacity', options.opacity||0);

            graph.d3()
                .selectAll('g.label[id="' + node.id + '"] text')
                .text(function(d) { return ''; });
        });

        var isArray = this.isArray;
        if(options.links) {
            // and any connections that are not hooked up to a source and target node that are both visible
            $.each(graph.links, function(i, link) {
                if((options.links == 'all' && (!$.grep(nodes, function(n) { return n.id == link.source.id; }).length || !$.grep(nodes, function(n) { return n.id == link.target.id; }).length)) ||
                   (options.links == 'node' && !$.grep(sourceNodes, function(n) { return n.id == link.source.id || n.id == link.target.id; }).length) ||
                   (options.links == 'connected' && (!$.grep(sourceNodes, function(n) { return n.id == link.source.id; }).length || !$.grep(sourceNodes, function(n) { return n.id == link.target.id; }).length)) ||
                    (isArray(options.links) && $.inArray(link, options.links) < 0)) {
                        graph.d3()
                            .selectAll('g.links path[source="' + link.source.id + '"][target="' + link.target.id + '"]')
                            //.transition()
                            //.duration(options.time||0)
                            .style('opacity', options.opacity||0);
                }
            });
        }
        else
            graph.d3().selectAll('g.links path')
                //.transition()
                //.duration(options.time||0)
                .style('opacity', options.opacity||0);

        if(options.highlight && options.highlight.node)
            graph.d3().selectAll('g.node[id="' + options.highlight.node.id + '"] circle').style('fill', options.highlight.color);
    };

    this.isArray = function(obj) {
        return Object.prototype.toString.call(obj) === "[object Array]";
    };

    Array.prototype.move = function (old_index, new_index) {
        if (new_index >= this.length) {
            var k = new_index - this.length;
            while ((k--) + 1) {
                this.push(undefined);
            }
        }
        this.splice(new_index, 0, this.splice(old_index, 1)[0]);
        return this; // for testing purposes
    };

    this.animate = function(node, settings) {
        var time = settings.time || 150;
        var ani = graph.d3().selectAll('g.node[id="' + node.id + '"] circle')
            .transition()
            .duration(time);

        if(settings.radius)
            ani.attr('r', settings.radius || node.radius);

        if(settings.color)
            ani.attr('fill', settings.color);

        if(settings.x)
            ani.attr('transform', 'translate(' + settings.x + ',' + settings.y + ')');

        $('svg g.node[id="' + node.id + '"] body')
            .parent()
            //.transition()
            //.duration(settings.time || 150)
            .attr('x', (-.75 * (settings.radius || node.radius)) + 'px')
            .attr('y', (-.75 * (settings.radius || node.radius)) + 'px')
            .attr('width', ((settings.radius || node.radius) * 1.5) + 'px')
            .attr('height', ((settings.radius || node.radius) * 1.5) + 'px');

        if(settings.moveToTop) {
            // move the selected node to the bottom of the dom list of nodes
            var el = $('svg g.node[id="' + node.id + '"]');
            var index = el.index();
            var dom = el[0];
            el[0].parentNode.appendChild(el[0]);

            // and move the data node also to the end
            graph.nodes.move(index, el[0].parentNode.childNodes.length - 1);
        }
    };

    this.animateLine = function(x1, y1, x2, y2, color, time, thickness) {
        var line = graph.vis
            .append('svg:line')
            .attr('x1', x1)
            .attr('y1', y1)
            .attr('x2', x1)
            .attr('y2', y1)
            .attr('class', 'temporary')
            .style('stroke', color)
            .style('stroke-width', (thickness||1) + 'px');

        if(time > 0)
            line
                .transition()
                .duration(time)
                .attr('x2', x2)
                .attr('y2', y2);
        else
            line.attr('x2', x2).attr('y2', y2);

        return line;
    };

    this.setNodeRadius = function (node, radius, time) {
        node._radius = radius;
        graph.d3().selectAll('g.node[id="' + node.id + '"] circle')
            .transition()
            .duration(time || 150)
            .attr('r', node._radius || node.radius);
    };
}