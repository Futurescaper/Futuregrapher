if(Meteor.isClient)
d3styles = function(graph) {
    if(!graph)
        return;

    this.settings = {
        tooltipDelay : graph.options.tooltipDelay || 100,
        nodeTooltipClass : graph.options.nodeTooltipClass || 'tipsy-node',
        linkTooltipClass : graph.options.linkTooltipClass || 'tipsy-link',
        nodeBorderSize : graph.options.nodeBorderSize || 0,
        nodeBorderDarkening: graph.options.nodeBorderDarkening ||.8
    };

    this.colors = {
        background : '',  // transparent
        linkMin : graph.options.linkMin || '#FFC880',
        linkMax : graph.options.linkMax || '#943020',
        nodeMin : graph.options.nodeMin || '#FFC880',
        nodeMax : graph.options.nodeMax || '#943020',
        nodeSelected: graph.options.nodeSelected || '#FF0000',
        label : graph.options.labelColor || '#888888',
        nodeHighlight: graph.options.nodeHighlight || '#FF0000',
        nodeHighlightSource : graph.options.nodeHighlightSource || '#FF0000',
        nodeHighlightTarget : graph.options.nodeHighlightTarget || '#1A00FF',
        labelHighlight : '#0080C0',
        colorFilterNotFound: '#CCCCCC'
    };
}