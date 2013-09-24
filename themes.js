if(Meteor.isClient)
d3themes = function () {
    this.initialize = function (graph, page) {
        if(!data)
            data = require('data');

        var self = this;
        this.page = page;
        this.graph = graph;

        // set up themes
        $('#themes-tabs span.ui-icon-close').live('click', function() {
            var t = this;

            // prompt to confirm
            var buttons = [
                { text: i18n.translate('No'), isCancel: true, icon: 'icon-remove' },
                {
                    text: i18n.translate('Yes'),
                    icon: 'icon-ok',
                    isOk: true,
                    handler: function() {
                        // delete
                        data.deleteTheme($(t).attr('theme-id'));

                        // remove the tab and content
                        var panelId = $(t).parent().find('a').attr('href');
                        $(t).closest('li').remove();
                        $( panelId ).remove();
                        window._themesTabs.tabs('refresh');

                        // select the first available tab and make it active
                        window._themesTabs.tabs({ selected: 0 });

                        self.updateButtons();
                    }
                }
            ];

            self.page.showModal(i18n.translate('Delete Theme?'), i18n.translate('Delete this theme permanently?'), buttons);
        });

        $('#toggle-themes').click(function() {
            if(!settings.showThemes)
                settings.showThemes = true;
            else
                settings.showThemes = false;
            if(settings.showThemes) {
                $(this).addClass('highlight');
                self.displayThemes(true);
            }
            else {
                $(this).removeClass('highlight');
                self.displayThemes(false);
            }
        });

        $('#add-theme-form').dialog({
            autoOpen: false,
            modal: true,
            resizable: false,
            width: 400,
            buttons: {
                "Ok": function() {
                    self.addTheme();
                },
                "Cancel": function() {
                    $(this).dialog("close");
                }
            }
        });

        $('#rename-theme-form').dialog({
            autoOpen: false,
            modal: true,
            resizable: false,
            width: 400,
            buttons: {
                "Ok": function() {
                    self.renameTheme();
                },
                "Cancel": function() {
                    $(this).dialog("close");
                }
            }
        });

        $('#themes-toolbar-add').click(function() {
            // prompt for theme name
            $('#add-theme-name').val('');
            $('#add-theme-form').dialog('open');
        });

        $('#themes-toolbar-rename').click(function() {
            var t = self.getSelectedTheme();
            if(t) {
                $('#rename-theme-name').val(t.get('title'));
                $('#rename-theme-form').dialog('open');
            }
        });

        $('#themes-toolbar-add-trends').click(function() {
            var t = self.getSelectedTheme();
            if(!t) {
                // first add a theme
                // prompt for theme name
                $('#add-theme-name').val('');
                $('#add-theme-form').dialog('open');
                self.callback = function(theme) { self.addSelectedTrendsToTheme.call(self, theme); };
                return;
            }

            self.addSelectedTrendsToTheme(t);
        });

        $('#themes-toolbar-create-scenario').click(function() {
            var trends = self.getSelectedThemeTrends();
            if(!trends.length) {
                alert("This theme doesn't contain any trends.  Please add some trends first and then try again.");
                return;
            }

            // select them
            self.graph.nodeSelector.clear();

            $.each(self.graph.graph.nodes, function(i, node) { node.selected = false; });
            $.each(trends, function(i, trend) {
                var node = self.graph.graph.nodelib().getNode(trend.id);
                if(node)
                    self.graph.nodeSelector.toggleNode(node)
            });

            window.location = '#/edit/scenario';
        });

        $('.remove-theme-trend').live('click', function() {
            var t = self.getSelectedTheme();
            if(!t)
                return;

            var id = $(this).attr('trend-id');

            // remove it on the server
            $.post(
                '/api/0/projects/1/fragcols/' + t.id + '/fragments/remove/' + id,
                {},
                function(d) {
                    // update theme
                    t.set({ _embed: { fragments: d._embed.fragments } });

                    // update display
                    self.setThemeTrends(t);
                }
            ).error(function() { alert('There was an error removing the trend.  Please try again.'); });
        });

        $('#add-theme-name').keydown(function(e) {
            var k = e.keyCode|| e.which;
            if(k == 13) {
                self.addTheme();
                return false;
            }
        });

        $('#rename-theme-name').keydown(function(e) {
            var k = e.keyCode|| e.which;
            if(k == 13) {
                self.renameTheme();
                return false;
            }
        });
    };

    this.addSelectedTrendsToTheme = function(theme) {
        var self = this;

        // get selected trends
        var selected = this.graph.nodeSelector.selection;
        if(!selected || !selected.length) {
            alert('Please select at least one trend and then try again.  Right-click on a trend to select it.')
            return;
        }

        // add them to the theme
        var list = [];
        for(var i = 0; i < selected.length; i++)
            list.push(selected[i].id);

        // add them on the server
        $.post(
            '/api/0/projects/1/fragcols/' + theme.id + '/fragments/add/' + list.join(','),
            {},
            function(d) {
                // update theme
                theme.set({ _embed: { fragments: d._embed.fragments } });

                // update display
                self.setThemeTrends(theme)
            }
        ).error(function() { alert('There was an error adding the trends.  Please try again.'); });
    };

    this.displayThemes = function(show) {
        var self = this;

        if(show) {
            $('#themes-box').show();
            if(!data.themes) {
                // load from server
                data.loadThemes(function() {
                    // create a tab for each theme
                    $.each(data.themes.models, function(i, t) {
                        self.addThemeToTabs(t);
                    });

                    window._themesTabs.tabs({ selected: 0 });
                    $('#themes-loader').hide();
                    $('#themes-tabs').show();
                    self.updateButtons();
                });
            }
        }
        $('#themes-box').animate({ height: show ? '225px' : '0' }, 'fast', function() {
            if(!show)
                $('#themes-box').hide();
        });
        $('#graph-controls-bottom').animate({ bottom: show ? '230px' : '0' }, 'fast');

        if(!show)
            window.bucket = null;
    };

    this.addTheme = function() {
        var self = this;

        // create on server
        var name = $('#add-theme-name').val();

        // validate name
        if(name.trim().length == 0) {
            self.page.showModal(
                'Invalid Name',
                'Please enter a valid theme name and try again.',
                [
                    { text: i18n.translate('Close'), isCancel: true, handler: function() { $.fancybox.close(); $('#add-theme-name').focus(); } }
                ]
            );
            return;
        }

        data.addTheme(name, function(t, error) {
            if(t) {
                self.addThemeToTabs(t, true);
                $('#add-theme-form').dialog("close");
                self.updateButtons();
                if(self.callback) {
                    self.callback(t);
                    self.callback = null;
                }
            }
            else {
                self.page.showModal(
                    'Error',
                    error,
                    [
                        { text: i18n.translate('Close'), isCancel: true, handler: function() { $.fancybox.close(); $('#add-theme-name').focus(); } }
                    ]
                );
            }
        });
    };

    this.renameTheme = function() {
        var self = this;
        var name = $('#rename-theme-name').val();
        if(name.trim().length == 0) {
            self.page.showModal(
                'Invalid Name',
                'Please enter a valid theme name and try again.',
                [
                    { text: i18n.translate('Close'), isCancel: true, handler: function() { $.fancybox.close(); $('#rename-theme-name').focus(); } }
                ]
            );
            return;
        }

        // find the selected theme
        var t = self.getSelectedTheme();
        if(t) {
            if(name == t.get('title'))
                return;

            // and save
            t.save({ title: name }, {
                success: function(ob, response) {
                    // update tab title
                    $('#themes-tab-list li.ui-tabs-selected a span').html(ob.get('title'));
                    $('#rename-theme-form').dialog('close');
                },
                error: function(ob, error) {
                    self.page.showModal(
                        'Error',
                        error,
                        [
                            { text: i18n.translate('Close'), isCancel: true, handler: function() { $.fancybox.close(); $('#rename-theme-name').focus(); } }
                        ]
                    );
                }
            });
        }
    };

    this.addThemeToTabs = function(t, select) {
        window._themesTabs.append('<div id="theme_' + t.id + '"></div>');
        window._themesTabs.tabs('add', '#theme_' + t.id, t.get('title'));
        var count = $('#themes-tab-list li').length;
        if(select)
            window._themesTabs.tabs({ selected: count - 1 });
        $('#themes-tab-list li a[href="#theme_' + t.id + '"]')
            .parent()
            .attr('theme-id', t.id)
            .append('<span class="ui-icon ui-icon-close" theme-id="' + t.id + '" style="float:left;margin:0.4em 0.2em 0 0; cursor:pointer;"></span>');

        this.setThemeTrends(t);
        this.updateButtons();
    };

    this.getSelectedTheme = function() {
        return data.themes.get($('#themes-tab-list li.ui-tabs-selected').attr('theme-id'));
    };

    this.getSelectedThemeTrends = function() {
        var theme = this.getSelectedTheme();
        if(!theme)
            return [];

        var els = $('#theme_' + theme.id + ' span.theme-trend');
        var trends = [];
        $.each(els, function(i, trend) {
            var f = data.getTrend(parseInt($(trend).attr('trend-id')));
            if(f)
                trends.push(f);
        });

        return trends;
    };

    this.setThemeTrends = function(t) {
        var self = this;
        var list = t.get('_embed').fragments;
        $('#theme_' + t.id).html('');

        var trends = [];
        $.each(list, function(i, trend) {
            var tr = data.getTrend(trend);
            if(tr)
                trends.push(tr);
        });

        trends.sort(function(a, b) {
            var titleA = a.get('title').toLowerCase();
            var titleB = b.get('title').toLowerCase();
            if(titleA < titleB)
                return -1;
            else if(titleA > titleB)
                return 1;
            else
                return 0;
        });

        $.each(trends, function(i, trend) {
            self.addTrendToTheme(t, trend);
        });
    };

    this.addTrendToTheme = function(t, trend) {
        var html = "<span class='theme-trend' trend-id='" + trend.id + "'><span>" + trend.get('title') + "</span><button class='remove-theme-trend' trend-id='" + trend.id + "'><i class='icon-remove'></i></button></span>";
        $('#theme_' + t.id).append(html);
    };

    this.updateButtons = function() {
        var theme = this.getSelectedTheme();
        if(theme) {
            $('#themes-toolbar-rename').show();
            $('#themes-toolbar-create-scenario').show();
        }
        else {
            $('#themes-toolbar-rename').hide();
            $('#themes-toolbar-create-scenario').hide();
        }
    };
}