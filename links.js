if(Meteor.isClient)
    d3links = function (graph) {
        var self = this;

        this.d3LineBasis = d3.svg.line().interpolate("basis");

        this.addMarkerDefinition = function(name, color) {
            var size = (graph.settings.minMarkerSize + graph.settings.maxMarkerSize) / 2;
            graph.markers
                .append('svg:marker')
                .attr('id', (graph.id||'') + graph.settings.markerId + "_" + name)
                .attr("viewBox", "0 0 " + (10 * size) + " " + (10 * size))
                .attr('preserveAspectRatio', 'xMinYMin')
                .attr("refX", 10 * size)
                .attr("refY", 10 * size)
                .attr('markerUnits', 'strokeWidth')
                .attr("markerWidth", 5 * size)
                .attr("markerHeight", 3 * size)
                .attr("fill", color)
                .attr("orient", "auto")
                .append("svg:path")
                .attr("d", "M0,0L" + (10 * size) + "," + (10 * size) + "L0," + (10 * size) + "z");
        };

        this.hasMarkerDefinition = function(name) {
            return graph.vis.selectAll('svg defs marker[id="' + (graph.id||'') + graph.settings.markerId + '_' + name + '"]')[0].length > 0;
        };

        this.updateMarkerSizes = function(scale) {
            // TODO: MARKER SIZE
            var normalized = (graph.settings.minMarkerSize + graph.settings.maxMarkerSize) / 2;

            var size = normalized * (scale > 1 ? 1 : (scale||1.0));
            if(size < graph.settings.minMarkerSize)
                size = graph.settings.minMarkerSize;
            if(size > graph.settings.maxMarkerSize)
                size = graph.settings.maxMarkerSize;

            graph.vis.selectAll('svg defs marker')
                .attr('viewBox', '0 0 ' + (10 * size) + ' ' + (10 * size))
                .attr("refX", 10 * size)
                .attr("refY", 10 * size)
                .attr("markerWidth", 5 * size)
                .attr("markerHeight", 3 * size)
                .attr("d", "M0,0L" + (10 * size) + "," + (10 * size) + "L0," + (10 * size) + "z");

            graph.vis.selectAll('svg defs marker path')
                .attr("d", "M0,0L" + (10 * size) + "," + (10 * size) + "L0," + (10 * size) + "z");
        };

        this.setMarkerColor = function(name, color) {
            graph.vis.select('svg defs marker[id="' + (graph.id||'') + graph.settings.markerId + '_' + name + '"]').attr('fill', color);
        };

        this.addLink = function (linkSettings) {
            var from = linkSettings.from;
            var to = linkSettings.to;
            var weight = linkSettings.weight || 1;
            var data = linkSettings.data;
            var tag = linkSettings.tag;
            var type = linkSettings.type||0;
            var update = linkSettings.update == false ? false : true;

            var source = graph.d3nodes().getNode(from),
                target = graph.d3nodes().getNode(to),
                link;

            if (!source) {
                _DEBUG("Unable to find source node: " + from);
                return false;
            }

            if (!target) {
                _DEBUG("Unable to find target node: " + to);
                return false;
            }

            for (var i = 0; i < source.to.length; i++) {
                if (source.to[i].target === target && (linkSettings.type||0) == (source.to[i].type||0)) {
                    link = source.to[i];
                    break;
                }
            }

            if (link) {
                link.value += weight;
                if (data)
                    link.data.push(data);

                if (tag) {
                    var found = false;
                    $.each(link.tags, function (i, t) {
                        if (t.tag == tag) {
                            t.weight += weight;
                            found = true;
                            return false;
                        }
                    });
                    if (!found)
                        link.tags.push({ tag: tag, weight: weight });
                }
            }
            else {
                link = {
                    source: source,
                    target: target,
                    tags: tag ? [{ tag: tag, weight: weight}] : [],
                    data: data ? [data] : [],
                    value: weight,
                    normalized: 0,
                    type: type,
                    ratio: weight,
                    marker: linkSettings.marker
                };

                source.to.push(link);
                target.from.push(link);

                if (graph.events.onNodeChanged && typeof (graph.events.onNodeChanged) === 'function') {
                    graph.events.onNodeChanged(source);
                    graph.events.onNodeChanged(target);
                }

                graph.links.push(link);
            }

            if (update)
                graph.update();

            return link;
        };

        this.selectRandomLink = function() {
            var i = parseInt(Math.random() * graph.links.length);
            return graph.links[i];
        };

        this.updateLinkSizesForZoom = function(scale) {
            var self = this;
            graph._links
                .style("stroke-width", function (d) { return /*Math.max(.25,*/ self.getLinkWidth(d) / scale; /*);*/ })
                .attr('d', function(d) { return self.calculatePath(d); });
            this.updateMarkerSizes(scale);
        };

        /// Public Method: removeLink(from, to, tag)
        ///
        /// <summary>
        /// Decreases the link's weight by one, and if the weight <= 0, removes the link from the graph.
        /// If a tag is specified, it also removes one instance of the tag.
        /// </summary>
        /// <param name="from">The name of the source node.</param>
        /// <param name="to">The name of the target node.</param>
        /// <param name="tag">(optional) The name of the tag to also be removed.</param>
        /// <returns>If successful, undefined, otherwise an error message.</returns>
        this.removeLink = function (from, to, tag, dontUpdate, forceRemove) {
            var found = false;
            var t = tag;

            for (var i = 0; i < graph.links.length; i++) {
                if (graph.links[i]) {
                    if (graph.links[i].source.id == from && graph.links[i].target.id == to) {
                        var link = graph.links[i];
                        found = true;

                        link.value -= 1;
                        if (link.value <= 0 || forceRemove) {
                            // remove links from source and target nodes
                            for(var j = 0; j < graph.links[i].source.to.length; j++) {
                                if(graph.links[i].source.to[j].target.id == graph.links[i].target.id) {
                                    graph.links[i].source.to.splice(j, 1);
                                    break;
                                }
                            }
                            for(var j = 0; j < graph.links[i].target.from.length; j++) {
                                if(graph.links[i].target.from[j].source.id == graph.links[i].source.id) {
                                    graph.links[i].target.from.splice(j, 1);
                                    break;
                                }
                            }

                            graph.links.splice(i, 1);
                        }
                        else if (t) {
                            var index = $.inArray(t, graph.d3tags().getTagNames(link));
                            if (index >= 0) {
                                var _tag = link.tags[index];

                                // and drop the tag weight
                                _tag.weight -= 1;

                                // if the tag weight is zeroed, delete it
                                if (_tag.weight <= 0)
                                    link.tags.splice(index, 1);
                            }
                        }
                    }
                }
            }
            if (!found)
                return "Unable to find the specified link.";
            else if(!dontUpdate)
                graph.update();
        },

            this.calculateLinks = function () {
                var max = 0,
                    min = Infinity,
                    i,
                    w;

                for (i = 0; i < graph.links.length; i++) {
                    w = graph.links[i].value;
                    if (w < min)
                        min = w;
                    if (w > max)
                        max = w;
                }
                //if (min == max)
                //    min--;

                for (i = 0; i < graph.links.length; i++) {
                    if(max == min)
                        graph.links[i].normalized = graph.links[i].ratio = 0;
                    else {
                        w = (graph.links[i].value - min) / (max - min);
                        graph.links[i].normalized = w;
                        graph.links[i].ratio = graph.links[i].value / max;
                    }
                    graph.links[i].tooltip = this.getLinkTooltip(graph.links[i]);
                }
            };


        this.calculatePath = function (d) {
            if(graph.settings.taperedLinks) {
                var strength_scale = d3.scale.linear().range([graph.settings.taperedLinkMinSize||4, graph.settings.taperedLinkMaxSize||15]) /* thickness range for flow lines */
                    .domain([0, d3.max(graph.links, function(d) {
                        return d.weight;
                    })]);

                var offsetScale = .1;
                var sourceX = d.source.x;
                var sourceY = d.source.y;
                var targetX = d.target.x;
                var targetY = d.target.y;
                var sr = d.source._radius || d.source.radius;
                var tr = d.target._radius || d.target.radius;

                var slope = Math.atan2((targetY - sourceY), (targetX - sourceX));
                var slopePlus90 = slope + (Math.PI/2);

                var halfX = (sourceX + targetX)/2;
                var halfY = (sourceY + targetY)/2;

                var lineLength = Math.sqrt(Math.pow(targetX - sourceX, 2) + Math.pow(targetY - sourceY, 2));

                var MP1X = halfX + (offsetScale * lineLength + strength_scale(d.value)/2) * Math.cos(slopePlus90);
                var MP1Y = halfY + (offsetScale * lineLength + strength_scale(d.value)/2) * Math.sin(slopePlus90);
                var MP2X = halfX + (offsetScale * lineLength - strength_scale(d.value)/2) * Math.cos(slopePlus90);
                var MP2Y = halfY + (offsetScale * lineLength - strength_scale(d.value)/2) * Math.sin(slopePlus90);

                var points = [];
                points.push([(sourceX - strength_scale(d.value) * Math.cos(slopePlus90)),(sourceY - strength_scale(d.value) * Math.sin(slopePlus90))]);
                points.push([MP2X,MP2Y]);
                points.push(([(targetX  + tr * Math.cos(slope)), (targetY + tr * Math.sin(slope))]));
                points.push(([(targetX  + tr * Math.cos(slope)), (targetY + tr * Math.sin(slope))]));
                points.push([MP1X, MP1Y]);
                points.push([(sourceX + strength_scale(d.value) * Math.cos(slopePlus90)),(sourceY + strength_scale(d.value) * Math.sin(slopePlus90))]);

                return d3.svg.line().interpolate("basis")(points) + "Z";
            }
            else {
                var dir = true; //settings.directionalGraph();
                var sx = d.source.x,
                    sy = d.source.y,
                    tx = d.target.x,
                    ty = d.target.y,
                    sr = d.source._radius|| d.source.radius,
                    tr = d.target._radius|| d.target.radius,
                    dx = tx - sx,
                    dy = ty - sy,
                    dr = Math.sqrt(dx * dx + dy * dy) || 0.001,
                    xs = dir ? sx + dx * (sr / dr) : sx,
                    ys = dir ? sy + dy * (sr / dr) : sy,
                    xt = dir ? tx - dx * (tr / dr) : tx,
                    yt = dir ? ty - dy * (tr / dr) : ty;

                if (isNaN(xs)) xs = (sx || 0);
                if (isNaN(ys)) ys = (sy || 0);
                if (isNaN(xt)) xt = (tx || 0);
                if (isNaN(yt)) yt = (ty || 0);

                if(xs == xt && ys == yt)
                // loop it
                    return "M " + xs + " " + ys + " A 10 10 0 1 " + (xt > xs ? "1" : "0") + " " + (xt + 1) + " " + (yt + 1);

                /*
                 // if we're bi-directional, we need to adjust slightly - NOT WORKING!
                 var matches = $.grep(d.target.to, function(l) { return l.target.id == d.source.id; });
                 if(matches.length > 0) {
                 var t_angle = Math.atan2(xt - tx, yt - ty);
                 var s_angle = Math.atan2(xs - sx, ys - sy);
                 xt = tx + tr * Math.cos(t_angle + Math.PI / 32 * (ty > sy ? -1 : 1));
                 yt = ty + tr * Math.sin(t_angle + Math.PI / 32 * (ty > sy ? -1 : 1));
                 sx = sx + sr * Math.cos(s_angle + Math.PI / 32 * (sy > ty ? 1 : -1));
                 sy = sy + sr * Math.sin(s_angle + Math.PI / 32 * (sy > ty ? 1 : -1));

                 if(matches[0].target.id > d.source.id)
                 dr += 50;
                 else dr -= 50;
                 }
                 */

                // All of this logic comes from:
                // - http://www.kevlindev.com/gui/math/intersection/index.htm#Anchor-Introductio-4219 - for intersection of ellipse and circle
                // - http://www.w3.org/TR/SVG/implnote.html#ArcImplementationNotes - for calculating the center of the ellipse

                // calculate center of ellipse
                var x1p = (sx - tx) / 2;
                var y1p = (sy - ty) / 2;

                var sq = Math.sqrt(
                    ((dr * dr * dr * dr) - (dr * dr * y1p * y1p) - (dr * dr * x1p * x1p)) /
                        ((dr * dr * y1p * y1p) + (dr * dr * x1p * x1p)));

                if(xt < xs)
                    sq *= -1;

                var cxp = sq * y1p;
                var cyp = sq * (-1 * x1p);
                var cx = cxp + (sx + tx) / 2;
                var cy = cyp + (sy + ty) / 2;

                var result = Intersection.intersectCircleEllipse({ x: tx, y: ty}, tr, { x: cx, y: cy }, dr, dr);
                if(result.points.length) {
                    // find the correct point (closest to source) and use that as our target
                    var min = 1000000;
                    var pt;
                    $.each(result.points, function(i, point) {
                        var dist = Math.sqrt(Math.pow(point.x - sx, 2) + Math.pow(point.y - sy, 2));
                        if(dist < min) {
                            min = dist;
                            pt = point;
                        }
                    });

                    if(pt) {
                        xt = pt.x;
                        yt = pt.y;
                    }
                }

                return "M " + sx + " " + sy + " A " + dr + " " + dr + " 0 0 " + (xt > xs ? "1" : "0") + " " + xt + " " + yt;
            }
        };

        this.calculatePathTween = function (d, i, a) {
            return function (b) {
                if(!d || !b)
                    return a;

                // calculate the standard string-based interpolation value
                var path = graph.d3links().calculatePath(d);
                if(!path)
                    return '';

                var x = d3.interpolateString(a, path);

                // fix the sweep-path value
                var result = x(b);
                var vals = result.split(' ');
                vals[7] = Math.floor(parseFloat(vals[7]));
                vals[8] = Math.floor(parseFloat(vals[8]));

                // and join it back together
                return vals.join(' ');
            }
        };

        this.getLinkWidth = function (d, thickness) {
            var ratio = d.normalized; //ratio;

            var max = thickness||(graph.settings.maxLinkThickness||4);
            var min = graph.settings.minLinkThickness||1;
            d.linkThickness = (max-min) * ratio + min; //Math.round((max - min) * ratio + min);  //(1.0 + ratio) * graph.settings.linkThickness;

            // double the link thickness for links that have source/target nodes of matching colors
            //if(window.application.state.colorFilterActive && d.source.color == d.target.color)
            //    d.linkThickness *= 2;
            //_DEBUG("Getting link thickness: ratio=" + d.ratio + " thickness=" + thickness + " max=" + max + " min=" + min + " val=" + (d.linkThickness||1));

            return d.linkThickness||1;
        };

        this.updateLinkColors = function() {
            // calculate link positions
            graph.visLinks
                .selectAll('g.links path')
                .style('stroke', $.proxy(function(d) {
                    var c = this.getLinkColor(d);
                    d.marker = 'custom_' + c.replace(/[()]/g, '');
                    if(!graph.d3links().hasMarkerDefinition(d.marker))
                        graph.d3links().addMarkerDefinition(d.marker, c);
                    graph.visLinks.selectAll('svg g.links path[source="' + d.source.id + '"][target="' + d.target.id + '"]').attr('marker-end', 'url(#' + (graph.id||'') + graph.settings.markerId + '_' + d.marker + ')');
                    return c;
                }, this));
        };

        this.getLinkColor = function (d, minColor, maxColor) {
            if(d.data && d.data.length > 0 && d.data[0].get && d.data[0].get('isEdge')) {
                // HACK!
                if(window.application.state.colorFilterActive && d.source.color && d.source.color == d.target.color) {
                    d.color = d.source.color.indexOf('#') >= 0 ? d3colors.getLighterColorHex(d.source.color) : d.source.color;
                    if(d.color.indexOf('#') >= 0) {
                        // limit the brightness
                        var rgb = d3colors.getRgbaFromHex(d.color);
                        var brightness = (rgb[0] * 2 + rgb[1] + rgb[2] * 3) / 6;
                        if(brightness > 200)
                            d.color = d3colors.getDarkerColorHex(d.source.color,.8);
                    }
                }
                /*else if(settings.edgeTypes) {
                 var type = settings.edgeTypes[d.data[0].get('relationship')];

                 // HACK: if more than 1 type of relationship on this link, make it gray
                 d.color = (!type || !type.color) ? '#888888' : type.color; //graph.d3styles().getDarkerColorHex(type.color,.8);
                 }*/
                else
                    d.color = (d.data[0].get('quality') == 'increasing') ? minColor || graph.d3styles().colors.linkMin : maxColor || graph.d3styles().colors.linkMax;
            }
            else
                d.color = d3colors.rgba(d3colors.colorBlend(d3colors.getRgbaFromHex(minColor || graph.d3styles().colors.linkMin), d3colors.getRgbaFromHex(maxColor || graph.d3styles().colors.linkMax), d.ratio));
            return d.color;
        };

        this.getLinkTooltip = function (link) {
            if (graph.events.onLinkTooltip && typeof (graph.events.onLinkTooltip === "function"))
                return graph.events.onLinkTooltip(link);
        };

        this.getSharedLinks = function (nodes) {
            var links = [];
            var dict = new Array();
            $.each(nodes, function (i, n) { dict[n.id] = 1; });
            $.each(nodes, function (i, n) {
                $.each(n.from, function (i, from) {
                    if (dict[from.source.id] == 1)
                        links.push(from);
                });
                $.each(n.to, function (i, to) {
                    if (dict[to.target.id] == 1)
                        links.push(to);
                });
            });
            return links;
        };

        this.clearLinks = function() {
            var self = this;
            $.each(graph.links, function(i, link) {
                self.removeLink(link.from, link.to, null, false, true);
            });
            graph.update();
        };

        this.onLinkMouseover = function(link) {
            //_DEBUG("Mouseover link: " + link.source.title);
        };

        this.onLinkMouseout = function(link) {
            //_DEBUG("Mouseout link: " + link.source.title);
        };
    }