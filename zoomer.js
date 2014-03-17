d3zoomer = function (graph, widgetId) {
    var self = this;
    var zoom = this.zoom = { min:.25, max: 20, default:.8 };

    this.graph = graph;

    this.behavior = d3.behavior.zoom()
        .translate(graph.trans)
        .scale(graph.scale)
        .scaleExtent([zoom.min, zoom.max]);

    var doZoom = true;
    var widget = null;

    this.transform = function(scale, translate) {
        if(this.graph.noZoom)
            return;

        this.graph.trans = translate;

        // FIX: after using the zoom widget, this value is not holding the current scale value!!!
        this.graph.scale = scale;
        //Helper.debug("Mouse zoom: " + this.graph.trans + ": Scale=" + this.graph.scale);
        this.graph.vis.attr('transform', 'translate(' + this.graph.trans + ') scale(' + this.graph.scale + ')');

        // update labels
        this.graph.d3labels().updateLabelSizesForZoom(this.graph.scale);
        this.graph.updateSizesForZoom(this.graph.scale);

        if(widget) {
            doZoom = false;
            widget.setValue(0, Math.sqrt(this.graph.scale - zoom.min) / Math.sqrt(zoom.max - zoom.min));
        }
        this.behavior.scale(scale).translate(translate);
    }

    var rescale = function () { this.transform(d3.event.scale, d3.event.translate); };
    this.behavior.on('zoom', rescale.bind(self));

    this.graph.vis = d3.select(graph.el[0]).append("svg:svg")
        .attr("width", graph.width)
        .attr("height", graph.height)
        .attr("class", graph.options.class)

        // -- Zooming / panning code
        .attr('pointer-events', 'all')
        .append('svg:g')
        .call(this.behavior)
        .on('dblclick.zoom', null)
        .append('svg:g');

    this.graph.vis
        .append('rect')
        .attr('width', 10000)
        .attr('height', 10000)
        .attr('fill', 'transparent');

    this.graph.vis.attr('transform', 'translate(' + this.graph.trans + ') scale(' + this.graph.scale + ')');

    if(widgetId)
        this.createWidget(widgetId);

    //[of]:    this.createWidget = $.proxy(function(id) {
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
                graph.updateSizesForZoom(y);
            }, this)
        });
    //[cf]

        $('#' + id).mouseenter(function() {
            Helper.debug("Entered zoom widget");
            doZoom = true;
        });
    }, this);
}
