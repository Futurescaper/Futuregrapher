if(Meteor.isClient) {

    d3treelayout = (function() {
        return {
            create: function (el, treeData, domain, options) {
                var defaultOptions = {
                    hideRootNode: true,
                    nodeClass: "node",
                    nodeClassSelected: "node-selected",
                    nodeClassUnselected: "node-unselected",
                    linkClass: "link",
                    linkClassSelected: "link-selected",
                    linkClassUnselected: "link-unselected",
                    nodeColorUnexpanded: "lightsteelblue",
                    nodeColorExpanded: "#fff",
                    hideAxis: false,
                    margins: [120, 220, 120, 220]
                };
                options = $.extend({}, defaultOptions, options);
                var result = new d3treelayout(el, options);
                result.create(treeData, domain);
                return result;
            },
            load: function (el, savedState) {
                var result = new d3treelayout(el, savedState.options);
                result.load(savedState);
                return result;
            }
        };

        function d3treelayout(el, options) {
            this.el = el;

            var m = options.margins;
            w = el.width() - m[1] - m[3],
                h = el.height() - m[0] - m[2];

            this.width = w;
            this.height = h;

            var vis = d3.select('#' + this.el.attr('id')).append("svg:svg")
                .attr("width", w + m[1] + m[3])
                .attr("height", h + m[0] + m[2])
                .append("svg:g")
                .attr("transform", "translate(" + m[3] + "," + m[0] + ")");

            var axisLayer = vis.append("svg:g");

            var tree = d3.layout.tree()
                .size([h, w]);

            var diagonal = d3.svg.diagonal()
                .projection(function(d) { return [d.y, d.x]; });

            if(options.hideAxis)
                axisLayer.style("opacity", "0");

            function createAxis(domain) {
                var scale = d3.scale.ordinal()
                    .domain(domain)
                    .rangePoints([0, w]);

                var axis = d3.svg.axis()
                    .scale(scale)
                    .orient("bottom")
                    .tickSize(-h - 80);

                if(domain.length > 20) {
                    var tickValues = [];
                    var tick = 0;
                    var increment = (domain.length - 1) / 10;
                    for(var i = 0; i < 11; i++) {
                        tickValues.push(domain[Math.round(tick)]);
                        tick += increment;
                    }
                    axis.tickValues(tickValues);
                }

                axisLayer.append("svg:g")
                    .attr("class", "timeline-axis")
                    .attr("transform", "translate(0, " + (h + 80) + ")")
                    .call(axis);
            }

            // If we're hiding the root node, level 1 is the left-most
            var shallowestLevel = options.hideRootNode ? 1 : 0;

            var root;

            this.create = function (treeData, domain) {
                this.treeData = treeData;
                this.domain = domain;

                root = treeData;
                root.x0 = h / 2;
                root.y0 = 0;

                function initializeData() {
                    var idCounter = 0;
                    root.id = idCounter++;

                    function initializeBranch(node) {
                        if (node.children) {
                            node.children.forEach(initializeBranch);
                            toggle(node);
                        }
                        node.id = idCounter++;
                        node.selected = false;
                    }

                    root.children.forEach(initializeBranch);
                }
                initializeData();

                createAxis(domain);
            }

            this.load = function (savedState) {
                root = this.treeData = savedState.treeData;
                this.domain = savedState.domain;

                createAxis(this.domain);
            }

            this.getState = function () {
                return {
                    options: options,
                    treeData: this.treeData,
                    domain: this.domain
                };
            }

            this.update = function () {
                update();
            }

            this.setOption = function (key, value) {
                options[key] = value;
            }

            this.showAxis = function() {
                options.hideAxis = false;
                axisLayer.transition(500).style("opacity", "1");
            }

            this.hideAxis = function() {
                options.hideAxis = true;
                axisLayer.transition(500).style("opacity", "0");
            }

            function updateNodePositions(nodeToExclude) {
                var node = vis.selectAll("g.timeline-node");

                if(nodeToExclude)
                    node = node.filter(function (d) { return d !== nodeToExclude; });

                node.transition(500)
                    .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; });

                var linkSelector = "path.timeline-link";

                if(nodeToExclude)   // Exclude links to and from our node...
                    linkSelector += ":not([data-link-source='" + nodeToExclude.id + "']):not([data-link-target='" + nodeToExclude.id + "'])";

                var link = d3.selectAll(linkSelector)
                    .transition(500)
                    .attr("d", diagonal);
            }

            function dragStart(d) {
                if(!options.enableDragging)
                    return;

                if(options.dragStartHandler) {
                    var nodeElement = d3.select(this);
                    var node = nodeElement.datum();
                    options.dragStartHandler(node, nodeElement);
                }
            }

            function dragMove(d) {
                if(!options.enableDragging)
                    return;

                var nodeElement = d3.select(this);
                var node = nodeElement.datum();

                var newX = d3.event.x;
                var newY = d3.event.y;

                var oldX = node.y;
                var oldY = node.x;

                if (options.dragMoveHandler) {
                    var result = options.dragMoveHandler(node, nodeElement, newX, newY, oldX, oldY);
                    newX = result.x;
                    newY = result.y;

                    if(result.update)
                        updateNodePositions(node);
                }

                node.y = newX;
                node.x = newY;

                nodeElement.attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; });

                var link = d3.selectAll("[data-link-source='" + node.id + "'], [data-link-target='" + node.id + "']");
                link.attr("d", diagonal);
            }

            function dragEnd(d) {
                if(!options.enableDragging)
                    return;

                var nodeElement = d3.select(this);
                var node = nodeElement.datum();

                if (options.dragEndHandler) {
                    var finalCoords = options.dragEndHandler(node, nodeElement);
                    node.y = finalCoords[0];
                    node.x = finalCoords[1];
                }

                updateNodePositions();
            }

            var drag = d3.behavior.drag()
                .origin(function() {
                    var d = d3.select(this).datum();
                    return {x: d.y, y: d.x};
                })
                .on("dragstart", dragStart)
                .on("drag", dragMove)
                .on("dragend", dragEnd);

            // Toggle children of a given node
            function toggle(node) {
                node.selected = !node.selected;

                if (node.children) {
                    node._children = node.children;
                    node.children = null;
                } else {
                    node.children = node._children;
                    node._children = null;
                }
            }

            function update(source) {
                source = source || root;
                var duration = 500;

                // Compute the new tree layout.
                this.nodes = tree.nodes(root).reverse();
                if(options.hideRootNode) {
                    this.nodes = _(this.nodes).filter(function (n) { return n.id !== root.id; });
                }

                // If a normalize position-function was given, apply it to every node
                if (options.normalizePositions)
                    options.normalizePositions();

                // Update the nodes
                var node = vis.selectAll("g." + options.nodeClass)
                    .data(this.nodes, function(d) { return d.id; })

                // Enter any new nodes at the parent's previous position.
                var nodeEnter = node.enter().append("svg:g")
                    .attr("class", function (d) { return options.nodeClass + " " + (d.selected ? options.nodeClassSelected : options.nodeClassUnselected); })
                    .attr("transform", function(d) { return "translate(" + source.y0 + "," + source.x0 + ")"; })
                    .on("click", function(d) {
                        if(options.clickHandler) {
                            options.clickHandler.call(this, d);
                        }
                        else {
                            toggle(d);
                            update(d);
                        }
                    })
                    .call(drag);

                nodeEnter.append("svg:circle")
                    .attr("r", 1e-6)
                    .style("fill", function(d) { return d._children ? options.nodeColorUnexpanded : options.nodeColorExpanded; });

                // Switch between -1 and 1
                function alternate(row) { return (row % 2) * 2 - 1; }

                nodeEnter.append("svg:text")
                    .attr("x", function(d) { return d.children || d._children || d.depth === shallowestLevel ? -10 : 10; })
                    .attr("y", function(d) {
                        return d.depth === shallowestLevel ? 0 : (d.children || d._children ?  alternate(d.depth) * 10 : 0);
                    })
                    .attr("dy", ".35em")
                    .attr("text-anchor", function(d) { return d.children || d._children || d.depth === shallowestLevel ? "end" : "start"; })
                    .text(function(d) { return Helper.getWords(d.name, 5); })
                    .style("fill-opacity", 1e-6);

                nodeEnter.append("svg:title")
                    .text(function (d) { return d.name; });

                // Transition nodes to their new position.
                var nodeUpdate = node.transition()
                    .duration(duration)
                    .attr("class", function (d) { return options.nodeClass + " " + (d.selected ? options.nodeClassSelected : options.nodeClassUnselected); })
                    .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; })

                nodeUpdate.select("circle")
                    .attr("r", 4.5)
                    .style("fill", function(d) { return d._children ? options.nodeColorUnexpanded : options.nodeColorExpanded; });

                nodeUpdate.select("text")
                    .style("fill-opacity", 1);

                // Transition exiting nodes to the parent's new position.
                var nodeExit = node.exit().transition()
                    .duration(duration)
                    .attr("transform", function(d) { return "translate(" + source.y + "," + source.x + ")"; })
                    .remove();

                nodeExit.select("circle")
                    .attr("r", 1e-6);

                nodeExit.select("text")
                    .style("fill-opacity", 1e-6);

                // Update the links
                var link = vis.selectAll("path." + options.linkClass)
                    .data(tree.links(nodes), function(d) { return d.target.id; });

                // Enter any new links at the parent's previous position.
                link.enter().insert("svg:path", "g")
                    .attr("class", function (d) { return options.linkClass + " " + (d.target.selected ? options.linkClassSelected : options.linkClassUnselected); })
                    .attr("data-link-source", function (d) { return d.source.id })
                    .attr("data-link-target", function (d) { return d.target.id })
                    .attr("d", function(d) {
                        var o = {x: source.x0, y: source.y0};
                        return diagonal({source: o, target: o});
                    })
                    .transition()
                    .duration(duration)
                    .attr("d", diagonal);

                // Transition links to their new position.
                link.transition()
                    .attr("class", function (d) { return options.linkClass + " " + (d.target.selected ? options.linkClassSelected : options.linkClassUnselected); })
                    .duration(duration)
                    .attr("d", diagonal);

                // Transition exiting nodes to the parent's new position.
                link.exit().transition()
                    .duration(duration)
                    .attr("d", function(d) {
                        var o = {x: source.x, y: source.y};
                        return diagonal({source: o, target: o});
                    })
                    .remove();

                // Stash the old positions for transition.
                nodes.forEach(function(d) {
                    d.x0 = d.x;
                    d.y0 = d.y;
                });
            }
        }
    })();
}