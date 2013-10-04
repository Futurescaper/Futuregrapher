if(Meteor.isClient)
    d3zoomer = function () {
        this.widget = null;

        this.initialize = function (graph, widgetId) {
            this.graph = graph;

            this.zoom = { min:.25, max: 20 };

            d3.behavior.zoom()
                .translate(graph.trans)
                .scale(graph.scale)
                .scaleExtent([this.zoom.min, this.zoom.max]);

            function rescale() {
                if(graph.noZoom)
                    return;

                this.graph.trans = d3.event.translate;

                // FIX: after using the zoom widget, this value is not holding the current scale value!!!
                this.graph.scale = d3.event.scale;
                //Helper.debug("Mouse zoom: " + this.graph.trans + ": Scale=" + this.graph.scale);
                this.graph.vis.attr('transform', 'translate(' + this.graph.trans + ') scale(' + this.graph.scale + ')');

                // update labels
                this.graph.d3labels().updateLabelSizesForZoom(this.graph.scale);
                this.graph.d3nodes().updateNodeSizesForZoom(this.graph.scale);
                this.graph.d3links().updateLinkSizesForZoom(this.graph.scale);

                if(this.widget) {
                    this.doZoom = false;
                    this.widget.setValue(0, Math.sqrt(this.graph.scale - this.zoom.min) / Math.sqrt(this.zoom.max - this.zoom.min));
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
        };

        this.createWidget = function(id) {
            var dragdealer = new Dragdealer(id, {
                horizontal: false,
                vertical: true,
                //steps: 100,
                //snap: false,
                //slide: false,
                y: Math.sqrt((this.zoom.default - this.zoom.min) / (this.zoom.max - this.zoom.min)),
                animationCallback: $.proxy(function(x, y) {
                    if(!this.doZoom)
                        return;

                    y = Math.pow(Math.sqrt(this.zoom.max - this.zoom.min) * y, 2) + this.zoom.min;
                    if(y < settings.zoom.min)
                        y = settings.zoom.min;

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

            this.widget = dragdealer;

            var self = this;
            $('#' + id).mouseenter(function() { Helper.debug("Entered zoom widget"); self.doZoom = true; });
        };
    }