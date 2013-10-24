if(Meteor.isClient)
    d3zoomer = function () {
        var doZoom = true;
        var widget = null;

        var zoom = this.zoom = { min:.25, max: 20, default:.8 };

        this.initialize = $.proxy(function (graph, widgetId) {
            this.graph = graph;

            d3.behavior.zoom()
                .translate(graph.trans)
                .scale(graph.scale)
                .scaleExtent([zoom.min, zoom.max]);

            function rescale() {
                if(graph.noZoom)
                    return;

                graph.trans = d3.event.translate;

                // FIX: after using the zoom widget, this value is not holding the current scale value!!!
                graph.scale = d3.event.scale;
                //Helper.debug("Mouse zoom: " + this.graph.trans + ": Scale=" + this.graph.scale);
                graph.vis.attr('transform', 'translate(' + graph.trans + ') scale(' + graph.scale + ')');

                // update labels
                graph.d3labels().updateLabelSizesForZoom(graph.scale);
                graph.d3nodes().updateNodeSizesForZoom(graph.scale);
                graph.d3links().updateLinkSizesForZoom(graph.scale);

                if(widget) {
                    doZoom = false;
                    widget.setValue(0, Math.sqrt(graph.scale - zoom.min) / Math.sqrt(zoom.max - zoom.min));
                }
            }

            this.graph.vis = d3.select('#' + graph.el.attr('id')).append("svg:svg")
                .attr("width", graph.width)
                .attr("height", graph.height)
                .attr("class", graph.options.class)

                // -- Zooming / panning code
                .attr('pointer-events', 'all')
                .append('svg:g')
                .call(d3.behavior.zoom().on('zoom', rescale))
                .append('svg:g');

            this.graph.vis
                .append('rect')
                .attr('width', 10000)
                .attr('height', 10000)
                .attr('fill', 'transparent');

            this.graph.vis.attr('transform', 'translate(' + this.graph.trans + ') scale(' + this.graph.scale + ')');

            if(widgetId)
                this.createWidget(widgetId);
        }, this);

        this.createWidget = $.proxy(function(id) {
            widget = new Dragdealer(id, {
                horizontal: false,
                vertical: true,
                //steps: 100,
                //snap: false,
                //slide: false,
                y: Math.sqrt((zoom.default - zoom.min) / (zoom.max - zoom.min)),
                animationCallback: $.proxy(function(x, y) {
                    if(!doZoom)
                        return;

                    y = Math.pow(Math.sqrt(zoom.max - zoom.min) * y, 2) + zoom.min;
                    if(y < zoom.min)
                        y = zoom.min;

                    var trans = [(this.graph.width / 2) - (this.graph.width * y / 2), (this.graph.height / 2) - (this.graph.height * y / 2)];

                    Helper.debug("Widget zoom: " + trans + ": Scale=" + y);

                    var graph = this.graph;
                    var w = graph.el.width();
                    var h = graph.el.height();

                    graph.scale = y;
                    graph.trans = [(w / 2) - (w * graph.scale / 2), (h / 2) - (h * graph.scale / 2)];

                    /* FIX: this doesn't seem to actually update the "internal" scale value */
                    graph.vis.attr('transform', 'translate(' + graph.trans + ') scale(' + graph.scale + ')');
                    graph.zoom.translate(graph.trans).scale(graph.scale);

                    graph.d3labels().updateLabelSizesForZoom(y);
                    graph.d3nodes().updateNodeSizesForZoom(y);
                    graph.d3links().updateLinkSizesForZoom(y);
                }, this)
            });

            $('#' + id).mouseenter(function() {
                Helper.debug("Entered zoom widget");
                doZoom = true;
            });
        }, this);
    }