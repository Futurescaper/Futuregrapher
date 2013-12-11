if(Meteor.isClient)
d3labels = function (graph) {
    var self = this;

    this.onLabelClick = function (node) {
        //_DEBUG("Label click: " + node.title);
        if (graph.events.onLabelClick && typeof (graph.events.onLabelClick === "function"))
            graph.events.onLabelClick(node);
    };

    this.onLabelMouseover = function (node) {
        //_DEBUG("Label Mouseover: " + node.title);
        if (graph.events.onLabelMouseover && typeof (graph.events.onLabelMouseover === "function"))
            graph.events.onLabelMouseover(node);
    };

    this.onLabelMouseout = function (node) {
        //_DEBUG("Label Mouseout: " + node.title);
        if (graph.events.onLabelMouseout && typeof (graph.events.onLabelMouseout === "function"))
            graph.events.onLabelMouseout(node);
    };

    this.updateLabelSizesForZoom = function(scale) {
        if(!graph.d3zoomer())
            return;

        var self = this;
        var center = graph.getCenter();

        graph._labels
            .style('text-shadow', scale > 2.5 ? '' : '-1px -1px 2px #FFF, 1px -1px 2px #FFF, -1px 1px 2px #FFF, 1px 1px 2px #FFF')
            .attr('transform', function(d) { return self.transformLabel(d, center, scale); });

        graph.d3().selectAll('g.label text').style('font-size', function(d) {
            var size = graph.settings.minFontSize;
            if(scale <= 1.0)
                size = ((graph.settings.maxFontSize - graph.settings.minFontSize) / (2 * (1.0 - graph.d3zoomer().zoom.min))) * (scale - graph.d3zoomer().zoom.min) + graph.settings.minFontSize;
            else
                size = ((graph.settings.maxFontSize - graph.settings.minFontSize) / (2 * (graph.d3zoomer().zoom.max - 1.0))) * (scale - graph.d3zoomer().zoom.max) + graph.settings.maxFontSize;

            // increase or decrease size based on its ratio
            var min = .8;
            var max = 1.9;
            var mult = d.ratio <= .5 ? (d.ratio * (1 - min)) * 2 + min : d.ratio * (2 * max - 2) + (2 - max);
            size *= mult;

            return (size / scale) + 'px';
        });
    };

    this.showTop = function(top, property) {
        var nodes = graph.nodes.slice(0).sort(function(a, b) { return b[property||'_value'] - a[property||'_value']; });
        if(top && nodes.length > top) {
            var cutoff = nodes[top][property||'_value'];
            var count = 0;
            graph.d3().selectAll('g.label text').text(function(d) {
                console.log("Node: " + d.title + ": " + d._value);
                if(d[property||'_value'] >= cutoff && count <= top) {
                    count++;
                    d.hideLabel = false;
                    return d.title;
                }
                d.hideLabel = true;
                return '';
            });
        }
        else
            graph.d3().selectAll('g.label text').text(function(d) { d.hideLabel = false; return d.title });
    };

    this.transformLabel = function (d, center, scale) {
        var r = d._radius || d.radius;

        if (graph.settings.embedLabels)
            return 'translate(' + d.x + ',' + (d.y - r * .75) + ')';

        var x = //d.x < center.x ? d.x - r - (5/(scale||1)) : d.x + r + (5/(scale||1));
                ((d.x < center.x && !graph.settings.reverseLabelPosition) || (d.x >= center.x && graph.settings.reverseLabelPosition)) ? d.x - r - (5/(scale||1)) : d.x + r + (5/(scale||1));
        var y = d.y;
        return 'translate(' + x + ',' + y + ')';
    };

    this.getLabelSize = function (node) {
        return (node.fontSize = node._fontSize || Math.floor(Math.min(node.radius, graph.settings.minFontSize))) + 'px';
    };

    this.getLabelColor = function (node) {
        node.labelColor = graph.d3styles().colors.label;
        return node.labelColor;
    };

    this.getLabelOpacity = function(node) {
        return (node._opacity = (node._labelOpacity || (graph.settings.hideLabels ? 0.0 : 1.0)));
    };

    this.getEmbeddedLabelFontSize = function (d) {
        //_DEBUG("getEmbeddedLabelFontSize(): " + d.title);
        var r = d._radius || d.radius;
        d.fontSize = Math.floor(Math.max(2 * Math.sqrt(r), 8));
        //_DEBUG("  Setting font size1=" + d.fontSize);
        var words = d.title ? d.title.split(' ') : ('').split(' ');
        var word = words[0];

        d3.select(this).style("font-size", d.fontSize + "em").text(word);
        if (this.firstChild)
            this.firstChild.data = word;

        var size = d.fontSize;

        var words = d.title ? d.title.split(' ') : ('').split(' ');
        var word = words[0];
        var width = this.clientWidth;
        var height = this.clientHeight;
        var length = 0;
        d3.select(this).style("font-size", parseInt(size) + "px").text(word);
        if (this.firstChild)
            this.firstChild.data = word;

        var boxWidth = r * 2 * .7;
        var boxHeight = r * 2 * .7;
        while (((boxWidth < this.clientWidth) || (boxHeight < this.clientHeight)) && (size > 8)) {
            size--;
            d3.select(this).style("font-size", parseInt(size) + "px");
            //_DEBUG("  Setting font size2=" + size);
            this.firstChild.data = word;
        }
        d.fontSize = size;
    };

    this.wordWrapLabel = function (d, i) {

        var words = d.title ? d.title.split(' ') : ('').split(' ');
        var line = new Array();
        var text = "";
        var r = d._radius || d.radius;

        var width = 2 * r * .8;
        var height = 2 * r * .8;
        var word;
        var first = true;
        do {
            word = words.shift();
            line.push(word);
            if (words.length && this.firstChild)
                this.firstChild.data = line.join(' ') + " " + words[0];
            else if (this.firstChild)
                this.firstChild.data = line.join(' ');
            if (first || !(this.clientWidth < width && words.length)) {
                first = false;
                text = line.join(' ');
                if (this.firstChild)
                    this.firstChild.data = text;

                /*if (this.clientWidth > width) {
                text = d3.select(this).select(function () { return this.lastChild; }).text();
                if (words.length)
                text = text + "...";
                d3.select(this).select(function () { return this.lastChild; }).text(text);
                d3.select(this).classed("wordwrapped", true);
                break;
                }
                */
                if (text != '') {
                    d3.select(this).append("svg:tspan")
                                    .attr("x", 0)
                                    .attr("dx", "0.15em")
                                    .attr("dy", "1.0em")
                                    .text(text);
                }

                if (this.clientHeight > height && !d.showFullLabel && words.length) {
                    text = d3.select(this).select(function () { return this.lastChild; }).text();
                    text = text + "...";
                    d3.select(this).select(function () { return this.lastChild; }).text(text);
                    d3.select(this).classed("wordwrapped", true);

                    break;
                }

                line = new Array();
            }
        } while (words.length);
        if (this.firstChild)
            this.firstChild.data = '';
    };
}