d3selector = new function (graph) {
    this.selection = [];

    this.toggleNode = function(node) {
        _DEBUG("selector.selected node: " + node.title);
        if(this.isSelected(node.id)) {
            graph._nodes.select('g.node[id="' + node.id + '"] circle')
                .transition()
                .duration(50)
                .style('fill', node.originalColor);
            for(var i = 0; i < this.selection.length; i++)
                if(this.selection[i].id == node.id) {
                    this.selection.splice(i, 1);
                    break;
                }
        }
        else {
            node.originalColor = graph._nodes.select('g.node[id="' + node.id + '"] circle').style('fill');
            graph._nodes.select('g.node[id="' + node.id + '"] circle')
                .transition()
                .duration(50)
                .style('fill', graph.stylelib().colors.nodeSelected || '#ff0000');
            this.selection.push(node);
        }

        return node.selected;
    };

    this.isSelected = function(id) {
        return $.grep(this.selection, function(t) { return t.id == id; }).length > 0;
    };

    this.getCount = function() {
        return this.selection.length;
    };

    this.clear = function() {
        for(var i = 0; i < this.selection.length; i++) {
            var n = this.selection[i];
            graph._nodes.select('g.node[id="' + n.id + '"] circle')
                .transition()
                .duration(50)
                .style('fill', function(d) { return d.originalColor; });
        }

        this.selection = [];
    };

    this.refresh = function() {
        for(var i = 0; i < this.selection.length; i++) {
            var n = this.selection[i];
            graph._nodes.select('g.node[id="' + n.id + '"] circle')
                .transition()
                .duration(50)
                .style('fill', graph.stylelib().colors.nodeSelected || '#ff0000');
        }
    };
}