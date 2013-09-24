if(Meteor.isClient)
d3tags = function (d3graph) {
    var self = this;

    /// Public Method: removeTag(tag)
    ///
    /// <summary>
    /// Removes the specified tag completely from all of the nodes and links.  Reduces the
    /// weight of each node and link that contains the tag based on the weight of that tag for
    /// the node or link.
    /// </summary>
    /// <param name="tag">The name of the tag to be removed.</param>
    this.removeTag = function (tag) {
        var nodes = d3graph.nodes;
        var links = d3graph.links;

        $.each(nodes, function (i, node) {
            if (node)
                if ($.inArray(tag, self.getTagNames(node)) >= 0)
                    self.removeNodeTag(node, tag);
        });

        // remove tags from links also
        $.each(links, function (i, link) {
            if (link)
                if ($.inArray(tag, self.getTagNames(link)) >= 0)
                    self.removeLinkTag(link, tag);
        });

        d3graph.update();
    };

    /// Private Method: removeNodeTag(node, tag)
    ///
    /// <summary>
    /// Removes the specified tag from a particular node.  The weight of the node is
    /// reduced by the weight of the tag.  If the node weight drops below zero, the
    /// node itself is also removed.
    /// </summary>
    /// <param name="node">The node from which the tag is to be removed.</param>
    /// <param name="tag">The name of the tag to be removed.</param>
    this.removeNodeTag = function (node, tag) {
        self._removeTag(node, tag);

        // and see if we need to delete it completely
        if (node.value <= 0) {
            // find the index
            for (var i = 0; i < d3graph.nodes.length; i++)
                if (d3graph.nodes[i] == node)
                    return d3graph.nodelib().removeNodeByIndex(i);
        }
    };

    /// Private Method: removeLinkTag(link, tag)
    ///
    /// <summary>
    /// Removes the specified tag from a particular link.  The weight of the link is
    /// reduced by the weight of the tag.  If the link weight drops below zero, the
    /// link itself is also removed.
    /// </summary>
    /// <param name="link">The link from which the tag is to be removed.</param>
    /// <param name="tag">The name of the tag to be removed.</param>
    this.removeLinkTag = function (link, tag) {
        self._removeTag(link, tag);

        if (link.value <= 0)
            d3graph.links.remove(link);
    };

    /// Private Method: getTagNames(node)
    ///
    /// <summary>
    /// Retrieves an array of tag names from the specified node.
    /// </summary>
    /// <param name="node">The node to pull the tag names from.</param>
    /// <returns>An array of the tag names for this node.</returns>
    this.getTagNames = function (nodeOrLink) {
        return $.map(nodeOrLink.tags, function (t) { return t.tag; });
    };

    this._removeTag = function (nodeOrLink, tag) {
        var weight = 1;

        // remove the tag, but collect the weight
        var index = $.inArray(tag, self.getTagNames(nodeOrLink));
        if (index >= 0) {
            var tag = nodeOrLink.tags[index];
            weight = tag.weight || 0;
            nodeOrLink.tags.splice(index, 1);
        }

        // drop the weight on the node/link
        nodeOrLink.value -= weight;
    };
}