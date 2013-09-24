if(Meteor.isClient)
d3nodes = new function (d3graph) {
    this.getNodeColor = function (node, minColor, maxColor) {
        if(node.selected && !window.inCauseEffectView)
            return d3colors.rgba(d3colors.getRgbaFromHex('ff0000'));

        if(node._color)
            return d3colors.rgba(colors.getRgbaFromHex(node._color));

        var color = d3colors.colorBlend(d3colors.getRgbaFromHex(minColor || d3graph.stylelib().colors.nodeMin), d3colors.getRgbaFromHex(maxColor || d3graph.stylelib().colors.nodeMax), node.ratio);
        var fill = d3colors.rgba(color);
        if (node.color != fill)
            node.color = fill;

        return fill;
    };

    this.getNodeRadius = function (node) {
        var r = node._radius || node.radius;
        if(isNaN(r))
            return d3graph.settings.minRadius;

        return parseInt(r);
    };

    this.getNodeBorderWidth = function (node) {
        return d3graph.stylelib().settings.nodeBorderSize;
    };

    this.getNode = function (name) {
        if (!d3graph.nodeDictionary)
            return;
        return d3graph.nodeDictionary.get(name);
    };

    this.addNode = function (nodeDefinition) {
        if (!nodeDefinition)
            return null;

        var id = nodeDefinition.id;
        var title = nodeDefinition.title;
        var weight = nodeDefinition.weight || 1;
        var data = nodeDefinition.data;
        var update = nodeDefinition.update == false ? false : true;
        var quality = nodeDefinition.quality;

        var node = this.getNode(id);
        if (node) {
            node.value += (weight || 1);
            node.count++;
            if (data)
                node.data.push(data);

            if (typeof this.nodeChanged === 'function')
                this.nodeChanged(node);

            // re-calculate
            if (update)
                d3graph.update();

            return node;
        }

        node = {
            id: id,
            title: title,
            x: nodeDefinition.x,
            y: nodeDefinition.y,
            index: d3graph.nodes.length,
            _color: nodeDefinition.color,
            _labelOpacity: nodeDefinition.labelOpacity,
            _fontSize: nodeDefinition.fontSize,
            to: [],
            from: [],
            tags: [],
            data: [],
            quality: quality,
            value: weight || 1,
            filterValues: {},
            clusterTitles: {},
            rank: d3graph.nodes.length,
            normalized: 0,
            ratio: 0,
            radius: nodeDefinition.radius || (d3graph.settings.minRadius + d3graph.settings.maxRadius / 2),
            centrality: nodeDefinition.centrality,
            showFullLabel: nodeDefinition.showFullLabel,
            dom: {},
            count: 1,
            frequency: 1,
            visible: true,
            visibility: {},
            getValue: function (id) {
                return id ? this.filterValues[id] : this.value;
            },
            getData: function(i) {
                return this.data[i||0];
            },
            hasLinkFrom: function(n, steps) {
                if(steps == 1) {
                    for(var i = 0; i < this.from.length; i++)
                        if(this.from[i].source.id == n.id)
                            return true;
                    return false;
                }
                else {
                    for(var i = 0; i < this.from.length; i++)
                        if(this.from[i].source.hasLinkFrom(n, steps - 1))
                            return true;
                    return false;
                }
            },
            hasLinkTo: function(n, steps) {
                if(steps == 1) {
                    for(var i = 0; i < this.to.length; i++)
                        if(this.to[i].target.id == n.id)
                            return true;
                    return false;
                }
                else {
                    for(var i = 0; i < this.to.length; i++)
                        if(this.to[i].target.hasLinkTo(n, steps - 1))
                            return true;
                    return false;
                }
            }
        };

        if (data)
            node.data.push(data);

        node.tooltip = this.getNodeTooltip(node);

        d3graph.nodes.push(node);
        d3graph.nodeDictionary.set(id, node);

        if (typeof this.nodeAdded === 'function')
            this.nodeAdded(node);

        if (update)
            d3graph.update();

        return node;
    };

    this.calculateNodes = function (filterKey) {
        if (d3graph.nodes.length <= 0)
            return;

        var sorted = d3graph.nodes.slice(0),
            min,
            max,
            ratio,
            i;

        sorted.sort(function (a, b) {
            return b.getValue(filterKey) - a.getValue(filterKey);
        });

        max = sorted[0].getValue(filterKey);
        min = sorted[sorted.length - 1].getValue(filterKey);

        for (i = 0; i < sorted.length; i++) {
            var val = sorted[i].value = sorted[i].getValue(filterKey);
            ratio = max < 0 ? 0 : (max == min) ? 0 : (val - min) / (max - min);

            if (isNaN(ratio))
                ratio = 0.5;
            if (ratio < d3graph.settings.minRatio)
                ratio = d3graph.settings.minRatio;

            sorted[i].rank = i;
            sorted[i].ratio = ratio;
            sorted[i].radius = sorted[i]._radius = d3graph.settings.minRadius + ((d3graph.settings.maxRadius - d3graph.settings.minRadius) * ratio);

            if (sorted[i].radius < d3graph.settings.minRadius)
                sorted[i].radius = d3graph.settings.minRadius;
            if (sorted[i].radius > d3graph.settings.maxRadius)
                sorted[i].radius = d3graph.settings.maxRadius;

            sorted[i].tooltip = this.getNodeTooltip(sorted[i]);
        }
    };

    /// Public Method: removeNode(name)
    ///
    /// <summary>
    /// Decreases the node's weight by one, and if the weight <= 0, removes the node from the graph.
    /// If a tag is specified, it also removes one instance of the tag.
    /// </summary>
    /// <param name="name">The node name</param>
    /// <param name="tag">The tag to be removed from this node.</param>
    /// <returns>If successful, undefined, otherwise an error message.
    this.removeNode = function (id, tag, fade, forceRemove) {
        var t = tag;
        node = d3graph.nodeDictionary.get(id);
        if (node) {
            var nodes = d3graph.nodes;
            var self = this;
            var found = false;
            $.each(nodes, function (i, n) {
                // try to find the node
                if (n && (n.id === node.id)) {
                    found = true;
                    // drop the node weight by 1
                    n.value -= 1;
                    if (n.value <= 0 || forceRemove) {
                        self.removeNodeByIndex(i, fade);
                        return;
                    }

                    // if we're removing a tag as well, find the tag
                    if (t) {
                        var index = $.inArray(t, d3graph.taglib().getTagNames(n));
                        if (index >= 0) {
                            var _tag = n.tags[index];

                            // and drop the tag weight
                            _tag.weight -= 1;

                            // if the tag weight is zeroed, delete it
                            if (_tag.weight <= 0)
                                n.tags.splice(index, 1);
                        }
                    }
                }
            });
            if (!found)
                return "That node could not be found in graph.nodes.";
        }
        else
            return "That node could not be found in the dictionary.";
    };

    this.removeTemporaryNodes = function (node) {
        var toRemove = [];
        var positions = [];

        $.each(d3graph.nodes, function (i, n) {
            // remove any temporary nodes
            if (n.temporary) {
                if (node)
                    positions.push({ id: n.id, x: node.x, y: node.y, opacity: 0 });
                toRemove.push(n.id);
            }
        });

        if (node) {
            this.moveNodes(positions, 100);
        }

        $.each(toRemove, function (i, id) {
            _DEBUG("Removing temporary node: " + id + " = " + d3graph.removeNode(id));
        });

        //d3graph.update();
    };

    this._clusterPercent = 100;

    this.viewClusters = function (pct) {
        _DEBUG("d3graph.viewClusters(" + pct + ")");

        if (pct >= 100 && pct != this._clusterPercent) {
            d3graph.clear();
            d3graph.nodes.push.apply(d3graph.nodes, this._nodes);
            d3graph.links.push.apply(d3graph.links, this._links);
            d3graph._labels.push.apply(d3graph._labels, this._labels);
            d3graph.nodeDictionary = this._dictionary;

            this._nodes = this._links = this._dictionary = undefined;
            d3graph.settings.friction = this._friction;
            d3graph.settings.linkStrength = this._linkStrength;

            d3graph.calculate();
            d3graph.update();

            d3graph.labellib().updateLabelSizesForZoom(d3graph.scale);
            return;
        }

        if(pct >= 100)
            return;

        if (!this._nodes) {
            this._nodes = d3graph.nodes.slice(0);
            this._links = d3graph.links.slice(0);
            this._labels = d3graph._labels.slice(0);
            this._dictionary = d3graph.nodeDictionary;
        }

        this._clusterPercent = pct;
        this._friction = d3graph.settings.friction;
        this._linkStrength = d3graph.settings.linkStrength;

        // sort nodes by decreasing centrality
        var sorted = this._nodes.slice(0);
        sorted.sort(function (a, b) { return b.getValue() - a.getValue() });

        // assign the top x as hub nodes
        var x = Math.floor(sorted.length * pct / 100);

        // clear hub values first
        for (var i = 0; i < sorted.length; i++) {
            sorted[i].hub = false;
            sorted[i].hubId = -1;
        }

        for (var i = 0; i < sorted.length; i++) {
            if (i < x) {
                sorted[i].hub = true;
                sorted[i].hubId = sorted[i].id;
                sorted[i].hubIndex = i;
                sorted[i].cluster_links = [];
            }
            else {
                // calculate the shortest distance from all this node to the nearest hub node
                var costs = this.calculateShortestPaths(sorted, sorted[i].index).costs;
                var hubId = -1;
                var hubIndex = -1;
                var minCost = Infinity;
                for (var j = 0; j < x; j++) {
                    var index = sorted[j].index;  // the index for each hub
                    var cost = costs[index];
                    if (cost < minCost) {
                        hubId = sorted[j].id;
                        hubIndex = j;
                        minCost = cost;
                    }
                }

                sorted[i].hub = false;
                sorted[i].hubId = hubId;
                sorted[i].hubIndex = hubIndex;
            }
        }

        d3graph.clear();

        // add cluster nodes - for now each node's centrality is just the sum of its original sub-nodes centralities
        for (var i = 0; i < sorted.length; i++) {
            if (sorted[i].hub) {
                _DEBUG("Adding hub node (" + sorted[i].id + "): " + sorted[i].title);
                var node = this.addNode({ id: sorted[i].id, title: sorted[i].title, /*data: (sorted[i].data && sorted[i].data.length > 0) ? sorted[i].data[0] : null,*/ update: false });
                node.centrality += sorted[i].centrality;
                node.value = sorted[i].value;

                for (var j = 0; j < sorted[i].to.length; j++) {
                    if (sorted[i].to[j].target.hubId != sorted[i].id) {
                        _DEBUG("  Adding hub link: " + sorted[i].title + " -> " + sorted[i].to[j].target.title);
                        sorted[i].cluster_links.push(sorted[i].to[j]);
                    }
                }
            }
            else if (sorted[i].hubId != -1) {
                _DEBUG("Adding to hub node (" + sorted[i].hubId + "): " + sorted[i].title);
                var node = this.addNode({ id: sorted[i].hubId, title: sorted[i].title, /*data: (sorted[i].data && sorted[i].data.length > 0) ? sorted[i].data[0] : null,*/ update: false });
                node.centrality += sorted[i].centrality;
                node.value += sorted[i].value;

                for (var j = 0; j < sorted[i].to.length; j++) {
                    if (sorted[i].to[j].target.hubId != sorted[i].hubId && sorted[sorted[i].hubIndex]) {
                        _DEBUG("  Adding hub link: " + sorted[i].title + " -> " + sorted[i].to[j].target.title + " (" + sorted[sorted[i].hubIndex].title + ")");
                        sorted[sorted[i].hubIndex].cluster_links.push(sorted[i].to[j]);
                    }
                }
            }
            else _DEBUG("Not assigned to hub: " + sorted[i].title);
        }

        // assign the links
        for (var i = 0; i < x; i++) {
            var links = sorted[i].cluster_links;
            for (var j = 0; j < links.length; j++) {
                if (sorted[i].id != links[j].target.hubId && sorted[links[j].target.hubIndex]) {
                    var result = d3graph.addLink({ from: sorted[i].id, to: links[j].target.hubId, update: false });
                    _DEBUG("Adding link: " + sorted[i].title + " -> " + sorted[links[j].target.hubIndex].title + ": " + result.id);
                }
            }
        }

        d3graph.settings.friction = .3;
        d3graph.settings.linkStrength = .01;

        d3graph.calculate();

        // double each node radius
        $.each(d3graph.nodes, function(i, node) { node.radius *= ((-1.0 * pct / 50.0) + 3.0); });

        d3graph.update();

        d3graph.visLabels
            .selectAll('g.label text')
            .text(function(d) { return d.title; })
            .style('opacity', 1.0);

        d3graph.labellib().updateLabelSizesForZoom(d3graph.scale);
    };

    this.colorClusters = function(numClusters) {
        var self = this;

        // first, calculate the distance for each node to all other nodes
        $.each(d3graph.nodes, function(i, node) {
            node.distances = self.calculateNodeDistances(i);
        });

        var cluster = [];
        var num_clusters = d3graph.nodes.length;

        // initially each node belongs to its own cluster
        for(var i = 0; i < num_clusters; i++)
            cluster[i] = i;

        while(num_clusters > numClusters) {
            var nodes = this.colorClusters_findShortestLink(cluster);
            var toReplace = cluster[nodes.from.index];
            for(var i = 0; i < d3graph.nodes.length; i++)
                if(cluster[i] == toReplace)
                    cluster[i] = cluster[nodes.to.index];

            num_clusters--;
        }

        // color each node
        var colors = ['#ff0000', '#00ff00', '#0000ff', '#888800', '#000080', '#444444', '#aaaaaa', '#123456', '#002000', '#200000', '#000020'];
        var cluster_colors = [];
        var currentColor = 0;
        $.each(d3graph.nodes, function(i, node) {
            var color;
            if(cluster_colors[cluster[i]])
                color = cluster_colors[cluster[i]];
            else
                cluster_colors[cluster[i]] = color = colors[currentColor++];

            d3graph.visNodes.select('g.node[id="' + node.id + '"] circle')
                .style('fill', color);

            d3graph.visLabels
                .selectAll('g.label[id="' + node.id + '"] text')
                .text(cluster[i]);
        });
    };

    this.colorClusters_findShortestLink = function(cluster) {
        var shortestVal = 1000000;
        var from = null, to = null;

        $.each(d3graph.nodes, function(i, node) {
            for(var j = i + 1; j < node.distances.length; j++)
                if(cluster[i] != cluster[j] && node.distances[j] < shortestVal) {
                    shortestVal = node.distances[j];
                    from = node;
                    to = d3graph.nodes[j];
                }
        });

        return { from: from, to: to };
    };

    this.calculateNodeDistances = function(i) {
        var x = d3graph.nodes[i].x;
        var y = d3graph.nodes[i].y;
        var distances = [];

        $.each(d3graph.nodes, function(j, node) {
            if(i == j)
                distances[j] = 0;
            else
                distances[j] = Math.sqrt(((node.x - x) * (node.x - x)) + ((node.y - y) * (node.y - y)) );
        });

        return distances;
    };

    this.colorClusters2 = function(numClusters, callback) {
        var nodes = $.map(d3graph.nodes, function (n) { return n.id; });
        var links = $.map(d3graph.links, function (link) {
            // get link value
            var x1 = link.source.x;
            var x2 = link.target.x;
            var y1 = link.source.y;
            var y2 = link.target.y;

            var val = 1.0 / Math.sqrt(((x1 - x2) * (x1 - x2)) + ((y1 - y2) * (y1 - y2)));
            return link.source.id + "|" + link.target.id + "|" + val;
        });

        $.ajax({
            url: 'http://futurescapergraph.kevinmarzec.com/Service/Python/NetworkX_ClusterAnalysis.py',
            type: 'POST',
            contentType: "application/json; charset=utf-8",
            data: JSON.stringify({ nodes: nodes, links: links, count: numClusters }),
            success: function (data) {
                var colors = ['#ff0000', '#00ff00', '#0000ff', '#888800', '#000080', '#444444', '#aaaaaa', '#123456', '#002000', '#200000', '#000020'];

                for (var i = 0; i < data.length; i++) {
                        var id = parseInt(data[i][1]);
                        var cluster = parseInt(data[i][0]);
                        var color = colors[cluster % colors.length];
                        d3graph.visNodes.select('g.node[id="' + id + '"] circle')
                            .style('fill', color);
                }

                if (callback)
                    callback(JSON.stringify(data));
            },
            error: function (jqXHR, textStatus, errorThrown) {
                Ext.Msg.alert("Error Performing Betweenness Cluster Analysis on Server", textStatus + ": " + errorThrown);
                if(callback)
                    callback(textStatus + ": " + errorThrown, true);
            }
        });

    };

    this.colorClusters3 = function(numClusters, callback) {
        var sorted = d3graph.nodes.slice(0);
        sorted.sort(function (a, b) { return b.getValue() - a.getValue() });

        // assign the top x as hub nodes
        //var x = Math.floor(sorted.length * pct / 100);

        // clear hub values first
        for (var i = 0; i < sorted.length; i++) {
            sorted[i].hub = false;
            sorted[i].hubId = -1;
        }

        var colorIndex = 0;
        for (var i = 0; i < sorted.length; i++) {
            if (i < numClusters) {
                sorted[i].hub = true;
                sorted[i].hubId = sorted[i].id;
                sorted[i].hubIndex = i;
                sorted[i].cluster_links = [];
                sorted[i].colorIndex = colorIndex++;
            }
            else {
                // calculate the shortest distance from all this node to the nearest hub node
                var costs = this.calculateShortestPaths(sorted, sorted[i].index, true).costs;
                var hubId = -1;
                var hubIndex = -1;
                var minCost = Infinity;
                var c = -1;
                for (var j = 0; j < numClusters; j++) {
                    var index = sorted[j].index;  // the index for each hub
                    var cost = costs[index];
                    if (cost < minCost) {
                        hubId = sorted[j].id;
                        hubIndex = j;
                        minCost = cost;
                        c = sorted[j].colorIndex;
                    }
                }

                sorted[i].hub = false;
                sorted[i].hubId = hubId;
                sorted[i].hubIndex = hubIndex;
                sorted[i].colorIndex = c;
            }
        }

        // color them
        var colors = ['#ff0000', '#00ff00', '#0000ff', '#888800', '#000080', '#444444', '#aaaaaa', '#123456', '#002000', '#200000', '#000020'];

        for (var i = 0; i < sorted.length; i++)
            d3graph.visNodes.select('g.node[id="' + sorted[i].id + '"] circle')
                .style('fill', colors[sorted[i].colorIndex % colors.length]);
    };

    this.getShortestPath = function(nodes, from, to) {
        var path = this.calculateShortestPaths(nodes, from.index);
        var i = to.index;
        var p = path.parents[i];

        var links = [];

        _DEBUG("Node: " + to.title);
        while(p >= 0) {
            _DEBUG("Node: " + nodes[p].title);

            // add the link from nodes[p] to nodes[i]
            var l = this.getLinkToIndex(nodes[p], i);
            if(l)
                links.push(l);

            i = p;
            p = path.parents[nodes[p].index];

            if(p == from.index)
                break;
        }

        _DEBUG("Node: " + from.title);

        // add the link from 'from' to nodes[i]
        var l = this.getLinkToIndex(from, i);
        if(l)
            links.push(l);

        return links;
    };

    this.getLinkToIndex = function(node, index) {
        for(var i = 0; i < node.to.length; i++)
            if(node.to[i].target.index == index)
                return node.to[i];
        for(var i = 0; i < node.from.length; i++)
            if(node.from[i].source.index == index)
                return node.from[i];
    };

    this.calculateShortestPaths = function (nodes, index, directional) {
        // Taken from: http://vasir.net/blog/game_development/dijkstras_algorithm_shortest_path/

        // Step 0
        var costs = [];
        var temporary = [];
        var parents = [];

        $.each(nodes, function (i, node) {
            costs[i] = i == index ? 0 : Infinity;
            temporary[i] = true;
            parents[i] = -1;
        });

        var finished = false;
        do {
            finished = this.calculateShortestPaths_iterate(nodes, costs, temporary, parents, directional);
        }
        while (!finished);

        return { costs: costs, parents: parents };
    };

    this.calculateShortestPaths_iterate = function (nodes, costs, temporary, parents, directional) {
        // Find the node x with the smallest cost
        var x = this.getTemporaryMinimumIndex(costs, temporary);
        if (x < 0)
            return true;

        temporary[x] = false;

        // step 2 - find all connected nodes that are temporary
        var node = nodes[x];
        for (var i = 0; i < node.to.length; i++) {
            var y = node.to[i].target.index;
            if (!temporary[y])
                continue;

            if (costs[x] + 1 /* all weights are 1 */ < costs[y]) {
                costs[y] = costs[x] + 1;
                parents[y] = x;
            }
        }

        if(!directional) {
            for (var i = 0; i < node.from.length; i++) {
                var y = node.from[i].source.index;
                if (!temporary[y])
                    continue;

                if (costs[x] + 1 /* all weights are 1 */ < costs[y]) {
                    costs[y] = costs[x] + 1;
                    parents[y] = x;
                }
            }
        }

        return false;
    };

    this.getTemporaryMinimumIndex = function (costs, temporary) {
        var min = Infinity;
        var index = -1;
        for (var i = 0; i < costs.length; i++) {
            if (costs[i] < min && temporary[i]) {
                min = costs[i];
                index = i;
            }
        }

        return index;
    };

    /// Private Method: _removeNodeByIndex(index)
    ///
    /// <summary>
    /// Deletes a specified node and all associated links.
    /// </summary>
    /// <param name="index">The 0-based index of the node to be deleted.</param>
    this.removeNodeByIndex = function (index, fade) {
        // remove the node
        var nodes = d3graph.nodes.splice(index, 1);
        if (nodes.length) {
            var node = nodes[0];
            for (var i = d3graph.links.length; i >= 0; i--) {
                if (d3graph.links[i] && (d3graph.links[i].source == node || d3graph.links[i].target == node)) {
                    // remove the from/to for any nodes that reference this link
                    $.each(d3graph.nodes, function (j, n) {
                        for (var k = n.from.length; k >= 0; k--)
                            if (n.from[k] && (n.from[k].source.id == node.id || n.from[k].target.id == node.id))
                                n.from.splice(k, 1);
                        for (var k = n.to.length; k >= 0; k--)
                            if (n.to[k] && (n.to[k].source.id == node.id || n.to[k].target.id == node.id))
                                n.to.splice(k, 1);
                    });

                    // and remove the link itself
                    d3graph.links.splice(i, 1);
                }
            }

            /* FIX: When trying to use transitions here (even with duration=0), it breaks */

            // remove the label
            if (fade)
                d3graph.visLabels.select('g.label[id="' + node.id + '"]')
                    .transition()
                    .duration(250)
                    .style('opacity', 0)
                    .each('end', function () { d3graph.visLabels.select('g.label[id="' + node.id + '"]').remove(); });
            else
                d3graph.visLabels.select('g.label[id="' + node.id + '"]').remove();

            // remove the node
            if (fade)
                d3graph.visNodes.select('g.node[id="' + node.id + '"] circle')
                    .transition()
                    .duration(250)
                    .style('opacity', 0)
                    .each('end', function () { d3graph.visNodes.select('g.node[id="' + node.id + '"]').remove(); });
            else
                d3graph.visNodes.select('g.node[id="' + node.id + '"]').remove();

            // remove any links to/from it
            if (fade)
                d3graph.visLinks.selectAll('path.link[source="' + node.id + '"], path.link[target="' + node.id + '"]')
                    .transition()
                    .duration(250)
                    .style('opacity', 0)
                    .each('end', function () { d3graph.visLinks.selectAll('path.link[source="' + node.id + '"], path.link[target="' + node.id + '"]').remove(); });
            else
                d3graph.visLinks.selectAll('path.link[source="' + node.id + '"], path.link[target="' + node.id + '"]').remove();

            // remove from our internal dictionary
            d3graph.nodeDictionary.remove(node.id);

            if (d3graph.events.onNodeRemoved && typeof (d3graph.events.onNodeRemoved) === 'function')
                d3graph.events.onNodeRemoved(node);
        }
    };

    this.setNodeTitle = function (node, title, showFull) {
        if (node) {
            var self = this;
            node.title = title;
            node.showFullLabel = showFull;
            if (d3graph.settings.embedLabels)
                d3graph.visLabels
                    .selectAll('g.label[id="' + node.id + '"] text')
                    .each(d3graph.labellib().getEmbeddedLabelFontSize)
                    .each(d3graph.labellib().wordWrapLabel);
            else
                d3graph.visLabels
                    .selectAll('g.label[id="' + node.id + '"] text')
                    .text(title)
                    .style('font-size', function (d) { return d.fontSize + 'em'; /*return d3graph.labellib().getLabelSize(d);*/ });
        }
    };

    this.setNodeTitleHtml = function(node, html, ratio) {
        var r = ratio;
        if(!r)
            r = .75;

        d3graph.visLabels.selectAll('g.label[id="' + node.id + '"] text').remove();
        $('g.node[id="' + node.id + '"] body').parent().remove();

        var fo = d3graph.vis.selectAll('g.node[id="' + node.id + '"]')
            .append('svg:foreignObject')
            .attr('x', function(d) { return -1.0 * r * (d._radius || d.radius); })
            .attr('y', function(d) { return -1.0 * r * (d._radius || d.radius); })
            .attr('width', function(d) { return (d._radius || d.radius) * 2.0 * r; })
            .attr('height', function(d) { return (d._radius || d.radius) * 2.0 * r; });
        fo
            .append('xhtml:body')
            .style('text-align', 'center')
            .style('background', 'transparent')
            .style('cursor', 'pointer')
            .html(html);
    };

    this.updateNodeSizesForZoom = function(scale) {
        var s = scale;
        if(s < 1)
            s = 1;
        if(s > 8)
            s = 8;
        else if(!s)
            s = 1;

        d3graph.visNodes.selectAll('g.node circle')
            .attr('r', function(d) { d._radius = d.radius / s; return d._radius; })
            .style('stroke', function(d) { return d3graph.stylelib().getNodeBorderColor(d); })
            .style('stroke-width', (parseInt(d3graph.stylelib().settings.nodeBorderSize) / s)||1);
    };

    this.animateNodeClick = function(node, callback, settings) {
        var r = d3graph.visNodes.selectAll('g.node[id="' + node.id + '"] circle').attr('r');
        var c = d3graph.visNodes.selectAll('g.node[id="' + node.id + '"] circle').style('fill');
        _DEBUG("r=" + r + " c=" + c);
        d3graph.visNodes.selectAll('g.node[id="' + node.id + '"] circle')
            .transition()
            .delay(function (d, i) { return i * 2; })
            .duration(75)
            .style('fill', '#FFFF00')
            .attr('r', r * 1.25);
        setTimeout(function() {
            d3graph.visNodes.selectAll('g.node[id="' + node.id + '"] circle')
                .transition()
                .delay(function (d, i) { return i * 2; })
                .duration(75)
                .style('fill', c)
                .attr('r', r);
        }, 80);

        setTimeout(function() { if(callback) callback(); }, 220);
    };

    this.moveNodes = function (positions, time, ignoreLinks) {
        d3graph.force.stop();
        d3graph.fixedMode = true;

        var center = d3graph.getCenter();
        var node = null;
        $.each(positions, function (i, position) {
            $.each(d3graph.nodes, function (j, n) {
                if (position.id == n.id) {
                    node = n;
                    n.fixed = true;
                    if (position.radius)
                        n._radius = position.radius;
                    if (position.opacity >= 0.0)
                        n.opacity = position.opacity;
                    if (position.color)
                        n.color = n._color = position.color;
                    if (position.labelColor)
                        n.labelColor = position.labelColor;
                    if (position.labelSize)
                        n.fontSize = position.labelSize;
                    if (position.labelOpacity)
                        n.labelOpacity = position.labelOpacity;

                    var r = n._radius || n.radius;
                    if (position.x)
                        n.x = position.x; // Math.max(n.radius, Math.min(position.x, d3graph.width - r));
                    if (position.y)
                        n.y = position.y; // Math.max(n.radius, Math.min(position.y, d3graph.height - r));

                    return false;
                }
            });

            if (node) {
                d3graph.visNodes.selectAll('g.node[id="' + position.id + '"]')
                    .each(function (d) { d.fixed = true; })
                    .transition()
                    .delay(function (d, i) { return i * 2; })
                    .duration(time || 500)
                    .attr('cx', function(d) { return d.x; }).attr('cy', function(d) { return d.y; })
                    .attr('transform', function (d) { return 'translate(' + d.x + ',' + d.y + ')'; });

                var x = d3graph.visNodes.selectAll('g.node[id="' + position.id + '"] circle')
                    .transition()
                    .delay(function (d, i) { return i * 2; })
                    .duration(time || 500);

                if(position.radius)
                    x = x.attr('r', node._radius || node.radius);
                if(position.opacity >= 0.0)
                    x = x.style('opacity', position.opacity || 1.0);
                if(position.color)
                    x.style('fill', position.color);
                if(position.stroke)
                    x.style('stroke', position.stroke);
                else if(position.color) {
                    node.color = position.color;
                    x.style('stroke', d3graph.stylelib().getNodeBorderColor(node));
                }
                var opacity = (node.labelOpacity || node.opacity || 1.0);
                d3graph.visLabels.selectAll('g.label[id="' + position.id + '"]')
                    //.transition()
                    //.duration(time || 500)
                    .style('opacity', opacity);

                d3graph.visLabels.selectAll('g.label[id="' + position.id + '"] text')
                    //.transition()
                    //.duration(time || 500)
                    .style('opacity', opacity)
                    .text(function(d) { return opacity > 0 ? d.title : ''; })
                    //.style('font-size', function(d) { return jQuery.isNumeric(d.fontSize) ? d.fontSize + 'em' : d.fontSize })
                    .attr('text-anchor', function(d) { return position.anchor||(d.x < center.x ? 'end' : 'start') })
                    .attr('fill', function(d) { return position.labelColor||d3graph.stylelib().getNodeBorderColor(d); } /*LABEL FIX:node.labelColor*/);
            }
        });

        if (ignoreLinks)
            d3graph._links
                .transition()
                //.delay(function (d, i) { return i * 2; })
                .duration(time || 500)
                .style('opacity', 1.0)
                .attrTween('d', d3graph.linklib().calculatePathTween); //function (d) { return d3graph.linklib().calculatePath(d); });
        else
            d3graph._links
                .transition()
                .duration(time || 500)
                .style('opacity', function (d) {
                    // figure out what the opacity is for this link
                    var id = d.source.id;
                    var opacity = 0.0;
                    $.each(positions, function (i, p) {
                        if (p.id == id) {
                            if (p.links) {
                                $.each(p.links, function (j, link) {
                                    if (link.id == d.target.id) {
                                        if (link.opacity)
                                            opacity = link.opacity;
                                        return false;
                                    }
                                });
                            }
                        }
                    });
                    d._opacity = opacity;
                    return opacity;
                })
                .attr('stroke', function (d) {
                    // figure out what the color is for this link
                    var id = d.source.id;
                    var color = d.color;
                    $.each(positions, function (i, p) {
                        if (p.id == id) {
                            if (p.links) {
                                $.each(p.links, function (j, link) {
                                    if (link.id == d.target.id) {
                                        if (link.color)
                                            color = link.color;
                                        return false;
                                    }
                                });
                            }
                        }
                    });
                    return color;
                })
                .attr('stroke-width', function (d) {
                    // figure out what the color is for this link
                    var id = d.source.id;
                    var width = 2;
                    $.each(positions, function (i, p) {
                        if (p.id == id) {
                            if (p.links) {
                                $.each(p.links, function (j, link) {
                                    if (link.id == d.target.id) {
                                        if (link.width) {
                                            width = link.width;
                                        }
                                        return false;
                                    }
                                });
                            }
                        }
                    });
                    return parseInt(width||1);
                })
                .attrTween('d', d3graph.linklib().calculatePathTween);

        // Update labels
        d3graph.visLabels
            .selectAll('g.label')
            .transition()
            .delay(function (d, i) { return i * 2; })
            .duration(time || 500)
            .attr('transform', function (node) { return d3graph.labellib().transformLabel(node, center); });
    };

    this.getNodeTooltip = function (node) {
        if (d3graph.events.onNodeTooltip && typeof (d3graph.events.onNodeTooltip === "function"))
            return d3graph.events.onNodeTooltip(node, d3.event);
    };

    this.onNodeClick = function (node) {
        if (d3graph.events.onNodeClick && typeof (d3graph.events.onNodeClick === "function")) {
            d3graph.events.onNodeClick(node, d3.event);
            d3.event.preventDefault();
        }
    };

    this.onNodeDblClick = function (node) {
        if (d3graph.events.onNodeDblClick && typeof (d3graph.events.onNodeDblClick === "function")) {
            d3graph.events.onNodeDblClick(node, d3.event||window.event);
            if(d3.event)
                d3.event.preventDefault();
            if(window.event) {
                window.event.preventDefault();
                window.event.stopPropagation();
            }

            return true;
        }
    };

    this.onNodeMouseover = function (node) {
        d3graph.currentNode = node;
        if (d3graph.events.onNodeMouseover && typeof (d3graph.events.onNodeMouseover === "function"))
            d3graph.events.onNodeMouseover(node, d3.event);
    };

    this.onNodeMouseout = function (node) {
        d3graph.currentNode = null;
        if (d3graph.events.onNodeMouseout && typeof (d3graph.events.onNodeMouseout === "function"))
            d3graph.events.onNodeMouseout(node, d3.event);
    };

    this.onNodeRightClick = function(node) {
        if(d3graph.events.onNodeRightClick && typeof (d3graph.events.onNodeRightClick === "function")) {
            d3graph.events.onNodeRightClick(node, d3.event||window.event);
            if(d3.event)
                d3.event.preventDefault();
            if(window.event)
                window.event.preventDefault();

            return false;
        }
    };
}