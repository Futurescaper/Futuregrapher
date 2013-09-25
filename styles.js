if(Meteor.isClient)
d3styles = function(graph) {
    if(!graph)
        return;

    var self = this;

    this.settings = {
        tooltipDelay : graph.options.tooltipDelay || 100,
        nodeTooltipClass : graph.options.nodeTooltipClass || 'tipsy-node',
        linkTooltipClass : graph.options.linkTooltipClass || 'tipsy-link',
        nodeBorderSize : graph.options.nodeBorderSize || 0,
        nodeBorderDarkening: graph.options.nodeBorderDarkening
    };

    this.colors = {
        background : '',  // transparent
        linkMin : graph.options.linkMin || '#80C8FF',
        linkMax : graph.options.linkMax || '#203094',
        nodeMin : graph.options.nodeMin || '#FFC880',
        nodeMax : graph.options.nodeMax || '#943020',
        nodeSelected: graph.options.nodeSelected || '#FF0000',
        label : graph.options.labelColor || '#888888',
        nodeBorderColor : graph.options.nodeBorderColor || '#FFFFFF',
        nodeHighlight: graph.options.nodeHighlight || '#FF0000',
        nodeHighlightSource : graph.options.nodeHighlightSource || '#FF0000',
        nodeHighlightTarget : graph.options.nodeHighlightTarget || '#1A00FF',
        labelHighlight : '#0080C0',
        colorFilterNotFound: '#CCCCCC'
    };

    this.getLinkMarker = function(link) {
        return "url(#" + ((graph.d3highlights().count() == 0 || graph.d3highlights().isLinkHighlighted(link)) ? 'arrow' : '') + ")";
    };

    this.getNodeBorderColor = function(node, darkening) {
        if (!self.settings.nodeBorderSize)
            return '';

        var color = (node.color && node.color.indexOf('#') == 0) ? d3colors.getRgbaFromHex(node.color) : d3colors.getColorFromRgbText(node.color);
        if (!color)
            return '';

        // return the current node color, but darker
        var r = color[0] * (darkening||self.settings.nodeBorderDarkening||.8);
        var g = color[1] * (darkening||self.settings.nodeBorderDarkening||.8);
        var b = color[2] * (darkening||self.settings.nodeBorderDarkening||.8);

        return d3colors.getHexFromRgb(r, g, b);
    };

/*
    this.getNodeCustomFilterColor = function(node, field, vals) {
        // find out where this node's value is in the array
        var val = helpers.getCustomDataValue(node.data[0], field.id);
        if(!val)
            return self.colors.colorFilterNotFound;

        var index = -1;
        for(var i = 0; i < vals.length; i++) {
            if(vals[i].name == val) {
                index = i;
                break;
            }
        }

        return this.getNodeCustomFilterColorByIndex(index, vals.length);
    };
*/
    this.getNodeCustomFilterColorByIndex = function(index, length) {
        if(index < 0)
            return self.colors.colorFilterNotFound;

        var i = index * 255 / length;
        var r = Math.round(Math.sin(0.024 * i) * 127 + 128);
        var g = Math.round(Math.sin(0.024 * i + 2) * 127 + 128);
        var b = Math.round(Math.sin(0.024 * i + 4) * 127 + 128);

        // and return a color matching that ratio along the full spectrum
        return d3colors.getHexFromRgb(r, g, b);
    };
}