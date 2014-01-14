if(Meteor.isClient)
    d3graph = function(el, options) {
        this.nodes = [];
        this.links = [];
        this.nodeDictionary = new Dictionary();
        this.el = el;
        this.options = options || {};
        this.id = this.options.id;
        this.fixedMode = false;
        this.visLayout = null;
        this.dragging = false;

        this.zoomWidget = null;
        this.noZoom = false;

        // set up private variables
        var fisheye = false; //(d3.fisheye && this.settings.fisheye) ? new d3.fisheye() : null;

        var _nodelib = new d3nodes(this);
        var _linklib = new d3links(this);
        var _highlightlib = new d3highlights(this);
        var _taglib = new d3tags(this);
        var _stylelib = new d3styles(this);
        var _labellib = new d3labels(this);

        var self = this;

        this.settings = {
            maxLabels: this.options.maxLabels||7,
            constrainNodes: (this.options.constrainNodes == true),
            embedLabels: (this.options.embedLabels == true),
            hideLabels: (this.options.hideLabels == true),
            minFontSize: (this.options.minFontSize || 8),
            maxFontSize: (this.options.maxFontSize||16),
            markerId: this.el.attr('id') + '_arrow',
            minMarkerSize: (this.options.minMarkerSize >= 0.0 ? this.options.minMarkerSize : 1.0),
            maxMarkerSize: (this.options.maxMarkerSize >= 0.0 ? this.options.maxMarkerSize : 1.0),
            gravity: this.options.gravity || 0.03,
            friction: this.options.friction ||.9,
            theta: 0.1,
            chargeConstant: this.options.charge || -150,
            linkStrength: this.options.linkStrength === undefined ?.2 : this.options.linkStrength,
            minRadius: this.options.minRadius || 3,
            maxRadius: this.options.maxRadius || 20,
            jenks: 0,
            minNodeRatio: .01,
            nodeBorderSize: this.options.nodeBorderSize||0,
            sizeFalloffPower: 1,
            chargeRatioFalloffPower: 0,
            linkConstant: this.options.linkConstant || 1,
            linkMultiplier: 0.5,
            minLinkThickness: this.options.minLinkThickness||.5,
            maxLinkThickness: this.options.maxLinkThickness||2.5,
            highlightedLinkThickness: this.options.highlightedLinkThickness||5,
            linkRadiiFalloffPower:this.options.linkRadiiFalloffPower || 1,
            layoutUpdateSpeed: 500,
            fixed: options.fixed,
            fisheye: this.options.fisheye,
            nodeSizeType: 'linear',
            zoom: (this.options.zoom != false),
            pan: this.options.pan,
            initialZoom: this.options.initialZoom,
            linkWeightThreshold: 0,
            draggable: this.options.draggable||false,
            taperedLinks: this.options.taperedLinks,
            taperedLinkMinColor: this.options.taperedLinkMinColor||"#BAE4B3",
            taperedLinkMaxColor: this.options.taperedLinkMaxColor||"#006D2C",
            taperedLinkMinSize: this.options.taperedLinkMinSize,
            taperedLinkMaxSize: this.options.taperedLinkMaxSize,
            reverseLabelPosition: this.options.reverseLabelPosition,
            constrainNodes: this.options.constrainNodes
        };

        this.events = {
            onGraphClick: options.onGraphClick,
            onGraphMousemove: options.onGraphMousemove,
            onGraphMouseup: options.onGraphMouseup,
            onGraphMousedown: options.onGraphMousedown,
            onGraphDoubleClick: options.onGraphDoubleClick,
            onNodeTooltip: options.onNodeTooltip,
            onLinkTooltip: options.onLinkTooltip,
            onNodeClick: options.onNodeClick,
            onNodeRightClick: options.onNodeRightClick,
            onNodeMouseover: options.onNodeMouseover,
            onNodeMouseout: options.onNodeMouseout,
            onNodeMousedown: options.onNodeMousedown,
            onNodeMouseup: options.onNodeMouseup,
            onNodeDblClick: options.onNodeDblClick,
            onLinkClick: options.onLinkClick,
            onLinkMouseover: options.onLinkMouseover,
            onLinkMouseout: options.onLinkMouseout,
            onLinkMousedown: options.onLinkMousedown,
            onLinkMouseup: options.onLinkMouseup,
            onLabelClick: options.onLabelClick,
            onLabelMouseover: options.onLabelMouseover,
            onLabelMouseout: options.onLabelMouseout
        };

        this.d3 = function() { return d3.select('#' + el.attr('id')); };

        this.d3nodes = function () { return _nodelib; };
        this.d3links = function () { return _linklib; };
        this.d3tags = function () { return _taglib; };
        this.d3highlights = function () { return _highlightlib; };
        this.d3styles = function () { return _stylelib; };
        this.d3labels = function () { return _labellib; };
        this.d3zoomer = function() { return this.zoomer; };

        this.force = function () { return self.visLayout; };

        var w = this.width = this.el.innerWidth();
        var h = this.height = this.el.innerHeight();
        this.scale = this.settings.initialZoom || 1.0;
        this.trans = [(w / 2) - (w * this.scale / 2), (h / 2) - (h * this.scale / 2)];

        var doubleclick = false;
        this.el.on('click', function (evt) {
            doubleclick = false;
            if (self.events.onGraphClick && typeof (self.events.onGraphClick) === "function") {
                // set a timer and run the event after it expires - to allow for a possible double-click event instead
                setTimeout(function() {
                    if(!doubleclick)
                        self.events.onGraphClick(evt);
                }, 150);
            }
        });

        this.el.on('dblclick', function (evt) {
            if (self.events.onGraphDoubleClick && typeof (self.events.onGraphDoubleClick) === "function") {
                doubleclick = true;
                if(evt.preventDefault) evt.preventDefault();
                if(evt.stopPropagation) evt.stopPropagation();
                self.events.onGraphDoubleClick(evt);
            }
        });

        this.linkDistance = function (d) {
            return self.settings.linkConstant + Math.pow(d.target.radius + d.source.radius, self.settings.linkRadiiFalloffPower);
        };

        this.charge = function (d) {
            return self.settings.chargeConstant * self.settings.linkConstant * Math.pow(d.ratio, self.settings.chargeRatioFalloffPower);
        };

        this.getCenter = function () {
            var x = $.map(this.nodes, function (n) { return n.x; });
            var y = $.map(this.nodes, function (n) { return n.y; });
            return { x: (Array.min(x) + Array.max(x)) / 2, y: (Array.min(y) + Array.max(y)) / 2 };
        };

        this.clear = function () {
            nodes.splice(0, nodes.length);
            links.splice(0, links.length);
            this.nodeDictionary = new Dictionary();

            // clear labels
            self.visLabels.selectAll('g.label').remove();

            this.update();
        };

        if(this.settings.zoom) {
            this.zoomer = new d3zoomer();
            this.zoomer.initialize(this, this.options.zoomWidgetId);
        }
        else {
            this.vis = d3.select('#' + this.el.attr('id')).append("svg:svg");
            //.attr("width", w)
            //.attr("height", h);

            if(this.options.class)
                this.vis.attr('class', this.options.class);
        }

        this.vis
            .on('mousemove', function() {
                if(self.events.onGraphMousemove)
                    self.events.onGraphMousemove(d3.event);
            })
            .on('mousedown', function(e) { if(self.events.onGraphMousedown) self.events.onGraphMousedown(e); })
            .on('mouseup', function(e) { if(self.events.onGraphMouseup) self.events.onGraphMouseup(e); });

        this.markers = this.vis
            .append("svg:defs");

        _linklib.addMarkerDefinition('default', _stylelib.colors.linkMax);

        this.visLinks = this.vis
            .append('svg:g')
            .attr('class', 'links');

        this.visNodes = this.vis
            .append('svg:g')
            .attr('class', 'nodes');

        this.visLabels = this.vis
            .append('svg:g')
            .attr('class', 'labels');

        var force = this.force = d3.layout.force()
            .theta(this.settings.theta)
            .gravity(this.settings.gravity)
            .linkStrength(this.settings.linkStrength)
            .friction(this.settings.friction)
            .linkDistance(self.linkDistance)
            .charge(this.charge)
            .size([w, h]);

        /* NO IDEA WHY THIS DOESN'T WORK!!!!!

         force.drag = d3.behavior.drag()
         .on("dragstart", function() {
         _highlightlib.displayNodes();
         this.dragging = true;
         force.resume();
         })
         .on("drag", function(d) {
         d.x += d3.event.dx;
         d.y += d3.event.dy;
         d.px += d3.event.dx;
         d.py += d3.event.dy;
         d3.select(this).attr("transform", "translate(" + d.x + "," + d.y + ")");
         force.tick();
         })
         .on("dragend", function() {
         this.dragging = false;
         });
         */
        force.drag = d3.behavior.drag()
            .origin(Object)
            .on("dragstart", $.proxy(function(e) {
                if(!self.settings.draggable)
                    return;

                this.dragging = true;
                force.resume();
            }, this))
            .on("drag", function(d, i) {
                if(!self.settings.draggable)
                    return;
                d.x = d3.event.x;
                d.y = d3.event.y;
                d3.select(this).attr('transform', 'translate(' + d.x + ',' + d.y + ')');
                force.tick();
            })
            .on("dragend", $.proxy(function() {
                if(!self.settings.draggable)
                    return;
                this.dragging = false;
            }, this));

        var nodes = this.nodes = force.nodes();
        var links = this.links = force.links();

        this.getNodes = function () { return nodes; };

        this.calculate = function(filterKey) {
            _nodelib.calculateNodes(filterKey);
            _linklib.calculateLinks(filterKey);
        };

        this.update = function () {
            w = this.width;
            h = this.height;

            self.settings.linkConstant = (this.nodes.length > 1) ?
                this.settings.linkMultiplier * Math.min(w, h) / (3 * Math.sqrt(this.nodes.length - 1)) :
                1;

            this.force
                .theta(this.settings.theta)
                .linkStrength(function(d) {
                    return self.settings.linkStrength * (d.source.color == d.target.color ? 4 : 1);
                })
                .friction(this.settings.friction)
                .charge(this.charge)
                .gravity(this.settings.gravity)
                .size([this.width, this.height]);

            var link = this._links = this.visLinks.selectAll("path.link")
                .data(this.links);

            var d3color = d3.interpolateRgb(this.settings.taperedLinkMinColor, this.settings.taperedLinkMaxColor);

            var color_scale = d3.scale.linear().range([0, 1]).domain([0, d3.max(link, function(d) {
                return d.ratio;
            })]);

            var l = link.enter().append("svg:path")
                .attr('source', function (link) { return link.source.id; })
                .attr('target', function (link) { return link.target.id; })
                .on('mouseover', function (d) { _linklib.onLinkMouseover(d); })
                .on('mouseout', function (d) { _linklib.onLinkMouseout(d); })
                .on('click', function(d) { _linklib.onLinkClick(d); })
                .attr('class', 'link');

            if(this.settings.taperedLinks)
                l.attr("fill", function(d) {
                    return d3color(color_scale(d.ratio));
                });
            else {
                l.style('fill', 'none');
                l.attr('marker-end', function(link) {
                    return link.directional ? 'url(#' + (self.id||'') + self.settings.markerId + '_' + (link.marker ? link.marker : 'default') + ')' : '';
                });
            }

            link.exit().remove();

            link
                .style("stroke-width", function (d) { return _linklib.getLinkWidth(d); })
                .style("stroke", function (d) {
                    if(self.settings.taperedLinks)
                        return self.settings.taperedLinkBorders ? d3colors.darken(d3color(color_scale(d.ratio))).hex() : 'rgb(255,255,255,.5)';

                    return _linklib.getLinkColor(d);
                });

            var node = this._nodes = this.visNodes.selectAll("g.node")
                .data(this.nodes);

            var nodeEnter = node.enter().append("g")
                .attr("class", "node")
                .attr('id', function (d) { return d.id; })
                .on('mouseover', function (d) { return _nodelib.onNodeMouseover(d); })
                .on('mouseout', function (d) { return _nodelib.onNodeMouseout(d); })
                .on('mousedown', function(d) { return _nodelib.onNodeMousedown(d); })
                .on('mouseup', function(d) { return _nodelib.onNodeMouseup(d); })
                .on('click', function (d) { return _nodelib.onNodeClick(d); })
                .on('dblclick', function(d) { return _nodelib.onNodeDblClick(d); });

            if(this.options.nodeSorting)
                nodeEnter.sort(function(a, b) {
                    return b.radius - a.radius;
                });

            if(self.settings.draggable)
                nodeEnter.call(force.drag);

            if ($.browser.msie) {
                this.visNodes.selectAll("g.node")
                    .on("mousedown", function(d) { _nodelib.onNodeClick(d); });
            }

            if (_stylelib.settings.nodeBorderSize > 0)
                nodeEnter.append("circle")
                    .style('stroke-width', _stylelib.settings.nodeBorderSize)
                    .style('cursor', 'pointer')
                    .style('fill', function (d) { d.color = _nodelib.getNodeColor(d); return d.color; })
                    .style('stroke', function(d) { return _nodelib.getNodeBorderColor(d); });
            else
                nodeEnter.append("circle")
                    .style('fill', function (d) { d.color = _nodelib.getNodeColor(d); return d.color; })
                    .style('cursor', 'pointer');

            // make sure we update all of the radii to their current values - we do this with a smooth animation
            var scale = this.scale || 1.0;
            this.visNodes.selectAll('g.node circle')
                //.transition()
                //.duration(200)
                .attr('r', function (d) { return _nodelib.getNodeRadius(d) / scale; });

            node.exit().remove();

            if(this.vis.node()) {
                this.vis.node().oncontextmenu = function() {
                    //if(!self.currentNode)
                    //    return settings.debug;

                    return _nodelib.onNodeRightClick(self.currentNode);
                };
            }

            var labels = this._labels = this.visLabels
                .selectAll('g.label')
                .data(nodes, function (node) { return node.id; });

            labels = labels
                .enter()
                .append('svg:g')
                .attr('class', 'label')
                .attr('style', 'cursor:pointer')
                .attr('id', function (node) { return node.id; })
                .on('mouseover', function (node) { _labellib.onLabelMouseover(node); })
                .on('mouseout', function (node) { _labellib.onLabelMouseout(node); })
                .on('click', function (node) { _labellib.onLabelClick(node); })
                .classed('active', true);

            //.call(force.drag);

            try {
                labels.sort(function(a, b) {
                    return a.radius - b.radius;
                });
            }
            catch(e) { }

            if (this.settings.embedLabels) {
                labels.append('text')
                    .attr('baseline', 'text-top')
                    .attr('fill', function (d) { return _labellib.getLabelColor(d); })
                    .attr('text-anchor', 'middle')
                    //.style('text-shadow', _stylelib.colors.labelShadow ? _stylelib.colors.labelShadow + ' 0px 1px 1px' : '')
                    .style('cursor', 'pointer')
                    .each(_labellib.getEmbeddedLabelFontSize)
                    .each(_labellib.wordWrapLabel);
            }
            else {
                labels.append('text')
                    .attr('baseline', 'middle')
                    .style('font-size', function (d) { return _labellib.getLabelSize(d); })
                    .attr('fill', function (d) { return _nodelib.getNodeBorderColor(d); /*LABEL FIX:_labellib.getLabelColor(d);*/ })
                    //.style('text-shadow', '-1px -1px 2px #FFF, 1px -1px 2px #FFF, -1px 1px 2px #FFF, 1px 1px 2px #FFF')
                    .style('opacity', function(d) { return _labellib.getLabelOpacity(d); })
                    .text(function (d) { return d.hideLabel ? '' : d.title; });
            }

            $('#' + this.el.attr('id') + ' svg g.nodes circle').tipsy({
                html: true,
                fade: false,
                hoverlock: true,
                delayIn: _stylelib.settings.tooltipDelay,
                tipsyClass: _stylelib.settings.nodeTooltipClass,
                title: function () {
                    var d = this.__data__;
                    return _nodelib.getNodeTooltip(d);
                },
                gravity: $.fn.tipsy.autoWE
            });

            $('#' + this.el.attr('id') + ' svg g.links path').tipsy({
                html: true,
                fade: false,
                hoverlock: true,
                delayIn: _stylelib.settings.tooltipDelay,
                tipsyClass: _stylelib.settings.linkTooltipClass,
                title: function () {
                    var d = this.__data__;
                    return (d.tooltip == undefined) ? undefined : d.tooltip;
                },
                gravity: $.fn.tipsy.autoNS
            });

            if (fisheye) {
                this.vis.on("mousemove", function () {
                    fisheye.center(d3.mouse(this));

                    node
                        .each(function (d) { d.display = fisheye(d); d.display.r = d.display.z * 10; })
                        .attr("transform", function (d) {
                            return "translate(" + d.display.x + "," + d.display.y + ")";
                        });

                    this.vis.selectAll("g.node circle").attr('r', function (d) { return _nodelib.getNodeRadius(d); });

                    link.attr("d", function (d) { return _linklib.calculatePath(d, true); });
                });
            }

            force.on("tick", function () {
                if (self.fixedMode)
                    return;

                // FIX FOR IE10/11 WHERE THE MARKERS DON'T GET MOVED WITH THE LINES
                if(navigator.appVersion.indexOf("MSIE 10") != -1 || ($.browser.mozilla && parseInt($.browser.version, 10) == 11))
                    link.each(function() { this.parentNode.insertBefore(this, this); });

                // calculate graph center
                var center = self.getCenter();

                // Update links
                link
                    .attr('d', function (d) { return _linklib.calculatePath(d); });

                // Update nodes
                node
                    .attr("transform", function (d) {
                        if(self.settings.constrainNodes) {
                            if(d.x < d.radius)
                                d.x = d.radius;
                            if(d.y < d.radius)
                                d.y = d.radius;
                            if(d.x > self.width - d.radius)
                                d.x = self.width - d.radius;
                            if(d.y > self.height - d.radius)
                                d.y = self.height - d.radius;
                        }

                        return "translate(" + d.x + "," + d.y + ")";
                    });

                // Update labels
                self.d3()
                    .selectAll('g.label')
                    .attr('transform', function (node) { return _labellib.transformLabel(node, center); });

                self.d3()
                    .selectAll('g.label text')
                    .attr('text-anchor', function (node) { return self.settings.embedLabels ? 'middle' : (RTL ? (node.x < center.x ? 'start' : 'end') : (node.x < center.x ? 'end' : 'start')); });
            });

            // Restart the force layout.
            force.start();

            this.updateLabels();
            _nodelib.updateNodeSizesForZoom(this.scale);
            _linklib.updateLinkSizesForZoom(this.scale);
            _labellib.updateLabelSizesForZoom(this.scale);
        };

        this.updateTooltips = function () {
            this.d3().selectAll('g.nodes circle').each(function (d) { d.tooltip = _nodelib.getNodeTooltip(d); });
        };

        this.updateLabels = function() {
            var self = this;
            var center = this.getCenter();
            this.d3()
                .selectAll('g.label text')
                .attr('fill', function (d) { return _nodelib.getNodeBorderColor(d); /*LABEL FIX:_labellib.getLabelColor(d);*/ })
                .attr('text-anchor', function (node) { return self.settings.embedLabels ? 'middle' : (node.x < center.x ? 'end' : 'start'); });
        };

        this.setTooltipDelay = function (value) {
            _stylelib.settings.tooltipDelay = value;

            $('#' + this.el.attr('id') + ' svg circle').each(function (i, a) {
                var tipsy = $.data(a, 'tipsy');
                if (tipsy)
                    tipsy.options.delayIn = value;
            });
        };

        this.stop = function () {
            if (d3.event)
                d3.event.stopPropagation();

            if (!self.force)
                return;

            self.force.stop();
            self.fixedMode = true;
        };

        this.start = function () {
            // turn off fixed mode and resume the forces
            self.fixedMode = false;
            if (self.force)
                self.force.resume();
        };

        /* Node methods */

        this.animateNodeClick = function(node, callback) {
            return _nodelib.animateNodeClick(node, 100, callback);
        };

        this.addNode = function (settings) {
            return _nodelib.addNode(settings);
        };

        this.removeNode = function (id, tag, fade, forceRemove) {
            return _nodelib.removeNode(id, tag, fade, forceRemove);
        };

        this.setNodeTitle = function (node, title) {
            return _nodelib.setNodeTitle(node, title);
        };

        this.moveNodes = function (positions, time, ignoreLinks) {
            return _nodelib.moveNodes(positions, time, ignoreLinks);
        };

        this.getNode = function (id) {
            return _nodelib.getNode(id);
        };

        this.getNodeByTitle = function(title) {
            return _nodelib.getNodeByTitle(title);
        };

        this.viewClusters = function (pct) {
            return _nodelib.viewClusters(pct);
        };

        /* End node methods */

        /* Link methods */

        this.addLink = function (options) {
            return _linklib.addLink(options);
        };

        this.removeLink = function (from, to) {
            return _linklib.removeLink(from, to);
        };

        this.getSharedLinks = function (nodes) {
            return _linklib.getSharedLinks(nodes);
        };

        /* End link methods */

        /* Highlight methods */

        this.fadeOut = function (time, callback) {
            return _highlightlib.fadeOut(time, callback);
        };

        this.fadeIn = function (time, callback) {
            return _highlightlib.fadeIn(time, callback);
        };

        this.animateLine = function(x1, y1, x2, y2, color, time, thickness) {
            return _highlightlib.animateLine(x1, y1, x2, y2, color, time, thickness);
        };

        this.displayNodes = function(options) {
            return _highlightlib.displayNodes(options);
        };
        /* End highlight methods */

        this.showLabels = function(top) {
            return _labellib.showTop(top);
        };

        this.getImage = function() {
            var el = this.el.find('svg');

            $('#canvas').css({ width: el.width(), height: el.height() });
            var html = new XMLSerializer().serializeToString(el[0]);
            canvg('canvas', html);
            return document.getElementById('canvas').toDataURL('image/png');
        };

        // Start it
        this.update();
    }
