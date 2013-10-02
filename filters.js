if(Meteor.isClient)
    d3filters = function(graph) {
        this.graph = graph;
        this.svg = $(this.graph.vis[0][0]).closest('svg');
        this.filters = [];
        this.activeFilters = [];
        this.currentFilters = [];

        /*
         handler.notifications.bind('structureChanged', function() {
         this.clearFilterValues();
         }, this);
         */

        this.register = function(filters) {
            this.filters = this.filters.concat(filters);
        };

        this.getFilters = function(type) {
            return type ? $.grep(this.filters, function(f) { return f.type == type; }) : this.filters;
        };

        this.get = function(id, type) {
            var matches = $.grep(this.filters, function(f) { return f.id == id && (!type || f.type == type); });
            if(matches.length > 0)
                return matches[0];
        };

        this.add = function(id, type, filter) {
            this.filters.push({ id: id, type: type, module: filter });
        }

        /*
         this.load = function(callback) {
         var count = 0;
         var len = this.filters.length;

         $.each(this.filters, $.proxy(function(i, filter) {
         require(['graph/filters/' + filter.type + '/' + filter.id], $.proxy(function(f) {
         filter.module = f;
         count++;
         if(count >= len && !this.loaded) {
         this.loaded = true;
         if(callback)
         callback();
         }
         }, this));
         }, this));
         };
         */

        this.getActiveFilters = function(type, axis) {
            return type ? $.grep(this.activeFilters, function(f) { return f.filter.type == type && (!axis || $.inArray(axis, f.axes) >= 0); }) : this.activeFilters;
        };

        this.clearFilterValues = function() {
            this.currentFilters = [];
            $.each(this.graph.nodes, function(n) { n.filterValues = {}; });
        };

        this.clearFilter = function(type, axis) {
            // remove all filters of this type from the list of active filters
            for(var i = this.activeFilters.length - 1; i >= 0; i--) {
                var f = this.activeFilters[i];
                if(f.filter.type == type) {
                    if((type == 'visibility' && axis && f.filter.id == axis) || (!axis || $.inArray(axis, f.axes) >= 0))
                        this.activeFilters.splice(i, 1);
                }
            }
        };

        this.execute = function(args) {
            // it not, execute this filter and assign all of the values
            var opts = args.options || { async: true, draw: true, axes: [] };
            var id = args.id
            var type = args.type;
            var params = args.params;
            var nodes = args.nodes || this.graph.nodes;

            //if(settings.graph.spectrum)
            //    params.spectrum = settings.graph.spectrum;

            // first see if we have it
            var filter = this.get(id, type);
            if(!filter) {
                if(opts.error)
                    opts.error('No such filter registered');
                return null;
            }

            if(!filter.module) {
                if(opts.error)
                    opts.error('Filter not loaded for synchronous execution');
                return null;
            }

            this.addSetAndGet(filter.module, id, params);
            var key = id + '-' + (params ? JSON.stringify(params) : '');

            if(!this.currentFilters[key])
                this.currentFilters[key] = filter.module.execute(nodes, params);

            this._afterExecute(filter, params, this.currentFilters[key], opts);

            return { filter: filter, result: this.currentFilters[key] };
        };

        this.addSetAndGet = function(module, id, params) {
            var g = this.graph;
            module.set = function(node, value) {
                var n = g.getNode(node.id);
                if(n)
                    n.filterValues[id + '-' + (params ? JSON.stringify(params) : '')] = value;
            };
            module.get = function(node) {
                var n = g.getNode(node.id);
                if(n)
                    return n.filterValues[id + '-' + (params ? JSON.stringify(params) : '')];
            };
            module.setTitle = function(node, title) {
                if(!title)
                    return;

                var n = g.getNode(node.id);
                if(n)
                    n.clusterTitles[id + '-' + (params ? JSON.stringify(params) : '')] = title;
            };
            module.getTitle = function(node) {
                var n = g.getNode(node.id);
                if(n)
                    return n.clusterTitles[id + '-' + (params ? JSON.stringify(params) : '')];
            };
        };

        this._afterExecute = function(filter, params, result, opts) {
            // de-activate any filters that are no longer active
            var axes = opts.axes||[];

            // 1 - if we just executed a color filter, remove any other active color filters
            if(filter.type == 'color') {
                this.clearFilter('color');

                // set each node.clusterTitle
                $.each(this.graph.nodes, function(i, node) {
                    node.clusterTitle = filter.module.getTitle(node);
                });
            }

            // 2 - if we just executed a value filter, remove any other active values filters using any of the same axes
            if(filter.type == 'value')
                $.each(axes, $.proxy(function(i, a) {
                    this.clearFilter('value', a);
                }, this));

            // 3 - if we executed a visibility filter
            if(filter.type == 'visibility') {
                // remove any other active visibility filters with the same id
                this.clearFilter('visibility', filter.id);
            }

            // add it to the list of active filters
            this.activeFilters.push({ filter: filter, params: params, result: result, axes: axes });

            // update the colors, sizes, labels, and edge/node visibility based on the currently active filters
            if(opts.draw)
                this.draw(opts.maxNodes, filter, params, opts);

            // TODO: raise the event signalling that the filter was run

            return true;
        };

        this.draw = function(count, filter, params, options) {
            var opts = options||{};
            var showColorLegend = opts.legend;
            var margins = opts.margins;

            // first see if we need to prune any nodes
            if(count && count > 0 && count < this.graph.nodes.length)
                this.pruneGraph(filter, params, count);

            // if we have a color filter active, set the colors
            var filters = this.getActiveFilters('color');
            if(filters.length) {
                // HACK!
                window.application.state.colorFilterActive = true;

                this.setColors(filters[0]);
                if(filters[0].filter.type == 'color') {
                    if(filters[0].result && filters[0].result.legend && !(showColorLegend === false))
                        this.showColorLegend(filters[0].result.legend);
                }
            }
            else {
                // HACK!
                window.application.state.colorFilterActive = false;

                // otherwise see if we have a value filter of color type and set the colors
                filters = this.getActiveFilters('value', 'color');
                if(filters.length)
                    this.setColors(filters[0], opts.useGraphColors);
            }

            // if we have a value filter of size type, set the radii
            filters = this.getActiveFilters('value', 'size');
            if(filters.length) {
                this.setRadii(filters[0]);
                this.updateLabelVisibility(filters[0]);
            }

            // if we have a value filter of x/y type, set the x or y position
            filters = this.getActiveFilters('value', 'x');
            if(filters.length)
                this.setPosition(filters[0], 'x', margins);

            filters = this.getActiveFilters('value', 'y');
            if(filters.length)
                this.setPosition(filters[0], 'y', margins);

            // if any of our visibility filters are returning true, make the node visible, otherwise hide it
            this.updateNodeVisibility(this.getActiveFilters('visibility'));

            // TODO: and same for links

            window.application.events.trigger('graphStateChanged', this.graph);

            var graph = this.graph;
            graph.update();
            graph.nodelib().updateNodeSizesForZoom(graph.scale);
            graph.labellib().updateLabelSizesForZoom(graph.scale);
            graph.linklib().updateLinkSizesForZoom(graph.scale);
            graph.linklib().updateLinkColors();
        };

        this.updateLabelVisibility = function(filter) {
            // update labels based on the results of this filter
            var count = 0;
            if(filter.result && typeof filter.result === 'number' && filter.result >= 0)
                count = filter.result;
            else if(filter.result && typeof filter.result === 'object' && filter.result.labelCount >= 0)
                count = filter.result.labelCount;
            else if(!filter.result)
                count = this.graph.settings.maxLabels;

            var nodes = this.graph.nodes.filter(function(n) { return n.visible; });

            // display the correct number of labels
            if(count < nodes.length) {
                // clone nodes
                var sorted = nodes.slice(0);

                // sort them
                var filterKey = filter.filter.id + '-' + JSON.stringify(filter.params);
                sorted = sorted.sort(function(a, b) { return (b.getValue(filterKey) || b.value) - (a.getValue(filterKey)|| a.value); });

                // turn the labels off
                this.graph.visLabels
                    .selectAll('g.label text')
                    .text(function(d) {
                        d.hideLabel = true;
                        return '';
                    });

                // and on for the top 'count'
                for(var i = 0; i < count; i++) {
                    this.graph.visLabels
                        .selectAll('g.label[id="' + sorted[i].id + '"] text')
                        .text(function(d) {
                            d.hideLabel = false;
                            return d.title;
                        })
                        .style('opacity', 1.0);
                }
            }
            else if(nodes.length > 0) {
                // show them all
                this.graph.visLabels
                    .selectAll('g.label text')
                    .text(function(d) {
                        d.hideLabel = false;
                        return d.title;
                    })
                    .style('opacity', 1.0);
            }
        };

        this.updateNodeVisibility = function(filters) {
            if(filters && filters.length > 0) {
                $.each(this.graph.nodes, function(i, n) {
                    // if any of the filter values are true, we show it
                    var show = false;
                    for(var i = 0; i < filters.length; i++) {
                        if(n.getValue(filters[i].filter.id + '-' + JSON.stringify(filters[i].params))) {
                            show = true;
                            break;
                        }
                    }
                    n.visibility.filter = show;
                });
            }

            var colorFilter = this.getActiveFilters('color').length > 0;
            $.each(this.graph.nodes, function(i, n) {
                n.visible = (!colorFilter || n.visibility.color) && (!filters || !filters.length || n.visibility.filter);
            });

            this.graph.displayNodes({
                nodes: $.grep(
                    this.graph.nodes,
                    function(n) {
                        return n.visible;
                    }),
                time: 10,
                links: 'connected',
                opacity:.1
            });
        };

        var _palette = [
            '#fbf1c5', '#f8db99', '#d1bb96', '#c2a472',
            '#b28d4f', '#755d33', '#cc0000', '#b32007',
            '#821705', '#406cff', '#1271a8', '#0d527a',
            '#010b6d', '#202356', '#5c0d7a', '#09661e'
        ];

        this.setPalette = function(palette, hideLegend) {
            _palette = palette;

            // if there's an active color filter, set the colors
            var filters = this.getActiveFilters('color');
            if(filters.length) {
                this.setColors(filters[0]);
                if(filters[0].result && filters[0].result.legend) {
                    this.showColorLegend(filters[0].result.legend);
                    if(hideLegend)
                        this.showKey(false);
                }
            }
        };

        this.setColors = function(filter, useGraphColors) {
            var g = this.graph;
            var color = filter.result ? (filter.result.color || filter.filter.module.color) : filter.filter.module.color;
            var nodes = g._nodes.select('svg g.node circle');

            if(!useGraphColors && color && color.min && color.max) {
                g.stylelib().colors.nodeMin = color.min;
                g.stylelib().colors.nodeMax = color.max;
            }

            // calculate the ratio for each node based on this filter value
            var id = filter.filter.id + '-' + (filter.params ? JSON.stringify(filter.params) : '');

            if(filter.filter.type != 'color')
                g.calculate(id);

            nodes
                .style('fill', function (d) {
                    var val = d.getValue(id);

                    if(val && val.indexOf && val.indexOf('#') == 0) {
                        d.visibility.color = true;
                        return (d.color = val);
                    }

                    d.visibility.color = (val >= 0);
                    d._color = undefined;

                    return (filter.filter.type == 'color') ?
                        (d.color = (val >= 0 ? _palette[val] : '#EEEEEE')) :
                        (d.color = g.nodelib().getNodeColor(d, g.stylelib().colors.nodeMin, g.stylelib().colors.nodeMax));
                })
                .style('stroke', function(d) {
                    return g.stylelib().getNodeBorderColor(d);
                });

            g.visLinks
                .selectAll('g.links path')
                .style('stroke-width', function(d) { return g.linklib().getLinkWidth(d); });

            g.linklib().updateLinkColors();

            // set label colours
            g.visLabels
                .selectAll('g.label text')
                .attr('fill', function (d) {
                    return g.stylelib().getNodeBorderColor(d,.6);
                });

            var y = g.scale;
            g.labellib().updateLabelSizesForZoom(y);
            g.nodelib().updateNodeSizesForZoom(y);
            g.linklib().updateLinkSizesForZoom(y);
        };

        this.setRadii = function(filter) {
            var g = this.graph;

            // set the min/max radii of the graph based on the filter
            /*
             if(filter.filter.module && filter.filter.module.radius) {
             g.settings.minRadius = filter.filter.module.radius.min;
             g.settings.maxRadius = filter.filter.module.radius.max;
             }
             */

            g.calculate(filter.filter.id + '-' + (filter.params ? JSON.stringify(filter.params) : ''));

            g._nodes
                .select('svg g.node circle')
                .attr('r', function(d) { return d.radius; });
        };

        this.setPosition = function(filter, axis, margins) {
            var g = this.graph;

            // calculate the ratio
            g.calculate(filter.filter.id + '-' + (filter.params ? JSON.stringify(filter.params) : ''));

            var positions = [];
            $.each(g.nodes, function(i, node) {
                var pos = { id: node.id };
                if(axis == 'x') {
                    var width = g.width - margins.left - margins.right;
                    pos.x = (width * node.ratio) + margins.left;
                }
                else {
                    var height = g.height - margins.top - margins.bottom;
                    pos.y = g.height - margins.top - (height * node.ratio)
                }
                positions.push(pos);
            });

            // move the nodes
            g.moveNodes(positions);
        };

        this.pruneGraph = function(filter, params, count) {
            var list = this.graph.nodes.slice();
            var id = filter.id + '-' + (params ? JSON.stringify(params) : '');
            list.sort($.proxy(function(a, b) {
                if(!filter)
                    return a.value == b.value ? b.frequency - a.frequency : b.value - a.value;

                var aVal = a.getValue(id);
                var bVal = b.getValue(id);

                return (aVal == bVal) ? b.getValue() - a.getValue() : bVal - aVal;
            }, this));

            // only keep the top x
            list = list.slice(count);

            $.each(list, $.proxy(function(i, node) {
                this.graph.removeNode(node.id, null, null, true);
            }, this));
        };

        this.restore = function() {
            // execute all of the active filters and then re-draw
            var filters = this.activeFilters.slice(0);
            var count = 0;
            var target = filters.length;
            for(var i = 0; i < filters.length; i++) {
                var f = filters[i];
                this.execute({
                    id: f.filter.id,
                    type: f.filter.type,
                    params: f.params,
                    options: {
                        async: true,
                        draw: false,
                        axes: f.axes,
                        success: $.proxy(function() { count++; if(count == target) this._restoreFinish(); }, this)
                    }
                });
            }
        };

        this._restoreFinish = function() {
            var filter;
            var filters = this.getActiveFilters('value');
            if(filters.length)
                filter = filters[0];
            this.draw(settings.resolution, filter, filter ? filter.params : null);
        };

        this.showColorLegend = function(legend) {
            var c = this.svg.attr('class');
            $(this.graph.el).find('.color-filter-legend.' + c).remove();

            this.legend = legend;
            // display legend
            var numRows = Math.min(20, legend.values.length);
            var numCols = Math.floor((legend.values.length - 1) / 20) + 1;

            var html = '<table><tr>';
            $.each(legend.values, $.proxy(function(i, val) {
                var c = _palette[i];
                var fc = colors.getDarkerColorHex(c);
                html += '<td style="vertical-align:middle;background-color:' + c + ';width:100px;border-radius:3;height:20px;width:40px;border:1px solid ' + fc + '"></td>' +
                    '<td style="vertical-align:middle;color:' + fc + '"><nobr><label style="cursor:pointer" for="legend-select-' + i + '">' + val.name + '</label></nobr></td>' +
                    '<td><input type="checkbox" checked class="legend-selector" id="legend-select-' + i + '" legend-index="' + i + '"/></span></td>';
                if(!((i + 1) % numCols))
                    html += '</tr><tr>'
            }, this));
            html += '</tr></table>';

            var c = this.svg.attr('class');

            jQuery('<div/>', {
                class: 'color-filter-legend ' + c,
                html: html,
                css: {
                    'background-color': '#ffffff',
                    'text-align': 'center',
                    'vertical-align': 'middle',
                    'font-size': '11px',
                    'font-weight': 'bold',
                    padding: 5,
                    border: 0,
                    'z-index': 55,
                    left: 0,
                    bottom: $('#graph-manager-toolbar').height(),
                    opacity:.8,
                    width: 20 + (numCols * 150),
                    height: 5 + (numRows * 25),
                    border: '1px solid #ccc',
                    'border-radius': 5,
                    position:'absolute'

                }
            }).appendTo(this.graph.el);

            var self = this;
            $('input.legend-selector', this.graph.el).change(function() {
                var legend = self.legend.values[parseInt($(this).attr('legend-index'))];
                legend.hidden = !$(this).attr('checked');

                var filters = self.getActiveFilters('color');
                if(filters.length) {
                    // find the list of parameters we'll be ignoring
                    var filter = filters[0];
                    filter.params.ignore = [];

                    $('input.legend-selector').each(function() {
                        if(!$(this).attr('checked')) {
                            var leg = self.legend.values[parseInt($(this).attr('legend-index'))];
                            filter.params.ignore.push(leg.value);
                        }
                    });

                    // run the color filter again
                    self.execute({
                        id: filter.filter.id,
                        type: filter.filter.type,
                        params: filter.params,
                        options: {
                            async: true,
                            draw: true,
                            show: true,
                            legend: false
                        }
                    });
                }
            });
        };

        this.hideColorLegend = function() {
            var c = this.svg.attr('class');
            $(this.graph.el).find('.color-filter-legend.' + c).remove();
        };

        this.showKey = function(show) {
            var c = this.svg.attr('class');
            if(show)
                $(this.graph.el).find('.color-filter-legend.' + c).show();
            else
                $(this.graph.el).find('.color-filter-legend.' + c).hide();
        };
    };
